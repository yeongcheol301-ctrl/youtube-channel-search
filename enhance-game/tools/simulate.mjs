// 단순 봇으로 플레이해 회차별 진행 속도를 출력한다. 사용: node tools/simulate.mjs [seed]
import { weaponAttack, bossFight, mineralsPerSec, buildingDps } from '../src/rules.js';
import { newGame, buy, enhance, pickTrait, assign, combine, canCombine, upgradeBuilding, buildingUpgradeCost, tick, ctxOf, fighters, buyPrice, enhancePrice } from '../src/state.js';
import { challengeBoss, measureDps, rebirth, rebirthCoins, nextBoss, nextUnlock, unlock, buyPerm, PERMS, permCost, shouldHintRebirth } from '../src/progress.js';

let seed = Number(process.argv[2] ?? 1);
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const MAX_HOURS = Number(process.env.HOURS ?? 30);
let s = newGame();
let now = 0, runStart = 0;
const log = [];

function spendCoins() {
  for (;;) {
    const u = nextUnlock(s);
    if (u && unlock(s, u).ok) continue;
    const keys = Object.keys(PERMS).filter((k) => (s.meta.perm[k] ?? 0) < PERMS[k].max);
    const k = keys.sort((a, b) => permCost(s.meta.perm[a] ?? 0) - permCost(s.meta.perm[b] ?? 0))[0];
    if (!k || u && s.meta.coins < 2 * permCost(s.meta.perm[k] ?? 0) || !buyPerm(s, k).ok) return;
  }
}

function arrange() {
  const ctx = ctxOf(s);
  const sorted = [...s.weapons].sort((a, b) => weaponAttack(b, ctx) - weaponAttack(a, ctx));
  const nBattle = Math.min(10, Math.floor(sorted.length / 2));
  sorted.forEach((w, i) => assign(s, w.id, i < nBattle ? 'battle' : 'mine'));
}

function act() {
  const p = s.weapons.find((w) => w.pendingTraits);
  if (p) return pickTrait(s, p.id, p.pendingTraits[0]);
  for (const a of s.weapons) for (const b of s.weapons) if (canCombine(a, b)) return combine(s, a.id, b.id);
  const miners = s.weapons.filter((w) => w.loc === 'mine');
  const capped = buildingDps(miners, ctxOf(s)) * 1.5 > s.building.hp;
  if (capped && s.minerals >= buildingUpgradeCost(s)) return upgradeBuilding(s);
  if (capped && s.minerals < buildingUpgradeCost(s) && s.weapons.length >= 4) return null;
  const type = [...s.meta.unlocked].sort((a, b) => buyPrice(s, b) - buyPrice(s, a)).find((t) => s.minerals >= buyPrice(s, t) * 3);
  if (s.weapons.length < 4 || (s.weapons.length < 20 && type && s.weapons.length < 8 + s.meta.rebirths * 2)) {
    const t = type ?? s.meta.unlocked.find((x) => s.minerals >= buyPrice(s, x));
    if (t) return buy(s, t);
  }
  const target = s.weapons.filter((w) => w.level < 50 && !w.pendingTraits).sort((a, b) => enhancePrice(s, a) - enhancePrice(s, b))[0];
  if (target && s.minerals >= enhancePrice(s, target)) return enhance(s, target.id, rng);
  return null;
}

let lastRecordCheck = 0;
while (now < MAX_HOURS * 3600) {
  now += 1;
  tick(s, 1);
  act(); act();
  if (now % 10 === 0) arrange();
  if (now % 60 === 0) {
    measureDps(s, now * 1000);
    const b = nextBoss(s);
    if (fighters(s).length && bossFight(fighters(s), b, ctxOf(s)).killed) { challengeBoss(s); s.bestDpsAt = now * 1000; }
  }
  if (now % 60 === 0 && shouldHintRebirth(s, now * 1000)) {
    const coins = rebirthCoins(s);
    log.push({ run: s.meta.rebirths + 1, minutes: Math.round((now - runStart) / 60), stage: s.maxStage, bestLevel: s.bestLevel, coins, totalHours: +(now / 3600).toFixed(1) });
    if (s.maxStage >= 10) break;
    s = rebirth(s, { adDouble: true });
    runStart = now;
    spendCoins();
  }
}
console.table(log);
console.log('unlocked:', s.meta.unlocked.join(','), 'perm:', JSON.stringify(s.meta.perm));
if (process.env.DEBUG) console.log({ minerals: Math.round(s.minerals), tier: s.building.tier, stage: s.maxStage, bestDps: s.bestDps, weapons: s.weapons.map((w) => `${w.type}${w.grade}+${w.level}@${w.loc}`).join(' ') });
