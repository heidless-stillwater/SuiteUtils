#!/bin/bash
APP_NAME="Persona"
APP_DIR="/home/heidless/projects/Persona"
TMUX_SESSION="stillwater"
PORT=3005
BRIDGE_PORT=3006
LOG_FILE="/home/heidless/projects/SuiteUtils/persona.log"

case "$1" in
    start)
        echo "🚀 Starting ${APP_NAME} Stack (UI:${PORT}, Bridge:${BRIDGE_PORT})..."
        if fuser ${PORT}/tcp >/dev/null 2>&1 || fuser ${BRIDGE_PORT}/tcp >/dev/null 2>&1; then
            echo "⚠️ ${APP_NAME} components are already running."
            exit 1
        fi
        cd $APP_DIR
        nohup env PORT=${PORT} ./scripts/start-persona.sh > $LOG_FILE 2>&1 &
        echo "✅ ${APP_NAME} background stack initialized."
        ;;
    stop)
        echo "🛑 Stopping ${APP_NAME} Stack..."
        fuser -k ${PORT}/tcp > /dev/null 2>&1
        fuser -k ${BRIDGE_PORT}/tcp > /dev/null 2>&1
        
        # Surgically terminate associated background sensors or distiller
        for pid in $(pgrep -f "node.*(distiller|git-lineage|project-heartbeat|conversation-sensor)"); do
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
        PID_UI=$(fuser ${PORT}/tcp 2>/dev/null | awk '{print $1}')
        PID_BRIDGE=$(fuser ${BRIDGE_PORT}/tcp 2>/dev/null | awk '{print $1}')
        
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
