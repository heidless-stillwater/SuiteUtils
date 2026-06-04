#!/bin/bash

# Stillwater Sovereign Hive :: IGNITION PRIME v1.0
# Objective: Zero-Touch Autonomous Hive Orchestration

echo "🛰️  [IGNITION PRIME] Initializing Hive Cold Start..."

# 1. BINARY-LOCKED SURGICAL PURGE
echo "🧹 [1/4] Executing Binary-Locked Purge (shielding antigravity)..."
# We find all node/vite/tsx processes, then filter by their binary path and directory
for pid in $(pgrep -f "node|vite|tsx|next-server"); do
    # Get the working directory of the process
    pwd=$(pwdx $pid 2>/dev/null | cut -d' ' -f2-)
    # Get the FULL command line and binary path
    cmd=$(ps -p $pid -o cmd= 2>/dev/null)
    
    # SHIELD: Never touch the IDE server (strictly check the binary path)
    if [[ "$cmd" == *".vscode-server"* || "$cmd" == *".antigravity-server"* ]]; then
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

# 2. START ORCHESTRATOR (SuiteUtils)
echo "🚀 [2/4] Igniting SuiteUtils Orchestrator..."
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$PROJECT_ROOT"
# Start in background, redirect logs
mkdir -p logs
env GOOGLE_APPLICATION_CREDENTIALS="$PROJECT_ROOT/suite-admin-sovereign.json" nohup npm run dev:all -- --port 5180 > logs/ignition.log 2>&1 &
ORCH_PID=$!

# 3. POLL FOR READINESS
echo "📡 [3/4] Waiting for Orchestrator Telemetry (Port 5185)..."
MAX_RETRIES=30
COUNT=0
while ! curl -s http://localhost:5185/api/health/ping > /dev/null; do
    sleep 2
    COUNT=$((COUNT+1))
    if [ $COUNT -ge $MAX_RETRIES ]; then
        echo "❌ [ERROR] Orchestrator failed to ignite. Check logs/ignition.log"
        exit 1
    fi
    echo -n "."
done
echo -e "\n✅ [READY] Orchestrator is online."

# 4. TRIGGER HIVE IGNITION
echo "🔥 [4/4] Triggering Autonomous Hive Ignition..."
curl -s -X POST http://localhost:5185/api/suite/start-all \
     -H "Content-Type: application/json" \
     -H "x-workspace-id: stillwater-suite"

# 5. RESTORE WATCHDOG
echo "🐕 [5/5] Activating Resurrection Watchdog..."
nohup "$PROJECT_ROOT/suite-watchdog.sh" > /dev/null 2>&1 &

echo "🦾 [COMPLETE] The Stillwater Hive is synchronized and active."
echo "📟 [INFO] Access Dashboard at http://localhost:5180"
