#!/bin/bash
# Stillwater LM Studio Local Controller
# Unset leaked environment project variables to force loading from active config (.env)
unset GOOGLE_CLOUD_PROJECT
unset CLOUDSDK_CORE_PROJECT

# Add LM Studio bin path to PATH
export PATH="/home/heidless/.lmstudio/bin:$PATH"

APP_NAME="LM Studio Service"
PORT=1234
LOG_FILE="/home/heidless/projects/SuiteUtils/logs/lmstudio.log"

case "$1" in
    start)
        echo "🚀 Starting ${APP_NAME} on Port ${PORT}..."
        if ss -lnt | grep -qE ":${PORT}(\s|$)"; then
            echo "⚠️ ${APP_NAME} is already running on port ${PORT}."
            exit 0
        fi

        # Verify LM Studio CLI installation
        if ! command -v lms &> /dev/null; then
            echo "❌ Error: LM Studio CLI ('lms') command not found in WSL2."
            echo "💡 Please run inside WSL2: npm install -g @lmstudio/cli"
            exit 1
        fi

        mkdir -p "$(dirname "$LOG_FILE")"
        
        # Start LM Studio server headless daemon
        timeout 15s lms server start > "$LOG_FILE" 2>&1
        
        echo "⏳ ${APP_NAME} starting... (verifying port ${PORT})"
        success=false
        for i in {1..15}; do
            if ss -lnt | grep -qE ":${PORT}(\s|$)"; then
                success=true
                break
            fi
            sleep 1
        done

        if [ "$success" = "true" ]; then
            echo "✅ ${APP_NAME} is UP on port ${PORT}"
        else
            echo "❌ ${APP_NAME} failed to start on port ${PORT}. Last log:"
            tail -n 10 "$LOG_FILE" 2>/dev/null
            exit 1
        fi
        ;;
    stop)
        echo "🛑 Stopping ${APP_NAME}..."
        
        if command -v lms &> /dev/null; then
            lms server stop > /dev/null 2>&1
        fi
        pkill -f "lms server" > /dev/null 2>&1
        pkill -f "llmster" > /dev/null 2>&1
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
        tail -n 10 "$LOG_FILE" 2>/dev/null || echo "[No log file found]"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
esac
