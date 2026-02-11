#!/bin/bash
set -e

# ============================================
#  Agent Monitor - Installer
#  Claude Code Agent Team GUI Monitor
# ============================================

REPO_URL="https://github.com/Glsme/agent-monitor.git"
INSTALL_DIR="$HOME/.agent-monitor"
APP_DIR="$HOME/Applications"
DAEMON_DIR="$INSTALL_DIR/daemon"
PLIST_NAME="com.agent-monitor.daemon"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_banner() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}     ${GREEN}Agent Monitor${NC} - Installer        ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}  Claude Code Team GUI Monitor        ${CYAN}║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
  echo ""
}

check_deps() {
  echo -e "${YELLOW}[1/5]${NC} Checking dependencies..."

  # Check Node.js
  if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is required. Install from https://nodejs.org${NC}"
    exit 1
  fi
  echo "  ✓ Node.js $(node --version)"

  # Check npm
  if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is required.${NC}"
    exit 1
  fi
  echo "  ✓ npm $(npm --version)"

  # Check/Install Rust
  if ! command -v cargo &> /dev/null; then
    if [ -f "$HOME/.cargo/bin/cargo" ]; then
      export PATH="$HOME/.cargo/bin:$PATH"
    else
      echo "  Installing Rust..."
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
      export PATH="$HOME/.cargo/bin:$PATH"
    fi
  fi
  echo "  ✓ Rust $(rustc --version 2>/dev/null | cut -d' ' -f2)"

  # Check Xcode Command Line Tools (macOS)
  if [[ "$(uname)" == "Darwin" ]]; then
    if ! xcode-select -p &> /dev/null; then
      echo "  Installing Xcode Command Line Tools..."
      xcode-select --install 2>/dev/null || true
      echo -e "${YELLOW}  Please complete Xcode CLI tools installation and re-run this script.${NC}"
      exit 1
    fi
    echo "  ✓ Xcode CLI Tools"
  fi
}

clone_or_update() {
  echo -e "${YELLOW}[2/5]${NC} Getting source code..."

  if [ -d "$INSTALL_DIR/src" ]; then
    echo "  Updating existing installation..."
    cd "$INSTALL_DIR/src"
    git pull --ff-only 2>/dev/null || true
  else
    mkdir -p "$INSTALL_DIR"
    # If run from local source (not git clone)
    if [ -f "./package.json" ] && grep -q "agent-monitor" "./package.json" 2>/dev/null; then
      echo "  Using local source..."
      cp -R "." "$INSTALL_DIR/src"
    else
      echo "  Cloning repository..."
      git clone "$REPO_URL" "$INSTALL_DIR/src" 2>/dev/null || {
        echo -e "${RED}Failed to clone repo. If installing locally, run this script from the project directory.${NC}"
        exit 1
      }
    fi
  fi

  cd "$INSTALL_DIR/src"
}

build_app() {
  echo -e "${YELLOW}[3/5]${NC} Building application..."
  export PATH="$HOME/.cargo/bin:$PATH"

  echo "  Installing npm dependencies..."
  npm install --silent 2>/dev/null

  echo "  Building Tauri app (this may take a few minutes on first run)..."
  npx tauri build 2>&1 | tail -5

  # Find the built app
  BUILT_APP=$(find src-tauri/target/release/bundle -name "*.app" -maxdepth 3 2>/dev/null | head -1)
  if [ -z "$BUILT_APP" ]; then
    echo -e "${RED}Build failed. Check the output above.${NC}"
    exit 1
  fi

  echo "  ✓ Built: $BUILT_APP"
}

install_app() {
  echo -e "${YELLOW}[4/5]${NC} Installing..."

  # Copy app to ~/Applications
  mkdir -p "$APP_DIR"
  if [ -d "$APP_DIR/Agent Monitor.app" ]; then
    rm -rf "$APP_DIR/Agent Monitor.app"
  fi
  cp -R "$BUILT_APP" "$APP_DIR/"
  echo "  ✓ App installed to $APP_DIR/Agent Monitor.app"

  # Install daemon script
  mkdir -p "$DAEMON_DIR"
  cp scripts/agent-monitor-daemon.sh "$DAEMON_DIR/"
  chmod +x "$DAEMON_DIR/agent-monitor-daemon.sh"
  echo "  ✓ Daemon installed"
}

setup_autostart() {
  echo -e "${YELLOW}[5/5]${NC} Setting up auto-start..."

  mkdir -p "$LAUNCH_AGENTS"

  # Stop existing daemon if running
  launchctl unload "$LAUNCH_AGENTS/$PLIST_NAME.plist" 2>/dev/null || true

  # Create plist with correct path
  cat > "$LAUNCH_AGENTS/$PLIST_NAME.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$DAEMON_DIR/agent-monitor-daemon.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/agent-monitor-daemon.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/agent-monitor-daemon.log</string>
</dict>
</plist>
EOF

  # Load the daemon
  launchctl load "$LAUNCH_AGENTS/$PLIST_NAME.plist"
  echo "  ✓ Auto-start daemon activated"
}

print_done() {
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║     Installation Complete! 🎉        ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  App location:  ${CYAN}$APP_DIR/Agent Monitor.app${NC}"
  echo -e "  Auto-start:    ${CYAN}Enabled (LaunchAgent)${NC}"
  echo ""
  echo -e "  The app will ${GREEN}automatically launch${NC} when you"
  echo -e "  create a Claude Code agent team."
  echo ""
  echo -e "  ${YELLOW}Commands:${NC}"
  echo -e "    Open now:      ${CYAN}open ~/Applications/Agent\\ Monitor.app${NC}"
  echo -e "    View logs:     ${CYAN}tail -f /tmp/agent-monitor-daemon.log${NC}"
  echo -e "    Uninstall:     ${CYAN}~/.agent-monitor/src/scripts/uninstall.sh${NC}"
  echo ""
}

# ---- Main ----
print_banner
check_deps
clone_or_update
build_app
install_app
setup_autostart
print_done
