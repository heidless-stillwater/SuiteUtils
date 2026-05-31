#!/usr/bin/env bash
# Stillwater Suite Bootstrap & Sync Script
# Starts SuiteUtils & Persona in minimal mode and syncs conversation with the Architect profile.

BASE_DIR="/home/heidless/projects/SuiteUtils"
CONV_ID=${CONVERSATION_ID:-""}

# 1. Resolve Active Conversation ID
if [ -z "$CONV_ID" ] && [ -f "$BASE_DIR/.planning/.active_plan" ]; then
    CONV_ID=$(cat "$BASE_DIR/.planning/.active_plan" | tr -d '[:space:]')
fi

echo "🚀 [Bootstrap-Sync] Starting SuiteUtils & Persona in MINIMAL mode..."
"$BASE_DIR/suite-ctl.sh" minimal

# 2. Wait/Poll for Persona Bridge port 3008 to be ready
echo "📡 [Bootstrap-Sync] Waiting for Persona Bridge to come online on port 3008..."
MAX_RETRIES=30
COUNT=0
while ! curl -s -m 2 http://localhost:3008/api/health/ping > /dev/null; do
    sleep 1
    COUNT=$((COUNT+1))
    if [ $COUNT -ge $MAX_RETRIES ]; then
        echo "❌ [Bootstrap-Sync] ERROR: Persona Bridge failed to start after ${MAX_RETRIES} seconds."
        exit 1
    fi
    echo -n "."
done
echo -e "\n✅ [Bootstrap-Sync] Persona Bridge is online!"

# 3. Trigger conversation sync with architect
echo "🛰️ [Bootstrap-Sync] Triggering sync to 'architect' archetype..."
SYNC_RES=$(curl -s -X POST http://localhost:3008/command \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"!sync architect\", \"conversationId\": \"$CONV_ID\", \"source\": \"bootstrap\"}")

echo "🎉 [Bootstrap-Sync] Sync completed successfully."
echo "Result: $SYNC_RES"
