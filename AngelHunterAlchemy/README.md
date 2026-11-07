# 뒷골목 연금술사 - 천사 사냥꾼 (1단계 프로토타입)

`Assets/Scripts` 폴더의 스크립트 3개를 Unity 2D 프로젝트의 `Assets/Scripts` 폴더에 그대로 복사하면 됩니다.

| 파일 | 역할 |
|---|---|
| `AlchemyGameMaster.cs` | 마스터 스크립트. Canvas·버튼·게이지·가마솥·카메라·EventSystem을 코드로 자동 생성하고 게임 루프(타이밍 연성 → Stop or Go → 폭발 위기/광고 부활)를 진행 |
| `LocalizationManager.cs` | KR/EN/JP/TW 4개 국어 텍스트 표. `GetText("KEY")`로만 문장을 가져옴 |
| `TapArea.cs` | 화면 전체 터치 영역(누르는 순간 판정) |

- Play를 누르면 씬에 아무것도 없어도 마스터가 자동 생성됩니다(빈 오브젝트에 직접 넣어도 됨, 중복 생성 안 됨).
- 골드·언어 설정은 PlayerPrefs에 저장됩니다.
- 밸런스 숫자(속도·구간 폭·배수)는 `AlchemyGameMaster.cs` 맨 위 "밸런스 값"에서 조절합니다.
- 실제 광고 SDK는 `OnWatchAd()`의 TODO 위치에 연결하면 됩니다.
