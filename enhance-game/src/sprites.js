// 12×12 픽셀 그림. c 테두리, a 밝은 면, b 중간 면, h 손잡이, g 보석.
const SPRITES = {
  sword: [
    '..........cc', '.........cac', '........cabc', '.......cabc.', '......cabc..', '.c...cabc...',
    '.cc.cabc....', '..ccabc.....', '..chcc......', '.chcgc......', 'chc..cc.....', 'cc..........',
  ],
  axe: [
    '...ccc......', '..caaacc....', '.caaaabhc...', '.caaabbhc...', '..cabbhhc...', '...ccchhc...',
    '......chc...', '......chc...', '.....chc....', '.....chc....', '....chc.....', '....cc......',
  ],
  staff: [
    '......ccc...', '.....cgggc..', '.....cgagc..', '.....cgggc..', '......chc...', '......chc...',
    '.....chc....', '.....chc....', '....chc.....', '....chc.....', '...chc......', '...cc.......',
  ],
  bow: [
    '...cc.......', '..chhc..a...', '..ch..c.a...', '.ch....ca...', '.ch.....a...', '.ch.....a...',
    '.ch.....a...', '.ch....ca...', '..ch..c.a...', '..chhc..a...', '...cc.......', '............',
  ],
  building: [
    '....cc......', '...caac..cc.', '..cabbac.cac', '..cabbbaccbc', '.cabbbbbacbc', '.cabbbbbbcc.',
    'cabbbbbbbbc.', 'cbbbbbbbbbc.', 'cbbgbbbgbbc.', 'cbbbbbbbbbc.', 'ccccccccccc.', '............',
  ],
  boss: [
    '..c......c..', '.cbc....cbc.', '.cbbcccccbc.', 'cbbbbbbbbbbc', 'cbggbbbbggbc', 'cbggbbbbggbc',
    'cbbbbbbbbbbc', '.cbbaaaabbc.', '.cbacacacbc.', '..cbbbbbbc..', '...cccccc...', '............',
  ],
};

export const GRADE_COLORS = [
  ['#e6edf2', '#9aa7b0'],
  ['#a9d4ff', '#3d8ee8'],
  ['#e1c2ff', '#9a55e8'],
  ['#ffd2a3', '#e8782a'],
  ['#fff3b0', '#e8b820'],
];

export function paletteFor(name, grade = 0) {
  if (name === 'building') return { c: '#081014', a: '#c9fff6', b: '#2fb8a5', g: '#ffffff', h: '#2fb8a5' };
  if (name === 'boss') return { c: '#0a0507', a: '#f2e6d8', b: '#7a1f2b', g: '#ffcf3a', h: '#7a1f2b' };
  const [a, b] = GRADE_COLORS[grade] ?? GRADE_COLORS[0];
  return { c: '#0b0f14', a, b, h: '#8a5a33', g: '#ff5a6a' };
}

export function drawSprite(canvas, name, grade = 0) {
  const rows = SPRITES[name];
  if (!rows) return;
  const ctx = canvas.getContext('2d');
  const px = canvas.width / 12;
  const pal = paletteFor(name, grade);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(Math.floor(x * px), Math.floor(y * px), Math.ceil(px), Math.ceil(px));
    });
  });
}
