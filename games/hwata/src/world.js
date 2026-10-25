// 바닷속 지도: 가로 160칸 × 세로 120칸 블록. y는 위에서 아래로 커진다. y < SEA 는 물 위(하늘).
import { DAILY_SPAWNS, CLOVER_CHANCE, POTS } from './data.js';

export const W = 160;
export const H = 120;
export const SEA = 10;
export const T = { AIR: 0, WATER: 1, SAND: 2, ROCK: 3, CHEST: 4, CLAM: 5 };

export const ZONES = {
  shore: [0, 7],
  shallow: [8, 44],
  reef: [45, 92],
  deep: [93, 117],
  trench: [118, 140],
  wall: [141, 159],
};

export const ZONE_NAMES = {
  shore: '바닷가', shallow: '얕은 바다', reef: '산호 비탈', deep: '깊은 바다', trench: '해구', wall: '바위 절벽',
};

export const BOAT_X = 13;

function floorHeight(x) {
  if (x <= 7) return 7 + Math.floor(x * 0.6);
  if (x <= 44) return Math.round(21 + Math.sin(x * 0.3) * 1.5 + Math.sin(x * 0.11) * 1.5);
  if (x <= 92) return Math.round(23 + ((x - 44) / 48) * 33 + Math.sin(x * 0.4) * 1.5);
  if (x <= 117) return Math.round(72 + Math.sin((x - 93) * 0.25) * 5);
  if (x <= 140) return 108 + Math.round(Math.sin(x * 0.5));
  return 9;
}

export function makeWorld() {
  const tiles = new Uint8Array(W * H);
  const w = { tiles };
  for (let x = 0; x < W; x++) {
    const f = floorHeight(x);
    for (let y = 0; y < H; y++) {
      let t = y < SEA ? T.AIR : T.WATER;
      if (y >= f) t = y < f + 3 && x <= 140 ? T.SAND : T.ROCK;
      if (y >= H - 2) t = T.ROCK;
      tiles[y * W + x] = t;
    }
  }
  // 산호 비탈의 바위 턱: 굴이 붙고 곰치가 숨는다
  for (const [x0, wid, hgt] of [[50, 4, 6], [61, 3, 8], [72, 5, 7], [83, 4, 9]]) {
    for (let x = x0; x < x0 + wid; x++) {
      const f = floorHeight(x);
      for (let y = f - hgt; y < f; y++) setTile(w, x, y, T.ROCK);
    }
  }
  // 깊은 바다의 바위 기둥과 해구의 벽
  for (const [x0, wid, hgt] of [[98, 3, 14], [108, 3, 10], [117, 2, 26], [139, 2, 30]]) {
    for (let x = x0; x < x0 + wid; x++) {
      const f = floorHeight(x);
      for (let y = f - hgt; y < f; y++) setTile(w, x, y, T.ROCK);
    }
  }
  for (const c of chestSpots(w)) setTile(w, c.x, c.y, T.CHEST);
  return w;
}

// 상자는 x 자리 바닥 맨 윗칸에 반쯤 묻혀 있다
export function chestSpots(w) {
  return POTS.map((p, i) => ({ i, x: p.x, y: floorHeight(p.x), loot: p.loot }));
}

const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

export function tile(w, x, y) {
  return inside(x, y) ? w.tiles[y * W + x] : T.ROCK;
}

export function setTile(w, x, y, t) {
  if (inside(x, y)) w.tiles[y * W + x] = t;
}

const SOLID = new Set([T.SAND, T.ROCK, T.CHEST, T.CLAM]);

export function isSolid(w, x, y) {
  return SOLID.has(tile(w, x, y));
}

export const isWater = (w, x, y) => tile(w, x, y) === T.WATER;

export function canDig(w, x, y) {
  const t = tile(w, x, y);
  return t === T.SAND || t === T.CHEST || t === T.CLAM;
}

// 위에서 처음 만나는 단단한 칸
export function floorY(w, x) {
  for (let y = 0; y < H; y++) if (isSolid(w, x, y)) return y;
  return H;
}

export function zoneAt(x) {
  for (const [k, [a, b]] of Object.entries(ZONES)) if (x >= a && x <= b) return k;
  return 'wall';
}

const FLOOR_ZONE = { seaweed: [8, 44], kelp: [30, 90], seaCucumber: [55, 136] };

// 날마다 약재를 새로 놓는다. 판 모래는 그대로 둔다.
export function spawnDaily(w, day, rng) {
  for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === T.CLAM) w.tiles[i] = T.SAND;
  const props = [];
  const used = new Set();
  let nextId = day * 1000;
  const pick = ([a, b]) => a + Math.floor(rng() * (b - a + 1));
  const add = (type, x, y, extra = {}) => { used.add(`${x},${y}`); props.push({ id: nextId++, type, x, y, ...extra }); };
  const onFloor = (type, range) => {
    for (let tries = 0; tries < 300; tries++) {
      const x = pick(range);
      const y = floorY(w, x) - 1;
      if (used.has(`${x},${y}`) || !isWater(w, x, y) || !isSolid(w, x, y + 1)) continue;
      add(type, x, y);
      return;
    }
  };
  for (const [type, range] of Object.entries(FLOOR_ZONE)) {
    for (let i = 0; i < DAILY_SPAWNS[type]; i++) onFloor(type, range);
  }
  // 굴은 바위 옆면에 붙는다
  for (let i = 0; i < DAILY_SPAWNS.oyster; i++) {
    for (let tries = 0; tries < 400; tries++) {
      const x = pick([45, 116]), y = pick([SEA + 8, 100]);
      if (!isWater(w, x, y) || used.has(`${x},${y}`)) continue;
      const side = tile(w, x + 1, y) === T.ROCK ? 1 : tile(w, x - 1, y) === T.ROCK ? -1 : 0;
      if (!side) continue;
      add('oyster', x, y, { side });
      break;
    }
  }
  // 진주조개: 깊은 모래 한 칸 아래
  for (let i = 0; i < 3; i++) {
    for (let tries = 0; tries < 200; tries++) {
      const x = pick([94, 138]);
      const y = floorY(w, x) + 1;
      if (tile(w, x, y) !== T.SAND || tile(w, x, y - 1) !== T.SAND) continue;
      setTile(w, x, y, T.CLAM);
      break;
    }
  }
  if (rng() < CLOVER_CHANCE) onFloor('clover', [20, 90]);
  return props;
}
