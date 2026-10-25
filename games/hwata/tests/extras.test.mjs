import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newState, addItem, count, maxStamina, herbZone, brewGrade, openPot, hasPage, digHardness,
} from '../src/rules.js';
import { POTS, PAGES } from '../src/data.js';
import { makeWorld, tile, T, canPlace, isSolid, surfaceY } from '../src/world.js';

test('first find of a material is reported once and recorded in the dex', () => {
  const s = newState();
  assert.equal(addItem(s, 'mugwort'), true);
  assert.equal(addItem(s, 'mugwort'), false);
  assert.equal(s.dex.mugwort, true);
});

test('pages of the Cheongnangseo grant perks', () => {
  const s = newState();
  assert.equal(maxStamina(s), 100);
  assert.deepEqual(herbZone(s), [0.62, 0.84]);
  openPot(s, { page: 1 });
  assert.equal(hasPage(s, 1), true);
  assert.deepEqual(herbZone(s), [0.56, 0.9]);
  openPot(s, { page: 3 });
  assert.equal(maxStamina(s), 130);
});

test('second page widens the brewing sweet spot', () => {
  assert.equal(brewGrade(0.39, false), 2);
  assert.equal(brewGrade(0.39, true), 3);
});

test('pots pay money, arrows or items', () => {
  const s = newState();
  assert.deepEqual(openPot(s, { money: 15 }), { ok: true, text: '엽전 15냥' });
  assert.equal(s.money, 65);
  openPot(s, { arrows: 5 });
  assert.equal(s.arrows, 25);
  openPot(s, { item: 'honey', n: 2 });
  assert.equal(count(s, 'honey'), 2);
});

test('a page found twice does nothing new', () => {
  const s = newState();
  openPot(s, { page: 2 });
  openPot(s, { page: 2 });
  assert.deepEqual(s.pages, [2]);
});

test('three pages are hidden in pots', () => {
  const pages = POTS.filter((p) => p.loot.page).map((p) => p.loot.page).sort();
  assert.deepEqual(pages, [1, 2, 3]);
  assert.equal(Object.keys(PAGES).length, 3);
});

test('pots sit underground in the world', () => {
  const w = makeWorld();
  for (const p of POTS) {
    assert.equal(tile(w, p.x, p.y), T.POT);
    assert.ok(p.y > surfaceY(w, p.x) + 1, `pot at ${p.x} too shallow`);
  }
});

test('grass and dirt take time to break, faster with the better hoe', () => {
  const s = newState();
  assert.equal(digHardness(s, T.DIRT), 0.45);
  assert.equal(digHardness(s, T.GRASS), 0.35);
  s.upgrades.hoe = true;
  assert.equal(digHardness(s, T.DIRT), 0.225);
});

test('ladders need something to lean on, planks and dirt cannot fill the player', () => {
  const w = makeWorld();
  const x = 60, top = surfaceY(w, x);
  const player = { x: 62, y: top - 2, w: 0.7, h: 1.8 };
  assert.equal(canPlace(w, x, top - 1, T.LADDER, player), true); // 땅 위
  assert.equal(canPlace(w, x, top - 6, T.LADDER, player), false); // 허공
  assert.equal(canPlace(w, x, top, T.LADDER, player), false); // 흙 속
  assert.equal(canPlace(w, 62, top - 1, T.DIRT, player), false); // 몸이 있는 자리
  assert.equal(canPlace(w, 62, top - 1, T.LADDER, player), true); // 사다리는 겹쳐도 됨
});

test('planks are platforms, not walls', () => {
  const w = makeWorld();
  assert.equal(isSolid(w, 0, 0), false);
  w.tiles[5 * 240 + 5] = T.PLANK;
  assert.equal(isSolid(w, 5, 5), false);
});
