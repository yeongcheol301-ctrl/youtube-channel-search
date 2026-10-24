// 게임 규칙: 화면 없이 계산만 한다. 행동은 {ok, reason?}를 돌려주고 실패하면 상태를 바꾸지 않는다.
import {
  MATERIALS, RECIPES, PATIENTS, UPGRADES, START_MONEY, START_ARROWS, MAX_STAMINA,
  DOSES_PER_BREW, MAX_MED_LEVEL, MED_UPGRADE_MAIN, CLOVER_HQ_COUNT, ARROW_PACK, ARROW_CRAFT,
} from './data.js';

const fail = (reason) => ({ ok: false, reason });

export function newState() {
  return {
    day: 1,
    phase: 'day',
    money: START_MONEY,
    arrows: START_ARROWS,
    stamina: MAX_STAMINA,
    rep: 0,
    inv: {},
    meds: { chrysTea: newMed(), mugwortPill: newMed() },
    menu: ['chrysTea', 'mugwortPill'],
    upgrades: {},
    flags: {},
    luck: 0,
    log: [],
  };
}

function newMed() {
  return { level: 1, doses: { n: 0, hq: 0 } };
}

export function count(s, id) {
  return s.inv[id]?.n ?? 0;
}

export function addItem(s, id, hq = false) {
  if (id === 'clover') s.luck += CLOVER_HQ_COUNT;
  else if (s.luck > 0 && MATERIALS[id].weight > 0) {
    hq = true;
    s.luck -= 1;
  }
  const slot = (s.inv[id] ??= { n: 0, hq: 0 });
  slot.n += 1;
  if (hq) slot.hq += 1;
}

// 상급부터 꺼낸다. 꺼낸 것 중 상급 개수를 돌려준다.
function takeItems(s, id, n) {
  const slot = s.inv[id];
  const hq = Math.min(slot.hq, n);
  slot.hq -= hq;
  slot.n -= n;
  return hq;
}

const hasItems = (s, items) => Object.entries(items).every(([id, n]) => count(s, id) >= n);

export function basketWeight(s) {
  return Object.entries(s.inv).reduce((w, [id, slot]) => w + MATERIALS[id].weight * slot.n, 0);
}

export function carryLimit(s) {
  return s.upgrades.basket ? 30 : 20;
}

// 한도를 넘으면 느려지고, 한도의 1.5배를 넘게는 못 담는다.
export function canCarry(s, id) {
  return basketWeight(s) + MATERIALS[id].weight <= carryLimit(s) * 1.5;
}

export function isOverweight(s) {
  return basketWeight(s) > carryLimit(s);
}

// 쓰러지면 바구니에서 가장 많이 가진 한 가지만 남긴다. 잃은 개수를 돌려준다.
export function collapseLoss(s) {
  const basket = Object.entries(s.inv).filter(([id, slot]) => MATERIALS[id].weight > 0 && slot.n > 0);
  if (!basket.length) return 0;
  basket.sort((a, b) => b[1].n - a[1].n);
  let lost = 0;
  for (const [id, slot] of basket.slice(1)) {
    lost += slot.n;
    delete s.inv[id];
  }
  return lost;
}

export function spendStamina(s, n) {
  s.stamina = Math.max(0, s.stamina - n);
  return s.stamina === 0;
}

export function isUnlocked(s, id) {
  const u = RECIPES[id].unlock;
  if (u === 'start') return true;
  if (u === 'quest1') return !!s.flags.quest1;
  return s.day >= u.day;
}

const doubled = (items) => Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v * 2]));

export function canDevelop(s, id) {
  return !s.meds[id] && isUnlocked(s, id) && hasItems(s, doubled(RECIPES[id].inputs));
}

export function develop(s, id) {
  if (!canDevelop(s, id)) return fail('재료가 모자라거나 이미 개발한 약');
  for (const [k, n] of Object.entries(doubled(RECIPES[id].inputs))) takeItems(s, k, n);
  s.meds[id] = newMed();
  if (s.menu.length < 3) s.menu.push(id);
  return { ok: true };
}

export function canBrew(s, id) {
  return !!s.meds[id] && hasItems(s, RECIPES[id].inputs);
}

export function brew(s, id) {
  if (!canBrew(s, id)) return fail('재료 부족');
  const inputs = Object.entries(RECIPES[id].inputs);
  const allHq = inputs.every(([k, n]) => s.inv[k].hq >= n);
  for (const [k, n] of inputs) takeItems(s, k, n);
  const d = s.meds[id].doses;
  d.n += DOSES_PER_BREW;
  if (allHq) d.hq += DOSES_PER_BREW;
  return { ok: true, hq: allHq };
}

export function repMult(s) {
  return 1 + Math.floor(s.rep / 20) * 0.05;
}

export function medPrice(s, id, hq) {
  const lv = s.meds[id]?.level ?? 1;
  return Math.round(RECIPES[id].price * Math.pow(1.3, lv - 1) * (hq ? 1.5 : 1) * repMult(s));
}

export function canUpgradeMed(s, id) {
  const m = s.meds[id];
  return !!m && m.level < MAX_MED_LEVEL && count(s, RECIPES[id].main) >= MED_UPGRADE_MAIN;
}

export function upgradeMed(s, id) {
  if (!canUpgradeMed(s, id)) return fail('최고 단계이거나 재료 부족');
  takeItems(s, RECIPES[id].main, MED_UPGRADE_MAIN);
  s.meds[id].level += 1;
  return { ok: true };
}

// 약 달이기 바늘 위치(0~1) → 별 1~3
export function brewGrade(pos) {
  if (pos >= 0.42 && pos <= 0.58) return 3;
  if (pos >= 0.28 && pos <= 0.72) return 2;
  return 1;
}

const GRADE_PAY = { 3: 1, 2: 0.8, 1: 0.5 };

export function serve(s, patientType, medId, grade) {
  const d = s.meds[medId]?.doses;
  if (!d || d.n <= 0) return fail('약이 없습니다');
  const hq = d.hq > 0;
  d.n -= 1;
  if (hq) d.hq -= 1;
  if (PATIENTS[patientType].cure !== medId) {
    s.rep = Math.max(0, s.rep - 1);
    return { ok: false, coins: 0, stars: -1 };
  }
  const coins = Math.round(medPrice(s, medId, hq) * GRADE_PAY[grade]);
  s.money += coins;
  s.rep += grade;
  return { ok: true, coins, stars: grade, hq };
}

export function patientsForDay(s) {
  return Math.min(14, 8 + Math.floor((s.day - 1) / 2) + Math.floor(s.rep / 15));
}

export function pickPatientType(s, rng) {
  const types = Object.keys(PATIENTS).filter((t) => !PATIENTS[t].special && isUnlocked(s, PATIENTS[t].cure));
  return types[Math.floor(rng() * types.length) % types.length];
}

export function canBuyUpgrade(s, key) {
  const u = UPGRADES[key];
  return !s.upgrades[key] && s.money >= u.money && hasItems(s, u.items);
}

export function buyUpgrade(s, key) {
  if (!canBuyUpgrade(s, key)) return fail('돈이나 재료가 모자랍니다');
  const u = UPGRADES[key];
  s.money -= u.money;
  for (const [k, n] of Object.entries(u.items)) takeItems(s, k, n);
  s.upgrades[key] = true;
  return { ok: true };
}

export function digTime(s) {
  return s.upgrades.hoe ? 0.25 : 0.5;
}

export function buyArrows(s) {
  if (s.money < ARROW_PACK.money) return fail('돈이 모자랍니다');
  s.money -= ARROW_PACK.money;
  s.arrows += ARROW_PACK.count;
  return { ok: true };
}

export function craftArrows(s) {
  if (!hasItems(s, ARROW_CRAFT.items)) return fail('깃털과 나무가 필요합니다');
  for (const [k, n] of Object.entries(ARROW_CRAFT.items)) takeItems(s, k, n);
  s.arrows += ARROW_CRAFT.count;
  return { ok: true };
}

export function useWood(s, n) {
  if (count(s, 'wood') < n) return false;
  takeItems(s, 'wood', n);
  return true;
}

export function giveItem(s, id) {
  if (count(s, id) < 1) return false;
  takeItems(s, id, 1);
  return true;
}
