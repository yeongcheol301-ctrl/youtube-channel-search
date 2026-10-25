// 테라리아식 빛: 하늘이 보이는 칸은 밝고, 땅속으로 갈수록 어두워진다. 판 구멍으로 빛이 스며든다.
import { tile, isSolid, T } from './world.js';

const SOLID_FADE = 0.2;
const OPEN_FADE = 0.07;

export function computeLight(w, x0, y0, x1, y1, sources) {
  const cw = x1 - x0 + 1, chh = y1 - y0 + 1;
  const L = new Float32Array(cw * chh);
  const fade = new Float32Array(cw * chh);
  for (let x = x0; x <= x1; x++) {
    let sky = 1;
    for (let y = 0; y <= y1; y++) {
      const t = tile(w, x, y);
      const solid = isSolid(w, x, y);
      if (solid) sky = 0;
      else if (t === T.WATER) sky *= 0.93;
      if (y < y0) continue;
      const i = (y - y0) * cw + (x - x0);
      L[i] = sky;
      fade[i] = solid ? SOLID_FADE : OPEN_FADE;
    }
  }
  for (const s of sources) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = Math.round(s.x) + dx, y = Math.round(s.y) + dy;
        if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        const v = s.r - Math.hypot(dx, dy) * 0.12;
        const i = (y - y0) * cw + (x - x0);
        if (v > L[i]) L[i] = v;
      }
    }
  }
  const relax = (i, j) => {
    const v = L[j] - fade[i];
    if (v > L[i]) L[i] = v;
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < chh; y++) {
      for (let x = 1; x < cw; x++) relax(y * cw + x, y * cw + x - 1);
      for (let x = cw - 2; x >= 0; x--) relax(y * cw + x, y * cw + x + 1);
    }
    for (let x = 0; x < cw; x++) {
      for (let y = 1; y < chh; y++) relax(y * cw + x, (y - 1) * cw + x);
      for (let y = chh - 2; y >= 0; y--) relax(y * cw + x, (y + 1) * cw + x);
    }
  }
  return {
    at(x, y) {
      if (x < x0 || x > x1 || y < y0 || y > y1) return 0;
      return Math.max(0, L[(y - y0) * cw + (x - x0)]);
    },
  };
}
