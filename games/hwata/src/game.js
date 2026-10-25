// 화면·조작·하루 흐름. 계산은 rules.js / world.js / quests.js / light.js 가 맡는다.
import {
  DAY_SECONDS, NIGHT_SECONDS, MATERIALS, RECIPES, RECIPE_ORDER, PATIENTS, UPGRADES, PAGES, POTS,
  ANIMALS_PER_DAY, WHITE_RABBIT_CHANCE, LADDER_WOOD, BRIDGE_WOOD, ARROW_PACK, ARROW_CRAFT, DAYS, MAX_MENU,
  MED_UPGRADE_MAIN, MAX_MED_LEVEL,
} from './data.js';
import {
  newState, addItem, count, basketWeight, carryLimit, canCarry, isOverweight, collapseLoss, spendStamina,
  isUnlocked, canDevelop, develop, canBrew, brew, medPrice, canUpgradeMed, upgradeMed, brewGrade, serve,
  patientsForDay, pickPatientType, canBuyUpgrade, buyUpgrade, buyArrows, craftArrows, useWood,
  maxStamina, herbZone, openPot, hasPage, digHardness,
} from './rules.js';
import {
  W, H, T, ZONES, ZONE_NAMES, BIG_TREE_X, makeWorld, tile, setTile, isSolid, canDig, canPlace, surfaceY,
  isExposed, spawnDaily,
} from './world.js';
import { activeQuests, questChoices, questAct, QUESTS } from './quests.js';
import { drawSprite, spriteSize, sprite, iconURL } from './sprites.js';
import { computeLight } from './light.js';
import { sfx, unlockAudio, toggleMute, isMuted } from './audio.js';

const SAVE_KEY = 'hwata-proto1-v1';
const REACH = 3.6;
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
const pad = { left: false, right: false, up: false, down: false };
let upWas = false;

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

// 얻은 재료 아이콘이 바구니로 날아간다
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
    const a = Math.random() * Math.PI * 2, sp = (opt.speed ?? 4) * (0.4 + Math.random());
    G.parts.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opt.up ?? 2), life: opt.life ?? 0.6, max: opt.life ?? 0.6,
      color, size: opt.size ?? 0.14, grav: opt.grav ?? 18, glow: !!opt.glow,
    });
  }
}

// ---------- 창(대화·안내) ----------

function openPanel({ title, body, choices = [], portrait, icon }) {
  G.paused = true;
  releaseInput();
  $('panel').hidden = false;
  $('panelTitle').textContent = title;
  $('panelBody').textContent = body;
  const por = $('panelPortrait');
  const key = portrait ?? icon;
  por.hidden = !key;
  if (key) paintPortrait(por, key);
  const box = $('panelChoices');
  box.innerHTML = '';
  for (const c of choices) {
    const b = document.createElement('button');
    b.className = 'choice' + (c.kind ? ' ' + c.kind : '');
    b.textContent = c.label;
    b.disabled = !!c.disabled;
    b.addEventListener('click', () => { sfx.click(); c.onClick(); });
    box.append(b);
  }
}

function closePanel() {
  $('panel').hidden = true;
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

function startDay() {
  const s = G.s;
  s.phase = 'day';
  s.stamina = maxStamina(s);
  s.flags.earlyBonus = false;
  G.time = 0;
  G.props = spawnDaily(G.world, s.day, mulberry32(G.seed + s.day * 7919));
  for (const q of activeQuests(s)) {
    G.props = G.props.filter((p) => ROOTS.has(p.type) || Math.abs(p.x - q.x) > 1);
    const y = surfaceY(G.world, q.x) - 1;
    G.props.push({ id: 'q-' + q.id, type: 'npc', quest: q.id, sprite: q.npc, x: q.x, y });
    if (q.id === 'zhangfei') G.props.push({ id: 'bottle', type: 'bottle', x: q.x + 1, y: surfaceY(G.world, q.x + 1) - 1 });
  }
  G.props.push({ id: 'sign', type: 'sign', x: ZONES.log[0] - 2, y: surfaceY(G.world, ZONES.log[0] - 2) - 1 });
  G.ents = spawnAnimals(mulberry32(G.seed + s.day * 104729));
  G.arrows = [];
  G.floats = [];
  G.parts = [];
  G.flyers = [];
  G.mine = null;
  G.chop = null;
  G.gauge = null;
  G.aim = null;
  G.hold = null;
  G.dayLog = {};
  G.zone = 'clinic';
  G.warned = false;
  G.player = {
    x: 8, y: surfaceY(G.world, 8) - 1.8 - 0.01, w: 0.7, h: 1.8, vx: 0, vy: 0, onGround: true, face: 1,
    walkT: 0, coyote: 0, jumpBuf: 0, swing: 0, dropT: 0, wasWater: false,
  };
  G.cam = null;
  G.ended = false;
  save();
  $('night').hidden = true;
  $('dayui').hidden = false;
  setMode(G.mode ?? 'hand');
  renderTracker();
  morningCard();
}

function spawnAnimals(rng) {
  const ents = [];
  const onGround = (x, h) => surfaceY(G.world, Math.floor(x)) - h - 0.01;
  for (let i = 0; i < ANIMALS_PER_DAY.rabbit; i++) {
    const x = 60 + rng() * 56;
    ents.push({ type: 'rabbit', x, y: onGround(x, 0.7), w: 0.9, h: 0.7, vx: 0, vy: 0, t: rng() * 2, flee: 0, zig: 0, zdir: 1, hop: 0, home: [57, 119] });
  }
  for (let i = 0; i < ANIMALS_PER_DAY.pheasant; i++) {
    const x = 24 + rng() * 92;
    ents.push({ type: 'pheasant', x, y: onGround(x, 0.8), w: 1.1, h: 0.8, vx: 0, vy: 0, state: 'hide' });
  }
  if (rng() < WHITE_RABBIT_CHANCE && tile(G.world, 95, 36) !== T.AIR) {
    ents.push({ type: 'whiteRabbit', x: 95, y: 35.29, w: 0.9, h: 0.7, vx: 0, vy: 0, t: 1, flee: 0, zig: 0, zdir: 1, hop: 0, home: [92, 99] });
  }
  return ents;
}

function morningCard() {
  const s = G.s;
  const lines = [];
  if (s.day === 1) {
    lines.push('산골 마을에 작은 한의원을 연 화타. 해가 지기 전에 마을 뒷들에서 약재를 캐 오고, 밤에는 그 약재로 약을 지어 환자를 봅니다.');
    lines.push('');
    lines.push('◀ ▶ 걷기 · ▲ 점프(사다리에서는 오르기) · ▼ 내려가기');
    lines.push('[손] 약초를 누르고 있다가 원이 초록일 때 떼면 상급. 사람·나무도 손으로.');
    lines.push('[괭이] 손 닿는 곳(밝은 원 안)의 흙을 누르고 있으면 금이 가다 깨집니다. 땅속 항아리도 깨 보세요.');
    lines.push('[사다리]·[발판]·[흙] 놓을 자리를 누르면 미리 보이고, 손가락을 끌면 줄줄이 놓입니다.');
    lines.push('[활] 쏠 곳을 누른 채 겨누고 떼면 쏩니다.');
    if (view.ch > view.cw) lines.push('휴대폰을 가로로 돌리면 더 넓게 보입니다.');
  } else {
    const tips = {
      2: '농부들이 상처 약을 찾기 시작했습니다. 질경이 고약은 꿩 기름이 필요합니다.',
      3: '오늘부터 칡즙을 개발할 수 있습니다. 칡은 언덕 땅속 깊이(8칸) 묻혀 있습니다.',
      4: '오늘부터 도라지청을 개발할 수 있습니다. 도라지는 언덕 땅속 얕은 곳에 있습니다.',
      5: '땅속 항아리 어딘가에 화타의 의서 「청낭서」 조각이 숨어 있다는 소문입니다.',
      6: '개울가에서 누군가 쓰러져 있다는 소문이 돕니다.',
      7: '마지막 날입니다. 오늘 밤 영업이 끝나면 1부가 마무리됩니다.',
    };
    lines.push(tips[s.day] ?? '');
  }
  const q = activeQuests(s).filter((x) => x.day === s.day);
  if (q.length) lines.push('', `오늘 길에서 누군가를 만날 것 같습니다: ${q.map((x) => x.name).join(', ')}`);
  openPanel({
    title: `${s.day}일째 아침`,
    body: lines.join('\n'),
    portrait: 'hwata',
    choices: [{ label: '뒷들로 나간다', kind: 'primary', onClick: closePanel }],
  });
}

// ---------- 오늘의 할 일 ----------

const QUEST_HINT = { woodcutter: '나무꾼에게 질경이 주기 · 밭둑길', child: '우는 아이 달래기 · 꽃 들판', zhangfei: '쓰러진 큰 사내 살피기 · 개울가' };

function trackerLines() {
  const s = G.s;
  const out = [];
  for (const q of activeQuests(s)) out.push({ icon: 'hand', text: QUEST_HINT[q.id] });
  for (const id of RECIPE_ORDER) {
    if (s.meds[id] || !isUnlocked(s, id)) continue;
    const need = Object.entries(RECIPES[id].inputs).map(([k, n]) => `${MATERIALS[k].name} ${Math.min(count(s, k), n * 2)}/${n * 2}`).join(' · ');
    out.push({ icon: RECIPES[id].main, text: `${RECIPES[id].name} 개발: ${need}` });
  }
  const p = (s.pages ?? []).length;
  if (p < 3 && s.day >= 2) out.push({ icon: 'page', text: `청낭서 ${p}/3 · 땅속 항아리를 찾아보세요` });
  if (!out.length) out.push({ icon: 'mugwort', text: '약재를 넉넉히 캐 두세요' });
  return out.slice(0, 3);
}

function renderTracker() {
  $('trackerList').innerHTML = trackerLines().map((l) => `<li><img src="${iconURL(l.icon)}" alt="">${l.text}</li>`).join('');
}

// ---------- 하루 끝 ----------

function endDay(reason) {
  if (G.ended) return;
  G.ended = true;
  releaseInput();
  const s = G.s;
  let body;
  if (reason === 'home') {
    const early = G.time < DAY_SECONDS - 20;
    s.flags.earlyBonus = early;
    body = early ? '해가 지기 전에 돌아왔다. 일찍 문을 연 덕에 오늘 밤 환자가 2명 더 찾아온다.' : '해 질 녘에 한의원으로 돌아왔다.';
  } else {
    const lost = collapseLoss(s);
    const why = reason === 'tired' ? '기력이 다해 쓰러졌다.' : '해가 져서 길을 잃었다.';
    body = `${why} 마을 사람에게 업혀 돌아왔다. 바구니에서 가장 많던 재료 한 가지만 남았다.${lost ? ` (${lost}개 잃음)` : ''}`;
  }
  const got = Object.entries(G.dayLog).map(([id, n]) => `${MATERIALS[id].name} ${n}`).join(', ');
  openPanel({
    title: '하루를 마치며',
    body: body + (got ? `\n\n오늘 캔 것: ${got}` : ''),
    portrait: 'hwata',
    choices: [{ label: '한의원 문을 연다', kind: 'primary', onClick: () => { closePanel(); fadeTo(`${s.day}일째 밤`, openNight); } }],
  });
}

// ---------- 입력 ----------

const MODES = ['hand', 'hoe', 'bow', 'ladder', 'plank', 'dirt'];

function setMode(m) {
  G.mode = m;
  for (const b of document.querySelectorAll('[data-mode]')) b.classList.toggle('on', b.dataset.mode === m);
  $('arrowType').hidden = m !== 'bow';
  G.mine = null;
}

function releaseInput() {
  pad.left = pad.right = pad.up = pad.down = false;
  for (const b of document.querySelectorAll('[data-pad]')) b.classList.remove('on');
  if (G) { G.hold = null; G.aim = null; G.gauge = null; G.mine = null; G.chop = null; }
}

function screenToWorld(cx, cy) {
  return { x: G.cam.x + cx / view.ts, y: G.cam.y + cy / view.ts };
}

const playerCenter = () => ({ x: G.player.x + G.player.w / 2, y: G.player.y + G.player.h / 2 });
const distTo = (x, y) => { const c = playerCenter(); return Math.hypot(c.x - x, c.y - y); };
const inReach = (tx, ty) => distTo(tx + 0.5, ty + 0.5) <= REACH;

function propAt(tx, ty) {
  const hit = (p) => p.x === tx && (p.y === ty || (p.type === 'npc' && p.y - 1 === ty) || (p.type === 'tree' && ty >= p.y - 2 && ty <= p.y));
  return G.props.find((p) => p.type === 'npc' && hit(p)) ?? G.props.find(hit);
}

const HERBS = new Set(['mugwort', 'chrysanthemum', 'plantain', 'dandelion', 'dropwort', 'clover']);
const ROOTS = new Set(['bellflower', 'kudzu']);
const PLACE_TILE = { ladder: T.LADDER, plank: T.PLANK, dirt: T.DIRT };

function pointerWorld(e) {
  const r = cvs.getBoundingClientRect();
  return { sx: e.clientX - r.left, sy: e.clientY - r.top };
}

function onPointerDown(e) {
  unlockAudio();
  if (!G || G.paused || G.s.phase !== 'day' || G.ended) return;
  cvs.setPointerCapture(e.pointerId);
  const { sx, sy } = pointerWorld(e);
  G.hold = { id: e.pointerId, sx, sy, mode: G.mode };
  const wp = screenToWorld(sx, sy);
  if (G.mode === 'bow') { G.aim = { x: wp.x, y: wp.y }; return; }
  if (G.mode === 'hand') handPress(Math.floor(wp.x), Math.floor(wp.y));
}

function onPointerMove(e) {
  if (!G || G.s.phase !== 'day') return;
  const { sx, sy } = pointerWorld(e);
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
  G.chop = null;
  if (mode === 'bow' && G.aim) fire();
  G.aim = null;
  if (G.gauge) finishGauge();
}

function handPress(tx, ty) {
  if (tx <= 11 && ty >= surfaceY(G.world, tx) - 6 && ty < surfaceY(G.world, tx)) return askHome();
  const p = propAt(tx, ty);
  if (p) return tapProp(p);
  const t = tile(G.world, tx, ty);
  if (t === T.ROOT) return tapRoot(tx, ty);
  if (t === T.LOG) return toast('너무 큰 통나무입니다. 도끼가 있어야 치울 수 있습니다');
  if (canDig(G.world, tx, ty)) return toast('흙은 [괭이]로 팝니다');
}

function tapProp(p) {
  if (p.type === 'npc') {
    if (distTo(p.x + 0.5, p.y) > REACH + 1) return toast('조금 더 가까이 가야 합니다');
    return openQuest(p.quest);
  }
  if (p.type === 'sign') {
    return openPanel({
      title: '나무 팻말',
      body: '"이 너머 대나무 숲. 큰 나무가 쓰러져 길이 막혔음."\n\n도끼가 있어야 지나갈 수 있겠다. (대나무 숲은 시제품 2에서 열립니다)',
      icon: 'sign',
      choices: [{ label: '돌아선다', onClick: closePanel }],
    });
  }
  if (ROOTS.has(p.type)) return tapRoot(p.x, p.y);
  if (p.type === 'bottle') return toast('빈 술병이 뒹굴고 있다');
  if (p.type === 'beehive') return toast('너무 높다. [활]로 떨어뜨려야겠다');
  if (!inReach(p.x, p.y)) return toast('손이 닿지 않습니다. 더 가까이 가세요');
  if (p.type === 'tree') { G.chop = { prop: p, t: 0, dur: 0.9 }; return; }
  if (p.type === 'cicada') { if (gain('cicada', false, p.x + 0.5, p.y + 0.5)) removeProp(p); return; }
  if (p.type === 'clover') {
    if (gain('clover', false, p.x + 0.5, p.y + 0.5)) { removeProp(p); toast('네잎클로버! 다음에 캐는 재료 5개가 모두 상급이 됩니다', 'good'); }
    return;
  }
  if (HERBS.has(p.type)) G.gauge = { prop: p, item: p.type, x: p.x, y: p.y, t: 0, dur: 1.0, zone: herbZone(G.s) };
}

function tapRoot(tx, ty) {
  if (!inReach(tx, ty)) return toast('손이 닿지 않습니다. 더 가까이 가세요');
  if (!isExposed(G.world, tx, ty)) return toast('뿌리 둘레의 흙을 [괭이]로 더 파야 합니다');
  const p = G.props.find((q) => q.x === tx && q.y === ty && ROOTS.has(q.type));
  if (!p) return;
  const [a, b] = herbZone(G.s);
  G.gauge = { prop: p, item: p.type, x: tx, y: ty, t: 0, dur: 1.3, zone: [a + 0.06, b - 0.02], root: true };
}

function finishGauge() {
  const g = G.gauge;
  G.gauge = null;
  const v = g.t / g.dur;
  const hq = v >= g.zone[0] && v <= g.zone[1];
  if (!canCarry(G.s, g.item)) return toast('바구니가 가득 찼습니다', 'bad');
  if (g.root) {
    spendStamina(G.s, 1);
    setTile(G.world, g.x, g.y, T.AIR);
    burst(g.x + 0.5, g.y + 0.5, '#7a5534', 8);
    if (v > g.zone[1]) toast('너무 세게 뽑아 뿌리가 끊겼다');
  } else burst(g.x + 0.5, g.y + 0.6, '#7dbb59', 6, { speed: 3 });
  G.player.swing = 0.25;
  gain(g.item, hq, g.x + 0.5, g.y + 0.5);
  removeProp(g.prop);
}

function gain(id, hq, wx, wy) {
  if (!canCarry(G.s, id)) { toast('바구니가 가득 찼습니다', 'bad'); return false; }
  const before = G.s.inv[id]?.hq ?? 0;
  const first = addItem(G.s, id, hq);
  const isHq = G.s.inv[id].hq > before && MATERIALS[id].weight > 0;
  G.dayLog[id] = (G.dayLog[id] ?? 0) + 1;
  const c = playerCenter();
  floatText(`${MATERIALS[id].name}${isHq ? ' ★' : ''}`, c.x, c.y - 1.3, isHq ? '#ffd76a' : '#fff6d8');
  flyIcon(id, wx ?? c.x, wy ?? c.y);
  if (isHq) { sfx.pickHq(); burst(wx ?? c.x, wy ?? c.y, '#ffd76a', 10, { glow: true, grav: 2, speed: 3 }); } else sfx.pick();
  if (first && MATERIALS[id].weight > 0) toast(`새 재료 발견! 도감에 올랐습니다: ${MATERIALS[id].name}`, 'good');
  renderTracker();
  return true;
}

function removeProp(p) {
  G.props = G.props.filter((q) => q !== p);
}

const PLACE_COST = { ladder: () => useWood(G.s, LADDER_WOOD), plank: () => useWood(G.s, BRIDGE_WOOD), dirt: () => useDirt() };

function useDirt() {
  if (count(G.s, 'dirt') < 1) return false;
  G.s.inv.dirt.n -= 1;
  return true;
}

function placeCheck(tx, ty) {
  const kind = PLACE_TILE[G.mode];
  if (!inReach(tx, ty)) return { ok: false, why: 'far' };
  if (!canPlace(G.world, tx, ty, kind, G.player)) return { ok: false, why: 'spot' };
  const have = G.mode === 'dirt' ? count(G.s, 'dirt') : count(G.s, 'wood');
  if (have < 1) return { ok: false, why: 'stock' };
  return { ok: true };
}

function breakTile(tx, ty) {
  const t = tile(G.world, tx, ty);
  setTile(G.world, tx, ty, T.AIR);
  G.player.swing = 0.25;
  const cx = tx + 0.5, cy = ty + 0.5;
  if (t === T.POT) return breakPot(tx, ty);
  if (t === T.LADDER || t === T.PLANK) {
    addItem(G.s, 'wood');
    sfx.place();
    burst(cx, cy, '#a7743f', 5);
    return;
  }
  addItem(G.s, 'dirt');
  sfx.breakDirt();
  burst(cx, cy, t === T.GRASS ? '#6aa04f' : '#7a5534', 10, { size: 0.16 });
  spendStamina(G.s, 1);
  G.props = G.props.filter((p) => !(HERBS.has(p.type) && p.x === tx && p.y === ty - 1));
}

function breakPot(tx, ty) {
  const s = G.s;
  const i = POTS.findIndex((p) => p.x === tx && p.y === ty);
  sfx.breakPot();
  burst(tx + 0.5, ty + 0.5, '#a86b3e', 14, { size: 0.18, speed: 5 });
  if (i < 0 || s.pots.includes(i)) return toast('빈 항아리였다');
  s.pots.push(i);
  const r = openPot(s, POTS[i].loot);
  const loot = POTS[i].loot;
  const icon = loot.page ? 'page' : loot.money ? 'coin' : loot.arrows ? 'arrowIcon' : loot.item;
  flyIcon(icon, tx + 0.5, ty + 0.5);
  if (r.page) {
    sfx.page();
    burst(tx + 0.5, ty + 0.5, '#ffe9a8', 24, { glow: true, grav: -1, speed: 3, life: 1.2 });
    openPanel({
      title: PAGES[r.page].name,
      body: `항아리 속에서 오래된 두루마리가 나왔다. 화타가 젊은 시절 적어 둔 의서 「청낭서」의 한 장이다.\n\n${PAGES[r.page].perk}.\n\n(${s.pages.length}/3장)`,
      icon: 'page',
      choices: [{ label: '소중히 챙긴다', kind: 'primary', onClick: closePanel }],
    });
  } else {
    sfx.coin();
    toast(`항아리 속에서 ${r.text}!`, 'good');
  }
  renderTracker();
}

function fire() {
  const s = G.s;
  if (s.arrows <= 0) return toast('화살이 없습니다. 밤에 사거나 만드세요', 'bad');
  const c = playerCenter();
  const dx = G.aim.x - c.x, dy = G.aim.y - (c.y - 0.3);
  const len = Math.hypot(dx, dy) || 1;
  const speed = s.upgrades.bow ? 27 : 18;
  s.arrows -= 1;
  spendStamina(s, 2);
  sfx.shoot();
  G.player.face = dx >= 0 ? 1 : -1;
  G.player.swing = 0.2;
  G.arrows.push({ x: c.x, y: c.y - 0.3, vx: (dx / len) * speed, vy: (dy / len) * speed, type: G.arrowType, life: 3, stuck: false });
}

const arrowGravity = () => (G.s.upgrades.bow ? 7 : 12);

function askHome() {
  openPanel({
    title: '한의원',
    body: '오늘 탐험을 마치고 한의원으로 들어갈까요? 해가 지기 전에 들어가면 오늘 밤 환자가 더 찾아옵니다.',
    portrait: 'hwata',
    choices: [
      { label: '들어간다', kind: 'primary', onClick: () => { closePanel(); endDay('home'); } },
      { label: '조금 더 돌아본다', onClick: closePanel },
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
        G.props = G.props.filter((p) => p.quest !== id);
        sfx.page();
        renderTracker();
        openPanel({ title: q.name, body: r.text, portrait: q.npc, choices: [{ label: '길을 떠난다', kind: 'primary', onClick: closePanel }] });
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

// 위에서만 밟히는 칸: 발판, 그리고 꼭대기 사다리
function isPlatform(x, y) {
  const t = tile(G.world, x, y);
  return t === T.PLANK || (t === T.LADDER && tile(G.world, x, y - 1) !== T.LADDER);
}

function moveBody(b, dt, opt = {}) {
  const dx = b.vx * dt;
  b.hitWall = false;
  if (dx) {
    b.x += dx;
    if (hitsSolid(b)) {
      let stepped = false;
      if (opt.autoStep && b.onGround) {
        b.y -= 1.01;
        if (!hitsSolid(b)) stepped = true; else b.y += 1.01;
      }
      if (!stepped) {
        b.x = dx > 0 ? Math.floor(b.x + b.w) - b.w - 0.001 : Math.floor(b.x) + 1.001;
        b.hitWall = true;
        b.vx = 0;
      }
    }
  }
  const dy = b.vy * dt;
  const prevBottom = b.y + b.h;
  b.onGround = false;
  b.y += dy;
  if (hitsSolid(b)) {
    if (dy > 0) { b.y = Math.floor(b.y + b.h) - b.h - 0.001; b.onGround = true; } else b.y = Math.floor(b.y) + 1.001;
    b.vy = 0;
  } else if (dy > 0 && opt.platforms && !b.dropping) {
    const row = Math.floor(b.y + b.h);
    if (prevBottom <= row + 0.02) {
      const x0 = Math.floor(b.x), x1 = Math.floor(b.x + b.w - 1e-6);
      for (let x = x0; x <= x1; x++) {
        if (isPlatform(x, row)) { b.y = row - b.h - 0.001; b.vy = 0; b.onGround = true; break; }
      }
    }
  }
  if (!b.onGround && opt.platforms && !b.dropping && b.vy >= 0) {
    // 판 위에 가만히 서 있을 때도 땅으로 친다
    const row = Math.floor(b.y + b.h + 0.01);
    if (Math.abs(b.y + b.h - row) < 0.02) {
      const x0 = Math.floor(b.x), x1 = Math.floor(b.x + b.w - 1e-6);
      for (let x = x0; x <= x1; x++) if (isPlatform(x, row)) { b.onGround = true; break; }
    }
  }
  b.x = clamp(b.x, 0, W - b.w);
}

function inWater(b) {
  const cx = Math.floor(b.x + b.w / 2), cy = Math.floor(b.y + b.h * 0.6);
  return tile(G.world, cx, cy) === T.WATER;
}

function ladderAt(b) {
  const cx = Math.floor(b.x + b.w / 2);
  return tile(G.world, cx, Math.floor(b.y + b.h - 0.1)) === T.LADDER || tile(G.world, cx, Math.floor(b.y + 0.3)) === T.LADDER;
}

// 사다리를 들고 벽에 붙어 ▲를 누르면 발밑부터 머리 위까지 사다리를 이어 놓는다. 벽이 끝나면 멈춘다.
function autoLadder(p, dt) {
  G.autoLadderT = (G.autoLadderT ?? 0) - dt;
  if (G.autoLadderT > 0) return;
  const cx = Math.floor(p.x + p.w / 2);
  const head = Math.floor(p.y);
  if (!isSolid(G.world, cx - 1, head) && !isSolid(G.world, cx + 1, head)) return;
  for (let y = Math.floor(p.y + p.h - 0.1); y >= head - 1; y--) {
    const t = tile(G.world, cx, y);
    if (t === T.LADDER) continue;
    if ((t === T.AIR || t === T.WATER) && canPlace(G.world, cx, y, T.LADDER, p)) {
      if (!useWood(G.s, LADDER_WOOD)) {
        if (!G.warnedStock) { G.warnedStock = true; toast('나무가 없습니다. 작은 나무를 [손]으로 베세요', 'bad'); }
        return;
      }
      setTile(G.world, cx, y, T.LADDER);
      sfx.place();
      G.autoLadderT = 0.12;
    }
    return;
  }
}

function updatePlayer(dt) {
  const p = G.player, s = G.s;
  const left = pad.left || keys.has('ArrowLeft') || keys.has('a');
  const right = pad.right || keys.has('ArrowRight') || keys.has('d');
  const up = pad.up || keys.has('ArrowUp') || keys.has('w') || keys.has(' ');
  const down = pad.down || keys.has('ArrowDown') || keys.has('s');
  const upPressed = up && !upWas;
  upWas = up;
  const water = inWater(p);
  if (water && !p.wasWater && p.vy > 3) { sfx.splash(); burst(p.x + p.w / 2, p.y + p.h * 0.6, '#cfe8f3', 10, { speed: 4, up: 4 }); }
  p.wasWater = water;
  const ladder = ladderAt(p);
  let speed = isOverweight(s) ? 3.2 : 5.5;
  if (water) speed = Math.min(speed, 2.6);
  const busy = G.gauge || G.chop;
  const dir = busy ? 0 : (right ? 1 : 0) - (left ? 1 : 0);
  const target = dir * (p.climbing ? 2.5 : speed);
  p.vx = lerp(p.vx, target, clamp(dt * (p.onGround ? 22 : 10), 0, 1));
  if (Math.abs(p.vx) < 0.05) p.vx = 0;
  if (dir) p.face = dir;

  if (G.mode === 'ladder' && up) autoLadder(p, dt);
  if ((ladder || ladderAt(p)) && (up || down)) p.climbing = true;
  if (!ladder) p.climbing = false;
  if (p.onGround && down && !ladder && isPlatform(Math.floor(p.x + p.w / 2), Math.floor(p.y + p.h + 0.05))) {
    p.dropping = true;
    p.dropT = 0.25;
  }
  if (p.dropT > 0) { p.dropT -= dt; if (p.dropT <= 0) p.dropping = false; }
  if (p.climbing) {
    p.dropping = down;
    p.vy = up ? -4.5 : down ? 4.5 : 0;
    // 꼭대기에 닿으면 턱 위로 올라선다
    const cx = Math.floor(p.x + p.w / 2);
    if (up && tile(G.world, cx, Math.floor(p.y + p.h - 0.6)) !== T.LADDER && tile(G.world, cx, Math.floor(p.y + p.h - 0.1)) === T.LADDER) {
      p.y = Math.floor(p.y + p.h - 0.1) - p.h - 0.001;
      p.vy = 0;
      p.climbing = false;
      p.onGround = true;
    }
  } else if (water) {
    p.vy = Math.min(p.vy + 10 * dt, 3);
    if (up) p.vy = -5;
  } else {
    p.vy = Math.min(p.vy + 34 * dt, 18);
  }
  p.coyote = p.onGround ? 0.1 : p.coyote - dt;
  p.jumpBuf = upPressed ? 0.12 : p.jumpBuf - dt;
  if (!p.climbing && !water && p.jumpBuf > 0 && p.coyote > 0 && !ladder) {
    p.vy = -12.5;
    p.jumpBuf = 0;
    p.coyote = 0;
    sfx.jump();
  }
  if (!up && p.vy < -5 && !p.climbing && !water) p.vy = -5; // 짧게 누르면 낮게 뛴다
  const wasGround = p.onGround;
  const fallV = p.vy;
  moveBody(p, dt, { autoStep: true, platforms: true });
  if (p.onGround && !wasGround && fallV > 10) { sfx.land(); burst(p.x + p.w / 2, p.y + p.h, '#c9b48f', 5, { speed: 2, up: 1, size: 0.1 }); }
  p.walkT = dir && p.onGround ? p.walkT + dt : 0;
  p.swing = Math.max(0, p.swing - dt);
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
  if (G.chop) {
    const c = G.chop;
    c.t += dt;
    G.player.swing = 0.2;
    if (Math.random() < dt * 8) burst(c.prop.x + 0.5, c.prop.y - 0.5, '#5f8f48', 1, { speed: 2, grav: 6, life: 0.8 });
    if (c.t >= c.dur) {
      removeProp(c.prop);
      for (let i = 0; i < 3; i++) addItem(G.s, 'wood');
      floatText('나무 +3', c.prop.x + 0.5, c.prop.y - 1);
      flyIcon('wood', c.prop.x + 0.5, c.prop.y - 0.5);
      sfx.breakDirt();
      burst(c.prop.x + 0.5, c.prop.y - 1, '#5f8f48', 14, { speed: 4 });
      spendStamina(G.s, 2);
      G.chop = null;
    }
  }
  if (!h || G.mode === 'hand' || G.mode === 'bow') return;
  const c = cursorTile();
  if (G.mode === 'hoe') {
    if (!canDig(G.world, c.x, c.y) || !inReach(c.x, c.y)) { G.mine = null; return; }
    if (!G.mine || G.mine.x !== c.x || G.mine.y !== c.y) G.mine = { x: c.x, y: c.y, t: 0, need: digHardness(G.s, tile(G.world, c.x, c.y)), tick: 0 };
    const m = G.mine;
    m.t += dt;
    m.tick -= dt;
    G.player.swing = 0.2;
    G.player.face = c.x + 0.5 > playerCenter().x ? 1 : -1;
    if (m.tick <= 0) { sfx.chip(); m.tick = 0.14; burst(c.x + 0.5, c.y + 0.5, '#8a6340', 2, { speed: 2, size: 0.1 }); }
    if (m.t >= m.need) { breakTile(c.x, c.y); G.mine = null; }
    return;
  }
  const chk = placeCheck(c.x, c.y);
  if (!chk.ok) {
    if (chk.why === 'stock' && !G.warnedStock) { G.warnedStock = true; toast(G.mode === 'dirt' ? '흙덩이가 없습니다. [괭이]로 흙을 파면 생깁니다' : '나무가 없습니다. 작은 나무를 [손]으로 베세요', 'bad'); }
    return;
  }
  if (PLACE_COST[G.mode]()) {
    setTile(G.world, c.x, c.y, PLACE_TILE[G.mode]);
    sfx.place();
    burst(c.x + 0.5, c.y + 0.5, G.mode === 'dirt' ? '#7a5534' : '#b07a46', 4, { speed: 2, size: 0.1 });
    G.player.swing = 0.2;
  }
}

function updateArrows(dt) {
  for (const a of G.arrows) {
    if (a.stuck) { a.life -= dt; continue; }
    a.vy += arrowGravity() * dt;
    for (let i = 0; i < 3 && !a.stuck && a.life > 0; i++) {
      a.x += (a.vx * dt) / 3;
      a.y += (a.vy * dt) / 3;
      if (arrowHits(a)) { a.life = 0; break; }
      if (isSolid(G.world, Math.floor(a.x), Math.floor(a.y))) { a.stuck = true; a.life = 0.8; sfx.chip(); }
    }
    a.life -= dt;
    if (a.x < 0 || a.x > W || a.y > H) a.life = 0;
  }
  G.arrows = G.arrows.filter((a) => a.life > 0);
}

function arrowHits(a) {
  const hive = G.props.find((p) => p.type === 'beehive' && a.x >= p.x - 0.1 && a.x <= p.x + 1.1 && a.y >= p.y - 0.2 && a.y <= p.y + 1.2);
  if (hive) {
    removeProp(hive);
    G.ents.push({ type: 'hive', x: hive.x, y: hive.y, w: 0.9, h: 1, vx: 0, vy: 0 });
    sfx.hit();
    toast('벌집이 떨어진다! 벌이 쫓아오면 개울로 피하세요', 'bad');
    return true;
  }
  for (const e of G.ents) {
    if (!['rabbit', 'whiteRabbit', 'pheasant'].includes(e.type) || e.dead) continue;
    if (a.x < e.x || a.x > e.x + e.w || a.y < e.y - 0.15 || a.y > e.y + e.h + 0.1) continue;
    const net = a.type === 'net';
    if (e.type === 'whiteRabbit' && !net) {
      e.flee = 3;
      floatText('빗나감! 그물로만', e.x, e.y - 0.5, '#ffb0a0');
      return false;
    }
    e.dead = true;
    sfx.hit();
    burst(e.x + e.w / 2, e.y + e.h / 2, net ? '#e8eef2' : '#c9a26c', 10, { speed: 3 });
    if (e.type === 'pheasant') {
      gain('pheasantFat', net, e.x, e.y);
      addItem(G.s, 'feather', false);
      G.dayLog.feather = (G.dayLog.feather ?? 0) + 1;
    } else gain(e.type === 'whiteRabbit' ? 'whiteFur' : 'rabbitFur', net, e.x, e.y);
    return true;
  }
  return false;
}

function updateEnts(dt) {
  const pc = playerCenter();
  for (const e of G.ents) {
    if (e.dead) continue;
    if (e.type === 'rabbit' || e.type === 'whiteRabbit') updateRabbit(e, dt, pc);
    else if (e.type === 'pheasant') updatePheasant(e, dt, pc);
    else if (e.type === 'hive') {
      e.vy = Math.min(e.vy + 30 * dt, 18);
      moveBody(e, dt);
      if (e.onGround) {
        e.dead = true;
        sfx.breakPot();
        burst(e.x + 0.45, e.y + 0.5, '#d4a94a', 12);
        for (let i = 0; i < 2; i++) G.ents.push({ type: 'drop', item: 'honey', x: e.x + i * 0.5 - 0.2, y: e.y, w: 0.6, h: 0.6, vx: 0, vy: -4 });
        G.ents.push({ type: 'bees', x: e.x, y: e.y - 0.5, w: 0.9, h: 0.9, t: 10 });
      }
    } else if (e.type === 'drop') {
      e.vy = Math.min(e.vy + 30 * dt, 18);
      moveBody(e, dt, { platforms: true });
      const p = G.player;
      if (e.x < p.x + p.w + 0.3 && e.x + e.w > p.x - 0.3 && e.y < p.y + p.h && e.y + e.h > p.y) {
        if (gain(e.item, false, e.x, e.y)) e.dead = true;
      }
    } else if (e.type === 'bees') updateBees(e, dt, pc);
  }
  G.ents = G.ents.filter((e) => !e.dead);
}

function updateRabbit(r, dt, pc) {
  const d = Math.hypot(r.x - pc.x, r.y - pc.y);
  if (d < 6) r.flee = 2.5;
  r.t -= dt;
  r.hop -= dt;
  if (r.flee > 0) {
    r.flee -= dt;
    r.zig -= dt;
    if (r.zig < 0) { r.zig = 0.4 + Math.random() * 0.7; r.zdir = Math.random() < 0.3 ? -1 : 1; }
    const away = r.x + r.w / 2 > pc.x ? 1 : -1;
    r.vx = away * r.zdir * 6;
    if (r.onGround && r.hop < 0) { r.vy = -6.5; r.hop = 0.35; }
  } else if (r.t < 0) {
    r.t = 1 + Math.random() * 2;
    r.vx = [-1.5, 0, 0, 1.5][Math.floor(Math.random() * 4)];
  }
  if (r.x < r.home[0]) r.vx = Math.abs(r.vx) || 1;
  if (r.x > r.home[1]) r.vx = -Math.abs(r.vx) || -1;
  r.vy = Math.min(r.vy + 30 * dt, 18);
  moveBody(r, dt);
  if (r.hitWall && r.onGround) r.vy = -7;
  r.face = r.vx > 0 ? 1 : r.vx < 0 ? -1 : r.face ?? 1;
}

function updatePheasant(b, dt, pc) {
  const d = Math.hypot(b.x - pc.x, b.y - pc.y);
  if (b.state === 'hide') {
    if (d < 3.5) {
      b.state = 'fly';
      b.vx = b.x > pc.x ? 7 : -7;
      b.vy = -5;
      floatText('푸드덕!', b.x, b.y - 0.4);
      burst(b.x + 0.5, b.y + 0.5, '#8a5a2e', 6, { speed: 3, grav: 4 });
    }
    return;
  }
  b.vy = Math.max(b.vy + 2 * dt, -5);
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.face = b.vx > 0 ? 1 : -1;
  if (b.y < 2 || b.x < -5 || b.x > W + 5 || Math.abs(b.x - pc.x) > 40) b.dead = true;
}

function updateBees(b, dt, pc) {
  b.t -= dt;
  const dx = pc.x - (b.x + 0.45), dy = pc.y - 0.4 - (b.y + 0.45);
  const len = Math.hypot(dx, dy) || 1;
  b.x += (dx / len) * 4.3 * dt;
  b.y += (dy / len) * 4.3 * dt;
  if (inWater(G.player)) { b.dead = true; toast('물속으로 피했다! 벌이 흩어졌다', 'good'); return; }
  if (len < 0.8) {
    b.dead = true;
    spendStamina(G.s, 15);
    sfx.hurt();
    toast('벌에 쏘였다! 기력 -15', 'bad');
    floatText('-15', pc.x, pc.y - 1.2, '#ff9c8a');
    G.shake = 0.3;
    return;
  }
  if (b.t < 0) b.dead = true;
}

function updateParts(dt) {
  for (const q of G.parts) {
    q.life -= dt;
    q.vy += q.grav * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    if (q.grav > 0 && isSolid(G.world, Math.floor(q.x), Math.floor(q.y))) { q.vy *= -0.3; q.vx *= 0.6; q.y -= 0.05; }
  }
  G.parts = G.parts.filter((q) => q.life > 0);
  if (G.parts.length > 300) G.parts.splice(0, G.parts.length - 300);
  for (const f of G.flyers) f.t += dt * 1.8;
  G.flyers = G.flyers.filter((f) => f.t < 1);
  for (const f of G.floats) { f.t -= dt; f.y -= dt * 0.8; }
  G.floats = G.floats.filter((f) => f.t > 0);
}

function zoneAt(x) {
  for (const [k, [a, b]] of Object.entries(ZONES)) if (k !== 'log' && x >= a && x <= b) return k;
  return 'forest';
}

function updateDay(dt) {
  if (G.paused || G.ended) return;
  G.time += dt;
  updatePlayer(dt);
  updateHold(dt);
  if (G.gauge) G.gauge.t = Math.min(G.gauge.t + dt, G.gauge.dur * 1.25);
  updateArrows(dt);
  updateEnts(dt);
  updateParts(dt);
  G.shake = Math.max(0, (G.shake ?? 0) - dt);
  const z = zoneAt(Math.floor(G.player.x));
  if (z !== G.zone) { G.zone = z; toast(ZONE_NAMES[z]); }
  if (G.s.stamina <= 0) return endDay('tired');
  if (G.time >= DAY_SECONDS) return endDay('dark');
  if (!G.warned && G.time >= DAY_SECONDS - 30) { G.warned = true; sfx.bell(); toast('노을이 진다. 서둘러 돌아가자!', 'bad'); }
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

const TILE_COL = {
  [T.DIRT]: ['#7a5534', '#6a4729', '#8a6340', '#4d331d'],
  [T.GRASS]: ['#7a5534', '#6a4729', '#8a6340', '#4d331d'],
  [T.STONE]: ['#6f7079', '#5d5e67', '#83848c', '#46474f'],
  [T.ROOT]: ['#7a5534', '#6a4729', '#8a6340', '#4d331d'],
  [T.POT]: ['#7a5534', '#6a4729', '#8a6340', '#4d331d'],
};

const openAt = (x, y) => !isSolid(G.world, x, y);

function drawTile(t, x, y, sx, sy, ts) {
  const px = ts / 8;
  if (t === T.WATER) {
    ctx.fillStyle = 'rgba(64,124,170,0.62)';
    ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
    if (tile(G.world, x, y - 1) !== T.WATER) {
      ctx.fillStyle = 'rgba(210,235,245,0.75)';
      const w = Math.sin(G.clock * 3 + x) * px * 0.6;
      ctx.fillRect(sx, sy + px * 0.6 + w, ts + 0.5, px * 0.7);
    }
    return;
  }
  if (t === T.LADDER) {
    ctx.fillStyle = '#7a522a';
    ctx.fillRect(sx + px, sy, px * 1.2, ts + 0.5);
    ctx.fillRect(sx + ts - px * 2.2, sy, px * 1.2, ts + 0.5);
    ctx.fillStyle = '#b07a46';
    for (let i = 0; i < 2; i++) ctx.fillRect(sx + px, sy + ts * (0.2 + i * 0.5), ts - px * 2, px);
    return;
  }
  if (t === T.PLANK) {
    ctx.fillStyle = '#b07a46';
    ctx.fillRect(sx, sy, ts + 0.5, px * 2.4);
    ctx.fillStyle = '#7a522a';
    ctx.fillRect(sx, sy + px * 2.4, ts + 0.5, px * 0.8);
    ctx.fillRect(sx + px, sy + px * 3.2, px, px * 2);
    ctx.fillRect(sx + ts - px * 2, sy + px * 3.2, px, px * 2);
    return;
  }
  if (t === T.LOG) {
    ctx.fillStyle = '#5b3d22';
    ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
    ctx.fillStyle = '#704b2b';
    ctx.fillRect(sx, sy + ts * (0.2 + 0.4 * hash(x, y)), ts + 0.5, px);
    if (x === ZONES.log[0]) {
      ctx.fillStyle = '#c9a26c';
      ctx.fillRect(sx, sy + px, px * 2, ts - px * 2);
    }
    return;
  }
  const cols = TILE_COL[t];
  ctx.fillStyle = cols[0];
  ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
  for (let i = 0; i < 4; i++) {
    const h = hash(x * 7 + i, y * 13 - i);
    ctx.fillStyle = cols[1 + (i % 2)];
    ctx.fillRect(sx + Math.floor(h * 7) * px, sy + Math.floor(hash(y + i, x - i) * 7) * px, px * 2, px);
  }
  // 바깥으로 드러난 모서리는 짙게
  ctx.fillStyle = cols[3];
  if (openAt(x - 1, y)) ctx.fillRect(sx, sy, px, ts + 0.5);
  if (openAt(x + 1, y)) ctx.fillRect(sx + ts - px, sy, px, ts + 0.5);
  if (openAt(x, y + 1)) ctx.fillRect(sx, sy + ts - px, ts + 0.5, px);
  if (t === T.GRASS && openAt(x, y - 1) && tile(G.world, x, y - 1) !== T.WATER) {
    ctx.fillStyle = '#5f9a45';
    ctx.fillRect(sx, sy, ts + 0.5, px * 2.2);
    ctx.fillStyle = '#7dbb59';
    ctx.fillRect(sx, sy, ts + 0.5, px);
    if (openAt(x - 1, y)) ctx.fillRect(sx, sy, px, px * 3);
    if (openAt(x + 1, y)) ctx.fillRect(sx + ts - px, sy, px, px * 3);
  } else if (openAt(x, y - 1)) {
    ctx.fillStyle = cols[2];
    ctx.fillRect(sx, sy, ts + 0.5, px * 0.8);
  }
  if (t === T.ROOT) {
    const p = G.props.find((q) => q.x === x && q.y === y);
    if (p && isExposed(G.world, x, y)) drawSprite(ctx, p.type === 'kudzu' ? 'kudzuRoot' : 'bellflowerRoot', sx, sy, px);
  }
  if (t === T.POT) drawSprite(ctx, 'pot', sx - px * 0.5, sy - px * 0.5, px);
}

const CLOUDS = Array.from({ length: 9 }, (_, i) => ({ x: i * 29 + hash(i, 1) * 20, y: 5 + hash(i, 2) * 9, w: 4 + hash(i, 3) * 5 }));

function drawBackground(f) {
  const { cw, ch, ts } = view;
  const [top, bottom] = skyAt(f);
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);
  const sunX = cw * (0.1 + 0.8 * f), sunY = ch * (0.3 - Math.sin(Math.PI * f) * 0.2);
  ctx.fillStyle = f > 0.85 ? 'rgba(255,176,112,0.35)' : 'rgba(255,241,196,0.35)';
  ctx.beginPath(); ctx.arc(sunX, sunY, ts * 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = f > 0.85 ? '#ffb070' : '#fff1c4';
  ctx.beginPath(); ctx.arc(sunX, sunY, ts * 0.9, 0, Math.PI * 2); ctx.fill();
  // 구름
  ctx.fillStyle = f > 0.85 ? 'rgba(255,214,190,0.75)' : 'rgba(255,255,255,0.78)';
  for (const c of CLOUDS) {
    const x = ((c.x + G.clock * 0.25 - G.cam.x * 0.5) % 270 + 270) % 270 - 15;
    const sx = x * ts * 0.6, sy = (c.y - G.cam.y * 0.15) * ts * 0.6;
    const r = c.w * ts * 0.18;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.arc(sx + r * 1.1, sy - r * 0.35, r * 1.15, 0, Math.PI * 2);
    ctx.arc(sx + r * 2.2, sy, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  const layers = [[0.15, 'rgba(92,110,138,0.45)', 9, 0.5], [0.35, 'rgba(70,96,98,0.55)', 6, 0.62]];
  for (const [par, col, amp, base] of layers) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, ch);
    for (let sx = 0; sx <= cw + 8; sx += 8) {
      const wx = (sx / ts + G.cam.x * par) * 0.35;
      const y = ch * base - (Math.sin(wx * 0.5) + Math.sin(wx * 0.23 + 1.3) * 1.4) * amp * ts * 0.12 - (G.cam.y - 18) * par * ts * 0.4;
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(cw, ch);
    ctx.fill();
  }
}

function drawClinic(ts) {
  const gy = 30;
  const sx = (2 - G.cam.x) * ts, sy = (gy - G.cam.y) * ts;
  const w = 9 * ts;
  if (sx > view.cw || sx + w < 0) return;
  ctx.fillStyle = '#c9b48f';
  ctx.fillRect(sx + ts * 0.3, sy - ts * 0.5, w - ts * 0.6, ts * 0.5);
  ctx.fillStyle = '#efe4cc';
  ctx.fillRect(sx + ts * 0.8, sy - ts * 3.6, w - ts * 1.6, ts * 3.1);
  ctx.fillStyle = '#6b4a2b';
  for (let i = 0; i < 4; i++) ctx.fillRect(sx + ts * (0.8 + i * 2.3), sy - ts * 3.6, ts * 0.25, ts * 3.1);
  ctx.fillRect(sx + ts * 0.8, sy - ts * 3.6, w - ts * 1.6, ts * 0.2);
  ctx.fillStyle = '#d8c7a4';
  ctx.fillRect(sx + ts * 3.6, sy - ts * 2.6, ts * 1.8, ts * 2.1);
  ctx.strokeStyle = '#8a6a44';
  ctx.lineWidth = Math.max(1, ts * 0.06);
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(sx + ts * (3.6 + i * 0.6), sy - ts * 2.6); ctx.lineTo(sx + ts * (3.6 + i * 0.6), sy - ts * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + ts * 3.6, sy - ts * (2.6 - i * 0.7)); ctx.lineTo(sx + ts * 5.4, sy - ts * (2.6 - i * 0.7)); ctx.stroke();
  }
  // 걸어 둔 약초 다발
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ['#6f9a55', '#c9a24a', '#8a9a5a'][i];
    ctx.fillRect(sx + ts * (1.4 + i * 0.6), sy - ts * 2.9, ts * 0.3, ts * 0.8);
  }
  ctx.fillStyle = '#3d4352';
  ctx.beginPath();
  ctx.moveTo(sx - ts * 0.4, sy - ts * 3.4);
  ctx.quadraticCurveTo(sx + w / 2, sy - ts * 4.2, sx + w + ts * 0.4, sy - ts * 3.4);
  ctx.lineTo(sx + w - ts * 1.2, sy - ts * 5.1);
  ctx.lineTo(sx + ts * 1.2, sy - ts * 5.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2b303c';
  ctx.fillRect(sx + ts * 1.2, sy - ts * 5.3, w - ts * 2.4, ts * 0.3);
  ctx.fillRect(sx + ts * 3.2, sy - ts * 3.45, ts * 2.6, ts * 0.75);
  ctx.fillStyle = '#e8c766';
  ctx.font = `${Math.round(ts * 0.5)}px "Song Myung", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('화타 의원', sx + ts * 4.5, sy - ts * 3.07);
  // 처마 등불
  const glow = 0.5 + Math.sin(G.clock * 3) * 0.1;
  ctx.fillStyle = `rgba(255,190,90,${glow})`;
  ctx.beginPath(); ctx.arc(sx + ts * 7.4, sy - ts * 2.9, ts * 0.32, 0, Math.PI * 2); ctx.fill();
}

function drawBigTree(ts) {
  const base = 24;
  const sx = (BIG_TREE_X - G.cam.x) * ts, sy = (base - G.cam.y) * ts;
  if (sx < -ts * 8 || sx > view.cw + ts * 8) return;
  ctx.fillStyle = '#5a3d24';
  ctx.fillRect(sx - ts * 0.2, sy - ts * 11, ts * 1.4, ts * 11);
  ctx.fillStyle = '#6e4c2e';
  ctx.fillRect(sx + ts * 0.1, sy - ts * 11, ts * 0.3, ts * 11);
  ctx.fillRect(sx + ts * 1, sy - ts * 9, ts * 2.4, ts * 0.4);
  ctx.fillRect(sx - ts * 2, sy - ts * 10, ts * 2, ts * 0.4);
  const sway = Math.sin(G.clock * 0.8) * ts * 0.08;
  const blobs = [[0.5, -13, 4.2], [-2.5, -11.5, 3], [3.5, -11.3, 3.2], [0.5, -10.5, 3.6], [-1, -15, 2.5], [2.5, -14.5, 2.6]];
  for (const [i, [bx, by, r]] of blobs.entries()) {
    ctx.fillStyle = i % 2 ? '#3f6e3a' : '#4d7f43';
    ctx.beginPath();
    ctx.arc(sx + bx * ts + sway, sy + by * ts, r * ts, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDecor(x0, x1, ts) {
  // 풀잎과 들꽃이 바람에 흔들린다
  const px = ts / 8;
  for (let x = x0; x <= x1; x++) {
    const y = surfaceY(G.world, x);
    if (tile(G.world, x, y) !== T.GRASS || tile(G.world, x, y - 1) !== T.AIR) continue;
    const sx = (x - G.cam.x) * ts, sy = (y - G.cam.y) * ts;
    const n = 1 + Math.floor(hash(x, 7) * 3);
    for (let i = 0; i < n; i++) {
      const bx = sx + (hash(x, i) * 0.8 + 0.1) * ts;
      const hgt = (2 + hash(i, x) * 3) * px;
      const sw = Math.sin(G.clock * 2 + x * 0.7 + i) * px * 0.8;
      ctx.strokeStyle = i % 2 ? '#6aa04f' : '#82c062';
      ctx.lineWidth = px * 0.8;
      ctx.beginPath();
      ctx.moveTo(bx, sy);
      ctx.lineTo(bx + sw, sy - hgt);
      ctx.stroke();
    }
    if (x >= 56 && x <= 120 && hash(x, 99) < 0.25) {
      ctx.fillStyle = ['#f2c94c', '#e9e1f3', '#e88aa0'][Math.floor(hash(x, 5) * 3)];
      const sw = Math.sin(G.clock * 2 + x) * px;
      ctx.fillRect(sx + ts * 0.6 + sw - px, sy - px * 5, px * 2, px * 2);
    }
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
  G.cam.x = lerp(G.cam.x, target.x, 0.18);
  G.cam.y = lerp(G.cam.y, target.y, 0.12);
  const shake = G.shake > 0 ? (Math.random() - 0.5) * 0.15 : 0;
  const cam = G.cam;
  cam.x += shake;
  const f = clamp(G.time / DAY_SECONDS, 0, 1);
  ctx.imageSmoothingEnabled = false;
  drawBackground(f);
  drawClinic(ts);
  drawBigTree(ts);

  const x0 = Math.max(0, Math.floor(cam.x) - 1), x1 = Math.min(W - 1, Math.ceil(cam.x + viewW));
  const y0 = Math.max(0, Math.floor(cam.y) - 1), y1 = Math.min(H - 1, Math.ceil(cam.y + viewH));
  for (let x = x0; x <= x1; x++) {
    const ground = groundTop(x);
    for (let y = y0; y <= y1; y++) {
      const t = tile(G.world, x, y);
      const sx = (x - cam.x) * ts, sy = (y - cam.y) * ts;
      if (t === T.AIR || t === T.LADDER || t === T.WATER || t === T.PLANK) {
        if (y >= ground && t !== T.WATER) { // 파낸 자리: 흙벽
          ctx.fillStyle = (x + y) % 2 ? '#3b2a1d' : '#38281b';
          ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
        }
        if (t !== T.AIR) drawTile(t, x, y, sx, sy, ts);
        continue;
      }
      drawTile(t, x, y, sx, sy, ts);
    }
  }
  drawDecor(x0, x1, ts);
  drawProps(ts);
  drawEnts(ts);
  drawPlayer(ts);
  drawArrows(ts);
  drawParts(ts);
  drawShade(x0, y0, x1, y1, ts);
  drawOverlays(ts);
  if (f > 0.82) drawDusk(f);
  cam.x -= shake;
}

function drawShade(x0, y0, x1, y1, ts) {
  const pc = playerCenter();
  const L = computeLight(G.world, x0, y0, x1, y1, [{ x: pc.x - 0.5, y: pc.y - 0.5, r: 0.75 }]);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  if (shadeCvs.width !== w || shadeCvs.height !== h) { shadeCvs.width = w; shadeCvs.height = h; }
  const img = shadeCtx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = (1 - L.at(x0 + x, y0 + y)) * 0.93;
      const i = (y * w + x) * 4;
      img.data[i] = 10; img.data[i + 1] = 7; img.data[i + 2] = 5;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  shadeCtx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(shadeCvs, (x0 - G.cam.x) * ts, (y0 - G.cam.y) * ts, w * ts, h * ts);
  ctx.imageSmoothingEnabled = false;
}

function drawDusk(f) {
  const { cw, ch, ts } = view;
  ctx.fillStyle = `rgba(30,20,50,${(f - 0.82) * 2})`;
  ctx.fillRect(0, 0, cw, ch);
  // 반딧불
  for (let i = 0; i < 14; i++) {
    const wx = Math.floor(G.cam.x) + hash(i, 3) * (cw / ts);
    const wy = G.player.y - 2 + hash(i, 4) * 5;
    const sx = (wx - G.cam.x + Math.sin(G.clock * 0.7 + i) * 0.8) * ts;
    const sy = (wy - G.cam.y + Math.cos(G.clock * 0.9 + i * 2) * 0.6) * ts;
    const a = 0.4 + 0.6 * Math.max(0, Math.sin(G.clock * 2 + i));
    ctx.fillStyle = `rgba(214,255,140,${a * 0.35})`;
    ctx.beginPath(); ctx.arc(sx, sy, ts * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(234,255,180,${a})`;
    ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
  }
}

// 처음 지도의 땅 높이(파낸 구멍 뒤에 흙벽을 그리려고)
const groundCache = [];
let pristine = null;
function groundTop(x) {
  if (groundCache[x] === undefined) groundCache[x] = surfaceY((pristine ??= makeWorld()), x);
  return groundCache[x];
}

function drawProps(ts) {
  const px = ts / 8;
  for (const p of G.props) {
    const sx = (p.x - G.cam.x) * ts, sy = (p.y - G.cam.y) * ts;
    if (sx < -ts * 3 || sx > view.cw + ts * 3) continue;
    if (ROOTS.has(p.type)) {
      if (tile(G.world, p.x, p.y) !== T.ROOT) continue;
      const top = surfaceY(G.world, p.x) - 1;
      if (!isExposed(G.world, p.x, p.y) && top < p.y) drawSprite(ctx, 'sprout', sx + px, (top - G.cam.y) * ts + ts - 4 * px, px);
      continue;
    }
    if (p.type === 'npc') {
      const big = p.sprite === 'zhangfei' ? 1.15 : p.sprite === 'child' ? 0.8 : 1;
      const q = px * big * 1.125;
      drawSprite(ctx, p.sprite, sx + ts / 2 - 5 * q, sy + ts - 16 * q, q, true);
      const bob = Math.sin(G.clock * 4) * px;
      ctx.fillStyle = '#ffd76a';
      ctx.strokeStyle = '#2a2118';
      ctx.lineWidth = Math.max(2, px * 0.7);
      ctx.font = `bold ${Math.round(ts * 0.9)}px "Gowun Dodum", sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeText('!', sx + ts / 2, sy + ts - 17 * q + bob);
      ctx.fillText('!', sx + ts / 2, sy + ts - 17 * q + bob);
      continue;
    }
    if (p.type === 'tree') {
      const shakeX = G.chop?.prop === p ? Math.sin(G.clock * 40) * px * 0.6 : 0;
      drawSprite(ctx, 'tree', sx + shakeX - px * 2, sy + ts - 12 * px * 1.8, px * 1.8);
      continue;
    }
    if (p.type === 'beehive') { drawSprite(ctx, 'beehive', sx, sy + Math.sin(G.clock * 2) * px * 0.3, px * 1.1); continue; }
    if (p.type === 'cicada') { drawSprite(ctx, 'cicada', sx + 2 * px, sy + 2 * px, px); continue; }
    if (p.type === 'sign') { drawSprite(ctx, 'sign', sx, sy, px); continue; }
    if (p.type === 'bottle') { drawSprite(ctx, 'bottle', sx + 2 * px, sy + 2 * px, px); continue; }
    const sw = Math.sin(G.clock * 2 + p.x) * px * 0.4;
    drawSprite(ctx, p.type, sx + sw, sy, px);
    if (p.type === 'clover' || (G.s.luck > 0 && HERBS.has(p.type))) {
      ctx.fillStyle = `rgba(255,236,150,${0.5 + Math.sin(G.clock * 5 + p.x) * 0.4})`;
      ctx.fillRect(sx + ts * hash(p.x, 1), sy + ts * hash(p.x, 2) * 0.5, px, px);
    }
  }
}

function drawEnts(ts) {
  const px = ts / 8;
  for (const e of G.ents) {
    const sx = (e.x - G.cam.x) * ts, sy = (e.y - G.cam.y) * ts;
    if (sx < -ts * 2 || sx > view.cw + ts * 2) continue;
    if (e.type === 'rabbit' || e.type === 'whiteRabbit') {
      const frame = !e.onGround ? '2' : '';
      drawSprite(ctx, e.type + frame, sx - px * 0.5, sy + e.h * ts - 7 * px, px, (e.face ?? 1) < 0);
    } else if (e.type === 'pheasant') {
      if (e.state === 'hide') {
        drawSprite(ctx, 'pheasant', sx, sy + e.h * ts - 7 * px, px, false);
        ctx.fillStyle = '#5f9a45';
        for (let i = 0; i < 5; i++) ctx.fillRect(sx + i * 2 * px, sy + e.h * ts - (3 + (i % 2) * 2) * px, px, (3 + (i % 2) * 2) * px);
      } else drawSprite(ctx, 'pheasantFly', sx, sy + Math.sin(G.clock * 20) * px, px, e.face < 0);
    } else if (e.type === 'hive') drawSprite(ctx, 'beehive', sx, sy, px * 1.1);
    else if (e.type === 'drop') drawSprite(ctx, e.item, sx, sy + Math.sin(G.clock * 4) * px * 0.5, px * 1.2);
    else if (e.type === 'bees') {
      for (let i = 0; i < 6; i++) {
        const a = G.clock * 9 + i * 1.7;
        drawSprite(ctx, 'bee', sx + ts * 0.45 + Math.cos(a) * ts * 0.45, sy + ts * 0.45 + Math.sin(a * 1.3) * ts * 0.4, px);
      }
    }
  }
}

const TOOL_SPRITE = { hand: null, hoe: 'hoe', bow: 'bowIcon', ladder: 'ladderIcon', plank: 'plankIcon', dirt: 'dirt' };

function drawPlayer(ts) {
  const p = G.player;
  const sx = (p.x - G.cam.x) * ts, sy = (p.y - G.cam.y) * ts;
  const scale = (p.h * ts) / 16;
  let frame = 'hwata';
  let bob = 0;
  if (p.climbing) frame = Math.floor(p.y * 3) % 2 ? 'hwata2' : 'hwata';
  else if (!p.onGround) frame = 'hwata2';
  else if (p.walkT) { frame = Math.floor(p.walkT * 9) % 2 ? 'hwata2' : 'hwata'; bob = Math.abs(Math.sin(p.walkT * 14)) * scale * 0.6; }
  else bob = Math.sin(G.clock * 2.5) > 0.6 ? scale * 0.3 : 0;
  const cx = sx + (p.w * ts) / 2;
  drawSprite(ctx, frame, cx - 5 * scale, sy - bob, scale, p.face < 0);
  // 손에 든 도구
  const tool = TOOL_SPRITE[G.mode];
  if (tool && !p.climbing) {
    const handX = cx + p.face * 3.5 * scale, handY = sy + 9 * scale - bob;
    const ang = p.swing > 0 ? Math.sin((p.swing / 0.25) * Math.PI) * 1.4 : 0.3;
    ctx.save();
    ctx.translate(handX, handY);
    if (p.face < 0) ctx.scale(-1, 1);
    ctx.rotate(G.mode === 'hoe' ? -ang : G.mode === 'bow' ? 0 : -0.2);
    const s = scale * (G.mode === 'bow' ? 0.9 : 0.7);
    drawSprite(ctx, tool, -1 * s, -6 * s, s);
    ctx.restore();
  }
}

function drawArrows(ts) {
  ctx.lineWidth = Math.max(2, ts * 0.07);
  for (const a of G.arrows) {
    const sx = (a.x - G.cam.x) * ts, sy = (a.y - G.cam.y) * ts;
    const len = Math.hypot(a.vx, a.vy) || 1;
    const dx = (a.vx / len) * ts * 0.8, dy = (a.vy / len) * ts * 0.8;
    ctx.strokeStyle = a.type === 'net' ? '#d8e2e6' : '#e9d7b0';
    ctx.beginPath(); ctx.moveTo(sx - dx, sy - dy); ctx.lineTo(sx, sy); ctx.stroke();
    if (a.type === 'net') {
      ctx.fillStyle = 'rgba(216,226,230,0.8)';
      ctx.fillRect(sx - ts * 0.15, sy - ts * 0.15, ts * 0.3, ts * 0.3);
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
}

function drawOverlays(ts) {
  const px = ts / 8;
  const pc = playerCenter();
  // 손 닿는 범위와 겨눈 칸
  const c = (G.mode !== 'hand' && G.mode !== 'bow') ? cursorTile() : null;
  if (c) {
    ctx.strokeStyle = 'rgba(255,246,216,0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc((pc.x - G.cam.x) * ts, (pc.y - G.cam.y) * ts, REACH * ts, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    const sx = (c.x - G.cam.x) * ts, sy = (c.y - G.cam.y) * ts;
    let ok = inReach(c.x, c.y);
    if (G.mode === 'hoe') ok = ok && canDig(G.world, c.x, c.y);
    else if (PLACE_TILE[G.mode]) {
      ok = placeCheck(c.x, c.y).ok;
      ctx.globalAlpha = 0.55;
      drawSprite(ctx, TOOL_SPRITE[G.mode], sx, sy, px);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = ok ? '#bff0a0' : '#ff8a78';
    ctx.lineWidth = Math.max(2, px * 0.6);
    ctx.strokeRect(sx + 1, sy + 1, ts - 2, ts - 2);
  }
  // 금 간 흙
  if (G.mine) {
    const m = G.mine;
    const sx = (m.x - G.cam.x) * ts, sy = (m.y - G.cam.y) * ts;
    const stage = Math.min(3, Math.floor((m.t / m.need) * 4));
    ctx.strokeStyle = 'rgba(20,12,6,0.85)';
    ctx.lineWidth = px * 0.7;
    const cracks = [[[0.5, 0.5, 0.2, 0.25], [0.5, 0.5, 0.8, 0.35]], [[0.5, 0.5, 0.35, 0.85], [0.2, 0.25, 0.1, 0.5]], [[0.8, 0.35, 0.9, 0.8], [0.5, 0.5, 0.7, 0.9]]];
    for (let i = 0; i < stage; i++) {
      for (const [a, b, c2, d] of cracks[i]) {
        ctx.beginPath(); ctx.moveTo(sx + a * ts, sy + b * ts); ctx.lineTo(sx + c2 * ts, sy + d * ts); ctx.stroke();
      }
    }
  }
  if (G.chop) {
    const p = G.chop.prop;
    const sx = (p.x - G.cam.x) * ts, sy = (p.y - G.cam.y) * ts;
    ctx.fillStyle = 'rgba(20,16,12,0.5)';
    ctx.fillRect(sx, sy + ts + 3, ts, 5);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(sx, sy + ts + 3, ts * (G.chop.t / G.chop.dur), 5);
  }
  if (G.aim) {
    const dx = G.aim.x - pc.x, dy = G.aim.y - (pc.y - 0.3);
    const len = Math.hypot(dx, dy) || 1;
    const speed = G.s.upgrades.bow ? 27 : 18;
    let x = pc.x, y = pc.y - 0.3, vx = (dx / len) * speed, vy = (dy / len) * speed;
    for (let i = 0; i < 26; i++) {
      for (let k = 0; k < 2; k++) { vy += arrowGravity() * 0.02; x += vx * 0.02; y += vy * 0.02; }
      if (isSolid(G.world, Math.floor(x), Math.floor(y))) break;
      ctx.fillStyle = `rgba(255,246,216,${0.9 - i * 0.03})`;
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
  // 바구니로 날아가는 아이콘(화면 좌표)
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
  $('hudDay').textContent = `${s.day}일째`;
  $('hudZone').textContent = ZONE_NAMES[G.zone] ?? '';
  const left = Math.max(0, DAY_SECONDS - G.time);
  $('sunFill').style.width = `${(left / DAY_SECONDS) * 100}%`;
  $('sunFill').classList.toggle('late', left < 30);
  $('staminaFill').style.width = `${(s.stamina / maxStamina(s)) * 100}%`;
  $('hudStamina').textContent = s.stamina;
  const wt = basketWeight(s);
  $('hudWeight').textContent = `${wt}/${carryLimit(s)}`;
  $('hudWeight').classList.toggle('over', wt > carryLimit(s));
  $('slotCount-bow').textContent = s.arrows;
  $('slotCount-ladder').textContent = count(s, 'wood');
  $('slotCount-plank').textContent = count(s, 'wood');
  $('slotCount-dirt').textContent = count(s, 'dirt');
  $('hudMoney').textContent = s.money;
  $('homeBtn').hidden = G.player.x > 14;
  drawMinimap();
}

const MINI_COLORS = { clinic: '#c9b48f', path: '#9bb36a', field: '#d9c25a', stream: '#6ea7c9', hill: '#7f9a56', forest: '#4f7542' };

function drawMinimap() {
  const m = $('minimap');
  const g = m.getContext('2d');
  const w = m.width, h = m.height;
  g.clearRect(0, 0, w, h);
  for (const [k, [a, b]] of Object.entries(ZONES)) {
    if (k === 'log') continue;
    g.fillStyle = MINI_COLORS[k];
    g.fillRect((a / W) * w, h * 0.35, ((b - a + 1) / W) * w, h * 0.3);
  }
  g.fillStyle = '#5b3d22';
  g.fillRect((ZONES.log[0] / W) * w, h * 0.2, ((ZONES.log[1] - ZONES.log[0] + 1) / W) * w, h * 0.6);
  for (const p of G.props) {
    if (p.type !== 'npc') continue;
    g.fillStyle = '#ffd76a';
    g.fillRect((p.x / W) * w - 2, 0, 4, h * 0.3);
  }
  g.fillStyle = '#fff';
  g.fillRect((G.player.x / W) * w - 2, h * 0.15, 4, h * 0.7);
}

// ---------- 밤: 한의원 ----------

function openNight() {
  const s = G.s;
  s.phase = 'night';
  save();
  $('dayui').hidden = true;
  $('night').hidden = false;
  $('night').scrollTop = 0;
  renderPrep();
}

const ico = (key, cls = '') => `<img class="ico ${cls}" src="${iconURL(key)}" alt="">`;

function recipeLine(id, mult = 1) {
  return Object.entries(RECIPES[id].inputs).map(([k, n]) => `${ico(k)}${MATERIALS[k].name} ${n * mult}`).join(' + ');
}

function unlockText(id) {
  const u = RECIPES[id].unlock;
  if (u === 'quest1') return '나무꾼을 도우면 배움';
  return `${u.day}일째부터`;
}

function invList(s) {
  const rows = Object.entries(s.inv).filter(([, v]) => v.n > 0);
  if (!rows.length) return '<p class="muted">바구니가 비었습니다.</p>';
  return `<ul class="inv">${rows.map(([id, v]) => `<li>${ico(id)}<span>${MATERIALS[id].name}</span><b>${v.n}</b>${v.hq ? `<em>상급 ${v.hq}</em>` : ''}</li>`).join('')}</ul>`;
}

function notebook(s) {
  const dexIds = Object.keys(MATERIALS).filter((id) => MATERIALS[id].weight > 0 || ['cicada', 'feather', 'clover'].includes(id));
  const found = dexIds.filter((id) => s.dex?.[id]).length;
  const pages = [1, 2, 3].map((n) => (hasPage(s, n)
    ? `<li class="got">${ico('page')}<div><b>${PAGES[n].name}</b><span>${PAGES[n].perk}</span></div></li>`
    : `<li>${ico('page', 'dim')}<div><b>청낭서 ${n}장</b><span>땅속 어딘가의 항아리</span></div></li>`)).join('');
  const dex = dexIds.map((id) => `<li class="${s.dex?.[id] ? 'got' : ''}">${ico(id, s.dex?.[id] ? '' : 'dim')}<span>${s.dex?.[id] ? MATERIALS[id].name : '?'}</span></li>`).join('');
  return `<div><h4>수첩 · 청낭서</h4><ul class="pages">${pages}</ul></div><div><h4>재료 도감 ${found}/${dexIds.length}</h4><ul class="dex">${dex}</ul></div>`;
}

function renderPrep() {
  const s = G.s;
  const meds = RECIPE_ORDER.map((id) => {
    const r = RECIPES[id];
    const m = s.meds[id];
    if (!m) {
      const unlocked = isUnlocked(s, id);
      return `<article class="med ${unlocked ? '' : 'locked'}">
        <header>${ico(r.main, 'lg')}<h3>${r.name}</h3><span class="tag">${unlocked ? '개발 전' : '잠김'}</span></header>
        <p class="cures">${r.cures}</p>
        <p class="recipe">${unlocked ? `처음 개발: ${recipeLine(id, 2)}` : unlockText(id)}</p>
        ${unlocked ? `<button data-act="develop" data-id="${id}" ${canDevelop(s, id) ? '' : 'disabled'}>개발하기</button>` : ''}
      </article>`;
    }
    const inMenu = s.menu.includes(id);
    return `<article class="med ${inMenu ? 'menu' : ''}">
      <header>${ico(r.main, 'lg')}<h3>${r.name}</h3><span class="tag lv">${m.level}단계</span></header>
      <p class="cures">${r.cures}</p>
      <p class="recipe">${recipeLine(id)} → 3첩 · 한 첩 ${medPrice(s, id, false)}냥</p>
      <p class="doses">달여 둔 약 <b>${m.doses.n}</b>첩${m.doses.hq ? ` (상급 ${m.doses.hq})` : ''}</p>
      <div class="row">
        <button data-act="brew" data-id="${id}" ${canBrew(s, id) ? '' : 'disabled'}>달이기 +3첩</button>
        <button data-act="upgrade" data-id="${id}" ${canUpgradeMed(s, id) ? '' : 'disabled'}>${m.level >= MAX_MED_LEVEL ? '최고 단계' : `강화 (${MATERIALS[r.main].name} ${MED_UPGRADE_MAIN})`}</button>
        <button data-act="menu" data-id="${id}" class="${inMenu ? 'on' : ''}">${inMenu ? '처방 목록에서 빼기' : '처방 목록에 넣기'}</button>
      </div>
    </article>`;
  }).join('');
  const shop = Object.entries(UPGRADES).map(([k, u]) => {
    const items = Object.entries(u.items).map(([id, n]) => `${ico(id)}${MATERIALS[id].name} ${n}`).join(', ');
    const icon = { basket: 'bag', hoe: 'hoe', bow: 'bowIcon' }[k];
    return `<li>${ico(icon, 'lg')}<div><b>${u.name}</b><span>${u.desc}</span><small>${u.money}냥 + ${items}</small></div>
      <button data-act="buy" data-id="${k}" ${canBuyUpgrade(s, k) ? '' : 'disabled'}>${s.upgrades[k] ? '완료' : '맞추기'}</button></li>`;
  }).join('');
  const menuNames = s.menu.map((id) => RECIPES[id].name).join(', ') || '없음';
  $('nightBody').innerHTML = `
    <section class="nighthead">
      <div><p class="eyebrow">${s.day}일째 밤</p><h2>화타 의원</h2></div>
      <dl class="stats"><div><dt>엽전</dt><dd>${ico('coin')}${s.money}냥</dd></div><div><dt>평판</dt><dd>${s.rep}</dd></div><div><dt>오늘 올 환자</dt><dd>${expectedPatients()}명</dd></div></dl>
    </section>
    <canvas class="scene" id="scene" aria-label="한의원 안"></canvas>
    <section><h4>약장</h4><p class="muted">오늘 낼 약은 최대 ${MAX_MENU}가지(지금: ${menuNames}). 약은 미리 달여 두어야 팔 수 있습니다.</p><div class="meds">${meds}</div></section>
    <section class="two">
      <div><h4>대장간</h4><ul class="shop">${shop}
        <li>${ico('arrowIcon', 'lg')}<div><b>화살 ${ARROW_PACK.count}발</b><span>지금 ${s.arrows}발</span><small>${ARROW_PACK.money}냥</small></div><button data-act="arrows" ${s.money >= ARROW_PACK.money ? '' : 'disabled'}>사기</button></li>
        <li>${ico('feather', 'lg')}<div><b>화살 ${ARROW_CRAFT.count}발 만들기</b><span>깃털 1 + 나무 1</span><small>직접 만들기</small></div><button data-act="craft" ${count(s, 'feather') && count(s, 'wood') ? '' : 'disabled'}>만들기</button></li>
      </ul></div>
      <div><h4>바구니와 창고</h4>${invList(s)}</div>
    </section>
    <section class="two">${notebook(s)}</section>
    <div class="go"><button class="primary big" data-act="open">영업 시작</button></div>`;
  G.sceneMode = 'prep';
}

const expectedPatients = () => patientsForDay(G.s) + (G.s.flags.earlyBonus ? 2 : 0) + (G.s.flags.zhangfeiVisit && !G.s.flags.zhangfei ? 1 : 0);

function onNightClick(e) {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  unlockAudio();
  const s = G.s, id = b.dataset.id;
  const act = b.dataset.act;
  if (act === 'develop') { if (develop(s, id).ok) { sfx.page(); toast(`${RECIPES[id].name} 개발 완료!`, 'good'); } }
  else if (act === 'brew') { const r = brew(s, id); if (r.ok) { sfx.bubble(); toast(`${RECIPES[id].name} 3첩${r.hq ? ' (상급)' : ''}`, 'good'); } }
  else if (act === 'upgrade') { if (upgradeMed(s, id).ok) { sfx.pickHq(); toast(`${RECIPES[id].name} ${s.meds[id].level}단계`, 'good'); } }
  else if (act === 'menu') {
    sfx.click();
    if (s.menu.includes(id)) s.menu = s.menu.filter((x) => x !== id);
    else if (s.menu.length >= MAX_MENU) toast(`처방 목록은 ${MAX_MENU}가지까지입니다`, 'bad');
    else s.menu.push(id);
  } else if (act === 'buy') { if (buyUpgrade(s, id).ok) { sfx.coin(); toast(`${UPGRADES[id].name}을(를) 새로 맞췄습니다`, 'good'); } }
  else if (act === 'arrows') { if (buyArrows(s).ok) sfx.coin(); }
  else if (act === 'craft') { if (craftArrows(s).ok) sfx.place(); }
  else if (act === 'open') return startService();
  else if (act === 'serve') return pickMed(id);
  else if (act === 'fire') return stopBrew();
  else if (act === 'send') return sendAway();
  else if (act === 'sleep') return sleep();
  else if (act === 'restart') return restart();
  if (s.phase === 'night' && !G.night) {
    const y = $('night').scrollTop;
    renderPrep();
    $('night').scrollTop = y;
  }
}

function startService() {
  const s = G.s;
  if (!s.menu.length) return toast('처방 목록에 약을 하나 이상 넣으세요', 'bad');
  sfx.bell();
  const rng = mulberry32(G.seed + s.day * 31337);
  const total = patientsForDay(s) + (s.flags.earlyBonus ? 2 : 0);
  const types = Array.from({ length: total }, () => pickPatientType(s, rng));
  if (s.flags.zhangfeiVisit && !s.flags.zhangfei) types.unshift('zhangfei');
  G.night = { t: 0, types, queue: [], spawnT: 0, interval: (NIGHT_SECONDS - 30) / types.length, brewing: null, earned: 0, stars: 0, served: 0, wrong: 0, left: 0, next: 1, steam: [], bubbleT: 0 };
  const wide = hasPage(s, 2);
  $('night').scrollTop = 0;
  $('nightBody').innerHTML = `
    <section class="service">
      <div class="svtop"><div class="bar"><i id="nightFill"></i></div><span id="svMoney"></span></div>
      <canvas class="scene" id="scene" aria-label="한의원 안"></canvas>
      <div class="front" id="front"></div>
      <div class="brew" id="brew" hidden>
        <p id="brewName"></p>
        <div class="gauge"><span style="flex:28" class="z1"></span><span style="flex:${wide ? 10 : 14}" class="z2"></span><span style="flex:${wide ? 24 : 16}" class="z3"></span><span style="flex:${wide ? 10 : 14}" class="z2"></span><span style="flex:28" class="z1"></span><i id="needle"></i></div>
        <button class="primary big" data-act="fire">불을 끈다</button>
      </div>
      <div class="medbar" id="medbar"></div>
    </section>`;
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
    return `<button data-act="serve" data-id="${id}" ${d.n > 0 && front && !n.brewing ? '' : 'disabled'}>
      <b>${ico(RECIPES[id].main)}${RECIPES[id].name}</b><span>${RECIPES[id].cures}</span><small>${d.n}첩 남음</small></button>`;
  }).join('') + `<button class="ghost" data-act="send" ${front && !n.brewing ? '' : 'disabled'}><b>돌려보내기</b><span>맞는 약이 없을 때</span></button>`;
}

function renderQueue() {
  const n = G.night;
  const front = n.queue[0];
  const fr = $('front');
  if (!front) {
    fr.innerHTML = `<p class="empty">${n.types.length ? '다음 환자를 기다리는 중...' : '오늘 환자를 모두 보았습니다.'}</p>`;
    return;
  }
  const P = PATIENTS[front.type];
  const clue = { drunk: '코끝이 빨갛고 술 냄새가 난다.', scholar: '눈이 벌겋게 충혈되어 있다.', farmer: '손에 피 묻은 천을 감고 있다.', elder: '연신 목을 가다듬는다.', child: '배를 움켜쥐고 있다.' }[front.type];
  fr.innerHTML = `<div class="bubble"><b>${P.name}</b><p>"${P.line}"</p>${clue ? `<small>${clue}</small>` : ''}</div>`;
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
  $('svMoney').textContent = `오늘 ${n.earned}냥 · 별 ${n.stars}`;
  const done = !n.types.length && !n.queue.length;
  if ((n.t >= NIGHT_SECONDS || done) && !n.brewing) endService();
}

// 한의원 안: 약장, 걸어 둔 약초, 화타, 줄 선 환자들
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
  const u = h / 30;
  g.fillStyle = '#e9dcc0';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#d8c7a4';
  for (let x = 0; x < w; x += u * 6) g.fillRect(x, 0, u * 0.3, h * 0.72);
  g.fillStyle = '#6b4a2b';
  g.fillRect(0, h * 0.72, w, h * 0.28);
  g.fillStyle = '#5a3d24';
  g.fillRect(0, h * 0.72, w, u * 0.6);
  // 약장 서랍
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
  // 천장에 걸린 약초
  for (let i = 0; i < 6; i++) {
    const x = cabW + u * 4 + i * u * 6;
    if (x > w * 0.7) break;
    g.strokeStyle = '#8a6a44';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, u * 3); g.stroke();
    g.fillStyle = ['#6f9a55', '#c9a24a', '#8a9a5a'][i % 3];
    g.fillRect(x - u, u * 3, u * 2, u * 4 + Math.sin(G.clock + i) * u * 0.2);
  }
  // 등불
  const lx = w * 0.5, ly = u * 5;
  const glow = g.createRadialGradient(lx, ly, 0, lx, ly, u * 14);
  glow.addColorStop(0, 'rgba(255,200,110,0.45)');
  glow.addColorStop(1, 'rgba(255,200,110,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#b8432f';
  g.fillRect(lx - u, ly - u * 1.4, u * 2, u * 2.8);
  // 화타와 약탕기
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
  // 조수 장비는 문간을 지킨다
  if (G.s.flags.zhangfei) drawSpriteOn(g, 'zhangfei', w - u * 13, base - 16 * sc * 1.1, sc * 1.1, true);
  // 손님
  if (n) {
    n.queue.forEach((q, i) => {
      const slot = i === 0 ? potX + u * 5 : potX + u * 10 + i * u * 6;
      const x = slot + q.walk * u * 20;
      if (x > w) return;
      const s = i === 0 ? sc : sc * 0.85;
      const big = q.type === 'zhangfei' ? 1.15 : q.type === 'child' ? 0.8 : 1;
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

function endService() {
  const n = G.night, s = G.s;
  G.night = null;
  sfx.bell();
  const left = n.queue.length + n.types.length;
  const body = [
    `번 돈 ${n.earned}냥 · 별 ${n.stars}개`,
    `제대로 고친 환자 ${n.served}명${n.wrong ? ` · 잘못 준 약 ${n.wrong}번` : ''}${n.left + left ? ` · 그냥 돌아간 환자 ${n.left + left}명` : ''}`,
    `지금 엽전 ${s.money}냥 · 평판 ${s.rep}`,
  ];
  if (s.flags.zhangfei && !s.flags.zhangfeiNoted) { s.flags.zhangfeiNoted = true; body.push('', '장비가 한의원 일을 돕기로 했다. 줄 선 환자들이 더 오래 기다려 준다.'); }
  $('nightBody').innerHTML = `<section class="summary"><p class="eyebrow">${s.day}일째 밤 영업 끝</p><h2>오늘의 진료</h2>
    ${body.map((l) => (l ? `<p>${l}</p>` : '<hr>')).join('')}
    <div class="go"><button class="primary big" data-act="sleep">${s.day >= DAYS ? '1부를 마친다' : '잠자리에 든다'}</button></div></section>`;
  G.sceneMode = null;
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
  $('nightBody').innerHTML = `<section class="summary ending"><p class="eyebrow">시제품 1 · 마을 뒷들</p><h2>1부 끝</h2>
    <p>일주일 동안 한의원을 꾸렸습니다. 엽전 ${s.money}냥, 평판 ${s.rep}.</p>
    <p>익힌 약: ${meds}</p>
    <p>청낭서 ${(s.pages ?? []).length}/3장 · 재료 도감 ${Object.keys(s.dex ?? {}).length}가지</p>
    <p>${s.flags.zhangfei ? '장비가 조수로 들어왔습니다. "형님들께도 의원 양반 얘기를 해 두겠소!"' : '개울가의 큰 사내는 끝내 한의원에 오지 않았습니다. 다음에는 칡즙을 미리 달여 두세요.'}</p>
    <hr><p>다음 이야기: 쓰러진 나무 너머 대나무 숲. 도끼, 첫 보스 「외눈 멧돼지」, 유비 삼형제가 기다립니다.</p>
    <div class="go"><button class="primary big" data-act="restart">처음부터 다시</button></div></section>`;
  G.sceneMode = null;
}

function restart() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* 무시 */ }
  G = { ...freshGame(), ...runtime() };
  startDay();
}

// ---------- 시작 ----------

function runtime() {
  return { props: [], ents: [], arrows: [], floats: [], parts: [], flyers: [], time: 0, clock: 0, mode: 'hand', arrowType: 'normal', cam: null, paused: false, night: null };
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
  view.ts = Math.max(18, Math.round(portrait ? r.width / 14 : Math.min(r.width / 24, r.height / 14)));
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

function bindPad() {
  for (const b of document.querySelectorAll('[data-pad]')) {
    const k = b.dataset.pad;
    const on = (e) => { e.preventDefault(); unlockAudio(); pad[k] = true; b.classList.add('on'); b.setPointerCapture?.(e.pointerId); };
    const off = () => { pad[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('lostpointercapture', off);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  for (const b of document.querySelectorAll('[data-mode]')) {
    b.addEventListener('click', () => { unlockAudio(); sfx.click(); G.warnedStock = false; setMode(b.dataset.mode); });
  }
  for (const b of document.querySelectorAll('[data-arrow]')) {
    b.addEventListener('click', () => {
      G.arrowType = b.dataset.arrow;
      for (const x of document.querySelectorAll('[data-arrow]')) x.classList.toggle('on', x === b);
    });
  }
  $('homeBtn').addEventListener('click', () => { if (!G.paused) askHome(); });
  $('muteBtn').addEventListener('click', () => { unlockAudio(); $('muteBtn').classList.toggle('off', toggleMute()); });
  $('muteBtn').classList.toggle('off', isMuted());
  $('trackerToggle').addEventListener('click', () => $('tracker').classList.toggle('closed'));
  $('bagBtn').addEventListener('click', () => {
    if (G.paused) return;
    openPanel({
      title: '바구니',
      body: Object.entries(G.s.inv).filter(([, v]) => v.n > 0).map(([id, v]) => `${MATERIALS[id].name} ${v.n}${v.hq ? ` (상급 ${v.hq})` : ''}`).join('\n') || '아직 아무것도 없습니다.',
      icon: 'bag',
      choices: [{ label: '닫기', onClick: closePanel }],
    });
  });
  for (const m of MODES) {
    const img = document.querySelector(`[data-mode="${m}"] img`);
    if (img) img.src = iconURL(TOOL_SPRITE[m] ?? 'hand');
  }
  for (const img of document.querySelectorAll('img[data-icon]')) img.src = iconURL(img.dataset.icon);
}

const KEY_MODES = { 1: 'hand', 2: 'hoe', 3: 'bow', 4: 'ladder', 5: 'plank', 6: 'dirt' };

function boot(hotData) {
  const data = restore(hotData) ?? loadSaved() ?? freshGame();
  G = { ...data, ...runtime() };
  resize();
  bindPad();
  cvs.addEventListener('pointerdown', onPointerDown);
  cvs.addEventListener('pointermove', onPointerMove);
  cvs.addEventListener('pointerup', onPointerUp);
  cvs.addEventListener('pointercancel', onPointerUp);
  cvs.addEventListener('pointerleave', () => { if (G) G.hover = null; });
  cvs.addEventListener('contextmenu', (e) => e.preventDefault());
  $('nightBody').addEventListener('click', onNightClick);
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys.add(k);
    if (KEY_MODES[k] && G?.s.phase === 'day' && !G.paused) setMode(KEY_MODES[k]);
    if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  window.addEventListener('blur', () => { keys.clear(); releaseInput(); });
  window.claude?.hot?.snapshot?.(() => (G ? snapshot() : null));
  if (G.s.phase === 'night') { $('dayui').hidden = true; $('night').hidden = false; renderPrep(); }
  else if (G.s.phase === 'end') { $('dayui').hidden = true; $('night').hidden = false; renderEnding(); }
  else startDay();
  requestAnimationFrame(frame);
}

// 점검용: 주소에 ?debug 가 붙었을 때만 상태를 열어 둔다.
if (location.search.includes('debug')) window.__hwata = { get G() { return G; }, pad, view };

if (window.claude?.hot?.ready) window.claude.hot.ready(boot);
else boot(window.claude?.hot?.data);
