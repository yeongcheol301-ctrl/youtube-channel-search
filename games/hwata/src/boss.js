// 보스 「검은지느러미」: 해구에서 난파선을 지키는 거대 상어. 화면 없이 움직임만 계산한다.
// stepBoss 는 이번 순간에 일어난 일('windup' | 'charge' | 'crash' | 'bite' | 'sand')을 돌려준다.

export const BOSS = { hp: 30, w: 4, h: 1.6, speed: 3.2, chargeSpeed: 13 };

export function newBoss(arena) {
  return {
    x: (arena.x0 + arena.x1) / 2 - BOSS.w / 2, y: (arena.y0 + arena.y1) / 2,
    vx: 0, vy: 0, face: 1, hp: BOSS.hp, phase: 1,
    state: 'circle', t: 3, ang: 0, biteCool: 0, cycles: 0, dir: { x: 1, y: 0 }, bit: false, arena,
  };
}

const center = (b) => ({ x: b.x + BOSS.w / 2, y: b.y + BOSS.h / 2 });

function clampToArena(b) {
  const a = b.arena;
  const x = Math.min(Math.max(b.x, a.x0), a.x1 - BOSS.w);
  const y = Math.min(Math.max(b.y, a.y0), a.y1 - BOSS.h);
  const hit = x !== b.x || y !== b.y;
  b.x = x;
  b.y = y;
  return hit;
}

export function stepBoss(b, dt, player, isSolidAt) {
  const ev = [];
  if (b.state === 'tired' || b.state === 'tame') {
    b.vx = 0;
    b.vy = Math.sin((b.t += dt) * 2) * 0.2;
    return ev;
  }
  const c = center(b);
  const dx = player.x - c.x, dy = player.y - c.y;
  const dist = Math.hypot(dx, dy) || 1;
  b.biteCool = Math.max(0, b.biteCool - dt);
  b.t -= dt;
  const fast = b.phase === 2 ? 1.35 : 1;

  if (b.state === 'circle') {
    b.ang += dt * 0.9 * fast;
    const r = 6;
    const tx = player.x + Math.cos(b.ang) * r - BOSS.w / 2, ty = player.y + Math.sin(b.ang) * r * 0.6 - BOSS.h / 2;
    const ex = tx - b.x, ey = ty - b.y, el = Math.hypot(ex, ey) || 1;
    const sp = BOSS.speed * fast;
    b.vx += ((ex / el) * sp - b.vx) * Math.min(1, dt * 2.5);
    b.vy += ((ey / el) * sp - b.vy) * Math.min(1, dt * 2.5);
    if (dist < 2 && b.biteCool <= 0) { ev.push('bite'); b.biteCool = 2; }
    if (b.t <= 0) {
      b.cycles += 1;
      if (b.cycles % 3 === 0) { b.state = 'sand'; b.t = 1; ev.push('sand'); } else { b.state = 'windup'; b.t = 0.8 / fast; ev.push('windup'); }
    }
  } else if (b.state === 'windup') {
    b.vx *= 0.8;
    b.vy *= 0.8;
    b.dir = { x: dx / dist, y: dy / dist };
    if (b.t <= 0) { b.state = 'charge'; b.t = 1.2; b.bit = false; ev.push('charge'); }
  } else if (b.state === 'charge') {
    b.vx = b.dir.x * BOSS.chargeSpeed * fast;
    b.vy = b.dir.y * BOSS.chargeSpeed * fast;
    if (!b.bit && dist < 1.8) { ev.push('bite'); b.bit = true; }
    const nose = { x: c.x + b.dir.x * (BOSS.w / 2 + 0.3), y: c.y + b.dir.y * (BOSS.h / 2 + 0.2) };
    if (isSolidAt(Math.floor(nose.x), Math.floor(nose.y))) {
      b.state = 'stunned';
      b.t = 2.5;
      b.vx = b.vy = 0;
      ev.push('crash');
      return ev;
    }
    if (b.t <= 0) { b.state = 'circle'; b.t = 3.5; }
  } else if (b.state === 'sand') {
    b.vx *= 0.9;
    b.vy *= 0.9;
    if (b.t <= 0) { b.state = 'circle'; b.t = 3.5; }
  } else if (b.state === 'stunned') {
    b.vx = 0;
    b.vy = 0;
    if (b.t <= 0) { b.state = 'circle'; b.t = 3; }
  }
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (clampToArena(b) && b.state === 'charge') {
    b.state = 'stunned';
    b.t = 2.5;
    b.vx = b.vy = 0;
    ev.push('crash');
  }
  if (Math.abs(b.vx) > 0.3) b.face = b.vx > 0 ? 1 : -1;
  return ev;
}

export function hitBoss(b, dmg) {
  if (b.state === 'tired' || b.state === 'tame') return { hp: b.hp, tired: b.state === 'tired' };
  b.hp = Math.max(0, b.hp - dmg * (b.state === 'stunned' ? 2 : 1));
  if (b.hp <= BOSS.hp / 2) b.phase = 2;
  if (b.hp === 0) { b.state = 'tired'; b.t = 0; b.vx = b.vy = 0; }
  return { hp: b.hp, tired: b.state === 'tired' };
}

// 지친 보스의 지느러미에서 녹슨 작살을 뽑아 준다
export function calmBoss(b) {
  if (b.state !== 'tired') return false;
  b.state = 'tame';
  return true;
}
