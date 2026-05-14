#!/bin/bash
APP_NAME="Resources"
APP_DIR="/home/heidless/projects/PromptResources"
TMUX_SESSION="stillwater"
PORT=3002
LOG_FILE="/home/heidless/projects/SuiteUtils/resources.log"

case "$1" in
    start)
        echo "🚀 Starting ${APP_NAME} on Port ${PORT}..."
        if fuser ${PORT}/tcp >/dev/null 2>&1; then
            echo "⚠️ ${APP_NAME} is already running on port ${PORT}."
            exit 1
        fi
        cd $APP_DIR
        nohup env PORT=${PORT} npm run dev -- -p ${PORT} > $LOG_FILE 2>&1 &
        echo "✅ ${APP_NAME} background process initialized."
        ;;
    stop)
        echo "🛑 Stopping ${APP_NAME}..."
        fuser -k ${PORT}/tcp > /dev/null 2>&1
        echo "✅ ${APP_NAME} processes terminated."
        ;;
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    status)
        PID=$(fuser ${PORT}/tcp 2>/dev/null | awk '{print $1}')
        if [ -n "$PID" ]; then
            echo "✅ ${APP_NAME} is UP (PID: $PID) on Port ${PORT}"
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
