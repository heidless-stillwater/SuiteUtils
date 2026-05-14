#!/bin/bash
# Stillwater Snapshot: tmux_base
# Purpose: Reverts the orchestration suite to the May 14 Gold Standard.

BASE_DIR="/home/heidless/projects/SuiteUtils"

echo "🛰️ Invoking tmux_base snapshot..."

# 1. Restore Config (Persona-Only enabled + Supporting Ports)
cat <<EOF > "$BASE_DIR/suite.config.json"
{
  "activeSession": "2f64bda5-54ca-464d-9eb8-d17d4e894933",
  "modules": [
    { "id": 1, "name": "video", "script": "video-ctl.sh", "port": 3000, "enabled": false },
    { "id": 2, "name": "prompttool", "script": "prompttool-ctl.sh", "port": 3001, "enabled": false },
    { "id": 3, "name": "resources", "script": "resources-ctl.sh", "port": 3002, "enabled": false },
    { "id": 4, "name": "accreditation", "script": "accreditation-ctl.sh", "port": 3003, "enabled": false },
    { "id": 5, "name": "plantune", "script": "plantune-ctl.sh", "port": 3004, "enabled": false },
    { "id": 6, "name": "persona", "script": "persona-ctl.sh", "port": 3005, "supportingPorts": [3006], "enabled": true },
    { "id": 7, "name": "master", "script": "master-ctl.sh", "port": 5173, "enabled": false },
    { "id": 8, "name": "utils", "script": "utils-ctl.sh", "port": 5180, "supportingPorts": [5185], "enabled": false }
  ]
}
EOF


# 2. Ensure Scripts are Executable
chmod +x "$BASE_DIR/suite-ctl.sh"
chmod +x "$BASE_DIR/suite-watchdog.sh"
chmod +x "$BASE_DIR/suite-dashboard.sh"

# 3. Kill and Re-Forge
"$BASE_DIR/suite" stop
pkill -f suite-watchdog.sh
pkill -f suite-dashboard.sh
tmux kill-session -t stillwater 2>/dev/null || true

# 4. Start fresh (Triggering ensure_session)
"$BASE_DIR/suite" start

echo "🏰 STILLWATER HIVE RESTORED TO MAY 14 GOLD STANDARD."
