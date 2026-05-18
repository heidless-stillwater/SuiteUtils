#!/bin/bash

COMMAND=$1
OPTION=$2

if [ -z "$COMMAND" ]; then
    echo "Usage: $0 {start|stop|restart|status} [all]"
    exit 1
fi

CONFIG_FILE="/home/heidless/projects/SuiteUtils/suite.config.json"
TMUX_SESSION="stillwater"

ensure_session() {
    if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
        echo "🏗️ Forging Stillwater Hive (Non-Tmux Mode)..."
        # Only create the DASHBOARD window. Background apps don't need windows.
        tmux new-session -d -s "$TMUX_SESSION" -n DASHBOARD
        
        # Start the Dashboard in Window 0
        tmux send-keys -t "$TMUX_SESSION:0" "cd /home/heidless/projects/SuiteUtils && ./suite-dashboard.sh" Enter
        sleep 1
    fi
}


# Always ensure session exists before any command
ensure_session

# Phase 1: Selective Targeting
if [[ "$OPTION" =~ ^[1-8]$ ]]; then
    # Target specific slot (e.g., stop 6 -> Persona)
    TARGET_SCRIPTS=$(grep -Pzo "\"id\": $OPTION(.|\n){0,100}\"script\": \"\K[^\"]+" "$CONFIG_FILE" | tr -d '\0')

elif [ "$COMMAND" == "start" ] && [ "$OPTION" != "all" ]; then
    # Start only enabled modules
    TARGET_SCRIPTS=$(grep -oP '"script": "\K[^"]+(?=".*"enabled": true)' "$CONFIG_FILE")
elif [ "$COMMAND" == "restart" ] && [ "$OPTION" != "all" ]; then
    # Restart all (but start selectively)
    TARGET_SCRIPTS=$(grep -oP '"script": "\K[^"]+' "$CONFIG_FILE")
else
    # Global commands (stop, status, start all)
    TARGET_SCRIPTS=$(grep -oP '"script": "\K[^"]+' "$CONFIG_FILE")
fi


for script in $TARGET_SCRIPTS; do
    if [ -f "/home/heidless/projects/SuiteUtils/$script" ]; then
        if [ "$COMMAND" == "restart" ] && [ "$OPTION" != "all" ]; then
            echo "--- Restarting $script (Selective) ---"
            /home/heidless/projects/SuiteUtils/$script stop
            # PRECISION CHECK: Only start if THIS specific script is enabled
            if grep -Pzo "\"script\": \"$script\"(.|\n){0,100}\"enabled\": true" "$CONFIG_FILE" >/dev/null 2>&1; then
                sleep 1
                /home/heidless/projects/SuiteUtils/$script start
            fi
        else
            echo "--- Executing $COMMAND on $script ---"
            /home/heidless/projects/SuiteUtils/$script $COMMAND
        fi
    fi
done

# Start Watchdog on "start" command
if [ "$COMMAND" == "start" ] || [ "$COMMAND" == "restart" ]; then
    echo "--- Launching Watchdog ---"
    nohup /home/heidless/projects/SuiteUtils/suite-watchdog.sh > /dev/null 2>&1 &
fi

# Notify Dashboard of state changes (SIGUSR1)
if [ -f /tmp/suite-dashboard.pid ]; then
    kill -USR1 $(cat /tmp/suite-dashboard.pid) 2>/dev/null
fi


