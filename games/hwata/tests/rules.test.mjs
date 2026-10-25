import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newState, addItem, count, basketWeight, carryLimit, canCarry, collapseLoss, isUnlocked, canDevelop, develop,
  brew, medPrice, upgradeMed, brewGrade, serve, patientsForDay, pickPatientType, buyUpgrade, buyArrows,
  spendStamina, maxStamina, swimSpeed, harpoonDamage, sellItem, herbZone, openPot, hasPage, digHardness,
} from '../src/rules.js';
import { T } from '../src/world.js';
import { POTS, PAGES } from '../src/data.js';

const fill = (s, id, n, hq = false) => { for (let i = 0; i < n; i++) addItem(s, id, hq); };

test('new game knows seaweed soup and oyster porridge', () => {
  const s = newState();
  assert.equal(s.day, 1);
  assert.equal(s.arrows, 5);
  assert.deepEqual(Object.keys(s.meds).sort(), ['oysterPorridge', 'seaweedSoup']);
});

test('first find goes to the dex once', () => {
  const s = newState();
  assert.equal(addItem(s, 'seaweed'), true);
  assert.equal(addItem(s, 'seaweed'), false);
  assert.equal(count(s, 'seaweed'), 2);
});

test('starfish makes the next five items high quality', () => {
  const s = newState();
  addItem(s, 'clover');
  fill(s, 'kelp', 6);
  assert.equal(s.inv.kelp.hq, 5);
});

test('heavy fish fill the net bag', () => {
  const s = newState();
  fill(s, 'rockfish', 6); // 18
  fill(s, 'pearl', 3); // 0
  assert.equal(basketWeight(s), 18);
  assert.equal(carryLimit(s), 20);
  fill(s, 'rockfish', 4); // 30
  assert.equal(canCarry(s, 'rockfish'), false);
  assert.equal(canCarry(s, 'pearl'), true);
});

test('fainting keeps only the most plentiful item', () => {
  const s = newState();
  fill(s, 'seaweed', 5);
  fill(s, 'oyster', 2);
  fill(s, 'pearl', 1);
  assert.equal(collapseLoss(s), 2);
  assert.equal(count(s, 'seaweed'), 5);
  assert.equal(count(s, 'pearl'), 1);
});

test('recipes unlock by quest and day', () => {
  const s = newState();
  assert.equal(isUnlocked(s, 'cuttlePowder'), false);
  s.flags.quest1 = true;
  assert.equal(isUnlocked(s, 'cuttlePowder'), true);
  assert.equal(isUnlocked(s, 'pollockSoup'), false);
  s.day = 3;
  assert.equal(isUnlocked(s, 'pollockSoup'), true);
});

test('developing costs double once, brewing makes three doses', () => {
  const s = newState();
  s.day = 3;
  fill(s, 'pollock', 4);
  fill(s, 'kelp', 2);
  assert.equal(canDevelop(s, 'pollockSoup'), true);
  develop(s, 'pollockSoup');
  assert.equal(count(s, 'pollock'), 0);
  fill(s, 'pollock', 2, true);
  fill(s, 'kelp', 1, true);
  assert.equal(brew(s, 'pollockSoup').hq, true);
  assert.deepEqual(s.meds.pollockSoup.doses, { n: 3, hq: 3 });
});

test('price grows with level and quality', () => {
  const s = newState();
  assert.equal(medPrice(s, 'oysterPorridge', false), 30);
  assert.equal(medPrice(s, 'oysterPorridge', true), 45);
  fill(s, 'oyster', 5);
  upgradeMed(s, 'oysterPorridge');
  assert.equal(medPrice(s, 'oysterPorridge', false), 39);
});

test('brew grades, wider with the second page', () => {
  assert.equal(brewGrade(0.5), 3);
  assert.equal(brewGrade(0.39), 2);
  assert.equal(brewGrade(0.39, true), 3);
  assert.equal(brewGrade(0.95), 1);
});

test('right medicine pays, wrong one costs a star', () => {
  const s = newState();
  fill(s, 'seaweed', 6);
  brew(s, 'seaweedSoup');
  brew(s, 'seaweedSoup');
  assert.deepEqual(serve(s, 'mother', 'seaweedSoup', 3), { ok: true, coins: 20, stars: 3, hq: false });
  assert.equal(serve(s, 'mother', 'seaweedSoup', 2).coins, 16);
  const bad = serve(s, 'drunk', 'seaweedSoup', 3);
  assert.equal(bad.ok, false);
  assert.equal(s.meds.seaweedSoup.doses.n, 3);
});

test('more patients with days and reputation', () => {
  const s = newState();
  assert.equal(patientsForDay(s), 8);
  s.day = 5;
  s.rep = 60;
  assert.equal(patientsForDay(s), 14);
});

test('only patients with a known cure come', () => {
  const s = newState();
  const seen = new Set();
  let x = 0;
  const rng = () => { x = (x + 0.137) % 1; return x; };
  for (let i = 0; i < 200; i++) seen.add(pickPatientType(s, rng));
  assert.deepEqual([...seen].sort(), ['elder', 'mother']);
});

test('gear upgrades change breath, speed and harpoon', () => {
  const s = newState();
  s.money = 1000;
  fill(s, 'oyster', 2);
  fill(s, 'kelp', 3);
  fill(s, 'rockfish', 2);
  assert.equal(maxStamina(s), 100);
  assert.equal(swimSpeed(s), 4.5);
  assert.equal(harpoonDamage(s), 1);
  buyUpgrade(s, 'gourd');
  buyUpgrade(s, 'fins');
  buyUpgrade(s, 'harpoon');
  assert.equal(maxStamina(s), 150);
  assert.ok(Math.abs(swimSpeed(s) - 5.85) < 1e-9);
  assert.equal(harpoonDamage(s), 2);
});

test('nets can be bought', () => {
  const s = newState();
  buyArrows(s);
  assert.equal(s.arrows, 10);
  assert.equal(s.money, 30);
});

test('rare finds sell at the night market', () => {
  const s = newState();
  assert.equal(sellItem(s, 'pearl').ok, false);
  addItem(s, 'pearl', true);
  assert.equal(sellItem(s, 'pearl').coins, 90);
  assert.equal(sellItem(s, 'seaweed').ok, false);
});

test('breath runs out', () => {
  const s = newState();
  assert.equal(spendStamina(s, 40), false);
  assert.equal(spendStamina(s, 100), true);
});

test('pages grant perks and chests pay out', () => {
  const s = newState();
  openPot(s, { page: 1 });
  assert.deepEqual(herbZone(s), [0.56, 0.9]);
  openPot(s, { page: 3 });
  assert.equal(maxStamina(s), 130);
  assert.equal(openPot(s, { page: 3 }).ok, false);
  assert.equal(openPot(s, { arrows: 3 }).text, '그물 3개');
  assert.equal(hasPage(s, 2), false);
});

test('three pages hide in the sunken chests', () => {
  assert.deepEqual(POTS.filter((p) => p.loot.page).map((p) => p.loot.page).sort(), [1, 2, 3]);
  assert.equal(Object.keys(PAGES).length, 3);
});

test('sand and chests take a moment to dig', () => {
  const s = newState();
  assert.equal(digHardness(s, T.SAND), 0.4);
  assert.equal(digHardness(s, T.CHEST), 0.35);
});
