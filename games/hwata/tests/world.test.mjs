import test from 'node:test';
import assert from 'node:assert/strict';
import {
  W, H, T, makeWorld, tile, setTile, isSolid, canDig, surfaceY, isExposed, spawnDaily, ZONES,
} from '../src/world.js';

const seq = (seed = 1) => { let x = seed; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; };

test('world is 240 by 50 with stone at the bottom', () => {
  const w = makeWorld();
  assert.equal(W, 240);
  assert.equal(H, 50);
  assert.equal(tile(w, 100, H - 1), T.STONE);
  assert.equal(isSolid(w, -1, 10), true); // 맵 밖은 벽
});

test('the hill is six tiles above the field', () => {
  const w = makeWorld();
  assert.equal(surfaceY(w, 100) - surfaceY(w, 160), 6);
});

test('the stream holds water', () => {
  const w = makeWorld();
  const x = 128;
  assert.equal(tile(w, x, surfaceY(w, x) - 1), T.WATER);
});

test('the fallen log blocks the way and cannot be dug', () => {
  const w = makeWorld();
  const x = ZONES.log[0];
  const y = surfaceY(w, x - 2) - 1;
  assert.equal(tile(w, x, y), T.LOG);
  assert.equal(canDig(w, x, y), false);
  assert.equal(canDig(w, 100, surfaceY(w, 100)), true);
  assert.equal(canDig(w, 100, H - 1), false);
});

test('dug tiles stay dug', () => {
  const w = makeWorld();
  const y = surfaceY(w, 60);
  setTile(w, 60, y, T.AIR);
  assert.equal(isSolid(w, 60, y), false);
});

test('a root is exposed only after digging next to it', () => {
  const w = makeWorld();
  const x = 160, y = surfaceY(w, x) + 3;
  setTile(w, x, y, T.ROOT);
  assert.equal(isExposed(w, x, y), false);
  setTile(w, x + 1, y, T.AIR);
  assert.equal(isExposed(w, x, y), true);
});

test('daily spawns place the planned amounts in their zones', () => {
  const w = makeWorld();
  const props = spawnDaily(w, 1, seq());
  const n = (type) => props.filter((p) => p.type === type).length;
  assert.equal(n('mugwort'), 8);
  assert.equal(n('bellflower'), 4);
  assert.equal(n('kudzu'), 3);
  for (const p of props.filter((q) => q.type === 'kudzu')) {
    assert.equal(tile(w, p.x, p.y), T.ROOT);
    assert.ok(p.y - surfaceY(w, p.x) >= 7);
  }
  for (const p of props.filter((q) => q.type === 'mugwort')) {
    assert.ok(p.x >= ZONES.field[0] && p.x <= ZONES.field[1]);
    assert.equal(isSolid(w, p.x, p.y + 1), true);
    assert.equal(isSolid(w, p.x, p.y), false);
  }
});

test('old roots are cleared before new ones grow', () => {
  const w = makeWorld();
  spawnDaily(w, 1, seq(3));
  spawnDaily(w, 2, seq(4));
  let roots = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tile(w, x, y) === T.ROOT) roots++;
  assert.equal(roots, 7);
});
