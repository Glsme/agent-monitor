/**
 * Shared helpers and fixtures for cli.js Vitest tests.
 */
import fs from "fs";
import path from "path";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const CLI_JS_PATH = path.join(ROOT, "npm", "bin", "cli.js");
export const CLI_JS = fs.readFileSync(CLI_JS_PATH, "utf-8");

/**
 * Extract a top-level function body from cli.js source text.
 * Uses line-based detection: finds the function start, then locates the next
 * top-level function/const/comment boundary to determine the end.
 * Falls back to returning from start to end of source.
 */
export function extractFunction(source, name) {
  const patterns = [`function ${name}(`, `async function ${name}(`];
  let start = -1;
  for (const pat of patterns) {
    const idx = source.indexOf(pat);
    if (idx !== -1) { start = idx; break; }
  }
  if (start === -1) return null;

  // Find the next top-level declaration after this function
  // Look for lines that start with "function ", "async function ", "const ", or "// ----"
  const rest = source.slice(start + 1);
  // Only match unindented (column 0) declarations as boundaries
  const boundary = rest.search(/\r?\n(?=(?:async )?function \w|const \w|\/\/ ----)/);
  if (boundary === -1) {
    return source.slice(start).trim();
  }
  return source.slice(start, start + 1 + boundary).trim();
}

/**
 * Create a sandboxed version of getArch() that returns the result for a given arch string.
 */
export function evalGetArch(archValue) {
  // Extracted logic from cli.js getArch()
  if (archValue === "arm64") return "arm64";
  if (archValue === "x64") return "x64";
  return null;
}

/**
 * Create a mock filesystem tree for findFile() testing.
 * Returns { readdirSync, entries } for use in tests.
 */
export function makeMockFs(tree) {
  // tree: { "dir": { "sub": { "file.exe": true } } }
  // Returns a readdirSync-compatible function
  function readdirSync(dir, _opts) {
    const parts = dir.replace(/\\/g, "/").split("/").filter(Boolean);
    let node = tree;
    for (const p of parts) {
      if (node && typeof node === "object" && p in node) {
        node = node[p];
      } else {
        throw new Error(`ENOENT: ${dir}`);
      }
    }
    return Object.entries(node).map(([name, val]) => ({
      name,
      isDirectory: () => typeof val === "object" && val !== null && val !== true,
    }));
  }
  return readdirSync;
}
