#!/bin/bash
# Stillwater Sovereign Hive - Command Center Dashboard
# Purpose: Event-driven (SIGUSR1) high-fidelity terminal UI for suite orchestration.

CONFIG_FILE="/home/heidless/projects/SuiteUtils/suite.config.json"
echo $$ > /tmp/suite-dashboard.pid

# Aesthetic Tokens (Using bash escape syntax for maximum reliability)
CLR_RESET=$'\e[0m'
CLR_BOLD=$'\e[1m'
CLR_PRIMARY=$'\e[38;5;38m' # Deep Cyan
CLR_ACCENT=$'\e[38;5;82m'  # Emerald
CLR_STANDBY=$'\e[38;5;240m' # Grey
CLR_BORDER=$'\e[38;5;236m' # Dark Border

render() {
    clear
    printf "${CLR_BORDER}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${CLR_RESET}\n"
    printf "${CLR_BORDER}┃${CLR_RESET}  ${CLR_BOLD}${CLR_PRIMARY}STILLWATER SOVEREIGN HIVE${CLR_RESET} ${CLR_BOLD}${CLR_BORDER}━${CLR_RESET} ${CLR_BOLD}COMMAND CENTER${CLR_RESET}               ${CLR_BORDER}┃${CLR_RESET}\n"
    printf "${CLR_BORDER}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${CLR_RESET}\n"
    printf "\n"
    printf "  ${CLR_BOLD}%-4s %-18s %-18s %-30s${CLR_RESET}\n" "ID" "CORRIDOR" "STATUS" "LAUNCH URLS"
    printf "  ${CLR_BORDER}──   ────────           ──────   ───────────${CLR_RESET}\n"

    while IFS= read -r line; do
        id=$(echo "$line" | grep -oP '"id": \K\d+')
        name=$(echo "$line" | grep -oP '"name": "\K[^"]+')
        port=$(echo "$line" | grep -oP '"port": \K\d+')
        supporting=$(echo "$line" | grep -oP '"supportingPorts": \[\K[^\]]+')
        
        if ss -lnt | grep -q ":$port "; then
            status="${CLR_ACCENT}🟢 ACTIVE${CLR_RESET}"
        else
            status="${CLR_STANDBY}💤 STANDBY${CLR_RESET}"
        fi
        
        printf "  %-4s %-18s %-27s " "$id" "$(echo $name | tr '[:lower:]' '[:upper:]' | xargs)" "$status"
        
        # Render Primary URL with standard OSC 8
        url="http://localhost:$port"
        printf "${CLR_PRIMARY}\e]8;;%s\e\\\\%s\e]8;;\e\\\\${CLR_RESET} " "$url" "$url"
        
        # Render Supporting URLs
        if [ -n "$supporting" ]; then
            IFS=',' read -ra ADDR <<< "$supporting"
            for p in "${ADDR[@]}"; do
                p=$(echo $p | tr -d ' ' | xargs)
                s_url="http://localhost:$p"
                printf "${CLR_STANDBY}\e]8;;%s\e\\\\%s\e]8;;\e\\\\${CLR_RESET} " "$s_url" "$s_url"
            done
        fi
        printf "\n"
    done < <(grep '"id":' "$CONFIG_FILE")

    printf "\n"
    printf "  ${CLR_BORDER}────────────────────────────────────────────────────────────────────${CLR_RESET}\n"
    printf "  ${CLR_BOLD}SYSTEM PULSE:${CLR_RESET} ${CLR_ACCENT}ONLINE${CLR_RESET} | ${CLR_BOLD}LAST UPDATE:${CLR_RESET} $(date +%H:%M:%S) | ${CLR_BOLD}EVENT-DRIVEN${CLR_RESET}\n"
}

# Initial render
render

# Listen for SIGUSR1
trap "render" USR1

# Keep alive
while true; do
    tail -f /dev/null & wait $!
done
