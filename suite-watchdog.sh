#!/bin/bash
# Stillwater Suite - Persistent Observability & Resurrection Watchdog v4
# Purpose: Ensures background processes stay alive and notifies dashboard.

PID_FILE="/tmp/suite-watchdog.pid"
DASHBOARD_PID_FILE="/tmp/suite-dashboard.pid"
CONFIG_FILE="/home/heidless/projects/SuiteUtils/suite.config.json"
LOG_FILE="/home/heidless/projects/SuiteUtils/watchdog.log"

# Kill existing watchdog
if [ -f "$PID_FILE" ]; then
    kill $(cat "$PID_FILE") 2>/dev/null
fi
echo $$ > "$PID_FILE"

echo "[$(date)] 🛰️ Watchdog v4 (Resurrector) Active." >> "$LOG_FILE"

while true; do
    STATE_CHANGED=false
    # Parse modules from JSON (since jq is missing, we use a robust grep/sed hack)
    # We look for blocks between { and }, then extract name, script, port, enabled
    MODULE_DATA=$(grep -E "\"name\":|\"script\":|\"port\":|\"enabled\":" "$CONFIG_FILE" | sed 's/\"//g; s/,//g; s/: /:/g')
    
    # We iterate through the modules (assuming consistent ordering in the JSON)
    # This extracts name, script, port, and enabled status
    echo "$MODULE_DATA" | awk -F: '{print $2}' | xargs -n 4 | while read -r name script port enabled; do
        if [ "$enabled" == "true" ]; then
            # Robust check: look for :PORT followed by space or end of line
            if ! ss -lnt | grep -qE ":$port(\s|$)" ; then
                echo "[$(date)] ⚠️ $name (Port $port) OFFLINE. Attempting resurrection..." >> "$LOG_FILE"
                /home/heidless/projects/SuiteUtils/$script start >> "$LOG_FILE" 2>&1
                STATE_CHANGED=true
            fi
        fi
    done

    # Notify Dashboard if any state changed
    if [ "$STATE_CHANGED" == "true" ] && [ -f "$DASHBOARD_PID_FILE" ]; then
        DASH_PID=$(cat "$DASHBOARD_PID_FILE")
        kill -SIGUSR1 "$DASH_PID" 2>/dev/null
    fi

    sleep 10
done
