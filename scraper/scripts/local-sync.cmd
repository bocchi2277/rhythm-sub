@echo off
rem ============================================================
rem Rhythm-Sub local sync wrapper (scheduled task action).
rem Runs from THIS PC's residential IP, which the source site's
rem Cloudflare trusts — datacenter/runner IPs get "Just a moment"
rem challenges, home IPs do not (probed 2026-11-19).
rem
rem From a residential IP a fresh wp-login also works, so this path
rem does NOT depend on the 14-day RHYTHM_COOKIE at all: ensureSession
rem re-logs-in with scraper/.env credentials whenever the cached
rem session dies.
rem
rem Log: D:\rhythm\data\sync-local.log (gitignored via data/*.log)
rem Register/unregister: register-local-sync.ps1 next to this file.
rem ============================================================
cd /d "%~dp0../.."
rem Single redirected block: one open handle for the whole run avoids
rem Windows sharing-violation errors between separate echo appends.
rem (Also: a digit right before >> is a handle number - keep the space.)
(
  echo ============================================================
  echo [%date% %time%] local sync start
  "C:\Program Files\nodejs\node.exe" scraper\src\sync.mjs --push
  if errorlevel 1 (
    echo [%date% %time%] exit=FAILED
    exit /b 1
  )
  echo [%date% %time%] exit=0
) >> data\sync-local.log 2>&1
exit /b 0
