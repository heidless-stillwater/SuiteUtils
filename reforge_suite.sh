#!/bin/bash
BASE_DIR="/home/heidless/projects/SuiteUtils"
TMUX_SESSION="stillwater"

echo "🛑 Total Suite Shutdown..."
"$BASE_DIR/suite" stop all
pkill -f suite-watchdog.sh
pkill -f suite-dashboard.sh
tmux kill-session -t "$TMUX_SESSION" 2>/dev/null

echo "🏗️ Re-Forging stillwater session..."
tmux new-session -d -s "$TMUX_SESSION" -n DASHBOARD
for i in {1..8}; do
    tmux new-window -t "$TMUX_SESSION:$i"
done

echo "🛰️ Starting Dashboard in Window 0..."
tmux send-keys -t "$TMUX_SESSION:0" "cd $BASE_DIR && ./suite-dashboard.sh" Enter

echo "🛰️ Starting Persona in Window 6..."
"$BASE_DIR/persona-ctl.sh" start

echo "🛰️ Launching Watchdog..."
nohup "$BASE_DIR/suite-watchdog.sh" > /dev/null 2>&1 &

echo "🏰 STILLWATER HIVE RE-FORGED."
