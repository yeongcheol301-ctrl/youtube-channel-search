---
name: engineering-shorts-production
description: Use when producing or resuming a vertical (9:16) engineering explainer short — architecture, civil, mechanical, aerospace, military engineering, fluid dynamics, structures, thermodynamics, pressure systems — including its script, CLEAN/INFO keyframe prompts, 4-second image-to-video clip prompts, asset review and ordering, TTS-synced edit, or YouTube title/description. 공학 쇼츠, 엔지니어링 숏폼, 클린/인포 키프레임 제작 요청 시.
---

# 공학 쇼츠 제작 시스템 (Engineering Shorts Production)

## Overview

세로형 공학 해설 쇼츠를 **SCRIPT → CLEAN → INFO → VIDEO** 순서로 만드는 단계별 작업 규격이다.
핵심은 **반복 가능성**: 승인·완료된 단계는 사용자가 명시적으로 수정을 요청하지 않는 한 다시 만들지 않는다.

**전체 규격(단계별 프롬프트 원문 포함):** `references/PRODUCTION_SPEC.md` — 작업을 시작하기 전에, 그리고 각 단계에 들어갈 때 해당 섹션을 반드시 읽는다. 원문은 Codex용으로 작성되었으나 "Codex"는 "작업 에이전트(Claude)"로 읽으면 된다.

## 시작할 때 (매번)

1. 프로젝트 폴더에 `manifests/PROJECT_STATUS.md`가 있으면 먼저 읽고, 실제 폴더·매니페스트와 대조해 **마지막으로 검증된 단계**를 확인한다.
2. 없으면 새 프로젝트: 주제, 목표 길이, 프로젝트 폴더, 시각화할 주요 현상(공기/물/흙/열/압력/하중/진동/에너지), 이미지·영상 플랫폼을 선택지로 확인한다.
3. 요청된 **다음 단계 하나만** 수행하고, 승인 게이트에서 멈춘다.

## 단계 지도 (규격 섹션)

| # | 단계 | 산출물 | 규격 |
|---|------|--------|------|
| 1 | 리서치 + 대본 (핵심 4문장 → 제작용 대본 + TTS 대본) | `script/APPROVED_NARRATION_KR.md` | B, C |
| 2 | 장면 지도 · 키프레임 수 (실제 TTS 길이 기준) | `manifests/IMAGE_SEQUENCE.md` | D |
| 3 | CLEAN 키프레임 프롬프트 (텍스트·숫자·화살표 없음) | `prompts/CLEAN_KEYFRAME_PROMPTS.md` | E |
| 4 | CLEAN 결과 검수 · 순서 정렬 | 파일명 접두 정렬 | F |
| 5 | INFO 2차 편집 프롬프트 (CLEAN을 편집, 새로 생성 X) | `prompts/INFOGRAPHIC_KEYFRAME_PROMPTS.md` | G |
| 6 | CLEAN–INFO 1:1 검수 | 결함 ID 목록 | H |
| 7 | CLEAN→INFO 4초 영상 프롬프트 | `prompts/VIDEO_GENERATION_PROMPTS.md` | I |
| 8 | MP4 검수 · 순서 정렬 | 01_, 02_ … 접두 | J |
| 9 | 최종 편집 가이드 (TTS 맞춤 컷 길이) | — | K |
| 10 | 유튜브 제목·설명 | 추천 1 + 대안 3 | L |

각 단계가 끝나면 결과를 MD 파일로 저장하고, 같은 내용을 대화에 복사 가능한 코드 블록으로도 제공한 뒤, `manifests/PROJECT_STATUS.md`를 갱신한다(규격 P).

## 절대 규칙 (속도를 위해 희생 금지)

- **승인 게이트**: 다음 단계로 넘어가기 전 사용자 승인. 사용자가 "전체 진행"이나 "테스트 생략"을 명시한 경우만 예외.
- **ID 일관성**: `S01A` / `KF-01A` / `CLIP01`, 파일명 `01_S01A_KF-01A_CLEAN_설명` — CLEAN·INFO·MP4가 같은 ID로 1:1 대응.
- **눈으로 확인**: 순서·중복은 파일명이나 생성 시간만 믿지 말고 실제 이미지/대표 프레임으로 판정. 볼 수 없으면 추측하지 말고 컨택트 시트를 요청.
- **부분 수정**: 결함이 있는 ID만 재생성. 전체 재생성 요청 금지.
- **파일 안전**: 지정된 프로젝트 폴더 안에서만 작업, 원본 덮어쓰기 금지, 삭제는 근거 설명 후 승인받고.
- **사실 정확성**: 검증된 수치·단위만 사용. 확정 사실 / 논쟁 있는 해석 / 설명용 단순화를 구분. 가짜 정밀도 금지.
- **영상 방향**: CLEAN이 첫 프레임, INFO는 최종 목표 상태. INFO를 첫 프레임으로 쓰거나 평면 판처럼 움직이지 않는다.

## 자주 하는 실수

| 실수 | 바로잡기 |
|------|----------|
| 대본 승인 전에 장면·이미지 프롬프트까지 작성 | 대본에서 멈춘다 |
| 예상 대본 길이로 장면 수 계산 | 실제 TTS 길이를 받아서 계산 |
| 카메라 각도만 다른 장면 추가 | 물리 상태·하중 경로·단면 등 의미 있는 변화일 때만 새 장면 |
| CLEAN에 화살표·라벨이 섞임 | CLEAN 금지 요소 목록(규격 E) 적용 |
| INFO에 큰 제목·문장형 헤딩 | 장면당 작은 라벨 1~3개 + 핵심 수치 0~1개 |
| 모든 그래픽이 동시에 페이드인 | 앵커 → 선 → 화살표 몸통 → 화살촉 → 숫자 → 라벨 → 펄스 순서 |
| 완료된 단계를 다시 생성 | PROJECT_STATUS와 실제 파일을 확인하고 이어서 진행 |
