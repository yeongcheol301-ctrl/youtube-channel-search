# 아파트 벽 CUT_LIST v1 (CLEAN 이미지 + Omni 영상 프롬프트)

> 기준: 자본주의해부도_기술사양_v2 (2장 이미지, 3장 영상). 대본: 아파트벽_가공본_v1.md
> 순서: **C01 이미지 먼저 → 승인 → C01을 스타일·장소 참조로 붙여 나머지 컷 생성** (컷이 따로 노는 문제 방지).
> 한 줄기 시선: **옆집과 맞닿은 거실 벽 하나** (C01 그 벽 = C02·C03·C04·C08·C14의 벽). 벽 색은 모든 컷에서 같은 연한 크림색.
> 금지(11-02 확정): 휩 팬, 흔들기, 빨간 원·화살표, 슬로모션, X-ray, 거대 숫자 카드, 음파 선, 글자.

## 공통

**이미지 기본 문장 (Flow Nano Banana 2.1, 9:16)** — 모든 컷 앞에 붙인다
```
bright clean 3D miniature diorama, soft daylight, warm pastel and cream colors, polished Blender render look, realistic everyday place shown plainly, faceless people, no signs, no letters, no logos, no license plate text, main subject in the upper-middle of the frame, lower third kept simple, vertical 9:16
```
**해부 컷 추가 문장**
```
clean cutaway section of the wall/floor revealing <대상 하나>, cut faces smooth and cream-colored
```
**영상 기본 문장 (Omni Flash 4초, 9:16, 7크레딧)** — 모든 컷 뒤에 붙인다
```
one smooth camera move, simple clear action that matches the narration, no camera shake, no whip pan, no slow motion, no x-ray, no exploded view, no laser lines, no text
```

## 컷별

| 컷 | 이미지 (기본 문장 + 아래) | 영상 움직임 (기본 문장 + 아래) |
|---|---|---|
| C01 | daytime interior of a typical Korean apartment living room, a sofa facing a TV, one plain cream-colored wall on the right side that is shared with the neighboring apartment, one person seen from behind sitting on the sofa, head turning toward that shared wall, close framing on the person and the wall | steady dolly forward toward the person on the sofa, the person turns their head toward the shared wall, starts mid-action |
| C02 | close view of the same cream-colored shared living room wall, one faceless hand tapping the wall surface with two fingers | steady dolly forward to the wall, the fingers tap the wall twice |
| C03 | the same shared wall at floor level, a small contained flame on a metal tray on the floor in front of the wall, the wall clean and undamaged, no smoke stains, no people | gentle tracking along the base of the wall, the small flame flickers close to the wall and the wall stays clean and unchanged |
| C04 | the same shared wall, a faceless plasterer's hand holding a steel trowel spreading a thin even layer of grey plaster on the wall, a small plaster board nearby | steady dolly forward as the trowel spreads one smooth stroke of grey plaster across the wall |
| C05 | a bright miniature model of two Korean apartment units side by side sharing one wall, with the units above and below also visible, cut open like a dollhouse from the front | slow drone descent onto the two side-by-side apartment units |
| C06 | the same dollhouse apartment model, clean cutaway section of the floor revealing a thick concrete slab with a thin cushioning layer on top, cut faces smooth and cream-colored, close framing on the floor section | steady dolly forward to the cut floor, the thick concrete slab becomes clear |
| C07 | an empty new apartment room with bare floor, a faceless inspector standing over a small round impact ball device placed on the floor, in the room below a microphone on a tripod, both rooms visible in a clean section view | the inspector drops the round ball onto the floor, it bounces once, the microphone below stays still, camera holds steady |
| C08 | the shared living room wall from C01, clean cutaway section of the wall revealing a single plain layer of concrete, cut faces smooth and cream-colored, nothing placed in front of the wall, no equipment | steady dolly forward to the cut wall, the plain single concrete layer becomes clear |
| C09 | two neighboring living rooms side by side separated by the same shared wall, on the left a faceless person walking across the room, on the right a faceless person on the sofa looking toward the wall | gentle tracking from the left room to the right room across the shared wall, the left person walks, the right person looks at the wall |
| C10 | the same two living rooms, now seen as part of a larger dollhouse section with the apartments above, below and beside all visible | steady camera pulling back slowly from the two rooms until the units above, below and beside fill the frame |
| C11 | a cross-section model of one Korean apartment building with no columns and no beams, thick walls stacked floor upon floor carrying the floors above, cut faces smooth and cream-colored | slow drone descent along the stacked walls from the top floor to the ground floor |
| C12 | the same apartment building section, a ball dropping onto the floor of one middle unit, picture frames hanging on the walls of the units above, below and beside | the ball hits the floor, then the picture frames in the neighboring units tilt slightly one after another, camera holds steady |
| C13 | a large Korean apartment complex of many identical white wall-structure apartment towers in rows, bright daylight, seen from above | slow drone descent over the rows of identical apartment towers |
| C14 | the C01 living room again, the same person on the sofa leaning back, the shared cream-colored wall in calm afternoon light | steady dolly forward toward the shared wall as the person leans back into the sofa |

## 크레딧
- 이미지: Flow (Google AI Pro 계정, 크레딧 별도 소모 없음 가정 — 계정 화면에서 확인)
- 영상: Omni 14클립 × 7 = **98크레딧**
- 새 연출(벽 해부 C08, 불 장면 C03, 진동 장면 C12)은 **3컷 시험(21크레딧) 먼저**: C01, C03, C08
- C03 불 장면이 "화재"처럼 보이면 대안 프롬프트: `the shared wall shown as a clean section of solid grey fire-resistant concrete, cut faces smooth and cream-colored` (불 없이)
