import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, addItem, count } from '../src/rules.js';
import { activeQuests, questChoices, questAct, QUESTS } from '../src/quests.js';

test('only the haenyeo grandma is out on day 1', () => {
  const s = newState();
  assert.deepEqual(activeQuests(s).map((q) => q.id), ['haenyeo']);
  s.day = 6;
  assert.deepEqual(activeQuests(s).map((q) => q.id), ['haenyeo', 'boy', 'zhangfei']);
});

test('grandma needs seaweed and teaches the cuttlebone powder', () => {
  const s = newState();
  assert.equal(questAct(s, 'haenyeo', 'give').ok, false);
  addItem(s, 'seaweed');
  assert.equal(questAct(s, 'haenyeo', 'give').ok, true);
  assert.equal(s.flags.quest1, true);
  assert.equal(s.arrows, 8);
  assert.equal(count(s, 'seaweed'), 0);
});

test('the boy hides the urchin until the spine is pointed out', () => {
  const s = newState();
  s.day = 3;
  addItem(s, 'oyster');
  assert.equal(questAct(s, 'boy', 'give').ok, false);
  assert.equal(count(s, 'oyster'), 1);
  assert.deepEqual(questChoices(s, 'boy').map((c) => c.action), ['clue', 'wrong', 'give']);
  questAct(s, 'boy', 'clue');
  assert.deepEqual(questChoices(s, 'boy').map((c) => c.action), ['give']);
  assert.equal(questAct(s, 'boy', 'give').ok, true);
  assert.equal(s.rep, 5);
});

test('zhang fei is invited once the bottle is pointed out', () => {
  const s = newState();
  s.day = 6;
  questAct(s, 'zhangfei', 'clue');
  assert.equal(questAct(s, 'zhangfei', 'give').ok, true);
  assert.equal(s.flags.zhangfeiVisit, true);
});

test('every quest has a day and a place in the sea', () => {
  for (const q of QUESTS) assert.ok(q.day >= 1 && q.x > 7 && q.x < 140);
});
