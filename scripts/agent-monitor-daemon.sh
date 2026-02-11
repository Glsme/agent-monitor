#!/bin/bash
# Agent Monitor Daemon
# Watches ~/.claude/teams/ and launches Agent Monitor when teams exist.
# Installed as a macOS LaunchAgent to run on login.

APP_NAME="Agent Monitor.app"
APP_PATH="$HOME/Applications/$APP_NAME"
TEAMS_DIR="$HOME/.claude/teams"
CHECK_INTERVAL=5  # seconds

log() {
  logger -t "AgentMonitor" "$1"
}

is_app_running() {
  pgrep -f "Agent Monitor" > /dev/null 2>&1
}

has_active_teams() {
  if [ ! -d "$TEAMS_DIR" ]; then
    return 1
  fi
  # Check if any subdirectory has a config.json
  for dir in "$TEAMS_DIR"/*/; do
    if [ -f "${dir}config.json" ]; then
      return 0
    fi
  done
  return 1
}

launch_app() {
  if [ -d "$APP_PATH" ]; then
    log "Teams detected. Launching Agent Monitor."
    open -a "$APP_PATH"
  else
    log "Agent Monitor app not found at $APP_PATH"
  fi
}

log "Daemon started. Watching $TEAMS_DIR"

while true; do
  if has_active_teams; then
    if ! is_app_running; then
      launch_app
    fi
  fi
  sleep "$CHECK_INTERVAL"
done
