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
  haenyeo: { head: 'cap', beard: 'none', pal: { H: '#e9e1cc', R: '#f2efe6', D: '#cfc8b6', L: '#2f6b4f', S: '#d9a77e' } },
  diver: { head: 'cap', beard: 'none', pal: { H: '#f2efe6', R: '#f2efe6', D: '#cfc8b6', L: '#b8432f' } },
  boy: { head: 'hair', beard: 'none', pal: { H: '#1b1410', R: '#7aa0c4', D: '#5a7fa3', L: '#e8c766' } },
  mother: { head: 'hair', beard: 'none', pal: { H: '#2a2118', R: '#c98aa0', D: '#a86b80', L: '#f0d36a' } },
  fisher: { head: 'gat', beard: 'long', pal: { H: '#d6b25e', B: '#5a4632', R: '#6c8fb5', D: '#4f6f92', L: '#5a4632' } },
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
  // 단축 슬롯·재료 아이콘
  hand: {
    rows: ['..s.s...', '.sSsSs..', '.ssssss.', '.sssssss', '.ssssss.', '..ssss..', '..ssss..', '..bbbb..'],
    pal: { s: '#e9c29b', S: '#d4a982', b: '#3f5f86' },
  },
  hoe: {
    rows: ['....iii.', '...iIIi.', '....tIi.', '...t..i.', '..t.....', '.t......', 't.......', '........'],
    pal: { i: '#9aa3ad', I: '#d7dde2', t: '#8b5e34' },
  },
  bowIcon: {
    rows: ['.tt.....', 't..ts...', 't...s...', 't...sA..', 't...s...', 't..ts...', '.tt.....', '........'],
    pal: { t: '#8b5e34', s: '#e9e1cc', A: '#c9c1ad' },
  },
  ladderIcon: {
    rows: ['.t....t.', '.tTTTTt.', '.t....t.', '.tTTTTt.', '.t....t.', '.tTTTTt.', '.t....t.', '.t....t.'],
    pal: { t: '#8b5e34', T: '#b07a46' },
  },
  plankIcon: { rows: ['........', '........', 'TTTTTTTT', 'tttttttt', '.t....t.', '.t....t.', '........', '........'], pal: { t: '#7a522a', T: '#b07a46' } },
  dirt: {
    rows: ['gggggggg', 'dGddgdGd', 'dddDdddd', 'dDdddDdd', 'ddddddDd', 'dDdddddd', 'ddddDddd', 'dddddddd'],
    pal: { g: '#7dbb59', G: '#5f9a45', d: '#7a5534', D: '#5c3e24' },
  },
  wood: { rows: ['........', '.tttttt.', 'trrttttT', 'trRrtttT', 'trrttttT', '.tttttt.', '........', '........'], pal: { t: '#7a522a', T: '#5c3d1f', r: '#c9a26c', R: '#a77c4c' } },
  rabbitFur: { rows: ['..ff....', '.ffff.f.', 'ffLffff.', 'fffffLf.', '.ffffff.', '..ff.ff.'], pal: { f: '#a07a52', L: '#d9bf98' } },
  whiteFur: { rows: ['..ff....', '.ffff.f.', 'ffLffff.', 'fffffLf.', '.ffffff.', '..ff.ff.'], pal: { f: '#f3f1ea', L: '#d8d4ca' } },
  feather: { rows: ['......g.', '.....gr.', '....grr.', '...grr..', '..grr...', '.gbb....', '.b......', 'b.......'], pal: { g: '#2f6b4f', r: '#b8432f', b: '#8a5a2e' } },
  pheasantFat: { rows: ['..kk..', '.yyyy.', 'yYyyyy', 'yyyyYy', 'yyyyyy', '.yyyy.'], pal: { k: '#6b4a2b', y: '#efd892', Y: '#fff3c8' } },
  pot: {
    rows: ['..kkkkk..', '.kbbbbbk.', '..bBbbb..', '.bbbbbbb.', 'bbBbbbbbb', 'bbbbbbBbb', 'bbbbbbbbb', '.bbbBbbb.', '..bbbbb..'],
    pal: { k: '#4a2f1c', b: '#8a5530', B: '#a86b3e' },
  },
  page: { rows: ['.pppppp.', 'pPPPPPPp', 'pPkkkkPp', 'pPPPPPPp', 'pPkkkPPp', 'pPPPPPPp', 'pPkkkkPp', '.pppppp.'], pal: { p: '#b8432f', P: '#f1e8d4', k: '#5a4632' } },
  coin: { rows: ['..yyy..', '.yYYYy.', 'yYykyYy', 'yYkkkYy', 'yYykyYy', '.yYYYy.', '..yyy..'], pal: { y: '#b8861f', Y: '#e3b54a', k: '#2a2118' } },
  arrowIcon: { rows: ['......ii', '.....ti.', '....t...', '...t....', '..t.....', 'ff......', 'f.......', '........'], pal: { t: '#c9a26c', i: '#9aa3ad', f: '#e9e1cc' } },
  // 바닷속
  swim: {
    rows: ['...........kk...', '..........kSSS..', 'KK.RRRRRRRSSES..', '.KRRDRRRLRSSSN..', 'KK.RRRRRRRBBB...', '....RR....BB....', '....ss..........'],
    pal: { k: '#3b2f2a', S: '#e9c29b', E: '#1b1410', N: '#d9a882', R: '#3f5f86', D: '#2c4566', L: '#c99a3c', B: '#efeadf', K: '#3a2b1d', s: '#e9c29b' },
  },
  swim2: {
    rows: ['...........kk...', '..........kSSS..', '.K.RRRRRRRSSES..', 'KKRRDRRRLRSSSN..', '.K.RRRRRRRBBB...', '.....RR...BB....', '.....ss.........'],
    pal: { k: '#3b2f2a', S: '#e9c29b', E: '#1b1410', N: '#d9a882', R: '#3f5f86', D: '#2c4566', L: '#c99a3c', B: '#efeadf', K: '#3a2b1d', s: '#e9c29b' },
  },
  pollockFish: { rows: ['...bbbbbb.', 't.bbbbbbEb', 'ttbbbbbbbb', 't..wwwwww.'], pal: { b: '#7d8a8f', E: '#1b1410', t: '#5f6b70', w: '#c9d2d4' } },
  rockfishFish: {
    rows: ['....rr....', '..rrrrrrr.', 't.rRrrrrEr', 'ttrrrRrrrr', 't.rrrrrrr.', '...rr.rr..'],
    pal: { r: '#6b4a3a', R: '#3f2a20', E: '#f0d36a', t: '#4f3428' },
  },
  cuttlefishFish: {
    rows: ['.fffffffff.', 'tcccccccccE', 'ttcCcccCccc', 'tcccccccccc', '.fffffffff.'],
    pal: { f: '#e8c9a0', c: '#c99a6a', C: '#8a5c32', E: '#1b1410', t: '#d8a77e' },
  },
  seahorseFish: {
    rows: ['...kk......', '..oooo.....', '.ooEoooooo.', '..oooo.....', '...ooo.....', '..oOooL....', '.FoOoooL...', '.FooOooL...', '..ooOooL...', '...ooooL...', '...oooL....', '....oo.....', '....oo.....', '...oo..oo..', '...oo...o..', '....oooo...'],
    pal: { o: '#e8893a', O: '#b8602a', E: '#1b1410', L: '#f6c27a', F: '#f2d6a0', k: '#c86a2a' },
  },
  shark: {
    rows: ['..........gg............', '.........ggg............', 't.....gggggggggggggg....', 'tt..gggggggggggggggggE..', 'ttgggggggggggggggggggggg', 'tt..wwwwwwwwwwwwwwwwwkw.', 't.....wwwwwwwwwwwwwk....', '..........g.............'],
    pal: { g: '#6f7f8f', E: '#1b1410', t: '#56636f', w: '#d6dde3', k: '#1b1410' },
  },
  moray: { rows: ['..yyyyyyyyyyy.', 'yyyGyyyGyyyyEy', 'yyyyyyyyyyyyyy', '..yyyyyyyyyKK.'], pal: { y: '#9aa84a', G: '#5d6b2a', E: '#1b1410', K: '#f2efe6' } },
  jelly: {
    rows: ['.ppppp.', 'pPpppPp', 'ppppppp', 'p.p.p.p', 'p.p.p.p', '.p.p.p.', '.p...p.', 'p.....p'],
    pal: { p: 'rgba(214,170,240,0.85)', P: '#f6e6ff' },
  },
  seaweed: { rows: ['..g...', '.gg...', '.g..g.', 'gg..gg', '.g.gg.', '.ggg..', '..gg.g', '.gg.gg', 'gg.gg.', '.ggg..'], pal: { g: '#6b7a2e' } },
  kelp: { rows: ['..gg..', '.gGg..', '.ggg..', '..gGg.', '..ggg.', '.gGg..', '.ggg..', '..gg..', '..g...', '..g...'], pal: { g: '#4a6a32', G: '#355226' } },
  oyster: { rows: ['.gggg.', 'gGggGg', 'gggggg', 'gGgwgg', '.gggg.'], pal: { g: '#9a9a92', G: '#6f6f68', w: '#f2efe6' } },
  seaCucumber: { rows: ['..b.b.b..', '.bbbbbbbb', 'bbBbbBbbb', '.bbbbbbb.'], pal: { b: '#5a3d2e', B: '#3a2618' } },
  cuttlebone: { rows: ['.wwwwww.', 'wWwwwwWw', 'wwwwwwww', '.wwwwww.'], pal: { w: '#f2efe6', W: '#d8d2c2' } },
  pollock: { rows: ['..yyyyyy..', 'ttyYyyyyyE', 'ttyyyyYyyy', '..yyyyyy..'], pal: { y: '#d9b878', Y: '#b8955a', t: '#a8875a', E: '#3a2b1d' } },
  rockfish: { rows: ['....rr....', '..rrrrrrr.', 't.rRrrrrEr', 'ttrrrRrrrr', 't.rrrrrrr.', '...rr.rr..'], pal: { r: '#6b4a3a', R: '#3f2a20', E: '#f0d36a', t: '#4f3428' } },
  pearl: { rows: ['.ww.', 'wWww', 'wwww', '.ww.'], pal: { w: '#f4f0f8', W: '#ffffff' } },
  seahorse: { rows: ['.oo..', 'ooEo.', '..oo.', '.ooo.', '.oOo.', '..oo.', '..oo.', '...o.', '..oo.'], pal: { o: '#e8893a', O: '#b8602a', E: '#1b1410' } },
  sharkTooth: { rows: ['wwww', 'wWww', '.ww.', '.ww.', '..w.'], pal: { w: '#f2efe6', W: '#ffffff' } },
  clover: { rows: ['...o...', '...o...', 'ooooooo', '.ooOoo.', '..ooo..', '.oo.oo.', 'oo...oo'], pal: { o: '#e8743a', O: '#f6c25c' } },
  clam: { rows: ['.ppppp.', 'pPpPpPp', 'ppppppp', '.kkkkk.', '.ppppp.'], pal: { p: '#c9b8d8', P: '#e8dff0', k: '#4a3d5c' } },
  chest: { rows: ['.tttttt.', 'tTTTTTTt', 'tyyyyyyt', 'tTTyyTTt', 'tTTTTTTt', 'tTTTTTTt', 'tttttttt'], pal: { t: '#4a2f1c', T: '#8a5530', y: '#d4a94a' } },
  barrel: { rows: ['.tttttt.', 'tTTTTTTt', 'kkkkkkkk', 'tTTTTTTt', 'tTTTTTTt', 'kkkkkkkk', 'tTTTTTTt', '.tttttt.'], pal: { t: '#5a3d24', T: '#8a5530', k: '#3a3a3a' } },
  tewak: { rows: ['..kk..', '.oooo.', 'oOoooo', 'oooooo', '.oooo.', '..ww..'], pal: { o: '#e8743a', O: '#f6a25c', k: '#3a2b1d', w: '#e9e1cc' } },
  harpoon: {
    rows: ['......ii', '.....iII', '....tii.', '...t....', '..t.....', '.t......', 't.......', '........'],
    pal: { i: '#9aa3ad', I: '#d7dde2', t: '#8b5e34' },
  },
  netIcon: { rows: ['w.w.w.w.', '.w.w.w.w', 'w.w.w.w.', '.w.w.w.w', 'w.w.w.w.', '.w.w.w.w', 'tttttttt', '...tt...'], pal: { w: '#e9e1cc', t: '#8b5e34' } },
  shovel: { rows: ['......t.', '.....t..', '....t...', '...t....', '.ii.....', 'iIii....', 'iiii....', '.ii.....'], pal: { i: '#9aa3ad', I: '#d7dde2', t: '#8b5e34' } },
  bag: { rows: ['..kkkk..', '.k....k.', '.bbbbbb.', 'bbBbbbbb', 'bbbbbbBb', 'bbbbbbbb', 'bBbbbbbb', '.bbbbbb.'], pal: { k: '#6b4a2b', b: '#c9a26c', B: '#a77c4c' } },
};

for (const [key, p] of Object.entries(PEOPLE)) {
  const pal = { ...SKIN, ...p.pal };
  ART[key] = { rows: person(p.head, p.beard, 0), pal };
  ART[key + '2'] = { rows: person(p.head, p.beard, 1), pal };
}
ART.whiteRabbit = { rows: ART.rabbit.rows, pal: { f: '#f3f1ea', l: '#d8d4ca', e: '#c0453a' } };
ART.whiteRabbit2 = { rows: ART.rabbit2.rows, pal: ART.whiteRabbit.pal };
// 재료 아이콘은 바닥 그림을 그대로 쓴다.
ART.bellflower = ART.bellflowerRoot;
ART.kudzu = ART.kudzuRoot;

// ---------- 그려서 만드는 도트 그림(물고기·화타) ----------

function grid(w, h, fn) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) r += fn(x, y) || '.';
    rows.push(r);
  }
  return rows;
}

const hsh = (x, y) => {
  let n = (x * 73856093) ^ (y * 19349663);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

// 몸통 타원 + 등지느러미 + 꼬리. frame 으로 꼬리가 흔들린다. 머리는 오른쪽.
function fishRows({ w, h, frame = 0, spots = 0, stripes = [], dorsal = 0.3, teeth = false, gills = 1, scar = [] }) {
  const cx = w * 0.57, cy = h / 2, rx = w * 0.4, ry = h * 0.34;
  const ex = Math.floor(cx + rx * 0.62), ey = Math.floor(cy - ry * 0.35);
  const tailEnd = Math.floor(cx - rx) + 1;
  const fx = cx - rx * 0.12, fw = rx * 0.42, fh = h * dorsal;
  return grid(w, h, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    const nx = (px - cx) / rx, ny = (py - cy) / ry;
    if (nx * nx + ny * ny <= 1) {
      if (x === ex && y === ey) return 'E';
      if (w >= 20 && x === ex - 1 && y === ey) return 'W';
      if (teeth && y === Math.floor(cy + ry * 0.45) && px > cx + rx * 0.5) return x % 2 ? 'W' : 'M';
      for (let g = 0; g < gills; g++) if (x === Math.floor(cx + rx * (0.36 - g * 0.09)) && Math.abs(ny) < 0.5) return 'D';
      if (scar.some(([sx, sy]) => sx === x && sy === y)) return 'S';
      if (ny > 0.32) return 'L';
      if (stripes.some((sx) => Math.abs(x - sx) < 1) && ny < 0.25) return 'S';
      if (spots && hsh(x, y) < spots && ny < 0.25) return 'S';
      if (ny < -0.5) return 'D';
      return 'B';
    }
    const top = cy - ry * Math.sqrt(Math.max(0, 1 - nx * nx));
    const dfx = Math.abs(px - fx);
    if (dfx < fw && py < top && py >= top - fh * (1 - dfx / fw)) return 'F';
    if (x === Math.floor(cx + rx * 0.12) - frame && y === Math.floor(cy + ry * 1.15)) return 'F';
    if (x < tailEnd) {
      const t = (tailEnd - x) / tailEnd;
      const yc = cy + (frame ? 1 : -1) * t * h * 0.08;
      const half = 0.6 + t * h * 0.42;
      const d = Math.abs(py - yc);
      if (d <= half && !(t > 0.5 && d < (t - 0.5) * h * 0.55)) return 'T';
    }
    return '';
  });
}

function jellyRows(frame) {
  return grid(12, 15, (x, y) => {
    const nx = (x + 0.5 - 6) / 5.8, ny = (y + 0.5 - 5) / 5;
    if (y <= 4 && nx * nx + ny * ny <= 1) return y <= 1 && x < 5 ? 'H' : y === 4 ? 'R' : 'P';
    if (y >= 5) {
      for (const tx of [2, 4, 7, 9]) {
        const off = Math.round(Math.sin((y + frame * 2 + tx) * 0.9) * 0.8);
        if (x === tx + off) return tx === 4 || tx === 7 ? 'R' : 'P';
      }
    }
    return '';
  });
}

function morayRows(frame) {
  return grid(26, 7, (x, y) => {
    const head = x >= 19;
    const yc = head ? 3.5 : 3.5 + Math.sin(x * 0.55 + frame * 2) * 1.1;
    const half = head ? 2.4 - (x - 19) * 0.15 : 1.1 + x * 0.04;
    const d = y + 0.5 - yc;
    if (Math.abs(d) > half) return '';
    if (head && x === 22 && y === 2) return 'E';
    if (head && x >= 23 && y === 4) return x % 2 ? 'W' : 'M';
    if (hsh(x, y) < 0.22) return 'S';
    return d > 0.4 ? 'L' : 'B';
  });
}

function cuttleRows(frame) {
  return grid(18, 9, (x, y) => {
    const nx = (x + 0.5 - 8) / 7.4, ny = (y + 0.5 - 4.5) / 3.3;
    const r = nx * nx + ny * ny;
    if (r <= 1) {
      if (ny < -0.1 && (x + (y % 2)) % 3 === 0) return 'Z';
      return ny > 0.4 ? 'L' : 'C';
    }
    if (r <= 1.5 && x < 15 && (x + y + frame) % 2 === 0) return 'F';
    if (x >= 15 && x <= 16 && y >= 2 && y <= 6) return x === 15 && y === 3 ? 'E' : 'C';
    if (x === 17 && y >= 2 && y <= 6 && (y + frame) % 2 === 0) return 'T';
    return '';
  });
}

function painter(w, h) {
  const a = Array.from({ length: h }, () => Array(w).fill('.'));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) a[y][x] = c; };
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
  return { set, rect, rows: () => a.map((r) => r.join('')) };
}

// 헤엄치는 화타(머리가 오른쪽). frame 0~3: 발차기
function swimmerRows(frame) {
  const p = painter(24, 11);
  const k = [0, 1, 0, -1][frame];
  p.rect(1, 4 - k, 5, 5 - k, 'D');
  p.rect(0, 3 - k, 1, 5 - k, 'K');
  p.rect(1, 6 + k, 5, 7 + k, 'R');
  p.rect(0, 6 + k, 1, 8 + k, 'K');
  p.rect(5, 3, 15, 8, 'R');
  p.rect(5, 8, 15, 8, 'D');
  p.rect(8, 4, 8, 7, 'D');
  p.rect(12, 3, 13, 8, 'L');
  p.rect(13, 8 + (frame % 2), 16, 9 + (frame % 2), 'R');
  p.set(17, 9 + (frame % 2), 'S');
  p.rect(16, 3, 21, 7, 'S');
  p.rect(16, 2, 21, 2, 'k');
  p.rect(16, 3, 16, 5, 'k');
  p.rect(17, 0, 18, 1, 'k');
  p.set(20, 4, 'E');
  p.set(22, 5, 'S');
  p.set(22, 6, 'N');
  p.rect(18, 7, 21, 8, 'B');
  p.rect(15, 8, 19, 9, 'B');
  p.rect(14, 9, 16, 10, 'B');
  p.rect(16, 1, 21, 1, 'R');
  p.set(22, 1, 'S');
  p.set(23, 1, 'S');
  return p.rows();
}

const SWIM_PAL = { k: '#2b211c', S: '#ecc49b', E: '#1b1410', N: '#d39f78', R: '#3f6c9e', D: '#2c4f78', L: '#e2b34a', B: '#f4f0e6', K: '#3a2b1d' };
const FISH_PAL = {
  pollockFish: { B: '#8fa0a8', D: '#5f707a', L: '#dbe4e8', S: '#6f8089', E: '#111111', W: '#ffffff', F: '#7a8a93', T: '#6f8089' },
  rockfishFish: { B: '#7a4636', D: '#4f2c22', L: '#d5a27f', S: '#3f2219', F: '#5a3226', T: '#5a3226', E: '#f0d36a', W: '#ffffff' },
  shark: { B: '#7d8d9b', D: '#566572', L: '#eef2f4', S: '#566572', F: '#5f6e7b', T: '#5f6e7b', E: '#111111', W: '#ffffff', M: '#3a1f22' },
  boss: { B: '#2f3a4a', D: '#1b2230', L: '#c9d1d8', S: '#b8463c', F: '#0d1118', T: '#0d1118', E: '#ff5a46', W: '#ffffff', M: '#5a1f22' },
};

for (const f of [0, 1]) {
  const sfx = f ? '2' : '';
  ART['pollockFish' + sfx] = { rows: fishRows({ w: 18, h: 7, frame: f, dorsal: 0.25 }), pal: FISH_PAL.pollockFish };
  ART['rockfishFish' + sfx] = { rows: fishRows({ w: 18, h: 10, frame: f, spots: 0.18, dorsal: 0.45 }), pal: FISH_PAL.rockfishFish };
  ART['shark' + sfx] = { rows: fishRows({ w: 40, h: 14, frame: f, dorsal: 0.6, teeth: true, gills: 3 }), pal: FISH_PAL.shark };
  ART['boss' + sfx] = { rows: fishRows({ w: 56, h: 20, frame: f, dorsal: 0.7, teeth: true, gills: 3, stripes: [], scar: [[38, 8], [39, 9], [40, 9], [41, 10], [42, 10]] }), pal: FISH_PAL.boss };
  ART['jelly' + sfx] = { rows: jellyRows(f), pal: { P: 'rgba(214,170,240,0.85)', H: '#fbefff', R: 'rgba(180,120,220,0.9)' }, outline: false };
  ART['moray' + sfx] = { rows: morayRows(f), pal: { B: '#8e9a3e', S: '#4f5a1e', L: '#b9c26a', E: '#111111', W: '#ffffff', M: '#3a1f22' } };
  ART['cuttlefishFish' + sfx] = { rows: cuttleRows(f), pal: { C: '#d9a86e', Z: '#8a5c32', L: '#f0d9b5', F: '#f2e4c8', E: '#111111', T: '#c99a6a' } };
}
ART.seahorseFish2 = ART.seahorseFish;
for (let f = 0; f < 4; f++) ART['swim' + (f || '')] = { rows: swimmerRows(f), pal: SWIM_PAL };

// ---------- 캔버스로 굽기 ----------

const OUTLINE = 'rgba(16,12,24,0.9)';
const cache = new Map();
const outlined = (key) => ART[key].outline !== false;

function build(key, flip) {
  const art = ART[key];
  const h = art.rows.length, w = Math.max(...art.rows.map((r) => r.length));
  const pad = outlined(key) ? 1 : 0;
  const c = document.createElement('canvas');
  c.width = w + pad * 2;
  c.height = h + pad * 2;
  const g = c.getContext('2d');
  const filled = (x, y) => y >= 0 && y < h && x >= 0 && x < w && !!art.pal[art.rows[y][x]];
  for (let y = -pad; y < h + pad; y++) {
    for (let x = -pad; x < w + pad; x++) {
      const dx = (flip ? w - 1 - x : x) + pad, dy = y + pad;
      if (filled(x, y)) {
        g.fillStyle = art.pal[art.rows[y][x]];
        g.fillRect(dx, dy, 1, 1);
      } else if (pad && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) {
        g.fillStyle = OUTLINE;
        g.fillRect(dx, dy, 1, 1);
      }
    }
  }
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

// px: 그림 한 픽셀의 화면 크기. (x, y)는 그림(테두리 제외)의 왼쪽 위.
export function drawSprite(ctx, key, x, y, px, flip = false) {
  const c = sprite(key, flip);
  const pad = outlined(key) ? px : 0;
  ctx.drawImage(c, Math.round(x - pad), Math.round(y - pad), c.width * px, c.height * px);
}

export const hasSprite = (key) => key in ART;

const urls = new Map();

// <img> 로 쓸 아이콘 주소
export function iconURL(key) {
  if (!urls.has(key)) urls.set(key, sprite(key).toDataURL());
  return urls.get(key);
}
