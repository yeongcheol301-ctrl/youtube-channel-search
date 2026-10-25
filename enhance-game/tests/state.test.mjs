import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, buy, enhance, sell, assign, combine, pickTrait, upgradeBuilding, tick, applyOffline, save, load } from '../src/state.js';

const always = (v) => () => v;
const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('new game can afford a sword', () => {
  const s = newGame();
  assert.ok(s.minerals >= 100);
  assert.equal(buy(s, 'sword').ok, true);
  assert.equal(s.weapons.length, 1);
});

test('rejects when broke', () => {
  const s = newGame(); s.minerals = 50;
  const r = buy(s, 'sword');
  assert.equal(r.ok, false); assert.equal(s.minerals, 50); assert.equal(s.weapons.length, 0);
  s.minerals = 1000; buy(s, 'sword'); s.minerals = 10;
  const before = JSON.stringify(s);
  assert.equal(enhance(s, s.weapons[0].id, always(0)).ok, false);
  assert.equal(upgradeBuilding(s).ok, false);
  assert.equal(JSON.stringify(s), before);
});

test('locked weapon cannot be bought', () => {
  const s = newGame(); s.minerals = 1e6;
  assert.equal(buy(s, 'axe').ok, false);
});

test('reaching +10 offers three traits and blocks enhancing until picked', () => {
  const s = newGame(); s.minerals = 1e9; buy(s, 'sword');
  const w = s.weapons[0]; w.level = 9;
  assert.equal(enhance(s, w.id, always(0)).ok, true);
  assert.equal(w.level, 10); assert.equal(w.pendingTraits.length, 3);
  assert.equal(enhance(s, w.id, always(0)).ok, false);
  assert.equal(pickTrait(s, w.id, w.pendingTraits[0]).ok, true);
  assert.equal(w.traits.length, 1); assert.equal(w.pendingTraits, null);
  assert.equal(enhance(s, w.id, always(0)).ok, true);
});

test('destroyed weapon disappears', () => {
  const s = newGame(); s.minerals = 1e12; buy(s, 'sword');
  const w = s.weapons[0]; w.level = 35; w.traits = ['atkPct', 'atkPct', 'atkPct'];
  const seq = [0.99, 0.0];
  assert.equal(enhance(s, w.id, () => seq.shift()).result, 'destroy');
  assert.equal(s.weapons.length, 0);
});

test('combine needs two +10 of same grade', () => {
  const s = newGame(); s.minerals = 1e6; buy(s, 'sword'); buy(s, 'sword');
  const [a, b] = s.weapons;
  assert.equal(combine(s, a.id, b.id).ok, false);
  a.level = 10; b.level = 12; a.traits = ['atkPct']; b.traits = ['atkPct'];
  const r = combine(s, a.id, b.id);
  assert.equal(r.ok, true); assert.equal(s.weapons.length, 1);
  assert.equal(s.weapons[0].grade, 1); assert.equal(s.weapons[0].level, 0);
});

test('sell refunds minerals', () => {
  const s = newGame(); buy(s, 'sword'); const m = s.minerals;
  assert.equal(sell(s, s.weapons[0].id).ok, true);
  assert.ok(s.minerals > m); assert.equal(s.weapons.length, 0);
});

test('mining weapons earn minerals over time', () => {
  const s = newGame(); buy(s, 'sword');
  assign(s, s.weapons[0].id, 'mine'); const m = s.minerals;
  tick(s, 10);
  assert.ok(s.minerals > m);
  assert.ok(s.building.hpLeft > 0 && s.building.hpLeft <= s.building.hp);
});

test('battle weapons do not mine', () => {
  const s = newGame(); buy(s, 'sword'); assign(s, s.weapons[0].id, 'battle'); const m = s.minerals;
  tick(s, 10); assert.equal(s.minerals, m);
});

test('offline negative is zero', () => {
  const s = newGame(); buy(s, 'sword'); assign(s, s.weapons[0].id, 'mine');
  s.lastSeen = 1_000_000;
  assert.equal(applyOffline(s, 500_000), 0);
});

test('offline is capped at eight hours', () => {
  const s = newGame(); buy(s, 'sword'); assign(s, s.weapons[0].id, 'mine');
  s.lastSeen = 0; const eight = applyOffline(s, 8 * 3600e3);
  s.lastSeen = 0; const twenty = applyOffline(s, 20 * 3600e3);
  assert.ok(eight > 0); assert.ok(Math.abs(eight - twenty) < 1e-6);
});

test('save and load round trip', () => {
  const st = memStore(); const s = newGame(); buy(s, 'sword');
  assert.equal(save(s, st), true);
  assert.deepEqual(load(st), s);
});

test('load falls back', () => {
  const broken = { getItem: () => '{not json', setItem() {} };
  assert.equal(load(broken).weapons.length, 0);
  const blocked = { getItem: () => { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(load(blocked).weapons.length, 0);
  assert.equal(save(newGame(), blocked), false);
  assert.equal(load({ getItem: () => '{"minerals":"x"}' }).weapons.length, 0);
});

test('new weapon starts mining so a fresh game earns minerals', () => {
  const s = newGame(); buy(s, 'sword'); const m = s.minerals;
  assert.equal(s.weapons[0].loc, 'mine');
  tick(s, 10); assert.ok(s.minerals > m);
});

test('tapping the ore vein gives bonus minerals even with no miners', async () => {
  const { tapMine, tapGain } = await import('../src/state.js');
  const s = newGame(); const m = s.minerals;
  const g = tapMine(s);
  assert.ok(g >= 2); assert.equal(s.minerals, m + g);
});

test('tap bonus grows with mining income but stays below one second of it plus base', async () => {
  const { tapGain, incomePerSec } = await import('../src/state.js');
  const s = newGame(); s.minerals = 1e9;
  for (let i = 0; i < 4; i++) buy(s, 'sword');
  s.weapons.forEach((w) => { w.level = 20; });
  const rate = incomePerSec(s);
  assert.ok(tapGain(s) > 2);
  assert.ok(tapGain(s) <= rate * 0.25 + 2);
});
