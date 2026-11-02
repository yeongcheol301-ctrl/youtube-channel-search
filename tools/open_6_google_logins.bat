@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

rem ===== 영상 제작용 구글 계정 6개 로그인 창 열기 =====
rem 각 창은 서로 다른 크롬 프로필(별도 폴더)을 써서 로그인이 섞이지 않고,
rem 한 번 로그인하면 다음에 실행할 때도 로그인 상태가 유지됩니다.

rem 1) 크롬 위치 찾기
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo [오류] 크롬을 찾지 못했습니다. 크롬을 설치한 뒤 다시 실행해 주세요.
  pause
  exit /b 1
)

rem 2) 프로필 저장 폴더
set "BASE=%LocalAppData%\VideoAccounts"
if not exist "%BASE%" mkdir "%BASE%"

rem 3) 로그인 후 이동할 곳: 유튜브 스튜디오
set "LOGIN_URL=https://accounts.google.com/ServiceLogin?continue=https://studio.youtube.com/"

rem 4) 화면을 3칸 x 2줄로 나눠 창 배치 (1920x1080 기준)
set W=640
set H=520

for /L %%i in (1,1,6) do (
  set /a "COL=(%%i-1) %% 3"
  set /a "ROW=(%%i-1) / 3"
  set /a "X=!COL! * %W%"
  set /a "Y=!ROW! * %H%"
  echo 계정 %%i 창 여는 중...
  start "" "%CHROME%" --user-data-dir="%BASE%\account%%i" --no-first-run --no-default-browser-check --new-window --window-position=!X!,!Y! --window-size=%W%,%H% "%LOGIN_URL%"
  timeout /t 1 >nul
)

echo.
echo 6개 창을 열었습니다. 각 창에서 계정 하나씩 구글 로그인해 주세요.
echo (프로필 폴더: %BASE%\account1 ~ account6)
timeout /t 5 >nul
