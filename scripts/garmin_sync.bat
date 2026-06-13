@echo off
cd /d "%~dp0.."
python scripts/garmin_enrich.py
pause
