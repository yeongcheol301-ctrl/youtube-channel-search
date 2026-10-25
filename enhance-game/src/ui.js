// 화면: 상태를 읽어 그리고, 버튼은 data-act로 처리한다.
import {
  WEAPONS, WEAPON_ORDER, GRADES, TRAITS, BOSS_TYPES, MAX_LEVEL, FIGHT_SECONDS,
  successRate, destroyChance, formatNumber, weaponAttack, weaponHitsPerSec, partyArmorBreak, bossFight, buildingStats, buildingDps,
} from './rules.js';
import {
  load, save, buy, enhance, sell, assign, combine, canCombine, pickTrait, upgradeBuilding,
  buildingUpgradeCost, tick, applyOffline, incomePerSec, ctxOf, fighters, miners, buyPrice,
  enhancePrice, sellValue, permLevel, tapMine, tapGain, combineAll,
} from './state.js';
import {
  challengeBoss, measureDps, rebirthCoins, rebirth, nextBoss, nextUnlock, unlock, buyPerm, PERMS,
  permCost, autoStep, bulkSell, shouldHintRebirth, AUTO_REBIRTHS, BULK_SELL_REBIRTHS, bossReward,
  nextStep, alerts, potentialDps, battleDps, recommendTrait,
} from './progress.js';
import { drawSprite, GRADE_COLORS } from './sprites.js';

const store = (() => {
  try { return window.localStorage; } catch { return { getItem: () => null, setItem() {} }; }
})();

let s = load(store);
const ui = { speed: 1, tab: 'forge', selected: null, modal: null, auto: false, autoTarget: 10, sellMax: 5, toast: null, fight: null, banner: null, flash: null };
const $ = (sel) => document.querySelector(sel);
const fmt = formatNumber;
const pct = (x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

const LEVEL_NAMES = {
  sword: ['녹슨 철검', '무딘 장검', '강철 장검', '기사의 검', '흑철 대검', '룬 블레이드', '심연을 가르는 자'],
  axe: ['나무꾼 손도끼', '쇠도끼', '전투 도끼', '광전사의 도끼', '흑요석 도끼', '천둥 도끼', '대지를 쪼개는 자'],
  staff: ['마른 나뭇가지', '견습 지팡이', '수정 지팡이', '현자의 지팡이', '별빛 홀', '룬의 왕홀', '차원을 여는 자'],
  bow: ['사냥꾼 단궁', '장궁', '강철 장궁', '명사수의 활', '바람의 활', '폭풍의 활', '하늘을 꿰뚫는 자'],
};
const BAND_STARTS = [0, 5, 10, 15, 20, 30, 40];
const bandOf = (level) => BAND_STARTS.filter((b) => level >= b).length - 1;
const levelName = (w) => LEVEL_NAMES[w.type][bandOf(w.level)];
const auraOf = (level) => (level >= 30 ? 'gold' : level >= 20 ? 'violet' : level >= 10 ? 'blue' : 'none');
const gradeColor = (g) => GRADE_COLORS[g][1];

// ---- 소리 ----
let audio = null;
function clang(kind) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    const freqs = kind === 'destroy' ? [180, 120] : kind === 'up' ? [1320, 1980] : [880, 660];
    freqs.forEach((f, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = kind === 'destroy' ? 'sawtooth' : 'square';
      o.frequency.setValueAtTime(f, t + i * 0.05);
      g.gain.setValueAtTime(0.0001, t + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.08, t + i * 0.05 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.25);
      o.connect(g).connect(audio.destination);
      o.start(t + i * 0.05); o.stop(t + i * 0.05 + 0.3);
    });
  } catch { /* 소리를 못 내도 게임은 계속 */ }
}

// ---- 불꽃 파편 ----
let parts = [];
function sparks(kind, color) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const fx = document.getElementById('fx');
  const art = document.querySelector('.anvil-art') ?? document.querySelector('.boss-art') ?? document.querySelector('.tap-vein');
  if (!fx || !art) return;
  const r = art.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const n = kind === 'destroy' ? 46 : kind === 'big' ? 70 : 28;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = (kind === 'destroy' ? 3 : 2) + Math.random() * 5;
    parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'destroy' ? 1 : 3), life: 1, size: kind === 'destroy' ? 3 + Math.random() * 4 : 1.5 + Math.random() * 2.5, color: Math.random() < 0.3 ? '#fff3d0' : color, shard: kind === 'destroy' });
  }
  if (!sparks.running) { sparks.running = true; requestAnimationFrame(stepFx); }
}
function stepFx() {
  const fx = document.getElementById('fx');
  const dpr = window.devicePixelRatio || 1;
  if (fx.width !== innerWidth * dpr) { fx.width = innerWidth * dpr; fx.height = innerHeight * dpr; }
  const c = fx.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.life > 0);
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.98; p.life -= p.shard ? 0.018 : 0.028;
    c.globalAlpha = Math.max(0, p.life);
    c.fillStyle = p.color;
    if (p.shard) { c.save(); c.translate(p.x, p.y); c.rotate(p.life * 8); c.fillRect(-p.size / 2, -p.size, p.size, p.size * 2); c.restore(); }
    else { c.shadowColor = p.color; c.shadowBlur = 8; c.fillRect(p.x, p.y, p.size, p.size); c.shadowBlur = 0; }
  }
  c.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(stepFx); else sparks.running = false;
}

function tapSound() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(520 + Math.random() * 160, t);
    g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.1);
  } catch { /* 소리를 못 내도 계속 */ }
}

function toast(text) {
  ui.toast = text;
  renderToast();
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { ui.toast = null; renderToast(); }, 2200);
}

function persist() {
  s.lastSeen = Date.now();
  save(s, store);
}

// ---- 공통 조각 ----
const sprite = (name, grade = 0, size = 48) => `<canvas class="spr" width="${size * 2}" height="${size * 2}" style="width:${size}px" data-sprite="${name}" data-grade="${grade}" aria-hidden="true"></canvas>`;
// AI 그림: 단계 구간(0~6)별 무기 그림과 보스 그림. 없는 구간은 가장 가까운 그림, 그것도 없으면 직접 그린 그림.
const ART = Object.fromEntries(['sword', 'axe', 'staff', 'bow'].map((t) => [t, Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((b) => [b, `assets/${t}-${b}.webp`]))]));
const BOSS_ART = Object.fromEntries(['armored', 'giant', 'barrier', 'multihit', 'regen'].map((b) => [b, `assets/boss-${b}.webp`]));
function weaponArtUrl(type, level) {
  const set = ART[type] ?? {};
  const bands = Object.keys(set).map(Number);
  if (!bands.length) return null;
  const b = bandOf(level);
  const best = bands.reduce((a, x) => (Math.abs(x - b) < Math.abs(a - b) ? x : a), bands[0]);
  return set[best];
}
const art = (type, grade, level, size) => {
  const url = weaponArtUrl(type, level);
  return url ? `<img class="art" src="${url}" width="${size}" height="${size}" alt="" style="--glow:${gradeColor(grade)}">` : sprite(type, grade, size);
};
const bossArt = (types, size) => {
  const url = types.map((x) => BOSS_ART[x]).find(Boolean);
  return url ? `<img class="art boss-img" src="${url}" width="${size}" height="${size}" alt="">` : sprite('boss', 0, size);
};
const btn = (act, label, { cls = '', disabled = false, data = {} } = {}) => `<button type="button" class="btn ${cls}" data-act="${act}" ${Object.entries(data).map(([k, v]) => `data-${k}="${v}"`).join(' ')} ${disabled ? 'disabled' : ''}>${label}</button>`;

function selectedWeapon() {
  let w = s.weapons.find((x) => x.id === ui.selected);
  if (!w && s.weapons.length) { w = s.weapons[0]; ui.selected = w.id; }
  return w ?? null;
}

// ---- 머리말 ----
let lastHud = '';
// 미네랄 숫자는 실제 값을 따라 부드럽게 올라간다.
const shown = { minerals: s.minerals };
function animateNumbers() {
  const diff = s.minerals - shown.minerals;
  shown.minerals = Math.abs(diff) < 1 ? s.minerals : shown.minerals + diff * 0.18;
  const el = document.getElementById('min-num');
  if (el) el.textContent = fmt(shown.minerals);
  requestAnimationFrame(animateNumbers);
}

function renderHeader() {
  const hint = shouldHintRebirth(s, Date.now());
  const step = nextStep(s);
  const html = `
    <div class="hud-main">
      <span class="mineral" id="min-num"></span><span class="unit">미네랄</span>
      <button type="button" class="speed s${ui.speed}" data-act="speed" aria-label="게임 속도 ${ui.speed}배, 눌러서 바꾸기">▶ ${ui.speed}배속</button>
    </div>
    <div class="hud-sub">
      <span>초당 <b>+${fmt(incomePerSec(s))}</b></span>
      <span>총 DPS <b>${fmt(battleDps(s))}</b></span>
      <span>보스 <b>${s.maxStage}</b>단계</span>
      <span>코인 <b>${fmt(s.meta.coins)}</b></span>
    </div>
    ${hint ? `<button type="button" class="hint" data-act="tab" data-tab="boss">10분째 DPS가 그대로예요. 환생하면 코인 ${fmt(rebirthCoins(s))}개 →</button>`
      : `<button type="button" class="guide g-${step.key}" data-act="${step.act ?? 'tab'}" data-tab="${step.tab}"><span>다음</span>${step.text}</button>`}`;
  if (html !== lastHud) { lastHud = html; $('#hud').innerHTML = html; }
}

// ---- 강화장 ----
function weaponTile(w) {
  const on = w.id === ui.selected;
  return `<button type="button" class="tile aura-${auraOf(w.level)} ${on ? 'on' : ''}" data-act="select" data-id="${w.id}" style="--grade:${gradeColor(w.grade)}" aria-label="${GRADES[w.grade]} ${WEAPONS[w.type].name} +${w.level}">
    ${art(w.type, w.grade, w.level, 40)}
    <span class="tile-lv">+${w.level}</span>
    ${w.pendingTraits ? '<span class="tile-dot" title="특성 선택 대기"></span>' : ''}
  </button>`;
}

function renderForge() {
  const w = selectedWeapon();
  const bonus = permLevel(s, 'success');
  let main = `<section class="anvil empty"><p>무기가 없습니다. 아래에서 검을 사세요.</p></section>`;
  if (w) {
    const rate = w.pity >= 100 ? 1 : successRate(w.level, w.type, bonus);
    const cost = enhancePrice(s, w);
    const pairs = combineAll(structuredClone(s)).count;
    const breakP = w.level >= 5 ? destroyChance(w.level, w.type) : 0;
    const failText = w.level < 5 ? '실패해도 유지' : breakP > 0 ? `실패 시 ${pct(breakP)} 파괴` : '실패 시 한 단계 하락';
    main = `
    <section class="anvil aura-${auraOf(w.level)} ${ui.flash ?? ''}" style="--grade:${gradeColor(w.grade)}">
      <div class="anvil-art">${art(w.type, w.grade, w.level, 132)}</div>
      <div class="anvil-info">
        <p class="grade-tag">${GRADES[w.grade]} · ${WEAPONS[w.type].name}</p>
        <h2><span class="lv">+${w.level}</span> ${levelName(w)}</h2>
        <dl class="stats">
          <div><dt>공격력</dt><dd>${fmt(weaponAttack(w, ctxOf(s)))}</dd></div>
          <div><dt>성공률</dt><dd>${pct(rate)}</dd></div>
          <div><dt>판매가</dt><dd>${fmt(sellValue(w))}</dd></div>
        </dl>
        <p class="fail-note">${failText}${w.type === 'axe' ? ' · 도끼는 깨지지 않음' : ''}${w.type === 'staff' ? ' · 성공 시 15%로 2단계' : ''}</p>
        <div class="pity" aria-label="천장 ${w.pity}%"><span style="width:${w.pity}%"></span><em>천장 ${w.pity}%</em></div>
        ${w.traits.length ? `<p class="traits">${w.traits.map((t) => `<span>${TRAITS[t].label}</span>`).join('')}</p>` : ''}
      </div>
    </section>
    ${w.pendingTraits ? btn('open-trait', '특성 고르기 (+' + w.level + '강 보상)', { cls: 'big gold' }) : `
    <button type="button" class="enhance-btn" data-act="enhance" ${s.minerals < cost || w.level >= MAX_LEVEL ? 'disabled' : ''}>
      <span class="eb-title">${w.level >= MAX_LEVEL ? '최고 단계' : '강화'}</span>
      <span class="eb-meta">${fmt(cost)} 미네랄 · 성공 ${pct(rate)}</span>
    </button>`}
    <div class="row">
      ${btn('combine-all', pairs ? `자동 조합 (${pairs}회)` : '조합 불가', { disabled: !pairs })}
      ${btn('sell', `판매 +${fmt(sellValue(w))}`)}
    </div>`;
  }
  const shop = WEAPON_ORDER.map((t) => {
    const open = s.meta.unlocked.includes(t);
    const price = buyPrice(s, t);
    return `<button type="button" class="buy" data-act="buy" data-type="${t}" ${!open || s.minerals < price ? 'disabled' : ''}>
      ${art(t, 0, 0, 32)}<span>${WEAPONS[t].name}</span><small>${open ? fmt(price) : '잠김'}</small></button>`;
  }).join('');
  const autoBox = s.meta.rebirths >= AUTO_REBIRTHS ? `
    <div class="auto">
      <label class="switch"><input id="auto-on" type="checkbox" data-act="auto" ${ui.auto ? 'checked' : ''}> 자동 강화</label>
      <label>목표 <select id="auto-target" data-act="auto-target">${[5, 10, 15, 20, 25, 30].map((n) => `<option value="${n}" ${n === ui.autoTarget ? 'selected' : ''}>+${n}</option>`).join('')}</select></label>
      ${s.meta.rebirths >= BULK_SELL_REBIRTHS ? `<label>일괄 판매 <select id="sell-max" data-act="sell-max">${[3, 5, 8, 10].map((n) => `<option value="${n}" ${n === ui.sellMax ? 'selected' : ''}>+${n} 이하</option>`).join('')}</select></label>${btn('bulk-sell', '팔기')}` : '<small>일괄 판매는 환생 5회차부터</small>'}
      <small>목표 단계까지 가장 싼 무기부터 자동 강화하고, 다 차면 새 무기를 삽니다. +10 미만은 깨지지 않습니다.</small>
    </div>` : '';
  return `${main}
    <h3 class="sec">무기 구매</h3><div class="shop">${shop}</div>
    <h3 class="sec">보유 무기 <small>${s.weapons.length}자루 · 평소엔 모두 채집, 보스전엔 전원 출동</small></h3>
    <div class="tiles">${s.weapons.map(weaponTile).join('') || '<p class="note">아직 무기가 없습니다.</p>'}</div>
    ${autoBox}`;
}

// ---- 채집장 ----
// 무기 전부가 가운데 목표를 빙 둘러싸고 각자 공속대로 휘두른다. 겹쳐도 그대로 그린다(성능 때문에 80자루까지).
const ARENA_MAX = 80;
function strikersHtml(list, fast = 1) {
  const shown = list.slice(0, ARENA_MAX);
  const n = shown.length;
  return shown.map((w, i) => {
    const dur = Math.min(1.6, Math.max(0.4, 1 / weaponHitsPerSec(w))) / fast;
    const ring = n > 10 ? (i % 3 === 0 ? 'r-in' : i % 3 === 1 ? 'r-mid' : '') : '';
    const angle = (360 / n) * i + (i % 2 ? 7 : 0);
    return `<span class="striker ${ring}" style="--a:${angle.toFixed(1)}deg"><span class="arm" style="--dur:${dur.toFixed(2)}s;--delay:${((i * 0.29) % dur).toFixed(2)}s"><span class="blade">${art(w.type, w.grade, w.level, 48)}</span></span></span>`;
  }).join('');
}

function renderArena() {
  const list = miners(s).sort((a, b) => b.level - a.level);
  const n = list.length;
  return `<section class="arena ${n ? 'busy' : ''}">
    <div class="arena-ring">
      ${strikersHtml(list)}
      <button type="button" class="tap-vein" data-act="tap" aria-label="광맥 캐기"><img class="art" src="assets/building.webp" width="120" height="120" alt=""><span class="tap-hint">눌러서 캐기 +${fmt(tapGain(s))}</span></button>
    </div>
    ${n > ARENA_MAX ? `<p class="note">그 밖에 ${n - ARENA_MAX}자루가 더 캐고 있습니다</p>` : ''}
    ${n ? '' : '<p class="note">채집 무기가 없습니다. 강화장에서 무기를 채집으로 보내면 광맥을 둘러싸고 캡니다.</p>'}
  </section>`;
}

function renderMine() {
  const b = s.building;
  const st = buildingStats(b.tier);
  const cost = buildingUpgradeCost(s);
  const next = buildingStats(b.tier + 1);
  return `
    ${renderArena()}
    <section class="mine">
      <div>
        <p class="grade-tag">미네랄 광맥 ${b.tier + 1}단계</p>
        <div class="hp"><span id="mine-hp"></span></div>
        <dl class="stats">
          <div><dt>체력</dt><dd>${fmt(st.hp)}</dd></div>
          <div><dt>DPS 1당</dt><dd>${st.eff.toFixed(1)}/초</dd></div>
          <div><dt>초당 수입</dt><dd>${fmt(incomePerSec(s))}</dd></div>
        </dl>
        <p class="note">채집 무기 ${miners(s).length}자루가 광맥을 부수고 있습니다. 도끼는 두 배로 부숩니다. 앱을 꺼도 최대 8시간치가 쌓입니다.</p>
      </div>
    </section>
    <section class="dps-card">
      <h3 class="sec">DPS 안내</h3>
      <dl class="stats">
        <div><dt>총 DPS</dt><dd>${fmt(battleDps(s))}</dd></div>
        <div><dt>초당 미네랄</dt><dd>${fmt(incomePerSec(s))}</dd></div>
        <div><dt>보스 필요 DPS</dt><dd>${fmt(nextBoss(s).hp / FIGHT_SECONDS)}</dd></div>
      </dl>
      <p class="note">초당 미네랄 = 총 DPS × 광맥 효율(DPS 1당 ${buildingStats(b.tier).eff.toFixed(1)}). 무기가 세질수록 정직하게 더 법니다. ${nextBoss(s).stage}단계 보스는 체력 ${fmt(nextBoss(s).hp)}이라 30초 안에 잡으려면 DPS ${fmt(nextBoss(s).hp / FIGHT_SECONDS)}이 필요합니다(유형별 조건 별도).</p>
    </section>
    <button type="button" class="enhance-btn mint" data-act="upgrade" ${s.minerals < cost ? 'disabled' : ''}>
      <span class="eb-title">광맥 업그레이드</span>
      <span class="eb-meta">${fmt(cost)} 미네랄 · 효율 ${buildingStats(b.tier).eff.toFixed(1)} → ${next.eff.toFixed(1)}</span>
    </button>
    <p class="note">업그레이드하면 같은 DPS로 더 많은 미네랄을 캡니다.</p>
    <h3 class="sec">채집 중인 무기</h3>
    <div class="tiles">${miners(s).map(weaponTile).join('') || '<p class="note">강화장에서 무기를 골라 [채집으로 보내기]를 누르세요.</p>'}</div>`;
}

// ---- 보스 ----
function readiness(boss) {
  const party = fighters(s);
  const ctx = ctxOf(s);
  const r = bossFight(party, boss, ctx);
  const ab = partyArmorBreak(party);
  const rows = [
    ['예상 피해 (30초)', `${fmt(r.damage)} / ${fmt(boss.hp)}`, r.damage >= boss.hp],
  ];
  if (boss.armor >= 1) rows.push(['방깎 합계', `${fmt(ab)} / 방어 ${fmt(boss.armor)}`, ab >= boss.armor || party.every((w) => w.type === 'staff')]);
  if (boss.hitsNeeded) rows.push(['타격 수', `${fmt(r.hits)} / ${fmt(boss.hitsNeeded)}`, r.hits >= boss.hitsNeeded]);
  if (boss.barrier) rows.push(['마법 무기', `${party.filter((w) => w.type === 'staff').length}자루`, party.some((w) => w.type === 'staff')]);
  if (boss.regenPct) rows.push(['초당 회복', fmt(boss.hp * boss.regenPct), r.killed]);
  return { rows, killed: r.killed, party };
}

function renderBoss() {
  const boss = nextBoss(s);
  const { rows, killed, party } = readiness(boss);
  const coins = rebirthCoins(s);
  const fight = ui.fight;
  return `
    ${fight ? `<section class="arena busy fight"><div class="arena-ring">${strikersHtml(fighters(s).sort((a, b) => b.level - a.level), 2)}<div class="boss-center">${bossArt(boss.types, 140)}</div></div></section>` : ''}
    <section class="boss">
      <div class="boss-art ${fight ? 'hit' : ''}">${bossArt(boss.types, 120)}</div>
      <div>
        <p class="grade-tag">${boss.stage}단계 보스</p>
        <h2>${boss.types.map((t) => BOSS_TYPES[t].name).join(' + ')}</h2>
        <ul class="hints">${boss.types.map((t) => `<li>${BOSS_TYPES[t].hint}</li>`).join('')}</ul>
        <p class="note">처치 보상 ${fmt(bossReward(boss.stage))} 미네랄</p>
      </div>
    </section>
    ${fight ? `<div class="fightbar"><span style="width:${fight.hpPct}%"></span><em>${fight.text}</em></div>` : ''}
    <h3 class="sec">준비 상태판 <small>출전 ${party.length}자루 (전원)</small></h3>
    <table class="ready"><tbody>
      ${rows.map(([k, v, ok]) => `<tr><th>${k}</th><td>${v}</td><td><span class="pill ${ok ? 'ok' : 'no'}">${ok ? '충분' : '부족'}</span></td></tr>`).join('')}
    </tbody></table>
    <button type="button" class="enhance-btn" data-act="challenge" ${!party.length || fight ? 'disabled' : ''}>
      <span class="eb-title">보스 도전</span>
      <span class="eb-meta">${killed ? '지금이면 잡을 수 있습니다' : '아직 부족합니다 · 그래도 도전 가능'}</span>
    </button>
    <div class="row">
      ${btn('dps', 'DPS 측정 (샌드백 30초)', { disabled: !party.length })}
    </div>
    <section class="rebirth">
      <h3 class="sec">환생</h3>
      <p>무기와 미네랄을 초기화하고 <b>환생 코인 ${fmt(coins)}개</b>를 받습니다. 코인으로 새 무기와 영구 능력을 삽니다. 지금 ${s.meta.rebirths + 1}회차입니다.</p>
      ${btn('open-rebirth', '환생하기', { cls: 'big', disabled: coins <= 0 })}
      ${coins <= 0 ? '<p class="note">보스를 한 마리 이상 잡아야 환생 코인이 나옵니다.</p>' : ''}
    </section>`;
}

// ---- 도감 ----
function renderBook() {
  const logo = '<img class="logo" src="assets/logo.webp" alt="심연의 대장간" width="900" height="503">';
  const found = new Set(s.meta.discovered);
  const cards = WEAPON_ORDER.map((t) => {
    const open = s.meta.unlocked.includes(t);
    const names = LEVEL_NAMES[t].map((n, i) => {
      const lv = BAND_STARTS[i];
      const seen = [...found].some((k) => { const [tt, , l] = k.split(':'); return tt === t && Number(l) >= lv; });
      return `<li class="${seen ? 'seen' : ''}"><span>+${lv}</span>${seen ? n : '???'}</li>`;
    }).join('');
    const grades = GRADES.map((g, i) => `<span class="gchip ${[...found].some((k) => k.startsWith(`${t}:${i}:`)) ? 'seen' : ''}" style="--grade:${gradeColor(i)}">${g}</span>`).join('');
    return `<article class="book-card ${open ? '' : 'locked'}">
      <header>${sprite(t, 0, 40)}<div><h4>${WEAPONS[t].name}</h4><small>${open ? '해금됨' : `잠김 · 환생 코인 ${WEAPONS[t].unlockCost}`}</small></div></header>
      <div class="gchips">${grades}</div>
      <ol class="names">${names}</ol>
    </article>`;
  }).join('');
  return `${logo}<h3 class="sec">무기 도감 <small>처음 띄운 단계 이름이 기록됩니다</small></h3>
    <div class="book">${cards}</div>
    <h3 class="sec">조합표</h3>
    <table class="ready"><tbody>
      <tr><th>재료</th><td>같은 등급 +10강 이상 두 자루</td></tr>
      <tr><th>결과</th><td>한 등급 위 무기 +0 (첫 번째 무기 종류)</td></tr>
      <tr><th>등급</th><td>${GRADES.join(' → ')}</td></tr>
      <tr><th>이름 예시</th><td>검 + 검 = 쌍검 · 검 + 도끼 = 처형인의 대검 · 도끼 + 지팡이 = 부식의 도끼</td></tr>
    </tbody></table>`;
}

// ---- 상점 ----
const CASH = [
  { name: '대장장이 월정액', price: '9,900원', tag: 'BEST', line: '30일 · 꺼 둔 동안 24시간·2배 채집', art: 'assets/building.webp' },
  { name: '파괴 방지권 3장', price: '1,100원', tag: '첫 구매 2배', line: '+10강 이상 실패해도 무기가 깨지지 않음', art: 'assets/sword-4.webp' },
  { name: '배속권 3배', price: '3,300원', tag: '', line: '24시간 동안 모든 진행 3배', art: 'assets/bow-5.webp' },
  { name: '광고 제거', price: '5,500원', tag: '영구', line: '광고 없이 보상 2배 바로 받기', art: 'assets/staff-4.webp' },
  { name: '심연의 연출 스킨', price: '4,400원', tag: '한정', line: '강화 성공 시 보라 불꽃과 전용 효과음', art: 'assets/sword-6.webp' },
];

function renderShop() {
  const u = nextUnlock(s);
  const perms = Object.entries(PERMS).map(([k, p]) => {
    const lv = permLevel(s, k);
    const max = lv >= p.max;
    return `<tr><th>${p.name}</th><td>${lv}/${p.max}</td><td>${btn('perm', max ? '최대' : `${fmt(permCost(lv))} 코인`, { disabled: max || s.meta.coins < permCost(lv), data: { key: k } })}</td></tr>`;
  }).join('');
  return `
    <h3 class="sec">환생 코인 상점 <small>보유 ${fmt(s.meta.coins)}</small></h3>
    ${u ? `<div class="unlock">${sprite(u, 0, 40)}<div><b>${WEAPONS[u].name} 해금</b><small>${{ axe: '실패해도 안 깨짐 · 건물 2배', staff: '마법 · 가끔 2단계 점프', bow: '여러 자루일수록 강함 · 공속' }[u]}</small></div>${btn('unlock', `${WEAPONS[u].unlockCost} 코인`, { disabled: s.meta.coins < WEAPONS[u].unlockCost, data: { type: u } })}</div>` : '<p class="note">시제품의 무기 4종을 모두 해금했습니다.</p>'}
    <table class="ready"><tbody>${perms}</tbody></table>
    <h3 class="sec">무료 보상</h3>
    ${btn('ad-minerals', `광고 보고 미네랄 받기 (+${fmt(Math.max(200, incomePerSec(s) * 300))})`, { cls: 'big mint' })}
    <h3 class="sec">유료 상품 <small>시제품이라 결제는 되지 않습니다</small></h3>
    <div class="packs">${CASH.map((c) => `<button type="button" class="pack" data-act="cash" data-name="${c.name}">
      ${c.tag ? `<em class="pack-tag">${c.tag}</em>` : ''}
      <img src="${c.art}" alt="" width="72" height="72">
      <strong>${c.name}</strong><small>${c.line}</small><span class="pack-price">${c.price}</span></button>`).join('')}</div>
    ${btn('open-odds', '강화 확률표 보기')}`;
}

// ---- 팝업 ----
function renderModal() {
  const m = ui.modal;
  const el = $('#modal');
  el.hidden = !m;
  if (!m) { el.innerHTML = ''; return; }
  let body = '';
  if (m.kind === 'trait') {
    const w = s.weapons.find((x) => x.id === m.id);
    if (!w?.pendingTraits) { ui.modal = null; return renderModal(); }
    const left = s.weapons.filter((x) => x.pendingTraits).length;
    const rec = recommendTrait(w.type, w.pendingTraits);
    body = `<div class="trait-head">${art(w.type, w.grade, w.level, 72)}<div><h3>+${w.level}강 특성 고르기</h3><p>${GRADES[w.grade]} ${WEAPONS[w.type].name} · 「${levelName(w)}」${left > 1 ? ` · 대기 ${left}개` : ''}</p></div></div>
      <div class="choices">${w.pendingTraits.map((t) => btn('trait', `${TRAITS[t].label}${t === rec ? ' · 추천' : ''}`, { cls: `big ${t === rec ? 'gold' : ''}`, data: { key: t } })).join('')}</div>
      <p class="note">자동 강화 중에는 추천 특성을 알아서 고릅니다.</p>`;
  } else if (m.kind === 'rebirth') {
    const c = rebirthCoins(s);
    body = `<h3>환생할까요?</h3><p>무기 ${s.weapons.length}자루와 미네랄이 사라지고, 환생 코인을 받습니다. 해금·영구 능력·도감은 남습니다.</p>
      <div class="choices">${btn('rebirth-ad', `광고 보고 2배 (${fmt(c * 2)} 코인)`, { cls: 'big gold' })}${btn('rebirth', `그냥 받기 (${fmt(c)} 코인)`, { cls: 'big' })}${btn('close', '취소')}</div>`;
  } else if (m.kind === 'offline') {
    body = `<h3>자는 동안 캤습니다</h3><p class="big-num">+${fmt(m.gain)} 미네랄</p>
      <div class="choices">${btn('offline-ad', `광고 보고 2배 받기`, { cls: 'big gold' })}${btn('close', '받기', { cls: 'big' })}</div>`;
  } else if (m.kind === 'odds') {
    const t = m.type ?? 'sword';
    const lvls = [0, 4, 5, 9, 10, 15, 19, 20, 25, 29, 30, 40, 49];
    body = `<h3>강화 확률표</h3><div class="seg">${WEAPON_ORDER.map((x) => btn('odds-type', WEAPONS[x].name, { cls: x === t ? 'on' : '', data: { type: x } })).join('')}</div>
      <div class="scroll"><table class="ready odds"><thead><tr><th>단계</th><th>성공</th><th>실패 시</th></tr></thead><tbody>
      ${lvls.map((l) => `<tr><th>+${l} → +${l + 1}</th><td>${pct(successRate(l, t))}</td><td>${l < 5 ? '유지' : destroyChance(l, t) > 0 ? `파괴 ${pct(destroyChance(l, t))}, 아니면 -1` : '-1'}</td></tr>`).join('')}
      </tbody></table></div><p class="note">실패할 때마다 천장 +10%, 100%가 되면 다음 강화는 확정 성공. 영구 능력 '강화 성공률'은 위 확률에 더해집니다.</p>
      ${btn('close', '닫기', { cls: 'big' })}`;
  }
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${body}</div>`;
  drawSprites(el);
}

function renderToast() {
  const el = $('#toast');
  el.hidden = !ui.toast;
  el.textContent = ui.toast ?? '';
}

function renderBanner() {
  const el = $('#banner');
  el.hidden = !ui.banner;
  el.innerHTML = ui.banner ?? '';
}

function drawSprites(root = document) {
  root.querySelectorAll('canvas[data-sprite]').forEach((c) => drawSprite(c, c.dataset.sprite, Number(c.dataset.grade)));
}

const VIEWS = { forge: renderForge, mine: renderMine, boss: renderBoss, book: renderBook, shop: renderShop };

let lastView = '';
function updateLive() {
  const hp = document.getElementById('mine-hp');
  if (hp) hp.style.width = `${Math.max(2, (s.building.hpLeft / s.building.hp) * 100)}%`;
}

// 같은 화면이면 DOM을 바꾸지 않는다(누르는 중인 버튼이 사라지지 않게).
function render() {
  renderHeader();
  const html = VIEWS[ui.tab]();
  if (html === lastView) {
    updateLive(); renderModal(); renderBanner();
    const al = alerts(s);
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('dot', !!al[b.dataset.tab] && b.dataset.tab !== ui.tab));
    return;
  }
  lastView = html;
  const view = $('#view');
  view.innerHTML = html;
  if (render.tab !== ui.tab) { view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); render.tab = ui.tab; }
  updateLive();
  const al = alerts(s);
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.setAttribute('aria-current', b.dataset.tab === ui.tab ? 'page' : 'false');
    b.classList.toggle('dot', !!al[b.dataset.tab] && b.dataset.tab !== ui.tab);
  });
  drawSprites($('#view'));
  renderModal();
  renderBanner();
}

// ---- 떠오르는 숫자·진동 ----
function floatText(text, cls, anchor) {
  const el = document.createElement('div');
  el.className = `float ${cls}`;
  el.textContent = text;
  const box = (anchor ?? document.querySelector('.anvil-art') ?? document.getElementById('min-num'))?.getBoundingClientRect();
  if (!box) return;
  el.style.left = `${box.left + box.width / 2}px`;
  el.style.top = `${box.top + box.height / 3}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
const gainText = (n) => floatText(`+${fmt(n)}`, 'gain', document.getElementById('min-num'));
function buzz(ms) { try { navigator.vibrate?.(ms); } catch { /* 진동이 없는 기기 */ } }

function showEvolution(w) {
  const url = weaponArtUrl(w.type, w.level);
  ui.banner = `<div class="banner-inner evolve" style="--grade:${gradeColor(w.grade)}">
    <small>진화 · ${GRADES[w.grade]} ${WEAPONS[w.type].name}</small>
    ${url ? `<img src="${url}" alt="" width="180" height="180">` : ''}
    <strong>+${w.level}</strong><span>「${levelName(w)}」</span></div>`;
  clearTimeout(showEvolution.t);
  showEvolution.t = setTimeout(() => { ui.banner = null; renderBanner(); }, 2400);
}

// ---- 행동 ----
function doEnhance() {
  const w = selectedWeapon();
  if (!w) return;
  const before = w.level;
  const r = enhance(s, w.id, Math.random);
  if (!r.ok) return toast(r.reason);
  clang(r.result === 'destroy' ? 'destroy' : r.result.startsWith('up') ? 'up' : 'fail');
  if (r.result === 'destroy') {
    document.body.classList.remove('shake', 'crack'); void document.body.offsetWidth; document.body.classList.add('shake', 'crack');
    sparks('destroy', '#e4675a');
    floatText('파괴', 'bad'); buzz([60, 40, 120]);
    toast(`파괴! +${w.level} ${levelName(w)}이(가) 산산조각 났습니다`);
    ui.selected = null;
  } else if (r.result.startsWith('up')) {
    ui.flash = w.level >= 10 ? 'flash pillar' : 'flash';
    sparks(w.level >= 20 ? 'big' : 'up', gradeColor(w.grade) === GRADE_COLORS[0][1] ? '#f1b45a' : gradeColor(w.grade));
    floatText(r.result === 'up2' ? '+2 점프!' : '성공', 'good'); buzz(25);
    if (bandOf(w.level) > bandOf(before) || w.level === MAX_LEVEL) { showEvolution(w); buzz([30, 30, 60]); }
    if (w.pendingTraits) ui.modal = { kind: 'trait', id: w.id };
  } else {
    ui.flash = 'dim';
    floatText(r.result === 'down' ? `-1 (+${w.level})` : '실패', 'miss');
  }
  render();
  setTimeout(() => { ui.flash = null; }, 300);
}

function startFight() {
  const boss = nextBoss(s);
  const r = challengeBoss(s);
  if (!r.ok) return toast(r.reason);
  const left = Math.max(0, 1 - r.damage / boss.hp);
  let step = 0;
  ui.fight = { hpPct: 100, text: '전투 중…' };
  render();
  const id = setInterval(() => {
    step += 1;
    const t = step / 12;
    ui.fight = { hpPct: Math.max(r.killed ? 0 : left * 100, 100 - t * 100 * (r.killed ? 1 : 1 - left)), text: `${fmt((r.damage * Math.min(1, t)))} 피해` };
    if (step >= 12) {
      clearInterval(id);
      ui.fight = null;
      clang(r.killed ? 'up' : 'destroy');
      if (r.killed) { gainText(bossReward(boss.stage)); sparks('big', '#f1d488'); buzz([40, 40, 80]); }
      toast(r.killed ? `${boss.stage}단계 보스 처치! +${fmt(bossReward(boss.stage))} 미네랄` : `실패… 30초 동안 ${fmt(r.damage)} 피해 (체력 ${fmt(boss.hp)})`);
      persist();
    }
    render();
  }, 200);
}

const handlers = {
  tab: (d) => { ui.tab = d.tab; window.scrollTo(0, 0); },
  select: (d) => { ui.selected = Number(d.id); if (ui.tab !== 'forge') ui.tab = 'forge'; },
  enhance: () => doEnhance(),
  buy: (d) => { const r = buy(s, d.type); if (!r.ok) return toast(r.reason); ui.selected = r.weapon.id; toast(`${WEAPONS[d.type].name} 구매 · 채집장으로 보냈습니다`); },
  combine: () => {
    const w = selectedWeapon();
    const partner = s.weapons.filter((x) => canCombine(w, x)).sort((a, b) => b.level - a.level)[0];
    const r = partner && combine(s, w.id, partner.id);
    if (!r?.ok) return toast('같은 등급 +10 이상 두 자루가 필요합니다');
    ui.selected = r.weapon.id; clang('up'); toast(`조합 성공! ${GRADES[r.weapon.grade]} ${WEAPONS[r.weapon.type].name}`);
  },
  sell: () => { const w = selectedWeapon(); if (!w) return; const r = sell(s, w.id); ui.selected = null; gainText(r.value); toast(`+${fmt(r.value)} 미네랄에 팔았습니다`); },
  speed: () => {
    ui.speed = ui.speed === 3 ? 1 : ui.speed + 1;
    if (ui.speed > 1) toast(`${ui.speed}배속 · 시제품이라 무료, 출시 후에는 배속권으로 판매`);
  },
  tap: () => {
    const g = tapMine(s);
    const vein = document.querySelector('.tap-vein');
    floatText(`+${fmt(g)}`, 'gain', vein);
    vein?.classList.remove('hit'); void vein?.offsetWidth; vein?.classList.add('hit');
    if (Math.random() < 0.35) sparks('up', '#6fd6c4');
    tapSound(); buzz(8);
  },
  'combine-all': () => {
    const r = combineAll(s);
    if (!r.count) return toast('같은 등급 +10 이상 두 자루가 필요합니다');
    const best = [...s.weapons].sort((a, b) => b.grade - a.grade)[0];
    ui.selected = best.id; clang('up'); buzz([30, 30, 60]);
    toast(`${r.count}번 조합! 최고 ${GRADES[best.grade]} ${WEAPONS[best.type].name}`);
    setTimeout(() => sparks('big', gradeColor(best.grade)), 50);
  },
  'open-trait': () => { const w = s.weapons.find((x) => x.pendingTraits); if (w) ui.modal = { kind: 'trait', id: w.id }; },
  trait: (d) => {
    pickTrait(s, ui.modal.id, d.key);
    toast(`특성 획득: ${TRAITS[d.key].label}`);
    const next = s.weapons.find((x) => x.pendingTraits);
    ui.modal = next ? { kind: 'trait', id: next.id } : null;
  },
  upgrade: () => { const r = upgradeBuilding(s); toast(r.ok ? `광맥 ${s.building.tier + 1}단계!` : r.reason); },
  challenge: () => startFight(),
  dps: () => {
    const before = s.bestDps; const d = measureDps(s, Date.now());
    toast(d > before ? `신기록! DPS ${fmt(d)}` : `DPS ${fmt(d)} (최고 ${fmt(s.bestDps)})`);
    if (d > before && before > 0) clang('up');
  },
  'open-rebirth': () => { ui.modal = { kind: 'rebirth' }; },
  rebirth: () => doRebirth(false),
  'rebirth-ad': () => doRebirth(true),
  'offline-ad': () => { s.minerals += ui.modal.gain; toast(`(광고 시청 완료) +${fmt(ui.modal.gain)} 더`); ui.modal = null; },
  close: () => { ui.modal = null; },
  unlock: (d) => { const r = unlock(s, d.type); toast(r.ok ? `${WEAPONS[d.type].name} 해금! 강화장에서 살 수 있습니다` : r.reason); },
  perm: (d) => { const r = buyPerm(s, d.key); toast(r.ok ? `${PERMS[d.key].name} 강화` : r.reason); },
  'ad-minerals': () => { const g = Math.max(200, incomePerSec(s) * 300); s.minerals += g; gainText(g); toast(`(광고 시청 완료) +${fmt(g)} 미네랄`); },
  cash: (d) => toast(`「${d.name}」은 출시 후 판매합니다`),
  'open-odds': () => { ui.modal = { kind: 'odds', type: 'sword' }; },
  'odds-type': (d) => { ui.modal = { kind: 'odds', type: d.type }; },
  'bulk-sell': () => { const r = bulkSell(s, ui.sellMax); toast(r.ok ? `${r.count}자루를 팔았습니다` : r.reason); ui.selected = null; },
};

function doRebirth(ad) {
  const c = rebirthCoins(s) * (ad ? 2 : 1);
  s = rebirth(s, { adDouble: ad });
  ui.modal = null; ui.selected = null; ui.auto = false; ui.tab = 'shop';
  toast(`${ad ? '(광고 시청 완료) ' : ''}환생 코인 ${fmt(c)}개 획득! ${s.meta.rebirths + 1}회차 시작`);
  persist();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  if (e.target.closest('#modal') && !e.target.closest('.sheet')) return;
  const h = handlers[el.dataset.act];
  if (!h) return;
  if (el.dataset.act !== 'enhance' && el.dataset.act !== 'challenge') {
    h(el.dataset);
    render();
  } else h(el.dataset);
});

document.addEventListener('change', (e) => {
  const act = e.target.dataset.act;
  if (act === 'auto') ui.auto = e.target.checked;
  if (act === 'auto-target') ui.autoTarget = Number(e.target.value);
  if (act === 'sell-max') ui.sellMax = Number(e.target.value);
});

// ---- 시작 ----
[...Object.values(ART).flatMap((x) => Object.values(x)), ...Object.values(BOSS_ART), 'assets/building.webp', 'assets/logo.webp']
  .forEach((src) => { const im = new Image(); im.src = src; });
requestAnimationFrame(animateNumbers);
// 1분 이상 비웠을 때만 '자는 동안 캤습니다' 창을 띄운다.
function welcomeBack() {
  const away = Date.now() - s.lastSeen;
  const g = applyOffline(s, Date.now());
  if (away >= 60e3 && g > 1) ui.modal = { kind: 'offline', gain: g };
}
welcomeBack();
const splash = document.getElementById('splash');
splash.hidden = false;
splash.addEventListener('click', () => { splash.hidden = true; clang('up'); });
render();

let seconds = 0;
setInterval(() => {
  if (document.hidden) return;
  seconds += 1;
  tick(s, ui.speed);
  if (ui.auto) for (let i = 0; i < 3 * ui.speed; i++) autoStep(s, { target: ui.autoTarget }, Math.random);
  if (seconds % 60 === 0 && fighters(s).length) measureDps(s, Date.now());
  if (seconds % 10 === 0) persist();
  if (ui.tab === 'mine' && !ui.modal && incomePerSec(s) > 0) floatText(`+${fmt(incomePerSec(s) * ui.speed)}`, 'gain small', document.querySelector('.tap-vein'));
  const busy = ui.modal || ui.fight || document.activeElement?.tagName === 'SELECT';
  if (busy) renderHeader(); else render();
}, 1000);

window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); else { welcomeBack(); render(); } });
