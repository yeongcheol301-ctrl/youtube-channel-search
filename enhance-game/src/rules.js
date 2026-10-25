// 게임 규칙: DOM 없이 계산만 한다. 숫자는 기획안 예시값.

// 등급마다 +0부터 다시 강화한다. 끝에 닿으면 승급, 승급하면 다음 등급 +0.
export const GRADE_CAPS = [10, 10, 10, 10, 15];
export const MAX_LEVEL = 15;
// 등급마다 이 단계에 닿으면 특성을 하나 고른다.
export const TRAIT_LEVELS = [5, 10, 15];

export const TRAITS = {
  atkPct: { label: '공격력 +20%', value: 0.2 },
  critChance: { label: '치명타 확률 +10%', value: 0.1 },
  critMult: { label: '치명타 피해 +50%', value: 0.5 },
  armorBreak: { label: '방깎 +10', value: 10 },
  speedPct: { label: '공속 +20%', value: 0.2 },
};

// traitPool: 같은 항목이 여러 번 있으면 더 자주 뜬다.
export const WEAPONS = {
  sword: { name: '검', price: 100, atk: 1, unlockCost: 0,
    pitch: '가장 기본이 되는 무기. 치명타로 한 방을 노린다.',
    pros: ['값이 싸서 여러 자루 굴리기 좋음', '치명타 특성이 잘 뜸'], cons: ['높은 등급에서 강화 실패 시 깨질 수 있음'], counters: ['giant'],
    traitPool: ['critChance', 'critChance', 'critMult', 'critMult', 'atkPct', 'speedPct', 'armorBreak'] },
  axe: { name: '도끼', price: 300, atk: 3, unlockCost: 30,
    pitch: '절대 깨지지 않는 안전빵. 광맥을 두 배로 부순다.',
    pros: ['강화 실패해도 파괴 없음', '광맥 채집량 2배', '기본 방깎으로 철갑 보스에 강함'], cons: ['강화 성공률이 조금 낮음', '공격이 느림'], counters: ['armored'],
    traitPool: ['armorBreak', 'armorBreak', 'armorBreak', 'atkPct', 'atkPct', 'critChance', 'speedPct'] },
  staff: { name: '지팡이', price: 1000, atk: 8, unlockCost: 100,
    pitch: '방어를 무시하는 마법 공격. 가끔 두 단계를 건너뛴다.',
    pros: ['마법이라 방어·방벽 무시', '성공 시 15% 확률로 +2강'], cons: ['강화 비용 2배', '공격이 가장 느림'], counters: ['barrier', 'armored'],
    traitPool: ['atkPct', 'atkPct', 'atkPct', 'speedPct', 'critMult', 'armorBreak'] },
  bow: { name: '활', price: 500, atk: 2, unlockCost: 300,
    pitch: '빠른 연사. 여러 자루가 모일수록 서로 강해진다.',
    pros: ['공격이 가장 빠름', '보유한 활 1자루마다 모든 활 공격력 +10%'], cons: ['한 자루만으로는 약함'], counters: ['multihit', 'regen'],
    traitPool: ['speedPct', 'speedPct', 'speedPct', 'critChance', 'atkPct', 'armorBreak'] },
};
export const WEAPON_ORDER = ['sword', 'axe', 'staff', 'bow'];

// 등급별 +0 성공률과 마지막 단계 성공률. 사이 단계는 직선으로 떨어진다.
const GRADE_RATES = [[0.95, 0.60], [0.85, 0.45], [0.70, 0.30], [0.55, 0.20], [0.40, 0.10]];
// 등급별로 이 단계부터 실패 시 파괴 위험이 생긴다(도끼 제외).
const DESTROY_FROM = [Infinity, 8, 6, 4, 3];
const DESTROY_P = [0, 0.08, 0.10, 0.12, 0.15];

const lerp = (a, b, t) => a + (b - a) * t;

export function successRate(level, type, bonusPct = 0, grade = 0) {
  const cap = GRADE_CAPS[grade];
  if (level >= cap) return 0;
  const [a, b] = GRADE_RATES[grade];
  const base = lerp(a, b, cap > 1 ? level / (cap - 1) : 0);
  const mult = type === 'axe' ? 0.85 : 1;
  return Math.min(1, base * mult + bonusPct / 100);
}

export function destroyChance(level, type, grade = 0) {
  if (type === 'axe' || level < DESTROY_FROM[grade]) return 0;
  return DESTROY_P[grade];
}

export function enhanceCost(level, type, discount = 0, grade = 0) {
  const mult = type === 'staff' ? 2 : 1;
  return Math.round(WEAPONS[type].price * Math.pow(1.35, level) * Math.pow(6, grade) * mult * (1 - discount));
}

// weapon.level, weapon.pity를 바꾸고 결과를 돌려준다. rng: () => [0,1)
export function rollEnhance(weapon, rng, bonusPct = 0) {
  const grade = weapon.grade ?? 0;
  const cap = GRADE_CAPS[grade];
  if (weapon.level >= cap) return { result: 'max', level: weapon.level };
  const guaranteed = weapon.pity >= 100;
  if (guaranteed || rng() < successRate(weapon.level, weapon.type, bonusPct, grade)) {
    const jump = weapon.type === 'staff' && rng() < 0.15 ? 2 : 1;
    weapon.level = Math.min(cap, weapon.level + jump);
    weapon.pity = 0;
    return { result: jump === 2 ? 'up2' : 'up', level: weapon.level };
  }
  weapon.pity = Math.min(100, weapon.pity + 10);
  if (grade === 0 && weapon.level < 5) return { result: 'stay', level: weapon.level };
  if (rng() < destroyChance(weapon.level, weapon.type, grade)) return { result: 'destroy', level: weapon.level };
  weapon.level = Math.max(0, weapon.level - 1);
  return { result: 'down', level: weapon.level };
}

// 10억 아래는 스타처럼 쉼표 숫자(10,000), 그 위는 억·조·경 단위.
const COMMA_LIMIT = 1e9;
const UNITS = [[1e16, '경'], [1e12, '조'], [1e8, '억']];

export function formatNumber(n) {
  if (!Number.isFinite(n)) return '측정 불가';
  if (n < 0) return '-' + formatNumber(-n);
  if (n < COMMA_LIMIT) return Math.floor(n).toLocaleString('en-US');
  for (const [size, name] of UNITS) {
    if (n >= size) {
      const v = n / size;
      const text = v >= 1e4 ? Math.floor(v).toLocaleString('ko-KR') : (v < 100 ? (Math.floor(v * 10) / 10).toString() : Math.floor(v).toString());
      return text + name;
    }
  }
  return Math.floor(n).toLocaleString('ko-KR');
}

// ---- 전투·채집 ----

export const ATK_GROWTH = 1.25;
export const GRADE_MULT = 12;
const BASE_SPEED = { sword: 1, axe: 0.8, staff: 0.7, bow: 1.4 };
const BASE_CRIT = { chance: 0.05, mult: 2 };
export const GRADES = ['일반', '희귀', '전설', '히어로', '초월'];

function traitSum(weapon, key) {
  return weapon.traits.filter((t) => t === key).length * TRAITS[key].value;
}

export function weaponAttack(weapon, ctx) {
  const def = WEAPONS[weapon.type];
  const bow = weapon.type === 'bow' ? 1 + 0.1 * (ctx.bowCount ?? 0) : 1;
  const pct = (1 + traitSum(weapon, 'atkPct')) * (1 + (ctx.perm?.atkPct ?? 0));
  return def.atk * Math.pow(GRADE_MULT, weapon.grade) * Math.pow(ATK_GROWTH, weapon.level) * pct * bow;
}

export function weaponHitsPerSec(weapon) {
  return BASE_SPEED[weapon.type] * (1 + traitSum(weapon, 'speedPct'));
}

// 치명타는 기대값으로 계산해 결과가 매번 같게 한다.
function critFactor(weapon) {
  const chance = Math.min(1, BASE_CRIT.chance + traitSum(weapon, 'critChance'));
  return 1 + chance * (BASE_CRIT.mult + traitSum(weapon, 'critMult') - 1);
}

export function weaponArmorBreak(weapon) {
  const innate = weapon.type === 'axe' ? 3 + Math.floor(weapon.level / 5) + 4 * weapon.grade : 0;
  return innate + traitSum(weapon, 'armorBreak');
}

export const BOSS_TYPES = {
  armored: { name: '철갑', hint: '방어력이 매우 높음 → 방깎·마법' },
  giant: { name: '거인', hint: '체력이 막대함 → 치명타 폭딜' },
  barrier: { name: '마법 방벽', hint: '물리 공격 절반 → 지팡이' },
  multihit: { name: '추가타격', hint: '정해진 횟수 이상 때려야 함 → 공속·활' },
  regen: { name: '재생', hint: '체력이 계속 회복 → 짧게 몰아치기' },
};
const BOSS_ORDER = ['giant', 'armored', 'barrier', 'multihit', 'regen'];
export const BOSS_TUNING = { hp: 300, hpGrowth: 4, armor: 0.5, armorGrowth: 1.8 };
export const FIGHT_SECONDS = 30;

export function bossTypesFor(stage) {
  const first = BOSS_ORDER[(stage * 3 + Math.floor(stage / 5)) % 5];
  if (stage === 1) return ['giant'];
  if (stage < 6) return [first];
  const second = BOSS_ORDER[(stage * 2 + 1) % 5];
  return second === first ? [first, BOSS_ORDER[(BOSS_ORDER.indexOf(first) + 1) % 5]] : [first, second];
}

export function makeBoss(stage) {
  const types = bossTypesFor(stage);
  const has = (t) => types.includes(t);
  const t = BOSS_TUNING;
  return {
    stage, types,
    hp: t.hp * Math.pow(t.hpGrowth, stage - 1) * (has('giant') ? 2.5 : 1),
    armor: t.armor * Math.pow(t.armorGrowth, stage - 1) * (has('armored') ? 6 : 1),
    barrier: has('barrier'),
    hitsNeeded: has('multihit') ? Math.round(15 * Math.pow(stage, 1.1)) : 0,
    regenPct: has('regen') ? 0.03 : 0,
  };
}

function hitDamage(weapon, boss, armorBreakTotal, ctx) {
  const atk = weaponAttack(weapon, ctx) * critFactor(weapon);
  if (weapon.type === 'staff') return atk;
  const armor = Math.max(0, boss.armor - armorBreakTotal);
  const dmg = Math.max(atk - armor, atk * 0.1);
  return boss.barrier ? dmg / 2 : dmg;
}

export function partyArmorBreak(weapons) {
  return weapons.reduce((s, w) => s + weaponArmorBreak(w), 0);
}

export function bossFight(weapons, boss, ctx) {
  const ab = partyArmorBreak(weapons);
  const perSec = weapons.reduce((s, w) => s + hitDamage(w, boss, ab, ctx) * weaponHitsPerSec(w), 0);
  const hitsPerSec = weapons.reduce((s, w) => s + weaponHitsPerSec(w), 0);
  let hp = boss.hp, damage = 0, hits = 0, killed = false;
  for (let sec = 0; sec < FIGHT_SECONDS; sec++) {
    hp -= perSec; damage += perSec; hits += hitsPerSec;
    if (hp <= 0 && hits >= boss.hitsNeeded) { killed = true; break; }
    hp = Math.min(boss.hp, hp + boss.hp * boss.regenPct);
  }
  return { damage, hits, killed, dps: perSec };
}

// 광맥: 등급마다 단단함(방어력)이 있다. 한 방 피해가 단단함보다 약한 무기는 튕겨 나가 아무것도 못 캔다.
// 그래서 약한 무기를 아무리 많이 보내도 높은 광맥은 못 캐고, 강한 무기일수록 높은 광맥에서 더 번다.
export const VEIN_NAMES = ['흙빛 광맥', '구리 광맥', '철 광맥', '은 광맥', '금 광맥', '미스릴 광맥', '아다만 광맥', '용암 수정', '심연 수정', '혼돈의 결정'];
export const BUILDING_TUNING = { hp: 5, hpGrowth: 2.2, eff: 7, effGrowth: 1.7, armor: 4, armorGrowth: 2.6 };

export function veinName(tier) {
  return tier < VEIN_NAMES.length ? VEIN_NAMES[tier] : `${VEIN_NAMES.at(-1)} ${tier - VEIN_NAMES.length + 2}층`;
}

export function buildingStats(tier) {
  const t = BUILDING_TUNING;
  const hp = t.hp * Math.pow(t.hpGrowth, tier);
  const eff = t.eff * Math.pow(t.effGrowth, tier);
  const armor = tier === 0 ? 0 : t.armor * Math.pow(t.armorGrowth, tier - 1);
  return { hp, eff, armor, reward: hp * eff, name: veinName(tier) };
}

// 한 번 휘두를 때 광맥에 들어가는 피해. 도끼는 두 배이고 자기 방깎만큼 단단함을 깎는다.
export function mineHit(weapon, tier, ctx) {
  const armor = Math.max(0, buildingStats(tier).armor - weaponArmorBreak(weapon));
  const hit = Math.max(0, weaponAttack(weapon, ctx) * critFactor(weapon) - armor);
  return hit * (weapon.type === 'axe' ? 2 : 1);
}

export function buildingDps(weapons, ctx, tier = 0) {
  return weapons.reduce((s, w) => s + mineHit(w, tier, ctx) * weaponHitsPerSec(w), 0);
}

export function mineralsPerSec(weapons, tier, ctx) {
  return buildingDps(weapons, ctx, tier) * buildingStats(tier).eff * (1 + (ctx.perm?.rewardPct ?? 0));
}
