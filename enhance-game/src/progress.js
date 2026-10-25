// 보스 도전, DPS 측정, 환생·해금·영구 능력, 자동화.
import { WEAPONS, WEAPON_ORDER, makeBoss, bossFight, FIGHT_SECONDS, weaponAttack } from './rules.js';
import { canAwaken, awaken, bestVein, canPromote, promote, atCap, newGame, ctxOf, fighters, miners, assign, buy, enhance, pickTrait, sell, buyPrice, enhancePrice, permLevel } from './state.js';

const fail = (reason) => ({ ok: false, reason });

export const REWARD_TUNING = { base: 60, growth: 2.4 };

export function bossReward(stage) {
  return Math.round(REWARD_TUNING.base * Math.pow(REWARD_TUNING.growth, stage - 1));
}

export function nextBoss(s) {
  return makeBoss(s.maxStage + 1);
}

export function challengeBoss(s, nowMs = Date.now()) {
  const party = fighters(s);
  if (!party.length) return fail('전투 무기가 없습니다');
  const boss = nextBoss(s);
  const r = bossFight(party, boss, ctxOf(s));
  if (r.killed) {
    s.maxStage += 1;
    s.lastClearAt = nowMs;
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
    pickTrait(s, pending.id, recommendTrait(pending.type, pending.pendingTraits));
    return { ok: true, action: 'trait' };
  }
  const ready = s.weapons.find((w) => canPromote(s, w));
  if (ready) {
    promote(s, ready.id);
    return { ok: true, action: 'promote' };
  }
  const aw = s.weapons.find((w) => canAwaken(s, w));
  if (aw) {
    awaken(s, aw.id);
    return { ok: true, action: 'awaken' };
  }
  const low = s.weapons.filter((w) => w.level < cfg.target && !atCap(w)).sort((a, b) => enhancePrice(s, a) - enhancePrice(s, b))[0];
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
  const targets = s.weapons.filter((w) => w.grade === 0 && w.level <= maxLevel && !w.pendingTraits && !w.awakened);
  for (const w of targets) sell(s, w.id);
  return { ok: true, count: targets.length };
}

export const HINT_IDLE_MS = 10 * 60e3;
export const HINT_STUCK_MS = 15 * 60e3;

// DPS가 10분째 그대로이거나, DPS는 조금씩 늘어도 15분째 다음 보스를 못 잡으면 환생을 권한다.
export function shouldHintRebirth(s, nowMs) {
  if (s.maxStage < 1) return false;
  const idle = s.bestDpsAt > 0 && nowMs - s.bestDpsAt > HINT_IDLE_MS;
  const stuck = s.lastClearAt > 0 && nowMs - s.lastClearAt > HINT_STUCK_MS;
  return idle || stuck;
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
  if (s.weapons.some((w) => w.pendingTraits)) return { key: 'trait', tab: 'forge', act: 'open-trait', text: '눌러서 특성 고르기' };
  if (canKillBoss(s)) return { key: 'boss', tab: 'boss', text: `${s.maxStage + 1}단계 보스를 잡을 수 있습니다` };
  if (s.weapons.some((w) => canPromote(s, w))) return { key: 'promote', tab: 'forge', act: 'promote-all', text: '눌러서 승급하기 (재료 무기 한 자루 소모)' };
  if (!s.weapons.length) return { key: 'buy', tab: 'forge', text: '검을 사서 시작하세요' };
  if (bestVein(s) !== s.building.tier) return { key: 'vein', tab: 'mine', text: '더 많이 버는 광맥이 있습니다. 채집장에서 옮기세요' };
  if (canSpendCoins(s)) return { key: 'shop', tab: 'shop', text: '환생 코인으로 새 무기나 능력을 사세요' };
  return { key: 'enhance', tab: 'forge', text: '무기를 강화해 보스를 준비하세요 (자동 강화도 있습니다)' };
}

export function alerts(s) {
  return {
    forge: s.weapons.some((w) => w.pendingTraits || canPromote(s, w)),
    boss: canKillBoss(s),
    shop: canSpendCoins(s),
  };
}

// 모든 무기가 전투에 나갔다고 칠 때의 샌드백 DPS.
export function potentialDps(s) {
  return bossFight(s.weapons, SANDBAG, ctxOf(s)).damage / FIGHT_SECONDS;
}

export function battleDps(s) {
  return bossFight(fighters(s), SANDBAG, ctxOf(s)).damage / FIGHT_SECONDS;
}

// 무기 특기에 맞는 특성 우선순위. 목록에 없으면 첫 번째.
const TRAIT_PRIORITY = {
  sword: ['critMult', 'critChance', 'atkPct', 'speedPct', 'armorBreak'],
  axe: ['armorBreak', 'atkPct', 'critChance', 'speedPct', 'critMult'],
  staff: ['atkPct', 'speedPct', 'critMult', 'critChance', 'armorBreak'],
  bow: ['speedPct', 'critChance', 'atkPct', 'critMult', 'armorBreak'],
};

export function recommendTrait(type, options) {
  return (TRAIT_PRIORITY[type] ?? []).find((k) => options.includes(k)) ?? options[0];
}
