#!/usr/bin/env bash
# Install PKM5 heartbeat launchd agents on the local MacBook.
# Replaces the old Maci cron-based Atlas-framework heartbeat.
set -e

SCRIPT="/Users/balazsfurjes/Cursor files/pkm5/scripts/heartbeat.py"
AGENTS="$HOME/Library/LaunchAgents"
PYTHON="/opt/homebrew/bin/python3"
LOG="/tmp/pkm_heartbeat.log"

mkdir -p "$AGENTS"

write_plist() {
  local label="$1"
  local mode="$2"
  local schedule="$3"   # raw XML for StartCalendarInterval
  local dest="$AGENTS/${label}.plist"

  cat > "$dest" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${PYTHON}</string>
    <string>${SCRIPT}</string>
    <string>--mode</string><string>${mode}</string>
  </array>
  <key>StartCalendarInterval</key>
  ${schedule}
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
</dict>
</plist>
PLIST

  # Unload if already loaded (ignore errors)
  launchctl unload "$dest" 2>/dev/null || true
  launchctl load "$dest"
  echo "  Loaded: $label"
}

echo "Installing PKM5 heartbeat launchd agents..."

write_plist "com.pkm.heartbeat.morning" "morning" \
  "<dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>0</integer></dict>"

write_plist "com.pkm.heartbeat.evening" "evening" \
  "<dict><key>Hour</key><integer>18</integer><key>Minute</key><integer>0</integer></dict>"

write_plist "com.pkm.heartbeat.card-proposals" "card-proposals" \
  "<dict><key>Hour</key><integer>17</integer><key>Minute</key><integer>0</integer></dict>"

write_plist "com.pkm.heartbeat.weekly" "weekly" \
  "<dict><key>Weekday</key><integer>2</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>"

write_plist "com.pkm.heartbeat.monthly" "monthly" \
  "<dict><key>Day</key><integer>1</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>"

# Overdue: every 30 min 8am-10pm — build an array of dicts
overdue_schedule="<array>"
for hour in $(seq 8 22); do
  overdue_schedule+="<dict><key>Hour</key><integer>${hour}</integer><key>Minute</key><integer>0</integer></dict>"
  overdue_schedule+="<dict><key>Hour</key><integer>${hour}</integer><key>Minute</key><integer>30</integer></dict>"
done
overdue_schedule+="</array>"

write_plist "com.pkm.heartbeat.overdue" "overdue" "$overdue_schedule"

echo ""
echo "All agents loaded. Log: $LOG"
echo ""
echo "To remove old Maci heartbeat cron:"
echo "  ssh maci \"crontab -l | grep -v heartbeat | crontab -\""
echo ""
echo "Test with:"
echo "  python3 '${SCRIPT}' --mode morning --dry-run"
