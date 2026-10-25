// 화면: 상태를 읽어 그리고, 버튼은 data-act로 처리한다.
import {
  BIG_EVERY, isBigStage, AWAKEN_SKILLS, AWAKEN_MULT, WEAPONS, WEAPON_ORDER, GRADES, TRAITS, BOSS_TYPES, MAX_LEVEL, FIGHT_SECONDS, GRADE_CAPS, TRAIT_LEVELS, GRADE_MULT,
  mineHit, successRate, destroyChance, formatNumber, weaponAttack, weaponHitsPerSec, partyArmorBreak, bossFight, buildingStats, buildingDps,
} from './rules.js';
import {
  load, save, buy, enhance, sell, assign, pickTrait, upgradeBuilding, promote, promoteAll, canPromote, promoteCost, promoteMaterial, atCap,
  buildingUpgradeCost, tick, applyOffline, incomePerSec, ctxOf, fighters, miners, buyPrice,
  enhancePrice, sellValue, permLevel, tapMine, tapGain, craftProtect, fillPity, SHARD_COST, PITY_FILL, selectVein, bestVein, veinIncome, canAwaken, awaken, awakenCost, AWAKEN_GRADE, collection, COLLECT_PCT, SET_PCT, buyUpgrade, upgradePrice, dpsSources, hearts, UPG_PCT, HEART_PCT, ORB_PCT,
} from './state.js';
import { dayKey, canAttend, attend, attendSlot, track, missionRows, claimMission, dailyAlert, ATTEND_REWARDS } from './daily.js';
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
const today = () => dayKey(Date.now());
const ui = { useProtect: true, suspense: false, attendAsked: false, speed: 1, tab: 'forge', selected: null, modal: null, auto: false, autoTarget: 15, sellMax: 5, toast: null, fight: null, banner: null, flash: null };
const $ = (sel) => document.querySelector(sel);
const fmt = formatNumber;
const pct = (x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

const LEVEL_NAMES = {
  sword: ['녹슨 철검', '무딘 장검', '강철 장검', '기사의 검', '흑철 대검', '룬 블레이드', '심연을 가르는 자'],
  axe: ['나무꾼 손도끼', '쇠도끼', '전투 도끼', '광전사의 도끼', '흑요석 도끼', '천둥 도끼', '대지를 쪼개는 자'],
  staff: ['마른 나뭇가지', '견습 지팡이', '수정 지팡이', '현자의 지팡이', '별빛 홀', '룬의 왕홀', '차원을 여는 자'],
  bow: ['사냥꾼 단궁', '장궁', '강철 장궁', '명사수의 활', '바람의 활', '폭풍의 활', '하늘을 꿰뚫는 자'],
};
// 그림·이름 7단계: 일반 +0, 일반 +5, 희귀, 전설, 히어로, 초월, 초월 +10.
const BAND_LABELS = ['일반 +0', '일반 +5', '희귀', '전설', '히어로', '초월', '초월 +10'];
const bandOf = (w) => (w.awakened ? 6 : w.grade === 0 ? (w.level >= 5 ? 1 : 0) : w.grade >= 4 ? (w.level >= 10 ? 6 : 5) : w.grade + 1);
const levelName = (w) => LEVEL_NAMES[w.type][bandOf(w)];
const auraOf = (w) => (w.grade >= 3 ? 'gold' : w.grade === 2 ? 'violet' : w.grade === 1 || w.level >= 5 ? 'blue' : 'none');
const gradeLv = (w) => `${w.awakened ? '각성 ' : ''}${GRADES[w.grade]} +${w.level}`;
const gradeColor = (g) => GRADE_COLORS[g][1];

// ---- 소리 ----
let audio = null;
function clang(kind) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    const freqs = kind === 'destroy' ? [180, 120] : kind === 'up' ? [1320, 1980] : kind === 'hammer' ? [420] : [880, 660];
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
function weaponArtUrl(type, grade, level) {
  const set = ART[type] ?? {};
  const bands = Object.keys(set).map(Number);
  if (!bands.length) return null;
  const b = bandOf({ grade, level });
  const best = bands.reduce((a, x) => (Math.abs(x - b) < Math.abs(a - b) ? x : a), bands[0]);
  return set[best];
}
const art = (type, grade, level, size) => {
  const url = weaponArtUrl(type, grade, level);
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
      <div class="dps-hero"><span class="pw-label">DPS</span><b id="power">${fmt(battleDps(s))}</b><small>최고 ${fmt(Math.max(s.bestDps, battleDps(s)))}</small></div>
      <button type="button" class="speed s${ui.speed}" data-act="speed" aria-label="게임 속도 ${ui.speed}배, 눌러서 바꾸기">▶ ${ui.speed}배속</button>
    </div>
    ${powerRow()}
    <div class="hud-sub">
      <span class="min-line"><b class="mineral" id="min-num"></b> 미네랄 <small>+${fmt(incomePerSec(s))}/초</small></span>
      <span>코인 <b>${fmt(s.meta.coins)}</b></span>
      <span>심장 <b>${hearts(s.meta)}</b></span>
    </div>
    ${hint ? `<button type="button" class="hint" data-act="tab" data-tab="boss">10분째 DPS가 그대로예요. 환생하면 코인 ${fmt(rebirthCoins(s))}개 →</button>`
      : `<button type="button" class="guide g-${step.key}" data-act="${step.act ?? 'tab'}" data-tab="${step.tab}"><span>다음</span>${step.text}</button>`}`;
  if (html !== lastHud) { lastHud = html; $('#hud').innerHTML = html; afterPower(); }
}

// ---- 성장 체감: 전투력 숫자, 다음 보스까지 진행 막대, 전투력 돌파 축하 ----
function powerRow() {
  const boss = nextBoss(s);
  const party = fighters(s);
  const r = party.length ? bossFight(party, boss, ctxOf(s)) : { damage: 0, killed: false };
  const p = r.killed ? 100 : Math.min(99, Math.floor((r.damage / boss.hp) * 100));
  const name = `${boss.stage}단계 ${boss.big ? '빅보스' : '보스'}`;
  return `<div class="power-row">
      <button type="button" class="goal ${r.killed ? 'ready' : ''} ${boss.big ? 'big' : ''}" data-act="tab" data-tab="boss" aria-label="${name}까지 ${p}%">
        <i style="width:${p}%"></i><em>${r.killed ? `${name} 잡을 수 있음!` : `${name}까지 DPS ${p}%`}</em>
      </button>
    </div>`;
}

const MILESTONES = [1, 2, 5];
function milestoneOf(x) {
  if (x < 10) return 0;
  const k = Math.pow(10, Math.floor(Math.log10(x)));
  return k * [...MILESTONES].reverse().find((m) => m * k <= x);
}
function afterPower() {
  const power = battleDps(s);
  const el = document.getElementById('power');
  const last = afterPower.last ?? power;
  afterPower.last = power;
  if (power > last * 1.001 && el) {
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    if (power > last * 1.01) floatText(`▲ +${fmt(power - last)}`, 'up-power', el);
  }
  const ms = milestoneOf(power);
  if (ms > (s.powerMilestone ?? 0)) {
    const first = s.powerMilestone === undefined;
    s.powerMilestone = ms;
    if (!first && !ui.banner) showMilestone(`DPS ${fmt(ms)} 돌파!`);
  }
}

function showMilestone(text) {
  ui.banner = `<div class="banner-inner milestone" style="--grade:#f1d488"><small>성장</small><strong class="ms">${text}</strong></div>`;
  renderBanner(); clang('up'); buzz([20, 20, 40]);
  setTimeout(() => sparks('big', '#f1d488'), 30);
  clearTimeout(showMilestone.t);
  showMilestone.t = setTimeout(() => { ui.banner = null; renderBanner(); }, 1800);
}

// 새 (무기, 등급)을 도감에 올리면 축하한다.
function checkCollection() {
  const c = collection(s.meta).count;
  if (checkCollection.last !== undefined && c > checkCollection.last) toast(`도감 등록! 공격력 +${Math.round(COLLECT_PCT * 100)}% (수집 보너스 +${Math.round(collection(s.meta).bonus * 100)}%)`);
  checkCollection.last = c;
}

// ---- 강화장 ----
function weaponTile(w) {
  const on = w.id === ui.selected;
  return `<button type="button" class="tile aura-${auraOf(w)} ${on ? 'on' : ''} ${w.awakened ? 'awakened' : ''}" data-act="select" data-id="${w.id}" style="--grade:${gradeColor(w.grade)}" aria-label="${GRADES[w.grade]} ${WEAPONS[w.type].name} +${w.level}">
    ${art(w.type, w.grade, w.level, 40)}
    <span class="tile-g">${GRADES[w.grade]}</span><span class="tile-lv">+${w.level}</span>
    ${w.pendingTraits ? '<span class="tile-dot" title="특성 선택 대기"></span>' : ''}
  </button>`;
}

function promoteButton(w) {
  const mat = promoteMaterial(s, w);
  const cost = promoteCost(w.grade);
  const why = !mat ? `재료로 ${GRADES[w.grade]} ${WEAPONS[w.type].name} 한 자루가 더 필요` : s.minerals < cost ? '미네랄 부족' : `재료: +${mat.level} ${WEAPONS[mat.type].name} 소모`;
  return `<button type="button" class="enhance-btn promote" data-act="promote" ${canPromote(s, w) ? '' : 'disabled'}>
      <span class="eb-title">승급 → ${GRADES[w.grade + 1]} +0</span>
      <span class="eb-meta">${fmt(cost)} 미네랄 · ${why}</span>
    </button>`;
}

function awakenBox(w) {
  if (w.awakened) return '';
  const other = s.weapons.find((x) => x.awakened);
  const sk = AWAKEN_SKILLS[w.type];
  if (w.grade < AWAKEN_GRADE) return w.grade === AWAKEN_GRADE - 1 && !other ? `<p class="note aw-hint">${GRADES[AWAKEN_GRADE]}까지 올리면 이 무기를 <b>각성</b>시켜 「${sk.name}」을 얻고 환생해도 남길 수 있습니다.</p>` : '';
  return `<div class="awaken-box">
    <p><b>각성 「${LEVEL_NAMES[w.type][6]}」</b><small>공격력 ×${AWAKEN_MULT} · ${sk.text} · 다시는 깨지지 않음 · 환생해도 일반 +0으로 남음</small></p>
    <button type="button" class="enhance-btn awaken" data-act="awaken" ${canAwaken(s, w) ? '' : 'disabled'}>
      <span class="eb-title">각성</span>
      <span class="eb-meta">${other ? '각성 무기는 한 자루만 (지금 각성 무기를 팔면 가능)' : `${fmt(awakenCost())} 미네랄`}</span>
    </button>
  </div>`;
}

// 심연 조각: 깨진 무기에서 남는 재료. 천장 채우기와 파괴 방지권으로 쓴다.
function shardBar(w, breakP) {
  const sh = s.meta.shards ?? 0, pr = s.meta.protect ?? 0;
  if (!sh && !pr && !breakP) return '';
  return `<div class="shard-bar ${breakP ? 'risk' : ''}">
    <p><b class="shard">◆ 심연 조각 ${fmt(sh)}</b><b class="ticket">🛡 방지권 ${pr}</b></p>
    ${breakP ? `<label class="switch"><input type="checkbox" data-act="use-protect" ${ui.useProtect ? 'checked' : ''} ${pr ? '' : 'disabled'}> 깨질 때 방지권 자동 사용</label>` : ''}
    <div class="row">
      ${btn('fill-pity', `천장 +${PITY_FILL}% · 조각 ${SHARD_COST.pity}`, { disabled: sh < SHARD_COST.pity || w.pity >= 100 })}
      ${btn('craft-protect', `방지권 만들기 · 조각 ${SHARD_COST.protect}`, { disabled: sh < SHARD_COST.protect })}
    </div>
    <small>무기가 깨지면 등급에 따라 조각이 남습니다(희귀 8 · 전설 18 · 히어로 32 · 초월 50).</small>
  </div>`;
}

function renderForge() {
  const w = selectedWeapon();
  const bonus = permLevel(s, 'success');
  let main = `<section class="anvil empty"><p>무기가 없습니다. 아래에서 검을 사세요.</p></section>`;
  if (w) {
    const rate = w.pity >= 100 ? 1 : successRate(w.level, w.type, bonus, w.grade);
    const cost = enhancePrice(s, w);
    const promotable = promoteAll(structuredClone(s)).count;
    const cap = GRADE_CAPS[w.grade];
    const top = w.grade >= GRADES.length - 1;
    const safe = w.grade === 0 && w.level < 5;
    const breakP = safe ? 0 : destroyChance(w.level, w.type, w.grade);
    const failText = safe ? '실패해도 유지' : breakP > 0 ? `실패 시 ${pct(breakP)} 파괴, 아니면 -1` : '실패 시 한 단계 하락';
    const nextTrait = TRAIT_LEVELS.find((l) => l <= cap && l > w.level);
    main = `
    <section class="anvil aura-${auraOf(w)} ${ui.flash ?? ''}" style="--grade:${gradeColor(w.grade)}">
      <div class="anvil-art">${art(w.type, w.grade, w.level, 132)}</div>
      <div class="anvil-info">
        <p class="grade-tag">${w.awakened ? '<span class="aw-tag">각성</span> ' : ''}${GRADES[w.grade]} · ${WEAPONS[w.type].name}</p>
        <h2><span class="lv">+${w.level}</span> ${levelName(w)}</h2>
        <div class="track" style="--cap:${cap}" aria-label="${GRADES[w.grade]} +${w.level} / +${cap}">${Array.from({ length: cap }, (_, i) => `<i class="${i < w.level ? 'f' : ''} ${TRAIT_LEVELS.includes(i + 1) ? 't' : ''} ${i === w.level - 1 ? 'n' : ''}"></i>`).join('')}</div>
        <p class="cap-line">${top ? `최종 등급 · +${cap}까지` : `+${cap} 달성 → ${GRADES[w.grade + 1]} +0으로 승급`}${nextTrait ? ` · +${nextTrait}에서 특성` : ''}</p>
        <dl class="stats">
          <div><dt>공격력</dt><dd>${fmt(weaponAttack(w, ctxOf(s)))}</dd></div>
          <div><dt>성공률</dt><dd>${atCap(w) ? '한계' : pct(rate)}</dd></div>
          <div><dt>판매가</dt><dd>${fmt(sellValue(w))}</dd></div>
        </dl>
        <p class="fail-note">${atCap(w) ? (top ? '최고 단계에 도달했습니다' : '한계 도달 · 아래 버튼으로 승급') : failText}${w.type === 'axe' ? ' · 도끼는 깨지지 않음' : ''}${w.type === 'staff' ? ' · 성공 시 15%로 2단계' : ''}</p>
        <div class="pity" aria-label="천장 ${w.pity}%"><span style="width:${w.pity}%"></span><em>천장 ${w.pity}%</em></div>
        ${w.awakened ? `<p class="aw-skill">「${AWAKEN_SKILLS[w.type].name}」 공격력 ×${AWAKEN_MULT} · ${AWAKEN_SKILLS[w.type].text} · 깨지지 않음</p>` : ''}
        ${w.traits.length ? `<p class="traits">${w.traits.map((t) => `<span>${TRAITS[t].label}</span>`).join('')}</p>` : ''}
      </div>
    </section>
    ${w.pendingTraits ? btn('open-trait', '특성 고르기 (' + gradeLv(w) + ' 보상)', { cls: 'big gold' }) : atCap(w) && !top ? promoteButton(w) : `
    <button type="button" class="enhance-btn" data-act="enhance" ${s.minerals < cost || atCap(w) ? 'disabled' : ''}>
      <span class="eb-title">${atCap(w) ? '최고 단계' : '강화'}</span>
      <span class="eb-meta">${fmt(cost)} 미네랄 · 성공 ${pct(rate)}</span>
    </button>`}
    <div class="row">
      ${btn('promote-all', promotable ? `자동 승급 (${promotable}회)` : '승급 대기 없음', { disabled: !promotable })}
      ${btn('sell', `판매 +${fmt(sellValue(w))}`)}
      ${btn('brag', '자랑하기')}
    </div>
    ${upgradeCard()}
    ${awakenBox(w)}
    ${shardBar(w, breakP)}`;
  }
  const shop = WEAPON_ORDER.map((t) => {
    const open = s.meta.unlocked.includes(t);
    const price = buyPrice(s, t);
    return `<div class="buy-card ${open ? '' : 'locked'}">
      <button type="button" class="buy" data-act="${open ? 'buy' : 'info'}" data-type="${t}" ${open && s.minerals < price ? 'disabled' : ''}>
        ${art(t, 0, 0, 32)}<span>${WEAPONS[t].name}</span><small>${open ? fmt(price) : `🔒 코인 ${WEAPONS[t].unlockCost}`}</small></button>
      <button type="button" class="info-btn" data-act="info" data-type="${t}" aria-label="${WEAPONS[t].name} 설명 보기">i</button>
    </div>`;
  }).join('');
  const autoBox = s.meta.rebirths >= AUTO_REBIRTHS ? `
    <div class="auto">
      <label class="switch"><input id="auto-on" type="checkbox" data-act="auto" ${ui.auto ? 'checked' : ''}> 자동 강화</label>
      <label>목표 <select id="auto-target" data-act="auto-target">${[[5, '등급마다 +5'], [8, '등급마다 +8'], [15, '한계까지 (자동 승급)']].map(([n, l]) => `<option value="${n}" ${n === ui.autoTarget ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${s.meta.rebirths >= BULK_SELL_REBIRTHS ? `<label>일괄 판매 <select id="sell-max" data-act="sell-max">${[3, 5, 8, 10].map((n) => `<option value="${n}" ${n === ui.sellMax ? 'selected' : ''}>+${n} 이하</option>`).join('')}</select></label>${btn('bulk-sell', '팔기')}` : '<small>일괄 판매는 환생 5회차부터</small>'}
      <small>가장 싼 무기부터 목표까지 강화하고, 한계에 닿으면 재료가 있을 때 승급, 다 차면 새 무기를 삽니다. 특성은 추천으로 자동 선택.</small>
    </div>` : '';
  return `${main}
    <h3 class="sec">무기 구매 <small>i를 누르면 무기 설명</small></h3><div class="shop">${shop}</div>
    <h3 class="sec">보유 무기 <small>${s.weapons.length}자루 · 평소엔 모두 채집, 보스전엔 전원 출동</small></h3>
    <div class="tiles">${s.weapons.map(weaponTile).join('') || '<p class="note">아직 무기가 없습니다.</p>'}</div>
    ${autoBox}`;
}

// ---- 채집장 ----
// 무기 전부가 가운데 목표를 빙 둘러싸고 각자 공속대로 휘두른다. 겹쳐도 그대로 그린다(성능 때문에 80자루까지).
const ARENA_MAX = 80;
// tier를 주면 그 광맥을 못 뚫는 무기는 회색으로 튕긴다.
function strikersHtml(list, fast = 1, tier = null) {
  const shown = list.slice(0, ARENA_MAX);
  const n = shown.length;
  const ctx = ctxOf(s);
  return shown.map((w, i) => {
    const bounce = tier !== null && mineHit(w, tier, ctx) <= 0;
    const dur = Math.min(1.6, Math.max(0.4, 1 / weaponHitsPerSec(w))) / fast;
    const ring = n > 10 ? (i % 3 === 0 ? 'r-in' : i % 3 === 1 ? 'r-mid' : '') : '';
    const angle = (360 / n) * i + (i % 2 ? 7 : 0);
    return `<span class="striker ${ring} ${bounce ? 'bounce' : ''}" style="--a:${angle.toFixed(1)}deg"><span class="arm" style="--dur:${dur.toFixed(2)}s;--delay:${((i * 0.29) % dur).toFixed(2)}s"><span class="blade">${art(w.type, w.grade, w.level, 48)}</span></span></span>`;
  }).join('');
}

const scratchers = (tier) => miners(s).filter((w) => mineHit(w, tier, ctxOf(s)) > 0).length;

function renderArena() {
  const tier = s.building.tier;
  const list = miners(s).sort((a, b) => b.grade - a.grade || b.level - a.level);
  const n = list.length;
  const ok = scratchers(tier);
  return `<section class="arena ${ok ? 'busy' : ''}">
    <p class="vein-name">${buildingStats(tier).name} <small>단단함 ${fmt(buildingStats(tier).armor)}</small></p>
    ${n && ok < n ? `<p class="bounce-note">${n - ok}자루는 너무 약해 튕겨 나갑니다</p>` : ''}
    <div class="arena-ring">
      ${strikersHtml(list, 1, tier)}
      <button type="button" class="tap-vein" data-act="tap" aria-label="광맥 캐기"><img class="art" src="assets/building.webp" width="120" height="120" alt=""><span class="tap-hint">눌러서 캐기 +${fmt(tapGain(s))}</span></button>
    </div>
    ${n > ARENA_MAX ? `<p class="note">그 밖에 ${n - ARENA_MAX}자루가 더 캐고 있습니다</p>` : ''}
    ${n ? '' : '<p class="note">채집 무기가 없습니다. 강화장에서 무기를 채집으로 보내면 광맥을 둘러싸고 캡니다.</p>'}
  </section>`;
}

function veinRow(t, best, locked = false) {
  const st = buildingStats(t);
  const inc = veinIncome(s, t);
  const ok = scratchers(t), n = miners(s).length;
  const here = t === s.building.tier;
  const action = locked ? btn('upgrade', `개척 ${fmt(buildingUpgradeCost(s))}`, { cls: 'gold', disabled: s.minerals < buildingUpgradeCost(s) })
    : here ? '<span class="pill ok">채집 중</span>' : btn('vein', '이동', { data: { tier: t } });
  return `<li class="vein ${here ? 'here' : ''} ${locked ? 'locked' : ''}">
    <div><span><b>${st.name}</b>${!locked && t === best && !here ? '<em class="rec">추천</em>' : ''}</span>
      <small>단단함 ${fmt(st.armor)} · 효율 ×${st.eff.toFixed(1)} · 캘 수 있는 무기 <span class="${ok ? '' : 'zero'}">${ok}/${n}</span></small></div>
    <span class="inc ${inc ? '' : 'zero'}">${inc ? `+${fmt(inc)}/초` : '못 캠'}</span>
    ${action}
  </li>`;
}

function renderMine() {
  const b = s.building;
  const st = buildingStats(b.tier);
  const unlocked = b.unlocked ?? b.tier;
  const best = bestVein(s);
  const rows = Array.from({ length: unlocked + 1 }, (_, t) => veinRow(unlocked - t, best)).join('');
  return `
    ${renderArena()}
    <section class="mine">
      <div>
        <p class="grade-tag">${st.name} · ${b.tier + 1}등급</p>
        <div class="hp"><span id="mine-hp"></span></div>
        <dl class="stats">
          <div><dt>단단함</dt><dd>${fmt(st.armor)}</dd></div>
          <div><dt>캐는 무기</dt><dd>${scratchers(b.tier)}/${miners(s).length}</dd></div>
          <div><dt>초당 수입</dt><dd>${fmt(incomePerSec(s))}</dd></div>
        </dl>
        <p class="note">한 방 피해가 단단함보다 약하면 튕겨 나가 못 캡니다. 높은 광맥일수록 단단하지만 한 방당 미네랄이 많습니다. 도끼는 두 배로 캐고 방깎만큼 단단함을 무시합니다.</p>
      </div>
    </section>
    ${best !== b.tier ? btn('vein', `${buildingStats(best).name}(으)로 옮기면 초당 +${fmt(veinIncome(s, best))}`, { cls: 'big gold', data: { tier: best } }) : ''}
    <h3 class="sec">광맥 고르기 <small>강해질수록 위로</small></h3>
    <ol class="veins">${veinRow(unlocked + 1, best, true)}${rows}</ol>
    <p class="note">앱을 꺼도 지금 광맥에서 최대 8시간치가 쌓입니다.</p>`;
}

// ---- DPS 올릴 거리: 보스에서 막혔을 때 무엇으로 더 올릴 수 있는지 ----
function upgradeCard() {
  const price = upgradePrice(s);
  return `<div class="upg-card">
    <div><b>공격력 업그레이드 <span class="lv">Lv.${s.upg ?? 0}</span></b><small>모든 무기 공격력 ×${(1 + UPG_PCT).toFixed(2)}씩 · 지금 ×${dpsSources(s).upg.toFixed(2)} · 환생하면 초기화</small></div>
    ${btn('upg', `+1 · ${fmt(price)}`, { cls: 'gold', disabled: s.minerals < price || !s.weapons.length })}
  </div>`;
}

function dpsPlan(boss) {
  const src = dpsSources(s);
  const col = collection(s.meta);
  const need = boss.hp / FIGHT_SECONDS;
  const have = battleDps(s);
  const ratio = have > 0 ? need / have : Infinity;
  const aw = s.weapons.find((w) => canAwaken(s, w));
  const cheapest = s.weapons.filter((w) => !atCap(w) && !w.pendingTraits).sort((a, b) => enhancePrice(s, a) - enhancePrice(s, b))[0];
  const rows = [
    ['공격력 업그레이드', `Lv.${s.upg ?? 0} · ×${src.upg.toFixed(2)}`, `다음 +${Math.round(UPG_PCT * 100)}% · ${fmt(upgradePrice(s))} 미네랄`, s.minerals >= upgradePrice(s)],
    ['DPS 구슬', `${s.orbs ?? 0}개 · ×${src.orbs.toFixed(2)}`, `보스를 잡을 때마다 +${Math.round(ORB_PCT * 100)}%`, false],
    ['보스의 심장', `${hearts(s.meta)}개 · ×${src.hearts.toFixed(2)}`, `${BIG_EVERY}단계마다 빅보스 첫 처치 +${Math.round(HEART_PCT * 100)}% (영구)`, false],
    ['도감 수집', `${col.count}/${col.total} · ×${src.collection.toFixed(2)}`, `미등록 ${col.total - col.count}칸 · 한 칸 +${Math.round(COLLECT_PCT * 100)}%`, false],
    ['각성', s.weapons.some((w) => w.awakened) ? '각성 무기 있음' : '없음', aw ? '지금 각성 가능!' : `${GRADES[AWAKEN_GRADE]} 무기부터`, !!aw],
    ['강화', cheapest ? `가장 싼 강화 ${fmt(enhancePrice(s, cheapest))}` : '모두 한계', cheapest ? `${gradeLv(cheapest)} ${WEAPONS[cheapest.type].name}` : '승급하세요', !!cheapest && s.minerals >= enhancePrice(s, cheapest)],
  ];
  return `<section class="dps-plan">
    <h3 class="sec">DPS 올릴 거리 <small>필요 ${fmt(need)} · 지금 ${fmt(have)}${Number.isFinite(ratio) ? ` · ${ratio.toFixed(1)}배 더` : ''}</small></h3>
    <ul>${rows.map(([k, v, hint, go]) => `<li class="${go ? 'go' : ''}"><b>${k}</b><span>${v}</span><small>${hint}</small></li>`).join('')}</ul>
    ${upgradeCard()}
  </section>`;
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
    <section class="boss ${boss.big ? 'big' : ''}">
      <div class="boss-art ${fight ? 'hit' : ''}">${bossArt(boss.types, 120)}</div>
      <div>
        <p class="grade-tag">${boss.big ? '<span class="big-tag">빅보스</span> ' : ''}${boss.stage}단계 보스</p>
        <h2>${boss.types.map((t) => BOSS_TYPES[t].name).join(' + ')}</h2>
        <ul class="hints">${boss.types.map((t) => `<li>${BOSS_TYPES[t].hint}</li>`).join('')}</ul>
        <p class="note">처치 보상: DPS 구슬 1개(+${Math.round(ORB_PCT * 100)}%) · ${fmt(bossReward(boss.stage))} 미네랄${boss.big && boss.stage > (s.meta.bestStage ?? 0) ? ` · <b class="heart">보스의 심장</b>(영구 DPS +${Math.round(HEART_PCT * 100)}%)` : ''}</p>
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
    ${killed ? '' : dpsPlan(boss)}
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
      const seen = [...found].some((k) => { const [tt, g, l] = k.split(':'); return tt === t && bandOf({ grade: Number(g), level: Number(l) }) >= i; });
      return `<li class="${seen ? 'seen' : ''}"><span>${BAND_LABELS[i]}</span>${seen ? n : '???'}</li>`;
    }).join('');
    const grades = GRADES.map((g, i) => `<span class="gchip ${[...found].some((k) => k.startsWith(`${t}:${i}:`)) ? 'seen' : ''}" style="--grade:${gradeColor(i)}">${g}</span>`).join('');
    return `<article class="book-card ${open ? '' : 'locked'}">
      <header>${art(t, 0, 0, 40)}<div><h4>${WEAPONS[t].name}</h4><small>${open ? '해금됨' : `잠김 · 환생 코인 ${WEAPONS[t].unlockCost}`}</small></div>${btn('info', '설명', { data: { type: t } })}</header>
      <div class="gchips">${grades}${collection(s.meta).sets.includes(t) ? `<span class="gchip set">세트 완성 +${Math.round(SET_PCT * 100)}%</span>` : ''}</div>
      <ol class="names">${names}</ol>
    </article>`;
  }).join('');
  const col = collection(s.meta);
  return `${logo}<section class="collect">
      <p><b>수집 보너스 공격력 +${Math.round(col.bonus * 100)}%</b><small>${col.count}/${col.total} 등록</small></p>
      <i class="bar"><em style="width:${(col.count / col.total) * 100}%"></em></i>
      <small>처음 띄운 무기·등급마다 +${Math.round(COLLECT_PCT * 100)}%, 한 무기의 다섯 등급을 모두 모으면 +${Math.round(SET_PCT * 100)}% 더. 환생해도 남습니다.</small>
    </section>
    <h3 class="sec">무기 도감 <small>처음 띄운 단계 이름이 기록됩니다</small></h3>
    <div class="book">${cards}</div>
    <h3 class="sec">승급표</h3>
    <table class="ready"><tbody>
      <tr><th>등급</th><th>단계</th><th>성공률</th><th>승급</th></tr>
      ${GRADES.map((g, i) => `<tr><th style="color:${gradeColor(i)}">${g}</th><td>+0~+${GRADE_CAPS[i]}</td><td>${pct(successRate(0, 'sword', 0, i))}→${pct(successRate(GRADE_CAPS[i] - 1, 'sword', 0, i))}</td><td>${i < GRADES.length - 1 ? `${fmt(promoteCost(i))} + 같은 등급 1자루` : '최종'}</td></tr>`).join('')}
    </tbody></table>
    <p class="note">한계(+${GRADE_CAPS[0]})에 닿으면 같은 종류·같은 등급 무기 한 자루를 재료로 승급하고, 새 등급 +0부터 다시 강화합니다. 등급이 오르면 공격력이 ${GRADE_MULT}배라 희귀 +0이 일반 +10보다 셉니다. 등급마다 +5·+10에서 특성을 하나씩 얻습니다(초월은 +15에서 하나 더). 높은 등급일수록 성공률이 낮고 일찍부터 깨질 수 있습니다.</p>`;
}

// ---- 출석·미션 ----
function attendGrid() {
  const slot = attendSlot(s.meta, today());
  const doneToday = !canAttend(s.meta, today());
  return `<ol class="attend-grid">${ATTEND_REWARDS.map((r, i) => `<li class="${i < slot || (doneToday && i === slot) ? 'got' : ''} ${i === slot && !doneToday ? 'now' : ''} ${i === 6 ? 'big' : ''}"><small>${i + 1}일</small><b>${r}</b><small>코인</small></li>`).join('')}</ol>`;
}

function dailyHtml() {
  const t = today();
  const rows = missionRows(s.meta, t);
  return `<h3 class="sec">오늘의 보상 <small>매일 자정에 새로 고침</small></h3>
    <section class="daily">
      ${attendGrid()}
      ${canAttend(s.meta, t) ? btn('attend', '출석하고 코인 받기', { cls: 'big gold' }) : `<p class="note">출석 완료 · 연속 ${s.meta.daily.streak}일째. 내일 또 오세요!</p>`}
      <ul class="missions">${rows.map((r) => `<li class="${r.claimed ? 'claimed' : ''}">
        <div><span>${r.label}</span><i class="bar"><em style="width:${(r.count / r.goal) * 100}%"></em></i></div>
        ${r.claimed ? '<small>받음</small>' : btn('mission', r.ready ? `+${r.reward} 코인` : `${r.count}/${r.goal}`, { cls: r.ready ? 'gold' : '', disabled: !r.ready, data: { key: r.key } })}
      </li>`).join('')}</ul>
    </section>`;
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
    ${dailyHtml()}
    <h3 class="sec">환생 코인 상점 <small>보유 ${fmt(s.meta.coins)}</small></h3>
    ${u ? `<div class="unlock" data-act="info" data-type="${u}">${art(u, 0, 0, 44)}<div><b>${WEAPONS[u].name} 해금</b><small>${WEAPONS[u].pitch}</small><small class="more">눌러서 자세히 →</small></div>${btn('unlock', `${WEAPONS[u].unlockCost} 코인`, { disabled: s.meta.coins < WEAPONS[u].unlockCost, data: { type: u } })}</div>` : '<p class="note">시제품의 무기 4종을 모두 해금했습니다.</p>'}
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

// ---- 무기 설명 ----
function weaponInfo(t, fresh) {
  const d = WEAPONS[t];
  const open = s.meta.unlocked.includes(t);
  const probe = { type: t, grade: 0, level: 0, traits: [] };
  const speed = weaponHitsPerSec(probe);
  const evo = [0, 3, 6].map((b) => `<figure>${art(t, [0, 0, 1, 2, 3, 4, 4][b], [0, 5, 0, 0, 0, 0, 10][b], 64)}<figcaption>${BAND_LABELS[b]}</figcaption></figure>`).join('<span class="arrow">›</span>');
  const u = nextUnlock(s);
  const coins = d.unlockCost;
  const action = open ? btn('buy', `구매 · ${fmt(buyPrice(s, t))} 미네랄`, { cls: 'big gold', disabled: s.minerals < buyPrice(s, t), data: { type: t } })
    : u === t ? btn('unlock', `환생 코인 ${coins}개로 해금 (보유 ${fmt(s.meta.coins)})`, { cls: 'big gold', disabled: s.meta.coins < coins, data: { type: t } })
      : `<p class="note">앞 무기(${WEAPONS[u].name})를 먼저 해금해야 합니다 · 환생 코인 ${coins}개</p>`;
  return `
    ${fresh ? '<p class="fresh">해금 완료!</p>' : ''}
    <div class="info-hero">${art(t, 0, 0, 112)}<div><p class="grade-tag">${open ? '해금됨' : '잠김'} · ${d.name}</p><h3>${LEVEL_NAMES[t][0]}</h3><p class="pitch">${d.pitch}</p></div></div>
    <dl class="stats four">
      <div><dt>구매가</dt><dd>${fmt(d.price)}</dd></div>
      <div><dt>기본 공격력</dt><dd>${d.atk}</dd></div>
      <div><dt>초당 타격</dt><dd>${speed.toFixed(1)}</dd></div>
      <div><dt>강화 비용</dt><dd>${t === 'staff' ? '×2' : '보통'}</dd></div>
    </dl>
    <ul class="pc">${d.pros.map((x) => `<li class="pro">${x}</li>`).join('')}${d.cons.map((x) => `<li class="con">${x}</li>`).join('')}</ul>
    <p class="aw-skill">각성하면 「${AWAKEN_SKILLS[t].name}」 · ${AWAKEN_SKILLS[t].text}</p>
    <p class="counters">강한 보스 ${d.counters.map((c) => `<span class="pill ok">${BOSS_TYPES[c].name}</span>`).join(' ')}</p>
    <div class="evo">${evo}</div>
    <p class="note">잘 뜨는 특성: ${[...new Set(d.traitPool)].sort((a, b) => d.traitPool.filter((x) => x === b).length - d.traitPool.filter((x) => x === a).length).slice(0, 2).map((k) => TRAITS[k].label).join(', ')}</p>
    ${action}
    ${btn('close', '닫기')}`;
}

// ---- 팝업 ----
function renderModal() {
  const m = ui.modal;
  const el = $('#modal');
  el.hidden = !m;
  if (!m) { el.innerHTML = ''; renderModal.last = ''; return; }
  let body = '';
  if (m.kind === 'trait') {
    const w = s.weapons.find((x) => x.id === m.id);
    if (!w?.pendingTraits) { ui.modal = null; return renderModal(); }
    const left = s.weapons.filter((x) => x.pendingTraits).length;
    const rec = recommendTrait(w.type, w.pendingTraits);
    body = `<div class="trait-head">${art(w.type, w.grade, w.level, 72)}<div><h3>${gradeLv(w)} 특성 고르기</h3><p>${GRADES[w.grade]} ${WEAPONS[w.type].name} · 「${levelName(w)}」${left > 1 ? ` · 대기 ${left}개` : ''}</p></div></div>
      <div class="choices">${w.pendingTraits.map((t) => btn('trait', `${TRAITS[t].label}${t === rec ? ' · 추천' : ''}`, { cls: `big ${t === rec ? 'gold' : ''}`, data: { key: t } })).join('')}</div>
      <p class="note">자동 강화 중에는 추천 특성을 알아서 고릅니다.</p>`;
  } else if (m.kind === 'rebirth') {
    const c = rebirthCoins(s);
    body = `<h3>환생할까요?</h3><p>무기 ${s.weapons.length}자루와 미네랄이 사라지고, 환생 코인을 받습니다. 해금·영구 능력·도감은 남습니다.</p>
      <div class="choices">${btn('rebirth-ad', `광고 보고 2배 (${fmt(c * 2)} 코인)`, { cls: 'big gold' })}${btn('rebirth', `그냥 받기 (${fmt(c)} 코인)`, { cls: 'big' })}${btn('close', '취소')}</div>`;
  } else if (m.kind === 'offline') {
    body = `<h3>자는 동안 캤습니다</h3><p class="big-num">+${fmt(m.gain)} 미네랄</p>
      <div class="choices">${btn('offline-ad', `광고 보고 2배 받기`, { cls: 'big gold' })}${btn('close', '받기', { cls: 'big' })}</div>`;
  } else if (m.kind === 'attend') {
    body = `<h3>출석 보상</h3><p>7일 연속 출석하면 마지막 날 <b class="gold-t">${ATTEND_REWARDS[6]} 코인</b>! 하루라도 빠지면 1일차부터 다시.</p>
      ${attendGrid()}
      <div class="choices">${btn('attend', '출석하고 받기', { cls: 'big gold' })}${btn('close', '나중에')}</div>`;
  } else if (m.kind === 'brag') {
    body = `<h3>${m.title}</h3>
      <div class="brag">${m.src ? `<img src="${m.src}" alt="${m.title} 자랑 카드" width="1080" height="1350">` : '<p class="note">카드를 그리는 중…</p>'}</div>
      <p class="note">카카오톡·인스타에 올려 자랑하세요. 공유가 안 되면 이미지를 길게 눌러 저장할 수 있습니다.</p>
      <div class="choices">${btn('share-card', '공유하기', { cls: 'big gold', disabled: !m.src })}${btn('save-card', '이미지 저장', { disabled: !m.src })}${btn('close', '닫기')}</div>`;
  } else if (m.kind === 'info') {
    body = weaponInfo(m.type, m.fresh);
  } else if (m.kind === 'odds') {
    const t = m.type ?? 'sword';
    const g = m.grade ?? 0;
    const lvls = Array.from({ length: GRADE_CAPS[g] }, (_, i) => i);
    body = `<h3>강화 확률표</h3><div class="seg">${WEAPON_ORDER.map((x) => btn('odds', WEAPONS[x].name, { cls: x === t ? 'on' : '', data: { type: x, grade: g } })).join('')}</div>
      <div class="seg g5">${GRADES.map((x, i) => btn('odds', x, { cls: i === g ? 'on' : '', data: { type: t, grade: i } })).join('')}</div>
      <div class="scroll"><table class="ready odds"><thead><tr><th>단계</th><th>성공</th><th>실패 시</th></tr></thead><tbody>
      ${lvls.map((l) => `<tr><th>+${l} → +${l + 1}</th><td>${pct(successRate(l, t, 0, g))}</td><td>${g === 0 && l < 5 ? '유지' : destroyChance(l, t, g) > 0 ? `파괴 ${pct(destroyChance(l, t, g))}, 아니면 -1` : '-1'}</td></tr>`).join('')}
      </tbody></table></div><p class="note">실패할 때마다 천장 +10%, 100%가 되면 다음 강화는 확정 성공. 영구 능력 '강화 성공률'은 위 확률에 더해집니다.</p>
      ${btn('close', '닫기', { cls: 'big' })}`;
  }
  const html = `<div class="sheet ${m.kind}" role="dialog" aria-modal="true"><i class="grab" aria-hidden="true"></i>${body}</div>`;
  // 내용이 같으면 그대로 둔다(올라오는 연출이 다시 재생되지 않게).
  if (html === renderModal.last && el.firstChild) return;
  const again = !!el.firstChild;
  renderModal.last = html;
  el.innerHTML = html;
  if (again) el.firstChild.style.animation = 'none';
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
const tabAlerts = () => { const al = alerts(s); al.shop ||= dailyAlert(s.meta, today()); return al; };
function updateLive() {
  const hp = document.getElementById('mine-hp');
  if (hp) hp.style.width = `${Math.max(2, (s.building.hpLeft / s.building.hp) * 100)}%`;
}

// 같은 화면이면 DOM을 바꾸지 않는다(누르는 중인 버튼이 사라지지 않게).
function render() {
  renderHeader();
  checkCollection();
  const html = VIEWS[ui.tab]();
  if (html === lastView) {
    updateLive(); renderModal(); renderBanner();
    const al = tabAlerts();
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('dot', !!al[b.dataset.tab] && b.dataset.tab !== ui.tab));
    return;
  }
  lastView = html;
  const view = $('#view');
  view.innerHTML = html;
  if (render.tab !== ui.tab) {
    const order = Object.keys(VIEWS);
    view.dataset.dir = order.indexOf(ui.tab) >= order.indexOf(render.tab ?? 'forge') ? 'r' : 'l';
    view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); render.tab = ui.tab;
    $('.tabs').style.setProperty('--i', order.indexOf(ui.tab));
  }
  updateLive();
  const al = tabAlerts();
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
  const box = (anchor === undefined ? document.querySelector('.anvil-art') ?? document.getElementById('min-num') : anchor)?.getBoundingClientRect();
  if (!box) return;
  el.style.left = `${box.left + box.width / 2}px`;
  el.style.top = `${box.top + box.height / 3}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
function bump() {
  const el = document.getElementById('min-num');
  el?.classList.remove('bump'); void el?.offsetWidth; el?.classList.add('bump');
}
const gainText = (n) => { floatText(`+${fmt(n)}`, 'gain', document.getElementById('min-num')); bump(); };
function buzz(ms) { try { navigator.vibrate?.(ms); } catch { /* 진동이 없는 기기 */ } }

function showEvolution(w, label = '진화') {
  const url = weaponArtUrl(w.type, w.grade, w.level);
  ui.banner = `<div class="banner-inner evolve" style="--grade:${gradeColor(w.grade)}">
    <small>${label} · ${GRADES[w.grade]} ${WEAPONS[w.type].name}</small>
    ${url ? `<img src="${url}" alt="" width="180" height="180">` : ''}
    <strong>+${w.level}</strong><span>「${levelName(w)}」</span>${label === '승급' ? '<em>+0부터 다시 · 공격력 대폭 상승</em>' : label === '각성' ? `<em>「${AWAKEN_SKILLS[w.type].name}」 · 공격력 ×${AWAKEN_MULT} · 다시는 깨지지 않음</em>` : ''}</div>`;
  clearTimeout(showEvolution.t);
  showEvolution.t = setTimeout(() => { ui.banner = null; renderBanner(); }, 2400);
}

// ---- 행동 ----
// 깨질 수 있는 강화는 망치 세 번 → 결과. 안전한 강화는 바로.
const SUSPENSE_MS = 950;
function doEnhance() {
  const w = selectedWeapon();
  if (!w || ui.suspense) return;
  const risky = w.pity < 100 && !atCap(w) && !w.pendingTraits && destroyChance(w.level, w.type, w.grade) > 0 && s.minerals >= enhancePrice(s, w);
  if (!risky) return resolveEnhance(w);
  ui.suspense = true;
  document.body.classList.add('suspense');
  [0, 300, 600].forEach((ms, i) => setTimeout(() => {
    clang('hammer'); buzz(i === 2 ? 30 : 15);
    const a = document.querySelector('.anvil-art');
    a?.classList.remove('knock'); void a?.offsetWidth; a?.classList.add('knock');
    if (i === 2) sparks('up', '#f1b45a');
  }, ms));
  setTimeout(() => {
    ui.suspense = false;
    document.body.classList.remove('suspense');
    if (s.weapons.includes(w)) resolveEnhance(w); else render();
  }, SUSPENSE_MS);
}

function resolveEnhance(w) {
  const before = w.level;
  const r = enhance(s, w.id, Math.random, { protect: ui.useProtect });
  if (!r.ok) return toast(r.reason);
  track(s.meta, 'enhance', today());
  clang(r.result === 'destroy' ? 'destroy' : r.result.startsWith('up') ? 'up' : 'fail');
  if (r.result === 'destroy') {
    document.body.classList.remove('shake', 'crack'); void document.body.offsetWidth; document.body.classList.add('shake', 'crack');
    sparks('destroy', '#e4675a');
    floatText('파괴', 'bad'); buzz([60, 40, 120]);
    toast(`파괴! ${gradeLv(w)} ${levelName(w)}이(가) 산산조각 · 심연 조각 +${r.shards}`);
    setTimeout(() => floatText(`◆ +${r.shards}`, 'shard'), 350);
    ui.selected = null;
  } else if (r.result.startsWith('up')) {
    ui.flash = w.level >= GRADE_CAPS[w.grade] || w.grade >= 2 ? 'flash pillar' : 'flash';
    sparks(atCap(w) ? 'big' : 'up', gradeColor(w.grade) === GRADE_COLORS[0][1] ? '#f1b45a' : gradeColor(w.grade));
    floatText(r.result === 'up2' ? '+2 점프!' : '성공', 'good'); buzz(25);
    if (bandOf(w) > bandOf({ grade: w.grade, level: before }) || w.level === MAX_LEVEL) { showEvolution(w); buzz([30, 30, 60]); }
    if (w.grade === GRADES.length - 1 && (w.level === 10 || w.level === MAX_LEVEL)) setTimeout(() => offerBrag(w, `초월 +${w.level} 달성!`), 2500);
    else if (atCap(w) && w.grade < GRADES.length - 1) toast(`+${w.level} 한계 도달! ${GRADES[w.grade]} ${WEAPONS[w.type].name} 한 자루를 재료로 ${GRADES[w.grade + 1]} 승급`);
    if (w.pendingTraits) ui.modal = { kind: 'trait', id: w.id };
  } else if (r.result === 'saved') {
    ui.flash = 'dim';
    floatText('🛡 방지!', 'good'); buzz([20, 30, 20]);
    toast(`파괴 방지권 발동! 깨지는 대신 +${w.level}로 내려갔습니다 (남은 ${s.meta.protect}장)`);
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
  track(s.meta, 'boss', today());
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
      if (r.killed && boss.stage % 5 === 0) setTimeout(() => offerBrag(bestWeapon(), `${boss.stage}단계 보스 처치!`), 1500);
      toast(r.killed ? `${boss.stage}단계 ${boss.big ? '빅보스' : '보스'} 처치! DPS 구슬 +1 · +${fmt(bossReward(boss.stage))} 미네랄` : `실패… 필요 DPS ${fmt(boss.hp / FIGHT_SECONDS)}, 지금 ${fmt(r.damage / FIGHT_SECONDS)}. 아래 'DPS 올릴 거리'를 보세요`);
      if (r.heart) setTimeout(() => showMilestone(`보스의 심장 획득!<br><small>영구 DPS +${Math.round(HEART_PCT * 100)}%</small>`), 400);
      persist();
    }
    render();
  }, 200);
}

// ---- 자랑 카드: 1080×1350 그림을 직접 그려 공유한다 ----
const bestWeapon = () => [...s.weapons].sort((a, b) => b.grade - a.grade || b.level - a.level)[0] ?? null;
const loadImg = (src) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });

async function drawCard(w, title) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const color = w ? gradeColor(w.grade) : '#c9a24a';
  await document.fonts?.ready;
  const bg = g.createRadialGradient(W / 2, 560, 60, W / 2, 560, 900);
  bg.addColorStop(0, '#3a2414'); bg.addColorStop(0.55, '#140e0a'); bg.addColorStop(1, '#070504');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#c9a24a'; g.lineWidth = 4; g.strokeRect(36, 36, W - 72, H - 72);
  g.lineWidth = 1.5; g.strokeRect(52, 52, W - 104, H - 104);
  const logo = await loadImg('assets/logo.webp');
  if (logo) g.drawImage(logo, W / 2 - 260, 70, 520, 520 * logo.height / logo.width);
  const glow = g.createRadialGradient(W / 2, 640, 20, W / 2, 640, 330);
  glow.addColorStop(0, color + 'aa'); glow.addColorStop(1, 'transparent');
  g.fillStyle = glow; g.fillRect(0, 300, W, 700);
  const url = w ? weaponArtUrl(w.type, w.grade, w.level) : 'assets/building.webp';
  const im = url && await loadImg(url);
  if (im) { g.shadowColor = color; g.shadowBlur = 60; g.drawImage(im, W / 2 - 260, 380, 520, 520); g.shadowBlur = 0; }
  g.textAlign = 'center';
  g.fillStyle = color; g.font = '400 112px "Song Myung", serif';
  g.shadowColor = color; g.shadowBlur = 30;
  g.fillText(title.length > 12 ? title.slice(0, 12) : title, W / 2, 1010); g.shadowBlur = 0;
  g.fillStyle = '#eadfc8'; g.font = '800 46px "Nanum Myeongjo", serif';
  if (w) g.fillText(`${GRADES[w.grade]} ${WEAPONS[w.type].name} +${w.level} 「${levelName(w)}」`, W / 2, 1085);
  g.fillStyle = '#c9a24a'; g.font = '700 38px "Nanum Gothic Coding", monospace';
  g.fillText(`총 DPS ${fmt(battleDps(s))} · 보스 ${s.maxStage}단계 · ${s.meta.rebirths + 1}회차`, W / 2, 1160);
  g.fillStyle = '#9d907b'; g.font = '600 34px "Gothic A1", sans-serif';
  g.fillText('스타 강화하기, 그 손맛 그대로 · 심연의 대장간', W / 2, 1250);
  return c.toDataURL('image/png');
}

function offerBrag(w, title, force = false) {
  if (!force && ui.modal) return;
  ui.modal = { kind: 'brag', title, src: null };
  render();
  drawCard(w, title).then((src) => { if (ui.modal?.kind === 'brag') { ui.modal.src = src; render(); } });
}

async function shareCard() {
  const src = ui.modal?.src;
  if (!src) return;
  try {
    const blob = await (await fetch(src)).blob();
    const file = new File([blob], 'abyss-forge.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: '심연의 대장간', text: `${ui.modal.title} · 심연의 대장간` }); return; }
  } catch { /* 공유 창을 닫았거나 지원하지 않음 */ }
  saveCard();
  toast('이 화면에서는 바로 공유가 안 돼서 이미지를 저장합니다');
}

function saveCard() {
  const src = ui.modal?.src;
  if (!src) return;
  const a = document.createElement('a');
  a.href = src; a.download = 'abyss-forge.png';
  document.body.appendChild(a); a.click(); a.remove();
}

const handlers = {
  tab: (d) => { ui.tab = d.tab; window.scrollTo(0, 0); },
  select: (d) => { ui.selected = Number(d.id); if (ui.tab !== 'forge') ui.tab = 'forge'; },
  enhance: () => doEnhance(),
  buy: (d) => {
    const r = buy(s, d.type); if (!r.ok) return toast(r.reason);
    ui.selected = r.weapon.id; if (ui.modal?.kind === 'info') { ui.modal = null; ui.tab = 'forge'; }
    toast(`${WEAPONS[d.type].name} 구매 · 바로 채집을 시작합니다`);
  },
  promote: () => {
    const w = selectedWeapon();
    const r = w && promote(s, w.id);
    if (!r?.ok) return toast(r?.reason ?? '승급할 수 없습니다');
    clang('up'); buzz([30, 30, 60]); showEvolution(w, '승급');
    setTimeout(() => sparks('big', gradeColor(w.grade)), 50);
    if (w.grade >= 2) setTimeout(() => offerBrag(w, `${GRADES[w.grade]} 승급!`), 2500);
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
    tapSound(); buzz(8); bump();
  },
  'promote-all': () => {
    const r = promoteAll(s);
    if (!r.count) return toast('승급할 무기가 없습니다');
    const best = [...s.weapons].sort((a, b) => b.grade - a.grade || b.level - a.level)[0];
    ui.selected = best.id; clang('up'); buzz([30, 30, 60]); showEvolution(best, '승급');
    toast(`${r.count}번 승급! 최고 ${GRADES[best.grade]} ${WEAPONS[best.type].name}`);
    setTimeout(() => sparks('big', gradeColor(best.grade)), 50);
    if (best.grade >= 2) setTimeout(() => offerBrag(best, `${GRADES[best.grade]} 승급!`), 2500);
  },
  'open-trait': () => { const w = s.weapons.find((x) => x.pendingTraits); if (w) ui.modal = { kind: 'trait', id: w.id }; },
  trait: (d) => {
    pickTrait(s, ui.modal.id, d.key);
    toast(`특성 획득: ${TRAITS[d.key].label}`);
    const next = s.weapons.find((x) => x.pendingTraits);
    ui.modal = next ? { kind: 'trait', id: next.id } : null;
  },
  upgrade: () => {
    const r = upgradeBuilding(s);
    if (!r.ok) return toast(r.reason);
    clang('up'); sparks('big', '#6fd6c4'); buzz([20, 30, 40]);
    const ok = scratchers(s.building.tier);
    toast(`${buildingStats(s.building.tier).name} 개척! ${ok ? `${ok}자루가 캘 수 있습니다` : '아직 캘 수 있는 무기가 없어요. 더 강화하세요'}`);
    if (!ok) selectVein(s, bestVein(s));
  },
  vein: (d) => { const r = selectVein(s, Number(d.tier)); toast(r.ok ? `${buildingStats(s.building.tier).name}(으)로 이동 · 초당 +${fmt(incomePerSec(s))}` : r.reason); },
  challenge: () => startFight(),
  dps: () => {
    const before = s.bestDps; const d = measureDps(s, Date.now());
    toast(d > before ? `신기록! DPS ${fmt(d)}` : `DPS ${fmt(d)} (최고 ${fmt(s.bestDps)})`);
    if (d > before && before > 0) clang('up');
  },
  'open-rebirth': () => { ui.modal = { kind: 'rebirth' }; },
  rebirth: () => doRebirth(false),
  'rebirth-ad': () => { track(s.meta, 'ad', today()); doRebirth(true); },
  'offline-ad': () => { s.minerals += ui.modal.gain; track(s.meta, 'ad', today()); toast(`(광고 시청 완료) +${fmt(ui.modal.gain)} 더`); ui.modal = null; },
  close: () => { ui.modal = null; },
  unlock: (d) => {
    const r = unlock(s, d.type);
    if (!r.ok) return toast(r.reason);
    clang('up'); buzz([30, 30, 60]); setTimeout(() => sparks('big', '#f1d488'), 50);
    ui.modal = { kind: 'info', type: d.type, fresh: true };
  },
  perm: (d) => { const r = buyPerm(s, d.key); toast(r.ok ? `${PERMS[d.key].name} 강화` : r.reason); },
  'ad-minerals': () => { const g = Math.max(200, incomePerSec(s) * 300); s.minerals += g; gainText(g); track(s.meta, 'ad', today()); toast(`(광고 시청 완료) +${fmt(g)} 미네랄`); },
  cash: (d) => toast(`「${d.name}」은 출시 후 판매합니다`),
  upg: () => {
    const r = buyUpgrade(s);
    if (!r.ok) return toast(r.reason);
    clang('up'); buzz(15);
    floatText(`공업 Lv.${r.level}`, 'good', document.getElementById('power'));
  },
  awaken: () => {
    const w = selectedWeapon();
    const r = w && awaken(s, w.id);
    if (!r?.ok) return toast(r?.reason ?? '각성할 수 없습니다');
    clang('up'); buzz([40, 30, 40, 30, 80]); showEvolution(w, '각성');
    setTimeout(() => sparks('big', '#b68cff'), 50);
    setTimeout(() => sparks('big', '#f1d488'), 400);
    setTimeout(() => offerBrag(w, '각성!'), 2600);
    persist();
  },
  attend: () => {
    const r = attend(s.meta, today());
    if (!r.ok) return toast(r.reason);
    clang('up'); buzz([20, 30, 40]); sparks('up', '#f1d488');
    toast(`출석 ${r.streak}일째! 환생 코인 +${r.reward}`);
    if (ui.modal?.kind === 'attend') ui.modal = null;
    persist();
  },
  mission: (d) => { const r = claimMission(s.meta, d.key, today()); toast(r.ok ? `미션 보상 · 환생 코인 +${r.reward}` : r.reason); if (r.ok) { clang('up'); persist(); } },
  'craft-protect': () => { const r = craftProtect(s); toast(r.ok ? `파괴 방지권 제작! 보유 ${s.meta.protect}장` : r.reason); if (r.ok) clang('up'); },
  'fill-pity': () => { const w = selectedWeapon(); const r = w && fillPity(s, w.id); toast(r?.ok ? `천장 ${w.pity}%${w.pity >= 100 ? ' · 다음 강화 확정 성공!' : ''}` : r?.reason ?? '무기 없음'); },
  brag: () => { const w = selectedWeapon(); if (w) offerBrag(w, gradeLv(w), true); },
  'share-card': () => shareCard(),
  'save-card': () => saveCard(),
  'open-odds': () => { ui.modal = { kind: 'odds', type: 'sword', grade: 0 }; },
  odds: (d) => { ui.modal = { kind: 'odds', type: d.type, grade: Number(d.grade) }; },
  info: (d) => { ui.modal = { kind: 'info', type: d.type }; },
  'bulk-sell': () => { const r = bulkSell(s, ui.sellMax); toast(r.ok ? `${r.count}자루를 팔았습니다` : r.reason); ui.selected = null; },
};

function doRebirth(ad) {
  const c = rebirthCoins(s) * (ad ? 2 : 1);
  s = rebirth(s, { adDouble: ad });
  ui.modal = null; ui.selected = null; ui.auto = false; ui.tab = 'shop';
  toast(`${ad ? '(광고 시청 완료) ' : ''}환생 코인 ${fmt(c)}개 획득! ${s.meta.rebirths + 1}회차 시작`);
  persist();
}

// ---- 손맛: 누르면 물결·짧은 진동, 강화 버튼은 꾹 누르면 연속 강화 ----
const PRESSABLE = '.btn, .enhance-btn, .buy, .tile, .pack, .tabs button, .guide, .info-btn, .unlock, .speed';
const hold = { timer: null, repeat: null, fired: false };
function stopHold() {
  clearTimeout(hold.timer); clearInterval(hold.repeat);
  hold.timer = hold.repeat = null;
  document.body.classList.remove('holding');
}
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest(PRESSABLE);
  if (!el || el.disabled) return;
  const r = el.getBoundingClientRect();
  const rp = document.createElement('span');
  rp.className = 'ripple';
  rp.style.left = `${e.clientX - r.left}px`; rp.style.top = `${e.clientY - r.top}px`;
  el.appendChild(rp);
  setTimeout(() => rp.remove(), 550);
  buzz(5);
  if (el.dataset.act === 'enhance') {
    hold.fired = false;
    hold.timer = setTimeout(() => {
      document.body.classList.add('holding');
      hold.repeat = setInterval(() => {
        const w = selectedWeapon();
        if (ui.suspense) return;
        if (!w || ui.modal || w.pendingTraits || atCap(w) || s.minerals < enhancePrice(s, w)) return stopHold();
        hold.fired = true;
        doEnhance();
        if (!s.weapons.includes(w)) stopHold();
      }, 150);
    }, 380);
  }
});
['pointerup', 'pointercancel', 'blur'].forEach((ev) => window.addEventListener(ev, stopHold));

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (e.target.id === 'modal' && ['info', 'odds', 'brag'].includes(ui.modal?.kind)) { ui.modal = null; render(); return; }
  if (!el || el.disabled || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  if (e.target.closest('#modal') && !e.target.closest('.sheet')) return;
  if (el.dataset.act === 'enhance' && hold.fired) { hold.fired = false; return; }
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
  if (act === 'use-protect') ui.useProtect = e.target.checked;
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
  if (ui.auto) for (let i = 0; i < 3 * ui.speed; i++) if (autoStep(s, { target: ui.autoTarget }, Math.random).action === 'enhance') track(s.meta, 'enhance', today());
  if (!ui.modal && !ui.attendAsked && splash.hidden && canAttend(s.meta, today())) { ui.attendAsked = true; ui.modal = { kind: 'attend' }; render(); }
  if (seconds % 60 === 0 && fighters(s).length) measureDps(s, Date.now());
  if (seconds % 10 === 0) persist();
  const vein = document.querySelector('.tap-vein');
  if (ui.tab === 'mine' && vein && !ui.modal && incomePerSec(s) > 0) floatText(`+${fmt(incomePerSec(s) * ui.speed)}`, 'gain small', vein);
  const busy = ui.modal || ui.fight || document.activeElement?.tagName === 'SELECT';
  if (busy) renderHeader(); else render();
}, 1000);

window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); else { welcomeBack(); render(); } });
