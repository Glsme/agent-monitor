import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const DAEMON_PS1 = fs.readFileSync(
  path.join(ROOT, "scripts", "agent-monitor-daemon.ps1"),
  "utf-8"
);
const DAEMON_SH = fs.readFileSync(
  path.join(ROOT, "scripts", "agent-monitor-daemon.sh"),
  "utf-8"
);
const CLI_JS = fs.readFileSync(
  path.join(ROOT, "npm", "bin", "cli.js"),
  "utf-8"
);
const INSTALL_PS1 = fs.readFileSync(
  path.join(ROOT, "scripts", "install.ps1"),
  "utf-8"
);

// All .ps1 files in the project
const PS1_FILES = [
  { name: "agent-monitor-daemon.ps1", content: DAEMON_PS1 },
  { name: "install.ps1", content: INSTALL_PS1 },
  {
    name: "uninstall.ps1",
    content: fs.readFileSync(
      path.join(ROOT, "scripts", "uninstall.ps1"),
      "utf-8"
    ),
  },
];

describe("Daemon detection parity", () => {
  it("both .sh and .ps1 daemons check config.json", () => {
    expect(DAEMON_SH).toContain("config.json");
    expect(DAEMON_PS1).toContain("config.json");
  });

  it("cli.js contains config.json checks in both macOS and Windows daemon sections", () => {
    // The setupDaemon function generates inline daemon scripts for both platforms.
    // Extract its full body by finding the next top-level function after it.
    const setupDaemonStart = CLI_JS.indexOf("function setupDaemon()");
    expect(setupDaemonStart).toBeGreaterThan(-1);

    // The next top-level function after setupDaemon is openApp
    const setupDaemonEnd = CLI_JS.indexOf("\nfunction openApp()", setupDaemonStart);
    expect(setupDaemonEnd).toBeGreaterThan(setupDaemonStart);

    const setupDaemonBody = CLI_JS.slice(setupDaemonStart, setupDaemonEnd);

    // Both the Windows PS1 inline and macOS bash inline should reference config.json
    const configMatches = setupDaemonBody.match(/config\.json/g);
    expect(configMatches).not.toBeNull();
    expect(configMatches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Windows daemon function parity", () => {
  // All 3 Windows daemon sources should contain Write-Log, Test-AppRunning, Test-ActiveTeams
  const REQUIRED_FUNCTIONS = ["Write-Log", "Test-AppRunning", "Test-ActiveTeams"];

  // Extract the Windows daemon script content from cli.js
  function getCliJsWindowsDaemon() {
    const marker = "const daemonScript = `# Agent Monitor Daemon";
    const start = CLI_JS.indexOf(marker);
    if (start === -1) return "";
    const end = CLI_JS.indexOf("`;", start);
    return CLI_JS.slice(start, end);
  }

  // Extract the daemon script content from install.ps1
  function getInstallPs1Daemon() {
    const marker = '$daemonScript = @"';
    const start = INSTALL_PS1.indexOf(marker);
    if (start === -1) return "";
    const end = INSTALL_PS1.indexOf('"@', start + marker.length);
    return INSTALL_PS1.slice(start, end);
  }

  const sources = [
    { name: "cli.js inline daemon", content: getCliJsWindowsDaemon() },
    { name: "install.ps1 inline daemon", content: getInstallPs1Daemon() },
    { name: "standalone daemon.ps1", content: DAEMON_PS1 },
  ];

  for (const fn of REQUIRED_FUNCTIONS) {
    for (const source of sources) {
      it(`${source.name} contains ${fn}`, () => {
        expect(source.content).toContain(fn);
      });
    }
  }
});

describe("ExecutionPolicy consistency", () => {
  it("all ExecutionPolicy references use RemoteSigned", () => {
    const allSources = [CLI_JS, INSTALL_PS1, DAEMON_PS1];
    for (const src of allSources) {
      const matches = src.match(/ExecutionPolicy\s+\w+/g) || [];
      for (const match of matches) {
        expect(match).toMatch(/ExecutionPolicy\s+RemoteSigned/);
      }
    }
  });

  it("no ExecutionPolicy Bypass anywhere", () => {
    const allSources = [CLI_JS, INSTALL_PS1, DAEMON_PS1];
    for (const src of allSources) {
      expect(src).not.toMatch(/ExecutionPolicy\s+Bypass/);
    }
  });
});

describe("PS 5.1 compatibility - no PS 7+ syntax in any .ps1 file", () => {
  for (const file of PS1_FILES) {
    it(`${file.name} does not use ?? (null-coalescing operator)`, () => {
      // Check non-comment lines for ??
      const lines = file.content.split("\n");
      for (const line of lines) {
        const trimmed = line.trimStart();
        if (trimmed.startsWith("#")) continue;
        expect(line).not.toMatch(/\?\?/);
      }
    });

    it(`${file.name} does not use ?. (null-conditional operator)`, () => {
      const lines = file.content.split("\n");
      for (const line of lines) {
        const trimmed = line.trimStart();
        if (trimmed.startsWith("#")) continue;
        // Match ?. but not inside strings (simple heuristic: not preceded by quote)
        expect(line).not.toMatch(/\?\./);
      }
    });
  }
});
