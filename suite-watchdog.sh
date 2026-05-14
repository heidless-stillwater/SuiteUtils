#!/bin/bash
# Stillwater Suite - Persistent Observability Watchdog v3
# Updates tmux window names with status indicators (🟢/⚪)

TMUX_SESSION="stillwater"
PID_FILE="/tmp/suite-watchdog.pid"

# Kill existing watchdog if it exists
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    kill "$OLD_PID" 2>/dev/null
    rm "$PID_FILE"
fi

echo $$ > "$PID_FILE"

CONFIG_FILE="/home/heidless/projects/SuiteUtils/suite.config.json"

echo "🛰️ Watchdog v3 active for session [$TMUX_SESSION]"

while true; do
    if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
        # Parse the config for ALL apps to ensure we handle the whole grid
        # Format: id|name|port|enabled
        MAP=$(grep -oP '"id": \K\d+|"name": "\K[^"]+|"port": \K\d+|"enabled": \K\w+' "$CONFIG_FILE" | xargs -n 4 echo | sed 's/ /|/g')
        
        while IFS='|' read -r id name port enabled; do
            # Check if port is active (Check both IPv4 and IPv6 registries)
            HEX_PORT=$(printf ":%04X" $port)
            if grep -q "$HEX_PORT" /proc/net/tcp || grep -q "$HEX_PORT" /proc/net/tcp6; then
                status="🟢"
            else
                # PRIORITY 2: INTENT (CONFIG)
                if [ "$enabled" == "true" ]; then
                    status="⚪"
                else
                    status="💤"
                fi
            fi
            
            # Rename the window ONLY if state has changed to prevent terminal flashing
            window_idx=$id
            supporting=$(grep "\"id\": $id" "$CONFIG_FILE" | grep -oP '"supportingPorts": \[\K[^\]]+' | tr -d ' ')
            
            if [ -n "$supporting" ]; then
                new_name="[$status] $id:$name:$port+${supporting//,/+}"
            else
                new_name="[$status] $id:$name:$port"
            fi
            
            current_name=$(tmux display-message -p -t "$TMUX_SESSION:$window_idx" "#W" 2>/dev/null)
            
            if [ "$new_name" != "$current_name" ]; then
                tmux rename-window -t "$TMUX_SESSION:$window_idx" "$new_name" 2>/dev/null
            fi


        done <<< "$MAP"

        
        # Set a persistent status bar message
        tmux set-option -t "$TMUX_SESSION" status-left-length 50
        tmux set-option -t "$TMUX_SESSION" status-left "#[fg=green,bold]Stillwater Hive: #[fg=yellow,bold]Config Synced "
    fi
    sleep 3
done

