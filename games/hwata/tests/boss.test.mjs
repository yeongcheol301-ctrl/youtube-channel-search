import test from 'node:test';
import assert from 'node:assert/strict';
import { newBoss, stepBoss, hitBoss, calmBoss, BOSS } from '../src/boss.js';

const arena = { x0: 119, x1: 138, y0: 84, y1: 104 };
const open = () => false;
const run = (b, secs, player, solid = open) => {
  const events = [];
  for (let t = 0; t < secs; t += 0.05) events.push(...stepBoss(b, 0.05, player, solid));
  return events;
};

test('the boss circles, then winds up and charges', () => {
  const b = newBoss(arena);
  const events = run(b, 6, { x: 128, y: 95 });
  assert.ok(events.includes('windup'));
  assert.ok(events.includes('charge'));
  assert.ok(events.indexOf('windup') < events.indexOf('charge'));
});

test('a charge into rock stuns the boss', () => {
  const b = newBoss(arena);
  b.state = 'charge';
  b.t = 1;
  b.dir = { x: 1, y: 0 };
  const events = run(b, 0.6, { x: 120, y: 95 }, (x) => x >= 133);
  assert.ok(events.includes('crash'));
  assert.equal(b.state, 'stunned');
});

test('the boss bites when the diver is close', () => {
  const b = newBoss(arena);
  b.x = 128; b.y = 95;
  const events = run(b, 0.3, { x: 129.5, y: 95.8 });
  assert.ok(events.includes('bite'));
});

test('a stunned boss takes double damage', () => {
  const b = newBoss(arena);
  hitBoss(b, 1);
  assert.equal(b.hp, BOSS.hp - 1);
  b.state = 'stunned';
  hitBoss(b, 1);
  assert.equal(b.hp, BOSS.hp - 3);
});

test('the boss gets angrier below half health', () => {
  const b = newBoss(arena);
  assert.equal(b.phase, 1);
  hitBoss(b, BOSS.hp / 2);
  assert.equal(b.phase, 2);
});

test('at zero health it tires out and can be calmed', () => {
  const b = newBoss(arena);
  assert.equal(calmBoss(b), false);
  hitBoss(b, BOSS.hp + 5);
  assert.equal(b.state, 'tired');
  assert.equal(b.hp, 0);
  assert.deepEqual(run(b, 2, { x: b.x, y: b.y }), []);
  assert.equal(calmBoss(b), true);
  assert.equal(b.state, 'tame');
  assert.equal(hitBoss(b, 3).hp, 0);
});

test('the boss stays inside its arena', () => {
  const b = newBoss(arena);
  run(b, 20, { x: 200, y: 20 });
  assert.ok(b.x >= arena.x0 && b.x + BOSS.w <= arena.x1 + 0.01);
  assert.ok(b.y >= arena.y0 && b.y + BOSS.h <= arena.y1 + 0.01);
});
