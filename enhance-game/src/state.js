// 게임 상태와 행동. 행동은 모두 {ok, reason?, ...}를 돌려주고, 실패하면 상태를 바꾸지 않는다.
import {
  WEAPONS, TRAIT_LEVELS, MAX_LEVEL, GRADES, GRADE_MULT, GRADE_CAPS, rollEnhance, enhanceCost,
  buildingStats, mineralsPerSec, buildingDps,
} from './rules.js';

export const SAVE_KEY = 'enhance-save-v2';
export const OFFLINE_CAP_SEC = 8 * 3600;

const fail = (reason) => ({ ok: false, reason });

export function newMeta() {
  return { coins: 0, rebirths: 0, unlocked: ['sword'], perm: {}, discovered: [], shards: 0, protect: 0, daily: null };
}

export function permLevel(s, key) {
  return s.meta.perm[key] ?? 0;
}

export function ctxOf(s) {
  return {
    bowCount: s.weapons.filter((w) => w.type === 'bow').length,
    perm: { atkPct: 1.25 ** permLevel(s, 'atk') - 1, rewardPct: 1.25 ** permLevel(s, 'reward') - 1 },
  };
}

export function newGame(meta = newMeta()) {
  const hp = buildingStats(0).hp;
  return {
    minerals: 150 + 300 * (meta.perm.start ?? 0),
    weapons: [],
    nextId: 1,
    building: { tier: 0, unlocked: 0, hp, hpLeft: hp, t: 0 },
    bestDps: 0,
    bestDpsAt: 0,
    lastClearAt: 0,
    bestLevel: 0,
    maxStage: 0,
    lastSeen: 0,
    meta,
  };
}

const find = (s, id) => s.weapons.find((w) => w.id === id);
const discount = (s) => Math.min(0.5, 0.05 * permLevel(s, 'discount'));

// 값은 그 무기를 가진 자루 수에 비례한다: 1자루째 100, 2자루째 200, 10자루째 1,000.
export function buyPrice(s, type) {
  const owned = s.weapons.filter((w) => w.type === type).length;
  return Math.round(WEAPONS[type].price * (1 - discount(s)) * (owned + 1));
}

function discover(s, w) {
  const key = `${w.type}:${w.grade}:${w.level}`;
  if (!s.meta.discovered.includes(key)) s.meta.discovered.push(key);
}

export function buy(s, type) {
  if (!WEAPONS[type]) return fail('없는 무기');
  if (!s.meta.unlocked.includes(type)) return fail('아직 해금하지 않은 무기');
  const price = buyPrice(s, type);
  if (s.minerals < price) return fail('미네랄 부족');
  s.minerals -= price;
  const w = { id: s.nextId++, type, grade: 0, level: 0, pity: 0, traits: [], pendingTraits: null, loc: 'mine' };
  s.weapons.push(w);
  discover(s, w);
  return { ok: true, weapon: w };
}

export function enhancePrice(s, w) {
  return enhanceCost(w.level, w.type, discount(s), w.grade);
}

// 무기 전용 풀에서 서로 다른 특성 3개를 뽑는다(풀에 많이 든 특성일수록 잘 뜸).
function offerTraits(type, rng) {
  const bag = [...WEAPONS[type].traitPool];
  const picks = [];
  while (picks.length < 3 && bag.length) {
    const key = bag[Math.floor(rng() * bag.length) % bag.length];
    picks.push(key);
    for (let i = bag.length - 1; i >= 0; i--) if (bag[i] === key) bag.splice(i, 1);
  }
  return picks;
}

// 앞 등급에서 받은 특성(등급마다 +5·+10에서 하나씩) + 지금 등급에서 닿은 단계 수.
export function traitsExpected(w) {
  let n = 0;
  for (let g = 0; g < w.grade; g++) n += TRAIT_LEVELS.filter((l) => l <= GRADE_CAPS[g]).length;
  return n + TRAIT_LEVELS.filter((l) => l <= GRADE_CAPS[w.grade] && w.level >= l).length;
}

function traitsOwed(w) {
  return traitsExpected(w) - w.traits.length;
}

// 깨지면 심연 조각이 남는다. 높은 등급일수록 많이.
export const shardsFor = (w) => 2 * (w.grade + 1) ** 2;
export const SHARD_COST = { protect: 30, pity: 10 };
export const PITY_FILL = 50;

// opts.protect: 파괴 방지권이 있으면 파괴 대신 한 단계 하락으로 막는다.
export function enhance(s, id, rng, opts = {}) {
  const w = find(s, id);
  if (!w) return fail('없는 무기');
  if (w.pendingTraits) return fail('특성을 먼저 고르세요');
  const cap = GRADE_CAPS[w.grade];
  if (w.level >= cap) return fail(w.grade < GRADES.length - 1 ? '승급이 필요합니다' : '최고 단계');
  const cost = enhancePrice(s, w);
  if (s.minerals < cost) return fail('미네랄 부족');
  s.minerals -= cost;
  const r = rollEnhance(w, rng, permLevel(s, 'success'));
  if (r.result === 'destroy') {
    if (opts.protect && (s.meta.protect ?? 0) > 0) {
      s.meta.protect -= 1;
      w.level = Math.max(0, w.level - 1);
      return { ok: true, result: 'saved', weapon: w };
    }
    s.weapons = s.weapons.filter((x) => x !== w);
    const shards = shardsFor(w);
    s.meta.shards = (s.meta.shards ?? 0) + shards;
    return { ok: true, result: 'destroy', weapon: w, shards };
  }
  if (r.result === 'up' || r.result === 'up2') {
    s.bestLevel = Math.max(s.bestLevel, w.level);
    discover(s, w);
    if (traitsOwed(w) > 0) w.pendingTraits = offerTraits(w.type, rng);
  }
  return { ok: true, result: r.result, weapon: w };
}

export function craftProtect(s) {
  if ((s.meta.shards ?? 0) < SHARD_COST.protect) return fail('심연 조각 부족');
  s.meta.shards -= SHARD_COST.protect;
  s.meta.protect = (s.meta.protect ?? 0) + 1;
  return { ok: true };
}

export function fillPity(s, id) {
  const w = find(s, id);
  if (!w) return fail('없는 무기');
  if (w.pity >= 100) return fail('천장이 이미 가득 찼습니다');
  if ((s.meta.shards ?? 0) < SHARD_COST.pity) return fail('심연 조각 부족');
  s.meta.shards -= SHARD_COST.pity;
  w.pity = Math.min(100, w.pity + PITY_FILL);
  return { ok: true };
}

export function pickTrait(s, id, key) {
  const w = find(s, id);
  if (!w || !w.pendingTraits || !w.pendingTraits.includes(key)) return fail('고를 수 없는 특성');
  w.traits.push(key);
  w.pendingTraits = null;
  if (traitsOwed(w) > 0) w.pendingTraits = offerTraits(w.type, Math.random);
  return { ok: true, weapon: w };
}

export function sellValue(w) {
  return Math.round(WEAPONS[w.type].price * 0.5 * Math.pow(1.25, w.level) * Math.pow(4, w.grade));
}

export function sell(s, id) {
  const w = find(s, id);
  if (!w) return fail('없는 무기');
  s.minerals += sellValue(w);
  s.weapons = s.weapons.filter((x) => x !== w);
  return { ok: true, value: sellValue(w) };
}

export function assign(s, id, loc) {
  const w = find(s, id);
  if (!w || !['mine', 'battle'].includes(loc)) return fail('잘못된 배치');
  w.loc = loc;
  return { ok: true };
}

// ---- 승급 ----
export const PROMOTE_BASE = 5000;

export function promoteCost(grade) {
  return PROMOTE_BASE * Math.pow(6, grade);
}

export function atCap(w) {
  return w.level >= GRADE_CAPS[w.grade];
}

// 재료: 같은 종류·같은 등급 중 가장 낮은 단계 무기 한 자루.
export function promoteMaterial(s, w) {
  return s.weapons
    .filter((x) => x !== w && x.type === w.type && x.grade === w.grade && !x.pendingTraits)
    .sort((a, b) => a.level - b.level)[0] ?? null;
}

export function canPromote(s, w) {
  return !!w && w.grade < GRADES.length - 1 && atCap(w) && !w.pendingTraits
    && !!promoteMaterial(s, w) && s.minerals >= promoteCost(w.grade);
}

export function promote(s, id) {
  const w = find(s, id);
  if (!w) return fail('없는 무기');
  if (w.grade >= GRADES.length - 1) return fail('최고 등급');
  if (!atCap(w)) return fail(`+${GRADE_CAPS[w.grade]}강에서 승급할 수 있습니다`);
  const mat = promoteMaterial(s, w);
  if (!mat) return fail(`재료로 같은 ${GRADES[w.grade]} ${WEAPONS[w.type].name} 한 자루가 더 필요합니다`);
  if (s.minerals < promoteCost(w.grade)) return fail('미네랄 부족');
  s.minerals -= promoteCost(w.grade);
  s.weapons = s.weapons.filter((x) => x !== mat);
  w.grade += 1;
  w.level = 0;
  w.pity = 0;
  discover(s, w);
  return { ok: true, weapon: w, material: mat };
}

export function promoteAll(s) {
  let count = 0;
  for (;;) {
    const w = s.weapons.filter((x) => canPromote(s, x)).sort((a, b) => b.level - a.level)[0];
    if (!w) return { ok: true, count };
    promote(s, w.id);
    count += 1;
  }
}

// ---- 광맥 ----
const unlockedVein = (s) => s.building.unlocked ?? s.building.tier;

export function buildingUpgradeCost(s) {
  return Math.round(buildingStats(unlockedVein(s) + 1).reward * 10);
}

function moveTo(s, tier) {
  s.building.tier = tier;
  s.building.hp = buildingStats(tier).hp;
  s.building.hpLeft = s.building.hp;
  s.building.t = 0;
}

// 다음 등급 광맥을 개척하고 그리로 옮긴다.
export function upgradeBuilding(s) {
  const cost = buildingUpgradeCost(s);
  if (s.minerals < cost) return fail('미네랄 부족');
  s.minerals -= cost;
  s.building.unlocked = unlockedVein(s) + 1;
  moveTo(s, s.building.unlocked);
  return { ok: true };
}

export function selectVein(s, tier) {
  if (!(tier >= 0 && tier <= unlockedVein(s))) return fail('아직 개척하지 않은 광맥');
  moveTo(s, tier);
  return { ok: true };
}

export const veinIncome = (s, tier) => mineralsPerSec(miners(s), tier, ctxOf(s));

export function bestVein(s) {
  let best = 0;
  for (let t = 1; t <= unlockedVein(s); t++) if (veinIncome(s, t) > veinIncome(s, best)) best = t;
  return best;
}

// 평소엔 전부 채집하고, 보스에 도전할 때만 전원이 출동한다.
export const miners = (s) => s.weapons;
export const fighters = (s) => s.weapons;

export function incomePerSec(s) {
  return mineralsPerSec(miners(s), s.building.tier, ctxOf(s));
}

// 광맥을 직접 탭하면 채집 수입의 1/5 + 기본 2를 더 캔다. 초당 4~5번 누르면 수입이 두 배쯤 된다.
export const TAP_SHARE = 0.2;
export const TAP_BASE = 2;

export function tapGain(s) {
  return TAP_BASE + incomePerSec(s) * TAP_SHARE;
}

export function tapMine(s) {
  const g = tapGain(s);
  s.minerals += g;
  return g;
}

export function tick(s, seconds) {
  const rate = incomePerSec(s);
  s.minerals += rate * seconds;
  const dps = buildingDps(miners(s), ctxOf(s), s.building.tier);
  const b = s.building;
  if (dps > 0) {
    const cycle = Math.max(b.hp / dps, 0.2);
    b.t = (b.t + seconds) % cycle;
    b.hpLeft = Math.max(b.hp * (1 - b.t / cycle), b.hp * 0.02);
  }
  return rate * seconds;
}

export function applyOffline(s, nowMs) {
  const sec = Math.min(OFFLINE_CAP_SEC, Math.max(0, (nowMs - s.lastSeen) / 1000));
  s.lastSeen = nowMs;
  const gain = incomePerSec(s) * sec;
  s.minerals += gain;
  return gain;
}

export function save(s, storage) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

function looksValid(d) {
  return d && typeof d.minerals === 'number' && Number.isFinite(d.minerals) && Array.isArray(d.weapons)
    && d.building && typeof d.building.tier === 'number' && d.meta && Array.isArray(d.meta.unlocked);
}

export function load(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    const d = raw ? JSON.parse(raw) : null;
    return looksValid(d) ? d : newGame();
  } catch {
    return newGame();
  }
}
