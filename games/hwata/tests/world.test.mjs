import test from 'node:test';
import assert from 'node:assert/strict';
import {
  W, H, SEA, T, ZONES, makeWorld, tile, setTile, isSolid, isWater, canDig, floorY, chestSpots, spawnDaily,
} from '../src/world.js';
import { POTS } from '../src/data.js';

const seq = (seed = 1) => { let x = seed; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; };

test('sea is 160 wide and 120 deep with air above the surface', () => {
  const w = makeWorld();
  assert.equal(W, 160);
  assert.equal(H, 120);
  assert.equal(tile(w, 40, SEA - 1), T.AIR);
  assert.equal(isWater(w, 40, SEA), true);
  assert.equal(tile(w, 40, H - 1), T.ROCK);
});

test('the boat floats over water near the shore', () => {
  const w = makeWorld();
  assert.equal(isWater(w, 14, SEA + 1), true);
  assert.ok(floorY(w, 2) <= SEA); // 모래사장
});

test('the sea gets deeper toward the trench', () => {
  const w = makeWorld();
  const shallow = floorY(w, 25), reef = floorY(w, 70), deep = floorY(w, 110), trench = floorY(w, 128);
  assert.ok(shallow < reef && reef < deep && deep < trench, `${shallow} ${reef} ${deep} ${trench}`);
  assert.ok(trench > 100);
});

test('sand can be dug, rock cannot', () => {
  const w = makeWorld();
  const y = floorY(w, 25);
  assert.equal(tile(w, 25, y), T.SAND);
  assert.equal(canDig(w, 25, y), true);
  assert.equal(canDig(w, 25, H - 1), false);
  setTile(w, 25, y, T.WATER);
  assert.equal(isSolid(w, 25, y), false);
});

test('every chest is half buried on the sea floor', () => {
  const w = makeWorld();
  const spots = chestSpots(w);
  assert.equal(spots.length, POTS.length);
  for (const c of spots) {
    assert.equal(tile(w, c.x, c.y), T.CHEST);
    assert.equal(isWater(w, c.x, c.y - 1), true);
  }
});

test('daily herbs grow in their zones on the floor', () => {
  const w = makeWorld();
  const props = spawnDaily(w, 1, seq());
  const n = (t) => props.filter((p) => p.type === t).length;
  assert.equal(n('seaweed'), 9);
  assert.equal(n('kelp'), 7);
  assert.equal(n('oyster'), 7);
  assert.equal(n('seaCucumber'), 5);
  for (const p of props.filter((q) => q.type === 'seaweed')) {
    assert.ok(p.x >= ZONES.shallow[0] && p.x <= ZONES.shallow[1]);
    assert.equal(isWater(w, p.x, p.y), true);
    assert.equal(isSolid(w, p.x, p.y + 1), true);
  }
  for (const p of props.filter((q) => q.type === 'oyster')) {
    assert.equal(isWater(w, p.x, p.y), true);
    assert.equal(tile(w, p.x + p.side, p.y), T.ROCK);
  }
});

test('pearl clams are buried in deep sand and replaced each day', () => {
  const w = makeWorld();
  spawnDaily(w, 1, seq(3));
  spawnDaily(w, 2, seq(4));
  let clams = 0;
  for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === T.CLAM) clams++;
  assert.equal(clams, 3);
});
