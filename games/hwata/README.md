# 화타의 약초 일기 — 시제품 1 (마을 뒷들)

낮에는 마을 뒷들에서 약초·동물을 채집하고, 밤에는 그 재료로 약을 지어 한의원을 운영하는 횡스크롤 웹게임 시제품입니다. 기획은 Claude Docs 「명의 화타 추리 게임 기획안」의 「시제품 1: 마을 뒷들」 탭을 따릅니다.

- `src/data.js` 재료·약·환자·강화 숫자
- `src/rules.js` 게임 규칙(화면 없음)
- `src/world.js` 지도(240×50 블록), 날마다 생기는 약초·뿌리
- `src/quests.js` 낮 퀘스트 3개(나무꾼, 우는 아이, 장비)
- `src/sprites.js` 도트 그림·아이콘
- `src/light.js` 테라리아식 빛(땅속 어둠)
- `src/audio.js` 효과음(파일 없이 합성)
- `src/game.js` 화면·조작·낮/밤 흐름
- `tests/` 규칙·지도·퀘스트 테스트

## 실행

```
cd games/hwata
python -m http.server 8000   # 브라우저에서 http://localhost:8000
npm test                     # 테스트
```

주소 끝에 `?debug`를 붙이면 개발자 도구에서 `window.__hwata`로 상태를 볼 수 있습니다.
