# SDD ledger — plan: /tmp/claude-0/-home-user-youtube-channel-search/42b44b79-6985-5489-91d2-1cea71f74f78/scratchpad/enhance-game/docs/superpowers/plans/2026-10-24-enhance-prototype.md
Spec: https://claude.ai/artifact/Lk73MFCPXY5k5qEzKYHNE6 (Claude Docs, read in conversation)
Pre-flight: T1->T2 WEAPONS shape (price, atk) consistent; T2->T3 ctx {bowCount, perm, traitsOf} used by state; T3->T4 State.meta {coins,rebirths,unlocked,perm} consistent; T4->T5 rebirth/challengeBoss used by sim; T3/T4->T6 UI consumes all. No conflicts.
Ruling: pre-flight — plan sentence "critChance×critMult 평균 적용" read as expected multiplier 1+critChance×(critMult-1) — keeps damage deterministic — cost if wrong: crit slightly under/over-weighted.
Task 1: Ruling: plan test value enhanceCost(4,'staff')===488 is arithmetic typo — 1000×1.25^4×2 = 4883, used 4883 — cost if wrong: none
Task 1: Ruling: `node --test tests/` fails on Node 22 (directory not module) — script uses tests/*.test.mjs — cost if wrong: none
Task 1: Ruling: pity resets on any success, not only on guaranteed success — standard pity behavior — cost if wrong: pity slightly weaker
Task 1: Ruling: +50 returns {result:'max'}; formatNumber(Infinity) returns '측정 불가' — spec silent — cost if wrong: copy change
Task 1: complete (commits 6208bd7..28b43e5, tests: npm test → # duration_ms 222.43662)
Task 2: Ruling: ctx.traitsOf dropped — traits live on weapon.traits — cost if wrong: none
Task 2: Ruling: axe "2x minerals" tested as building damage 2x (buildingDps); minerals use cycle = max(hp/dps,1)+0.5s so upgrading buildings pays only when strong — spec says higher tier = more hp + more reward — cost if wrong: tuning
Task 2: Ruling: 방깎 is party-wide sum (원랜디식 합계) and axe has innate 3+level/5 armor break; base speeds sword1/axe0.8/staff0.7/bow1.4; boss types become two from stage 6 — spec "단계가 오르면 특징 두 개" — cost if wrong: tuning
Task 2: complete (commits 28b43e5..eb26a1e, tests: npm test → # duration_ms 145.573647)
Task 3: Ruling: start minerals 150 (+300 per 시작 미네랄 perm); enhance cost ×2^grade; sell = 50% price ×1.25^level ×4^grade; building upgrade cost = next reward ×30; combined weapon keeps first weapon's type, traits reset — spec gives no numbers — cost if wrong: tuning in Task 5
Task 3: Ruling: State adds nextId, building.{hp,t}, bestDpsAt for later tasks — cost if wrong: none
Task 3: complete (commits eb26a1e..d7d38cb, tests: npm test → # duration_ms 125.51939)
Task 4: Ruling: progress functions live in new src/progress.js instead of state.js — keeps files focused, avoids cycle — cost if wrong: one import path
Task 4: Ruling: boss reward 60×2.4^(stage-1); perm cost 10×1.6^lv; discount perm also applies to enhance cost; unlock must follow order — cost if wrong: tuning
Task 4: Ruling: test 'unlock' set minerals before buying axe (test setup bug: start minerals 150 < 300) — cost if wrong: none
Task 4: complete (commits d7d38cb..63789af, tests: npm test → # duration_ms 161.631716)
Task 5: Ruling: new weapons start in 'mine' (was 'battle') — sim found a fresh game earns 0 minerals (softlock); test added RED→GREEN — cost if wrong: none
Task 5: Ruling: tuning beyond "boss hp & building reward only": ATK_GROWTH 1.18→1.25, GRADE_MULT 4→20 (combine was a downgrade; test added), building hp 20→5 reward 10→40, upgrade cost ×30→×10, multihit 40·s^1.3→15·s^1.1, boss hpGrowth 2.6→6, perms atk/reward compound ×1.25 (test added), perm cost growth 1.6→1.45 — plan's limit could not reach targets — cost if wrong: retune numbers
Task 5: Ruling: first rebirth lands at 60–80 bot-minutes vs target 20–45; stage 10 at rebirth 5–6 (target 4–6 met) — bot waits 10 idle min before rebirthing; humans likely rebirth earlier — cost if wrong: first session feels long, retune after friend test
Task 5: complete (commits 63789af..5419ba7, tests: npm test → # duration_ms 181.819941)
Task 6: Ruling: view re-renders only when its HTML changes, live bars patched in place — full 1s re-render swallowed taps (found by Playwright) — cost if wrong: none
Task 6: Ruling: added on-screen warning when no weapon is mining (income 0) — sending the only sword to battle stalls a fresh game — cost if wrong: none
Task 6: Ruling: game name 「심연의 대장간」 (placeholder); boss fight result computed instantly then animated 2.4s; level-band names 7 per weapon — spec silent — cost if wrong: copy change
Task 6: verification: node tools/shot.mjs (390×844): buy→enhance×20→toggle→5 tabs→boss challenge→odds modal; errors [] overflow false
Task 6: complete (commits 5419ba7..8d5b77d, tests: npm test → # duration_ms 187.004475)
Task 7: published https://claude.ai/artifact/2JdDzdRGutpKGFDnXcPQCt; repo push pending (no repo-create permission)
Final review: self-review (no subagent dispatch without user request) — checked trait/auto/rebirth/offline/save paths; no Critical/Important found
Final: minor (deferred): background tab ticks are skipped and offline reward covers the gap, so a tab hidden <1s earns nothing extra (negligible)
Final: minor (deferred): no hot-reload snapshot; state survives republish via localStorage saved every 10s
