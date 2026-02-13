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

  it("cli.js Windows daemon downloads standalone script instead of inlining", () => {
    const setupDaemonStart = CLI_JS.indexOf("async function setupDaemon()");
    expect(setupDaemonStart).toBeGreaterThan(-1);

    const setupDaemonEnd = CLI_JS.indexOf("\nfunction openApp()", setupDaemonStart);
    expect(setupDaemonEnd).toBeGreaterThan(setupDaemonStart);

    const setupDaemonBody = CLI_JS.slice(setupDaemonStart, setupDaemonEnd);

    // Windows branch downloads the standalone daemon script
    expect(setupDaemonBody).toContain("agent-monitor-daemon.ps1");
    expect(setupDaemonBody).toContain("raw.githubusercontent.com");
  });
});

describe("Windows daemon single source of truth", () => {
  // The standalone daemon script is the single source of truth.
  // cli.js and install.ps1 now download/copy it instead of inlining.
  const REQUIRED_FUNCTIONS = ["Write-Log", "Test-AppRunning", "Test-ActiveTeams"];

  for (const fn of REQUIRED_FUNCTIONS) {
    it(`standalone daemon.ps1 contains ${fn}`, () => {
      expect(DAEMON_PS1).toContain(fn);
    });
  }

  it("cli.js does not inline daemon functions", () => {
    // setupDaemon should not contain PowerShell function definitions
    expect(CLI_JS).not.toContain("function Write-Log");
    expect(CLI_JS).not.toContain("function Test-AppRunning");
    expect(CLI_JS).not.toContain("function Test-ActiveTeams");
  });

  it("install.ps1 does not inline daemon functions", () => {
    // Install-Daemon should not contain a here-string daemon script
    expect(INSTALL_PS1).not.toContain('$daemonScript = @"');
    expect(INSTALL_PS1).toContain("agent-monitor-daemon.ps1");
  });
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
