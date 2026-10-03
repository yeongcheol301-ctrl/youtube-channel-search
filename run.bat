@echo off
cd /d "%~dp0"

echo [1/3] Checking for updates...
git pull origin main
if errorlevel 1 echo (Update check failed - starting with the current version)

call .venv\Scripts\activate.bat

echo [2/3] Checking packages...
pip install -q -r requirements.txt

echo [3/3] Starting app...
streamlit run app.py
