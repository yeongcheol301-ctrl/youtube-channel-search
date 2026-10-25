// 마을 뒷들 지도: 가로 240칸 × 세로 50칸 블록. y는 위에서 아래로 커진다.
import { DAILY_SPAWNS, CLOVER_CHANCE, POTS } from './data.js';

export const W = 240;
export const H = 50;
export const T = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WATER: 4, LADDER: 5, PLANK: 6, LOG: 7, ROOT: 8, POT: 9 };

export const ZONES = {
  clinic: [0, 15],
  path: [16, 55],
  field: [56, 120],
  stream: [121, 135],
  hill: [136, 205],
  forest: [206, 239],
  log: [226, 231],
};

export const ZONE_NAMES = {
  clinic: '한의원 앞마당', path: '밭둑길', field: '꽃 들판', stream: '개울', hill: '언덕', forest: '숲 가장자리',
};

export const BIG_TREE_X = 170;
export const STONE_Y = 44;

function groundHeight(x) {
  if (x <= 121) {
    if (x >= 66 && x <= 70) return 29;
    if (x >= 104 && x <= 108) return 29;
    if (x >= 36 && x <= 39) return 31;
    return 30;
  }
  if (x <= 134) return 34; // 개울 바닥
  if (x <= 135) return 30;
  if (x <= 205) return 24; // 언덕(6칸 높이 절벽)
  if (x <= 207) return 25;
  if (x <= 209) return 26;
  return 27;
}

export function makeWorld() {
  const tiles = new Uint8Array(W * H);
  const w = { tiles };
  for (let x = 0; x < W; x++) {
    const g = groundHeight(x);
    for (let y = 0; y < H; y++) {
      let t = T.AIR;
      if (y >= STONE_Y) t = T.STONE;
      else if (y === g) t = x >= 122 && x <= 134 ? T.DIRT : T.GRASS;
      else if (y > g) t = T.DIRT;
      else if (x >= 122 && x <= 134 && y >= 31) t = T.WATER;
      tiles[y * W + x] = t;
    }
  }
  // 토끼굴: 들판 땅속의 작은 굴
  for (let x = 92; x <= 99; x++) for (let y = 33; y <= 35; y++) setTile(w, x, y, T.AIR);
  // 쓰러진 큰 나무(통나무)와 그 뒤 바위벽
  const [l0, l1] = ZONES.log;
  for (let x = l0; x <= l1; x++) for (let y = 22; y <= 26; y++) setTile(w, x, y, T.LOG);
  for (let x = l1 + 1; x < W; x++) for (let y = 8; y <= 26; y++) setTile(w, x, y, T.STONE);
  for (const p of POTS) setTile(w, p.x, p.y, T.POT);
  return w;
}

const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

export function tile(w, x, y) {
  return inside(x, y) ? w.tiles[y * W + x] : T.STONE;
}

export function setTile(w, x, y, t) {
  if (inside(x, y)) w.tiles[y * W + x] = t;
}

// 발판(PLANK)은 위에서만 밟히는 판이라 벽으로 치지 않는다.
const SOLID = new Set([T.GRASS, T.DIRT, T.STONE, T.LOG, T.ROOT, T.POT]);

export function isSolid(w, x, y) {
  return SOLID.has(tile(w, x, y));
}

export function canDig(w, x, y) {
  const t = tile(w, x, y);
  return t === T.GRASS || t === T.DIRT || t === T.LADDER || t === T.PLANK || t === T.POT;
}

const SUPPORT = new Set([...SOLID, T.LADDER, T.PLANK]);

// 사다리·발판·흙을 놓을 수 있는가. 옆이나 위아래에 기댈 것이 있어야 하고, 발판과 흙은 몸과 겹치면 안 된다.
export function canPlace(w, x, y, kind, body) {
  if (!inside(x, y)) return false;
  const t = tile(w, x, y);
  if (t !== T.AIR && t !== T.WATER) return false;
  const leans = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => SUPPORT.has(tile(w, x + dx, y + dy)));
  if (!leans) return false;
  if (kind === T.LADDER) return true;
  return !(body && body.x < x + 1 && body.x + body.w > x && body.y < y + 1 && body.y + body.h > y);
}

export function surfaceY(w, x) {
  for (let y = 0; y < H; y++) if (isSolid(w, x, y)) return y;
  return H;
}

export function isExposed(w, x, y) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const t = tile(w, x + dx, y + dy);
    return t === T.AIR || t === T.WATER || t === T.LADDER;
  });
}

const SURFACE_ZONE = {
  plantain: 'path', dandelion: 'path', mugwort: 'field', chrysanthemum: 'field', tree: 'pathField',
};

function zoneRange(name) {
  if (name === 'pathField') return [18, 118];
  if (name === 'dropwort') return [114, 134];
  return ZONES[name];
}

// 날마다 약초·나무·뿌리를 새로 놓는다. 파낸 구멍과 놓은 사다리는 그대로 둔다.
export function spawnDaily(w, day, rng) {
  for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === T.ROOT) w.tiles[i] = T.DIRT;
  const props = [];
  const used = new Set();
  let nextId = day * 1000;
  const randX = ([a, b]) => a + Math.floor(rng() * (b - a + 1));
  const place = (type, range, ok, yOf) => {
    for (let tries = 0; tries < 200; tries++) {
      const x = randX(range);
      if (used.has(x)) continue;
      const y = yOf(x);
      if (!ok(x, y)) continue;
      used.add(x);
      props.push({ id: nextId++, type, x, y });
      return;
    }
  };
  const onSurface = (x) => surfaceY(w, x) - 1;
  const freeAbove = (x, y) => y > 0 && !isSolid(w, x, y) && tile(w, x, y) !== T.LADDER
    && tile(w, x, y + 1) !== T.PLANK && tile(w, x, y + 1) !== T.LOG;
  const dryAbove = (x, y) => freeAbove(x, y) && tile(w, x, y) !== T.WATER;

  for (const [type, zone] of Object.entries(SURFACE_ZONE)) {
    for (let i = 0; i < DAILY_SPAWNS[type]; i++) place(type, zoneRange(zone), dryAbove, onSurface);
  }
  for (let i = 0; i < DAILY_SPAWNS.dropwort; i++) place('dropwort', zoneRange('dropwort'), freeAbove, onSurface);

  const rootAt = (depth) => (x) => surfaceY(w, x) + depth;
  const dirtThere = (x, y) => tile(w, x, y) === T.DIRT && Math.abs(x - BIG_TREE_X) > 1;
  for (const [type, depth] of [['bellflower', 3], ['kudzu', 8]]) {
    for (let i = 0; i < DAILY_SPAWNS[type]; i++) {
      const before = props.length;
      place(type, [140, 200], dirtThere, rootAt(depth));
      if (props.length > before) setTile(w, props.at(-1).x, props.at(-1).y, T.ROOT);
    }
  }

  const trunkBase = surfaceY(w, BIG_TREE_X) - 1;
  for (let i = 0; i < DAILY_SPAWNS.cicada; i++) {
    props.push({ id: nextId++, type: 'cicada', x: BIG_TREE_X, y: trunkBase - i * 2 });
  }
  props.push({ id: nextId++, type: 'beehive', x: BIG_TREE_X + 2, y: trunkBase - 8 });
  if (rng() < CLOVER_CHANCE) place('clover', [212, 224], dryAbove, onSurface);
  return props;
}
