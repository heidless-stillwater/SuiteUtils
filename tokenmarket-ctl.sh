#!/bin/bash
APP_NAME="TokenMarket"
APP_DIR="/home/heidless/projects/TokenMarket"
TMUX_SESSION="stillwater"
PORT=3007
LOG_FILE="/home/heidless/projects/SuiteUtils/tokenmarket.log"

case "$1" in
    start)
        echo "🚀 Starting ${APP_NAME} on Port ${PORT}..."
        if ss -lnt | grep -qE ":${PORT}(\s|$)"; then
            echo "⚠️ Port ${PORT} is currently occupied."
            if [ -t 0 ]; then
                read -p "Do you want to kill the existing process and start ${APP_NAME}? (y/n) " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    echo "🔪 Killing process on port ${PORT}..."
                    fuser -k ${PORT}/tcp > /dev/null 2>&1
                    sleep 2
                else
                    echo "✅ Start aborted by user (treating as already running)."
                    exit 0
                fi
            else
                echo "✅ Port ${PORT} already occupied (non-interactive shell). Treating as already running."
                exit 0
            fi
        fi
        cd $APP_DIR
        nohup env PORT=${PORT} npm run dev -- --port ${PORT} > $LOG_FILE 2>&1 &
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
