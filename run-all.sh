#!/usr/bin/env bash
# Manage start/stop/restart/status for local services: shared, mobile, web
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS_DIR="$ROOT_DIR/.pids"
LOGS_DIR="$ROOT_DIR/.logs"
mkdir -p "$PIDS_DIR" "$LOGS_DIR"

services=(
  "shared:shared-graphql:npm run start:example"
  "mobile:mobile-bff:node -r ts-node/register ./src/server.ts"
  "web:web-bff:node -r ts-node/register ./src/server.ts"
)

start_service() {
  name="$1"; cwd="$2"; cmd="$3"
  pidfile="$PIDS_DIR/$name.pid"
  logfile="$LOGS_DIR/$name.log"

  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      echo "$name already running (pid $pid)"
      return 0
    else
      echo "Found stale pidfile for $name, removing"
      rm -f "$pidfile"
    fi
  fi

  echo "Starting $name: $cmd (cwd: $cwd)"
  (cd "$ROOT_DIR/$cwd" && bash -lc "$cmd") &> "$logfile" &
  pid=$!
  echo "$pid" > "$pidfile"
  echo "$name started (pid $pid), logs: $logfile"
}

stop_service() {
  name="$1"
  pidfile="$PIDS_DIR/$name.pid"
  if [ ! -f "$pidfile" ]; then
    echo "No pidfile for $name, trying to find process by name"
    pids=$(pgrep -f "$name" || true)
    if [ -z "$pids" ]; then
      echo "$name not running"
      return 0
    fi
    echo "$pids" | xargs -r kill
    return 0
  fi
  pid=$(cat "$pidfile")
  if kill -0 "$pid" 2>/dev/null; then
    echo "Stopping $name (pid $pid)"
    kill "$pid"
    # wait up to 5s
    for i in {1..10}; do
      if kill -0 "$pid" 2>/dev/null; then
        sleep 0.5
      else
        break
      fi
    done
    if kill -0 "$pid" 2>/dev/null; then
      echo "$name did not stop, killing..."
      kill -9 "$pid"
    fi
  else
    echo "Process $pid not found, removing pidfile"
  fi
  rm -f "$pidfile"
}

status_service() {
  name="$1"; pidfile="$PIDS_DIR/$name.pid"
  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      echo "$name running (pid $pid)"
    else
      echo "$name pidfile exists but process not running"
    fi
  else
    echo "$name not running (no pidfile)"
  fi
}

case "${1:-restart}" in
  start)
    for s in "${services[@]}"; do
      IFS=":" read -r name cwd cmd <<< "$s"
      start_service "$name" "$cwd" "$cmd"
    done
    ;;
  stop)
    for s in "${services[@]}"; do
      IFS=":" read -r name cwd cmd <<< "$s"
      stop_service "$name"
    done
    ;;
  restart)
    echo "Stopping all services..."
    for s in "${services[@]}"; do
      IFS=":" read -r name cwd cmd <<< "$s"
      stop_service "$name"
    done
    sleep 0.5
    echo "Starting all services..."
    for s in "${services[@]}"; do
      IFS=":" read -r name cwd cmd <<< "$s"
      start_service "$name" "$cwd" "$cmd"
    done
    ;;
  status)
    for s in "${services[@]}"; do
      IFS=":" read -r name cwd cmd <<< "$s"
      status_service "$name"
    done
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 2
    ;;
esac
