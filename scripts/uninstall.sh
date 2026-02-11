#!/bin/bash
set -e

PLIST_NAME="com.agent-monitor.daemon"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
INSTALL_DIR="$HOME/.agent-monitor"
APP_DIR="$HOME/Applications"

echo "Uninstalling Agent Monitor..."

# Stop daemon
launchctl unload "$LAUNCH_AGENTS/$PLIST_NAME.plist" 2>/dev/null || true
rm -f "$LAUNCH_AGENTS/$PLIST_NAME.plist"
echo "  ✓ Daemon stopped and removed"

# Remove app
rm -rf "$APP_DIR/Agent Monitor.app"
echo "  ✓ App removed"

# Remove install directory
rm -rf "$INSTALL_DIR"
echo "  ✓ Installation files removed"

echo ""
echo "Agent Monitor has been uninstalled."
