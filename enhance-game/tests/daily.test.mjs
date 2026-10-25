import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attend, canAttend, attendSlot, track, missionRows, claimMission, dailyAlert, ATTEND_REWARDS, ALL_CLEAR_REWARD } from '../src/daily.js';

const meta = () => ({ coins: 0 });

test('attendance pays once a day and the streak grows on consecutive days', () => {
  const m = meta();
  assert.equal(canAttend(m, '2026-10-25'), true);
  assert.equal(attend(m, '2026-10-25').reward, ATTEND_REWARDS[0]);
  assert.equal(attend(m, '2026-10-25').ok, false);
  assert.equal(attendSlot(m, '2026-10-26'), 1);
  assert.equal(attend(m, '2026-10-26').streak, 2);
  assert.equal(m.coins, ATTEND_REWARDS[0] + ATTEND_REWARDS[1]);
});

test('missing a day restarts the streak, crossing months works', () => {
  const m = meta();
  attend(m, '2026-10-31'); attend(m, '2026-11-01');
  assert.equal(m.daily.streak, 2);
  attend(m, '2026-11-03');
  assert.equal(m.daily.streak, 1);
});

test('day seven pays the big reward then the cycle repeats', () => {
  const m = meta();
  for (let d = 1; d <= 8; d++) attend(m, `2026-12-0${d}`);
  assert.equal(m.coins, ATTEND_REWARDS.reduce((a, b) => a + b, 0) + ATTEND_REWARDS[0]);
});

test('missions count up, pay once, reset next day, all-clear bonus', () => {
  const m = meta(); const t = '2026-10-25';
  attend(m, t);
  assert.equal(dailyAlert(m, t), false);
  assert.equal(claimMission(m, 'enhance', t).ok, false);
  track(m, 'enhance', t, 20); track(m, 'boss', t); track(m, 'ad', t);
  assert.equal(dailyAlert(m, t), true);
  const before = m.coins;
  for (const k of ['enhance', 'boss', 'ad']) assert.equal(claimMission(m, k, t).ok, true);
  assert.equal(claimMission(m, 'enhance', t).ok, false);
  assert.equal(claimMission(m, 'all', t).reward, ALL_CLEAR_REWARD);
  assert.equal(m.coins, before + 15 + ALL_CLEAR_REWARD);
  assert.equal(missionRows(m, '2026-10-26')[0].count, 0, 'new day, fresh missions');
});
