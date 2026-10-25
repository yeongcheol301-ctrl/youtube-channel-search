import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, buy, enhance, sell, assign, pickTrait, upgradeBuilding, tick, applyOffline, save, load } from '../src/state.js';

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

test('reaching +5 offers three traits and blocks enhancing until picked', () => {
  const s = newGame(); s.minerals = 1e9; buy(s, 'sword');
  const w = s.weapons[0]; w.level = 4;
  assert.equal(enhance(s, w.id, always(0)).ok, true);
  assert.equal(w.level, 5); assert.equal(w.pendingTraits.length, 3);
  assert.equal(enhance(s, w.id, always(0)).ok, false);
  assert.equal(pickTrait(s, w.id, w.pendingTraits[0]).ok, true);
  assert.equal(w.traits.length, 1); assert.equal(w.pendingTraits, null);
  assert.equal(enhance(s, w.id, always(0)).ok, true);
});

test('destroyed weapon disappears', () => {
  const s = newGame(); s.minerals = 1e12; buy(s, 'sword');
  const w = s.weapons[0]; w.grade = 2; w.level = 7; w.traits = ['atkPct', 'atkPct', 'atkPct', 'atkPct', 'atkPct'];
  const seq = [0.99, 0.0];
  assert.equal(enhance(s, w.id, () => seq.shift()).result, 'destroy');
  assert.equal(s.weapons.length, 0);
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

test('every weapon mines, there is no idle battle slot', () => {
  const s = newGame(); buy(s, 'sword'); assign(s, s.weapons[0].id, 'battle'); const m = s.minerals;
  tick(s, 10); assert.ok(s.minerals > m);
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


test('enhancing stops at the grade cap until promotion', async () => {
  const { GRADE_CAPS } = await import('../src/rules.js');
  const s = newGame(); s.minerals = 1e12; buy(s, 'sword');
  const w = s.weapons[0]; w.level = GRADE_CAPS[0]; w.traits = ['atkPct', 'atkPct'];
  const r = enhance(s, w.id, () => 0);
  assert.equal(r.ok, false); assert.match(r.reason, /승급/); assert.equal(w.level, GRADE_CAPS[0]);
});

test('promotion needs the cap, a same type same grade weapon and minerals', async () => {
  const { promote, promoteCost } = await import('../src/state.js');
  const s = newGame(); s.minerals = 1e12; buy(s, 'sword'); buy(s, 'sword'); buy(s, 'sword');
  const [a, b, c] = s.weapons; a.level = 10; a.traits = ['atkPct', 'atkPct']; b.level = 7; c.level = 3;
  assert.equal(promote(s, b.id).ok, false);
  const m = s.minerals;
  const r = promote(s, a.id);
  assert.equal(r.ok, true); assert.equal(a.grade, 1); assert.equal(a.level, 0, 'promotion starts the new grade at +0');
  assert.equal(s.weapons.length, 2); assert.ok(!s.weapons.includes(c), 'lowest level weapon is used up');
  assert.equal(s.minerals, m - promoteCost(0));
  const lone = newGame(); lone.minerals = 1e12; buy(lone, 'sword'); lone.weapons[0].level = 10;
  assert.equal(promote(lone, lone.weapons[0].id).ok, false);
  const broke = newGame(); broke.minerals = 1e12; buy(broke, 'sword'); buy(broke, 'sword'); broke.weapons[0].level = 10; broke.minerals = 0;
  assert.equal(promote(broke, broke.weapons[0].id).ok, false);
});

test('promoteAll promotes every eligible weapon', async () => {
  const { promoteAll } = await import('../src/state.js');
  const s = newGame(); s.minerals = 1e12;
  for (let i = 0; i < 4; i++) buy(s, 'sword');
  s.weapons[0].level = 10; s.weapons[1].level = 10;
  s.weapons[0].traits = ['atkPct', 'atkPct']; s.weapons[1].traits = ['atkPct', 'atkPct'];
  const r = promoteAll(s);
  assert.equal(r.count, 2, 'both +10 swords promote, each eating a +0 sword');
  assert.equal(s.weapons.filter((w) => w.grade === 1).length, 2);
  assert.equal(s.weapons.length, 2);
});

test('buy price grows in proportion to swords owned', async () => {
  const { buyPrice } = await import('../src/state.js');
  const s = newGame(); s.minerals = 1e9;
  const p0 = buyPrice(s, 'sword'); buy(s, 'sword');
  assert.equal(buyPrice(s, 'sword'), 2 * p0, 'price is proportional to how many you own');
  buy(s, 'sword'); assert.equal(buyPrice(s, 'sword'), 3 * p0);
});

test('each grade grants traits at +5 and +10, counting earlier grades', async () => {
  const { traitsExpected } = await import('../src/state.js');
  assert.equal(traitsExpected({ grade: 0, level: 4 }), 0);
  assert.equal(traitsExpected({ grade: 0, level: 10 }), 2);
  assert.equal(traitsExpected({ grade: 2, level: 5 }), 5);
  assert.equal(traitsExpected({ grade: 4, level: 15 }), 11);
});

test('a destroyed weapon leaves abyss shards; a protect ticket turns destroy into -1', async () => {
  const { shardsFor, craftProtect, fillPity, SHARD_COST } = await import('../src/state.js');
  const s = newGame(); s.minerals = 1e12; buy(s, 'sword'); buy(s, 'sword');
  const [a, b] = s.weapons;
  for (const w of [a, b]) { w.grade = 2; w.level = 7; w.traits = ['atkPct', 'atkPct', 'atkPct', 'atkPct', 'atkPct']; }
  const r = enhance(s, a.id, ((q) => () => q.shift())([0.99, 0.0]));
  assert.equal(r.result, 'destroy'); assert.equal(r.shards, shardsFor(a)); assert.equal(s.meta.shards, 18);
  assert.equal(craftProtect(s).ok, false, 'needs 30 shards');
  s.meta.shards = SHARD_COST.protect + SHARD_COST.pity;
  assert.equal(craftProtect(s).ok, true); assert.equal(s.meta.protect, 1);
  const saved = enhance(s, b.id, ((q) => () => q.shift())([0.99, 0.0]), { protect: true });
  assert.equal(saved.result, 'saved'); assert.equal(b.level, 6); assert.equal(s.meta.protect, 0); assert.ok(s.weapons.includes(b));
  assert.equal(fillPity(s, b.id).ok, true); assert.equal(b.pity, 60);
  assert.equal(fillPity(s, b.id).ok, false, 'out of shards');
});

test('veins: open the next vein, then switch freely between opened ones', async () => {
  const { selectVein, bestVein, buildingUpgradeCost } = await import('../src/state.js');
  const s = newGame(); s.minerals = 1e12;
  assert.equal(selectVein(s, 1).ok, false, 'not opened yet');
  assert.equal(upgradeBuilding(s).ok, true);
  assert.equal(s.building.tier, 1); assert.equal(s.building.unlocked, 1);
  assert.equal(selectVein(s, 0).ok, true); assert.equal(s.building.tier, 0);
  buy(s, 'sword');
  assert.equal(bestVein(s), 0, 'a +0 sword cannot scratch the copper vein, so stay on the soft one');
  assert.ok(buildingUpgradeCost(s) > 0);
});
