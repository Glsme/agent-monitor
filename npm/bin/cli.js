#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");

const VERSION = "0.1.0";
const REPO = "Glsme/agent-monitor";
const APP_NAME = "Agent Monitor.app";
const APP_DIR = path.join(os.homedir(), "Applications");
const APP_PATH = path.join(APP_DIR, APP_NAME);
const INSTALL_DIR = path.join(os.homedir(), ".agent-monitor");
const DAEMON_DIR = path.join(INSTALL_DIR, "daemon");
const PLIST_NAME = "com.agent-monitor.daemon";
const LAUNCH_AGENTS = path.join(os.homedir(), "Library", "LaunchAgents");

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const NC = "\x1b[0m";

const args = process.argv.slice(2);
const command = args[0] || "install";

function log(msg) {
  console.log(msg);
}

function getArch() {
  const arch = os.arch();
  if (arch === "arm64") return "arm64";
  if (arch === "x64") return "x64";
  return null;
}

function isInstalled() {
  return fs.existsSync(APP_PATH);
}

function download(url) {
  return new Promise((resolve, reject) => {
    const follow = (url, redirects = 0) => {
      if (redirects > 5) return reject(new Error("Too many redirects"));
      https
        .get(url, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return follow(res.headers.location, redirects + 1);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}`));
          }
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => resolve(Buffer.concat(chunks)));
          res.on("error", reject);
        })
        .on("error", reject);
    };
    follow(url);
  });
}

async function installApp() {
  const arch = getArch();
  if (!arch) {
    log(`${RED}Unsupported architecture: ${os.arch()}${NC}`);
    log("Please install from source: https://github.com/Glsme/agent-monitor#manual-install-development");
    process.exit(1);
  }

  const assetName = `AgentMonitor-macos-${arch}.zip`;
  const url = `https://github.com/${REPO}/releases/download/v${VERSION}/${assetName}`;

  log(`${CYAN}Agent Monitor${NC} v${VERSION}\n`);
  log(`${YELLOW}[1/3]${NC} Downloading ${assetName}...`);

  try {
    const data = await download(url);
    const zipPath = path.join(os.tmpdir(), "agent-monitor-download.zip");
    fs.writeFileSync(zipPath, data);
    log(`  ✓ Downloaded (${(data.length / 1024 / 1024).toFixed(1)} MB)`);

    log(`${YELLOW}[2/3]${NC} Installing...`);
    fs.mkdirSync(APP_DIR, { recursive: true });

    // Remove old app if exists
    if (fs.existsSync(APP_PATH)) {
      execSync(`rm -rf "${APP_PATH}"`);
    }

    // Extract
    const tmpExtract = path.join(os.tmpdir(), "agent-monitor-extract");
    execSync(`rm -rf "${tmpExtract}" && mkdir -p "${tmpExtract}"`);
    execSync(`unzip -q "${zipPath}" -d "${tmpExtract}"`);
    execSync(`cp -R "${tmpExtract}/${APP_NAME}" "${APP_DIR}/"`);
    execSync(`rm -rf "${tmpExtract}" "${zipPath}"`);

    log(`  ✓ Installed to ${APP_PATH}`);

    // Setup daemon
    log(`${YELLOW}[3/3]${NC} Setting up auto-launch daemon...`);
    setupDaemon();

    log(`\n${GREEN}Installation complete!${NC}\n`);
    log(`  ${CYAN}open ~/Applications/Agent\\ Monitor.app${NC}  — launch now`);
    log(`  ${CYAN}agent-monitor open${NC}                      — launch via CLI`);
    log(`  ${CYAN}agent-monitor uninstall${NC}                  — remove\n`);
  } catch (err) {
    log(`${RED}Download failed: ${err.message}${NC}`);
    log(`\nFallback: build from source`);
    log(`  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/scripts/install.sh | bash`);
    process.exit(1);
  }
}

function setupDaemon() {
  try {
    fs.mkdirSync(DAEMON_DIR, { recursive: true });

    // Download daemon script
    const daemonScript = `#!/bin/bash
APP_PATH="${APP_PATH}"
TEAMS_DIR="$HOME/.claude/teams"

while true; do
  if [ -d "$TEAMS_DIR" ] && [ "$(ls -A "$TEAMS_DIR" 2>/dev/null)" ]; then
    if ! pgrep -f "Agent Monitor" > /dev/null 2>&1; then
      open "$APP_PATH"
    fi
  fi
  sleep 5
done
`;
    const daemonPath = path.join(DAEMON_DIR, "agent-monitor-daemon.sh");
    fs.writeFileSync(daemonPath, daemonScript, { mode: 0o755 });

    // Create LaunchAgent plist
    fs.mkdirSync(LAUNCH_AGENTS, { recursive: true });
    const plistPath = path.join(LAUNCH_AGENTS, `${PLIST_NAME}.plist`);

    // Unload existing
    try { execSync(`launchctl unload "${plistPath}" 2>/dev/null`); } catch {}

    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${daemonPath}</string>
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
</plist>`;
    fs.writeFileSync(plistPath, plist);
    execSync(`launchctl load "${plistPath}"`);
    log("  ✓ Auto-launch daemon activated");
  } catch (err) {
    log(`  ${YELLOW}Warning: Daemon setup failed (${err.message}). App will need manual launch.${NC}`);
  }
}

function openApp() {
  if (!isInstalled()) {
    log(`${YELLOW}Agent Monitor is not installed. Installing...${NC}\n`);
    return installApp().then(() => {
      execSync(`open "${APP_PATH}"`);
    });
  }
  execSync(`open "${APP_PATH}"`);
  log(`${GREEN}Agent Monitor launched.${NC}`);
}

function uninstall() {
  log(`${CYAN}Uninstalling Agent Monitor...${NC}\n`);

  // Stop daemon
  const plistPath = path.join(LAUNCH_AGENTS, `${PLIST_NAME}.plist`);
  try { execSync(`launchctl unload "${plistPath}" 2>/dev/null`); } catch {}

  // Remove files
  const targets = [APP_PATH, INSTALL_DIR, plistPath];
  for (const t of targets) {
    if (fs.existsSync(t)) {
      execSync(`rm -rf "${t}"`);
      log(`  ✓ Removed ${t}`);
    }
  }

  log(`\n${GREEN}Agent Monitor has been uninstalled.${NC}`);
}

function showHelp() {
  log(`${CYAN}Agent Monitor${NC} v${VERSION}`);
  log(`Real-time visualization for Claude Code Agent Teams\n`);
  log("Usage: agent-monitor [command]\n");
  log("Commands:");
  log("  install     Download and install (default)");
  log("  open        Launch the app (installs if needed)");
  log("  uninstall   Remove app and daemon");
  log("  status      Check installation status");
  log("  help        Show this help message");
}

function showStatus() {
  log(`${CYAN}Agent Monitor${NC} v${VERSION}\n`);
  log(`  App installed:  ${isInstalled() ? `${GREEN}Yes${NC}` : `${RED}No${NC}`}`);
  log(`  App path:       ${APP_PATH}`);

  const plistPath = path.join(LAUNCH_AGENTS, `${PLIST_NAME}.plist`);
  const daemonActive = fs.existsSync(plistPath);
  log(`  Daemon active:  ${daemonActive ? `${GREEN}Yes${NC}` : `${RED}No${NC}`}`);
}

// ---- Main ----
async function main() {
  if (os.platform() !== "darwin") {
    log(`${RED}Error: Agent Monitor currently supports macOS only.${NC}`);
    process.exit(1);
  }

  switch (command) {
    case "install":
      if (isInstalled()) {
        log(`${GREEN}Agent Monitor is already installed.${NC}`);
        log(`Use ${CYAN}agent-monitor open${NC} to launch, or ${CYAN}agent-monitor install${NC} with --force to reinstall.`);
        if (args.includes("--force")) await installApp();
      } else {
        await installApp();
      }
      break;
    case "open":
      await openApp();
      break;
    case "uninstall":
      uninstall();
      break;
    case "status":
      showStatus();
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      log(`${RED}Unknown command: ${command}${NC}\n`);
      showHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  log(`${RED}Error: ${err.message}${NC}`);
  process.exit(1);
});
