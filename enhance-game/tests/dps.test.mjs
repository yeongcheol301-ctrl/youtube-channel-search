import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBoss, weaponAttack, BIG_HP_MULT } from '../src/rules.js';
import { newGame, buy, ctxOf, buyUpgrade, upgradeCost, hearts, dpsSources } from '../src/state.js';
import { challengeBoss, rebirth } from '../src/progress.js';

test('every fifth stage is a big boss with triple health', () => {
  assert.equal(makeBoss(5).big, true); assert.equal(makeBoss(4).big, false);
  const plain = makeBoss(5).hp / BIG_HP_MULT;
  assert.ok(plain > makeBoss(4).hp);
});

test('attack upgrade: each level multiplies attack by 1.05 and costs more', () => {
  const s = newGame(); s.minerals = 1e9; buy(s, 'sword');
  const w = s.weapons[0];
  const a0 = weaponAttack(w, ctxOf(s));
  assert.equal(buyUpgrade(s).ok, true); assert.equal(buyUpgrade(s).ok, true);
  assert.ok(Math.abs(weaponAttack(w, ctxOf(s)) / a0 - 1.05 ** 2) < 1e-9);
  assert.ok(upgradeCost(2) > upgradeCost(1));
  s.minerals = 0; assert.equal(buyUpgrade(s).ok, false); assert.equal(s.upg, 2);
});

test('boss kills drop DPS orbs; the first big boss kill gives a heart that survives rebirth', () => {
  const s = newGame(); buy(s, 'sword');
  const w = s.weapons[0]; w.grade = 4; w.level = 15;
  s.maxStage = 4;
  const r = challengeBoss(s, 1);
  assert.equal(r.killed, true); assert.equal(r.heart, true);
  assert.equal(s.orbs, 1); assert.equal(hearts(s.meta), 1);
  assert.ok(Math.abs(dpsSources(s).hearts - 1.1) < 1e-9);
  const n = rebirth(s);
  assert.equal(n.orbs, 0, 'orbs reset each run'); assert.equal(n.upg, 0, 'upgrades reset each run');
  assert.equal(hearts(n.meta), 1, 'hearts stay');
  n.weapons = [w]; n.maxStage = 4;
  assert.equal(challengeBoss(n, 2).heart, false, 'the same big boss gives a heart only once ever');
});
