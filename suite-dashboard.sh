#!/bin/bash
# Stillwater Sovereign Launchpad v4.2 (STABLE SIGNAL)
# Purpose: ZERO FLASHING + Signal-Resistant Event Logic.

CONFIG_FILE="/home/heidless/projects/SuiteUtils/suite.config.json"

# Store PID
echo $$ > /tmp/suite-dashboard.pid

render() {
    clear
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║             STILLWATER SOVEREIGN HIVE - COMMAND CENTER             ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo ""
    printf "  %-4s %-18s %-18s %-30s\n" "ID" "CORRIDOR" "STATUS" "LAUNCH URLS"
    echo "  ──   ────────           ──────   ───────────"

    while IFS= read -r line; do
        id=$(echo "$line" | grep -oP '"id": \K\d+')
        name=$(echo "$line" | grep -oP '"name": "\K[^"]+')
        port=$(echo "$line" | grep -oP '"port": \K\d+')
        supporting=$(echo "$line" | grep -oP '"supportingPorts": \[\K[^\]]+')
        
        if ss -lnt | grep -q ":$port "; then
            status="🟢 ACTIVE"
        else
            status="💤 STANDBY"
        fi
        
        printf "  %-4s %-18s %-18s " "$id" "$(echo $name | tr '[:lower:]' '[:upper:]')" "$status"
        
        # Render Primary URL
        url="http://localhost:$port"
        printf "\033]8;;%s\033\\%s\033]8;;\033\\ " "$url" "$url"
        
        # Render Supporting URLs
        if [ -n "$supporting" ]; then
            IFS=',' read -ra ADDR <<< "$supporting"
            for p in "${ADDR[@]}"; do
                p=$(echo $p | tr -d ' ')
                s_url="http://localhost:$p"
                printf "\033]8;;%s\033\\%s\033]8;;\033\\ " "$s_url" "$s_url"
            done
        fi
        echo ""
    done < <(grep '"id":' "$CONFIG_FILE")

    echo ""
    echo "  ────────────────────────────────────────────────────────────────────"
    echo "  Last Update: $(date +%H:%M:%S) (Event-Driven)"
}

# Silent Trap
trap "render" USR1

# Initial render
render

# Solid wait (Signal-resistant)
tail -f /dev/null
