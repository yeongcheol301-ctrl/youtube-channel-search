import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weaponAttack, rollEnhance, AWAKEN_MULT } from '../src/rules.js';
import { newGame, buy, enhance, awaken, awakenCost, canAwaken, collection, ctxOf, promoteMaterial } from '../src/state.js';
import { rebirth } from '../src/progress.js';

const rich = () => { const s = newGame(); s.minerals = 1e15; return s; };

test('only a 히어로 or better weapon can awaken; it hits three times harder and never breaks', () => {
  const s = rich(); buy(s, 'sword');
  const w = s.weapons[0];
  w.grade = 2; assert.equal(awaken(s, w.id).ok, false);
  w.grade = 3; w.level = 6; w.traits = Array(7).fill('atkPct');
  const before = weaponAttack(w, ctxOf(s));
  assert.equal(canAwaken(s, w), true);
  const m = s.minerals;
  assert.equal(awaken(s, w.id).ok, true);
  assert.equal(s.minerals, m - awakenCost());
  assert.ok(weaponAttack(w, ctxOf(s)) >= before * AWAKEN_MULT);
  assert.equal(awaken(s, w.id).ok, false, 'once only');
  const r = rollEnhance(w, ((q) => () => q.shift())([0.99, 0.0]));
  assert.equal(r.result, 'down', 'awakened weapons drop instead of breaking');
});

test('an awakened weapon is never eaten as promotion material', () => {
  const s = rich(); buy(s, 'sword'); buy(s, 'sword');
  const [a, b] = s.weapons; a.grade = b.grade = 4; b.awakened = true; a.level = 15;
  assert.equal(promoteMaterial(s, a), null);
});

test('the awakened weapon returns after rebirth as a 일반 +0 awakened weapon', () => {
  const s = rich(); s.meta.unlocked.push('axe'); buy(s, 'axe');
  const w = s.weapons[0]; w.grade = 3; awaken(s, w.id);
  s.maxStage = 3;
  const n = rebirth(s);
  assert.equal(n.weapons.length, 1);
  assert.deepEqual([n.weapons[0].type, n.weapons[0].grade, n.weapons[0].level, n.weapons[0].awakened], ['axe', 0, 0, true]);
  const again = rebirth(n);
  assert.equal(again.weapons[0].awakened, true, 'the relic stays for good');
});

test('collection: every new weapon-grade gives +2% attack, a full set +10% more, kept through rebirth', () => {
  const s = rich(); buy(s, 'sword');
  assert.equal(collection(s.meta).count, 1);
  const base = weaponAttack(s.weapons[0], ctxOf(s));
  s.meta.discovered.push('sword:1:0', 'sword:2:0', 'sword:3:3', 'sword:4:0', 'sword:4:9');
  const c = collection(s.meta);
  assert.equal(c.count, 5); assert.deepEqual(c.sets, ['sword']);
  assert.ok(Math.abs(c.bonus - (5 * 0.02 + 0.1)) < 1e-9);
  assert.ok(Math.abs(weaponAttack(s.weapons[0], ctxOf(s)) / base - (1 + c.bonus) / 1.02) < 1e-9);
  s.maxStage = 1;
  assert.equal(collection(rebirth(s).meta).count, 5);
});

test('enhancing into a new grade records it in the collection', () => {
  const s = rich(); buy(s, 'sword');
  const w = s.weapons[0]; w.level = 1;
  enhance(s, w.id, () => 0);
  assert.equal(collection(s.meta).count, 1);
});

test('only one awakened weapon at a time', () => {
  const s = rich(); buy(s, 'sword'); buy(s, 'sword');
  const [a, b] = s.weapons; a.grade = b.grade = 3;
  assert.equal(awaken(s, a.id).ok, true);
  assert.equal(canAwaken(s, b), false);
  assert.equal(awaken(s, b.id).ok, false);
});
