import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, addItem, count } from '../src/rules.js';
import { activeQuests, questChoices, questAct, QUESTS } from '../src/quests.js';

test('only the woodcutter is out on day 1', () => {
  const s = newState();
  assert.deepEqual(activeQuests(s).map((q) => q.id), ['woodcutter']);
  s.day = 3;
  assert.deepEqual(activeQuests(s).map((q) => q.id), ['woodcutter', 'child']);
});

test('woodcutter needs plantain and teaches the salve', () => {
  const s = newState();
  const r1 = questAct(s, 'woodcutter', 'give');
  assert.equal(r1.ok, false);
  addItem(s, 'plantain');
  const r2 = questAct(s, 'woodcutter', 'give');
  assert.equal(r2.ok, true);
  assert.equal(s.flags.quest1, true);
  assert.equal(count(s, 'plantain'), 0);
  assert.equal(count(s, 'wood'), 5);
  assert.equal(activeQuests(s).length, 0);
});

test('child hides the truth until the clue is pointed out', () => {
  const s = newState();
  s.day = 3;
  addItem(s, 'mugwort');
  assert.equal(questAct(s, 'child', 'give').ok, false);
  assert.equal(count(s, 'mugwort'), 1);
  assert.equal(questAct(s, 'child', 'wrong').ok, false);
  assert.equal(questAct(s, 'child', 'clue').ok, true);
  assert.equal(questAct(s, 'child', 'give').ok, true);
  assert.equal(s.rep, 5);
  assert.equal(s.flags.kudzuHint, true);
});

test('choices change after the truth comes out', () => {
  const s = newState();
  s.day = 3;
  assert.deepEqual(questChoices(s, 'child').map((c) => c.action), ['clue', 'wrong', 'give']);
  questAct(s, 'child', 'clue');
  assert.deepEqual(questChoices(s, 'child').map((c) => c.action), ['give']);
});

test('zhang fei is invited to the clinic once the bottle is pointed out', () => {
  const s = newState();
  s.day = 6;
  questAct(s, 'zhangfei', 'clue');
  assert.equal(questAct(s, 'zhangfei', 'give').ok, true);
  assert.equal(s.flags.zhangfeiVisit, true);
  assert.equal(s.quests.zhangfei, 'invited');
  assert.equal(activeQuests(s).some((q) => q.id === 'zhangfei'), false);
});

test('every quest names a day and a place', () => {
  for (const q of QUESTS) {
    assert.ok(q.day >= 1 && q.day <= 7);
    assert.ok(q.x > 0 && q.x < 240);
  }
});
