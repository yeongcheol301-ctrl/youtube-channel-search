// 화면·조작·하루 흐름. 계산은 rules.js / world.js / quests.js 가 맡는다.
import {
  DAY_SECONDS, NIGHT_SECONDS, MAX_STAMINA, MATERIALS, RECIPES, RECIPE_ORDER, PATIENTS, UPGRADES,
  ANIMALS_PER_DAY, WHITE_RABBIT_CHANCE, LADDER_WOOD, BRIDGE_WOOD, ARROW_PACK, ARROW_CRAFT, DAYS, MAX_MENU,
  MED_UPGRADE_MAIN, MAX_MED_LEVEL,
} from './data.js';
import {
  newState, addItem, count, basketWeight, carryLimit, canCarry, isOverweight, collapseLoss, spendStamina,
  isUnlocked, canDevelop, develop, canBrew, brew, medPrice, canUpgradeMed, upgradeMed, brewGrade, serve,
  patientsForDay, pickPatientType, canBuyUpgrade, buyUpgrade, digTime, buyArrows, craftArrows, useWood,
} from './rules.js';
import {
  W, H, T, ZONES, ZONE_NAMES, BIG_TREE_X, makeWorld, tile, setTile, isSolid, canDig, surfaceY, isExposed, spawnDaily,
} from './world.js';
import { activeQuests, questChoices, questAct, QUESTS } from './quests.js';
import { drawSprite, spriteSize, sprite } from './sprites.js';

const SAVE_KEY = 'hwata-proto1-v1';
const REACH = 5;
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
let G = null;
let view = { cw: 0, ch: 0, ts: 24, dpr: 1 };
const keys = new Set();
const pad = { left: false, right: false, up: false, down: false };

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
  return { s: data.s, world, seed: data.seed ?? 1 };
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
  setTimeout(() => el.classList.add('out'), 2200);
  setTimeout(() => el.remove(), 2700);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
}

function floatText(text, x, y, color = '#fff6d8') {
  G.floats.push({ text, x, y, t: 1.2, color });
}

// ---------- 창(대화·안내) ----------

function openPanel({ title, body, choices = [], portrait }) {
  G.paused = true;
  const p = $('panel');
  p.hidden = false;
  $('panelTitle').textContent = title;
  $('panelBody').textContent = body;
  const por = $('panelPortrait');
  por.hidden = !portrait;
  if (portrait) paintPortrait(por, portrait);
  const box = $('panelChoices');
  box.innerHTML = '';
  for (const c of choices) {
    const b = document.createElement('button');
    b.className = 'choice' + (c.kind ? ' ' + c.kind : '');
    b.textContent = c.label;
    b.disabled = !!c.disabled;
    b.addEventListener('click', () => c.onClick());
    box.append(b);
  }
}

function closePanel() {
  $('panel').hidden = true;
  G.paused = false;
}

function paintPortrait(canvas, key) {
  const { w, h } = spriteSize(key);
  const px = 6;
  canvas.width = (w + 2) * px;
  canvas.height = (h + 1) * px;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.drawImage(sprite(key), px, px, w * px, h * px);
}

// ---------- 하루 시작 ----------

function startDay() {
  const s = G.s;
  s.phase = 'day';
  s.stamina = MAX_STAMINA;
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
  G.action = null;
  G.gauge = null;
  G.aim = null;
  G.dayLog = {};
  G.zone = 'clinic';
  G.player = { x: 8, y: surfaceY(G.world, 8) - 1.8 - 0.01, w: 0.7, h: 1.8, vx: 0, vy: 0, onGround: false, face: 1, walkT: 0 };
  G.ended = false;
  save();
  $('night').hidden = true;
  $('dayui').hidden = false;
  setMode('hand');
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
  const first = s.day === 1;
  const lines = [];
  if (first) {
    lines.push('산골 마을에 작은 한의원을 연 화타. 해가 지기 전에 마을 뒷들에서 약재를 캐 오고, 밤에는 그 약재로 약을 지어 환자를 봅니다.');
    lines.push('');
    lines.push('◀ ▶ 걷기 · ▲ 점프·사다리 오르기 · ▼ 사다리 내려가기');
    lines.push('[손] 약초를 길게 누르고 원이 초록일 때 떼면 상급. 흙을 누르면 팝니다.');
    lines.push('[활] 쏠 곳을 누른 채 겨누고 떼면 쏩니다. 토끼는 그물 화살이 좋습니다.');
    lines.push('[사다리]·[다리] 나무로 길을 놓습니다. 작은 나무를 누르면 나무를 얻습니다.');
    lines.push('왼쪽 끝 한의원으로 돌아오면 일찍 문을 엽니다.');
    if (view.ch > view.cw) lines.push('휴대폰을 가로로 돌리면 더 넓게 보입니다.');
  } else {
    const tips = {
      2: '농부들이 상처 약을 찾기 시작했습니다. 질경이 고약은 꿩 기름이 필요합니다.',
      3: '오늘부터 칡즙을 개발할 수 있습니다. 칡은 언덕 땅속 깊이 묻혀 있습니다.',
      4: '오늘부터 도라지청을 개발할 수 있습니다. 도라지는 언덕 땅속 얕은 곳에 있습니다.',
      5: '평판이 오를수록 환자가 늘고 약값도 오릅니다.',
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

// ---------- 하루 끝 ----------

function endDay(reason) {
  if (G.ended) return;
  G.ended = true;
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
  const got = Object.entries(G.dayLog).filter(([id]) => count(s, id) > 0 || reason === 'home')
    .map(([id, n]) => `${MATERIALS[id].name} ${n}`).join(', ');
  openPanel({
    title: '하루를 마치며',
    body: body + (got ? `\n\n오늘 캔 것: ${got}` : ''),
    choices: [{ label: '한의원 문을 연다', kind: 'primary', onClick: () => { closePanel(); openNight(); } }],
  });
}

// ---------- 입력 ----------

function setMode(m) {
  G.mode = m;
  for (const b of document.querySelectorAll('[data-mode]')) b.classList.toggle('on', b.dataset.mode === m);
  $('arrowType').hidden = m !== 'bow';
}

function screenToWorld(cx, cy) {
  return { x: G.cam.x + cx / view.ts, y: G.cam.y + cy / view.ts };
}

const playerCenter = () => ({ x: G.player.x + G.player.w / 2, y: G.player.y + G.player.h / 2 });
const distTo = (x, y) => { const c = playerCenter(); return Math.hypot(c.x - x, c.y - y); };

function propAt(tx, ty) {
  const hit = (p) => p.x === tx && (p.y === ty || (p.type === 'npc' && p.y - 1 === ty) || (p.type === 'tree' && ty >= p.y - 1 && ty <= p.y));
  return G.props.find((p) => p.type === 'npc' && hit(p)) ?? G.props.find(hit);
}

const HERBS = new Set(['mugwort', 'chrysanthemum', 'plantain', 'dandelion', 'dropwort', 'clover']);
const ROOTS = new Set(['bellflower', 'kudzu']);

function onPointerDown(e) {
  if (!G || G.paused || G.s.phase !== 'day') return;
  cvs.setPointerCapture(e.pointerId);
  const r = cvs.getBoundingClientRect();
  const wp = screenToWorld(e.clientX - r.left, e.clientY - r.top);
  G.pointer = { id: e.pointerId, ...wp };
  if (G.mode === 'bow') {
    G.aim = { x: wp.x, y: wp.y };
    return;
  }
  const tx = Math.floor(wp.x), ty = Math.floor(wp.y);
  if (G.mode === 'ladder' || G.mode === 'plank') return place(tx, ty);
  handTap(tx, ty, wp);
}

function onPointerMove(e) {
  if (!G || !G.pointer || e.pointerId !== G.pointer.id) return;
  const r = cvs.getBoundingClientRect();
  const wp = screenToWorld(e.clientX - r.left, e.clientY - r.top);
  G.pointer.x = wp.x;
  G.pointer.y = wp.y;
  if (G.aim) { G.aim.x = wp.x; G.aim.y = wp.y; }
}

function onPointerUp(e) {
  if (!G || !G.pointer || e.pointerId !== G.pointer.id) return;
  G.pointer = null;
  if (G.aim) { fire(); G.aim = null; }
  if (G.gauge) finishGauge();
}

function handTap(tx, ty, wp) {
  if (tx <= 11 && ty >= surfaceY(G.world, tx) - 6 && ty < surfaceY(G.world, tx)) return askHome();
  const drop = G.ents.find((d) => d.type === 'drop' && Math.hypot(d.x + 0.3 - wp.x, d.y + 0.3 - wp.y) < 0.9);
  if (drop) return toast('가까이 가면 저절로 줍습니다');
  const p = propAt(tx, ty);
  if (p) return tapProp(p);
  const t = tile(G.world, tx, ty);
  if (t === T.ROOT) return tapRoot(tx, ty);
  if (t === T.LOG) return toast('너무 큰 통나무입니다. 도끼가 있어야 치울 수 있습니다');
  if (t === T.STONE) return toast('돌은 곡괭이가 있어야 팔 수 있습니다 (다음 버전)');
  if (canDig(G.world, tx, ty)) {
    if (distTo(tx + 0.5, ty + 0.5) > REACH) return toast('조금 더 가까이 가야 합니다');
    if (t === T.LADDER || t === T.PLANK) {
      setTile(G.world, tx, ty, T.AIR);
      addItem(G.s, 'wood');
      return floatText('나무 +1', tx + 0.5, ty);
    }
    G.action = { kind: 'dig', x: tx, y: ty, t: 0, dur: digTime(G.s) };
  }
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
      choices: [{ label: '돌아선다', onClick: closePanel }],
    });
  }
  if (ROOTS.has(p.type)) return tapRoot(p.x, p.y);
  if (p.type === 'bottle') return toast('빈 술병이 뒹굴고 있다');
  if (p.type === 'beehive') return toast('너무 높다. 활로 떨어뜨려야겠다');
  if (distTo(p.x + 0.5, p.y + 0.5) > REACH) return toast('조금 더 가까이 가야 합니다');
  if (p.type === 'tree') {
    G.action = { kind: 'chop', prop: p, x: p.x, y: p.y, t: 0, dur: 1 };
    return;
  }
  if (p.type === 'cicada') {
    if (gain('cicada', false)) removeProp(p);
    return;
  }
  if (HERBS.has(p.type)) {
    if (p.type === 'clover') {
      if (gain('clover', false)) { removeProp(p); toast('네잎클로버! 다음에 캐는 재료 5개가 모두 상급이 됩니다', 'good'); }
      return;
    }
    G.gauge = { prop: p, item: p.type, x: p.x, y: p.y, t: 0, dur: 1.0, zone: [0.62, 0.84] };
  }
}

function tapRoot(tx, ty) {
  if (distTo(tx + 0.5, ty + 0.5) > REACH) return toast('조금 더 가까이 가야 합니다');
  if (!isExposed(G.world, tx, ty)) return toast('뿌리 둘레의 흙을 더 파야 합니다');
  const p = G.props.find((q) => q.x === tx && q.y === ty && ROOTS.has(q.type));
  if (!p) return;
  G.gauge = { prop: p, item: p.type, x: tx, y: ty, t: 0, dur: 1.3, zone: [0.68, 0.82], root: true };
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
    if (v > g.zone[1]) toast('너무 세게 뽑아 뿌리가 끊겼다');
  }
  gain(g.item, hq);
  removeProp(g.prop);
}

function gain(id, hq) {
  if (!canCarry(G.s, id)) { toast('바구니가 가득 찼습니다', 'bad'); return false; }
  const before = G.s.inv[id]?.hq ?? 0;
  addItem(G.s, id, hq);
  const isHq = (G.s.inv[id].hq > before);
  G.dayLog[id] = (G.dayLog[id] ?? 0) + 1;
  const c = playerCenter();
  floatText(`${MATERIALS[id].name}${isHq && MATERIALS[id].weight ? ' ★' : ''}`, c.x, c.y - 1.2, isHq ? '#ffd76a' : '#fff6d8');
  return true;
}

function removeProp(p) {
  G.props = G.props.filter((q) => q !== p);
}

function place(tx, ty) {
  const kind = G.mode === 'ladder' ? T.LADDER : T.PLANK;
  const cost = kind === T.LADDER ? LADDER_WOOD : BRIDGE_WOOD;
  if (distTo(tx + 0.5, ty + 0.5) > REACH) return toast('조금 더 가까이 가야 합니다');
  const t = tile(G.world, tx, ty);
  if (t !== T.AIR && t !== T.WATER) return toast('빈 곳에만 놓을 수 있습니다');
  if (kind === T.PLANK && overlapsTile(G.player, tx, ty)) return toast('서 있는 자리에는 놓을 수 없습니다');
  if (!useWood(G.s, cost)) return toast(`나무가 ${cost}개 필요합니다. 작은 나무를 눌러 베세요`, 'bad');
  setTile(G.world, tx, ty, kind);
}

function overlapsTile(b, tx, ty) {
  return b.x < tx + 1 && b.x + b.w > tx && b.y < ty + 1 && b.y + b.h > ty;
}

function fire() {
  const s = G.s;
  if (s.arrows <= 0) return toast('화살이 없습니다. 밤에 사거나 만드세요', 'bad');
  const c = playerCenter();
  const dx = G.aim.x - c.x, dy = G.aim.y - (c.y - 0.3);
  const len = Math.hypot(dx, dy) || 1;
  const speed = s.upgrades.bow ? 27 : 18;
  s.arrows -= 1;
  if (spendStamina(s, 2)) G.tiredSoon = true;
  G.player.face = dx >= 0 ? 1 : -1;
  G.arrows.push({ x: c.x, y: c.y - 0.3, vx: (dx / len) * speed, vy: (dy / len) * speed, type: G.arrowType, life: 3, stuck: false });
}

const arrowGravity = () => (G.s.upgrades.bow ? 7 : 12);

function askHome() {
  openPanel({
    title: '한의원',
    body: '오늘 탐험을 마치고 한의원으로 들어갈까요? 해가 지기 전에 들어가면 오늘 밤 환자가 더 찾아옵니다.',
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
        openPanel({ title: q.name, body: r.text, portrait: q.npc, choices: [{ label: '길을 떠난다', kind: 'primary', onClick: closePanel }] });
        toast('퀘스트 완료', 'good');
      } else openQuest(id, r.text);
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

function moveBody(b, dt, autoStep) {
  const dx = b.vx * dt;
  b.hitWall = false;
  if (dx) {
    b.x += dx;
    if (hitsSolid(b)) {
      let stepped = false;
      if (autoStep && b.onGround) {
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
  b.onGround = false;
  b.y += dy;
  if (hitsSolid(b)) {
    if (dy > 0) { b.y = Math.floor(b.y + b.h) - b.h - 0.001; b.onGround = true; } else b.y = Math.floor(b.y) + 1.001;
    b.vy = 0;
  }
  b.x = clamp(b.x, 0, W - b.w);
}

function inWater(b) {
  const cx = Math.floor(b.x + b.w / 2), cy = Math.floor(b.y + b.h * 0.6);
  return tile(G.world, cx, cy) === T.WATER;
}

function onLadder(b) {
  const cx = Math.floor(b.x + b.w / 2);
  return tile(G.world, cx, Math.floor(b.y + b.h - 0.2)) === T.LADDER || tile(G.world, cx, Math.floor(b.y + 0.4)) === T.LADDER;
}

function updatePlayer(dt) {
  const p = G.player, s = G.s;
  const left = pad.left || keys.has('ArrowLeft') || keys.has('a');
  const right = pad.right || keys.has('ArrowRight') || keys.has('d');
  const up = pad.up || keys.has('ArrowUp') || keys.has('w') || keys.has(' ');
  const down = pad.down || keys.has('ArrowDown') || keys.has('s');
  const water = inWater(p);
  const ladder = onLadder(p);
  let speed = isOverweight(s) ? 3 : 5;
  if (water) speed = Math.min(speed, 2.6);
  const busy = G.action || G.gauge;
  const dir = busy ? 0 : (right ? 1 : 0) - (left ? 1 : 0);
  p.vx = dir * speed;
  if (dir) p.face = dir;
  if (ladder && (up || down)) {
    p.climbing = true;
  } else if (!ladder) p.climbing = false;
  if (p.climbing) {
    p.vy = up ? -4 : down ? 4 : 0;
  } else if (water) {
    p.vy = Math.min(p.vy + 10 * dt, 3);
    if (up) p.vy = -5;
  } else {
    p.vy = Math.min(p.vy + 32 * dt, 18);
    if (up && p.onGround) p.vy = -12.5;
  }
  moveBody(p, dt, true);
  p.walkT = dir && p.onGround ? p.walkT + dt : 0;
}

function updateAction(dt) {
  const a = G.action;
  if (!a) return;
  if (distTo(a.x + 0.5, a.y + 0.5) > REACH + 0.6) { G.action = null; return; }
  a.t += dt;
  if (a.t < a.dur) return;
  G.action = null;
  if (a.kind === 'dig') {
    if (overlapsTileBelowFeet(a.x, a.y)) G.player.vy = 0;
    setTile(G.world, a.x, a.y, T.AIR);
    G.props = G.props.filter((p) => !(p.x === a.x && p.y === a.y - 1 && HERBS.has(p.type)) || isSolid(G.world, p.x, p.y + 1));
    if (spendStamina(G.s, 1)) G.tiredSoon = true;
  } else if (a.kind === 'chop') {
    removeProp(a.prop);
    for (let i = 0; i < 3; i++) addItem(G.s, 'wood');
    floatText('나무 +3', a.x + 0.5, a.y - 1);
    if (spendStamina(G.s, 2)) G.tiredSoon = true;
  }
}

const overlapsTileBelowFeet = (x, y) => Math.floor(G.player.y + G.player.h + 0.01) === y;

function updateArrows(dt) {
  for (const a of G.arrows) {
    if (a.stuck) { a.life -= dt; continue; }
    a.vy += arrowGravity() * dt;
    const steps = 3;
    for (let i = 0; i < steps && !a.stuck && a.life > 0; i++) {
      a.x += (a.vx * dt) / steps;
      a.y += (a.vy * dt) / steps;
      if (arrowHits(a)) { a.life = 0; break; }
      if (isSolid(G.world, Math.floor(a.x), Math.floor(a.y))) { a.stuck = true; a.life = 0.8; }
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
    if (e.type === 'pheasant') {
      gain('pheasantFat', net);
      addItem(G.s, 'feather', false);
      G.dayLog.feather = (G.dayLog.feather ?? 0) + 1;
    } else gain(e.type === 'whiteRabbit' ? 'whiteFur' : 'rabbitFur', net);
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
      moveBody(e, dt, false);
      if (e.onGround) {
        e.dead = true;
        for (let i = 0; i < 2; i++) G.ents.push({ type: 'drop', item: 'honey', x: e.x + i * 0.5 - 0.2, y: e.y, w: 0.6, h: 0.6, vx: 0, vy: -4 });
        G.ents.push({ type: 'bees', x: e.x, y: e.y - 0.5, w: 0.9, h: 0.9, t: 10 });
      }
    } else if (e.type === 'drop') {
      e.vy = Math.min(e.vy + 30 * dt, 18);
      moveBody(e, dt, false);
      const p = G.player;
      if (e.x < p.x + p.w && e.x + e.w > p.x && e.y < p.y + p.h && e.y + e.h > p.y) {
        if (gain(e.item, false)) e.dead = true;
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
  moveBody(r, dt, false);
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
    if (spendStamina(G.s, 15)) G.tiredSoon = true;
    toast('벌에 쏘였다! 기력 -15', 'bad');
    floatText('-15', pc.x, pc.y - 1.2, '#ff9c8a');
    return;
  }
  if (b.t < 0) b.dead = true;
}

function zoneAt(x) {
  for (const [k, [a, b]] of Object.entries(ZONES)) if (k !== 'log' && x >= a && x <= b) return k;
  return 'forest';
}

function updateDay(dt) {
  if (G.paused || G.ended) return;
  G.time += dt;
  updatePlayer(dt);
  updateAction(dt);
  if (G.gauge) G.gauge.t = Math.min(G.gauge.t + dt, G.gauge.dur * 1.25);
  updateArrows(dt);
  updateEnts(dt);
  for (const f of G.floats) { f.t -= dt; f.y -= dt * 0.8; }
  G.floats = G.floats.filter((f) => f.t > 0);
  const z = zoneAt(Math.floor(G.player.x));
  if (z !== G.zone) { G.zone = z; toast(ZONE_NAMES[z]); }
  if (G.s.stamina <= 0) return endDay('tired');
  if (G.time >= DAY_SECONDS) return endDay('dark');
  if (!G.warned && G.time >= DAY_SECONDS - 30) { G.warned = true; toast('노을이 진다. 서둘러 돌아가자!', 'bad'); }
  if (G.time < 1) G.warned = false;
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
  [T.DIRT]: ['#7a5534', '#6a4729', '#8a6340'],
  [T.GRASS]: ['#7a5534', '#6a4729', '#8a6340'],
  [T.STONE]: ['#6f7079', '#5d5e67', '#83848c'],
  [T.ROOT]: ['#7a5534', '#6a4729', '#8a6340'],
};

function drawTile(t, x, y, sx, sy, ts, dark) {
  if (t === T.WATER) {
    ctx.fillStyle = 'rgba(64,124,170,0.62)';
    ctx.fillRect(sx, sy, ts, ts);
    if (tile(G.world, x, y - 1) !== T.WATER) {
      ctx.fillStyle = 'rgba(210,235,245,0.7)';
      const w = Math.sin(G.clock * 3 + x) * ts * 0.06;
      ctx.fillRect(sx, sy + ts * 0.08 + w, ts, ts * 0.08);
    }
    return;
  }
  if (t === T.LADDER) {
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(sx + ts * 0.15, sy, ts * 0.12, ts);
    ctx.fillRect(sx + ts * 0.73, sy, ts * 0.12, ts);
    ctx.fillStyle = '#b07a46';
    for (let i = 0; i < 3; i++) ctx.fillRect(sx + ts * 0.15, sy + ts * (0.15 + i * 0.33), ts * 0.7, ts * 0.1);
    return;
  }
  if (t === T.PLANK) {
    ctx.fillStyle = '#a7743f';
    ctx.fillRect(sx, sy, ts, ts * 0.45);
    ctx.fillStyle = '#7a522a';
    ctx.fillRect(sx, sy + ts * 0.45, ts, ts * 0.12);
    ctx.fillRect(sx + ts * 0.48, sy, ts * 0.05, ts * 0.45);
    return;
  }
  if (t === T.LOG) {
    ctx.fillStyle = '#5b3d22';
    ctx.fillRect(sx, sy, ts, ts);
    ctx.fillStyle = '#704b2b';
    ctx.fillRect(sx, sy + ts * (0.2 + 0.4 * hash(x, y)), ts, ts * 0.12);
    if (x === ZONES.log[0]) {
      ctx.fillStyle = '#c9a26c';
      ctx.fillRect(sx, sy + ts * 0.15, ts * 0.25, ts * 0.7);
    }
    shade(sx, sy, ts, dark);
    return;
  }
  const cols = TILE_COL[t];
  ctx.fillStyle = cols[0];
  ctx.fillRect(sx, sy, ts, ts);
  const px = ts / 8;
  for (let i = 0; i < 4; i++) {
    const h = hash(x * 7 + i, y * 13 - i);
    ctx.fillStyle = cols[1 + (i % 2)];
    ctx.fillRect(sx + Math.floor(h * 7) * px, sy + Math.floor(hash(y + i, x - i) * 7) * px, px * 2, px);
  }
  if (t === T.GRASS && tile(G.world, x, y - 1) !== T.WATER && !isSolid(G.world, x, y - 1)) {
    ctx.fillStyle = '#5f9a45';
    ctx.fillRect(sx, sy, ts, px * 2.2);
    ctx.fillStyle = '#7dbb59';
    ctx.fillRect(sx, sy, ts, px);
    ctx.fillRect(sx + Math.floor(hash(x, 3) * 6) * px, sy - px, px, px);
  }
  if (t === T.ROOT) {
    const p = G.props.find((q) => q.x === x && q.y === y);
    const exposed = isExposed(G.world, x, y);
    if (p && exposed) drawSprite(ctx, p.type === 'kudzu' ? 'kudzuRoot' : 'bellflowerRoot', sx, sy, px);
  }
  shade(sx, sy, ts, dark);
}

function shade(sx, sy, ts, dark) {
  if (dark <= 0) return;
  ctx.fillStyle = `rgba(14,10,8,${dark})`;
  ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
}

function drawBackground(f) {
  const { cw, ch, ts } = view;
  const [top, bottom] = skyAt(f);
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);
  // 해
  const sunX = cw * (0.1 + 0.8 * f), sunY = ch * (0.32 - Math.sin(Math.PI * f) * 0.22);
  ctx.fillStyle = f > 0.85 ? '#ffb070' : '#fff1c4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, ts * 0.9, 0, Math.PI * 2);
  ctx.fill();
  // 먼 산 두 겹
  const layers = [[0.15, 'rgba(92,110,138,0.45)', 9, 0.55], [0.35, 'rgba(70,96,98,0.55)', 6, 0.68]];
  for (const [par, col, amp, base] of layers) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, ch);
    for (let sx = 0; sx <= cw + 8; sx += 8) {
      const wx = (sx / ts + G.cam.x * par) * 0.35;
      const y = ch * base - (Math.sin(wx * 0.5) + Math.sin(wx * 0.23 + 1.3) * 1.4) * amp * ts * 0.12 - G.cam.y * par * ts * 0.1;
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
  ctx.fillRect(sx + ts * 0.3, sy - ts * 0.5, w - ts * 0.6, ts * 0.5); // 기단
  ctx.fillStyle = '#efe4cc';
  ctx.fillRect(sx + ts * 0.8, sy - ts * 3.6, w - ts * 1.6, ts * 3.1);
  ctx.fillStyle = '#6b4a2b';
  for (let i = 0; i < 4; i++) ctx.fillRect(sx + ts * (0.8 + i * 2.3), sy - ts * 3.6, ts * 0.25, ts * 3.1);
  ctx.fillRect(sx + ts * 0.8, sy - ts * 3.6, w - ts * 1.6, ts * 0.2);
  // 문과 창살
  ctx.fillStyle = '#d8c7a4';
  ctx.fillRect(sx + ts * 3.6, sy - ts * 2.6, ts * 1.8, ts * 2.1);
  ctx.strokeStyle = '#8a6a44';
  ctx.lineWidth = Math.max(1, ts * 0.06);
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(sx + ts * (3.6 + i * 0.6), sy - ts * 2.6); ctx.lineTo(sx + ts * (3.6 + i * 0.6), sy - ts * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + ts * 3.6, sy - ts * (2.6 - i * 0.7)); ctx.lineTo(sx + ts * 5.4, sy - ts * (2.6 - i * 0.7)); ctx.stroke();
  }
  // 기와지붕
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
  // 현판
  ctx.fillStyle = '#2b303c';
  ctx.fillRect(sx + ts * 3.2, sy - ts * 3.45, ts * 2.6, ts * 0.75);
  ctx.fillStyle = '#e8c766';
  ctx.font = `${Math.round(ts * 0.5)}px "Song Myung", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('화타 의원', sx + ts * 4.5, sy - ts * 3.07);
}

function drawBigTree(ts) {
  const base = surfaceY(G.world, BIG_TREE_X);
  const sx = (BIG_TREE_X - G.cam.x) * ts, sy = (base - G.cam.y) * ts;
  if (sx < -ts * 8 || sx > view.cw + ts * 8) return;
  ctx.fillStyle = '#5a3d24';
  ctx.fillRect(sx - ts * 0.2, sy - ts * 11, ts * 1.4, ts * 11);
  ctx.fillStyle = '#6e4c2e';
  ctx.fillRect(sx + ts * 0.1, sy - ts * 11, ts * 0.3, ts * 11);
  ctx.fillRect(sx + ts * 1, sy - ts * 9, ts * 2.4, ts * 0.4);
  ctx.fillRect(sx - ts * 2, sy - ts * 10, ts * 2, ts * 0.4);
  const blobs = [[0.5, -13, 4.2], [-2.5, -11.5, 3], [3.5, -11.3, 3.2], [0.5, -10.5, 3.6], [-1, -15, 2.5], [2.5, -14.5, 2.6]];
  for (const [i, [bx, by, r]] of blobs.entries()) {
    ctx.fillStyle = i % 2 ? '#3f6e3a' : '#4d7f43';
    ctx.beginPath();
    ctx.arc(sx + bx * ts, sy + by * ts, r * ts, 0, Math.PI * 2);
    ctx.fill();
  }
}

function render() {
  const { cw, ch, ts } = view;
  const p = G.player;
  const viewW = cw / ts, viewH = ch / ts;
  G.cam = {
    x: clamp(p.x + p.w / 2 - viewW / 2, 0, W - viewW),
    y: clamp(p.y + p.h / 2 - viewH * 0.42, 0, H - viewH),
  };
  const f = clamp(G.time / DAY_SECONDS, 0, 1);
  ctx.imageSmoothingEnabled = false;
  drawBackground(f);
  drawClinic(ts);
  drawBigTree(ts);

  const x0 = Math.max(0, Math.floor(G.cam.x)), x1 = Math.min(W - 1, Math.ceil(G.cam.x + viewW));
  const y0 = Math.max(0, Math.floor(G.cam.y)), y1 = Math.min(H - 1, Math.ceil(G.cam.y + viewH));
  for (let x = x0; x <= x1; x++) {
    let surf = 0;
    while (surf < H && !isSolid(G.world, x, surf) && tile(G.world, x, surf) !== T.WATER) surf++;
    const ground = Math.min(surf, groundTop(x));
    for (let y = y0; y <= y1; y++) {
      const t = tile(G.world, x, y);
      const sx = (x - G.cam.x) * ts, sy = (y - G.cam.y) * ts;
      const depth = y - ground;
      const dark = clamp((depth - 2) * 0.075, 0, 0.72);
      if (t === T.AIR || t === T.LADDER || t === T.WATER) {
        if (depth >= 0) { // 파낸 자리: 흙벽
          ctx.fillStyle = '#3b2a1d';
          ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
          shade(sx, sy, ts, dark);
        }
        if (t !== T.AIR) drawTile(t, x, y, sx, sy, ts, 0);
        continue;
      }
      drawTile(t, x, y, sx, sy, ts, dark);
    }
  }
  drawProps(ts);
  drawEnts(ts);
  drawPlayer(ts);
  drawArrows(ts);
  drawOverlays(ts);
  // 노을 지면 화면이 어두워진다
  if (f > 0.85) {
    ctx.fillStyle = `rgba(30,20,50,${(f - 0.85) * 2.2})`;
    ctx.fillRect(0, 0, cw, ch);
  }
}

// 처음 지도의 땅 높이(파낸 구멍 때문에 하늘이 땅속까지 비치지 않게)
const groundCache = [];
function groundTop(x) {
  if (groundCache[x] === undefined) groundCache[x] = surfaceY(makeWorldOnce(), x);
  return groundCache[x];
}
let pristine = null;
function makeWorldOnce() { return (pristine ??= makeWorld()); }

function drawProps(ts) {
  const px = ts / 8;
  for (const p of G.props) {
    const sx = (p.x - G.cam.x) * ts, sy = (p.y - G.cam.y) * ts;
    if (sx < -ts * 3 || sx > view.cw + ts * 3) continue;
    if (ROOTS.has(p.type)) {
      if (tile(G.world, p.x, p.y) !== T.ROOT) continue;
      const top = surfaceY(G.world, p.x) - 1;
      if (!isExposed(G.world, p.x, p.y)) drawSprite(ctx, 'sprout', sx + px, (top - G.cam.y) * ts + ts - 4 * px, px);
      continue;
    }
    if (p.type === 'npc') {
      const big = p.sprite === 'zhangfei' ? 1.15 : p.sprite === 'child' ? 0.8 : 1;
      const q = px * big;
      drawSprite(ctx, p.sprite, sx + ts / 2 - 5 * q, sy + ts - 16 * q, q, true);
      const bob = Math.sin(G.clock * 4) * px;
      ctx.fillStyle = '#ffd76a';
      ctx.strokeStyle = '#2a2118';
      ctx.lineWidth = Math.max(1, px * 0.6);
      ctx.font = `bold ${Math.round(ts * 0.9)}px "Gowun Dodum", sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeText('!', sx + ts / 2, sy + ts - 17 * q + bob);
      ctx.fillText('!', sx + ts / 2, sy + ts - 17 * q + bob);
      continue;
    }
    if (p.type === 'tree') { drawSprite(ctx, 'tree', sx, sy + ts - 12 * px * 1.5, px * 1.5); continue; }
    if (p.type === 'beehive') { drawSprite(ctx, 'beehive', sx, sy, px * 1.1); continue; }
    if (p.type === 'cicada') { drawSprite(ctx, 'cicada', sx + 2 * px, sy + 2 * px, px); continue; }
    if (p.type === 'sign') { drawSprite(ctx, 'sign', sx, sy, px); continue; }
    if (p.type === 'bottle') { drawSprite(ctx, 'bottle', sx + 2 * px, sy + 2 * px, px); continue; }
    drawSprite(ctx, p.type, sx, sy, px);
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
      } else drawSprite(ctx, 'pheasantFly', sx, sy, px, e.face < 0);
    } else if (e.type === 'hive') drawSprite(ctx, 'beehive', sx, sy, px * 1.1);
    else if (e.type === 'drop') drawSprite(ctx, e.item, sx, sy, px * 1.2);
    else if (e.type === 'bees') {
      for (let i = 0; i < 6; i++) {
        const a = G.clock * 9 + i * 1.7;
        drawSprite(ctx, 'bee', sx + ts * 0.45 + Math.cos(a) * ts * 0.45, sy + ts * 0.45 + Math.sin(a * 1.3) * ts * 0.4, px);
      }
    }
  }
}

function drawPlayer(ts) {
  const p = G.player, px = ts / 8;
  const sx = (p.x - G.cam.x) * ts, sy = (p.y - G.cam.y) * ts;
  const frame = p.walkT && Math.floor(p.walkT * 8) % 2 ? 'hwata2' : 'hwata';
  const scale = (p.h * ts) / 16;
  drawSprite(ctx, frame, sx + (p.w * ts) / 2 - 5 * scale, sy, scale, p.face < 0);
  if (G.mode === 'bow') {
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = px * 0.8;
    ctx.beginPath();
    const bx = sx + (p.w * ts) / 2 + p.face * 5 * scale, by = sy + 9 * scale;
    ctx.arc(bx - p.face * 2 * px, by, 3 * px, p.face > 0 ? -1.2 : Math.PI - 1.9, p.face > 0 ? 1.2 : Math.PI + 1.9);
    ctx.stroke();
  }
}

function drawArrows(ts) {
  ctx.lineWidth = Math.max(2, ts * 0.07);
  for (const a of G.arrows) {
    const sx = (a.x - G.cam.x) * ts, sy = (a.y - G.cam.y) * ts;
    const len = Math.hypot(a.vx, a.vy) || 1;
    const dx = (a.vx / len) * ts * 0.8, dy = (a.vy / len) * ts * 0.8;
    ctx.strokeStyle = a.type === 'net' ? '#d8e2e6' : '#e9d7b0';
    ctx.beginPath();
    ctx.moveTo(sx - dx, sy - dy);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    if (a.type === 'net') {
      ctx.fillStyle = 'rgba(216,226,230,0.8)';
      ctx.fillRect(sx - ts * 0.15, sy - ts * 0.15, ts * 0.3, ts * 0.3);
    }
  }
}

function drawOverlays(ts) {
  // 겨누는 선
  if (G.aim) {
    const c = playerCenter();
    const dx = G.aim.x - c.x, dy = G.aim.y - (c.y - 0.3);
    const len = Math.hypot(dx, dy) || 1;
    const speed = G.s.upgrades.bow ? 27 : 18;
    let x = c.x, y = c.y - 0.3, vx = (dx / len) * speed, vy = (dy / len) * speed;
    ctx.fillStyle = 'rgba(255,246,216,0.85)';
    for (let i = 0; i < 26; i++) {
      for (let k = 0; k < 2; k++) { vy += arrowGravity() * 0.02; x += vx * 0.02; y += vy * 0.02; }
      if (isSolid(G.world, Math.floor(x), Math.floor(y))) break;
      ctx.fillRect((x - G.cam.x) * ts - 2, (y - G.cam.y) * ts - 2, 4, 4);
    }
  }
  // 파기·베기 진행
  if (G.action) {
    const a = G.action;
    const sx = (a.x - G.cam.x) * ts, sy = (a.y - G.cam.y) * ts;
    ctx.strokeStyle = '#fff6d8';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, sy + 1, ts - 2, ts - 2);
    ctx.fillStyle = 'rgba(255,246,216,0.85)';
    ctx.fillRect(sx, sy + ts + 2, ts * (a.t / a.dur), 4);
  }
  // 약초 캐기 원
  if (G.gauge) {
    const g = G.gauge;
    const cx = (g.x + 0.5 - G.cam.x) * ts, cy = (g.y - 0.6 - G.cam.y) * ts;
    const r = ts * 0.9;
    const v = g.t / g.dur;
    ctx.lineWidth = ts * 0.22;
    ctx.strokeStyle = 'rgba(20,16,12,0.55)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#59b85a';
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2 + g.zone[0] * Math.PI * 2, -Math.PI / 2 + g.zone[1] * Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = v > g.zone[1] ? '#d9574a' : v >= g.zone[0] ? '#bff0a0' : '#f3e7c6';
    ctx.lineWidth = ts * 0.12;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.min(v, 1) * Math.PI * 2); ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(ts * 0.48)}px "Gowun Dodum", sans-serif`;
  for (const fl of G.floats) {
    ctx.globalAlpha = clamp(fl.t, 0, 1);
    ctx.fillStyle = '#1b1410';
    ctx.fillText(fl.text, (fl.x - G.cam.x) * ts + 1, (fl.y - G.cam.y) * ts + 1);
    ctx.fillStyle = fl.color;
    ctx.fillText(fl.text, (fl.x - G.cam.x) * ts, (fl.y - G.cam.y) * ts);
  }
  ctx.globalAlpha = 1;
}

// ---------- 화면 위 정보 ----------

function updateHud() {
  const s = G.s;
  $('hudDay').textContent = `${s.day}일째`;
  $('hudZone').textContent = ZONE_NAMES[G.zone] ?? '';
  const left = Math.max(0, DAY_SECONDS - G.time);
  $('sunFill').style.width = `${(left / DAY_SECONDS) * 100}%`;
  $('sunFill').classList.toggle('late', left < 30);
  $('staminaFill').style.width = `${(s.stamina / MAX_STAMINA) * 100}%`;
  $('hudStamina').textContent = s.stamina;
  const wt = basketWeight(s);
  $('hudWeight').textContent = `${wt}/${carryLimit(s)}`;
  $('hudWeight').classList.toggle('over', wt > carryLimit(s));
  $('hudArrows').textContent = s.arrows;
  $('hudWood').textContent = count(s, 'wood');
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
  renderPrep();
}

function recipeLine(id) {
  return Object.entries(RECIPES[id].inputs).map(([k, n]) => `${MATERIALS[k].name} ${n}`).join(' + ');
}

function unlockText(id) {
  const u = RECIPES[id].unlock;
  if (u === 'quest1') return '나무꾼을 도우면 배움';
  return `${u.day}일째부터`;
}

function invList(s) {
  const rows = Object.entries(s.inv).filter(([, v]) => v.n > 0);
  if (!rows.length) return '<p class="muted">바구니가 비었습니다.</p>';
  return `<ul class="inv">${rows.map(([id, v]) => `<li><span>${MATERIALS[id].name}</span><b>${v.n}</b>${v.hq ? `<em>상급 ${v.hq}</em>` : ''}</li>`).join('')}</ul>`;
}

function renderPrep() {
  const s = G.s;
  const meds = RECIPE_ORDER.map((id) => {
    const r = RECIPES[id];
    const m = s.meds[id];
    if (!m) {
      const unlocked = isUnlocked(s, id);
      const cost = Object.entries(r.inputs).map(([k, n]) => `${MATERIALS[k].name} ${n * 2}`).join(' + ');
      return `<article class="med ${unlocked ? '' : 'locked'}">
        <header><h3>${r.name}</h3><span class="tag">${unlocked ? '개발 전' : '잠김'}</span></header>
        <p class="cures">${r.cures}</p>
        <p class="recipe">${unlocked ? `처음 개발: ${cost}` : unlockText(id)}</p>
        ${unlocked ? `<button data-act="develop" data-id="${id}" ${canDevelop(s, id) ? '' : 'disabled'}>개발하기</button>` : ''}
      </article>`;
    }
    const inMenu = s.menu.includes(id);
    return `<article class="med ${inMenu ? 'menu' : ''}">
      <header><h3>${r.name}</h3><span class="tag lv">${m.level}단계</span></header>
      <p class="cures">${r.cures}</p>
      <p class="recipe">${recipeLine(id)} → 3첩 · 한 첩 ${medPrice(s, id, false)}냥</p>
      <p class="doses">달여 둔 약 <b>${m.doses.n}</b>첩${m.doses.hq ? ` (상급 ${m.doses.hq})` : ''}</p>
      <div class="row">
        <button data-act="brew" data-id="${id}" ${canBrew(s, id) ? '' : 'disabled'}>달이기 +3첩</button>
        <button data-act="upgrade" data-id="${id}" ${canUpgradeMed(s, id) ? '' : 'disabled'} title="${MATERIALS[r.main].name} ${MED_UPGRADE_MAIN}개">${m.level >= MAX_MED_LEVEL ? '최고 단계' : `강화 (${MATERIALS[r.main].name} ${MED_UPGRADE_MAIN})`}</button>
        <button data-act="menu" data-id="${id}" class="${inMenu ? 'on' : ''}">${inMenu ? '처방 목록에서 빼기' : '처방 목록에 넣기'}</button>
      </div>
    </article>`;
  }).join('');
  const shop = Object.entries(UPGRADES).map(([k, u]) => {
    const items = Object.entries(u.items).map(([id, n]) => `${MATERIALS[id].name} ${n}`).join(', ');
    return `<li><div><b>${u.name}</b><span>${u.desc}</span><small>${u.money}냥 + ${items}</small></div>
      <button data-act="buy" data-id="${k}" ${canBuyUpgrade(s, k) ? '' : 'disabled'}>${s.upgrades[k] ? '완료' : '맞추기'}</button></li>`;
  }).join('');
  const menuNames = s.menu.map((id) => RECIPES[id].name).join(', ') || '없음';
  $('nightBody').innerHTML = `
    <section class="nighthead">
      <div><p class="eyebrow">${s.day}일째 밤</p><h2>화타 의원</h2></div>
      <dl class="stats"><div><dt>엽전</dt><dd>${s.money}냥</dd></div><div><dt>평판</dt><dd>${s.rep}</dd></div><div><dt>오늘 올 환자</dt><dd>${expectedPatients()}명</dd></div></dl>
    </section>
    <section><h4>약장</h4><p class="muted">오늘 낼 약은 최대 ${MAX_MENU}가지(지금: ${menuNames}). 약은 미리 달여 두어야 팔 수 있습니다.</p><div class="meds">${meds}</div></section>
    <section class="two">
      <div><h4>대장간</h4><ul class="shop">${shop}
        <li><div><b>화살 ${ARROW_PACK.count}발</b><span>지금 ${s.arrows}발</span><small>${ARROW_PACK.money}냥</small></div><button data-act="arrows" ${s.money >= ARROW_PACK.money ? '' : 'disabled'}>사기</button></li>
        <li><div><b>화살 ${ARROW_CRAFT.count}발 만들기</b><span>깃털 1 + 나무 1</span><small>직접 만들기</small></div><button data-act="craft" ${count(s, 'feather') && count(s, 'wood') ? '' : 'disabled'}>만들기</button></li>
      </ul></div>
      <div><h4>바구니와 창고</h4>${invList(s)}</div>
    </section>
    <div class="go"><button class="primary big" data-act="open">영업 시작</button></div>`;
}

const expectedPatients = () => patientsForDay(G.s) + (G.s.flags.earlyBonus ? 2 : 0) + (G.s.flags.zhangfeiVisit && !G.s.flags.zhangfei ? 1 : 0);

function onNightClick(e) {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const s = G.s, id = b.dataset.id;
  const act = b.dataset.act;
  if (act === 'develop') { if (develop(s, id).ok) toast(`${RECIPES[id].name} 개발 완료!`, 'good'); }
  else if (act === 'brew') { const r = brew(s, id); if (r.ok) toast(`${RECIPES[id].name} 3첩${r.hq ? ' (상급)' : ''}`, 'good'); }
  else if (act === 'upgrade') { if (upgradeMed(s, id).ok) toast(`${RECIPES[id].name} ${s.meds[id].level}단계`, 'good'); }
  else if (act === 'menu') {
    if (s.menu.includes(id)) s.menu = s.menu.filter((x) => x !== id);
    else if (s.menu.length >= MAX_MENU) toast(`처방 목록은 ${MAX_MENU}가지까지입니다`, 'bad');
    else s.menu.push(id);
  } else if (act === 'buy') { if (buyUpgrade(s, id).ok) toast(`${UPGRADES[id].name}을(를) 새로 맞췄습니다`, 'good'); }
  else if (act === 'arrows') buyArrows(s);
  else if (act === 'craft') craftArrows(s);
  else if (act === 'open') return startService();
  else if (act === 'serve') return pickMed(id);
  else if (act === 'fire') return stopBrew();
  else if (act === 'send') return sendAway();
  else if (act === 'sleep') return sleep();
  else if (act === 'restart') return restart();
  if (s.phase === 'night' && !G.night) renderPrep();
}

function startService() {
  const s = G.s;
  if (!s.menu.length) return toast('처방 목록에 약을 하나 이상 넣으세요', 'bad');
  const rng = mulberry32(G.seed + s.day * 31337);
  const total = patientsForDay(s) + (s.flags.earlyBonus ? 2 : 0);
  const types = Array.from({ length: total }, () => pickPatientType(s, rng));
  if (s.flags.zhangfeiVisit && !s.flags.zhangfei) types.unshift('zhangfei');
  G.night = { t: 0, types, queue: [], spawnT: 0, interval: (NIGHT_SECONDS - 30) / types.length, brewing: null, earned: 0, stars: 0, served: 0, wrong: 0, left: 0, next: 1 };
  $('nightBody').innerHTML = `
    <section class="service">
      <div class="svtop"><div class="bar"><i id="nightFill"></i></div><span id="svMoney"></span></div>
      <div class="room">
        <div class="front" id="front"></div>
        <ol class="line" id="line"></ol>
      </div>
      <div class="brew" id="brew" hidden>
        <p id="brewName"></p>
        <div class="gauge"><span class="z1"></span><span class="z2"></span><span class="z3"></span><span class="z2"></span><span class="z1"></span><i id="needle"></i></div>
        <button class="primary big" data-act="fire">불을 끈다</button>
      </div>
      <div class="medbar" id="medbar"></div>
    </section>`;
  renderMedbar();
  renderQueue();
  G.lastNight = performance.now();
}

const patience = () => (G.s.flags.zhangfei ? 45 : 30);

function renderMedbar() {
  const s = G.s;
  const n = G.night;
  const front = n.queue[0];
  $('medbar').innerHTML = s.menu.map((id) => {
    const d = s.meds[id].doses;
    return `<button data-act="serve" data-id="${id}" ${d.n > 0 && front && !n.brewing ? '' : 'disabled'}>
      <b>${RECIPES[id].name}</b><span>${RECIPES[id].cures}</span><small>${d.n}첩 남음</small></button>`;
  }).join('') + `<button class="ghost" data-act="send" ${front && !n.brewing ? '' : 'disabled'}><b>돌려보내기</b><span>맞는 약이 없을 때</span></button>`;
}

function renderQueue() {
  const n = G.night;
  const front = n.queue[0];
  const fr = $('front');
  if (!front) {
    fr.innerHTML = `<p class="empty">${n.types.length ? '다음 환자를 기다리는 중...' : '오늘 환자를 모두 보았습니다.'}</p>`;
  } else {
    const P = PATIENTS[front.type];
    fr.innerHTML = `<canvas class="por" id="frontPor"></canvas>
      <div class="bubble"><b>${P.name}</b><p>"${P.line}"</p>${front.type === 'drunk' ? '<small>코끝이 빨갛고 술 냄새가 난다.</small>' : ''}${front.type === 'scholar' ? '<small>눈이 벌겋게 충혈되어 있다.</small>' : ''}</div>`;
    paintPortrait($('frontPor'), front.type);
  }
  $('line').innerHTML = n.queue.slice(1, 6).map((q) => `<li><canvas data-por="${q.type}"></canvas><i style="width:${(q.wait / q.max) * 100}%"></i></li>`).join('');
  for (const c of $('line').querySelectorAll('canvas')) paintPortrait(c, c.dataset.por);
}

function pickMed(id) {
  const n = G.night;
  if (!n.queue[0] || n.brewing) return;
  n.brewing = { id, pos: 0, dir: 1 };
  $('brew').hidden = false;
  $('brewName').textContent = `${RECIPES[id].name}을(를) 달이는 중 · 바늘이 가운데 초록에 올 때 불을 끄세요`;
  renderMedbar();
}

function stopBrew() {
  const n = G.night, s = G.s;
  if (!n.brewing) return;
  const grade = brewGrade(n.brewing.pos);
  const id = n.brewing.id;
  n.brewing = null;
  $('brew').hidden = true;
  const p = n.queue.shift();
  const r = serve(s, p.type, id, grade);
  if (p.type === 'zhangfei') {
    if (r.ok) {
      s.flags.zhangfei = true;
      s.flags.zhangfeiVisit = false;
      toast('장비가 조수로 합류했다! 환자들이 더 오래 기다려 준다', 'good');
    } else toast('장비: "이걸로는 안 낫소! 내일 다시 오리다"', 'bad');
  } else if (r.ok) {
    n.earned += r.coins;
    n.stars += r.stars;
    n.served += 1;
    toast(`${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)} ${r.coins}냥${r.hq ? ' (상급 약)' : ''}`, 'good');
  } else {
    n.wrong += 1;
    toast('맞지 않는 약이었다... 돈을 못 받고 평판이 떨어졌다', 'bad');
  }
  renderQueue();
  renderMedbar();
}

function sendAway() {
  const n = G.night;
  if (!n.queue[0] || n.brewing) return;
  const p = n.queue.shift();
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
    n.queue.push({ type, wait: max, max, id: n.next++ });
    n.spawnT = n.interval;
    renderQueue();
    renderMedbar();
  }
  let changed = false;
  for (const q of n.queue) {
    if (q === n.queue[0] && n.brewing) continue;
    q.wait -= dt;
  }
  const gone = n.queue.filter((q) => q.wait <= 0);
  for (const q of gone) {
    if (q.type === 'zhangfei') toast('장비가 기다리다 돌아갔다. 내일 다시 온다', 'bad');
    else { s.rep = Math.max(0, s.rep - 1); n.left += 1; toast(`${PATIENTS[q.type].name}이(가) 화가 나서 돌아갔다`, 'bad'); }
    changed = true;
  }
  if (gone.length) n.queue = n.queue.filter((q) => q.wait > 0);
  if (changed) { renderQueue(); renderMedbar(); }
  if (n.brewing) {
    const b = n.brewing;
    b.pos += b.dir * dt * 1.25;
    if (b.pos > 1) { b.pos = 1; b.dir = -1; }
    if (b.pos < 0) { b.pos = 0; b.dir = 1; }
    $('needle').style.left = `${b.pos * 100}%`;
  }
  $('nightFill').style.width = `${Math.max(0, 1 - n.t / NIGHT_SECONDS) * 100}%`;
  $('svMoney').textContent = `오늘 ${n.earned}냥 · 별 ${n.stars}`;
  for (const [i, li] of [...$('line').children].entries()) {
    const q = n.queue[i + 1];
    if (q) li.querySelector('i').style.width = `${(q.wait / q.max) * 100}%`;
  }
  const done = !n.types.length && !n.queue.length;
  if ((n.t >= NIGHT_SECONDS || done) && !n.brewing) endService();
}

function endService() {
  const n = G.night, s = G.s;
  G.night = null;
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
}

function sleep() {
  const s = G.s;
  if (s.day >= DAYS) return renderEnding();
  s.day += 1;
  startDay();
}

function renderEnding() {
  const s = G.s;
  s.phase = 'end';
  save();
  const meds = Object.keys(s.meds).map((id) => `${RECIPES[id].name} ${s.meds[id].level}단계`).join(', ');
  $('nightBody').innerHTML = `<section class="summary ending"><p class="eyebrow">시제품 1 · 마을 뒷들</p><h2>1부 끝</h2>
    <p>일주일 동안 한의원을 꾸렸습니다. 엽전 ${s.money}냥, 평판 ${s.rep}.</p>
    <p>익힌 약: ${meds}</p>
    <p>${s.flags.zhangfei ? '장비가 조수로 들어왔습니다. "형님들께도 의원 양반 얘기를 해 두겠소!"' : '개울가의 큰 사내는 끝내 한의원에 오지 않았습니다. 다음에는 칡즙을 미리 달여 두세요.'}</p>
    <hr><p>다음 이야기: 쓰러진 나무 너머 대나무 숲. 도끼, 첫 보스 「외눈 멧돼지」, 유비 삼형제가 기다립니다.</p>
    <div class="go"><button class="primary big" data-act="restart">처음부터 다시</button></div></section>`;
}

function restart() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* 무시 */ }
  G = { ...freshGame(), ...runtime() };
  startDay();
}

// ---------- 시작 ----------

function runtime() {
  return { props: [], ents: [], arrows: [], floats: [], time: 0, clock: 0, mode: 'hand', arrowType: 'normal', cam: { x: 0, y: 0 }, paused: false, night: null };
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
  view.ts = Math.max(18, Math.round(portrait ? r.width / 13 : Math.min(r.width / 22, r.height / 13)));
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G) {
    G.clock += dt;
    if (G.s.phase === 'day' && G.player) {
      updateDay(dt);
      render();
      updateHud();
    } else if (G.night) updateNight(dt);
  }
  requestAnimationFrame(frame);
}

function bindPad() {
  for (const b of document.querySelectorAll('[data-pad]')) {
    const k = b.dataset.pad;
    const on = (e) => { e.preventDefault(); pad[k] = true; b.classList.add('on'); b.setPointerCapture?.(e.pointerId); };
    const off = () => { pad[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('lostpointercapture', off);
  }
  for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));
  for (const b of document.querySelectorAll('[data-arrow]')) {
    b.addEventListener('click', () => {
      G.arrowType = b.dataset.arrow;
      for (const x of document.querySelectorAll('[data-arrow]')) x.classList.toggle('on', x === b);
    });
  }
  $('homeBtn').addEventListener('click', () => { if (!G.paused) askHome(); });
  $('bagBtn').addEventListener('click', () => {
    if (G.paused) return;
    openPanel({
      title: '바구니',
      body: Object.entries(G.s.inv).filter(([, v]) => v.n > 0).map(([id, v]) => `${MATERIALS[id].name} ${v.n}${v.hq ? ` (상급 ${v.hq})` : ''}`).join('\n') || '아직 아무것도 없습니다.',
      choices: [{ label: '닫기', onClick: closePanel }],
    });
  });
}

function boot(hotData) {
  const data = restore(hotData) ?? loadSaved() ?? freshGame();
  G = { ...data, ...runtime() };
  resize();
  bindPad();
  cvs.addEventListener('pointerdown', onPointerDown);
  cvs.addEventListener('pointermove', onPointerMove);
  cvs.addEventListener('pointerup', onPointerUp);
  cvs.addEventListener('pointercancel', onPointerUp);
  $('nightBody').addEventListener('click', onNightClick);
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (e) => { keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key); if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault(); });
  window.addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  window.addEventListener('blur', () => keys.clear());
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
