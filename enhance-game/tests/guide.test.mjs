import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, buy, assign } from '../src/state.js';
import { nextStep, alerts, arrangeBest, potentialDps } from '../src/progress.js';

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

test('battle step offers one-tap arrangement', () => {
  const s = newGame(); buy(s, 'sword');
  assert.equal(nextStep(s).act, 'arrange');
});

test('arrangeBest sends the strongest half to battle and keeps one miner', () => {
  const s = newGame(); s.minerals = 1e6;
  for (let i = 0; i < 5; i++) buy(s, 'sword');
  s.weapons.forEach((w, i) => { w.level = i * 2; });
  arrangeBest(s);
  const battle = s.weapons.filter((w) => w.loc === 'battle').map((w) => w.level).sort((a, b) => a - b);
  assert.deepEqual(battle, [6, 8]);
  assert.equal(s.weapons.filter((w) => w.loc === 'mine').length, 3);
  const one = newGame(); buy(one, 'sword'); arrangeBest(one);
  assert.equal(one.weapons[0].loc, 'mine');
});

test('potential dps counts every weapon, not just fighters', () => {
  const s = newGame(); s.minerals = 1e6; buy(s, 'sword'); buy(s, 'sword');
  assert.ok(potentialDps(s) > 0);
  const before = potentialDps(s);
  s.weapons[0].level = 10;
  assert.ok(potentialDps(s) > before);
});
