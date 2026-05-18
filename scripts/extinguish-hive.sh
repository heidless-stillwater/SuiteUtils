#!/bin/bash

# Stillwater Sovereign Hive :: EXTINGUISH PRIME v1.0
# Objective: Total Neural Purge & Service Termination

echo "🌑 [EXTINGUISH PRIME] Initializing Total Hive Shutdown..."

# 0. TERMINATE WATCHDOG (if active)
WATCHDOG_PID_FILE="/tmp/suite-watchdog.pid"
if [ -f "$WATCHDOG_PID_FILE" ]; then
    echo "🐕 [0/3] Stopping Resurrection Watchdog..."
    kill $(cat "$WATCHDOG_PID_FILE") 2>/dev/null
    rm "$WATCHDOG_PID_FILE"
fi

# 1. BINARY-LOCKED SURGICAL TERMINATION
echo "🧹 [1/3] Executing Binary-Locked Termination (shielding antigravity)..."
# We find all node/vite/tsx processes, then filter by their binary path and directory
for pid in $(pgrep -f "node|vite|tsx|next-server"); do
    # Get the working directory of the process
    pwd=$(pwdx $pid 2>/dev/null | cut -d' ' -f2-)
    # Get the FULL command line and binary path
    cmd=$(ps -p $pid -o cmd= 2>/dev/null)
    
    # SHIELD: Never touch Antigravity (strictly check the binary path)
    if [[ "$cmd" == *".antigravity-server"* ]]; then
        continue
    fi
    
    # TARGET: Kill if working directory or command arguments reference projects directory
    if [[ "$pwd" == *"/home/heidless/projects"* || "$cmd" == *"/home/heidless/projects"* ]]; then
        echo "💀 [Purge] Terminating PID $pid ($pwd)"
        kill -9 $pid 2>/dev/null
    fi
done
# Final sweep for stray ports (Primary Web Suite)
lsof -ti:5180,5185,3000-3010 | xargs -r kill -9 2>/dev/null
sleep 2

# 2. CLEAR ORCHESTRATION CACHES
echo "🧼 [2/3] Cleaning orchestration caches..."
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
rm -rf "$PROJECT_ROOT/.next" 2>/dev/null
rm -rf "$PROJECT_ROOT/dist" 2>/dev/null
rm -rf "$PROJECT_ROOT/logs/ignition.log" 2>/dev/null

# 3. VERIFY SILENCE (filtering out Antigravity)
echo "📡 [3/3] Verifying neural silence..."
STILL_RUNNING=$(pgrep -f "node|vite|tsx|next-server" | xargs -r ps -o pid=,cmd= -p | grep -v ".antigravity-server" | wc -l)

if [ "$STILL_RUNNING" -eq "0" ]; then
    echo "✅ [SUCCESS] The Hive is silent. All modules extinguished."
else
    echo "⚠️ [WARNING] $STILL_RUNNING threads resisted termination. Retrying with SIGKILL..."
    pgrep -f "node|vite|tsx|next-server" | xargs -r ps -o pid=,cmd= -p | grep -v ".antigravity-server" | awk '{print $1}' | xargs -r kill -9 2>/dev/null
    echo "💀 [FORCE] Lingering threads purged."
fi

echo "🦾 [READY] You may now execute ./ignite-hive.sh for a fresh start."
