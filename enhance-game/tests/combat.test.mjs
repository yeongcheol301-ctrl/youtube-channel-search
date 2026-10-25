import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weaponAttack, weaponHitsPerSec, bossFight, makeBoss, buildingStats, buildingDps, mineralsPerSec } from '../src/rules.js';

const ctx = { bowCount: 0, perm: {} };
const w = (type, extra = {}) => ({ id: 1, type, grade: 0, level: 0, pity: 0, traits: [], ...extra });
const boss = (extra) => ({ stage: 1, types: [], hp: 1e12, armor: 0, barrier: false, hitsNeeded: 0, regenPct: 0, ...extra });

test('attack grows with level and grade', () => {
  assert.ok(weaponAttack(w('sword', { level: 10 }), ctx) > weaponAttack(w('sword'), ctx));
});

test('magic ignores armor', () => {
  const b = boss({ armor: 1000 });
  const sword = w('sword', { level: 30 });
  const staff = w('staff', { level: 30 });
  const ratio = weaponAttack(staff, ctx) / weaponAttack(sword, ctx);
  const ds = bossFight([sword], b, ctx).damage, dm = bossFight([staff], b, ctx).damage;
  assert.ok(dm / ds > ratio, 'staff should beat sword by more than raw attack ratio');
});

test('armor break raises physical damage', () => {
  const b = boss({ armor: 5 });
  const plain = bossFight([w('sword', { level: 5 })], b, ctx).damage;
  const broken = bossFight([w('sword', { level: 5, traits: ['armorBreak'] })], b, ctx).damage;
  assert.ok(broken > plain);
});

test('barrier halves physical damage only', () => {
  const s = w('sword', { level: 5 }), st = w('staff', { level: 5 });
  assert.equal(bossFight([s], boss({ barrier: true }), ctx).damage, bossFight([s], boss(), ctx).damage / 2);
  assert.equal(bossFight([st], boss({ barrier: true }), ctx).damage, bossFight([st], boss(), ctx).damage);
});

test('multi-hit boss needs enough hits', () => {
  const r = bossFight([w('staff', { level: 50, grade: 4 })], boss({ hp: 10, hitsNeeded: 1000 }), ctx);
  assert.equal(r.killed, false);
  const r2 = bossFight([w('staff', { level: 50, grade: 4 })], boss({ hp: 10 }), ctx);
  assert.equal(r2.killed, true);
});

test('regen boss survives weak damage', () => {
  const r = bossFight([w('sword')], boss({ hp: 100, regenPct: 0.05 }), ctx);
  assert.equal(r.killed, false);
});

test('axe hits buildings twice as hard', () => {
  const sword = w('sword', { level: 5 });
  const axe = w('axe', { level: 5 });
  const perAtk = (x) => buildingDps([x], ctx) / (weaponAttack(x, ctx) * weaponHitsPerSec(x));
  assert.ok(Math.abs(perAtk(axe) / perAtk(sword) - 2) < 1e-9);
});

test('minerals per second rise with stronger weapons', () => {
  assert.ok(mineralsPerSec([w('sword', { level: 10 })], 0, ctx) > mineralsPerSec([w('sword')], 0, ctx));
  assert.equal(mineralsPerSec([], 0, ctx), 0);
});

test('higher building tier pays more once damage is high', () => {
  const strong = [w('sword', { level: 40, grade: 2 })];
  assert.ok(mineralsPerSec(strong, 3, ctx) > mineralsPerSec(strong, 0, ctx));
  assert.ok(buildingStats(1).hp > buildingStats(0).hp && buildingStats(1).reward > buildingStats(0).reward);
});

test('bows strengthen each other', () => {
  const b = w('bow');
  assert.ok(Math.abs(weaponAttack(b, { ...ctx, bowCount: 2 }) / weaponAttack(b, { ...ctx, bowCount: 1 }) - 1.2 / 1.1) < 1e-9);
});

test('makeBoss is deterministic and grows', () => {
  assert.deepEqual(makeBoss(3), makeBoss(3));
  assert.ok(makeBoss(4).hp > makeBoss(3).hp);
  assert.ok(makeBoss(7).types.length === 2);
});

test('combining two +10 into next grade is an upgrade', () => {
  assert.ok(weaponAttack(w('sword', { grade: 1 }), ctx) > 1.5 * weaponAttack(w('sword', { level: 10 }), ctx));
  assert.ok(weaponAttack(w('sword', { grade: 2 }), ctx) > weaponAttack(w('sword', { grade: 1 }), ctx));
});

test('minerals scale linearly with mining DPS', () => {
  const one = [w('sword', { level: 10 })];
  const two = [w('sword', { level: 10 }), w('sword', { level: 10, id: 2 })];
  assert.ok(Math.abs(mineralsPerSec(two, 0, ctx) / mineralsPerSec(one, 0, ctx) - 2) < 1e-9);
  const strong = [w('sword', { level: 30 })];
  assert.ok(Math.abs(mineralsPerSec(strong, 0, ctx) / buildingDps(strong, ctx) - mineralsPerSec(one, 0, ctx) / buildingDps(one, ctx)) < 1e-9);
});

test('a building upgrade raises minerals per DPS', () => {
  const one = [w('sword', { level: 5 })];
  assert.ok(mineralsPerSec(one, 1, ctx) > mineralsPerSec(one, 0, ctx));
});
