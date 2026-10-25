// 게임 규칙: DOM 없이 계산만 한다. 숫자는 기획안 예시값.

export const MAX_LEVEL = 50;
// 등급마다 강화할 수 있는 끝 단계. 끝에 닿으면 승급해야 더 올라간다. 단계는 승급해도 이어진다.
export const GRADE_CAPS = [20, 30, 40, 45, 50];
export const TRAIT_LEVELS = [10, 20, 30, 40];

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
    traitPool: ['critChance', 'critChance', 'critMult', 'critMult', 'atkPct', 'speedPct', 'armorBreak'] },
  axe: { name: '도끼', price: 300, atk: 3, unlockCost: 30,
    traitPool: ['armorBreak', 'armorBreak', 'armorBreak', 'atkPct', 'atkPct', 'critChance', 'speedPct'] },
  staff: { name: '지팡이', price: 1000, atk: 8, unlockCost: 100,
    traitPool: ['atkPct', 'atkPct', 'atkPct', 'speedPct', 'critMult', 'armorBreak'] },
  bow: { name: '활', price: 500, atk: 2, unlockCost: 300,
    traitPool: ['speedPct', 'speedPct', 'speedPct', 'critChance', 'atkPct', 'armorBreak'] },
};
export const WEAPON_ORDER = ['sword', 'axe', 'staff', 'bow'];

// [시작 단계, 끝 단계, 시작 성공률, 끝 성공률]
const RATE_BANDS = [
  [0, 5, 0.95, 0.80],
  [5, 10, 0.75, 0.55],
  [10, 20, 0.50, 0.30],
  [20, 30, 0.30, 0.15],
  [30, 50, 0.15, 0.03],
];

const lerp = (a, b, t) => a + (b - a) * t;

function baseRate(level) {
  const band = RATE_BANDS.find(([lo, hi]) => level >= lo && level < hi) ?? RATE_BANDS.at(-1);
  const [lo, hi, a, b] = band;
  return lerp(a, b, (level - lo) / (hi - lo));
}

export function successRate(level, type, bonusPct = 0) {
  if (level >= MAX_LEVEL) return 0;
  const mult = type === 'axe' ? 0.85 : 1;
  return Math.min(1, baseRate(level) * mult + bonusPct / 100);
}

export function destroyChance(level, type) {
  if (type === 'axe' || level < 10) return 0;
  if (level < 20) return 0.05;
  if (level < 30) return lerp(0.10, 0.20, (level - 20) / 10);
  return lerp(0.25, 0.40, (level - 30) / 20);
}

export function enhanceCost(level, type, discount = 0) {
  const mult = type === 'staff' ? 2 : 1;
  return Math.round(WEAPONS[type].price * Math.pow(1.25, level) * mult * (1 - discount));
}

// weapon.level, weapon.pity를 바꾸고 결과를 돌려준다. rng: () => [0,1)
export function rollEnhance(weapon, rng, bonusPct = 0, cap = MAX_LEVEL) {
  if (weapon.level >= cap) return { result: 'max', level: weapon.level };
  const guaranteed = weapon.pity >= 100;
  if (guaranteed || rng() < successRate(weapon.level, weapon.type, bonusPct)) {
    const jump = weapon.type === 'staff' && rng() < 0.15 ? 2 : 1;
    weapon.level = Math.min(cap, weapon.level + jump);
    weapon.pity = 0;
    return { result: jump === 2 ? 'up2' : 'up', level: weapon.level };
  }
  weapon.pity = Math.min(100, weapon.pity + 10);
  if (weapon.level < 5) return { result: 'stay', level: weapon.level };
  if (rng() < destroyChance(weapon.level, weapon.type)) return { result: 'destroy', level: weapon.level };
  weapon.level -= 1;
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
export const GRADE_MULT = 3;
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
  const innate = weapon.type === 'axe' ? 3 + Math.floor(weapon.level / 5) : 0;
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
export const BOSS_TUNING = { hp: 300, hpGrowth: 3, armor: 0.5, armorGrowth: 1.8 };
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

// 광맥: 채집 DPS × 효율 = 초당 미네랄. 업그레이드하면 체력(연출용)과 효율이 함께 오른다.
export const BUILDING_TUNING = { hp: 5, hpGrowth: 2.2, eff: 7, effGrowth: 1.35 };

export function buildingStats(tier) {
  const t = BUILDING_TUNING;
  const hp = t.hp * Math.pow(t.hpGrowth, tier);
  const eff = t.eff * Math.pow(t.effGrowth, tier);
  return { hp, eff, reward: hp * eff };
}

export function buildingDps(weapons, ctx) {
  return weapons.reduce((s, w) => s + weaponAttack(w, ctx) * weaponHitsPerSec(w) * critFactor(w) * (w.type === 'axe' ? 2 : 1), 0);
}

export function mineralsPerSec(weapons, tier, ctx) {
  return buildingDps(weapons, ctx) * buildingStats(tier).eff * (1 + (ctx.perm?.rewardPct ?? 0));
}
