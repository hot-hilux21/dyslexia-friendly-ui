#!/usr/bin/env node
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");

const NAME = "dyslexia-friendly-ui";
const START = `<!-- ${NAME}:start -->`;
const END = `<!-- ${NAME}:end -->`;
const SKILL = fs.readFileSync(path.join(__dirname, "..", "skill", "SKILL.md"), "utf8");
const BODY = SKILL.replace(/^---[\s\S]*?---\s*/, "");

const CURSOR_HEAD = `---\ndescription: Dyslexia-friendly UI and inclusive coding guidance\nalwaysApply: false\n---\n\n`;

// kind "file": we own the whole file. kind "block": we own a marked block in a shared file.
// Paths are from memory. Verify against each tool's current docs.
const AGENTS = {
  claude:   { label: "Claude Code",    kind: "file",  detect: [".claude"], rel: [".claude", "skills", NAME, "SKILL.md"], content: SKILL, global: true },
  cursor:   { label: "Cursor",         kind: "file",  detect: [".cursor"], rel: [".cursor", "rules", NAME + ".mdc"], content: CURSOR_HEAD + BODY },
  windsurf: { label: "Windsurf",       kind: "file",  detect: [".windsurf"], rel: [".windsurf", "rules", NAME + ".md"], content: BODY },
  codex:    { label: "Codex CLI",      kind: "block", detect: ["AGENTS.md", ".codex"], rel: ["AGENTS.md"], globalRel: [".codex", "AGENTS.md"], global: true },
  copilot:  { label: "GitHub Copilot", kind: "block", detect: [path.join(".github", "copilot-instructions.md")], rel: [".github", "copilot-instructions.md"] },
  gemini:   { label: "Gemini CLI",     kind: "block", detect: ["GEMINI.md", ".gemini"], rel: ["GEMINI.md"], globalRel: [".gemini", "GEMINI.md"], global: true },
};

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const isUninstall = args[0] === "uninstall";
const base = flag("--global") ? os.homedir() : process.cwd();
const dry = flag("--dry-run");
const yes = flag("--yes");

const block = () => `${START}\n${BODY.trim()}\n${END}\n`;
const target = (a) => path.join(base, ...((flag("--global") && a.globalRel) || a.rel));
const usable = (a) => !flag("--global") || a.global;
const detected = (a) => usable(a) && a.detect.some((d) => fs.existsSync(path.join(base, d)));

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (x) => { rl.close(); res(x.trim().toLowerCase()); }));
}
async function confirm(q, auto) {
  if (auto) return true;
  if (!process.stdin.isTTY) { console.log("No terminal to ask. Skipping: " + q); return false; }
  const x = await ask(q + " [y/N] ");
  return x === "y" || x === "yes";
}

function stripBlock(text) {
  const re = new RegExp(`\\n?${START}[\\s\\S]*?${END}\\n?`, "g");
  return text.replace(re, "\n");
}

async function install(key) {
  const a = AGENTS[key];
  const file = target(a);
  console.log(`\n${a.label}: ${file}`);
  if (a.kind === "file") {
    const exists = fs.existsSync(file);
    console.log(exists ? "  Before: file exists (will be replaced)" : "  Before: file does not exist");
    console.log(`  After:  ${a.content.split("\n").length} lines`);
    if (dry) return console.log("  Dry run. Nothing written.");
    if (exists && fs.readFileSync(file, "utf8") === a.content) return console.log("  Already up to date.");
    if (!(await confirm("  Write this file?", yes && !exists))) return console.log("  Skipped.");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, a.content);
    return console.log("  Written.");
  }
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const after = (stripBlock(before).trimEnd() + (before.trim() ? "\n\n" : "") + block());
  console.log(`  Before: ${before ? before.split("\n").length + " lines" : "file does not exist"}`);
  console.log(`  After:  ${after.split("\n").length} lines (marked block ${before.includes(START) ? "replaced" : "added at the end"})`);
  console.log(block().split("\n").slice(0, 6).map((l) => "  + " + l).join("\n") + "\n  + ...");
  if (dry) return console.log("  Dry run. Nothing written.");
  if (!(await confirm("  Apply this edit?", yes))) return console.log("  Skipped.");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, after);
  console.log("  Done.");
}

async function uninstall() {
  for (const key of Object.keys(AGENTS)) {
    const a = AGENTS[key];
    if (!usable(a)) continue;
    const file = target(a);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    if (a.kind === "file") {
      if (await confirm(`Delete ${file}?`, false)) {
        fs.rmSync(file);
        try { fs.rmdirSync(path.dirname(file)); } catch {}
        console.log("  Deleted.");
      }
    } else if (text.includes(START)) {
      if (await confirm(`Remove the ${NAME} block from ${file}?`, false)) {
        fs.writeFileSync(file, stripBlock(text).trim() ? stripBlock(text).trim() + "\n" : "");
        console.log("  Removed.");
      }
    }
  }
}

async function main() {
  if (flag("--help") || flag("-h")) {
    return console.log(`Usage: ${NAME} [uninstall] [--list] [--agent <name>] [--global] [--dry-run] [--yes] [--path <dir>]\nAgents: ${Object.keys(AGENTS).join(", ")}`);
  }
  if (val("--path")) {
    const dir = path.resolve(val("--path"));
    if (dry) return console.log(`Dry run. Would copy SKILL.md to ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), SKILL);
    return console.log(`Copied SKILL.md to ${dir}`);
  }
  if (isUninstall) return uninstall();

  const found = Object.keys(AGENTS).filter((k) => detected(AGENTS[k]));
  if (flag("--list")) {
    console.log(found.length ? "Detected: " + found.map((k) => `${k} (${AGENTS[k].label})`).join(", ") : "No supported agents detected.");
    return;
  }
  let chosen;
  if (val("--agent")) {
    const k = val("--agent");
    if (!AGENTS[k] || !usable(AGENTS[k])) return console.error(`Unknown or unsupported agent: ${k}`), (process.exitCode = 1);
    chosen = [k];
  } else if (!found.length) {
    return console.log("No supported agents detected. Use --agent <name> or --path <dir>.");
  } else if (yes || dry) {
    chosen = found;
  } else {
    console.log("Detected: " + found.join(", "));
    chosen = [];
    for (const k of found) if (await confirm(`Install for ${AGENTS[k].label}?`, false)) chosen.push(k);
  }
  for (const k of chosen) await install(k);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
