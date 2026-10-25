import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weaponAttack, weaponHitsPerSec, bossFight, makeBoss, buildingStats, buildingDps, mineralsPerSec } from '../src/rules.js';

const ctx = { bowCount: 0, perm: {} };
const w = (type, extra = {}) => ({ id: 1, type, grade: 0, level: 0, pity: 0, traits: [], ...extra });
const boss = (extra) => ({ stage: 1, types: [], hp: 1e12, armor: 0, barrier: false, hitsNeeded: 0, regenPct: 0, ...extra });

test('magic ignores armor', () => {
  const b = boss({ armor: 1000 });
  const sword = w('sword', { level: 8, grade: 2 });
  const staff = w('staff', { level: 8, grade: 2 });
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
  const r = bossFight([w('staff', { level: 15, grade: 4 })], boss({ hp: 10, hitsNeeded: 1000 }), ctx);
  assert.equal(r.killed, false);
  const r2 = bossFight([w('staff', { level: 15, grade: 4 })], boss({ hp: 10 }), ctx);
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
  const strong = [w('sword', { level: 8, grade: 3 })];
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

test('minerals scale linearly with mining DPS', () => {
  const one = [w('sword', { level: 10 })];
  const two = [w('sword', { level: 10 }), w('sword', { level: 10, id: 2 })];
  assert.ok(Math.abs(mineralsPerSec(two, 0, ctx) / mineralsPerSec(one, 0, ctx) - 2) < 1e-9);
  const strong = [w('sword', { level: 8, grade: 2 })];
  assert.ok(Math.abs(mineralsPerSec(strong, 0, ctx) / buildingDps(strong, ctx) - mineralsPerSec(one, 0, ctx) / buildingDps(one, ctx)) < 1e-9);
});

test('a harder vein pays more per hit for a weapon strong enough to bite', () => {
  const one = [w('sword', { grade: 1, level: 5 })];
  assert.ok(mineralsPerSec(one, 1, ctx) > mineralsPerSec(one, 0, ctx));
});


test('attack grows with level, and promotion to +0 of the next grade beats +10', () => {
  assert.ok(weaponAttack(w('sword', { level: 10 }), ctx) > weaponAttack(w('sword'), ctx));
  assert.ok(weaponAttack(w('sword', { grade: 1, level: 0 }), ctx) > 1.2 * weaponAttack(w('sword', { level: 10 }), ctx));
});

test('hard veins ignore weak weapons no matter how many', async () => {
  const { buildingStats: vein, mineHit } = await import('../src/rules.js');
  const hard = 4;
  assert.ok(vein(hard).armor > 0 && vein(0).armor === 0);
  const weak = Array.from({ length: 50 }, (_, i) => w('sword', { id: i + 1 }));
  assert.equal(mineHit(weak[0], hard, ctx), 0, 'a +0 sword just bounces off');
  assert.equal(mineralsPerSec(weak, hard, ctx), 0);
  const strong = [w('sword', { grade: 2, level: 5 })];
  assert.ok(mineralsPerSec(strong, hard, ctx) > 0);
  assert.ok(mineralsPerSec(strong, hard, ctx) > mineralsPerSec(strong, 0, ctx), 'strong weapons earn more on the harder vein');
});

test('axe armor break helps it bite into hard veins', async () => {
  const { mineHit } = await import('../src/rules.js');
  const axe = w('axe', { level: 0 }), sword = w('sword', { level: 4 });
  assert.ok(weaponAttack(sword, ctx) > weaponAttack(axe, ctx) / 3);
  assert.ok(mineHit(axe, 1, ctx) > 0);
});
