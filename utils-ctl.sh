#!/bin/bash
APP_NAME="SuiteUtils"
APP_DIR="/home/heidless/projects/SuiteUtils"
TMUX_SESSION="stillwater"
PORT=5180
API_PORT=5185
LOG_FILE="/home/heidless/projects/SuiteUtils/utils.log"

case "$1" in
    start)
        echo "🚀 Starting ${APP_NAME} Stack (UI:${PORT}, API:${API_PORT})..."
        if ss -lnt | grep -qE ":${PORT}(\s|$)" || ss -lnt | grep -qE ":${API_PORT}(\s|$)"; then
            echo "⚠️ ${APP_NAME} components are already running."
            exit 1
        fi
        cd $APP_DIR
        nohup npm run dev:all > $LOG_FILE 2>&1 &
        echo "⏳ ${APP_NAME} stack starting... (verifying in 5s)"
        sleep 5
        UI_UP=$(ss -lnt | grep -cE ":${PORT}(\s|$)")
        API_UP=$(ss -lnt | grep -cE ":${API_PORT}(\s|$)")
        if [ "$UI_UP" -gt 0 ] && [ "$API_UP" -gt 0 ]; then
            echo "✅ ${APP_NAME} is FULLY UP (UI: ${PORT} | API: ${API_PORT})"
        elif [ "$UI_UP" -gt 0 ] || [ "$API_UP" -gt 0 ]; then
            echo "⚠️ ${APP_NAME} is DEGRADED (UI: $([ "$UI_UP" -gt 0 ] && echo UP || echo DOWN) | API: $([ "$API_UP" -gt 0 ] && echo UP || echo DOWN)). Last log:"
            tail -n 10 $LOG_FILE 2>/dev/null
        else
            echo "❌ ${APP_NAME} failed to start. Last log:"
            tail -n 10 $LOG_FILE 2>/dev/null
        fi
        ;;
    stop)
        echo "🛑 Stopping ${APP_NAME} Stack..."
        fuser -k ${PORT}/tcp > /dev/null 2>&1
        fuser -k ${API_PORT}/tcp > /dev/null 2>&1
        echo "✅ ${APP_NAME} processes terminated."
        ;;
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    status)
        PID_UI=$(ss -lntp | grep -E ":${PORT}(\s|$)" | grep -oP 'pid=\K\d+' | head -n 1)
        PID_API=$(ss -lntp | grep -E ":${API_PORT}(\s|$)" | grep -oP 'pid=\K\d+' | head -n 1)
        
        if [ -n "$PID_UI" ] && [ -n "$PID_API" ]; then
            echo "✅ ${APP_NAME} is FULLY UP (UI: $PID_UI | API: $PID_API)"
        elif [ -n "$PID_UI" ] || [ -n "$PID_API" ]; then
            echo "⚠️ ${APP_NAME} is DEGRADED (UI: ${PID_UI:-DOWN} | API: ${PID_API:-DOWN})"
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
