import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, SEA, floorY } from '../src/world.js';
import { computeLight } from '../src/light.js';

test('the sea darkens with depth', () => {
  const w = makeWorld();
  const L = computeLight(w, 100, 0, 130, 119, []);
  assert.equal(L.at(110, SEA - 2), 1);
  assert.ok(L.at(110, SEA + 5) > L.at(110, SEA + 40));
  assert.ok(L.at(110, SEA + 40) > L.at(110, SEA + 80));
});

test('rock and sand block light', () => {
  const w = makeWorld();
  const L = computeLight(w, 100, 0, 130, 119, []);
  const f = floorY(w, 110);
  assert.ok(L.at(110, f + 6) < 0.05);
});

test('the lantern lights the dark water around the diver', () => {
  const w = makeWorld();
  const y = floorY(w, 128) - 2;
  const dark = computeLight(w, 100, 0, 140, 119, []).at(128, y);
  const lit = computeLight(w, 100, 0, 140, 119, [{ x: 128, y, r: 0.8 }]).at(128, y);
  assert.ok(lit > 0.79 && lit > dark + 0.3);
});
