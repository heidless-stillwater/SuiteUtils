#!/bin/bash
APP_NAME="Persona"
APP_DIR="/home/heidless/projects/Persona"
TMUX_SESSION="stillwater"
TMUX_PANE="5"
PORT=3005

case "$1" in
    start)
        echo "Starting ${APP_NAME} on Port ${PORT}..."
        tmux send-keys -t $TMUX_SESSION:$TMUX_PANE C-c Enter
        tmux send-keys -t $TMUX_SESSION:$TMUX_PANE "cd $APP_DIR && ./scripts/start-persona.sh ${PORT}" Enter
        echo "✅ ${APP_NAME} boot signal sent to tmux."
        ;;
    stop)
        echo "Stopping ${APP_NAME}..."
        tmux send-keys -t $TMUX_SESSION:$TMUX_PANE C-c Enter
        echo "✅ ${APP_NAME} stop signal sent."
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
        echo "--- Terminal Output ---"
        tmux capture-pane -pt $TMUX_SESSION:$TMUX_PANE | tail -n 10
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
esac
