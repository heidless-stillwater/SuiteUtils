#!/bin/bash
# Unset leaked environment project variables to force loading from active config (.env)
unset GOOGLE_CLOUD_PROJECT
unset CLOUDSDK_CORE_PROJECT
# Stillwater Suite - Persistent Observability & Resurrection Watchdog v5
# Fixes: stale PID on reboot, STATE_CHANGED lost in subshell, boot resilience.

PID_FILE="/tmp/suite-watchdog.pid"
DASHBOARD_PID_FILE="/tmp/suite-dashboard.pid"
CONFIG_FILE="/home/heidless/projects/SuiteUtils/suite.config.json"
LOG_FILE="/home/heidless/projects/SuiteUtils/watchdog.log"

# --- Self-registration with stale PID cleanup ---
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "[$(date)] ⚠️  Another watchdog already running (PID: $OLD_PID). Exiting." >> "$LOG_FILE"
        exit 0
    else
        echo "[$(date)] 🧹 Stale PID file found ($OLD_PID). Cleaning up." >> "$LOG_FILE"
        rm -f "$PID_FILE"
    fi
fi
echo $$ > "$PID_FILE"
echo "[$(date)] 🛰️  Watchdog v5 (Resurrector) Active (PID: $$)." >> "$LOG_FILE"

# --- Main resurrection loop ---
while true; do
    STATE_CHANGED=false

    # Parse module data into a temp file (avoids subshell variable scope loss)
    TMP_MODULES=$(mktemp)
    grep -E '"name":|"script":|"port":|"enabled":' "$CONFIG_FILE" \
        | sed 's/\"//g; s/,//g; s/: /:/g; s/^ *//' \
        | awk -F: '{print $2}' \
        | paste - - - - \
        > "$TMP_MODULES"

    LIGHT_MODE=$(node -e 'const fs=require("fs"); const c=JSON.parse(fs.readFileSync("'"$CONFIG_FILE"'", "utf8")); console.log(c.lightMode || false);' 2>/dev/null || echo "false")

    while read -r name script port enabled; do
        if [ "$enabled" = "true" ]; then
            CHECK_PORT=$port
            if [ "$name" = "utils" ] && [ "$LIGHT_MODE" = "true" ]; then
                CHECK_PORT=5185
            fi
            if ! ss -lnt | grep -qE ":${CHECK_PORT}(\s|$)"; then
                echo "[$(date)] ⚠️  $name (Port $CHECK_PORT) OFFLINE. Attempting resurrection..." >> "$LOG_FILE"
                /home/heidless/projects/SuiteUtils/$script start >> "$LOG_FILE" 2>&1
                sleep 3
                # Verify resurrection succeeded
                if ss -lnt | grep -qE ":${CHECK_PORT}(\s|$)"; then
                    echo "[$(date)] ✅ $name resurrected successfully on port $CHECK_PORT." >> "$LOG_FILE"
                else
                    echo "[$(date)] ❌ $name resurrection FAILED on port $CHECK_PORT. Check log." >> "$LOG_FILE"
                fi
                STATE_CHANGED=true
            fi
        fi
    done < "$TMP_MODULES"
    rm -f "$TMP_MODULES"

    # Notify Dashboard if any state changed (PID must be alive, not stale)
    if [ "$STATE_CHANGED" = "true" ] && [ -f "$DASHBOARD_PID_FILE" ]; then
        DASH_PID=$(cat "$DASHBOARD_PID_FILE")
        if kill -0 "$DASH_PID" 2>/dev/null; then
            kill -SIGUSR1 "$DASH_PID" 2>/dev/null
        fi
    fi

    sleep 10
done
