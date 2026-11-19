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
cd /d D:\rhythm
echo ============================================================>> data\sync-local.log
echo [%date% %time%] local sync start>> data\sync-local.log
"C:\Program Files\nodejs\node.exe" scraper\src\sync.mjs --push >> data\sync-local.log 2>&1
if errorlevel 1 (
  echo [%date% %time%] exit=FAILED >> data\sync-local.log
  exit /b 1
)
rem Space before >> is REQUIRED: "exit=0>>" parses the 0 as a handle number
rem (stdin append redirect) and eats it from the echoed text.
echo [%date% %time%] exit=0 >> data\sync-local.log
exit /b 0
