#!/bin/bash
# Unset leaked environment project variables to force loading from active config (.env)
unset GOOGLE_CLOUD_PROJECT
unset CLOUDSDK_CORE_PROJECT
APP_NAME="Persona"
APP_DIR="/home/heidless/projects/Persona"
TMUX_SESSION="stillwater"
PORT=3005
BRIDGE_PORT=5005
LOG_FILE="/home/heidless/projects/SuiteUtils/persona.log"

CONFIG_FILE="/home/heidless/projects/SuiteUtils/suite.config.json"
LIGHT_MODE=$(node -e 'const fs=require("fs"); const c=JSON.parse(fs.readFileSync("'"$CONFIG_FILE"'", "utf8")); console.log(c.lightMode || false);' 2>/dev/null || echo "false")

case "$1" in
    start)
        echo "🚀 Starting ${APP_NAME} Stack (UI:${PORT}, Bridge:${BRIDGE_PORT})..."
        if ss -lnt | grep -qE ":${PORT}(\s|$)" || ss -lnt | grep -qE ":${BRIDGE_PORT}(\s|$)"; then
            echo "⚠️ ${APP_NAME} components are already running."
            exit 0
        fi
        cd $APP_DIR
        nohup env PORT=${PORT} LIGHT_MODE=${LIGHT_MODE} ./scripts/start-persona.sh ${PORT} ${BRIDGE_PORT} > $LOG_FILE 2>&1 &
        echo "⏳ ${APP_NAME} stack starting... (waiting up to 15s for dynamic verification)"
        for i in {1..15}; do
            UI_UP=$(ss -lnt | grep -cE ":${PORT}(\s|$)")
            BRIDGE_UP=$(ss -lnt | grep -cE ":${BRIDGE_PORT}(\s|$)")
            if [ "$UI_UP" -gt 0 ] && [ "$BRIDGE_UP" -gt 0 ]; then
                break
            fi
            sleep 1
        done

        UI_UP=$(ss -lnt | grep -cE ":${PORT}(\s|$)")
        BRIDGE_UP=$(ss -lnt | grep -cE ":${BRIDGE_PORT}(\s|$)")
        if [ "$UI_UP" -gt 0 ] && [ "$BRIDGE_UP" -gt 0 ]; then
            echo "✅ ${APP_NAME} is FULLY UP (UI: ${PORT} | Bridge: ${BRIDGE_PORT})"
            
            # Auto-Sync Handshake on Startup
            CONV_ID=${CONVERSATION_ID:-""}
            UT_DIR="/home/heidless/projects/SuiteUtils"
            if [ -z "$CONV_ID" ] && [ -f "$UT_DIR/.planning/.active_plan" ]; then
                CONV_ID=$(cat "$UT_DIR/.planning/.active_plan" | tr -d '[:space:]')
            fi
            
            if [ -n "$CONV_ID" ]; then
                echo "🛰️ [Auto-Sync] Triggering autonomous sync to 'architect' archetype for session $CONV_ID..."
                curl -s -X POST http://localhost:${BRIDGE_PORT}/command \
                    -H "Content-Type: application/json" \
                    -d "{\"text\": \"!sync architect\", \"conversationId\": \"$CONV_ID\", \"source\": \"auto-ignition\"}" > /dev/null &
            fi
        elif [ "$UI_UP" -gt 0 ] || [ "$BRIDGE_UP" -gt 0 ]; then
            echo "⚠️ ${APP_NAME} is DEGRADED (UI: $([ "$UI_UP" -gt 0 ] && echo UP || echo DOWN) | Bridge: $([ "$BRIDGE_UP" -gt 0 ] && echo UP || echo DOWN)). Last log:"
            tail -n 10 $LOG_FILE 2>/dev/null
        else
            echo "❌ ${APP_NAME} failed to start. Last log:"
            tail -n 10 $LOG_FILE 2>/dev/null
        fi
        ;;
    stop)
        echo "🛑 Stopping ${APP_NAME} Stack..."
        fuser -k ${PORT}/tcp > /dev/null 2>&1
        fuser -k ${BRIDGE_PORT}/tcp > /dev/null 2>&1
        
        # Surgically terminate associated background sensors, distiller, or bridge server
        for pid in $(pgrep -f "node.*(server\.js|distiller|git-lineage|project-heartbeat|conversation-sensor)"); do
            pwdx_res=$(pwdx $pid 2>/dev/null | grep -E "/projects/Persona(/|$)")
            if [ -n "$pwdx_res" ]; then
                echo "💀 [Purge] Terminating background sensor PID $pid"
                kill -9 $pid 2>/dev/null
            fi
        done
        echo "✅ ${APP_NAME} stack terminated."
        ;;
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    status)
        PID_UI=$(ss -lntp | grep -E ":${PORT}(\s|$)" | grep -oP 'pid=\K\d+' | head -n 1)
        PID_BRIDGE=$(ss -lntp | grep -E ":${BRIDGE_PORT}(\s|$)" | grep -oP 'pid=\K\d+' | head -n 1)
        
        if [ -n "$PID_UI" ] && [ -n "$PID_BRIDGE" ]; then
            echo "✅ ${APP_NAME} is FULLY UP (UI: $PID_UI | Bridge: $PID_BRIDGE)"
        elif [ -n "$PID_UI" ] || [ -n "$PID_BRIDGE" ]; then
            echo "⚠️ ${APP_NAME} is DEGRADED (UI: ${PID_UI:-DOWN} | Bridge: ${PID_BRIDGE:-DOWN})"
        else
            echo "❌ ${APP_NAME} is DOWN"
        fi
        echo "--- Terminal Log (Last 10 Lines) ---"
        tail -n 10 $LOG_FILE 2>/dev/null || echo "[No log file found]"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
esac
