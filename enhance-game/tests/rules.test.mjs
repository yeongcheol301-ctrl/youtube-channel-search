import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, successRate, enhanceCost, rollEnhance, formatNumber } from '../src/rules.js';

const always = (v) => () => v;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('weapon table matches spec', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(WEAPONS).map(([k, w]) => [k, [w.price, w.atk]])),
    { sword: [100, 1], axe: [300, 3], staff: [1000, 8], bow: [500, 2] });
});

test('success rate bands interpolate', () => {
  near(successRate(0, 'sword'), 0.95);
  near(successRate(5, 'sword'), 0.75);
  near(successRate(15, 'sword'), 0.40);
  near(successRate(10, 'axe'), 0.425);
  near(successRate(49, 'sword'), 0.15 - 0.12 * 19 / 20);
});

test('success bonus adds percentage points', () => {
  near(successRate(0, 'sword', 3), 0.98);
});

test('enhance cost grows 25% per level, staff doubled', () => {
  assert.equal(enhanceCost(0, 'sword'), 100);
  assert.equal(enhanceCost(4, 'staff'), 4883);
  assert.equal(enhanceCost(0, 'sword', 0.5), 50);
});

test('failure below +5 keeps level', () => {
  const w = { type: 'sword', level: 3, pity: 0 };
  const r = rollEnhance(w, always(0.99));
  assert.equal(r.result, 'stay'); assert.equal(w.level, 3); assert.equal(w.pity, 10);
});

test('failure at +7 drops one level', () => {
  const w = { type: 'sword', level: 7, pity: 0 };
  assert.equal(rollEnhance(w, always(0.99)).result, 'down'); assert.equal(w.level, 6);
});

test('axe never breaks', () => {
  const w = { type: 'axe', level: 25, pity: 0 };
  assert.equal(rollEnhance(w, always(0.0001 + 0.29)).result, 'down');
  const w2 = { type: 'axe', level: 25, pity: 0 };
  const seq = [0.99, 0.0];
  assert.equal(rollEnhance(w2, () => seq.shift()).result, 'down'); assert.equal(w2.level, 24);
});

test('sword at +25 can break', () => {
  const w = { type: 'sword', level: 25, pity: 0 };
  const seq = [0.99, 0.0];
  assert.equal(rollEnhance(w, () => seq.shift()).result, 'destroy');
});

test('staff can jump two levels', () => {
  const w = { type: 'staff', level: 4, pity: 0 };
  assert.equal(rollEnhance(w, always(0)).result, 'up2'); assert.equal(w.level, 6);
});

test('full pity guarantees success then resets', () => {
  const w = { type: 'sword', level: 30, pity: 100 };
  assert.equal(rollEnhance(w, always(0.99)).result, 'up'); assert.equal(w.level, 31); assert.equal(w.pity, 0);
});

test('max level cannot enhance', () => {
  const w = { type: 'sword', level: 50, pity: 0 };
  assert.equal(rollEnhance(w, always(0)).result, 'max'); assert.equal(w.level, 50);
});

test('formatNumber uses commas below one billion like StarCraft', () => {
  assert.equal(formatNumber(950), '950');
  assert.equal(formatNumber(10000), '10,000');
  assert.equal(formatNumber(1740000), '1,740,000');
  assert.equal(formatNumber(987654321), '987,654,321');
});

test('formatNumber switches to Korean units from one billion', () => {
  assert.equal(formatNumber(1.23e9), '12.3억');
  assert.equal(formatNumber(3.4e12), '3.4조');
});

test('formatNumber huge', () => {
  const s = formatNumber(5e20);
  assert.ok(s.includes('경')); assert.ok(!/NaN|Infinity/.test(s));
  assert.ok(!/NaN|Infinity/.test(formatNumber(Infinity)));
});
