import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, buy, assign } from '../src/state.js';
import { challengeBoss, measureDps, rebirthCoins, rebirth, unlock, buyPerm, PERMS, autoStep, bulkSell, shouldHintRebirth } from '../src/progress.js';

const always = (v) => () => v;
const within = (a, b, pct) => assert.ok(Math.abs(a - b) <= b * pct, `${a} not within ${pct} of ${b}`);

test('boss challenge needs at least one weapon', () => {
  assert.equal(challengeBoss(newGame()).ok, false);
});

test('strong weapons clear stage 1 and earn minerals', () => {
  const s = newGame(); buy(s, 'sword'); assign(s, s.weapons[0].id, 'battle'); s.weapons[0].level = 30; const m = s.minerals;
  const r = challengeBoss(s);
  assert.equal(r.killed, true); assert.equal(s.maxStage, 1); assert.ok(s.minerals > m);
});

test('all weapons go to the boss even while mining', () => {
  const s = newGame(); buy(s, 'sword'); s.weapons[0].level = 30;
  assert.equal(challengeBoss(s).killed, true); assert.equal(s.maxStage, 1);
});

test('weak weapons fail and stage stays', () => {
  const s = newGame(); buy(s, 'sword'); assign(s, s.weapons[0].id, 'battle');
  assert.equal(challengeBoss(s).killed, false); assert.equal(s.maxStage, 0);
});

test('dps measurement records best and time', () => {
  const s = newGame(); buy(s, 'sword'); assign(s, s.weapons[0].id, 'battle');
  const d = measureDps(s, 5000);
  assert.ok(d > 0); assert.equal(s.bestDps, d); assert.equal(s.bestDpsAt, 5000);
  assert.equal(measureDps(s, 9000), d); assert.equal(s.bestDpsAt, 5000);
});

test('rebirth coins follow boss stage', () => {
  const s = newGame();
  s.maxStage = 1; assert.equal(rebirthCoins(s), 10);
  s.maxStage = 3; within(rebirthCoins(s), 68, 0.05);
  s.maxStage = 10; within(rebirthCoins(s), 562, 0.05);
});

test('rebirth resets run and keeps meta, ad doubles coins', () => {
  const s = newGame(); buy(s, 'sword'); s.maxStage = 3; s.minerals = 99999;
  const n = rebirth(s, { adDouble: true });
  assert.equal(n.weapons.length, 0); assert.ok(n.minerals < 99999);
  assert.equal(n.meta.rebirths, 1); within(n.meta.coins, 136, 0.05);
});

test('rebirth never softlocks', () => {
  let s = newGame();
  for (let i = 0; i < 3; i++) s = rebirth(s, {});
  assert.equal(buy(s, 'sword').ok, true);
});

test('unlock needs coins and order', () => {
  const s = newGame(); s.meta.coins = 29;
  assert.equal(unlock(s, 'axe').ok, false);
  s.meta.coins = 1000;
  assert.equal(unlock(s, 'staff').ok, false);
  assert.equal(unlock(s, 'axe').ok, true); assert.equal(s.meta.coins, 970);
  s.minerals = 1000; assert.equal(buy(s, 'axe').ok, true);
});

test('success perm caps at +10 points', () => {
  const s = newGame(); s.meta.coins = 1e12;
  for (let i = 0; i < PERMS.success.max; i++) assert.equal(buyPerm(s, 'success').ok, true);
  assert.equal(buyPerm(s, 'success').ok, false);
});

test('automation is available from the first run', () => {
  const s = newGame(); s.minerals = 1e6;
  assert.equal(autoStep(s, { target: 5 }, always(0)).ok, true); assert.equal(s.weapons.length, 1);
  autoStep(s, { target: 5 }, always(0)); assert.equal(s.weapons[0].level, 1);
});

test('bulk sell unlocks at rebirth 5', () => {
  const s = newGame(); s.minerals = 1e6; buy(s, 'sword'); buy(s, 'sword'); s.weapons[1].level = 8;
  s.meta.rebirths = 4; assert.equal(bulkSell(s, 5).ok, false);
  s.meta.rebirths = 5; assert.equal(bulkSell(s, 5).count, 1); assert.equal(s.weapons.length, 1);
});

test('rebirth hint after ten idle minutes', () => {
  const s = newGame(); s.maxStage = 1; s.bestDpsAt = 0;
  s.bestDpsAt = 1000;
  assert.equal(shouldHintRebirth(s, 1000 + 9 * 60e3), false);
  assert.equal(shouldHintRebirth(s, 1000 + 11 * 60e3), true);
  const creeping = newGame(); creeping.maxStage = 3; creeping.lastClearAt = 1000; creeping.bestDpsAt = 1000 + 14 * 60e3;
  assert.equal(shouldHintRebirth(creeping, 1000 + 14 * 60e3), false);
  assert.equal(shouldHintRebirth(creeping, 1000 + 16 * 60e3), true, 'no new boss for 15 minutes');
});

test('attack and reward perms compound so rebirths keep paying', async () => {
  const { ctxOf } = await import('../src/state.js');
  const s = newGame(); s.meta.perm.atk = 2; s.meta.perm.reward = 3;
  const c = ctxOf(s);
  assert.ok(Math.abs(1 + c.perm.atkPct - 1.25 ** 2) < 1e-9);
  assert.ok(Math.abs(1 + c.perm.rewardPct - 1.25 ** 3) < 1e-9);
});

test('recommended trait follows the weapon specialty', async () => {
  const { recommendTrait } = await import('../src/progress.js');
  assert.equal(recommendTrait('sword', ['atkPct', 'critMult', 'speedPct']), 'critMult');
  assert.equal(recommendTrait('axe', ['atkPct', 'armorBreak', 'critChance']), 'armorBreak');
  assert.equal(recommendTrait('staff', ['speedPct', 'atkPct', 'critMult']), 'atkPct');
  assert.equal(recommendTrait('bow', ['atkPct', 'critChance', 'speedPct']), 'speedPct');
});

test('auto enhance picks the recommended trait, not the first one', () => {
  const s = newGame(); s.minerals = 1e6; buy(s, 'sword');
  s.weapons[0].pendingTraits = ['speedPct', 'atkPct', 'critMult'];
  autoStep(s, { target: 20 }, always(0));
  assert.deepEqual(s.weapons[0].traits, ['critMult']);
});

test('auto enhance promotes a capped weapon and skips capped ones it cannot promote', () => {
  const s = newGame(); s.minerals = 1e9; buy(s, 'sword');
  s.weapons[0].level = 20; s.weapons[0].traits = ['atkPct', 'atkPct'];
  autoStep(s, { target: 25 }, always(0));
  assert.equal(s.weapons.length, 2, 'cannot promote alone, so it buys a new sword instead of trying to enhance');
  autoStep(s, { target: 25 }, always(0));
  assert.equal(s.weapons.length, 1); assert.equal(s.weapons[0].grade, 1);
});
