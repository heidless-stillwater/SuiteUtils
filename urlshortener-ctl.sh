#!/bin/bash
# Unset leaked environment project variables to force loading from active config (.env)
unset GOOGLE_CLOUD_PROJECT
unset CLOUDSDK_CORE_PROJECT
APP_NAME="URLShortener"
APP_DIR="/home/heidless/projects/URLShortener"
TMUX_SESSION="stillwater"
PORT=3006
LOG_FILE="/home/heidless/projects/SuiteUtils/urlshortener.log"

case "$1" in
    start)
        echo "🚀 Starting ${APP_NAME} on Port ${PORT}..."
        if ss -lnt | grep -qE ":${PORT}(\s|$)"; then
            echo "⚠️ ${APP_NAME} is already running on port ${PORT}."
            exit 1
        fi
        cd $APP_DIR
        nohup env PORT=${PORT} SERVICE_DATABASE_ID="urlshortener-db-0" FIREBASE_DATABASE_ID="urlshortener-db-0" NEXT_PUBLIC_FIREBASE_DATABASE_ID="urlshortener-db-0" GOOGLE_APPLICATION_CREDENTIALS="/home/heidless/projects/SuiteUtils/suite-admin-sovereign.json" npm start -- -p ${PORT} > $LOG_FILE 2>&1 &
        echo "⏳ ${APP_NAME} starting... (verifying in 5s)"
        sleep 5
        if ss -lnt | grep -qE ":${PORT}(\s|$)"; then
            echo "✅ ${APP_NAME} is UP on port ${PORT}"
        else
            echo "❌ ${APP_NAME} failed to start on port ${PORT}. Last log:"
            tail -n 10 $LOG_FILE 2>/dev/null
        fi
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
        PID=$(ss -lntp | grep -E ":${PORT}(\s|$)" | grep -oP 'pid=\K\d+' | head -n 1)
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
