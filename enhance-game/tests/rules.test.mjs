import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, GRADE_CAPS, successRate, destroyChance, enhanceCost, rollEnhance, formatNumber } from '../src/rules.js';

const always = (v) => () => v;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('weapon table matches spec', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(WEAPONS).map(([k, w]) => [k, [w.price, w.atk]])),
    { sword: [100, 1], axe: [300, 3], staff: [1000, 8], bow: [500, 2] });
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


test('each grade runs +0 to +10 and starts harder the higher it is', () => {
  near(successRate(0, 'sword', 0, 0), 0.95);
  near(successRate(10, 'sword', 0, 0), 0);
  near(successRate(0, 'sword', 0, 1), 0.85);
  near(successRate(0, 'sword', 0, 2), 0.70);
  near(successRate(0, 'sword', 0, 3), 0.55);
  near(successRate(0, 'sword', 0, 4), 0.40);
  near(successRate(9, 'sword', 0, 0), 0.95 - 0.35 * 9 / 9);
  near(successRate(0, 'axe', 0, 0), 0.95 * 0.85);
  near(successRate(0, 'sword', 3, 0), 0.98);
});

test('transcendent grade goes up to +15', () => {
  assert.equal(GRADE_CAPS[4], 15);
  assert.ok(successRate(14, 'sword', 0, 4) > 0);
});

test('enhance cost grows per level and per grade, staff doubled', () => {
  assert.equal(enhanceCost(0, 'sword'), 100);
  assert.equal(enhanceCost(2, 'sword'), Math.round(100 * 1.35 ** 2));
  assert.equal(enhanceCost(0, 'sword', 0, 1), 600);
  assert.equal(enhanceCost(0, 'staff'), 2000);
  assert.equal(enhanceCost(0, 'sword', 0.5), 50);
});

test('common grade below +5 keeps its level on failure', () => {
  const w = { type: 'sword', grade: 0, level: 3, pity: 0 };
  assert.equal(rollEnhance(w, always(0.99)).result, 'stay'); assert.equal(w.level, 3); assert.equal(w.pity, 10);
});

test('failure drops one level and never below zero', () => {
  const w = { type: 'sword', grade: 0, level: 7, pity: 0 };
  assert.equal(rollEnhance(w, always(0.99)).result, 'down'); assert.equal(w.level, 6);
  const r = { type: 'sword', grade: 1, level: 0, pity: 0 };
  rollEnhance(r, always(0.99)); assert.equal(r.level, 0);
});

test('destruction risk starts earlier on higher grades and never hits axes', () => {
  assert.equal(destroyChance(9, 'sword', 0), 0);
  assert.equal(destroyChance(7, 'sword', 1), 0);
  assert.ok(destroyChance(8, 'sword', 1) > 0);
  assert.ok(destroyChance(6, 'sword', 2) > 0);
  assert.ok(destroyChance(4, 'sword', 3) > 0);
  assert.equal(destroyChance(9, 'axe', 4), 0);
  const w = { type: 'sword', grade: 2, level: 7, pity: 0 };
  const seq = [0.99, 0.0];
  assert.equal(rollEnhance(w, () => seq.shift()).result, 'destroy');
});

test('staff can jump two levels but never past the grade cap', () => {
  const w = { type: 'staff', grade: 0, level: 4, pity: 0 };
  assert.equal(rollEnhance(w, always(0)).result, 'up2'); assert.equal(w.level, 6);
  const c = { type: 'staff', grade: 0, level: 9, pity: 0 };
  rollEnhance(c, always(0)); assert.equal(c.level, 10);
});

test('full pity guarantees success then resets', () => {
  const w = { type: 'sword', grade: 3, level: 8, pity: 100 };
  assert.equal(rollEnhance(w, always(0.99)).result, 'up'); assert.equal(w.level, 9); assert.equal(w.pity, 0);
});

test('at the grade cap enhancing returns max', () => {
  const w = { type: 'sword', grade: 0, level: 10, pity: 0 };
  assert.equal(rollEnhance(w, always(0)).result, 'max'); assert.equal(w.level, 10);
});

test('every weapon has a buyer-facing description', () => {
  for (const k of Object.keys(WEAPONS)) {
    const d = WEAPONS[k];
    assert.ok(d.pitch && d.pros.length && d.cons.length && d.counters.length, k);
  }
});
