# 마석도 다음 날 CUT_LIST v1 (CLEAN 이미지 + Omni 영상 프롬프트)

> 기준: 현실판정소_기술사양_v3 (2장 이미지, 3장 영상). 대본: 마석도다음날_가공본_v1.md
> 순서: **C01·C02 CLEAN 2~3안 → 대표님 확정 → 확정 더미·손을 참조로 붙여 나머지 생성** (붕대 연속성 유지).
> 금지(11-02 확정): 휩 팬, 계속 흔들림, 빨간 원·화살표, 슬로모션, 큰 숫자 카드, AI가 그린 글자, 피. 투시 컷은 C08·C11 두 개만. 프롬프트에 movie/film 단어 금지. 배우 얼굴·체형·의상 재현 금지.
> 파일명: `01_S01_CLEAN_<짧은설명>.jpg` (기술사양 2장).

## 공통

**더미 고정 문장 (모든 컷)**
```
the same matte grey faceless mannequin, visible joints, no markings, no face
```

**이미지 금지 문장 (모든 컷 끝)**
```
main subject between 15% and 60% of frame height, lower band around 65-72% of frame height kept plain and simple, no blood, no wounds shown, no text, no letters, no numbers, no symbols, no arrows, no leader lines, no UI, no subtitles, no logos, no watermark, no excessive neon, vertical 9:16
```

**톤 A: 장면 재현 (컬러)** — C01, C02, C03, C13, C16
```
color cinematic scene, warm side key light and a soft rim light from behind, bright enough to read on a phone
```

**톤 B: 현실 분석 (클레이)** — C04~C12, C14, C15
```
matte dark charcoal and mid-grey untextured clay render, soft studio side light with rim light, only white bandages and the stated accent color stand out, bright enough to read on a phone
```

**투시 추가 문장 (C08, C11만)**
```
the hand turns semi-translucent like frosted glass and only the named hand bone glows soft orange from inside, clean and clinical, no blood
```

**영상 필수 문장 (모든 컷 끝, Omni Flash 4초, 9:16, 7크레딧)**
```
One camera move only, 5 to 15 degrees. No whip pan, no camera shake, no camera roll, no slow motion, no 360 rotation, no shape melting, no duplicated objects. No text, no letters, no numbers, no labels, no arrows, no infographic overlays, no UI. The first frame must already be moving.
```

## 붕대 연속성 표 (CLEAN마다 이 상태로)

| 컷 | 오른손 상태 |
|---|---|
| C01·C03·C13 | 맨손 (싸우는 밤) |
| C04·C05 | 맨손, 마디가 부음 |
| C06 | + 마디 흰 붕대 |
| C07 | + 손목·손등 8자 탄력 붕대 |
| C08 | (투시 컷: 붕대 없이 반투명 손. 회상처럼 처리) |
| C09~C12 | + 새끼손가락 쪽 깁스(부목) + 가운데 마디 작은 반창고 (C12에서 처음 강조) |
| C15·C16·C02 | 위 전부 + 부목 위에 올려 둠 |

## 컷별

| 컷 | 초 | 이미지 (톤 + 더미 문장 + 아래 + 금지 문장) | 영상 움직임 (아래 + 필수 문장) |
|---|---|---|---|
| C01 | 1.6 | [톤 A] dim narrow back corridor of an old building at night, the mannequin's bare right fist is just landing on the jaw of a second identical grey mannequin, the second mannequin already tilting sideways, fist and jaw contact large in the upper-middle of the frame | starts mid-action, the fist connects within the first 0.3 seconds and the second mannequin topples sideways out of frame, a single short punch-in at the moment of impact then hold |
| C02 | 1.8 | [톤 A] next morning, close view of the mannequin's right hand resting on a white bed sheet in soft morning window light, knuckles wrapped in white bandage, elastic bandage around the wrist, a splint cast along the little-finger side, a small adhesive bandage on the middle knuckle | starts mid-action, the fingers try to curl into a fist, stop halfway and tremble slightly, camera holds with a gentle 5 degree drift |
| C03 | 3.7 | [톤 A] the same dim corridor, wider view, the mannequin stepping forward while three identical grey mannequins rush at it, one already falling | the mannequin advances and knocks down the attackers one after another with single punches, each falls cleanly, gentle tracking backward in front of the mannequin |
| C04 | 2.2 | [톤 B] simple clay bedroom, the mannequin sitting on the edge of a bed, both bare hands raised in front of its blank face, knuckles slightly puffy | the mannequin slowly raises both hands and turns them over to look at the knuckles, steady dolly forward |
| C05 | 2.6 | [톤 B] large close-up of the mannequin's right hand, the knuckles visibly swollen and rounded | the fingers try to close into a fist but stop short, unable to fully close, camera holds steady |
| C06 | 3.2 | [톤 B] same close-up hand, a clean white bandage wrapping across the knuckles | the white bandage winds around the knuckles turn by turn, gentle orbit of 10 degrees |
| C07 | 3.5 | [톤 B] same hand with knuckle bandage, wrist and back of hand in view, an elastic bandage starting a figure-eight around the wrist and back of the hand | the wrist wobbles loosely once, then the elastic bandage wraps in a figure-eight around the wrist and back of the hand, camera holds steady |
| C08 | 4.9 (0.85배) | [톤 B + 투시] the mannequin's bare fist striking a plain clay head model from the side, at contact the hand is semi-translucent and only the little-finger metacarpal bone glows soft orange, its end near the knuckle bent toward the palm | starts mid-action, the fist meets the clay head within the first 0.5 seconds, the hand turns translucent and the orange little-finger metacarpal bends at its neck, camera holds steady with a slight 5 degree drift |
| C09 | 3.2 | [톤 B] the same right hand (knuckle bandage, wrist wrap) receiving a white splint cast along the little-finger edge of the hand | the white splint cast forms and wraps along the little-finger side, gentle dolly back to show the whole hand |
| C10 | 2.8 | [톤 B] medium view, the mannequin with the casted right hand swinging its open left palm sideways toward the cheek of a plain clay target mannequin | the open palm swings sideways toward the target cheek and stops at contact, gentle tracking from the side |
| C11 | 4.9 (0.85배) | [톤 B + 투시] clean clay laboratory bench, two isolated clay forearms mounted on test rigs side by side: left one a tight fist, right one an open palm turned sideways, both facing identical round pads, both hands semi-translucent | the left fist strikes its pad hard and the right open palm strikes its pad more gently, yet the hand bones in both glow the same soft orange and flex the same amount, slow 10 degree lateral move |
| C12 | 3.5 | [톤 B] the bandaged and casted right hand on a clay table, a tiny adhesive bandage on the middle knuckle as the clearest detail | steady dolly forward from the whole hand to the tiny adhesive bandage on the middle knuckle |
| C13 | 2.5 | [톤 A] night corridor flashback, close side view of the bare fist grazing past a simple clay tooth row in front of a faceless mannequin's lower jaw, no blood, only a shallow scuff line on the knuckle | starts mid-action, the fist grazes past the clay tooth row and continues forward, camera holds steady |
| C14 | 3.7 | [톤 B] clean cutaway section of a single knuckle joint in clay, the joint space and bone ends visible, a tiny surface opening above, small pale lime-green specks gathered at the opening | the pale lime-green specks slip through the tiny opening and drift deep into the joint space toward the bone, steady dolly forward |
| C15 | 4.0 | [톤 B] simple clay hospital room, the patient mannequin in bed with the right hand resting raised on a splint, an IV line, a faceless clay doctor figure examining the hand while it is held closed in a fist | the doctor gently holds the patient's fist closed and leans in to look at the knuckle, gentle orbit of 10 degrees |
| C16 | 4.4 + 도장 1.5 | [톤 A] the C02 morning bed again, the mannequin sitting up, fully bandaged and casted right hand with splint and the small adhesive bandage | the mannequin slowly lowers the bandaged hand onto the pillow and stays still, camera holds steady; final second warm amber verdict light added in edit, stamp added in edit |

## 편집에서 넣을 것 (AI 생성 금지)

- C01~C02 첫 자막: 제목 문장 전체 한 번에(인수인계 4-1). 숫자 "수십"만 포인트 색.
- C03 장면 소개 라벨 `{\an5\pos(540,420)}` "범죄도시 · 마석도".
- C09 라벨 "손 골절의 10%" (숫자 금색 &H0047C5F5).
- C11 라벨 "같은 휨 = 주먹 힘의 절반" / 왼쪽 위 작은 출처 "Horns 외 2015" (선택).
- C16 도장 "판정: 반만 가능" + 체크리스트 ✓ 한 방에 쓰러뜨리기 / × 다음 날 주먹 쥐기 (STAMP_RECIPE). 도장 뒤 1초 안에 끝.

## 크레딧

- 이미지: Flow Nano Banana 2.1 (yeongcheol301 계정). 16컷 + 첫 씬 대안 2~3장.
- 영상: Omni **16클립 × 7 = 112크레딧**.
- 새 연출 시험 먼저: **C01(첫 충격) · C08(투시 골절) · C11(실험대 비교) = 21크레딧.** C11이 두 손 동시 연출이라 실패 위험이 가장 큼 → 실패하면 C11을 두 컷(주먹 / 손바닥, 각 2.4초)으로 나누지 말고 Ken Burns(0크레딧) + 라벨로 대체 검토.
- 정책 거절 대비: C01·C03·C13(타격 장면)이 거절되면 "punch/strike" 표현을 빼고 "the fist reaches the jaw and the mannequin tips over"처럼 결과(넘어짐) 위주로 다시 쓴다. 그래도 거절되면 Ken Burns(첫 3초 제외).
