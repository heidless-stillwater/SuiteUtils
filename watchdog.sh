#!/bin/bash
# Sovereign Bridge Watchdog
# Ensures Persona Bridge stays ONLINE forever.

PORT=3006
LOG_FILE="/home/heidless/projects/Persona/bridge/watchdog.log"
BRIDGE_DIR="/home/heidless/projects/Persona/bridge"

echo "[$(date)] Watchdog Started." >> $LOG_FILE

while true; do
  # Check if port 3006 is responding
  if ! curl -s localhost:$PORT/health > /dev/null; then
    echo "[$(date)] BRIDGE OFFLINE. Resurrecting..." >> $LOG_FILE
    
    # Kill any zombie node processes on this port
    fuser -k $PORT/tcp > /dev/null 2>&1
    
    # Start the bridge
    cd $BRIDGE_DIR
    nohup node server.js >> bridge.log 2>&1 &
    
    echo "[$(date)] BRIDGE RESURRECTED." >> $LOG_FILE
  fi
  sleep 10
done
