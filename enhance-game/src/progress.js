// 보스 도전, DPS 측정, 환생·해금·영구 능력, 자동화.
import { WEAPONS, WEAPON_ORDER, makeBoss, bossFight, FIGHT_SECONDS } from './rules.js';
import { newGame, ctxOf, fighters, buy, enhance, pickTrait, sell, buyPrice, enhancePrice, permLevel } from './state.js';

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

export const AUTO_REBIRTHS = 3;
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
