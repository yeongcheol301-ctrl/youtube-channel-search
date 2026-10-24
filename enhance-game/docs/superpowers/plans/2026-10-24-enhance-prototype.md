# 강화기 웹 시제품 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 휴대폰 브라우저에서 바로 하는 강화기 시제품 — 무기 4종 구매·강화 → 건물 부수기로 미네랄 → 보스·DPS 측정 → 환생·해금이 한 바퀴 도는지 확인한다.

**Architecture:** 게임 규칙은 DOM 없는 순수 함수 ES 모듈(`src/rules.js`, `src/state.js`)로 두고 Node 내장 테스트로 검증한다. 화면은 `index.html` + `src/ui.js` 한 쌍이 상태를 읽어 그리고, 1초 틱으로 진행한다. 빌드 도구 없음.

**Tech Stack:** HTML/CSS/바닐라 JS(ES 모듈), Node 22 `node:test`, Playwright(스크린샷 확인), 배포는 Artifact 링크.

**Spec:** [강화기 게임 기획안](https://claude.ai/artifact/Lk73MFCPXY5k5qEzKYHNE6) — 시제품 범위는 "시제품 범위와 다음 단계" 섹션.

## Global Constraints

- 시제품 무기: 검(100 미네랄, 공격력 1) · 도끼(300, 3) · 지팡이(1,000, 8) · 활(500, 2). 해금 순서 검 → 도끼 → 지팡이 → 활.
- 강화 +0~+50. 성공률 구간: +0→5 95→80%, +5→10 75→55%, +10→20 50→30%, +20→30 30→15%, +30→50 15→3% (구간 안은 직선 보간).
- 실패: +0~4 유지, +5~9 −1, +10~19 −1 & 5% 파괴, +20~29 파괴 10→20%(아니면 −1), +30~50 파괴 25→40%(아니면 −1).
- 무기 규칙: 도끼 = 파괴 없음(−1만) & 성공률 ×0.85 & 건물 피해 ×2 · 지팡이 = 강화 비용 ×2 & 성공 시 15%로 +2 & 마법(방어 무시) · 활 = 피해 ×(1 + 0.1 × 보유 활 수).
- 강화 비용 = 구매가 × 1.25^단계 (반올림). 천장: 실패마다 +10, 100이면 다음 강화 확정 성공 후 0.
- 특성: +10·+20·+30·+40 도달 시 무기 전용 풀에서 3개 제시, 1개 선택.
- 조합: 같은 등급 +10 이상 두 자루 → 등급 +1, 0강. 등급 5단계 일반·희귀·전설·히어로·초월, 기본 공격력 ×4/등급.
- 보스 유형 5종: 철갑(방어↑) · 거인(체력↑) · 마법 방벽(물리 ×0.5) · 추가타격(30초 안에 N타 이상) · 재생(초당 회복). 도전 30초.
- 환생 코인 ≈ 10 × (최고 보스 단계)^1.75 + 기록 보너스. 해금: 도끼 30 · 지팡이 100 · 활 300 코인. 영구 능력: 시작 미네랄, 건물 보상, 강화 성공률(최대 +10%p), 공격력, 구매 할인(최대 50%).
- 자동화: 환생 3회차부터 자동 구매+자동 강화, 5회차부터 일괄 판매.
- 꺼 둔 동안 보상 최대 8시간.
- 결제·광고는 가짜: 상점 버튼 → "출시 후 제공", 광고 버튼 → "(광고 시청 완료)" 후 보상 지급.
- 확률표 화면 필수. 모든 문구 한국어, 숫자는 만·억·조·경 단위 표기.
- 저장은 localStorage, 모든 읽기·쓰기 try/catch. 외부 스크립트 없음.
- 화면 기준 폭 390px, 가로 스크롤 없음. 아래 탭: 강화장 · 채집장 · 보스 · 도감 · 상점.

## Review Focus

- 미네랄이 모자랄 때 구매·강화·업그레이드 → 아무것도 바뀌지 않고 버튼이 비활성이어야 함 (Task 3 테스트 `rejects when broke`).
- 저장이 깨졌거나 localStorage가 막힘 → 새 게임으로 시작, 오류 없음 (Task 3 `load falls back`).
- 기기 시계를 되돌려 꺼 둔 시간이 음수 → 보상 0 (Task 3 `offline negative is zero`).
- 숫자 폭발(1e20 이상) → 표기가 "경" 단위로 나오고 NaN/Infinity 없음 (Task 1 `formatNumber huge`).
- 환생 직후 무기 0개 → 시작 미네랄로 검을 반드시 살 수 있어 막히지 않음 (Task 4 `rebirth never softlocks`).

---

### Task 1: 강화 규칙과 숫자 표기

**Files:**
- Create: `src/rules.js`, `tests/rules.test.mjs`, `package.json` (`{"type":"module","scripts":{"test":"node --test tests/"}}`)

**Interfaces:**
- Produces: `WEAPONS` (`{sword|axe|staff|bow: {name, price, atk, unlockCost, traitPool}}`), `successRate(level, type, bonusPct=0) -> number(0~1)`, `enhanceCost(level, type, discount=0) -> int`, `rollEnhance(weapon, rng, bonusPct=0) -> {result:'up'|'up2'|'stay'|'down'|'destroy', level}` (천장 반영, `weapon.pity` 갱신), `formatNumber(n) -> string`.

- [ ] **Step 1: 실패하는 테스트 작성** — `successRate(0,'sword')===0.95`, `successRate(5,'sword')===0.75`, `successRate(15,'sword')≈0.40`, `successRate(10,'axe')≈0.425`; `enhanceCost(0,'sword')===100`, `enhanceCost(4,'staff')===488`; rng가 항상 0.99면 `+3` 유지, `+7` → 6, 도끼 `+25` → 24(파괴 없음); rng 0.0이면 지팡이 성공 시 `up2`; pity 100이면 rng 0.99여도 `up`, 이후 pity 0; `formatNumber(12345)==='1.2만'`, `formatNumber(3.4e12)==='3.4조'`, `formatNumber huge`: `formatNumber(5e20)`에 '경' 포함·'NaN'/'Infinity' 불포함.
- [ ] **Step 2: 실행해 실패 확인** — `npm test` → FAIL (모듈 없음)
- [ ] **Step 3: 구현** — 구간 표를 배열로 두고 보간. rng는 `() => number` 주입.
- [ ] **Step 4: 통과 확인** — `npm test` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat: enhance rules and number format"`

### Task 2: 전투·채집 계산

**Files:**
- Modify: `src/rules.js`; Test: `tests/combat.test.mjs`

**Interfaces:**
- Consumes: `WEAPONS`
- Produces: `weaponAttack(weapon, ctx) -> number` (기본공격력 × 4^grade × 1.18^level × (1+atkPct+perm.atkPct)), `weaponHitsPerSec(weapon) -> number`, `bossFight(weapons, boss, ctx) -> {damage, hits, killed:boolean}` (30초 적분, 1초 단위), `BOSS_TYPES`, `makeBoss(stage) -> {stage, type, hp, armor, barrier, hitsNeeded, regenPct}` (stage로 결정적), `buildingStats(tier) -> {hp, reward}`, `mineralsPerSec(assigned, tier, ctx) -> number`.
- `ctx = {bowCount, perm, traitsOf(weapon)}`; 특성 효과 키: `atkPct, critChance, critMult, armorBreak, speedPct`.

- [ ] **Step 1: 실패하는 테스트** — 철갑 보스: 같은 공격력이면 지팡이(마법) 피해 > 검; 방깎 특성이 있으면 검 피해 증가; 마법 방벽: 검 피해가 방벽 없을 때의 절반; 추가타격: `hits < hitsNeeded`면 `killed===false`(체력을 다 깎아도); 재생: 피해가 회복보다 적으면 미처치; 도끼의 `mineralsPerSec`가 같은 공격력 검의 2배; 활 2자루일 때 한 자루 피해가 1자루일 때의 1.2/1.1배; `makeBoss(3)` 두 번 호출 결과 동일.
- [ ] **Step 2: 실패 확인** — `npm test` → FAIL
- [ ] **Step 3: 구현** — 피해/타 = max(공격력 − 남은 방어, 공격력×0.1), 마법은 방어 무시; 치명 기대값은 쓰지 말고 고정 rng 없이 `critChance×critMult` 평균 적용(결정적).
- [ ] **Step 4: 통과 확인** — `npm test` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat: combat and mining math"`

### Task 3: 게임 상태와 행동

**Files:**
- Create: `src/state.js`; Test: `tests/state.test.mjs`

**Interfaces:**
- Consumes: Task 1·2 함수
- Produces: `newGame(meta?) -> State`, 행동 `buy(s,type)`, `enhance(s,id,rng)`, `sell(s,id)`, `assign(s,id,'mine'|'battle')`, `combine(s,idA,idB)`, `pickTrait(s,id,traitKey)`, `upgradeBuilding(s)`, `tick(s, seconds)`, `applyOffline(s, nowMs) -> minerals`, `save(s, storage)`, `load(storage) -> State` — 행동은 모두 `{ok:boolean, reason?:string, ...}` 반환, 실패 시 상태 불변.
- `State = {minerals, weapons:[{id,type,grade,level,pity,traits:[],pendingTraits:null|string[],loc}], building:{tier,hpLeft}, bestDps, bestLevel, maxStage, lastSeen, meta:{coins, rebirths, unlocked:[], perm:{}, discovered:[]}}`

- [ ] **Step 1: 실패하는 테스트** — `rejects when broke`(미네랄 50에서 buy 검 → ok:false, 미네랄 50 그대로); 잠긴 무기 구매 거부; +10 도달 시 `pendingTraits.length===3`이고 선택 전 강화 거부; combine은 둘 다 +10·같은 등급일 때만, 결과 grade+1·level 0·무기 수 −1; `tick` 10초 동안 채집 무기가 건물을 부수면 미네랄 증가·`hpLeft` 재설정; `offline negative is zero`; 8시간 초과는 8시간으로 자름; `load falls back`(깨진 JSON, `getItem`이 throw하는 storage → newGame 상태); save→load 왕복 동일.
- [ ] **Step 2: 실패 확인** — `npm test` → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — `npm test` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat: game state and actions"`

### Task 4: 보스 도전·환생·해금·자동화

**Files:**
- Modify: `src/state.js`; Test: `tests/progress.test.mjs`

**Interfaces:**
- Consumes: `bossFight`, `makeBoss`
- Produces: `challengeBoss(s) -> {ok, killed, damage}` (`battle` 무기만 참여, 처치 시 `maxStage`+1·미네랄 보상), `measureDps(s) -> number` (샌드백, `bestDps` 갱신), `rebirthCoins(s) -> int`, `rebirth(s, {adDouble}) -> State`, `unlock(s,type)`, `buyPerm(s,key)`, `PERMS`, `autoStep(s, cfg, rng)` (회차 3 미만이면 no-op), `bulkSell(s, maxLevel)` (회차 5 미만 거부), `shouldHintRebirth(s, nowMs) -> boolean` (최근 10분 `bestDps` 갱신 없음).

- [ ] **Step 1: 실패하는 테스트** — `rebirthCoins` maxStage 1→10, 3→≈68, 10→≈562(±5%); `adDouble`이면 2배; 환생 후 무기·미네랄 초기화, 코인·해금·perm 유지; `rebirth never softlocks`(환생 직후 `buy(s,'sword').ok===true`); 해금 코인 부족 시 거부; 성공률 perm은 +10%p에서 더 못 삼; `autoStep`은 rebirths 2에서 아무것도 안 하고 3에서 구매/강화 수행; `bulkSell` rebirths 4 거부.
- [ ] **Step 2: 실패 확인** — `npm test` → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — `npm test` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat: boss, rebirth, unlocks, automation"`

### Task 5: 밸런스 시뮬레이션

**Files:**
- Create: `tools/simulate.mjs`; Modify: `src/rules.js` 상수만

**Interfaces:**
- Consumes: Task 3·4 전체. 단순 봇: 살 수 있으면 가장 비싼 해금 무기 구매 → 가장 싼 강화 → 절반은 채집 → 보스 처치 가능하면 도전 → 10분 정체 시 환생 → 코인은 해금 우선.

- [ ] **Step 1:** `node tools/simulate.mjs` 가 회차별 (플레이 분, 도달 단계, 코인)을 출력하게 작성
- [ ] **Step 2:** 목표 확인 — 첫 환생 20~45분, 10단계 보스 처치는 환생 4~6회차. 벗어나면 보스 체력 배수·건물 보상 배수만 조정 후 `npm test` 재통과
- [ ] **Step 3: 커밋** — `git commit -m "chore: balance simulation and tuning"`

### Task 6: 화면

**Files:**
- Create: `index.html`, `src/ui.js`, `src/sprites.js`

**Interfaces:**
- Consumes: `state.js` 공개 함수 전부, `formatNumber`
- Produces: 5개 탭 화면 + 팝업(특성 선택, 환생, 확률표, 오프라인 보상, 환생 알림), 1초 `setInterval` 틱, 10초마다 저장.

- [ ] **Step 1:** 화면 구성(기획안 "화면 구성" 표 그대로): 강화장(큰 빨간 [강화] 버튼에 비용·성공률), 채집장(건물 체력 바·업그레이드), 보스(다음 보스 유형·준비 상태판·도전·DPS 측정), 도감(무기·단계 이름·조합표), 상점(가짜 상품·확률표).
- [ ] **Step 2:** 연출 — WebAudio "깡" 소리, 성공 시 파랑→보라→황금 테두리(등급/단계), 파괴 시 흔들림, +20 이상 성공 시 큰 배너. 픽셀 그림은 문자열 배열 → canvas.
- [ ] **Step 3: 확인** — `node tools/shot.mjs`(Playwright, 390×844)로 5개 탭 스크린샷, 콘솔 오류 0, 가로 스크롤 없음, 구매→강화→채집→보스 클릭 흐름 자동 실행 통과.
- [ ] **Step 4: 커밋** — `git commit -m "feat: mobile UI"`

### Task 7: 배포

- [ ] **Step 1:** `index.html`과 `src/*.js`를 Artifact로 게시(files 맵), 휴대폰에서 열리는 링크 확인
- [ ] **Step 2:** 게임 저장소가 생기면 그 저장소에 push (지금은 저장소 생성 권한 없음)
