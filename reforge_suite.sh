#!/bin/bash
BASE_DIR="/home/heidless/projects/SuiteUtils"
TMUX_SESSION="stillwater"

echo "🛑 Total Suite Shutdown..."
"$BASE_DIR/suite-ctl.sh" stop all
pkill -f suite-watchdog.sh
pkill -f suite-dashboard.sh
tmux kill-session -t "$TMUX_SESSION" 2>/dev/null

echo "🏗️ Re-Forging stillwater session..."
tmux new-session -d -s "$TMUX_SESSION" -n UI
tmux new-window -t "$TMUX_SESSION:1" -n BRIDGE
tmux new-window -t "$TMUX_SESSION:2" -n SENSORS
for i in {3..8}; do
    tmux new-window -t "$TMUX_SESSION:$i"
done

echo "🛰️ Starting UI (Dashboard) in Window 0..."
tmux send-keys -t "$TMUX_SESSION:0" "cd $BASE_DIR && ./suite-dashboard.sh" Enter

echo "🛰️ Starting Bridge (Persona) in Window 1..."
tmux send-keys -t "$TMUX_SESSION:1" "cd $BASE_DIR && ./persona-ctl.sh start" Enter

echo "🛰️ Launching Sensors (Watchdog) in Window 2..."
tmux send-keys -t "$TMUX_SESSION:2" "cd $BASE_DIR && ./suite-watchdog.sh" Enter

echo "🏰 STILLWATER HIVE BOOTSTRAPPED."
