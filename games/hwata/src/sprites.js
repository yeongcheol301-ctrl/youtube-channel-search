// 도트 그림. 글자 하나가 픽셀 하나이고 '.'은 투명이다. 모두 오른쪽을 본다.

const HEADS = {
  cap: ['...HHHH...', '..HHHHHH..', '..SSSSSS..', '..SSSSES..', '..SSSSNS..', '..SSSSSS..'],
  gat: ['...HHHH...', '...HHHH...', 'HHHHHHHHHH', '..SSSSSS..', '..SSSSES..', '..SSSSNS..'],
  hair: ['....HH....', '..HHHHHH..', '..HSSSSS..', '..SSSSES..', '..SSSSNS..', '..SSSSSS..'],
};
const BEARD = {
  long: ['..BBSSSB..', '...BBBBB..'],
  bushy: ['.BBBSSBBB.', '..BBBBBB..'],
  none: ['...SSSS...', '....SS....'],
};
const BODY = ['..RRRRRR..', '.RRRLLRRR.', '.RDRRRRDR.', '.RDRRRRDR.', '..RRRRRR..', '..RRRRRR..'];
const LEGS = [['..RD..DR..', '..KK..KK..'], ['...RDDR...', '...KKKK...']];

const person = (head, beard, frame = 0) => [...HEADS[head], ...BEARD[beard], ...BODY, ...LEGS[frame]];

const SKIN = { S: '#e9c29b', E: '#1b1410', N: '#d9a882', K: '#3a2b1d' };

const PEOPLE = {
  hwata: { head: 'cap', beard: 'long', pal: { H: '#3b2f2a', B: '#efeadf', R: '#3f5f86', D: '#2c4566', L: '#c99a3c' } },
  woodcutter: { head: 'cap', beard: 'none', pal: { H: '#c9b28a', R: '#7a5636', D: '#5a3f27', L: '#3a2b1d' } },
  child: { head: 'hair', beard: 'none', pal: { H: '#1b1410', R: '#d97b8c', D: '#b45d6e', L: '#f0d36a', N: '#c24b4b' } },
  zhangfei: { head: 'cap', beard: 'bushy', pal: { H: '#1b1410', B: '#1b1410', R: '#3b3b46', D: '#26262e', L: '#b8432f', N: '#d0705a', S: '#d8a77e' } },
  scholar: { head: 'gat', beard: 'long', pal: { H: '#1b1410', B: '#3b2f2a', R: '#ece6d6', D: '#c9c1ad', L: '#6c8fb5' } },
  farmer: { head: 'gat', beard: 'none', pal: { H: '#d6b25e', R: '#b7a27e', D: '#8f7c5a', L: '#5a4632' } },
  drunk: { head: 'cap', beard: 'none', pal: { H: '#5a4632', R: '#6b6f8a', D: '#50546c', L: '#3a2b1d', N: '#d6402f', S: '#eeb08e' } },
  elder: { head: 'hair', beard: 'long', pal: { H: '#efeadf', B: '#efeadf', R: '#8a8f7a', D: '#6d725e', L: '#4a3d2c' } },
};

const ART = {
  rabbit: {
    rows: ['.......f.', '......ff.', '..fffffe.', '.ffffffff', 'lfffffff.', '.fffffff.', '..l...l..'],
    pal: { f: '#a07a52', l: '#d9bf98', e: '#1b1410' },
  },
  rabbit2: {
    rows: ['.......f.', '......ff.', '..fffffe.', '.ffffffff', 'lfffffff.', '.fffffff.', '.l.....l.'],
    pal: { f: '#a07a52', l: '#d9bf98', e: '#1b1410' },
  },
  pheasant: {
    rows: ['.......rg.', '......ggge', '.....wbbb.', 'ttbbbbbbb.', '..tbbbbbb.', '....bbbb..', '....k..k..'],
    pal: { r: '#b8432f', g: '#2f6b4f', e: '#f0d36a', w: '#f2efe6', b: '#8a5a2e', t: '#6e4524', k: '#3a2b1d' },
  },
  pheasantFly: {
    rows: ['..tt...rg.', '...ttbggge', 'bbbbbwbbb.', '.bbbbbbbbt', '....bbbb.t', '..........', '..........'],
    pal: { r: '#b8432f', g: '#2f6b4f', e: '#f0d36a', w: '#f2efe6', b: '#8a5a2e', t: '#6e4524' },
  },
  mugwort: {
    rows: ['...g....', '..ggg.g.', '.gsgg.gg', '..gsgGg.', 'g.gGgg..', 'ggsgG.g.', '.gGGgGg.', '..GGGG..'],
    pal: { g: '#6f9a55', G: '#3f6a36', s: '#b4c4ad' },
  },
  chrysanthemum: {
    rows: ['..yyy...', '.yyoyy..', '..yyy.yy', '...g.yoy', '..gg..yy', '...g.g..', '..ggggg.', '...ggg..'],
    pal: { y: '#e8b83c', o: '#b8702a', g: '#4f7d40' },
  },
  plantain: {
    rows: ['...s....', '...s....', '...s....', 'g..s..g.', 'gg.s.gg.', '.ggsgg..', 'ggggggg.', '.ggggg..'],
    pal: { g: '#5c8f45', s: '#8f9a5a' },
  },
  dandelion: {
    rows: ['..yyy...', '.yyoyy..', '..yyy...', '...g....', '...g....', 'g..g..g.', 'gg.g.gg.', '.ggggg..'],
    pal: { y: '#f3cf3d', o: '#d49a1f', g: '#5c8f45' },
  },
  dropwort: {
    rows: ['.g..g...', 'ggg.gg..', '.g..g.g.', '.g.g.ggg', '..gg..g.', '..g..g..', '..g.g...', '..ggg...'],
    pal: { g: '#7cb85a' },
  },
  sprout: { rows: ['.g..g.', 'gg..gg', '.gggg.', '..gg..'], pal: { g: '#6aa04f' } },
  bellflowerRoot: {
    rows: ['...gg...', '..bbbb..', '.bBbbbb.', '..bbbBb.', '..bBbb..', '...bb...', '...b....', '....b...'],
    pal: { g: '#6aa04f', b: '#efe3c4', B: '#c9b88e' },
  },
  kudzuRoot: {
    rows: ['....g...', '...kk...', '..kKkk..', '.kkkKkk.', '.kKkkkk.', '..kkKk..', '...kk...', '....k...'],
    pal: { g: '#6aa04f', k: '#9a7448', K: '#6b4d2c' },
  },
  tree: {
    rows: ['..gggg..', '.gGgggg.', 'gggGgGgg', 'gGggggGg', 'ggggGggg', '.gGgggg.', '..gggg..', '...tt...', '...tt...', '...tt...', '...tt...', '..tttt..'],
    pal: { g: '#5f8f48', G: '#3f6a36', t: '#6b4a2b' },
  },
  cicada: { rows: ['.aa..', 'aAAa.', 'aAAa.', '.aa..', 'a..a.'], pal: { a: '#c99446', A: '#8a5c22' } },
  beehive: {
    rows: ['...Y...', '..yyy..', '.yYyYy.', 'yyyyyyy', 'yYyYyYy', 'yyykyyy', '.yYyYy.', '..yyy..', '...y...'],
    pal: { y: '#d4a94a', Y: '#8f6f2c', k: '#2a1f12' },
  },
  honey: { rows: ['.yyy.', 'yYyYy', 'yyyyy', 'yYyYy', '.yyy.'], pal: { y: '#e6b53e', Y: '#a87a22' } },
  clover: { rows: ['.c..c.', 'ccccc.', '.cc...', 'ccccc.', '.c.c..', '...g..'], pal: { c: '#45b04c', g: '#2f7a35' } },
  bottle: { rows: ['.PP..', '.pp..', 'pppp.', 'pPpp.', 'pppp.', 'PPPP.'], pal: { p: '#7d9a96', P: '#3f5555' } },
  sign: {
    rows: ['tttttttt', 'tTTTTTTt', 'tTkkkkTt', 'tTTTTTTt', 'tttttttt', '...tt...', '...tt...', '...tt...'],
    pal: { t: '#6b4a2b', T: '#a77c4c', k: '#3a2b1d' },
  },
  bee: { rows: ['.w.', 'yky', '.y.'], pal: { w: '#e8eef2', y: '#e8b83c', k: '#1b1410' } },
};

for (const [key, p] of Object.entries(PEOPLE)) {
  const pal = { ...SKIN, ...p.pal };
  ART[key] = { rows: person(p.head, p.beard, 0), pal };
  ART[key + '2'] = { rows: person(p.head, p.beard, 1), pal };
}
ART.whiteRabbit = { rows: ART.rabbit.rows, pal: { f: '#f3f1ea', l: '#d8d4ca', e: '#c0453a' } };
ART.whiteRabbit2 = { rows: ART.rabbit2.rows, pal: ART.whiteRabbit.pal };

const cache = new Map();

function build(key, flip) {
  const art = ART[key];
  const h = art.rows.length, w = Math.max(...art.rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  art.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const col = art.pal[ch];
      if (!col) return;
      g.fillStyle = col;
      g.fillRect(flip ? w - 1 - x : x, y, 1, 1);
    });
  });
  return c;
}

export function sprite(key, flip = false) {
  const k = key + (flip ? '<' : '>');
  if (!cache.has(k)) cache.set(k, build(key, flip));
  return cache.get(k);
}

export function spriteSize(key) {
  const art = ART[key];
  return { w: Math.max(...art.rows.map((r) => r.length)), h: art.rows.length };
}

// px: 그림 한 픽셀의 화면 크기. (x, y)는 그림의 왼쪽 위.
export function drawSprite(ctx, key, x, y, px, flip = false) {
  const c = sprite(key, flip);
  ctx.drawImage(c, Math.round(x), Math.round(y), c.width * px, c.height * px);
}

export const hasSprite = (key) => key in ART;
