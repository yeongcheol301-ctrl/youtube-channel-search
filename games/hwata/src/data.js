// 게임 데이터: 바닷가 마을의 화타. 낮에는 물속에서 약재를 따고, 밤에는 한의원을 연다.

export const DAYS = 7;
export const DAY_SECONDS = 200;
export const NIGHT_SECONDS = 180;
export const MAX_STAMINA = 100; // 숨
export const BREATH_PER_SEC = 1.6;
export const START_MONEY = 50;
export const START_ARROWS = 5; // 그물

// weight 0 은 바구니 무게에 들어가지 않는다. sell 이 있으면 밤 장터에 팔 수 있다.
export const MATERIALS = {
  seaweed: { name: '미역', weight: 1 },
  kelp: { name: '다시마', weight: 1 },
  oyster: { name: '굴', weight: 1 },
  seaCucumber: { name: '해삼', weight: 2 },
  cuttlebone: { name: '오징어뼈', weight: 1 },
  pollock: { name: '북어', weight: 2 },
  rockfish: { name: '우럭', weight: 3, sell: 15 },
  pearl: { name: '진주', weight: 0, rare: true, sell: 60 },
  seahorse: { name: '해마', weight: 0, rare: true, sell: 80 },
  sharkTooth: { name: '상어 이빨', weight: 0, rare: true, sell: 120 },
  clover: { name: '불가사리', weight: 0, rare: true },
};

// unlock: 'start' | 'quest1' | {day}
export const RECIPES = {
  seaweedSoup: {
    name: '미역탕', inputs: { seaweed: 3 }, main: 'seaweed',
    cures: '기운 없음, 산후 회복', price: 20, unlock: 'start',
  },
  oysterPorridge: {
    name: '굴죽', inputs: { oyster: 2, seaweed: 1 }, main: 'oyster',
    cures: '어지럼, 핏기 없음', price: 30, unlock: 'start',
  },
  cuttlePowder: {
    name: '해표초 가루', inputs: { cuttlebone: 2 }, main: 'cuttlebone',
    cures: '속쓰림, 신물', price: 40, unlock: 'quest1',
  },
  pollockSoup: {
    name: '북어탕', inputs: { pollock: 2, kelp: 1 }, main: 'pollock',
    cures: '숙취, 속 울렁임', price: 35, unlock: { day: 3 },
  },
  cucumberPill: {
    name: '해삼환', inputs: { seaCucumber: 2, kelp: 1 }, main: 'seaCucumber',
    cures: '허리·무릎 아픔', price: 50, unlock: { day: 4 },
  },
};

export const RECIPE_ORDER = ['seaweedSoup', 'oysterPorridge', 'cuttlePowder', 'pollockSoup', 'cucumberPill'];
export const DOSES_PER_BREW = 3;
export const MAX_MED_LEVEL = 3;
export const MED_UPGRADE_MAIN = 5;
export const MAX_MENU = 3;

export const PATIENTS = {
  mother: { name: '아낙', line: '몸에 기운이 하나도 없어요...', cure: 'seaweedSoup' },
  elder: { name: '노인', line: '자꾸 머리가 핑 도는구먼', cure: 'oysterPorridge' },
  diver: { name: '해녀', line: '속이 쓰려서 물질을 못 하겠어', cure: 'cuttlePowder' },
  drunk: { name: '술꾼', line: '어제 좀... 아니 그냥 머리가 아프네', cure: 'pollockSoup' },
  fisher: { name: '어부', line: '그물 당기다 허리가 나갔소', cure: 'cucumberPill' },
  zhangfei: { name: '장비', line: '어제 그 의원 양반! 속이 뒤집히오...', cure: 'pollockSoup', special: true },
};

export const UPGRADES = {
  gourd: { name: '박 숨주머니', desc: '숨 100 → 150', money: 120, items: { oyster: 2 } },
  fins: { name: '물갈퀴', desc: '헤엄 속도 +30%', money: 150, items: { kelp: 3 } },
  harpoon: { name: '쇠작살', desc: '작살 위력 2배', money: 200, items: { rockfish: 2 } },
  lantern: { name: '물속 등불', desc: '깊은 곳이 밝게 보임', money: 150, items: { cuttlebone: 2 } },
  basket: { name: '망사리', desc: '무게 한도 20 → 30', money: 100, items: { seaweed: 4 } },
};

export const ARROW_PACK = { count: 5, money: 20 }; // 그물 5개
export const LADDER_WOOD = 1;
export const BRIDGE_WOOD = 1;

// 날마다 새로 자라는 약재 수
export const DAILY_SPAWNS = { seaweed: 9, kelp: 7, oyster: 7, seaCucumber: 5 };
export const FISH_PER_DAY = { pollock: 8, rockfish: 4, cuttlefish: 3, seahorse: 1, jelly: 6, moray: 2, shark: 1 };
export const CLOVER_CHANCE = 0.35;
export const CLOVER_HQ_COUNT = 5;

// 청낭서: 화타의 의서. 싣고 가던 배가 가라앉아 상자 속에 흩어졌다.
export const PAGES = {
  1: { name: '청낭서 1장 · 채약편', perk: '약재를 딸 때 초록칸이 넓어집니다' },
  2: { name: '청낭서 2장 · 탕전편', perk: '약을 달일 때 초록칸이 넓어집니다' },
  3: { name: '청낭서 3장 · 양생편', perk: '숨이 30 늘어납니다' },
};

// 바닷속 상자(난파선 짐). y 가 없으면 x 자리 바닥에 반쯤 묻혀 있다. y 가 있는 것은 난파선 안. 지도에 한 번만 있다.
export const POTS = [
  { x: 30, loot: { money: 15 } },
  { x: 56, loot: { arrows: 3 } },
  { x: 66, loot: { page: 1 } },
  { x: 80, loot: { item: 'pearl', n: 1 } },
  { x: 101, loot: { money: 30 } },
  { x: 114, loot: { page: 2 } },
  { x: 120, loot: { item: 'seahorse', n: 1 } },
  { x: 125, y: 106, loot: { item: 'pearl', n: 2 } },
  { x: 134, y: 106, loot: { page: 3 } },
];
