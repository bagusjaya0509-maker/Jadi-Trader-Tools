@echo off
setlocal enabledelayedexpansion
title Pekerja Mata Lokal - Jadi Trader
cd /d "%~dp0"

echo ============================================================
echo   PEKERJA MATA LOKAL - Hermes membaca chart di PC ini
echo ============================================================
echo.

REM ── 1. Rahasia ────────────────────────────────────────────────
REM Diambil langsung dari .env VPS lalu ditulis ke berkas di
REM sebelah skrip ini. Tokennya TIDAK pernah dicetak ke layar --
REM yang tampil cuma "berhasil" atau "gagal".
if exist "mata-lokal.env" (
  echo [1/3] Token sudah ada. Lewati.
) else (
  echo [1/3] Mengambil token dari VPS...
  set "KUNCI=%USERPROFILE%\.ssh\id_jaditrader_deploy"
  if not exist "!KUNCI!" (
    echo.
    echo   GAGAL: kunci SSH tidak ketemu di !KUNCI!
    echo   Itu kunci yang sama yang dipakai untuk deploy.
    goto :selesai
  )
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$b = ssh -i '%USERPROFILE%\.ssh\id_jaditrader_deploy' -o StrictHostKeyChecking=no root@103.253.145.38 \"grep -m1 '^APP_TOKEN=' /root/binance-trading-backend/.env\";" ^
    "if (-not $b) { exit 1 };" ^
    "$t = $b -replace '^APP_TOKEN=', '';" ^
    "if ($t.Length -lt 8) { exit 2 };" ^
    "Set-Content -Path 'mata-lokal.env' -Value ('JT_APP_TOKEN=' + $t) -Encoding ascii;" ^
    "Write-Host ('      token tersimpan (' + $t.Length + ' karakter)')"
  if errorlevel 1 (
    echo.
    echo   GAGAL mengambil token. Periksa sambungan ke VPS.
    goto :selesai
  )
)
echo.

REM ── 2. Ollama ─────────────────────────────────────────────────
REM Model penglihatan hidup di sini. Kalau belum jalan, dinyalakan
REM di jendela terpisah supaya jendela ini tetap untuk pekerjanya.
echo [2/3] Memeriksa Ollama...
tasklist /FI "IMAGENAME eq ollama.exe" 2>nul | find /I "ollama.exe" >nul
if errorlevel 1 (
  echo       belum jalan - dinyalakan di jendela sendiri
  start "Ollama" /MIN "%USERPROFILE%\AppData\Local\Programs\Ollama\ollama.exe" serve
  timeout /t 6 /nobreak >nul
) else (
  echo       sudah jalan
)
echo.

REM ── 3. Pekerjanya ─────────────────────────────────────────────
echo [3/3] Menjalankan pekerja. Tutup jendela ini untuk menghentikannya.
echo.
node "%~dp0mata-lokal.mjs"

:selesai
echo.
echo ============================================================
pause
