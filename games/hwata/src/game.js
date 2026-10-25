// 화면·조작·하루 흐름. 계산은 rules.js / world.js / quests.js / light.js 가 맡는다.
import {
  DAY_SECONDS, NIGHT_SECONDS, MATERIALS, RECIPES, RECIPE_ORDER, PATIENTS, UPGRADES, PAGES,
  FISH_PER_DAY, BREATH_PER_SEC, ARROW_PACK, DAYS, MAX_MENU, MED_UPGRADE_MAIN, MAX_MED_LEVEL,
} from './data.js';
import {
  newState, addItem, count, basketWeight, carryLimit, canCarry, collapseLoss, spendStamina,
  isUnlocked, canDevelop, develop, canBrew, brew, medPrice, canUpgradeMed, upgradeMed, brewGrade, serve,
  patientsForDay, pickPatientType, canBuyUpgrade, buyUpgrade, buyArrows,
  maxStamina, herbZone, openPot, hasPage, digHardness, swimSpeed, harpoonDamage, sellItem,
} from './rules.js';
import {
  W, H, SEA, T, ZONES, ZONE_NAMES, BOAT_X, makeWorld, tile, setTile, isSolid, isWater, canDig, floorY,
  chestSpots, spawnDaily, zoneAt,
} from './world.js';
import { activeQuests, questChoices, questAct, QUESTS } from './quests.js';
import { drawSprite, spriteSize, sprite, iconURL } from './sprites.js';
import { computeLight } from './light.js';
import { sfx, unlockAudio, toggleMute, isMuted } from './audio.js';

const SAVE_KEY = 'hwata-sea-v1';
const REACH = 2.8;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cvs = $('game');
const ctx = cvs.getContext('2d');
const shadeCvs = document.createElement('canvas');
const shadeCtx = shadeCvs.getContext('2d');
let G = null;
const view = { cw: 0, ch: 0, ts: 24, dpr: 1 };
const keys = new Set();
const joy = { x: 0, y: 0, id: null };
const SETTINGS_KEY = 'hwata-settings';
const settings = (() => { try { return { vibe: true, rotateSkip: false, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }; } catch { return { vibe: true, rotateSkip: false }; } })();
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 무시 */ } };

// 손에 전해지는 짧은 떨림(되는 기기에서만)
function vib(ms) {
  if (!settings.vibe) return;
  try { navigator.vibrate?.(ms); } catch { /* 무시 */ }
}

// ---------- 저장 ----------

function snapshot() {
  return { s: G.s, tiles: Array.from(G.world.tiles), seed: G.seed };
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot())); } catch { /* 저장 안 돼도 진행 */ }
}

function restore(data) {
  if (!data || !data.s || !Array.isArray(data.tiles) || data.tiles.length !== W * H) return null;
  const world = makeWorld();
  world.tiles.set(data.tiles);
  const s = data.s;
  s.dex ??= {};
  s.pages ??= [];
  s.pots ??= [];
  return { s, world, seed: data.seed ?? 1 };
}

function loadSaved() {
  try { return restore(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch { return null; }
}

function freshGame() {
  return { s: newState(), world: makeWorld(), seed: Math.floor(Math.random() * 1e9) };
}

// ---------- 알림 ----------

function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = text;
  $('toasts').append(el);
  setTimeout(() => el.classList.add('out'), 2300);
  setTimeout(() => el.remove(), 2800);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}

function floatText(text, x, y, color = '#fff6d8') {
  G.floats.push({ text, x, y, t: 1.2, color });
}

function flyIcon(key, wx, wy) {
  const r = cvs.getBoundingClientRect();
  const bag = $('bagBtn').getBoundingClientRect();
  G.flyers.push({
    key, t: 0,
    x0: r.left + (wx - G.cam.x) * view.ts, y0: r.top + (wy - G.cam.y) * view.ts,
    x1: bag.left + bag.width / 2, y1: bag.top + bag.height / 2,
  });
}

function burst(x, y, color, n = 8, opt = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (opt.speed ?? 3) * (0.4 + Math.random());
    G.parts.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opt.up ?? 0), life: opt.life ?? 0.7, max: opt.life ?? 0.7,
      color, size: opt.size ?? 0.14, grav: opt.grav ?? 2, glow: !!opt.glow, drag: opt.drag ?? 2,
    });
  }
}

function bubble(x, y, n = 1) {
  for (let i = 0; i < n; i++) {
    G.bubbles.push({ x: x + (Math.random() - 0.5) * 0.4, y, r: 0.06 + Math.random() * 0.1, t: 0, wob: Math.random() * 6 });
  }
}

// ---------- 창(대화·안내) ----------

let typer = null;

function openPanel({ title, body, choices = [], portrait, icon }) {
  G.paused = true;
  releaseInput();
  $('dialog').hidden = false;
  $('dlgName').textContent = title;
  const por = $('dlgPortrait');
  const key = portrait ?? icon;
  por.hidden = !key;
  if (key) paintPortrait(por, key);
  const box = $('dlgChoices');
  box.innerHTML = '';
  for (const c of choices) {
    const b = document.createElement('button');
    b.className = 'btn' + (c.kind === 'primary' ? ' gold' : '');
    b.textContent = c.label;
    b.disabled = !!c.disabled;
    b.addEventListener('click', () => { sfx.click(); vib(8); c.onClick(); });
    box.append(b);
  }
  typeText(body);
}

// 글자가 한두 자씩 나온다. 나머지 글자는 투명하게 미리 깔아 두어 버튼이 움직이지 않게 한다. 누르면 바로 다 보인다.
const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function typeText(text) {
  clearInterval(typer);
  const el = $('dlgText');
  let i = 0;
  const show = () => { el.innerHTML = `${esc(text.slice(0, i))}<span class="ghost">${esc(text.slice(i))}</span>`; };
  show();
  typer = setInterval(() => {
    i = Math.min(text.length, i + 2);
    show();
    if (i >= text.length) clearInterval(typer);
  }, 16);
  el.onclick = () => { clearInterval(typer); i = text.length; show(); };
}

function closePanel() {
  clearInterval(typer);
  $('dialog').hidden = true;
  G.paused = false;
}

function paintPortrait(canvas, key) {
  const { w, h } = spriteSize(key);
  const px = Math.max(4, Math.floor(72 / Math.max(w, h)));
  canvas.width = (w + 2) * px;
  canvas.height = (h + 2) * px;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.drawImage(sprite(key), px, px, w * px, h * px);
}

function fadeTo(text, mid) {
  const f = $('fade');
  $('fadeText').textContent = text;
  f.hidden = false;
  requestAnimationFrame(() => f.classList.add('on'));
  setTimeout(() => {
    mid();
    setTimeout(() => {
      f.classList.remove('on');
      setTimeout(() => { f.hidden = true; }, 450);
    }, 650);
  }, 450);
}

// ---------- 하루 시작 ----------

const HERBS = new Set(['seaweed', 'kelp', 'oyster', 'seaCucumber', 'clover']);
const FISH = {
  pollockFish: { hp: 1, speed: 3.2, item: 'pollock', w: 1.1, h: 0.5, small: true },
  rockfishFish: { hp: 2, speed: 2, item: 'rockfish', w: 1.1, h: 0.7 },
  cuttlefishFish: { hp: 1, speed: 2.5, item: 'cuttlebone', w: 1.2, h: 0.6, small: true },
  seahorseFish: { hp: 1, speed: 0.6, item: 'seahorse', w: 0.6, h: 1.1, small: true, netOnly: true },
  jelly: { hp: 99, speed: 0.6, w: 0.8, h: 0.9 },
  moray: { hp: 2, speed: 0, w: 1.6, h: 0.5 },
  shark: { hp: 8, speed: 2.4, w: 3, h: 1.1 },
};

function startDay() {
  const s = G.s;
  s.phase = 'day';
  s.stamina = maxStamina(s);
  s.flags.earlyBonus = false;
  G.time = 0;
  G.props = spawnDaily(G.world, s.day, mulberry32(G.seed + s.day * 7919));
  for (const q of activeQuests(s)) {
    if (q.id === 'zhangfei') {
      G.props.push({ id: 'q-' + q.id, type: 'npc', quest: q.id, sprite: q.npc, x: q.x, y: SEA - 1, floating: true });
      G.props.push({ id: 'bottle', type: 'bottle', x: q.x + 2, y: SEA - 1, floating: true });
    } else {
      G.props = G.props.filter((p) => Math.abs(p.x - q.x) > 1);
      G.props.push({ id: 'q-' + q.id, type: 'npc', quest: q.id, sprite: q.npc, x: q.x, y: floorY(G.world, q.x) - 1 });
    }
  }
  G.ents = spawnFish(mulberry32(G.seed + s.day * 104729));
  G.shots = [];
  G.floats = [];
  G.parts = [];
  G.bubbles = [];
  G.flyers = [];
  G.mine = null;
  G.gauge = null;
  G.aim = null;
  G.hold = null;
  G.dayLog = {};
  G.zone = 'shallow';
  G.warned = false;
  G.lowWarned = false;
  G.hurtT = 0;
  G.player = { x: BOAT_X + 7.5, y: SEA + 0.2, w: 0.8, h: 0.8, vx: 0, vy: 0, face: 1, ang: 0, kick: 0, swing: 0, cool: 0 };
  G.cam = null;
  G.ended = false;
  save();
  $('night').hidden = true;
  $('dayui').hidden = false;
  setMode(G.mode ?? 'hand');
  renderTracker();
  morningCard();
}

function spawnFish(rng) {
  const ents = [];
  const add = (type, x, y, extra = {}) => {
    const f = FISH[type];
    ents.push({ type, x, y, w: f.w, h: f.h, vx: 0, vy: 0, hp: f.hp, t: rng() * 3, face: rng() < 0.5 ? -1 : 1, home: { x, y }, ...extra });
  };
  const waterAt = (x0, x1, y0, y1) => {
    for (let i = 0; i < 80; i++) {
      const x = x0 + rng() * (x1 - x0), y = y0 + rng() * (y1 - y0);
      if (isWater(G.world, Math.floor(x), Math.floor(y)) && isWater(G.world, Math.floor(x + 1), Math.floor(y))) return { x, y };
    }
    return { x: x0, y: y0 };
  };
  // 명태는 떼로 다닌다
  for (let g = 0; g < 2; g++) {
    const c = waterAt(50, 115, 28, 60);
    for (let i = 0; i < FISH_PER_DAY.pollock / 2; i++) add('pollockFish', c.x + rng() * 3, c.y + rng() * 2, { school: g });
  }
  for (let i = 0; i < FISH_PER_DAY.rockfish; i++) { const c = waterAt(48, 92, 25, 55); add('rockfishFish', c.x, c.y); }
  for (let i = 0; i < FISH_PER_DAY.cuttlefish; i++) { const c = waterAt(45, 90, 22, 50); add('cuttlefishFish', c.x, c.y); }
  if (rng() < 0.7) { const c = waterAt(120, 136, 90, 104); add('seahorseFish', c.x, c.y); }
  for (let i = 0; i < FISH_PER_DAY.jelly; i++) { const c = waterAt(35, 135, 15, 90); add('jelly', c.x, c.y); }
  // 곰치는 바위 틈에서 기다린다
  for (const [x, y] of [[71, 44], [100, 62]]) add('moray', x, y, { lunge: 0, cool: 0 });
  const c = waterAt(98, 132, 66, 100);
  add('shark', c.x, c.y, { cool: 0 });
  return ents;
}

function morningCard() {
  const s = G.s;
  const lines = [];
  if (s.day === 1) {
    lines.push('바닷가 마을에 작은 한의원을 연 화타. 낮에는 배를 타고 나가 바닷속에서 약재를 따고, 밤에는 그 약재로 약을 지어 환자를 봅니다.');
    lines.push('');
    lines.push('왼쪽 엄지: 화면 왼쪽 아래를 대고 끌면 그쪽으로 헤엄칩니다.');
    lines.push('오른쪽 엄지: 노란 버튼이 가까운 약재·물고기·모래를 알아서 겨눕니다. 따기는 누르고 있다가 원이 초록일 때 떼면 상급!');
    lines.push('노란 버튼 옆 동그라미로 도구를 바꿉니다: 손 · 작살 · 그물 · 삽');
    lines.push('왼쪽 위 숨 원이 비기 전에 수면으로 올라오세요. 다 했으면 배 옆에서 [배에 오르기].');
    if (view.ch > view.cw) lines.push('휴대폰을 가로로 돌리면 더 넓게 보입니다.');
  } else {
    const tips = {
      2: '아낙과 노인들이 미역탕과 굴죽을 찾습니다. 굴은 바위 옆면에 붙어 있습니다.',
      3: '오늘부터 북어탕을 개발할 수 있습니다. 명태 떼는 산호 비탈 아래 깊은 물에서 다닙니다.',
      4: '오늘부터 해삼환을 개발할 수 있습니다. 해삼은 깊은 바다 모래밭에 있습니다.',
      5: '청낭서를 싣고 가던 배가 이 바다에 가라앉았다는 소문입니다. 모래 속 상자를 찾아보세요.',
      6: '수면 근처에 누군가 술통을 붙잡고 떠 있다는 소문이 돕니다.',
      7: '마지막 날입니다. 오늘 밤 영업이 끝나면 1부가 마무리됩니다.',
    };
    lines.push(tips[s.day] ?? '');
  }
  const q = activeQuests(s).filter((x) => x.day === s.day);
  if (q.length) lines.push('', `오늘 바다에서 누군가를 만날 것 같습니다: ${q.map((x) => x.name).join(', ')}`);
  openPanel({
    title: `${s.day}일째 아침`,
    body: lines.join('\n'),
    portrait: 'hwata',
    choices: [{ label: '바다로 뛰어든다', kind: 'primary', onClick: () => { closePanel(); sfx.splash(); } }],
  });
}

// ---------- 오늘의 할 일 ----------

const QUEST_HINT = { haenyeo: '해녀 할망에게 미역 주기 · 얕은 바다', boy: '울상인 소년 살피기 · 산호 비탈', zhangfei: '물에 빠진 큰 사내 · 수면 근처' };

function trackerLines() {
  const s = G.s;
  const out = [];
  for (const q of activeQuests(s)) out.push({ icon: q.npc === 'zhangfei' ? 'barrel' : 'hand', text: QUEST_HINT[q.id] });
  for (const id of RECIPE_ORDER) {
    if (s.meds[id] || !isUnlocked(s, id)) continue;
    const need = Object.entries(RECIPES[id].inputs).map(([k, n]) => `${MATERIALS[k].name} ${Math.min(count(s, k), n * 2)}/${n * 2}`).join(' · ');
    out.push({ icon: RECIPES[id].main, text: `${RECIPES[id].name} 개발: ${need}` });
  }
  const p = (s.pages ?? []).length;
  if (p < 3 && s.day >= 2) out.push({ icon: 'chest', text: `청낭서 ${p}/3 · 모래 속 상자를 [삽]으로` });
  if (!out.length) out.push({ icon: 'seaweed', text: '약재를 넉넉히 따 두세요' });
  return out.slice(0, 3);
}

function renderTracker() {
  const lines = trackerLines();
  G.goalIdx = (G.goalIdx ?? 0) % lines.length;
  const l = lines[G.goalIdx];
  $('goalIcon').src = iconURL(l.icon);
  $('goalText').textContent = l.text + (lines.length > 1 ? ` (${G.goalIdx + 1}/${lines.length})` : '');
}

// ---------- 하루 끝 ----------

function endDay(reason) {
  if (G.ended) return;
  G.ended = true;
  releaseInput();
  const s = G.s;
  let body;
  const under = playerCenter().y > SEA + 0.5;
  if (reason === 'home') {
    const early = G.time < DAY_SECONDS - 20;
    s.flags.earlyBonus = early;
    sfx.pick();
    body = early ? '해가 지기 전에 배에 올랐다. 일찍 문을 연 덕에 오늘 밤 환자가 2명 더 찾아온다.' : '해 질 녘에 배에 올랐다.';
  } else if (reason === 'dark' && !under) {
    body = '해가 저물어 배로 헤엄쳐 돌아왔다.';
  } else {
    const lost = collapseLoss(s);
    const why = reason === 'faint' ? '숨이 다해 정신을 잃었다.' : '해가 져서 깜깜한 물속에서 길을 잃었다.';
    body = `${why} 해녀들이 건져 배에 올려 주었다. 망사리에서 가장 많던 재료 한 가지만 남았다.${lost ? ` (${lost}개 잃음)` : ''}`;
  }
  const got = Object.entries(G.dayLog).map(([id, n]) => `${MATERIALS[id].name} ${n}`).join(', ');
  openPanel({
    title: '하루를 마치며',
    body: body + (got ? `\n\n오늘 딴 것: ${got}` : ''),
    portrait: 'hwata',
    choices: [{ label: '한의원 문을 연다', kind: 'primary', onClick: () => { closePanel(); fadeTo(`${s.day}일째 밤`, openNight); } }],
  });
}

// ---------- 입력 ----------

const MODES = ['hand', 'harpoon', 'net', 'shovel'];
const TOOL_SPRITE = { hand: 'hand', harpoon: 'harpoon', net: 'netIcon', shovel: 'shovel' };

function setMode(m) {
  G.mode = m;
  for (const b of document.querySelectorAll('[data-mode]')) b.classList.toggle('on', b.dataset.mode === m);
  G.mine = null;
}

function releaseInput() {
  joy.x = joy.y = 0;
  joy.id = null;
  $('joyKnob').style.transform = '';
  $('joy').classList.remove('on');
  $('actBtn').classList.remove('pressed');
  if (G) { G.hold = null; G.aim = null; G.gauge = null; G.mine = null; G.actHold = false; }
}

function screenToWorld(cx, cy) {
  return { x: G.cam.x + cx / view.ts, y: G.cam.y + cy / view.ts };
}

const playerCenter = () => ({ x: G.player.x + G.player.w / 2, y: G.player.y + G.player.h / 2 });
const distTo = (x, y) => { const c = playerCenter(); return Math.hypot(c.x - x, c.y - y); };
const inReach = (tx, ty) => distTo(tx + 0.5, ty + 0.5) <= REACH;

function propAt(wx, wy) {
  let best = null, bd = 1.1;
  for (const p of G.props) {
    const cy = p.type === 'npc' ? p.y - 0.4 : p.type === 'kelp' ? p.y - 1.5 : p.y + 0.5;
    const d = Math.hypot(p.x + 0.5 - wx, cy - wy) - (p.type === 'kelp' ? 1.2 : 0);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function pointerPos(e) {
  const r = cvs.getBoundingClientRect();
  return { sx: e.clientX - r.left, sy: e.clientY - r.top };
}

function onPointerDown(e) {
  unlockAudio();
  if (!G || G.paused || G.s.phase !== 'day' || G.ended) return;
  cvs.setPointerCapture(e.pointerId);
  const { sx, sy } = pointerPos(e);
  G.hold = { id: e.pointerId, sx, sy, mode: G.mode };
  const wp = screenToWorld(sx, sy);
  if (G.mode === 'harpoon' || G.mode === 'net') { G.aim = { x: wp.x, y: wp.y }; return; }
  if (G.mode === 'hand') handPress(wp);
}

function onPointerMove(e) {
  if (!G || G.s.phase !== 'day') return;
  const { sx, sy } = pointerPos(e);
  if (e.pointerType === 'mouse') G.hover = { sx, sy };
  if (!G.hold || e.pointerId !== G.hold.id) return;
  G.hold.sx = sx;
  G.hold.sy = sy;
}

function onPointerUp(e) {
  if (!G || !G.hold || e.pointerId !== G.hold.id) return;
  const mode = G.hold.mode;
  G.hold = null;
  G.mine = null;
  if ((mode === 'harpoon' || mode === 'net') && G.aim) fire(mode);
  G.aim = null;
  if (G.gauge) finishGauge();
}

function nearBoat() {
  const c = playerCenter();
  return Math.abs(c.x - (BOAT_X + 3)) < 4 && c.y < SEA + 1.5;
}

function handPress(wp) {
  const tx = Math.floor(wp.x), ty = Math.floor(wp.y);
  if (tx >= BOAT_X && tx <= BOAT_X + 6 && ty <= SEA && ty >= SEA - 4) return nearBoat() ? askHome() : toast('배 가까이 수면으로 올라오세요');
  const p = propAt(wp.x, wp.y);
  if (p) return tapProp(p);
  if (canDig(G.world, tx, ty)) return toast('모래는 [삽]으로 팝니다');
}

function tapProp(p) {
  if (p.type === 'npc') {
    if (distTo(p.x + 0.5, p.y) > REACH + 1.5) return toast('조금 더 가까이 헤엄쳐 가세요');
    return openQuest(p.quest);
  }
  if (p.type === 'bottle') return toast('빈 술병이 둥둥 떠 있다');
  const cy = p.type === 'kelp' ? p.y - 1 : p.y;
  if (distTo(p.x + 0.5, cy + 0.5) > REACH + (p.type === 'kelp' ? 1 : 0)) return toast('손이 닿지 않습니다. 더 가까이 가세요');
  if (p.type === 'clover') {
    if (gain('clover', false, p.x + 0.5, p.y + 0.5)) { removeProp(p); toast('불가사리! 다음에 따는 재료 5개가 모두 상급이 됩니다', 'good'); }
    return;
  }
  const [a, b] = herbZone(G.s);
  const zone = p.type === 'oyster' ? [a + 0.06, b - 0.02] : [a, b];
  G.gauge = { prop: p, item: p.type, x: p.x, y: cy, t: 0, dur: p.type === 'oyster' ? 1.2 : 1.0, zone };
}

function finishGauge() {
  const g = G.gauge;
  G.gauge = null;
  const v = g.t / g.dur;
  const hq = v >= g.zone[0] && v <= g.zone[1];
  if (!canCarry(G.s, g.item)) return toast('망사리가 가득 찼습니다', 'bad');
  burst(g.x + 0.5, g.y + 0.5, g.item === 'oyster' ? '#c9c9c0' : '#7a8a3a', 7, { speed: 2 });
  bubble(g.x + 0.5, g.y + 0.3, 3);
  if (v > g.zone[1]) toast(g.item === 'oyster' ? '너무 세게 떼어 굴이 깨졌다' : '너무 세게 뜯어 상했다');
  G.player.swing = 0.25;
  gain(g.item, hq, g.x + 0.5, g.y + 0.5);
  removeProp(g.prop);
}

function gain(id, hq, wx, wy) {
  if (!canCarry(G.s, id)) { toast('망사리가 가득 찼습니다', 'bad'); vib(30); return false; }
  const before = G.s.inv[id]?.hq ?? 0;
  const first = addItem(G.s, id, hq);
  const isHq = G.s.inv[id].hq > before && MATERIALS[id].weight > 0;
  G.dayLog[id] = (G.dayLog[id] ?? 0) + 1;
  const c = playerCenter();
  flyIcon(id, wx ?? c.x, wy ?? c.y);
  pushFeed(id, isHq, first);
  if (isHq) { sfx.pickHq(); vib(25); burst(wx ?? c.x, wy ?? c.y, '#ffd76a', 10, { glow: true, speed: 2 }); } else { sfx.pick(); vib(12); }
  renderTracker();
  return true;
}

function pushFeed(id, hq, first) {
  const feed = $('feed');
  const last = feed.lastElementChild;
  if (last && last.dataset.id === id && last.dataset.hq === String(hq) && !last.classList.contains('out')) {
    const n = Number(last.dataset.n) + 1;
    last.dataset.n = n;
    last.querySelector('b').textContent = `${MATERIALS[id].name}${hq ? ' ★' : ''} ×${n}`;
    clearTimeout(last.timer);
  } else {
    const el = document.createElement('div');
    el.dataset.id = id;
    el.dataset.hq = String(hq);
    el.dataset.n = 1;
    el.innerHTML = `<img src="${iconURL(id)}" alt=""><b class="${hq ? 'hq' : ''}">${MATERIALS[id].name}${hq ? ' ★' : ''}</b>${first ? '<span class="hq">새 발견!</span>' : ''}`;
    feed.append(el);
    while (feed.children.length > 4) feed.firstChild.remove();
  }
  const el = feed.lastElementChild;
  el.timer = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 2600);
}

function removeProp(p) {
  G.props = G.props.filter((q) => q !== p);
}

function breakTile(tx, ty) {
  const t = tile(G.world, tx, ty);
  setTile(G.world, tx, ty, T.WATER);
  G.player.swing = 0.25;
  burst(tx + 0.5, ty + 0.5, '#d9c58f', 10, { size: 0.12, speed: 2.5 });
  bubble(tx + 0.5, ty + 0.5, 3);
  if (t === T.CHEST) return openChest(tx, ty);
  if (t === T.CLAM) {
    sfx.pickHq();
    burst(tx + 0.5, ty + 0.5, '#f4f0f8', 12, { glow: true, speed: 2 });
    toast('진주조개 속에서 진주가 나왔다!', 'good');
    gain('pearl', Math.random() < 0.3, tx + 0.5, ty + 0.5);
    return;
  }
  sfx.breakDirt();
  G.props = G.props.filter((p) => !(p.x === tx && p.y === ty - 1 && p.type !== 'npc'));
}

function openChest(tx, ty) {
  const s = G.s;
  const spot = chestSpots(G.world).find((c) => c.x === tx && c.y === ty);
  sfx.breakPot();
  burst(tx + 0.5, ty + 0.5, '#a86b3e', 14, { size: 0.18, speed: 4 });
  if (!spot || s.pots.includes(spot.i)) return toast('빈 상자였다');
  s.pots.push(spot.i);
  const r = openPot(s, spot.loot);
  const loot = spot.loot;
  flyIcon(loot.page ? 'page' : loot.money ? 'coin' : loot.arrows ? 'netIcon' : loot.item, tx + 0.5, ty + 0.5);
  if (r.page) {
    sfx.page();
    burst(tx + 0.5, ty + 0.5, '#ffe9a8', 24, { glow: true, grav: -1, speed: 3, life: 1.2 });
    openPanel({
      title: PAGES[r.page].name,
      body: `가라앉은 상자 속에서 기름종이에 싸인 두루마리가 나왔다. 화타가 젊은 시절 적어 둔 의서 「청낭서」의 한 장이다. 다행히 젖지 않았다.\n\n${PAGES[r.page].perk}.\n\n(${s.pages.length}/3장)`,
      icon: 'page',
      choices: [{ label: '소중히 챙긴다', kind: 'primary', onClick: closePanel }],
    });
  } else {
    sfx.coin();
    toast(`상자 속에서 ${r.text}!`, 'good');
  }
  renderTracker();
}

function fire(mode) {
  const p = G.player, s = G.s;
  if (p.cool > 0) return;
  if (mode === 'net' && s.arrows <= 0) return toast('그물이 없습니다. 밤에 사세요', 'bad');
  const c = playerCenter();
  const dx = G.aim.x - c.x, dy = G.aim.y - c.y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = mode === 'net' ? 12 : 24;
  if (mode === 'net') s.arrows -= 1;
  p.cool = mode === 'net' ? 0.6 : 0.45;
  p.face = dx >= 0 ? 1 : -1;
  p.swing = 0.2;
  sfx.shoot();
  bubble(c.x, c.y, 2);
  G.shots.push({ x: c.x, y: c.y, vx: (dx / len) * speed, vy: (dy / len) * speed, mode, life: mode === 'net' ? 0.45 : 0.42, back: false });
}

function askHome() {
  openPanel({
    title: '배',
    body: '오늘 물질을 마치고 배에 오를까요? 해가 지기 전에 돌아가면 오늘 밤 환자가 더 찾아옵니다.',
    portrait: 'hwata',
    choices: [
      { label: '배에 오른다', kind: 'primary', onClick: () => { closePanel(); endDay('home'); } },
      { label: '조금 더 둘러본다', onClick: closePanel },
    ],
  });
}

function openQuest(id, text) {
  const q = QUESTS.find((x) => x.id === id);
  const choices = questChoices(G.s, id).map((c) => ({
    label: c.label,
    kind: c.action === 'give' ? 'primary' : '',
    onClick: () => {
      const r = questAct(G.s, id, c.action);
      if (r.done) {
        G.props = G.props.filter((p) => p.quest !== id && !(id === 'zhangfei' && p.type === 'bottle'));
        sfx.page();
        renderTracker();
        openPanel({ title: q.name, body: r.text, portrait: q.npc, choices: [{ label: '다시 물속으로', kind: 'primary', onClick: closePanel }] });
        toast('퀘스트 완료', 'good');
      } else {
        if (c.action === 'clue') sfx.pickHq(); else sfx.wrong();
        openQuest(id, r.text);
      }
    },
  }));
  choices.push({ label: '그만 둔다', onClick: closePanel });
  openPanel({ title: q.name, body: text ?? q.intro, portrait: q.npc, choices });
}

// ---------- 몸 움직임 ----------

function hitsSolid(b) {
  const x0 = Math.floor(b.x), x1 = Math.floor(b.x + b.w - 1e-6);
  const y0 = Math.floor(b.y), y1 = Math.floor(b.y + b.h - 1e-6);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (isSolid(G.world, x, y)) return true;
  return false;
}

function moveBody(b, dt) {
  const dx = b.vx * dt;
  b.hitWall = false;
  if (dx) {
    b.x += dx;
    if (hitsSolid(b)) {
      b.x = dx > 0 ? Math.floor(b.x + b.w) - b.w - 0.001 : Math.floor(b.x) + 1.001;
      b.hitWall = true;
      b.vx = 0;
    }
  }
  const dy = b.vy * dt;
  b.onGround = false;
  if (dy) {
    b.y += dy;
    if (hitsSolid(b)) {
      if (dy > 0) { b.y = Math.floor(b.y + b.h) - b.h - 0.001; b.onGround = true; } else b.y = Math.floor(b.y) + 1.001;
      b.hitWall = true;
      b.vy = 0;
    }
  }
  b.x = clamp(b.x, 0, W - b.w);
  b.y = clamp(b.y, 0, H - b.h);
}

function inputDir() {
  let x = joy.x, y = joy.y;
  if (keys.has('ArrowLeft') || keys.has('a')) x -= 1;
  if (keys.has('ArrowRight') || keys.has('d')) x += 1;
  if (keys.has('ArrowUp') || keys.has('w') || keys.has(' ')) y -= 1;
  if (keys.has('ArrowDown') || keys.has('s')) y += 1;
  const m = Math.hypot(x, y);
  return m > 1 ? { x: x / m, y: y / m } : { x, y };
}

function updatePlayer(dt) {
  const p = G.player, s = G.s;
  const busy = G.gauge || G.mine;
  const d = busy ? { x: 0, y: 0 } : inputDir();
  const c = playerCenter();
  const speed = swimSpeed(s);
  if (c.y < SEA - 0.1) {
    // 물 위: 떨어진다
    p.vx = lerp(p.vx, d.x * speed * 0.6, clamp(dt * 4, 0, 1));
    p.vy = Math.min(p.vy + 22 * dt, 12);
  } else {
    p.vx = lerp(p.vx, d.x * speed, clamp(dt * 3.5, 0, 1));
    p.vy = lerp(p.vy, d.y * speed, clamp(dt * 3.5, 0, 1));
    if (c.y < SEA + 0.4 && p.vy < 0) p.vy = Math.max(p.vy, (SEA - 0.35 - c.y) * 6); // 수면에서 둥실
    if (!d.x && !d.y) p.vy += Math.sin(G.clock * 2) * 0.04;
  }
  moveBody(p, dt);
  const moving = Math.hypot(p.vx, p.vy) > 0.4;
  if (Math.abs(p.vx) > 0.2) p.face = p.vx > 0 ? 1 : -1;
  const targetAng = moving ? Math.atan2(p.vy, Math.abs(p.vx) + 0.001) * 0.7 : 0;
  p.ang = lerp(p.ang, clamp(targetAng, -1.1, 1.1), clamp(dt * 6, 0, 1));
  p.kick += dt * (moving ? 9 : 3);
  p.swing = Math.max(0, p.swing - dt);
  p.cool = Math.max(0, p.cool - dt);
  // 숨
  const deep = c.y - SEA;
  if (deep < 0.6) s.stamina = Math.min(maxStamina(s), s.stamina + 45 * dt);
  else spendStamina(s, BREATH_PER_SEC * dt * (deep > 60 ? 1.25 : 1));
  if (deep > 0.6 && Math.random() < dt * (moving ? 3 : 1.2)) bubble(c.x + p.face * 0.4, c.y - 0.3);
  const low = s.stamina < maxStamina(s) * 0.25;
  if (low && !G.lowWarned && deep > 0.6) { G.lowWarned = true; sfx.hurt(); toast('숨이 모자랍니다! 수면으로 올라가세요', 'bad'); }
  if (!low) G.lowWarned = false;
}

function clearLine(x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.3);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (isSolid(G.world, Math.floor(lerp(x0, x1, t)), Math.floor(lerp(y0, y1, t)))) return false;
  }
  return true;
}

// 지금 도구로 다룰 가장 알맞은 대상(행동 버튼이 겨누는 것)
function findTarget() {
  const pc = playerCenter();
  const p = G.player;
  if (G.mode === 'hand') {
    if (nearBoat()) return { kind: 'boat', x: BOAT_X + 3, y: SEA - 1 };
    let best = null, bd = 1e9;
    for (const q of G.props) {
      if (q.type === 'bottle') continue;
      const cy = q.type === 'npc' ? q.y - 0.4 : q.type === 'kelp' ? q.y - 1 : q.y + 0.5;
      const d = Math.hypot(q.x + 0.5 - pc.x, cy - pc.y);
      const lim = q.type === 'npc' ? REACH + 1.5 : REACH + (q.type === 'kelp' ? 1 : 0);
      if (d <= lim && d < bd) { bd = d; best = { kind: q.type === 'npc' ? 'npc' : 'prop', prop: q, x: q.x + 0.5, y: cy }; }
    }
    return best;
  }
  if (G.mode === 'harpoon' || G.mode === 'net') {
    const range = G.mode === 'net' ? 5.4 : 10;
    let best = null, bs = 1e9;
    for (const e of G.ents) {
      if (e.dead || e.type === 'drop' || e.type === 'jelly') continue;
      const f = FISH[e.type];
      if (G.mode === 'net' ? !f.small : f.netOnly) continue;
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
      const d = Math.hypot(ex - pc.x, ey - pc.y);
      if (d > range || !clearLine(pc.x, pc.y, ex, ey)) continue;
      const score = d + ((ex - pc.x) * p.face < 0 ? 2.5 : 0) - (e.type === 'shark' ? 2 : 0);
      if (score < bs) { bs = score; best = { kind: 'fish', ent: e, x: ex, y: ey }; }
    }
    return best;
  }
  // 삽: 가까운 상자, 없으면 엄지가 가리키는 쪽(없으면 아래)의 모래
  const dir = inputDir();
  const pref = dir.x || dir.y ? dir : { x: 0, y: 1 };
  let best = null, bs = 1e9;
  for (let y = Math.floor(pc.y) - 3; y <= Math.floor(pc.y) + 3; y++) {
    for (let x = Math.floor(pc.x) - 3; x <= Math.floor(pc.x) + 3; x++) {
      if (!canDig(G.world, x, y) || !inReach(x, y)) continue;
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isWater(G.world, x + dx, y + dy));
      if (!open) continue;
      const vx = x + 0.5 - pc.x, vy = y + 0.5 - pc.y, d = Math.hypot(vx, vy) || 1;
      const score = d - 1.6 * ((vx * pref.x + vy * pref.y) / d) - (tile(G.world, x, y) === T.CHEST ? 3 : 0);
      if (score < bs) { bs = score; best = { kind: 'tile', x, y }; }
    }
  }
  return best;
}

const ACT_LABEL = { hand: '따기', harpoon: '쏘기', net: '던지기', shovel: '파기' };

function actPress() {
  unlockAudio();
  if (!G || G.paused || G.s.phase !== 'day' || G.ended) return;
  $('actBtn').classList.add('pressed');
  vib(10);
  const t = G.target;
  if (G.mode === 'hand') {
    if (!t) { toast('가까이에 딸 것이 없습니다'); return; }
    if (t.kind === 'boat') return askHome();
    if (t.kind === 'npc') return openQuest(t.prop.quest);
    return tapProp(t.prop);
  }
  if (G.mode === 'harpoon' || G.mode === 'net') {
    const pc = playerCenter();
    G.aim = t ? { x: t.x, y: t.y } : { x: pc.x + G.player.face * 6, y: pc.y };
    fire(G.mode);
    G.aim = null;
    return;
  }
  G.actHold = true;
}

function actRelease() {
  $('actBtn').classList.remove('pressed');
  if (!G) return;
  G.actHold = false;
  G.mine = null;
  if (G.gauge) finishGauge();
}

function cursorTile() {
  const src = G.hold ?? G.hover;
  if (!src) return null;
  const wp = screenToWorld(src.sx, src.sy);
  return { x: Math.floor(wp.x), y: Math.floor(wp.y), wx: wp.x, wy: wp.y };
}

function updateHold(dt) {
  const h = G.hold;
  if (h && G.aim) { const wp = screenToWorld(h.sx, h.sy); G.aim.x = wp.x; G.aim.y = wp.y; }
  if (G.mode !== 'shovel' || (!h && !G.actHold)) return;
  const c = G.actHold ? (G.target?.kind === 'tile' ? G.target : null) : cursorTile();
  if (!c || !canDig(G.world, c.x, c.y) || !inReach(c.x, c.y)) { G.mine = null; return; }
  if (!G.mine || G.mine.x !== c.x || G.mine.y !== c.y) G.mine = { x: c.x, y: c.y, t: 0, need: digHardness(G.s, tile(G.world, c.x, c.y)), tick: 0 };
  const m = G.mine;
  m.t += dt;
  m.tick -= dt;
  G.player.swing = 0.2;
  G.player.face = c.x + 0.5 > playerCenter().x ? 1 : -1;
  if (m.tick <= 0) { sfx.chip(); m.tick = 0.14; burst(c.x + 0.5, c.y + 0.5, '#d9c58f', 2, { speed: 1.5, size: 0.1 }); }
  if (m.t >= m.need) { breakTile(c.x, c.y); G.mine = null; }
}

function updateShots(dt) {
  const s = G.s;
  for (const a of G.shots) {
    const c = playerCenter();
    if (a.back) {
      const dx = c.x - a.x, dy = c.y - a.y, len = Math.hypot(dx, dy);
      if (len < 0.6) { a.dead = true; continue; }
      a.x += (dx / len) * 30 * dt;
      a.y += (dy / len) * 30 * dt;
      continue;
    }
    a.life -= dt;
    for (let i = 0; i < 3; i++) {
      a.x += (a.vx * dt) / 3;
      a.y += (a.vy * dt) / 3;
      if (isSolid(G.world, Math.floor(a.x), Math.floor(a.y))) { a.life = 0; sfx.chip(); burst(a.x, a.y, '#d9c58f', 4, { speed: 1.5 }); break; }
      const hit = shotHits(a);
      if (hit) { a.life = 0; break; }
    }
    if (a.life <= 0) { if (a.mode === 'harpoon') a.back = true; else a.dead = true; }
  }
  G.shots = G.shots.filter((a) => !a.dead);
}

function shotHits(a) {
  const s = G.s;
  for (const e of G.ents) {
    if (e.dead || e.type === 'jelly') continue;
    const pad = a.mode === 'net' ? 0.5 : 0.1;
    if (a.x < e.x - pad || a.x > e.x + e.w + pad || a.y < e.y - pad || a.y > e.y + e.h + pad) continue;
    const f = FISH[e.type];
    if (a.mode === 'net') {
      if (!f.small) { floatText('그물로는 무리다!', e.x, e.y - 0.4, '#ffb0a0'); return true; }
      // 그물은 근처 작은 물고기를 한꺼번에 잡는다
      const caught = G.ents.filter((o) => !o.dead && FISH[o.type]?.small && Math.hypot(o.x - e.x, o.y - e.y) < 1.6);
      for (const o of caught) { o.dead = true; gain(FISH[o.type].item, true, o.x, o.y); }
      sfx.hit();
      burst(e.x + e.w / 2, e.y + e.h / 2, '#e9e1cc', 10, { speed: 2 });
      return true;
    }
    if (f.netOnly) { floatText('해마는 그물로만!', e.x, e.y - 0.4, '#ffb0a0'); return true; }
    e.hp -= harpoonDamage(s);
    e.hitT = 0.25;
    sfx.hit();
    burst(e.x + e.w / 2, e.y + e.h / 2, '#e9e1cc', 6, { speed: 2 });
    if (e.type === 'moray') { e.lunge = 0; e.cool = 4; if (e.hp <= 0) { e.hp = 2; floatText('곰치가 숨었다', e.x, e.y - 0.4); } return true; }
    if (e.type === 'shark') {
      e.cool = 2.5;
      if (e.hp <= 0) {
        e.dead = true;
        floatText('상어가 달아났다!', e.x + 1, e.y - 0.5, '#ffd76a');
        G.ents.push({ type: 'drop', item: 'sharkTooth', x: e.x + 1, y: e.y, w: 0.5, h: 0.5, vx: 0, vy: 0 });
        G.shake = 0.3;
      } else floatText(`${e.hp}`, e.x + 1.5, e.y - 0.4, '#ffb0a0');
      return true;
    }
    if (e.hp <= 0) { e.dead = true; gain(f.item, false, e.x, e.y); } else e.flee = 2;
    return true;
  }
  return false;
}

function hurt(n, why, from) {
  if (G.hurtT > 0) return;
  G.hurtT = 1.2;
  spendStamina(G.s, n);
  sfx.hurt();
  G.shake = 0.3;
  const c = playerCenter();
  floatText(`숨 -${n}`, c.x, c.y - 1.1, '#ff9c8a');
  toast(why, 'bad');
  if (from) {
    const dx = c.x - from.x, dy = c.y - from.y, len = Math.hypot(dx, dy) || 1;
    G.player.vx = (dx / len) * 8;
    G.player.vy = (dy / len) * 8;
  }
}

function swimToward(e, tx, ty, sp, dt) {
  const dx = tx - e.x, dy = ty - e.y, len = Math.hypot(dx, dy) || 1;
  e.vx = lerp(e.vx, (dx / len) * sp, clamp(dt * 2.5, 0, 1));
  e.vy = lerp(e.vy, (dy / len) * sp, clamp(dt * 2.5, 0, 1));
}

function updateEnts(dt) {
  const pc = playerCenter();
  const p = G.player;
  for (const e of G.ents) {
    if (e.dead) continue;
    e.t -= dt;
    e.hitT = Math.max(0, (e.hitT ?? 0) - dt);
    const ec = { x: e.x + e.w / 2, y: e.y + e.h / 2 };
    const d = Math.hypot(ec.x - pc.x, ec.y - pc.y);
    const f = FISH[e.type];
    if (e.type === 'drop') {
      e.vy = Math.min(e.vy + 3 * dt, 1.5);
      moveBody(e, dt);
      if (d < 1) { if (gain(e.item, false, e.x, e.y)) e.dead = true; }
      continue;
    }
    if (e.type === 'jelly') {
      e.vx = Math.sin(G.clock * 0.3 + e.home.x) * 0.3;
      e.vy = Math.sin(G.clock * 1.2 + e.home.y) * 0.6;
      if (d < 0.8) hurt(8, '해파리에 쏘였다!', ec);
    } else if (e.type === 'moray') {
      e.cool = Math.max(0, e.cool - dt);
      if (d < 2.4 && e.cool <= 0) e.lunge = Math.min(1, e.lunge + dt * 5); else e.lunge = Math.max(0, e.lunge - dt * 2);
      e.face = pc.x > ec.x ? 1 : -1;
      if (e.lunge > 0.8 && d < 1.6) { hurt(12, '곰치에게 물렸다!', ec); e.cool = 3; }
      continue;
    } else if (e.type === 'shark') {
      e.cool = Math.max(0, e.cool - dt);
      const chase = d < 8 && pc.y > 50 && e.cool <= 0;
      if (chase) swimToward(e, pc.x - e.w / 2, pc.y - e.h / 2, 4.2, dt);
      else if (e.cool > 0) swimToward(e, ec.x + (ec.x - pc.x) * 3, ec.y, 3, dt);
      else {
        if (e.t < 0) { e.t = 3 + Math.random() * 3; e.tx = 98 + Math.random() * 36; e.ty = 66 + Math.random() * 34; }
        swimToward(e, e.tx ?? e.home.x, e.ty ?? e.home.y, f.speed, dt);
      }
      if (d < 1.4 && e.cool <= 0) { hurt(25, '상어에게 물렸다!', ec); e.cool = 3; }
    } else {
      // 보통 물고기: 떠돌다 화타가 다가오면 달아난다
      const scared = d < (e.type === 'seahorseFish' ? 0 : e.type === 'rockfishFish' ? 3 : 4.5);
      if (scared) e.flee = 1.5;
      if (e.flee > 0) {
        e.flee -= dt;
        const sp = e.type === 'cuttlefishFish' ? 7 : f.speed * 1.8;
        swimToward(e, ec.x + (ec.x - pc.x) * 3, ec.y + (ec.y - pc.y) * 2, sp, dt);
        if (e.type === 'cuttlefishFish' && !e.inked) {
          e.inked = 1.5;
          for (let i = 0; i < 14; i++) G.parts.push({ x: ec.x, y: ec.y, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life: 1.6, max: 1.6, color: '#1a1420', size: 0.5 + Math.random() * 0.4, grav: 0, drag: 2 });
        }
      } else {
        if (e.inked) { e.inked -= dt; if (e.inked <= 0) e.inked = 0; }
        if (e.t < 0) {
          e.t = 2 + Math.random() * 3;
          const school = e.school !== undefined ? G.ents.find((o) => o.school === e.school && !o.dead) : null;
          const base = school && school !== e ? { x: school.tx ?? school.x, y: school.ty ?? school.y } : e.home;
          e.tx = base.x + (Math.random() - 0.5) * 8;
          e.ty = base.y + (Math.random() - 0.5) * 4;
        }
        swimToward(e, e.tx ?? e.home.x, e.ty ?? e.home.y, f.speed * 0.5, dt);
      }
    }
    moveBody(e, dt);
    if (ec.y + e.vy * dt < SEA + 1) e.vy = Math.abs(e.vy);
    if (e.hitWall) { e.t = 0; }
    if (Math.abs(e.vx) > 0.1) e.face = e.vx > 0 ? 1 : -1;
  }
  G.ents = G.ents.filter((e) => !e.dead);
  G.hurtT = Math.max(0, G.hurtT - dt);
}

function updateParts(dt) {
  for (const q of G.parts) {
    q.life -= dt;
    q.vx -= q.vx * q.drag * dt;
    q.vy -= q.vy * q.drag * dt;
    q.vy += q.grav * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
  }
  G.parts = G.parts.filter((q) => q.life > 0);
  if (G.parts.length > 300) G.parts.splice(0, G.parts.length - 300);
  for (const b of G.bubbles) { b.t += dt; b.y -= dt * (1.2 + b.r * 6); b.x += Math.sin(b.t * 5 + b.wob) * dt * 0.3; }
  G.bubbles = G.bubbles.filter((b) => b.y > SEA && b.t < 6 && isWater(G.world, Math.floor(b.x), Math.floor(b.y)));
  if (G.bubbles.length > 160) G.bubbles.splice(0, G.bubbles.length - 160);
  for (const f of G.flyers) f.t += dt * 1.8;
  G.flyers = G.flyers.filter((f) => f.t < 1);
  for (const f of G.floats) { f.t -= dt; f.y -= dt * 0.8; }
  G.floats = G.floats.filter((f) => f.t > 0);
}

function updateDay(dt) {
  if (G.paused || G.ended) return;
  G.time += dt;
  updatePlayer(dt);
  if (!G.mine && !G.gauge) G.target = findTarget();
  updateHold(dt);
  if (G.gauge) G.gauge.t = Math.min(G.gauge.t + dt, G.gauge.dur * 1.25);
  updateShots(dt);
  updateEnts(dt);
  updateParts(dt);
  G.shake = Math.max(0, (G.shake ?? 0) - dt);
  const z = zoneAt(Math.floor(playerCenter().x));
  if (z !== G.zone) { G.zone = z; toast(ZONE_NAMES[z]); }
  if (G.s.stamina <= 0) return endDay('faint');
  if (G.time >= DAY_SECONDS) return endDay('dark');
  if (!G.warned && G.time >= DAY_SECONDS - 30) { G.warned = true; sfx.bell(); toast('해가 기운다. 배로 돌아가자!', 'bad'); }
}

// ---------- 그리기 ----------

const SKY = [
  [0, ['#f4c9a0', '#9fc3dc']],
  [0.15, ['#8ec0e6', '#d7ecf2']],
  [0.75, ['#8ec0e6', '#d7ecf2']],
  [0.88, ['#e98a5c', '#f6c98a']],
  [1, ['#3b3358', '#c46a55']],
];

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function skyAt(f) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [a, ca] = SKY[i], [b, cb] = SKY[i + 1];
    if (f <= b) {
      const t = (f - a) / (b - a);
      return [mixHex(ca[0], cb[0], t), mixHex(ca[1], cb[1], t)];
    }
  }
  return SKY.at(-1)[1];
}

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const CLOUDS = Array.from({ length: 7 }, (_, i) => ({ x: i * 26 + hash(i, 1) * 20, y: 1 + hash(i, 2) * 4, w: 4 + hash(i, 3) * 5 }));

function drawBackground(f) {
  const { cw, ch, ts } = view;
  const seaY = (SEA - G.cam.y) * ts;
  // 하늘
  if (seaY > 0) {
    const [top, bottom] = skyAt(f);
    const grad = ctx.createLinearGradient(0, seaY - ts * 12, 0, seaY);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, seaY);
    const sunX = cw * (0.1 + 0.8 * f), sunY = seaY - ts * (2 + Math.sin(Math.PI * f) * 6);
    ctx.fillStyle = f > 0.85 ? '#ffb070' : '#fff1c4';
    ctx.beginPath(); ctx.arc(sunX, sunY, ts * 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const c of CLOUDS) {
      const x = ((c.x + G.clock * 0.25 - G.cam.x * 0.4) % 190 + 190) % 190 - 15;
      const sx = x * ts * 0.6, sy = seaY - (10 - c.y) * ts;
      const r = c.w * ts * 0.16;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.arc(sx + r * 1.1, sy - r * 0.35, r * 1.15, 0, Math.PI * 2);
      ctx.arc(sx + r * 2.2, sy, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    // 먼 섬
    ctx.fillStyle = 'rgba(70,96,110,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, seaY);
    for (let sx = 0; sx <= cw + 8; sx += 8) {
      const wx = (sx / ts + G.cam.x * 0.2) * 0.3;
      ctx.lineTo(sx, seaY - Math.max(0, Math.sin(wx * 0.4) * 2.2 + Math.sin(wx * 0.17 + 2) * 1.6) * ts * 0.6);
    }
    ctx.lineTo(cw, seaY);
    ctx.fill();
  }
  // 물속: 깊을수록 짙은 쪽빛
  const top = Math.max(0, seaY);
  if (top < ch) {
    const grad = ctx.createLinearGradient(0, seaY, 0, seaY + 100 * ts);
    grad.addColorStop(0, '#3e93b8');
    grad.addColorStop(0.25, '#1f6688');
    grad.addColorStop(0.6, '#0f3552');
    grad.addColorStop(1, '#06162a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, cw, ch - top);
    // 수면에서 비치는 빛줄기
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const bx = ((i * 9 + hash(i, 9) * 6 - G.cam.x * 0.6) % 54 + 54) % 54 * ts * 0.5 + Math.sin(G.clock * 0.5 + i) * ts;
      const g = ctx.createLinearGradient(0, seaY, 0, seaY + ts * 26);
      g.addColorStop(0, 'rgba(180,230,255,0.13)');
      g.addColorStop(1, 'rgba(180,230,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx, seaY);
      ctx.lineTo(bx + ts * 1.6, seaY);
      ctx.lineTo(bx + ts * 6, seaY + ts * 26);
      ctx.lineTo(bx + ts * 3, seaY + ts * 26);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawTile(t, x, y, sx, sy, ts) {
  const px = ts / 8;
  if (t === T.SAND || t === T.CLAM) {
    ctx.fillStyle = '#c9b07a';
    ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 ? '#b39a66' : '#dcc690';
      ctx.fillRect(sx + Math.floor(hash(x * 3 + i, y) * 7) * px, sy + Math.floor(hash(y * 5 - i, x) * 7) * px, px * 2, px);
    }
    if (!isSolid(G.world, x, y - 1)) { ctx.fillStyle = '#e6d6a8'; ctx.fillRect(sx, sy, ts + 0.5, px); }
    return;
  }
  if (t === T.ROCK) {
    ctx.fillStyle = '#4c5a62';
    ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 ? '#3d4950' : '#5c6b73';
      ctx.fillRect(sx + Math.floor(hash(x * 7 + i, y * 3) * 6) * px, sy + Math.floor(hash(y + i, x * 2) * 6) * px, px * 3, px * 2);
    }
    ctx.fillStyle = '#323d43';
    if (!isSolid(G.world, x - 1, y)) ctx.fillRect(sx, sy, px, ts + 0.5);
    if (!isSolid(G.world, x + 1, y)) ctx.fillRect(sx + ts - px, sy, px, ts + 0.5);
    if (!isSolid(G.world, x, y + 1)) ctx.fillRect(sx, sy + ts - px, ts + 0.5, px);
    if (!isSolid(G.world, x, y - 1) && y > SEA) { ctx.fillStyle = '#5f7a4a'; ctx.fillRect(sx, sy, ts + 0.5, px * 1.5); }
    return;
  }
  if (t === T.CHEST) {
    ctx.fillStyle = '#c9b07a';
    ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
    drawSprite(ctx, 'chest', sx, sy - px * 2, px);
    ctx.fillStyle = '#c9b07a';
    ctx.fillRect(sx, sy + px * 3, ts + 0.5, px * 1.5);
  }
}

function drawDecor(x0, x1, ts) {
  const px = ts / 8;
  for (let x = x0; x <= x1; x++) {
    const y = floorY(G.world, x);
    if (y <= SEA || !isWater(G.world, x, y - 1)) continue;
    const sx = (x - G.cam.x) * ts, sy = (y - G.cam.y) * ts;
    // 산호와 바닷풀
    if (x >= 45 && x <= 136 && hash(x, 41) < 0.35) {
      const col = ['#e8748a', '#f2a65a', '#c86ad8', '#f0d36a'][Math.floor(hash(x, 42) * 4)];
      ctx.fillStyle = col;
      const h = 2 + Math.floor(hash(x, 43) * 4);
      for (let i = 0; i < h; i++) {
        const sw = Math.sin(G.clock * 1.5 + x + i) * px * 0.4;
        ctx.fillRect(sx + px * 3 + sw * i * 0.3, sy - (i + 1) * px * 1.2, px * 2, px * 1.2);
        if (i % 2) ctx.fillRect(sx + px * (i % 4 ? 1 : 5), sy - (i + 1) * px * 1.2, px * 2, px);
      }
    } else if (hash(x, 44) < 0.5) {
      ctx.strokeStyle = '#4f7a3a';
      ctx.lineWidth = px * 0.8;
      for (let i = 0; i < 2; i++) {
        const bx = sx + (0.2 + i * 0.5) * ts;
        const sw = Math.sin(G.clock * 1.6 + x * 0.7 + i) * px * 1.5;
        ctx.beginPath(); ctx.moveTo(bx, sy); ctx.quadraticCurveTo(bx + sw, sy - px * 3, bx + sw * 1.5, sy - px * 5); ctx.stroke();
      }
    }
  }
}

function drawShore(ts) {
  // 바닷가 모래사장 위의 작은 한의원
  const sx = (0 - G.cam.x) * ts, sy = (7 - G.cam.y) * ts;
  if (sx > view.cw) return;
  ctx.fillStyle = '#efe4cc';
  ctx.fillRect(sx + ts * 0.3, sy - ts * 2.6, ts * 3.6, ts * 2.6);
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(sx + ts * 0.3, sy - ts * 2.6, ts * 3.6, ts * 0.2);
  ctx.fillRect(sx + ts * 1.6, sy - ts * 1.8, ts * 1, ts * 1.8);
  ctx.fillStyle = '#3d4352';
  ctx.beginPath();
  ctx.moveTo(sx - ts * 0.3, sy - ts * 2.4);
  ctx.quadraticCurveTo(sx + ts * 2.1, sy - ts * 3, sx + ts * 4.6, sy - ts * 2.4);
  ctx.lineTo(sx + ts * 3.8, sy - ts * 3.7);
  ctx.lineTo(sx + ts * 0.4, sy - ts * 3.7);
  ctx.closePath();
  ctx.fill();
}

function drawBoat(ts) {
  const sx = (BOAT_X - G.cam.x) * ts, sy = (SEA - G.cam.y) * ts + Math.sin(G.clock * 1.5) * ts * 0.08;
  if (sx > view.cw + ts * 8 || sx < -ts * 8) return;
  ctx.fillStyle = '#6b4a2b';
  ctx.beginPath();
  ctx.moveTo(sx - ts * 0.3, sy - ts * 0.9);
  ctx.lineTo(sx + ts * 6.3, sy - ts * 0.9);
  ctx.lineTo(sx + ts * 5.4, sy + ts * 0.35);
  ctx.lineTo(sx + ts * 0.6, sy + ts * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8a5d36';
  ctx.fillRect(sx - ts * 0.3, sy - ts * 0.95, ts * 6.6, ts * 0.22);
  ctx.fillStyle = '#5a3d24';
  ctx.fillRect(sx + ts * 2.9, sy - ts * 4.8, ts * 0.22, ts * 3.9);
  ctx.fillStyle = '#efe4cc';
  ctx.beginPath();
  ctx.moveTo(sx + ts * 3.15, sy - ts * 4.6);
  ctx.lineTo(sx + ts * 5.2, sy - ts * 1.4);
  ctx.lineTo(sx + ts * 3.15, sy - ts * 1.3);
  ctx.closePath();
  ctx.fill();
  if (nearBoat() && !G.ended) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = `bold ${Math.round(ts * 0.5)}px "Gowun Dodum", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('▼ 배에 오르기', sx + ts * 3, sy - ts * 5.2);
  }
}

function drawSurface(ts) {
  const y = (SEA - G.cam.y) * ts;
  if (y < -ts || y > view.ch + ts) return;
  ctx.fillStyle = 'rgba(220,245,255,0.55)';
  for (let sx = 0; sx < view.cw; sx += 6) {
    const wy = Math.sin((sx / ts + G.cam.x) * 0.8 + G.clock * 2) * ts * 0.08;
    ctx.fillRect(sx, y + wy - 1, 6, 2);
  }
}

function render() {
  const { cw, ch, ts } = view;
  const p = G.player;
  const viewW = cw / ts, viewH = ch / ts;
  const target = {
    x: clamp(p.x + p.w / 2 - viewW / 2, 0, W - viewW),
    y: clamp(p.y + p.h / 2 - viewH * 0.45, 0, H - viewH),
  };
  if (!G.cam) G.cam = { ...target };
  G.cam.x = lerp(G.cam.x, target.x, 0.15);
  G.cam.y = lerp(G.cam.y, target.y, 0.15);
  const shake = G.shake > 0 ? (Math.random() - 0.5) * 0.2 : 0;
  G.cam.x += shake;
  const f = clamp(G.time / DAY_SECONDS, 0, 1);
  ctx.imageSmoothingEnabled = false;
  drawBackground(f);
  drawShore(ts);

  const x0 = Math.max(0, Math.floor(G.cam.x) - 1), x1 = Math.min(W - 1, Math.ceil(G.cam.x + viewW));
  const y0 = Math.max(0, Math.floor(G.cam.y) - 1), y1 = Math.min(H - 1, Math.ceil(G.cam.y + viewH));
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const t = tile(G.world, x, y);
      if (t === T.AIR || t === T.WATER) continue;
      drawTile(t, x, y, (x - G.cam.x) * ts, (y - G.cam.y) * ts, ts);
    }
  }
  drawDecor(x0, x1, ts);
  drawProps(ts);
  drawEnts(ts);
  drawPlayer(ts);
  drawShots(ts);
  drawParts(ts);
  drawShade(x0, y0, x1, y1, ts);
  drawBoat(ts);
  drawSurface(ts);
  drawOverlays(ts);
  if (f > 0.82) {
    ctx.fillStyle = `rgba(30,20,50,${(f - 0.82) * 2})`;
    ctx.fillRect(0, 0, cw, ch);
  }
  const low = G.s.stamina / maxStamina(G.s);
  if (low < 0.25 && playerCenter().y > SEA + 0.6) {
    const a = (0.25 - low) * 2.4 * (0.7 + Math.sin(G.clock * 6) * 0.3);
    const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
    g.addColorStop(0, 'rgba(120,0,0,0)');
    g.addColorStop(1, `rgba(150,20,20,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
  }
  G.cam.x -= shake;
}

function drawShade(x0, y0, x1, y1, ts) {
  const pc = playerCenter();
  const L = computeLight(G.world, x0, y0, x1, y1, [{ x: pc.x - 0.5, y: pc.y - 0.5, r: G.s.upgrades.lantern ? 1 : 0.7 }]);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  if (shadeCvs.width !== w || shadeCvs.height !== h) { shadeCvs.width = w; shadeCvs.height = h; }
  const img = shadeCtx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = (1 - L.at(x0 + x, y0 + y)) * 0.92;
      const i = (y * w + x) * 4;
      img.data[i] = 2; img.data[i + 1] = 8; img.data[i + 2] = 18;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  shadeCtx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(shadeCvs, (x0 - G.cam.x) * ts, (y0 - G.cam.y) * ts, w * ts, h * ts);
  ctx.imageSmoothingEnabled = false;
}

function drawProps(ts) {
  const px = ts / 8;
  for (const p of G.props) {
    const sx = (p.x - G.cam.x) * ts, sy = (p.y - G.cam.y) * ts;
    if (sx < -ts * 3 || sx > view.cw + ts * 3) continue;
    if (p.type === 'npc') {
      const big = p.sprite === 'zhangfei' ? 1.15 : p.sprite === 'boy' ? 0.85 : 1;
      const q = px * big * 1.1;
      const bob = p.floating ? Math.sin(G.clock * 1.5) * px : 0;
      if (p.floating) {
        drawSprite(ctx, 'barrel', sx - px, sy + ts - 5 * px + bob, px * 1.2);
        drawSprite(ctx, p.sprite, sx + ts / 2 - 5 * q, sy + ts - 15 * q + bob, q, true);
      } else {
        drawSprite(ctx, p.sprite, sx + ts / 2 - 5 * q, sy + ts - 16 * q, q, true);
        if (p.sprite === 'haenyeo') {
          // 수면의 테왁과 줄
          const fx = sx + ts * 0.5, fy = (SEA - G.cam.y) * ts;
          ctx.strokeStyle = 'rgba(233,225,204,0.7)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(sx + ts / 2, sy + ts - 16 * q); ctx.stroke();
          drawSprite(ctx, 'tewak', fx - 3 * px, fy - 3 * px + Math.sin(G.clock * 1.5) * px, px);
        }
      }
      const tb = Math.sin(G.clock * 4) * px;
      ctx.fillStyle = '#ffd76a';
      ctx.strokeStyle = '#2a2118';
      ctx.lineWidth = Math.max(2, px * 0.7);
      ctx.font = `bold ${Math.round(ts * 0.9)}px "Gowun Dodum", sans-serif`;
      ctx.textAlign = 'center';
      const ty = sy + ts - 17 * q + tb + bob;
      ctx.strokeText('!', sx + ts / 2, ty);
      ctx.fillText('!', sx + ts / 2, ty);
      continue;
    }
    if (p.type === 'bottle') { drawSprite(ctx, 'bottle', sx + 2 * px, sy + 3 * px + Math.sin(G.clock * 1.7) * px, px); continue; }
    if (p.type === 'kelp') {
      // 키 큰 다시마: 마디마다 흔들린다
      const segs = 5 + Math.floor(hash(p.x, 3) * 3);
      let x = sx + ts / 2, y = sy + ts;
      for (let i = 0; i < segs; i++) {
        const sw = Math.sin(G.clock * 1.4 + p.x + i * 0.6) * px * (0.5 + i * 0.35);
        ctx.fillStyle = i % 2 ? '#3f6a2c' : '#4f7d36';
        ctx.fillRect(x + sw - px * 1.5, y - px * 4, px * 3, px * 4);
        y -= px * 4;
      }
      continue;
    }
    if (p.type === 'oyster') { drawSprite(ctx, 'oyster', p.side > 0 ? sx + px * 2 : sx, sy + px * 2, px); continue; }
    if (p.type === 'seaCucumber') { drawSprite(ctx, 'seaCucumber', sx - px * 0.5, sy + ts - 4 * px, px); continue; }
    if (p.type === 'seaweed') {
      const sw = Math.sin(G.clock * 1.6 + p.x) * px * 0.8;
      drawSprite(ctx, 'seaweed', sx + px + sw, sy + ts - 10 * px * 1.2, px * 1.2);
      continue;
    }
    drawSprite(ctx, p.type, sx, sy + ts - 7 * px, px);
  }
}

const FISH_SPRITE = { pollockFish: 'pollockFish', rockfishFish: 'rockfishFish', cuttlefishFish: 'cuttlefishFish', seahorseFish: 'seahorseFish', jelly: 'jelly', moray: 'moray', shark: 'shark' };

function drawEnts(ts) {
  const px = ts / 8;
  for (const e of G.ents) {
    let sx = (e.x - G.cam.x) * ts, sy = (e.y - G.cam.y) * ts;
    if (sx < -ts * 4 || sx > view.cw + ts * 4) continue;
    if (e.type === 'drop') { drawSprite(ctx, e.item, sx, sy + Math.sin(G.clock * 3) * px, px * 1.3); continue; }
    const key = FISH_SPRITE[e.type];
    const { w, h } = spriteSize(key);
    let scale = (e.w * ts) / w;
    if (e.type === 'moray') {
      // 바위 틈에서 머리를 내밀었다 들어간다
      const out = e.lunge;
      sx += (e.face > 0 ? -1 : 1) * (1 - out) * e.w * ts * 0.6;
    }
    const wig = e.type === 'jelly' ? 0 : Math.sin(G.clock * 10 + e.x) * px * 0.3;
    if (e.hitT > 0) ctx.globalAlpha = 0.5 + Math.sin(G.clock * 40) * 0.3;
    drawSprite(ctx, key, sx, sy + wig + (e.h * ts - h * scale) / 2, scale, e.face < 0 && e.type !== 'jelly' && e.type !== 'seahorseFish' ? false : e.type === 'jelly' || e.type === 'seahorseFish' ? false : true);
    ctx.globalAlpha = 1;
    if (e.type === 'shark' && e.hp < FISH.shark.hp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(sx, sy - px * 2, e.w * ts, px);
      ctx.fillStyle = '#e0714f';
      ctx.fillRect(sx, sy - px * 2, e.w * ts * (e.hp / FISH.shark.hp), px);
    }
  }
}

function drawPlayer(ts) {
  const p = G.player;
  const c = playerCenter();
  const sx = (c.x - G.cam.x) * ts, sy = (c.y - G.cam.y) * ts;
  const scale = ts / 7.5;
  const frame = Math.floor(p.kick) % 2 ? 'swim2' : 'swim';
  ctx.save();
  ctx.translate(sx, sy);
  if (p.face < 0) ctx.scale(-1, 1);
  ctx.rotate(p.ang);
  if (G.hurtT > 0 && Math.floor(G.clock * 20) % 2) ctx.globalAlpha = 0.5;
  drawSprite(ctx, frame, -8 * scale, -3.5 * scale, scale);
  const tool = TOOL_SPRITE[G.mode];
  if (tool && G.mode !== 'hand') {
    const ang = p.swing > 0 ? -Math.sin((p.swing / 0.25) * Math.PI) * 0.9 : 0;
    ctx.save();
    ctx.translate(5 * scale, 1 * scale);
    ctx.rotate(ang + (G.mode === 'shovel' ? 0.4 : -0.2));
    drawSprite(ctx, tool, 0, -4 * scale * 0.8, scale * 0.8);
    ctx.restore();
  }
  ctx.restore();
}

function drawShots(ts) {
  const pc = playerCenter();
  for (const a of G.shots) {
    const sx = (a.x - G.cam.x) * ts, sy = (a.y - G.cam.y) * ts;
    if (a.mode === 'harpoon') {
      ctx.strokeStyle = 'rgba(233,225,204,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo((pc.x - G.cam.x) * ts, (pc.y - G.cam.y) * ts); ctx.lineTo(sx, sy); ctx.stroke();
      const ang = Math.atan2(a.vy, a.vx);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.fillStyle = '#d7dde2';
      ctx.fillRect(-ts * 0.6, -1.5, ts * 0.6, 3);
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(8, 0); ctx.lineTo(0, 4); ctx.fill();
      ctx.restore();
    } else {
      ctx.strokeStyle = '#e9e1cc';
      ctx.lineWidth = 1.5;
      const r = ts * 0.5;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - r, sy); ctx.lineTo(sx + r, sy); ctx.moveTo(sx, sy - r); ctx.lineTo(sx, sy + r); ctx.stroke();
    }
  }
}

function drawParts(ts) {
  for (const q of G.parts) {
    const a = clamp(q.life / q.max, 0, 1);
    const sx = (q.x - G.cam.x) * ts, sy = (q.y - G.cam.y) * ts, s = q.size * ts;
    ctx.globalAlpha = a;
    ctx.fillStyle = q.color;
    ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(220,245,255,0.7)';
  ctx.lineWidth = 1;
  for (const b of G.bubbles) {
    ctx.beginPath(); ctx.arc((b.x - G.cam.x) * ts, (b.y - G.cam.y) * ts, b.r * ts, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawTarget(ts) {
  const t = G.target;
  if (!t || G.aim || t.kind === 'boat') return;
  const cx = (t.x - G.cam.x) * ts, cy = (t.y - G.cam.y) * ts;
  const r = (t.kind === 'fish' ? Math.max(t.ent.w, t.ent.h) * 0.6 + 0.3 : 0.75) * ts + Math.sin(G.clock * 6) * 2;
  const k = r * 0.45;
  ctx.strokeStyle = G.mode === 'harpoon' && t.kind === 'fish' ? '#ff9c8a' : '#ffd76a';
  ctx.lineWidth = 3;
  const x0 = t.kind === 'tile' ? (t.x - G.cam.x) * ts + ts / 2 : cx, y0 = t.kind === 'tile' ? (t.y - G.cam.y) * ts + ts / 2 : cy;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.beginPath();
    ctx.moveTo(x0 + sx * r, y0 + sy * (r - k));
    ctx.lineTo(x0 + sx * r, y0 + sy * r);
    ctx.lineTo(x0 + sx * (r - k), y0 + sy * r);
    ctx.stroke();
  }
}

function drawOverlays(ts) {
  const px = ts / 8;
  const pc = playerCenter();
  drawTarget(ts);
  const c = G.mode === 'shovel' ? cursorTile() : null;
  if (c) {
    ctx.strokeStyle = 'rgba(255,246,216,0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc((pc.x - G.cam.x) * ts, (pc.y - G.cam.y) * ts, REACH * ts, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    const ok = inReach(c.x, c.y) && canDig(G.world, c.x, c.y);
    ctx.strokeStyle = ok ? '#bff0a0' : '#ff8a78';
    ctx.lineWidth = Math.max(2, px * 0.6);
    ctx.strokeRect((c.x - G.cam.x) * ts + 1, (c.y - G.cam.y) * ts + 1, ts - 2, ts - 2);
  }
  if (G.mine) {
    const m = G.mine;
    const sx = (m.x - G.cam.x) * ts, sy = (m.y - G.cam.y) * ts;
    ctx.fillStyle = 'rgba(20,16,12,0.5)';
    ctx.fillRect(sx, sy - 6, ts, 4);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(sx, sy - 6, ts * (m.t / m.need), 4);
  }
  if (G.aim) {
    const dx = G.aim.x - pc.x, dy = G.aim.y - pc.y;
    const len = Math.hypot(dx, dy) || 1;
    const range = G.mode === 'net' ? 5.4 : 10;
    for (let i = 1; i <= 14; i++) {
      const t = (i / 14) * range;
      const x = pc.x + (dx / len) * t, y = pc.y + (dy / len) * t;
      if (isSolid(G.world, Math.floor(x), Math.floor(y))) break;
      ctx.fillStyle = `rgba(255,246,216,${0.9 - i * 0.05})`;
      ctx.fillRect((x - G.cam.x) * ts - 2, (y - G.cam.y) * ts - 2, 4, 4);
    }
  }
  if (G.gauge) {
    const g = G.gauge;
    const cx = (g.x + 0.5 - G.cam.x) * ts, cy = (g.y - 0.7 - G.cam.y) * ts;
    const r = ts * 0.9;
    const v = g.t / g.dur;
    ctx.lineWidth = ts * 0.22;
    ctx.strokeStyle = 'rgba(20,16,12,0.6)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#59b85a';
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2 + g.zone[0] * Math.PI * 2, -Math.PI / 2 + g.zone[1] * Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = v > g.zone[1] ? '#d9574a' : v >= g.zone[0] ? '#d6ffb8' : '#f3e7c6';
    ctx.lineWidth = ts * 0.12;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.min(v, 1) * Math.PI * 2); ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `bold ${Math.round(ts * 0.48)}px "Gowun Dodum", sans-serif`;
  for (const fl of G.floats) {
    ctx.globalAlpha = clamp(fl.t, 0, 1);
    ctx.fillStyle = '#1b1410';
    ctx.fillText(fl.text, (fl.x - G.cam.x) * ts + 1, (fl.y - G.cam.y) * ts + 1);
    ctx.fillStyle = fl.color;
    ctx.fillText(fl.text, (fl.x - G.cam.x) * ts, (fl.y - G.cam.y) * ts);
  }
  ctx.globalAlpha = 1;
  const r = cvs.getBoundingClientRect();
  for (const f of G.flyers) {
    const t = f.t, e = t * t * (3 - 2 * t);
    const x = lerp(f.x0, f.x1, e) - r.left, y = lerp(f.y0, f.y1, e) - r.top - Math.sin(t * Math.PI) * 40;
    const s = 3 + (1 - t);
    drawSprite(ctx, f.key, x - 4 * s, y - 4 * s, s);
  }
  for (const q of G.parts) {
    if (!q.glow) continue;
    ctx.fillStyle = `rgba(255,236,160,${clamp(q.life / q.max, 0, 1) * 0.4})`;
    ctx.beginPath(); ctx.arc((q.x - G.cam.x) * ts, (q.y - G.cam.y) * ts, ts * 0.2, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------- 화면 위 정보 ----------

function updateHud() {
  const s = G.s;
  const c = playerCenter();
  $('hudDay').textContent = `${s.day}일째`;
  $('hudZone').textContent = `${ZONE_NAMES[G.zone] ?? ''} · ${Math.max(0, Math.round(c.y - SEA))}m`;
  const left = Math.max(0, DAY_SECONDS - G.time);
  $('sunFill').style.width = `${(left / DAY_SECONDS) * 100}%`;
  $('sunFill').classList.toggle('late', left < 30);
  const br = clamp(s.stamina / maxStamina(s), 0, 1);
  $('breathRing').style.strokeDashoffset = String(169.6 * (1 - br));
  $('breath').classList.toggle('low', br < 0.25);
  $('hudStamina').textContent = Math.ceil(s.stamina);
  const wt = basketWeight(s);
  $('hudWeight').textContent = `${wt}/${carryLimit(s)}`;
  $('hudWeight').classList.toggle('over', wt > carryLimit(s));
  $('slotCount-net').textContent = s.arrows;
  $('hudMoney').textContent = s.money;
  $('homeBtn').hidden = !nearBoat();
  $('depthMark').style.top = `${clamp((c.y - SEA) / (H - SEA), 0, 1) * 100}%`;
  const t = G.target;
  let label = ACT_LABEL[G.mode];
  if (G.mode === 'hand' && t?.kind === 'npc') label = '말 걸기';
  if (G.mode === 'hand' && t?.kind === 'boat') label = '배 타기';
  const act = $('actBtn');
  if ($('actLabel').textContent !== label) $('actLabel').textContent = label;
  const icon = G.mode === 'hand' && t?.prop ? (t.kind === 'npc' ? 'hand' : t.prop.type) : TOOL_SPRITE[G.mode];
  if (act.dataset.icon !== icon) { act.dataset.icon = icon; $('actIcon').src = iconURL(icon); }
  act.classList.toggle('idle', !t && G.mode !== 'harpoon');
}

// ---------- 밤: 한의원 ----------

function openNight() {
  const s = G.s;
  s.phase = 'night';
  save();
  $('dayui').hidden = true;
  $('night').hidden = false;
  G.nightTab = 'meds';
  renderPrep();
}

const ico = (key, cls = '') => `<img class="ico ${cls}" src="${iconURL(key)}" alt="">`;

function recipeLine(id, mult = 1) {
  return Object.entries(RECIPES[id].inputs).map(([k, n]) => `${ico(k)}${MATERIALS[k].name} ${n * mult}`).join(' + ');
}

function unlockText(id) {
  const u = RECIPES[id].unlock;
  if (u === 'quest1') return '해녀 할망을 도우면 배움';
  return `${u.day}일째부터`;
}

function invList(s) {
  const rows = Object.entries(s.inv).filter(([, v]) => v.n > 0);
  if (!rows.length) return '<p class="muted">망사리가 비었습니다.</p>';
  return `<ul class="inv">${rows.map(([id, v]) => `<li>${ico(id)}<span>${MATERIALS[id].name}</span><b>${v.n}</b>${v.hq ? `<em>상급 ${v.hq}</em>` : ''}</li>`).join('')}</ul>`;
}

function market(s) {
  const rows = Object.keys(MATERIALS).filter((id) => MATERIALS[id].sell && count(s, id) > 0);
  if (!rows.length) return '<p class="muted">팔 만한 귀한 것이 없습니다. 우럭·진주·해마·상어 이빨을 팔 수 있습니다.</p>';
  return `<ul class="list">${rows.map((id) => `<li>${ico(id, 'lg')}<div><b>${MATERIALS[id].name} ${count(s, id)}개</b><small>하나에 ${MATERIALS[id].sell}냥 · 상급은 1.5배</small></div><button class="btn small gold" data-act="sell" data-id="${id}">팔기</button></li>`).join('')}</ul>`;
}

function notebook(s) {
  const dexIds = Object.keys(MATERIALS);
  const found = dexIds.filter((id) => s.dex?.[id]).length;
  const pages = [1, 2, 3].map((n) => (hasPage(s, n)
    ? `<li class="got">${ico('page', 'lg')}<div><b>${PAGES[n].name}</b><span>${PAGES[n].perk}</span></div></li>`
    : `<li>${ico('page', 'lg dim')}<div><b>청낭서 ${n}장</b><span>바닷속 어딘가의 상자</span></div></li>`)).join('');
  const dex = dexIds.map((id) => `<li class="${s.dex?.[id] ? 'got' : ''}">${ico(id, s.dex?.[id] ? '' : 'dim')}<span>${s.dex?.[id] ? MATERIALS[id].name : '?'}</span></li>`).join('');
  return `<div class="two"><div><h4>청낭서 ${(s.pages ?? []).length}/3</h4><ul class="list pages">${pages}</ul></div><div><h4>재료 도감 ${found}/${dexIds.length}</h4><ul class="dex">${dex}</ul></div></div>`;
}

const UPGRADE_ICON = { gourd: 'tewak', fins: 'swim', harpoon: 'harpoon', lantern: 'pearl', basket: 'netIcon' };

const TABS = [['meds', '약장', 'seaweed'], ['forge', '대장간', 'harpoon'], ['market', '장터', 'coin'], ['book', '수첩', 'page']];

function medCards(s) {
  return RECIPE_ORDER.map((id) => {
    const r = RECIPES[id];
    const m = s.meds[id];
    if (!m) {
      const unlocked = isUnlocked(s, id);
      return `<article class="card ${unlocked ? '' : 'locked'}">
        <header>${ico(r.main, 'lg')}<h3>${r.name}</h3><span class="tag">${unlocked ? '개발 전' : '잠김'}</span></header>
        <p class="cures">${r.cures}</p>
        <p class="recipe">${unlocked ? `처음 개발: ${recipeLine(id, 2)}` : unlockText(id)}</p>
        ${unlocked ? `<div class="row"><button class="btn small gold" data-act="develop" data-id="${id}" ${canDevelop(s, id) ? '' : 'disabled'}>개발하기</button></div>` : ''}
      </article>`;
    }
    const inMenu = s.menu.includes(id);
    return `<article class="card ${inMenu ? 'menu' : ''}">
      <header>${ico(r.main, 'lg')}<h3>${r.name}</h3><span class="tag lv">${m.level}단계</span></header>
      <p class="cures">${r.cures}</p>
      <p class="recipe">${recipeLine(id)} → 3첩 · 한 첩 ${medPrice(s, id, false)}냥</p>
      <p class="doses">달여 둔 약 <b>${m.doses.n}</b>첩${m.doses.hq ? ` · 상급 ${m.doses.hq}` : ''}</p>
      <div class="row">
        <button class="btn small gold" data-act="brew" data-id="${id}" ${canBrew(s, id) ? '' : 'disabled'}>달이기 +3</button>
        <button class="btn small" data-act="upgrade" data-id="${id}" ${canUpgradeMed(s, id) ? '' : 'disabled'}>${m.level >= MAX_MED_LEVEL ? '최고 단계' : `강화 · ${MATERIALS[r.main].name} ${MED_UPGRADE_MAIN}`}</button>
        <button class="btn small ${inMenu ? 'on' : ''}" data-act="menu" data-id="${id}">${inMenu ? '✓ 오늘 낸다' : '오늘 내기'}</button>
      </div>
    </article>`;
  }).join('');
}

function sheetHtml(tab) {
  const s = G.s;
  const head = (t) => `<h4>${t}<button class="close" data-act="tab" data-id="${tab}">닫기</button></h4>`;
  if (tab === 'meds') {
    const menuNames = s.menu.map((id) => RECIPES[id].name).join(', ') || '없음';
    return `${head('약장')}<p class="muted">오늘 낼 약은 ${MAX_MENU}가지까지(지금: ${menuNames}). 약은 미리 달여 두어야 팝니다.</p><div class="cards">${medCards(s)}</div>`;
  }
  if (tab === 'forge') {
    const shop = Object.entries(UPGRADES).map(([k, u]) => {
      const items = Object.entries(u.items).map(([id, n]) => `${MATERIALS[id].name} ${n}`).join(', ');
      return `<li>${ico(UPGRADE_ICON[k], 'lg')}<div><b>${u.name}</b><span>${u.desc}</span><small>${u.money}냥 + ${items}</small></div>
        <button class="btn small ${s.upgrades[k] ? 'on' : 'gold'}" data-act="buy" data-id="${k}" ${canBuyUpgrade(s, k) ? '' : 'disabled'}>${s.upgrades[k] ? '✓' : '맞추기'}</button></li>`;
    }).join('');
    return `${head('대장간 · 물질 도구')}<ul class="list">${shop}
      <li>${ico('netIcon', 'lg')}<div><b>그물 ${ARROW_PACK.count}개</b><span>지금 ${s.arrows}개</span><small>${ARROW_PACK.money}냥</small></div><button class="btn small gold" data-act="arrows" ${s.money >= ARROW_PACK.money ? '' : 'disabled'}>사기</button></li></ul>`;
  }
  if (tab === 'market') return `${head('포구 장터')}${market(s)}<h4 class="sub">망사리와 창고</h4>${invList(s)}`;
  return `${head('수첩')}${notebook(s)}`;
}

function renderPrep() {
  const s = G.s;
  const keep = $('sheet')?.scrollTop ?? 0;
  $('night').innerHTML = `
    <div class="nbar"><span class="eyebrow">${s.day}일째 밤</span><h2>화타 의원</h2><span class="grow"></span>
      <span class="pill">${ico('coin')}<b>${s.money}</b></span><span class="pill">평판 <b>${s.rep}</b></span><span class="pill">손님 <b>${expectedPatients()}</b></span></div>
    <div class="stage"><canvas class="scene" id="scene" aria-label="한의원 안"></canvas>${G.nightTab ? `<div class="sheet" id="sheet">${sheetHtml(G.nightTab)}</div>` : ''}</div>
    <div class="dock"><div class="tabs">${TABS.map(([id, label, icon]) => `<button class="tab ${G.nightTab === id ? 'on' : ''}" data-act="tab" data-id="${id}">${ico(icon)}${label}</button>`).join('')}</div>
      <button class="btn gold go" data-act="open">영업 시작</button></div>`;
  if ($('sheet')) $('sheet').scrollTop = keep;
  G.sceneMode = 'prep';
}

const expectedPatients = () => patientsForDay(G.s) + (G.s.flags.earlyBonus ? 2 : 0) + (G.s.flags.zhangfeiVisit && !G.s.flags.zhangfei ? 1 : 0);

function onNightClick(e) {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  unlockAudio();
  vib(8);
  const s = G.s, id = b.dataset.id;
  const act = b.dataset.act;
  if (act === 'tab') { sfx.click(); G.nightTab = G.nightTab === id ? null : id; return renderPrep(); }
  if (act === 'develop') { if (develop(s, id).ok) { sfx.page(); toast(`${RECIPES[id].name} 개발 완료!`, 'good'); } }
  else if (act === 'brew') { const r = brew(s, id); if (r.ok) { sfx.bubble(); toast(`${RECIPES[id].name} 3첩${r.hq ? ' (상급)' : ''}`, 'good'); } }
  else if (act === 'upgrade') { if (upgradeMed(s, id).ok) { sfx.pickHq(); toast(`${RECIPES[id].name} ${s.meds[id].level}단계`, 'good'); } }
  else if (act === 'menu') {
    sfx.click();
    if (s.menu.includes(id)) s.menu = s.menu.filter((x) => x !== id);
    else if (s.menu.length >= MAX_MENU) toast(`오늘 낼 약은 ${MAX_MENU}가지까지입니다`, 'bad');
    else s.menu.push(id);
  } else if (act === 'buy') { if (buyUpgrade(s, id).ok) { sfx.coin(); toast(`${UPGRADES[id].name}을(를) 새로 맞췄습니다`, 'good'); } }
  else if (act === 'arrows') { if (buyArrows(s).ok) sfx.coin(); }
  else if (act === 'sell') { const r = sellItem(s, id); if (r.ok) { sfx.coin(); toast(`${MATERIALS[id].name}을(를) ${r.coins}냥에 팔았다`, 'good'); } }
  else if (act === 'open') return startService();
  else if (act === 'serve') return pickMed(id);
  else if (act === 'fire') return stopBrew();
  else if (act === 'send') return sendAway();
  else if (act === 'sleep') return sleep();
  else if (act === 'restart') return restart();
  if (s.phase === 'night' && !G.night && G.sceneMode === 'prep') renderPrep();
}

function startService() {
  const s = G.s;
  if (!s.menu.length) return toast('약장에서 오늘 낼 약을 하나 이상 고르세요', 'bad');
  if (!s.menu.some((id) => s.meds[id].doses.n > 0)) toast('달여 둔 약이 하나도 없습니다! 약장에서 먼저 달이세요', 'bad');
  sfx.bell();
  const rng = mulberry32(G.seed + s.day * 31337);
  const total = patientsForDay(s) + (s.flags.earlyBonus ? 2 : 0);
  const types = Array.from({ length: total }, () => pickPatientType(s, rng));
  if (s.flags.zhangfeiVisit && !s.flags.zhangfei) types.unshift('zhangfei');
  G.night = { t: 0, types, queue: [], spawnT: 0, interval: (NIGHT_SECONDS - 30) / types.length, brewing: null, earned: 0, stars: 0, served: 0, wrong: 0, left: 0, next: 1, steam: [], bubbleT: 0 };
  const wide = hasPage(s, 2);
  $('night').innerHTML = `
    <div class="nbar"><span class="eyebrow">${s.day}일째 밤 영업</span><div class="timer"><i id="nightFill"></i></div>
      <span class="pill">${ico('coin')}<b id="svMoney">0</b></span><span class="pill">★ <b id="svStars">0</b></span></div>
    <div class="stage"><canvas class="scene" id="scene" aria-label="한의원 안"></canvas><div id="front"></div>
      <div class="brewbox" id="brew" hidden>
        <p id="brewName"></p>
        <div class="gauge"><span style="flex:28" class="z1"></span><span style="flex:${wide ? 10 : 14}" class="z2"></span><span style="flex:${wide ? 24 : 16}" class="z3"></span><span style="flex:${wide ? 10 : 14}" class="z2"></span><span style="flex:28" class="z1"></span><i id="needle"></i></div>
        <button class="btn gold" data-act="fire">불 끄기!</button>
      </div></div>
    <div class="meds" id="medbar"></div>`;
  G.sceneMode = 'service';
  renderMedbar();
  renderQueue();
}

const patience = () => (G.s.flags.zhangfei ? 45 : 30);

function renderMedbar() {
  const s = G.s;
  const n = G.night;
  const front = n.queue[0];
  $('medbar').innerHTML = s.menu.map((id) => {
    const d = s.meds[id].doses;
    return `<button class="medbtn" data-act="serve" data-id="${id}" ${d.n > 0 && front && !n.brewing ? '' : 'disabled'}>
      <b>${ico(RECIPES[id].main)}${RECIPES[id].name}</b><span>${RECIPES[id].cures}</span><small>${d.n}첩 남음</small></button>`;
  }).join('') + `<button class="medbtn ghost" data-act="send" ${front && !n.brewing ? '' : 'disabled'}><b>돌려보내기</b><span>맞는 약이 없을 때</span></button>`;
}

const CLUES = {
  mother: '얼굴이 창백하고 갓난아기를 업고 있다.',
  elder: '자꾸 벽을 짚는다.',
  diver: '배를 움켜쥐고 신물을 삼킨다.',
  drunk: '코끝이 빨갛고 술 냄새가 난다.',
  fisher: '허리를 펴지 못한다.',
};

function renderQueue() {
  const n = G.night;
  const front = n.queue[0];
  const fr = $('front');
  if (!front) {
    fr.innerHTML = `<div class="waitmsg">${n.types.length ? '다음 손님을 기다리는 중…' : '오늘 손님을 모두 보았습니다'}</div>`;
    return;
  }
  const P = PATIENTS[front.type];
  const clue = CLUES[front.type];
  fr.innerHTML = `<div class="speech"><b>${P.name}</b><p>"${P.line}"</p>${clue ? `<small>${clue}</small>` : ''}</div>`;
}

function pickMed(id) {
  const n = G.night;
  if (!n.queue[0] || n.brewing) return;
  sfx.click();
  n.brewing = { id, pos: 0, dir: 1 };
  $('brew').hidden = false;
  $('brewName').textContent = `${RECIPES[id].name}을(를) 달이는 중 · 바늘이 가운데 초록에 올 때 불을 끄세요`;
  renderMedbar();
}

function stopBrew() {
  const n = G.night, s = G.s;
  if (!n.brewing) return;
  const grade = brewGrade(n.brewing.pos, hasPage(s, 2));
  const id = n.brewing.id;
  n.brewing = null;
  $('brew').hidden = true;
  const p = n.queue.shift();
  const r = serve(s, p.type, id, grade);
  n.leaving = { type: p.type, t: 1, happy: r.ok };
  if (p.type === 'zhangfei') {
    if (r.ok) {
      s.flags.zhangfei = true;
      s.flags.zhangfeiVisit = false;
      sfx.page();
      toast('장비가 조수로 합류했다! 환자들이 더 오래 기다려 준다', 'good');
    } else { sfx.wrong(); toast('장비: "이걸로는 안 낫소! 내일 다시 오리다"', 'bad'); }
  } else if (r.ok) {
    n.earned += r.coins;
    n.stars += r.stars;
    n.served += 1;
    sfx.coin();
    toast(`${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)} ${r.coins}냥${r.hq ? ' (상급 약)' : ''}`, 'good');
  } else {
    n.wrong += 1;
    sfx.wrong();
    toast('맞지 않는 약이었다... 돈을 못 받고 평판이 떨어졌다', 'bad');
  }
  renderQueue();
  renderMedbar();
}

function sendAway() {
  const n = G.night;
  if (!n.queue[0] || n.brewing) return;
  const p = n.queue.shift();
  n.leaving = { type: p.type, t: 1, happy: false };
  if (p.type === 'zhangfei') toast('장비: "약이 없다니! 내일 다시 오리다"', 'bad');
  else toast(`${PATIENTS[p.type].name}을(를) 돌려보냈다`);
  renderQueue();
  renderMedbar();
}

function updateNight(dt) {
  const n = G.night, s = G.s;
  n.t += dt;
  n.spawnT -= dt;
  if (n.types.length && n.spawnT <= 0 && n.t < NIGHT_SECONDS - 10) {
    const type = n.types.shift();
    const max = type === 'zhangfei' ? 90 : patience();
    n.queue.push({ type, wait: max, max, id: n.next++, walk: 1 });
    n.spawnT = n.interval;
    sfx.click();
    renderQueue();
    renderMedbar();
  }
  for (const q of n.queue) {
    q.walk = Math.max(0, q.walk - dt * 1.5);
    if (q === n.queue[0] && n.brewing) continue;
    q.wait -= dt;
  }
  const gone = n.queue.filter((q) => q.wait <= 0);
  for (const q of gone) {
    if (q.type === 'zhangfei') toast('장비가 기다리다 돌아갔다. 내일 다시 온다', 'bad');
    else { s.rep = Math.max(0, s.rep - 1); n.left += 1; toast(`${PATIENTS[q.type].name}이(가) 화가 나서 돌아갔다`, 'bad'); }
  }
  if (gone.length) { n.queue = n.queue.filter((q) => q.wait > 0); sfx.wrong(); renderQueue(); renderMedbar(); }
  if (n.leaving) { n.leaving.t -= dt * 1.5; if (n.leaving.t <= 0) n.leaving = null; }
  if (n.brewing) {
    const b = n.brewing;
    b.pos += b.dir * dt * 1.25;
    if (b.pos > 1) { b.pos = 1; b.dir = -1; }
    if (b.pos < 0) { b.pos = 0; b.dir = 1; }
    $('needle').style.left = `${b.pos * 100}%`;
    n.bubbleT -= dt;
    if (n.bubbleT <= 0) { sfx.bubble(); n.bubbleT = 0.35; }
  }
  $('nightFill').style.width = `${Math.max(0, 1 - n.t / NIGHT_SECONDS) * 100}%`;
  $('svMoney').textContent = n.earned;
  $('svStars').textContent = n.stars;
  const done = !n.types.length && !n.queue.length;
  if ((n.t >= NIGHT_SECONDS || done) && !n.brewing) endService();
}

// 한의원 안: 약장, 걸어 둔 약재, 화타, 줄 선 환자들
function drawScene(dt) {
  const c = $('scene');
  if (!c) return;
  const r = c.getBoundingClientRect();
  if (!r.width) return;
  const dpr = view.dpr;
  if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = false;
  const w = r.width, h = r.height;
  const u = Math.min(h / 30, w / 48);
  g.fillStyle = '#e9dcc0';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#d8c7a4';
  for (let x = 0; x < w; x += u * 6) g.fillRect(x, 0, u * 0.3, h * 0.72);
  g.fillStyle = '#6b4a2b';
  g.fillRect(0, h * 0.72, w, h * 0.28);
  g.fillStyle = '#5a3d24';
  g.fillRect(0, h * 0.72, w, u * 0.6);
  const cabW = Math.min(w * 0.3, u * 26);
  const drawerW = (cabW - u * 1.6) / 5;
  g.fillStyle = '#7a522a';
  g.fillRect(u, u * 2, cabW, h * 0.7 - u * 2);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const dx = u * 1.8 + col * drawerW, dy = u * 3 + row * u * 3.6;
      g.fillStyle = '#a7743f';
      g.fillRect(dx, dy, drawerW - u * 0.5, u * 3);
      g.fillStyle = '#e3b54a';
      g.fillRect(dx + (drawerW - u * 0.5) / 2 - u * 0.3, dy + u * 1.2, u * 0.6, u * 0.6);
    }
  }
  // 천장에 말려 둔 미역과 북어
  for (let i = 0; i < 6; i++) {
    const x = cabW + u * 4 + i * u * 6;
    if (x > w * 0.7) break;
    g.strokeStyle = '#8a6a44';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, u * 3); g.stroke();
    drawSpriteOn(g, i % 2 ? 'pollock' : 'seaweed', x - u * 2, u * 3, u * 0.5, false);
  }
  const lx = w * 0.5, ly = u * 5;
  const glow = g.createRadialGradient(lx, ly, 0, lx, ly, u * 14);
  glow.addColorStop(0, 'rgba(255,200,110,0.45)');
  glow.addColorStop(1, 'rgba(255,200,110,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#b8432f';
  g.fillRect(lx - u, ly - u * 1.4, u * 2, u * 2.8);
  const hx = cabW + u * 6, base = h * 0.72;
  const sc = u * 1.05;
  drawSpriteOn(g, 'hwata', hx, base - 16 * sc, sc, false);
  const potX = hx + u * 14;
  g.fillStyle = '#3a2b1d';
  g.fillRect(potX - u * 2, base - u * 2, u * 4, u * 2);
  g.fillStyle = '#e07a3a';
  g.fillRect(potX - u * 1.4, base - u * 1.6, u * 2.8, u * 0.8);
  g.fillStyle = '#5b4636';
  g.fillRect(potX - u * 1.6, base - u * 5, u * 3.2, u * 3);
  const n = G.night;
  if (n?.brewing && Math.random() < 0.4) n.steam.push({ x: potX + (Math.random() - 0.5) * u * 2, y: base - u * 5, t: 1 });
  if (n) {
    for (const st of n.steam) { st.t -= dt * 0.8; st.y -= dt * u * 6; }
    n.steam = n.steam.filter((st) => st.t > 0);
    for (const st of n.steam) {
      g.fillStyle = `rgba(255,255,255,${st.t * 0.5})`;
      g.beginPath(); g.arc(st.x + Math.sin(st.t * 6) * u * 0.6, st.y, u * (1.6 - st.t), 0, Math.PI * 2); g.fill();
    }
  }
  if (G.s.flags.zhangfei) drawSpriteOn(g, 'zhangfei', w - u * 13, base - 16 * sc * 1.1, sc * 1.1, true);
  if (n) {
    n.queue.forEach((q, i) => {
      const slot = i === 0 ? potX + u * 5 : potX + u * 10 + i * u * 6;
      const x = slot + q.walk * u * 20;
      if (x > w) return;
      const s = i === 0 ? sc : sc * 0.85;
      const big = q.type === 'zhangfei' ? 1.15 : 1;
      drawSpriteOn(g, q.type, x, base - 16 * s * big, s * big, true);
      const pw = 10 * s;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x, base + u * 0.8, pw, u * 0.7);
      g.fillStyle = q.wait / q.max < 0.3 ? '#e0714f' : '#79c26a';
      g.fillRect(x, base + u * 0.8, pw * (q.wait / q.max), u * 0.7);
    });
    if (n.leaving) {
      const l = n.leaving;
      const x = potX + u * 5 + (1 - l.t) * u * 30;
      g.globalAlpha = l.t;
      drawSpriteOn(g, l.type, x, base - 16 * sc, sc, false);
      g.fillStyle = l.happy ? '#b8861f' : '#b8432f';
      g.font = `${Math.round(u * 3)}px "Gowun Dodum", sans-serif`;
      g.fillText(l.happy ? '♪' : '…', x + u * 4, base - 17 * sc);
      g.globalAlpha = 1;
    }
  }
}

function drawSpriteOn(g, key, x, y, px, flip) {
  const s = sprite(key, flip);
  g.drawImage(s, Math.round(x), Math.round(y), s.width * px, s.height * px);
}

function resultShell(inner) {
  const s = G.s;
  $('night').innerHTML = `
    <div class="nbar"><span class="eyebrow">${s.day}일째 밤</span><h2>화타 의원</h2><span class="grow"></span><span class="pill">${ico('coin')}<b>${s.money}</b></span></div>
    <div class="stage"><canvas class="scene" id="scene" aria-label="한의원 안"></canvas><div class="result">${inner}</div></div>`;
  G.sceneMode = 'prep';
}

function countUp(el, to) {
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 900);
    el.textContent = `${Math.round(to * k * (2 - k))}냥`;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function endService() {
  const n = G.night, s = G.s;
  G.night = null;
  const left = n.queue.length + n.types.length;
  const rating = n.served ? Math.round(n.stars / n.served) : 0;
  const lines = [
    `제대로 고친 손님 ${n.served}명${n.wrong ? ` · 잘못 준 약 ${n.wrong}번` : ''}${n.left + left ? ` · 그냥 돌아간 손님 ${n.left + left}명` : ''}`,
    `평판 ${s.rep}`,
  ];
  if (s.flags.zhangfei && !s.flags.zhangfeiNoted) { s.flags.zhangfeiNoted = true; lines.push('장비가 한의원 일을 돕기로 했다. 줄 선 손님들이 더 오래 기다려 준다.'); }
  resultShell(`<span class="eyebrow">${s.day}일째 밤 영업 끝</span><h2>오늘의 진료</h2>
    <div class="stars">${[1, 2, 3].map((i) => `<span class="${i <= rating ? 'on' : ''}" style="animation-delay:${0.2 + i * 0.25}s">★</span>`).join('')}</div>
    <div class="big-num" id="earned">0냥</div>
    ${lines.map((l) => `<p>${l}</p>`).join('')}
    <button class="btn gold" data-act="sleep">${s.day >= DAYS ? '1부를 마친다' : '잠자리에 든다'}</button>`);
  countUp($('earned'), n.earned);
  for (let i = 1; i <= rating; i++) setTimeout(() => { sfx.coin(); vib(15); }, 200 + i * 250);
}

function sleep() {
  const s = G.s;
  if (s.day >= DAYS) return renderEnding();
  fadeTo(`${s.day + 1}일째 아침`, () => { s.day += 1; startDay(); });
}

function renderEnding() {
  const s = G.s;
  s.phase = 'end';
  save();
  const meds = Object.keys(s.meds).map((id) => `${RECIPES[id].name} ${s.meds[id].level}단계`).join(', ');
  resultShell(`<span class="eyebrow">시제품 · 바닷가 마을</span><h2>1부 끝</h2>
    <div class="big-num">${s.money}냥</div>
    <p>일주일 동안 바닷가 한의원을 꾸렸습니다. 평판 ${s.rep}.</p>
    <p>익힌 약: ${meds}</p>
    <p>청낭서 ${(s.pages ?? []).length}/3장 · 재료 도감 ${Object.keys(s.dex ?? {}).length}가지</p>
    <p>${s.flags.zhangfei ? '장비가 조수로 들어왔습니다. "형님들께도 의원 양반 얘기를 해 두겠소!"' : '물에 빠졌던 큰 사내는 끝내 오지 않았습니다. 다음에는 북어탕을 미리 달여 두세요.'}</p>
    <hr><p>다음 이야기: 해구 밑바닥의 난파선. 첫 보스 「검은지느러미 상어」와 유비 삼형제가 기다립니다.</p>
    <button class="btn gold" data-act="restart">처음부터 다시</button>`);
}

function restart() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* 무시 */ }
  G = { ...freshGame(), ...runtime() };
  startDay();
}

// ---------- 시작 ----------

function runtime() {
  return { props: [], ents: [], shots: [], floats: [], parts: [], bubbles: [], flyers: [], time: 0, clock: 0, mode: 'hand', cam: null, paused: false, night: null };
}

function resize() {
  const r = cvs.getBoundingClientRect();
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.cw = r.width;
  view.ch = r.height;
  cvs.width = Math.round(r.width * view.dpr);
  cvs.height = Math.round(r.height * view.dpr);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  const portrait = r.height > r.width;
  view.ts = Math.max(18, Math.round(portrait ? r.width / 13 : Math.min(r.width / 24, r.height / 13)));
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G) {
    G.clock += dt;
    if (G.s.phase === 'day' && G.player && !$('dayui').hidden) {
      updateDay(dt);
      render();
      updateHud();
    } else {
      if (G.night) updateNight(dt);
      if (G.sceneMode) drawScene(dt);
    }
  }
  requestAnimationFrame(frame);
}

// 왼쪽 아래 아무 데나 엄지를 대면 그 자리에 조이스틱이 생긴다
function bindJoystick() {
  const zone = $('joyzone');
  const pad = $('joy');
  const knob = $('joyKnob');
  let cx = 0, cy = 0;
  const move = (e) => {
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = 50;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    joy.x = dx / max;
    joy.y = dy / max;
    if (Math.hypot(joy.x, joy.y) < 0.15) joy.x = joy.y = 0;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    unlockAudio();
    if (joy.id !== null) return;
    joy.id = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    const r = $('app').getBoundingClientRect();
    cx = e.clientX;
    cy = e.clientY;
    pad.style.left = `${cx - r.left}px`;
    pad.style.top = `${cy - r.top}px`;
    pad.classList.add('on');
    move(e);
  });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) move(e); });
  const end = (e) => {
    if (e.pointerId !== joy.id) return;
    joy.id = null;
    joy.x = joy.y = 0;
    knob.style.transform = '';
    pad.classList.remove('on');
    pad.style.left = '';
    pad.style.top = '';
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  zone.addEventListener('contextmenu', (e) => e.preventDefault());
}

function bindUi() {
  bindJoystick();
  for (const b of document.querySelectorAll('[data-mode]')) {
    b.addEventListener('click', () => { unlockAudio(); sfx.click(); vib(8); setMode(b.dataset.mode); });
  }
  const act = $('actBtn');
  act.addEventListener('pointerdown', (e) => { e.preventDefault(); act.setPointerCapture(e.pointerId); actPress(); });
  act.addEventListener('pointerup', actRelease);
  act.addEventListener('pointercancel', actRelease);
  act.addEventListener('contextmenu', (e) => e.preventDefault());
  $('homeBtn').addEventListener('click', () => { if (!G.paused) askHome(); });
  $('goal').addEventListener('click', () => { G.goalIdx = (G.goalIdx ?? 0) + 1; renderTracker(); sfx.click(); });
  $('bagBtn').addEventListener('click', () => {
    if (G.paused) return;
    openPanel({
      title: '망사리',
      body: Object.entries(G.s.inv).filter(([, v]) => v.n > 0).map(([id, v]) => `${MATERIALS[id].name} ${v.n}${v.hq ? ` (상급 ${v.hq})` : ''}`).join('\n') || '아직 아무것도 없습니다.',
      icon: 'netIcon',
      choices: [{ label: '닫기', kind: 'primary', onClick: closePanel }],
    });
  });
  // 일시정지
  const syncLabels = () => {
    $('soundBtn').textContent = isMuted() ? '소리 켜기' : '소리 끄기';
    $('vibeBtn').textContent = settings.vibe ? '진동 끄기' : '진동 켜기';
  };
  $('pauseBtn').addEventListener('click', () => {
    if (G.paused) return;
    G.paused = true;
    releaseInput();
    syncLabels();
    $('helpText').hidden = true;
    $('restartConfirm').hidden = true;
    $('pause').hidden = false;
  });
  $('resumeBtn').addEventListener('click', () => { $('pause').hidden = true; G.paused = false; });
  $('soundBtn').addEventListener('click', () => { unlockAudio(); toggleMute(); syncLabels(); sfx.click(); });
  $('vibeBtn').addEventListener('click', () => { settings.vibe = !settings.vibe; saveSettings(); syncLabels(); vib(30); });
  $('helpBtn').addEventListener('click', () => { $('helpText').hidden = !$('helpText').hidden; });
  $('restartAsk').addEventListener('click', () => { $('restartConfirm').hidden = false; });
  $('restartYes').addEventListener('click', () => { $('pause').hidden = true; restart(); });
  // 세로 화면 안내
  $('rotateSkip').addEventListener('click', () => { settings.rotateSkip = true; saveSettings(); $('rotate').hidden = true; });
  for (const m of MODES) {
    const img = document.querySelector(`[data-mode="${m}"] img`);
    if (img) img.src = iconURL(TOOL_SPRITE[m]);
  }
  for (const img of document.querySelectorAll('img[data-icon]')) img.src = iconURL(img.dataset.icon);
}

function checkRotate() {
  const phone = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  $('rotate').hidden = !(phone && innerHeight > innerWidth && !settings.rotateSkip);
}

// 타이틀 화면
function showTitle() {
  const t = $('title');
  t.hidden = false;
  paintPortrait($('titleHero'), 'swim');
  if (!t.querySelector('.bub')) {
    for (let i = 0; i < 16; i++) {
      const b = document.createElement('span');
      b.className = 'bub';
      const size = 6 + Math.random() * 22;
      b.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-duration:${6 + Math.random() * 8}s;animation-delay:${-Math.random() * 10}s`;
      t.prepend(b);
    }
  }
  const has = !!loadSaved();
  $('continueBtn').hidden = !has;
  $('newBtn').className = has ? 'btn' : 'btn gold';
  $('newConfirm').hidden = true;
}

function enterGame() {
  $('title').hidden = true;
  unlockAudio();
  sfx.splash();
  if (G.s.phase === 'night') { $('dayui').hidden = true; $('night').hidden = false; renderPrep(); }
  else if (G.s.phase === 'end') { $('dayui').hidden = true; $('night').hidden = false; renderEnding(); }
  else startDay();
}

const KEY_MODES = { 1: 'hand', 2: 'harpoon', 3: 'net', 4: 'shovel' };

function boot(hotData) {
  const hot = restore(hotData);
  const data = hot ?? loadSaved() ?? freshGame();
  G = { ...data, ...runtime() };
  resize();
  bindUi();
  cvs.addEventListener('pointerdown', onPointerDown);
  cvs.addEventListener('pointermove', onPointerMove);
  cvs.addEventListener('pointerup', onPointerUp);
  cvs.addEventListener('pointercancel', onPointerUp);
  cvs.addEventListener('pointerleave', () => { if (G) G.hover = null; });
  cvs.addEventListener('contextmenu', (e) => e.preventDefault());
  $('night').addEventListener('click', onNightClick);
  $('continueBtn').addEventListener('click', () => { G = { ...(loadSaved() ?? freshGame()), ...runtime() }; enterGame(); });
  $('newBtn').addEventListener('click', () => {
    if (loadSaved()) { $('newConfirm').hidden = false; return; }
    G = { ...freshGame(), ...runtime() };
    enterGame();
  });
  $('newYes').addEventListener('click', () => {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* 무시 */ }
    G = { ...freshGame(), ...runtime() };
    enterGame();
  });
  window.addEventListener('resize', () => { resize(); checkRotate(); });
  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys.add(k);
    if (KEY_MODES[k] && G?.s.phase === 'day' && !G.paused) setMode(KEY_MODES[k]);
    if ((k === 'e' || k === 'Enter') && !e.repeat) actPress();
    if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys.delete(k);
    if (k === 'e' || k === 'Enter') actRelease();
  });
  window.addEventListener('blur', () => { keys.clear(); releaseInput(); });
  window.claude?.hot?.snapshot?.(() => (G ? snapshot() : null));
  checkRotate();
  if (hot) enterGame();
  else {
    $('dayui').hidden = true;
    showTitle();
  }
  requestAnimationFrame(frame);
}

// 점검용: 주소에 ?debug 가 붙었을 때만 상태를 열어 둔다.
if (location.search.includes('debug')) window.__hwata = { get G() { return G; }, joy, view };

if (window.claude?.hot?.ready) window.claude.hot.ready(boot);
else boot(window.claude?.hot?.data);
