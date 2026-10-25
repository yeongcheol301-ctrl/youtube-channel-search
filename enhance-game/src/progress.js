// 보스 도전, DPS 측정, 환생·해금·영구 능력, 자동화.
import { WEAPONS, WEAPON_ORDER, makeBoss, bossFight, FIGHT_SECONDS, weaponAttack } from './rules.js';
import { newGame, ctxOf, fighters, miners, assign, buy, enhance, pickTrait, sell, buyPrice, enhancePrice, permLevel } from './state.js';

const fail = (reason) => ({ ok: false, reason });

export const REWARD_TUNING = { base: 60, growth: 2.4 };

export function bossReward(stage) {
  return Math.round(REWARD_TUNING.base * Math.pow(REWARD_TUNING.growth, stage - 1));
}

export function nextBoss(s) {
  return makeBoss(s.maxStage + 1);
}

export function challengeBoss(s) {
  const party = fighters(s);
  if (!party.length) return fail('전투 무기가 없습니다');
  const boss = nextBoss(s);
  const r = bossFight(party, boss, ctxOf(s));
  if (r.killed) {
    s.maxStage += 1;
    s.minerals += bossReward(boss.stage);
  }
  return { ok: true, killed: r.killed, damage: r.damage, hits: r.hits, boss };
}

const SANDBAG = { stage: 0, types: [], hp: Infinity, armor: 0, barrier: false, hitsNeeded: 0, regenPct: 0 };

export function measureDps(s, nowMs) {
  const r = bossFight(fighters(s), SANDBAG, ctxOf(s));
  const dps = r.damage / FIGHT_SECONDS;
  if (dps > s.bestDps) {
    s.bestDps = dps;
    s.bestDpsAt = nowMs;
  }
  return dps;
}

export function rebirthCoins(s) {
  if (s.maxStage <= 0) return 0;
  const base = 10 * Math.pow(s.maxStage, 1.75);
  const bonus = Math.floor(Math.log10(s.bestDps + 1)) * 2 + Math.floor(s.bestLevel / 5);
  return Math.round(base + bonus);
}

export function rebirth(s, { adDouble = false } = {}) {
  const meta = s.meta;
  meta.coins += rebirthCoins(s) * (adDouble ? 2 : 1);
  meta.rebirths += 1;
  const n = newGame(meta);
  n.lastSeen = s.lastSeen;
  return n;
}

export function nextUnlock(s) {
  return WEAPON_ORDER.find((t) => !s.meta.unlocked.includes(t)) ?? null;
}

export function unlock(s, type) {
  if (type !== nextUnlock(s)) return fail('앞 무기부터 해금하세요');
  const cost = WEAPONS[type].unlockCost;
  if (s.meta.coins < cost) return fail('환생 코인 부족');
  s.meta.coins -= cost;
  s.meta.unlocked.push(type);
  return { ok: true };
}

export const PERMS = {
  start: { name: '시작 미네랄 +300', max: 20 },
  reward: { name: '건물 보상 ×1.25', max: 50 },
  success: { name: '강화 성공률 +1%p', max: 10 },
  atk: { name: '공격력 ×1.25', max: 50 },
  discount: { name: '구매·강화 할인 5%', max: 10 },
};

export function permCost(level) {
  return Math.round(10 * Math.pow(1.45, level));
}

export function buyPerm(s, key) {
  const p = PERMS[key];
  if (!p) return fail('없는 능력');
  const lv = permLevel(s, key);
  if (lv >= p.max) return fail('최대 단계');
  const cost = permCost(lv);
  if (s.meta.coins < cost) return fail('환생 코인 부족');
  s.meta.coins -= cost;
  s.meta.perm[key] = lv + 1;
  return { ok: true };
}

export const AUTO_REBIRTHS = 0;
export const BULK_SELL_REBIRTHS = 5;

// 한 번 부를 때 한 가지 행동만 한다: 목표 미만 무기를 강화하거나, 없으면 새로 산다.
export function autoStep(s, cfg, rng) {
  if (s.meta.rebirths < AUTO_REBIRTHS) return fail('환생 3회차부터');
  const pending = s.weapons.find((w) => w.pendingTraits);
  if (pending) {
    pickTrait(s, pending.id, pending.pendingTraits[0]);
    return { ok: true, action: 'trait' };
  }
  const low = s.weapons.filter((w) => w.level < cfg.target).sort((a, b) => enhancePrice(s, a) - enhancePrice(s, b))[0];
  if (low) {
    if (s.minerals < enhancePrice(s, low)) return { ok: true, action: 'wait' };
    enhance(s, low.id, rng);
    return { ok: true, action: 'enhance' };
  }
  const type = [...s.meta.unlocked].reverse().find((t) => s.minerals >= buyPrice(s, t));
  if (!type) return { ok: true, action: 'wait' };
  buy(s, type);
  return { ok: true, action: 'buy' };
}

export function bulkSell(s, maxLevel) {
  if (s.meta.rebirths < BULK_SELL_REBIRTHS) return fail('환생 5회차부터');
  const targets = s.weapons.filter((w) => w.grade === 0 && w.level <= maxLevel && !w.pendingTraits);
  for (const w of targets) sell(s, w.id);
  return { ok: true, count: targets.length };
}

export const HINT_IDLE_MS = 10 * 60e3;

export function shouldHintRebirth(s, nowMs) {
  return s.maxStage >= 1 && s.bestDpsAt > 0 && nowMs - s.bestDpsAt > HINT_IDLE_MS;
}

// ---- 안내 ----

export function canKillBoss(s) {
  const party = fighters(s);
  return party.length > 0 && bossFight(party, nextBoss(s), ctxOf(s)).killed;
}

function canSpendCoins(s) {
  const u = nextUnlock(s);
  if (u && s.meta.coins >= WEAPONS[u].unlockCost) return true;
  return Object.entries(PERMS).some(([k, p]) => permLevel(s, k) < p.max && s.meta.coins >= permCost(permLevel(s, k)));
}

// 지금 가장 먼저 할 일 하나. tab은 그 일을 하는 화면.
export function nextStep(s) {
  if (s.weapons.some((w) => w.pendingTraits)) return { key: 'trait', tab: 'forge', text: '특성을 고를 무기가 있습니다' };
  if (canKillBoss(s)) return { key: 'boss', tab: 'boss', text: `${s.maxStage + 1}단계 보스를 잡을 수 있습니다` };
  if (!s.weapons.length) return { key: 'buy', tab: 'forge', text: '검을 사서 시작하세요' };
  if (!miners(s).length) return { key: 'mine', tab: 'forge', text: '무기 하나를 채집으로 보내 미네랄을 버세요' };
  if (!fighters(s).length) return { key: 'battle', tab: 'forge', act: 'arrange', text: '눌러서 센 무기를 전투로 보내기 (나머지는 채집)' };
  if (canSpendCoins(s)) return { key: 'shop', tab: 'shop', text: '환생 코인으로 새 무기나 능력을 사세요' };
  return { key: 'enhance', tab: 'forge', text: '전투 무기를 강화해 보스를 준비하세요' };
}

export function alerts(s) {
  return {
    forge: s.weapons.some((w) => w.pendingTraits),
    boss: canKillBoss(s),
    shop: canSpendCoins(s),
  };
}

// 센 무기 절반은 전투, 나머지는 채집. 한 자루뿐이면 채집에 둔다(돈이 먼저).
export function arrangeBest(s) {
  const ctx = ctxOf(s);
  const sorted = [...s.weapons].sort((a, b) => weaponAttack(b, ctx) - weaponAttack(a, ctx));
  const nBattle = Math.min(10, Math.floor(sorted.length / 2));
  sorted.forEach((w, i) => assign(s, w.id, i < nBattle ? 'battle' : 'mine'));
  return { ok: true, battle: nBattle };
}

// 모든 무기가 전투에 나갔다고 칠 때의 샌드백 DPS.
export function potentialDps(s) {
  return bossFight(s.weapons, SANDBAG, ctxOf(s)).damage / FIGHT_SECONDS;
}

export function battleDps(s) {
  return bossFight(fighters(s), SANDBAG, ctxOf(s)).damage / FIGHT_SECONDS;
}
