// 무기·보스·광맥 그림. AI 그림이 들어오기 전까지 캔버스에 금속 질감으로 직접 그린다.
// 좌표는 100×100 기준으로 그리고 캔버스 크기에 맞춰 늘린다.

export const GRADE_COLORS = [
  ['#e6edf2', '#9aa7b0'],
  ['#a9d4ff', '#3d8ee8'],
  ['#e1c2ff', '#9a55e8'],
  ['#ffd2a3', '#e8782a'],
  ['#fff3b0', '#e8b820'],
];

const OUTLINE = '#0a0807';

function metal(c, x0, y0, x1, y1, grade) {
  const [hi, mid] = GRADE_COLORS[grade] ?? GRADE_COLORS[0];
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#2a2622');
  g.addColorStop(0.35, mid);
  g.addColorStop(0.5, hi);
  g.addColorStop(0.65, mid);
  g.addColorStop(1, '#1d1a17');
  return g;
}

function wood(c, x0, y0, x1, y1) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#3a2414');
  g.addColorStop(0.5, '#8a5a33');
  g.addColorStop(1, '#2a180c');
  return g;
}

function bronze(c, y0, y1) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#d9a86a'); g.addColorStop(0.5, '#8a5a2a'); g.addColorStop(1, '#3a2410');
  return g;
}

function gem(c, x, y, r, color) {
  const g = c.createRadialGradient(x - r / 3, y - r / 3, r / 6, x, y, r);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.35, color);
  g.addColorStop(1, '#2a0606');
  c.fillStyle = g;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.lineWidth = 1.2; c.strokeStyle = OUTLINE; c.stroke();
}

function shape(c, pts, fill) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill; c.fill();
  c.lineWidth = 1.6; c.strokeStyle = OUTLINE; c.lineJoin = 'round'; c.stroke();
}

function aura(c, grade) {
  if (grade < 1) return;
  const color = GRADE_COLORS[grade][1];
  const g = c.createRadialGradient(50, 50, 8, 50, 50, 50);
  g.addColorStop(0, color + '55');
  g.addColorStop(1, color + '00');
  c.fillStyle = g;
  c.fillRect(0, 0, 100, 100);
}

const DRAW = {
  sword(c, grade) {
    aura(c, grade);
    c.save(); c.translate(50, 50); c.rotate(-Math.PI / 4); c.translate(-50, -50);
    shape(c, [[50, 4], [56, 14], [56, 64], [44, 64], [44, 14]], metal(c, 44, 0, 56, 0, grade));
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(50, 10); c.lineTo(50, 62); c.stroke();
    shape(c, [[30, 64], [70, 64], [72, 70], [28, 70]], grade >= 2 ? metal(c, 0, 64, 0, 70, 4) : bronze(c, 64, 70));
    shape(c, [[46, 70], [54, 70], [54, 88], [46, 88]], wood(c, 46, 0, 54, 0));
    gem(c, 50, 92, 5, '#d8302a');
    c.restore();
  },
  axe(c, grade) {
    aura(c, grade);
    c.save(); c.translate(50, 50); c.rotate(-Math.PI / 6); c.translate(-50, -50);
    shape(c, [[47, 8], [53, 8], [54, 94], [46, 94]], wood(c, 46, 0, 54, 0));
    shape(c, [[53, 16], [74, 8], [86, 22], [88, 42], [76, 52], [53, 40]], metal(c, 53, 10, 88, 46, grade));
    shape(c, [[47, 18], [34, 14], [28, 26], [34, 36], [47, 34]], metal(c, 28, 14, 47, 36, grade));
    c.fillStyle = '#5a3a1e'; c.fillRect(45, 30, 10, 6);
    c.restore();
  },
  staff(c, grade) {
    aura(c, grade);
    c.save(); c.translate(50, 50); c.rotate(-Math.PI / 8); c.translate(-50, -50);
    shape(c, [[47, 28], [53, 28], [55, 96], [45, 96]], wood(c, 45, 0, 55, 0));
    shape(c, [[40, 30], [50, 34], [60, 30], [64, 16], [56, 6], [50, 14], [44, 6], [36, 16]], metal(c, 36, 0, 64, 0, Math.min(4, grade + 1)));
    const color = GRADE_COLORS[grade][1];
    const glow = c.createRadialGradient(50, 20, 1, 50, 20, 18);
    glow.addColorStop(0, '#ffffff'); glow.addColorStop(0.3, color); glow.addColorStop(1, color + '00');
    c.fillStyle = glow; c.beginPath(); c.arc(50, 20, 18, 0, Math.PI * 2); c.fill();
    gem(c, 50, 20, 6, color);
    c.restore();
  },
  bow(c, grade) {
    aura(c, grade);
    c.save(); c.translate(50, 50); c.rotate(-Math.PI / 6); c.translate(-50, -50);
    c.lineCap = 'round';
    c.strokeStyle = OUTLINE; c.lineWidth = 9;
    c.beginPath(); c.moveTo(40, 6); c.quadraticCurveTo(82, 50, 40, 94); c.stroke();
    c.strokeStyle = wood(c, 40, 0, 80, 0); c.lineWidth = 6;
    c.beginPath(); c.moveTo(40, 6); c.quadraticCurveTo(82, 50, 40, 94); c.stroke();
    c.strokeStyle = metal(c, 0, 40, 0, 60, grade); c.lineWidth = 7;
    c.beginPath(); c.moveTo(58, 42); c.lineTo(60, 58); c.stroke();
    c.strokeStyle = '#e8dcc0'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(40, 6); c.lineTo(40, 94); c.stroke();
    shape(c, [[24, 50], [70, 50], [70, 47], [78, 50], [70, 53], [70, 50]], metal(c, 0, 46, 0, 54, grade));
    c.restore();
  },
  building(c) {
    const g = c.createRadialGradient(50, 60, 4, 50, 60, 48);
    g.addColorStop(0, '#6fd6c455'); g.addColorStop(1, '#6fd6c400');
    c.fillStyle = g; c.fillRect(0, 0, 100, 100);
    shape(c, [[10, 92], [22, 70], [40, 64], [62, 66], [82, 72], [92, 92]], '#2a2520');
    const crystal = (pts) => { const cg = c.createLinearGradient(pts[0][0], 0, pts[2][0], 0); cg.addColorStop(0, '#0f4a42'); cg.addColorStop(0.5, '#9ff5e6'); cg.addColorStop(1, '#1e8a7a'); shape(c, pts, cg); };
    crystal([[34, 74], [40, 30], [50, 18], [56, 36], [52, 74]]);
    crystal([[52, 76], [60, 44], [70, 36], [72, 54], [66, 78]]);
    crystal([[22, 80], [26, 56], [34, 50], [36, 66], [34, 82]]);
  },
  boss(c) {
    const g = c.createRadialGradient(50, 50, 6, 50, 50, 50);
    g.addColorStop(0, '#9e1f1766'); g.addColorStop(1, '#9e1f1700');
    c.fillStyle = g; c.fillRect(0, 0, 100, 100);
    shape(c, [[22, 30], [10, 4], [34, 22]], '#d9c9a8');
    shape(c, [[78, 30], [90, 4], [66, 22]], '#d9c9a8');
    const skin = c.createLinearGradient(0, 18, 0, 92);
    skin.addColorStop(0, '#5e1a1a'); skin.addColorStop(1, '#1a0606');
    shape(c, [[20, 34], [36, 20], [64, 20], [80, 34], [82, 60], [68, 84], [50, 92], [32, 84], [18, 60]], skin);
    const eye = (x) => { const eg = c.createRadialGradient(x, 46, 0, x, 46, 10); eg.addColorStop(0, '#fff6c0'); eg.addColorStop(0.4, '#ffb21e'); eg.addColorStop(1, '#ffb21e00'); c.fillStyle = eg; c.beginPath(); c.arc(x, 46, 10, 0, Math.PI * 2); c.fill(); };
    shape(c, [[28, 42], [44, 44], [40, 52], [30, 50]], '#120404'); shape(c, [[72, 42], [56, 44], [60, 52], [70, 50]], '#120404');
    eye(36); eye(64);
    shape(c, [[34, 66], [66, 66], [60, 80], [40, 80]], '#120404');
    c.fillStyle = '#e8dcc0';
    for (let i = 0; i < 5; i++) shape(c, [[37 + i * 6, 66], [43 + i * 6, 66], [40 + i * 6, 74]], '#e8dcc0');
  },
};

export function drawSprite(canvas, name, grade = 0) {
  const draw = DRAW[name];
  if (!draw) return;
  const c = canvas.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.scale(canvas.width / 100, canvas.height / 100);
  draw(c, Math.max(0, Math.min(4, grade)));
}
