// 게임 데이터: 기획안 「시제품 1: 마을 뒷들」의 예시값.

export const DAYS = 7;
export const DAY_SECONDS = 180;
export const NIGHT_SECONDS = 180;
export const MAX_STAMINA = 100;
export const START_MONEY = 50;
export const START_ARROWS = 20;

// weight 0 은 바구니 무게에 들어가지 않는다(나무·깃털처럼 따로 챙기는 것).
export const MATERIALS = {
  mugwort: { name: '쑥', weight: 1 },
  chrysanthemum: { name: '국화', weight: 1 },
  plantain: { name: '질경이', weight: 1 },
  dandelion: { name: '민들레', weight: 1 },
  dropwort: { name: '미나리', weight: 1 },
  bellflower: { name: '도라지', weight: 2 },
  kudzu: { name: '칡뿌리', weight: 3 },
  honey: { name: '꿀', weight: 2 },
  cicada: { name: '매미 허물', weight: 0 },
  pheasantFat: { name: '꿩 기름', weight: 2 },
  feather: { name: '꿩 깃털', weight: 0 },
  rabbitFur: { name: '토끼 털', weight: 1 },
  whiteFur: { name: '흰 토끼 털', weight: 1, rare: true },
  clover: { name: '네잎클로버', weight: 0, rare: true },
  wood: { name: '나무', weight: 0 },
};

// unlock: 'start' | 'quest1' | {day}
export const RECIPES = {
  chrysTea: {
    name: '국화차', inputs: { chrysanthemum: 3 }, main: 'chrysanthemum',
    cures: '두통, 눈 충혈', price: 20, unlock: 'start',
  },
  mugwortPill: {
    name: '쑥꿀환', inputs: { mugwort: 3, honey: 1 }, main: 'mugwort',
    cures: '배앓이, 속쓰림', price: 30, unlock: 'start',
  },
  plantainSalve: {
    name: '질경이 고약', inputs: { plantain: 3, pheasantFat: 1 }, main: 'plantain',
    cures: '상처, 붓기', price: 40, unlock: 'quest1',
  },
  kudzuJuice: {
    name: '칡즙', inputs: { kudzu: 2, dropwort: 1 }, main: 'kudzu',
    cures: '숙취, 열', price: 35, unlock: { day: 3 },
  },
  bellflowerSyrup: {
    name: '도라지청', inputs: { bellflower: 2, honey: 1 }, main: 'bellflower',
    cures: '기침, 목 아픔', price: 50, unlock: { day: 4 },
  },
};

export const RECIPE_ORDER = ['chrysTea', 'mugwortPill', 'plantainSalve', 'kudzuJuice', 'bellflowerSyrup'];
export const DOSES_PER_BREW = 3;
export const MAX_MED_LEVEL = 3;
export const MED_UPGRADE_MAIN = 5;
export const MAX_MENU = 3;

export const PATIENTS = {
  scholar: { name: '선비', line: '글을 오래 읽었더니 머리가 지끈거리오', cure: 'chrysTea' },
  child: { name: '아이', line: '배가 아파요...', cure: 'mugwortPill' },
  farmer: { name: '농부', line: '낫질하다 손을 베었소', cure: 'plantainSalve' },
  drunk: { name: '술꾼', line: '어제 좀... 아니 그냥 머리가 아프네', cure: 'kudzuJuice' },
  elder: { name: '노인', line: '콜록콜록, 목이 칼칼하구먼', cure: 'bellflowerSyrup' },
  zhangfei: { name: '장비', line: '어제 그 의원 양반! 속이 뒤집히오...', cure: 'kudzuJuice', special: true },
};

export const UPGRADES = {
  basket: { name: '바구니', desc: '무게 한도 20 → 30', money: 100, items: { rabbitFur: 2 } },
  hoe: { name: '괭이', desc: '흙 파기 0.5초 → 0.25초', money: 150, items: { wood: 5 } },
  bow: { name: '활', desc: '화살이 50% 더 멀리, 덜 떨어짐', money: 200, items: { feather: 3 } },
};

export const ARROW_PACK = { count: 10, money: 20 };
export const ARROW_CRAFT = { count: 5, items: { feather: 1, wood: 1 } };
export const LADDER_WOOD = 2;
export const BRIDGE_WOOD = 3;

// 하루에 땅 위·땅속에 새로 생기는 재료 개수.
export const DAILY_SPAWNS = {
  mugwort: 8, chrysanthemum: 6, plantain: 6, dandelion: 4, dropwort: 5,
  bellflower: 4, kudzu: 3, cicada: 3, tree: 6,
};
export const ANIMALS_PER_DAY = { rabbit: 3, pheasant: 3 };
export const WHITE_RABBIT_CHANCE = 0.2;
export const CLOVER_CHANCE = 0.1;
export const CLOVER_HQ_COUNT = 5;
