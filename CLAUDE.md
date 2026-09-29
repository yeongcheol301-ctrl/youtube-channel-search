# CLAUDE.md

## 소통 규칙
- **모든 답변과 정리 내용은 반드시 한국어로 작성한다.** 작업 결과 요약, 안내, 단계별 설명, 오류 설명 모두 포함. (코드·명령어·파일 경로는 원문 유지)
- 결정이 필요한 질문은 직접 입력하게 하지 말고 **선택지로 제시**한다(추천 항목을 첫 번째에 "(추천)" 표시).
- 사용자는 비개발자이므로 전문 용어는 풀어서 설명하고, 사이트 클릭 작업은 화면 단위로 안내한다.

## 프로젝트 개요
- **유튜브 채널 서치**: 키워드로 구독자 대비 조회수가 높은 한국 유튜브 영상·크리에이터를 찾아 시딩(협찬 연락)에 활용하는 Streamlit 앱
- 기획·진행 현황: [PLAN.md](PLAN.md)
- 구조: `app.py`(화면), `ui.py`(카드·차트 디자인), `yt_finder/`(검색·채널 분석·연락처 추출·API 키 교체), `cli.py`(명령줄), `tests/`

## 실행 · 테스트
- 로컬 실행: `run.bat` 더블클릭 또는 `.venv\Scripts\python.exe -m streamlit run app.py`
- 테스트: `.venv\Scripts\python.exe -m pytest -q tests`
- API 키: 로컬은 `.env`(`YOUTUBE_API_KEY` / `YOUTUBE_API_KEYS`), 배포는 Streamlit Cloud Secrets. **키는 절대 커밋하지 않는다.**

## 배포
- GitHub 비공개 저장소: https://github.com/yeongcheol301-ctrl/youtube-channel-search (`main` 브랜치)
- Streamlit Community Cloud가 `main`에 push되면 자동 재배포
- 수정 흐름: 로컬 수정 → 테스트 통과 확인 → commit & push → 1~2분 뒤 반영
