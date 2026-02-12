import { describe, it, expect } from "vitest";
import path from "path";
import { CLI_JS, evalGetArch, extractFunction } from "./helpers.js";

// ---- 1. Platform detection ----
describe("Platform detection", () => {
  it("IS_WINDOWS is set from os.platform() === win32", () => {
    expect(CLI_JS).toContain('const IS_WINDOWS = os.platform() === "win32"');
  });

  it("IS_MACOS is set from os.platform() === darwin", () => {
    expect(CLI_JS).toContain('const IS_MACOS = os.platform() === "darwin"');
  });
});

// ---- 2. Path resolution ----
describe("Path resolution", () => {
  it("APP_NAME is Agent Monitor.exe on Windows", () => {
    expect(CLI_JS).toContain(
      'const APP_NAME = IS_WINDOWS ? "Agent Monitor.exe" : "Agent Monitor.app"'
    );
  });

  it("APP_DIR uses LOCALAPPDATA on Windows", () => {
    expect(CLI_JS).toContain("process.env.LOCALAPPDATA");
  });

  it("APP_DIR uses ~/Applications on macOS", () => {
    expect(CLI_JS).toMatch(
      /APP_DIR\s*=\s*IS_WINDOWS[\s\S]*?path\.join\(os\.homedir\(\),\s*"Applications"\)/
    );
  });

  // ---- 12. LOCALAPPDATA fallback ----
  it("LOCALAPPDATA falls back to homedir/AppData/Local when env var missing", () => {
    expect(CLI_JS).toMatch(
      /process\.env\.LOCALAPPDATA\s*\|\|\s*path\.join\(os\.homedir\(\),\s*"AppData",\s*"Local"\)/
    );
  });
});

// ---- 3. getArch() ----
describe("getArch()", () => {
  it("returns arm64 for arm64", () => {
    expect(evalGetArch("arm64")).toBe("arm64");
  });

  it("returns x64 for x64", () => {
    expect(evalGetArch("x64")).toBe("x64");
  });

  it("returns null for unsupported architectures", () => {
    expect(evalGetArch("ia32")).toBeNull();
    expect(evalGetArch("mips")).toBeNull();
  });
});

// ---- 4. findFile() ----
describe("findFile()", () => {
  // Reimplement findFile with injectable fs for testing
  function findFile(dir, name, readdirSync) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.name === name) return full;
      if (entry.isDirectory()) {
        const found = findFile(full, name, readdirSync);
        if (found) return found;
      }
    }
    return null;
  }

  it("finds a file in nested directories", () => {
    const mockReaddir = (dir) => {
      const tree = {
        root: [
          {
            name: "subdir",
            isDirectory: () => true,
          },
        ],
        [path.join("root", "subdir")]: [
          {
            name: "Agent Monitor.exe",
            isDirectory: () => false,
          },
        ],
      };
      return tree[dir] || [];
    };
    const result = findFile("root", "Agent Monitor.exe", mockReaddir);
    expect(result).toBe(path.join("root", "subdir", "Agent Monitor.exe"));
  });

  it("returns null when file is not found", () => {
    const mockReaddir = (dir) => {
      if (dir === "root") {
        return [{ name: "other.txt", isDirectory: () => false }];
      }
      return [];
    };
    const result = findFile("root", "Agent Monitor.exe", mockReaddir);
    expect(result).toBeNull();
  });
});

// ---- 5. setupDaemon() Windows ----
describe("setupDaemon() Windows path", () => {
  // setupDaemon contains embedded template literals with PS/bash code that confuse
  // function extraction, so we search CLI_JS directly for content unique to setupDaemon.

  it("generates a PowerShell daemon script with Write-Log function", () => {
    // The inline PS1 daemon script in setupDaemon contains Write-Log
    expect(CLI_JS).toContain("function Write-Log");
  });

  it("daemon script checks config.json to detect active teams", () => {
    // Both Windows and macOS daemon scripts check for config.json
    const setupStart = CLI_JS.indexOf("function setupDaemon()");
    const setupSection = CLI_JS.slice(setupStart, setupStart + 5000);
    const configMatches = setupSection.match(/config\.json/g);
    expect(configMatches).not.toBeNull();
    expect(configMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("daemon script uses path-based Get-Process", () => {
    expect(CLI_JS).toMatch(/\$_\.Path\s+-eq\s+\$APP_PATH/);
  });

  it("calls schtasks with RemoteSigned execution policy", () => {
    // setupDaemon registers a scheduled task with RemoteSigned
    const setupStart = CLI_JS.indexOf("function setupDaemon()");
    const setupSection = CLI_JS.slice(setupStart, setupStart + 5000);
    expect(setupSection).toContain("RemoteSigned");
    expect(setupSection).toContain("schtasks /Create");
  });
});

// ---- 6. setupDaemon() macOS ----
describe("setupDaemon() macOS path", () => {
  it("generates bash daemon script with has_active_teams()", () => {
    const setupStart = CLI_JS.indexOf("function setupDaemon()");
    const setupSection = CLI_JS.slice(setupStart, setupStart + 5000);
    expect(setupSection).toContain("has_active_teams");
  });

  it("creates a LaunchAgent plist", () => {
    const setupStart = CLI_JS.indexOf("function setupDaemon()");
    const setupSection = CLI_JS.slice(setupStart, setupStart + 8000);
    // Uses PLIST_NAME variable (resolves to "com.agent-monitor.daemon")
    expect(setupSection).toContain("PLIST_NAME");
    expect(setupSection).toContain("RunAtLoad");
  });

  it("calls launchctl load", () => {
    const setupStart = CLI_JS.indexOf("function setupDaemon()");
    const setupSection = CLI_JS.slice(setupStart, setupStart + 5000);
    expect(setupSection).toContain("launchctl load");
  });
});

// ---- 7. launchApp() ----
describe("launchApp()", () => {
  const launchApp = extractFunction(CLI_JS, "launchApp");

  it("Windows path uses spawn with detached option", () => {
    expect(launchApp).toContain("spawn(APP_PATH");
    expect(launchApp).toContain("detached: true");
  });

  it("macOS path uses execSync with open command", () => {
    expect(launchApp).toMatch(/execSync\(`open/);
  });
});

// ---- 8. uninstall() Windows ----
describe("uninstall() Windows path", () => {
  const uninstallFn = extractFunction(CLI_JS, "uninstall");

  it("deletes scheduled task", () => {
    expect(uninstallFn).toContain("schtasks /Delete /TN");
    // Uses TASK_NAME variable which resolves to "AgentMonitorDaemon"
    expect(uninstallFn).toContain("TASK_NAME");
  });

  it("kills running processes before file removal", () => {
    // Process killing should appear before file removal loop
    const killIndex = uninstallFn.indexOf("Stop-Process");
    const targetsIndex = uninstallFn.indexOf("const targets =");
    expect(killIndex).toBeGreaterThan(-1);
    expect(targetsIndex).toBeGreaterThan(-1);
    expect(killIndex).toBeLessThan(targetsIndex);
  });

  it("uses path-based Get-Process to find running app", () => {
    expect(uninstallFn).toMatch(/\$_\.Path\s+-eq/);
  });
});

// ---- 9. uninstall() macOS ----
describe("uninstall() macOS path", () => {
  const uninstallFn = extractFunction(CLI_JS, "uninstall");

  it("calls launchctl unload", () => {
    expect(uninstallFn).toContain("launchctl unload");
  });

  it("removes plist file", () => {
    expect(uninstallFn).toContain("fs.rmSync(plistPath");
  });
});

// ---- 10. installApp() fallback messages ----
describe("installApp() fallback messages", () => {
  const installApp = extractFunction(CLI_JS, "installApp");

  it("Windows fallback shows irm (Invoke-RestMethod)", () => {
    expect(installApp).toContain("irm https://raw.githubusercontent.com/");
    expect(installApp).toContain("install.ps1 | iex");
  });

  it("macOS fallback shows curl", () => {
    expect(installApp).toContain("curl -fsSL https://raw.githubusercontent.com/");
    expect(installApp).toContain("install.sh | bash");
  });
});

// ---- 11. Post-install output ----
describe("installApp() post-install output", () => {
  const installApp = extractFunction(CLI_JS, "installApp");

  it("Windows output shows agent-monitor open/status/uninstall commands", () => {
    expect(installApp).toContain("agent-monitor open");
    expect(installApp).toContain("agent-monitor status");
    expect(installApp).toContain("agent-monitor uninstall");
  });

  it("macOS output shows native open ~/Applications path", () => {
    expect(installApp).toContain("open ~/Applications/Agent");
  });
});

// ---- 13. Asset name ----
describe("Asset name construction", () => {
  const installApp = extractFunction(CLI_JS, "installApp");

  it("Windows asset is AgentMonitor-windows-{arch}.zip", () => {
    expect(installApp).toContain("AgentMonitor-windows-");
    expect(installApp).toMatch(/AgentMonitor-windows-\$\{arch\}\.zip/);
  });

  it("macOS asset is AgentMonitor-macos-{arch}.zip", () => {
    expect(installApp).toContain("AgentMonitor-macos-");
    expect(installApp).toMatch(/AgentMonitor-macos-\$\{arch\}\.zip/);
  });
});

// ---- 14. Windows extraction fallback ----
describe("Windows extraction fallback", () => {
  const installApp = extractFunction(CLI_JS, "installApp");

  it("searches subdirectories when exe not at root of zip", () => {
    expect(installApp).toContain("findFile(tmpExtract, APP_NAME)");
  });

  it("throws error when executable not found in archive", () => {
    expect(installApp).toContain("Could not find executable in archive");
  });
});

// ---- 15. showStatus() ----
describe("showStatus()", () => {
  const showStatus = extractFunction(CLI_JS, "showStatus");

  it("Windows queries schtasks to check daemon status", () => {
    expect(showStatus).toContain("schtasks /Query");
    // Uses TASK_NAME variable (resolves to "AgentMonitorDaemon")
    expect(showStatus).toContain("TASK_NAME");
  });

  it("macOS checks plist file existence for daemon status", () => {
    expect(showStatus).toContain("fs.existsSync(plistPath)");
  });

  it("displays platform info", () => {
    expect(showStatus).toContain("os.platform()");
  });
});

// ---- main() platform guard ----
describe("main() platform guard", () => {
  it("rejects unsupported platforms (not macOS and not Windows)", () => {
    const mainFn = extractFunction(CLI_JS, "main");
    expect(mainFn).toContain("!IS_MACOS && !IS_WINDOWS");
    expect(mainFn).toContain("supports macOS and Windows only");
  });
});

// ---- Command routing ----
describe("command routing", () => {
  it("defaults to install when no command given", () => {
    expect(CLI_JS).toContain('const command = args[0] || "install"');
  });

  it("supports help aliases (help, --help, -h)", () => {
    const mainFn = extractFunction(CLI_JS, "main");
    expect(mainFn).toContain('"help"');
    expect(mainFn).toContain('"--help"');
    expect(mainFn).toContain('"-h"');
  });
});
