# 심연의 대장간 (강화기 웹 시제품)

유튜브 채널 서치와는 별개인 게임 시제품입니다. 게임 전용 저장소가 생기면 이 폴더를 옮깁니다.

- 기획안: https://claude.ai/artifact/Lk73MFCPXY5k5qEzKYHNE6
- 플레이 링크: https://claude.ai/artifact/2JdDzdRGutpKGFDnXcPQCt
- 테스트: `cd enhance-game && npm test`
- 밸런스 시뮬레이션: `node tools/simulate.mjs [seed]`
- 화면 확인: 이 폴더에서 `python3 -m http.server 8123` 후 `node tools/shot.mjs http://localhost:8123/`
