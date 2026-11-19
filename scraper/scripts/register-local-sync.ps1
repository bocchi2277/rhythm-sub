# Registers (or removes) the "Rhythm-Sub Local Sync" scheduled task.
#
# Usage (from any shell):
#   powershell -ExecutionPolicy Bypass -File register-local-sync.ps1
#   powershell -ExecutionPolicy Bypass -File register-local-sync.ps1 -Unregister
#
# Design:
# - Every 6 hours (00:15 / 06:15 / 12:15 / 18:15), matching the effective
#   GitHub cron cadence (4-6 runs/day) the cloud pipeline actually had.
# - StartWhenAvailable: if the PC was off/asleep at a scheduled time, the
#   sync runs as soon as it is back — no wake timers, no missed days.
# - Interactive principal, RunLevel Limited: no stored password, no admin;
#   runs while the user is logged on (a personal PC that is usually on).
# - ExecutionTimeLimit 2h + IgnoreNew: a hung run cannot stack up copies.
param([switch]$Unregister)

$TaskName = 'Rhythm-Sub Local Sync'
$Cmd = Join-Path $PSScriptRoot 'local-sync.cmd'

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed scheduled task: $TaskName"
    return
}

if (-not (Test-Path $Cmd)) { throw "local-sync.cmd not found next to this script: $Cmd" }

$Action = New-ScheduledTaskAction -Execute $Cmd -WorkingDirectory 'D:\rhythm'

# Daily trigger with an indefinite 6-hour repetition (10 years ~ forever;
# avoids the TimeSpan.MaxValue quirks some Windows builds have).
$Trigger = New-ScheduledTaskTrigger -Daily -At '00:15'
$Trigger.Repetition = (New-ScheduledTaskTrigger -Once -At '00:15' `
    -RepetitionInterval (New-TimeSpan -Hours 6) `
    -RepetitionDuration (New-TimeSpan -Days 3650)).Repetition

# WakeToRun: if the PC is ASLEEP at a scheduled time, Windows wakes it,
# runs the sync, and lets it sleep again per the power plan. Limits:
# - works from SLEEP only, NOT from shutdown/hibernate
# - on battery, wake timers are disabled by default (needs AC power, or
#   "Allow wake timers" enabled for battery in the power plan)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -MultipleInstances IgnoreNew

$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger `
    -Settings $Settings -Principal $Principal -Force `
    -Description 'Syncs rhythm-sub.com releases from this residential IP (Cloudflare trusts home IPs, challenges datacenter IPs) and pushes data to GitHub. No 14-day cookie dependency: fresh wp-login works from here. Log: D:\rhythm\data\sync-local.log' | Out-Null

Write-Host "Registered scheduled task: $TaskName"
Write-Host "  cadence: every 6h (00:15/06:15/12:15/18:15), catches up after missed runs"
Write-Host "  log:     D:\rhythm\data\sync-local.log"
Write-Host "  remove:  powershell -ExecutionPolicy Bypass -File register-local-sync.ps1 -Unregister"
