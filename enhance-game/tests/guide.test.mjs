import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, buy, assign } from '../src/state.js';
import { nextStep, alerts } from '../src/progress.js';

test('fresh game asks to buy a sword', () => {
  assert.equal(nextStep(newGame()).key, 'buy');
});

test('weapons but nobody mining asks to send one to the mine', () => {
  const s = newGame(); buy(s, 'sword'); assign(s, s.weapons[0].id, 'battle');
  assert.equal(nextStep(s).key, 'mine');
});

test('mining but nobody fighting asks to enhance and send one to battle', () => {
  const s = newGame(); buy(s, 'sword');
  assert.equal(nextStep(s).key, 'battle');
});

test('killable boss is the top suggestion', () => {
  const s = newGame(); s.minerals = 1e6; buy(s, 'sword'); buy(s, 'sword');
  s.weapons[0].level = 30; assign(s, s.weapons[0].id, 'battle');
  assert.equal(nextStep(s).key, 'boss');
});

test('pending trait comes first', () => {
  const s = newGame(); buy(s, 'sword'); s.weapons[0].pendingTraits = ['atkPct', 'critChance', 'critMult'];
  assert.equal(nextStep(s).key, 'trait');
});

test('alerts flag killable boss, pending trait and affordable unlock', () => {
  const s = newGame(); s.minerals = 1e6; buy(s, 'sword'); buy(s, 'sword');
  assert.deepEqual(alerts(s), { forge: false, boss: false, shop: false });
  s.weapons[0].level = 30; assign(s, s.weapons[0].id, 'battle');
  s.weapons[1].pendingTraits = ['atkPct'];
  s.meta.coins = 30;
  assert.deepEqual(alerts(s), { forge: true, boss: true, shop: true });
});
