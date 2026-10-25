import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, setTile, surfaceY, T } from '../src/world.js';
import { computeLight } from '../src/light.js';

test('open sky is fully lit and deep soil is dark', () => {
  const w = makeWorld();
  const L = computeLight(w, 50, 0, 80, 49, []);
  assert.equal(L.at(60, 10), 1);
  assert.ok(L.at(60, 42) < 0.05);
});

test('light fades a few blocks into the ground', () => {
  const w = makeWorld();
  const L = computeLight(w, 50, 0, 80, 49, []);
  const top = surfaceY(w, 60);
  assert.ok(L.at(60, top) > L.at(60, top + 3));
  assert.ok(L.at(60, top + 3) > 0);
});

test('a dug shaft lets light down', () => {
  const w = makeWorld();
  const top = surfaceY(w, 60);
  const closed = computeLight(w, 50, 0, 80, 49, []).at(60, top + 8);
  for (let y = top; y <= top + 8; y++) setTile(w, 60, y, T.AIR);
  const open = computeLight(w, 50, 0, 80, 49, []).at(60, top + 8);
  assert.ok(open > closed + 0.5);
});

test('the player lantern lights nearby tiles', () => {
  const w = makeWorld();
  const top = surfaceY(w, 60);
  const dark = computeLight(w, 50, 0, 80, 49, []).at(60, top + 12);
  const lit = computeLight(w, 50, 0, 80, 49, [{ x: 60, y: top + 12, r: 0.7 }]).at(60, top + 12);
  assert.ok(lit > 0.69 && lit > dark);
});
