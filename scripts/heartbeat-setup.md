# Heartbeat Setup

The RA-H heartbeat runs **locally on the MacBook** (not Maci) because it queries
`~/Library/Application Support/RA-H/db/rah.sqlite` directly.

Use **launchd** instead of cron — it handles sleep/wake correctly on macOS.

## Script

```
ra-h_os/scripts/heartbeat.py
```

Modes: `morning`, `evening`, `overdue`, `weekly`, `monthly`, `quarterly`, `card-proposals`

## Quick install

```bash
cd /Users/balazsfurjes/Cursor\ files/ra-h_os
bash scripts/install-heartbeat.sh
```

## Manual install (launchd plists)

Create each plist in `~/Library/LaunchAgents/` and load with `launchctl load`.

### Morning brief — 7:00 daily

```xml
<!-- ~/Library/LaunchAgents/com.pkm.heartbeat.morning.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.pkm.heartbeat.morning</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/python3</string>
    <string>/Users/balazsfurjes/Cursor files/ra-h_os/scripts/heartbeat.py</string>
    <string>--mode</string><string>morning</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/tmp/pkm_heartbeat.log</string>
  <key>StandardErrorPath</key><string>/tmp/pkm_heartbeat.log</string>
</dict>
</plist>
```

### Evening digest — 18:00 daily

```xml
<!-- ~/Library/LaunchAgents/com.pkm.heartbeat.evening.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.pkm.heartbeat.evening</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/python3</string>
    <string>/Users/balazsfurjes/Cursor files/ra-h_os/scripts/heartbeat.py</string>
    <string>--mode</string><string>evening</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>18</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/tmp/pkm_heartbeat.log</string>
  <key>StandardErrorPath</key><string>/tmp/pkm_heartbeat.log</string>
</dict>
</plist>
```

### Overdue check — every 30 min, 8:00–22:00

```xml
<!-- ~/Library/LaunchAgents/com.pkm.heartbeat.overdue.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.pkm.heartbeat.overdue</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/python3</string>
    <string>/Users/balazsfurjes/Cursor files/ra-h_os/scripts/heartbeat.py</string>
    <string>--mode</string><string>overdue</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>8</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>8</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>10</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>11</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>11</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>12</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>12</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>13</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>13</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>14</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>14</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>15</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>15</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>16</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>16</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>17</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>17</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>18</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>18</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>19</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>19</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>20</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>20</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>21</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>21</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>22</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>/tmp/pkm_heartbeat.log</string>
  <key>StandardErrorPath</key><string>/tmp/pkm_heartbeat.log</string>
</dict>
</plist>
```

### Card proposals — 17:00 daily

```xml
<!-- ~/Library/LaunchAgents/com.pkm.heartbeat.card-proposals.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.pkm.heartbeat.card-proposals</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/python3</string>
    <string>/Users/balazsfurjes/Cursor files/ra-h_os/scripts/heartbeat.py</string>
    <string>--mode</string><string>card-proposals</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>17</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/tmp/pkm_heartbeat.log</string>
  <key>StandardErrorPath</key><string>/tmp/pkm_heartbeat.log</string>
</dict>
</plist>
```

### Review nudges — weekly (Mon 9am), monthly (1st 9am), quarterly (1st of Jan/Apr/Jul/Oct 9am)

These are low-frequency — you can also just trigger them manually. If you want to automate:

```xml
<!-- ~/Library/LaunchAgents/com.pkm.heartbeat.weekly.plist -->
<!-- Same structure, StartCalendarInterval: Weekday=2 Hour=9 Minute=0 -->

<!-- ~/Library/LaunchAgents/com.pkm.heartbeat.monthly.plist -->
<!-- StartCalendarInterval: Day=1 Hour=9 Minute=0 -->
```

## Load all agents

```bash
for plist in ~/Library/LaunchAgents/com.pkm.heartbeat.*.plist; do
  launchctl load "$plist"
done
```

## Remove old Maci cron

```bash
ssh maci "crontab -l | grep -v heartbeat | crontab -"
```

This leaves the vdirsyncer calendar sync cron in place.

## Test a mode

```bash
python /Users/balazsfurjes/Cursor\ files/ra-h_os/scripts/heartbeat.py --mode morning --dry-run
```
