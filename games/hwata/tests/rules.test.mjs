import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newState, addItem, count, basketWeight, carryLimit, canCarry, collapseLoss,
  isUnlocked, canDevelop, develop, brew, medPrice, upgradeMed, brewGrade, serve,
  patientsForDay, pickPatientType, buyUpgrade, buyArrows, craftArrows, digTime,
  spendStamina,
} from '../src/rules.js';

const fill = (s, id, n, hq = false) => { for (let i = 0; i < n; i++) addItem(s, id, hq); };

test('new game starts on day 1 with two known recipes', () => {
  const s = newState();
  assert.equal(s.day, 1);
  assert.equal(s.money, 50);
  assert.equal(s.arrows, 20);
  assert.deepEqual(Object.keys(s.meds).sort(), ['chrysTea', 'mugwortPill']);
});

test('items stack and high quality is tracked', () => {
  const s = newState();
  addItem(s, 'mugwort', false);
  addItem(s, 'mugwort', true);
  assert.equal(count(s, 'mugwort'), 2);
  assert.equal(s.inv.mugwort.hq, 1);
});

test('clover makes the next five items high quality', () => {
  const s = newState();
  addItem(s, 'clover', false);
  fill(s, 'mugwort', 6);
  assert.equal(s.inv.mugwort.hq, 5);
});

test('basket weight ignores weightless items and blocks overfilling', () => {
  const s = newState();
  fill(s, 'kudzu', 6); // 18
  fill(s, 'wood', 10); // 0
  assert.equal(basketWeight(s), 18);
  assert.equal(carryLimit(s), 20);
  assert.equal(canCarry(s, 'kudzu'), true); // 21 <= 30
  fill(s, 'kudzu', 4); // 30
  assert.equal(canCarry(s, 'kudzu'), false);
  assert.equal(canCarry(s, 'wood'), true);
});

test('collapsing keeps only the most plentiful basket item', () => {
  const s = newState();
  fill(s, 'mugwort', 5);
  fill(s, 'honey', 2);
  fill(s, 'wood', 9);
  const lost = collapseLoss(s);
  assert.equal(count(s, 'mugwort'), 5);
  assert.equal(count(s, 'honey'), 0);
  assert.equal(count(s, 'wood'), 9); // 따로 챙긴 나무는 안 잃음
  assert.equal(lost, 2);
});

test('recipes unlock by start, quest and day', () => {
  const s = newState();
  assert.equal(isUnlocked(s, 'chrysTea'), true);
  assert.equal(isUnlocked(s, 'plantainSalve'), false);
  s.flags.quest1 = true;
  assert.equal(isUnlocked(s, 'plantainSalve'), true);
  assert.equal(isUnlocked(s, 'kudzuJuice'), false);
  s.day = 3;
  assert.equal(isUnlocked(s, 'kudzuJuice'), true);
});

test('developing costs double the recipe once', () => {
  const s = newState();
  s.day = 3;
  fill(s, 'kudzu', 3);
  fill(s, 'dropwort', 2);
  assert.equal(canDevelop(s, 'kudzuJuice'), false);
  addItem(s, 'kudzu', false);
  assert.equal(canDevelop(s, 'kudzuJuice'), true);
  assert.equal(develop(s, 'kudzuJuice').ok, true);
  assert.equal(count(s, 'kudzu'), 0);
  assert.equal(s.meds.kudzuJuice.level, 1);
  assert.equal(develop(s, 'kudzuJuice').ok, false);
});

test('brewing makes three doses, high quality only when every input is', () => {
  const s = newState();
  fill(s, 'chrysanthemum', 3, true);
  assert.equal(brew(s, 'chrysTea').ok, true);
  assert.deepEqual(s.meds.chrysTea.doses, { n: 3, hq: 3 });
  fill(s, 'chrysanthemum', 2, true);
  fill(s, 'chrysanthemum', 1, false);
  brew(s, 'chrysTea');
  assert.deepEqual(s.meds.chrysTea.doses, { n: 6, hq: 3 });
  assert.equal(brew(s, 'chrysTea').ok, false);
});

test('price grows with level and quality', () => {
  const s = newState();
  assert.equal(medPrice(s, 'mugwortPill', false), 30);
  assert.equal(medPrice(s, 'mugwortPill', true), 45);
  fill(s, 'mugwort', 5);
  assert.equal(upgradeMed(s, 'mugwortPill').ok, true);
  assert.equal(medPrice(s, 'mugwortPill', false), 39);
});

test('medicine level stops at 3', () => {
  const s = newState();
  fill(s, 'mugwort', 15);
  upgradeMed(s, 'mugwortPill');
  upgradeMed(s, 'mugwortPill');
  assert.equal(upgradeMed(s, 'mugwortPill').ok, false);
  assert.equal(s.meds.mugwortPill.level, 3);
});

test('brew needle grades by zone', () => {
  assert.equal(brewGrade(0.5), 3);
  assert.equal(brewGrade(0.35), 2);
  assert.equal(brewGrade(0.1), 1);
  assert.equal(brewGrade(0.95), 1);
});

test('serving the right medicine pays and earns stars', () => {
  const s = newState();
  fill(s, 'chrysanthemum', 3);
  brew(s, 'chrysTea');
  const r = serve(s, 'scholar', 'chrysTea', 3);
  assert.equal(r.ok, true);
  assert.equal(r.stars, 3);
  assert.equal(r.coins, 20);
  assert.equal(s.money, 70);
  assert.equal(s.meds.chrysTea.doses.n, 2);
});

test('yellow brew pays 80% and red pays half', () => {
  const s = newState();
  fill(s, 'chrysanthemum', 3);
  brew(s, 'chrysTea');
  assert.equal(serve(s, 'scholar', 'chrysTea', 2).coins, 16);
  assert.equal(serve(s, 'scholar', 'chrysTea', 1).coins, 10);
});

test('wrong medicine pays nothing and costs a star, still uses the dose', () => {
  const s = newState();
  fill(s, 'chrysanthemum', 3);
  brew(s, 'chrysTea');
  const r = serve(s, 'drunk', 'chrysTea', 3);
  assert.equal(r.ok, false);
  assert.equal(r.coins, 0);
  assert.equal(r.stars, -1);
  assert.equal(s.money, 50);
  assert.equal(s.meds.chrysTea.doses.n, 2);
});

test('high quality doses are served first', () => {
  const s = newState();
  fill(s, 'chrysanthemum', 3, true);
  brew(s, 'chrysTea');
  assert.equal(serve(s, 'scholar', 'chrysTea', 3).coins, 30);
});

test('more patients come with days and reputation', () => {
  const s = newState();
  assert.equal(patientsForDay(s), 8);
  s.day = 5;
  assert.equal(patientsForDay(s), 10);
  s.rep = 60;
  assert.equal(patientsForDay(s), 14);
});

test('patients only ask for medicine that can be made', () => {
  const s = newState();
  const seen = new Set();
  let x = 0;
  const rng = () => { x = (x + 0.137) % 1; return x; };
  for (let i = 0; i < 200; i++) seen.add(pickPatientType(s, rng));
  assert.deepEqual([...seen].sort(), ['child', 'scholar']);
});

test('upgrades take money and items once', () => {
  const s = newState();
  s.money = 300;
  fill(s, 'rabbitFur', 2);
  assert.equal(buyUpgrade(s, 'basket').ok, true);
  assert.equal(carryLimit(s), 30);
  assert.equal(s.money, 200);
  assert.equal(buyUpgrade(s, 'basket').ok, false);
  assert.equal(buyUpgrade(s, 'hoe').ok, false); // 나무 부족
  fill(s, 'wood', 5);
  assert.equal(digTime(s), 0.5);
  buyUpgrade(s, 'hoe');
  assert.equal(digTime(s), 0.25);
});

test('arrows can be bought or crafted', () => {
  const s = newState();
  assert.equal(buyArrows(s).ok, true);
  assert.equal(s.arrows, 30);
  assert.equal(s.money, 30);
  assert.equal(craftArrows(s).ok, false);
  addItem(s, 'feather');
  addItem(s, 'wood');
  craftArrows(s);
  assert.equal(s.arrows, 35);
});

test('stamina never drops below zero and reports exhaustion', () => {
  const s = newState();
  assert.equal(spendStamina(s, 30), false);
  assert.equal(s.stamina, 70);
  assert.equal(spendStamina(s, 100), true);
  assert.equal(s.stamina, 0);
});
