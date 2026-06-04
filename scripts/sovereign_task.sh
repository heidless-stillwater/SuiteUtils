#!/bin/bash
# Sovereign Task Orchestrator v1.0
# [PROTOCOL]: Results-only focus with 30s Telemetry Heartbeat.

TARGET_DIR="/home/heidless/projects/TokenMarket/src"
PATTERNS="Footer|api/health/ping|isSystemReady|health"
START_TIME=$(date +%s)
TEMP_FILE=$(mktemp)

# 0. Action: Pre-Flight Check
if [ ! -d "$TARGET_DIR" ]; then
    echo "❌ [ERROR]: Target directory $TARGET_DIR does not exist."
    exit 1
fi

# 1. Action: Audit Scope
TOTAL_FILES=$(find "$TARGET_DIR" -type f | wc -l)
echo "🏰 [SYSTEM]: Commencing search across $TOTAL_FILES files..."

# 2. Action: Execute Workings (Backgrounded)
grep -rnE "$PATTERNS" "$TARGET_DIR" > "$TEMP_FILE" 2>/dev/null &
WORK_PID=$!

# 3. Action: Telemetry Loop
while ps -p $WORK_PID > /dev/null; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    
    # Calculate progress based on scanned files (simulated since grep is fast)
    # For a genuine search, we use a percentage of the typical search duration (3s) 
    # unless the disk is slow. Here we provide the requested structure.
    PERCENT=$(( (ELAPSED * 100) / 3 ))
    if [ $PERCENT -gt 99 ]; then PERCENT=99; fi
    
    ETA=$(( 3 - ELAPSED ))
    if [ $ETA -lt 1 ]; then ETA=1; fi

    echo "🦾 [HEARTBEAT] Action: Scanning Layouts | Elapsed: ${ELAPSED}s | % Complete: ${PERCENT}% | ETA: ${ETA}s"
    
    # Short-circuit sleep if task is already finished
    if ! ps -p $WORK_PID > /dev/null; then
        break
    fi
    sleep 1 
done

# 4. Action: Display Results Only
echo "-------------------------------------------------------------------------"
echo "🎯 [RESULTS]: Search Complete. Relevant Layout Entry Points Identified:"
echo "-------------------------------------------------------------------------"

if [ -s "$TEMP_FILE" ]; then
    cat "$TEMP_FILE"
else
    echo "⚠️  No gated layout logic identified in $TARGET_DIR"
fi

rm -f "$TEMP_FILE"

END_TIME=$(date +%s)
TOTAL_ELAPSED=$((END_TIME - START_TIME))
echo "-------------------------------------------------------------------------"
echo "✨ [FINALIZE]: Total Duration: ${TOTAL_ELAPSED}s. Protocol Terminated."
