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
  claude:   { label: "Claude Code",    kind: "file",  detect: ["CLAUDE.md", path.join(".claude", "settings.json"), path.join(".claude", "settings.local.json")], rel: [".claude", "skills", NAME, "SKILL.md"], content: SKILL, global: true, globalRel: [".claude", "skills", NAME, "SKILL.md"] },
  cursor:   { label: "Cursor",         kind: "file",  detect: [".cursor"], rel: [".cursor", "rules", NAME + ".mdc"], content: CURSOR_HEAD + BODY },
  windsurf: { label: "Windsurf",       kind: "file",  detect: [".windsurf"], rel: [".windsurf", "rules", NAME + ".md"], content: BODY },
  codex:    { label: "Codex CLI",      kind: "block", detect: [".codex"], rel: ["AGENTS.md"], globalRel: [".codex", "AGENTS.md"], global: true },
  copilot:  { label: "GitHub Copilot", kind: "block", detect: [path.join(".github", "copilot-instructions.md"), ".vscode"], rel: [".github", "copilot-instructions.md"] },
  gemini:   { label: "Gemini CLI",     kind: "block", detect: ["GEMINI.md", ".gemini"], rel: ["GEMINI.md"], globalRel: [".gemini", "GEMINI.md"], global: true },
  opencode: { label: "OpenCode",       kind: "file",  detect: [".opencode", "opencode.json"], rel: [".opencode", "skills", NAME, "SKILL.md"], content: SKILL, global: true, globalRel: [".config", "opencode", "skills", NAME, "SKILL.md"] },
  hermes:   { label: "Hermes",         kind: "file",  detect: [".hermes"], rel: [".hermes", "skills", NAME, "SKILL.md"], content: SKILL, global: true, globalRel: [".hermes", "skills", NAME, "SKILL.md"] },
};

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const isUninstall = args[0] === "uninstall";
const base = flag("--global") ? os.homedir() : process.cwd();
const dry = flag("--dry-run");
const yes = flag("--yes");
const force = flag("--force");

const block = () => `${START}\n${BODY.trim()}\n${END}\n`;
const target = (a) => path.join(base, ...((flag("--global") && a.globalRel) || a.rel));
const usable = (a) => !flag("--global") || a.global;
const detected = (a) => {
  if (!usable(a)) return false;
  if (a.detect.some((d) => fs.existsSync(path.join(base, d)))) return true;
  // A globally installed agent counts as detected even in a project folder.
  if (a.global) {
    const home = os.homedir();
    if (a.detect.some((d) => fs.existsSync(path.join(home, d)))) return true;
    if (a.globalRel && a.globalRel.length) {
      const dir = path.join(home, ...a.globalRel.slice(0, -1));
      if (fs.existsSync(dir)) return true;
    }
  }
  return false;
};
// "file" agents own the whole file, so its presence means installed.
const installed = (a) => {
  const file = target(a);
  if (!fs.existsSync(file)) return false;
  return a.kind === "block" ? fs.readFileSync(file, "utf8").includes(START) : true;
};

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (x) => { rl.close(); res(x.trim().toLowerCase()); }));
}
async function confirm(q, auto) {
  if (auto) return true;
  if (!process.stdin.isTTY) { console.log("  No terminal to answer. Skipped (use --yes)."); return false; }
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
    console.log(exists ? "  Before: file exists" : "  Before: file does not exist");
    console.log(`  After:  ${a.content.split("\n").length} lines`);
    if (dry) return console.log("  Dry run. Nothing written.");
    if (exists && fs.readFileSync(file, "utf8") === a.content) return console.log("  Already up to date.");
    // Existing file means it differs from ours. Overwriting needs --force so a
    // hand-edited rule file is never lost to a silent --yes.
    if (exists && !force) return console.log("  Skipped: file exists and differs. Use --force to overwrite.");
    if (!(await confirm("  Write this file?", yes))) return console.log("  Skipped.");
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
  let removed = 0;
  for (const key of Object.keys(AGENTS)) {
    const a = AGENTS[key];
    if (!usable(a)) continue;
    const file = target(a);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    console.log(`\n${a.label}: ${file}`);
    if (a.kind === "file") {
      if (await confirm(`  Delete ${file}?`, yes)) {
        fs.rmSync(file);
        try { fs.rmdirSync(path.dirname(file)); } catch {}
        console.log("  Deleted.");
        removed++;
      }
    } else if (text.includes(START)) {
      if (await confirm(`  Remove the ${NAME} block from ${file}?`, yes)) {
        const rest = stripBlock(text).trim();
        fs.writeFileSync(file, rest ? rest + "\n" : "");
        console.log("  Removed.");
        removed++;
      }
    }
  }
  console.log(removed ? `\nRemoved ${removed} item(s).` : "\nNothing removed.");
}

async function selectAgents(items, preselected) {
  if (!process.stdin.isTTY) return null;
  const selected = new Set(preselected);
  let cursor = 0;
  let search = "";
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  const filtered = () => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((k) => k.toLowerCase().includes(q) || AGENTS[k].label.toLowerCase().includes(q));
  };
  const clampCursor = () => {
    const f = filtered();
    if (!f.length) cursor = 0;
    else if (cursor >= f.length) cursor = f.length - 1;
  };
  const toggle = (k) => { if (selected.has(k)) selected.delete(k); else selected.add(k); };

  const render = () => {
    process.stdout.write("\x1b[2J\x1b[H");
    console.log("◆  Which agents do you want to install to?\n");
    const f = filtered();
    if (!search) {
      const detectedItems = items.filter((k) => detected(AGENTS[k]));
      const availableItems = items.filter((k) => !detected(AGENTS[k]));
      const renderGroup = (title, group) => {
        if (!group.length) return;
        console.log("── " + title + " ──\n");
        group.forEach((k) => {
          if (!f.includes(k)) return;
          const idx = f.indexOf(k);
          const ptr = idx === cursor ? "❯" : " ";
          const mark = selected.has(k) ? "●" : "○";
          const status = installed(AGENTS[k]) ? "installed" : "not installed";
          console.log(ptr + " " + mark + " " + k + " (" + AGENTS[k].label + ") — " + status);
        });
        console.log("");
      };
      renderGroup("Detected", detectedItems);
      renderGroup("Available to install", availableItems);
    } else {
      console.log("Search: " + search + "\n");
      f.forEach((k, i) => {
        const ptr = i === cursor ? "❯" : " ";
        const mark = selected.has(k) ? "●" : "○";
        const status = installed(AGENTS[k]) ? "installed" : "not installed";
        console.log(ptr + " " + mark + " " + k + " (" + AGENTS[k].label + ") — " + status);
      });
      if (!f.length) console.log("  (no matches)");
      console.log("");
    }
    console.log("Search: " + search);
    console.log("↑↓ move, space select, enter confirm, esc clear, q cancel\n");
    const sel = Array.from(selected);
    const preview = sel.slice(0, 3).join(", ") + (sel.length > 3 ? " +" + (sel.length - 3) + " more" : "");
    console.log("Selected (" + selected.size + "): " + (preview || "(none)"));
  };

  return new Promise((resolve) => {
    const onData = (ch) => {
      if (ch === "\u0003") { cleanup(); resolve([]); return; }
      if (ch === "\x1b[A") { cursor = (cursor - 1 + filtered().length) % Math.max(1, filtered().length); render(); }
      else if (ch === "\x1b[B") { cursor = (cursor + 1) % Math.max(1, filtered().length); render(); }
      else if (ch === " ") {
        const f = filtered();
        if (f.length) toggle(f[cursor]);
        render();
      } else if (ch === "\x1b") {
        if (search) { search = ""; clampCursor(); render(); }
        else { cleanup(); resolve([]); }
      } else if (ch === "\r" || ch === "\n") {
        cleanup();
        resolve(Array.from(selected));
      } else if (ch === "q") {
        cleanup();
        resolve([]);
      } else if (ch === "\x7f" || ch === "\b") {
        search = search.slice(0, -1);
        clampCursor();
        render();
      } else if (ch.length === 1 && ch >= " " && ch <= "~") {
        search += ch;
        clampCursor();
        render();
      }
    };
    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\x1b[2J\x1b[H");
    };
    process.stdin.on("data", onData);
    clampCursor();
    render();
  });
}

async function confirmMenu(selected) {
  if (!process.stdin.isTTY) return "confirm";
  const options = ["CONFIRM", "Back", "Cancel"];
  let cursor = 0;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  const render = () => {
    process.stdout.write("\x1b[2J\x1b[H");
    console.log("Selected agents:\n");
    selected.forEach((k) => console.log("  - " + k + " (" + AGENTS[k].label + ")"));
    console.log("\nConfirm installation?\n");
    options.forEach((o, i) => console.log((i === cursor ? ">" : " ") + " " + o));
    console.log("\n(↑/↓ move, Enter select)");
  };
  return new Promise((resolve) => {
    const onData = (ch) => {
      if (ch === "\u0003") { cleanup(); resolve("cancel"); return; }
      if (ch === "\x1b[A") { cursor = (cursor - 1 + options.length) % options.length; render(); }
      else if (ch === "\x1b[B") { cursor = (cursor + 1) % options.length; render(); }
      else if (ch === "\r" || ch === "\n") { cleanup(); resolve(options[cursor].toLowerCase()); }
      else if (ch === "q" || ch === "\x1b") { cleanup(); resolve("cancel"); }
    };
    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\x1b[2J\x1b[H");
    };
    process.stdin.on("data", onData);
    render();
  });
}

async function wizard(usableAll) {
  if (!process.stdin.isTTY) return null;
  let selection = await selectAgents(usableAll, usableAll.filter((k) => !installed(AGENTS[k])));
  if (!selection || !selection.length) return [];
  while (true) {
    const action = await confirmMenu(selection);
    if (action === "confirm") return selection;
    if (action === "back") {
      selection = await selectAgents(usableAll, selection);
      if (!selection || !selection.length) return [];
      continue;
    }
    return [];
  }
}

async function main() {
  if (flag("--help") || flag("-h")) {
    return console.log(
      `Usage: ${NAME} [uninstall] [options]\n\n` +
      `Options:\n` +
      `  --list              show agents found here and whether the skill is installed\n` +
      `  --agent <name|all>  install for one agent, or all detected ones\n` +
      `  --global            use your home folder instead of the current folder\n` +
      `  --path <dir>        copy SKILL.md to any folder (unknown agents)\n` +
      `  --dry-run           show what would change, write nothing\n` +
      `  --yes               answer yes to the install/uninstall prompts\n` +
      `  --force             overwrite a rule file that already exists and differs\n` +
      `  --version           print the version\n` +
      `  --help              print this\n\n` +
      `Agents: ${Object.keys(AGENTS).join(", ")}`
    );
  }
  if (flag("--version") || flag("-v")) return console.log(require("../package.json").version);
  if (val("--path")) {
    const dir = path.resolve(val("--path"));
    if (dry) return console.log(`Dry run. Would copy SKILL.md to ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), SKILL);
    return console.log(`Copied SKILL.md to ${dir}`);
  }
  if (isUninstall) return uninstall();

  const all = Object.keys(AGENTS);
  const found = all.filter((k) => detected(AGENTS[k]));
  const isInstalled = (k) => installed(AGENTS[k]);
  const notInstalled = (k) => !isInstalled(k);
  const usableAll = all.filter((k) => usable(AGENTS[k]));
  const installedList = usableAll.filter(isInstalled);
  const detectedNotInstalled = found.filter(notInstalled);
  const available = usableAll.filter((k) => !found.includes(k));

  function printStatus() {
    console.log("Installed:");
    if (installedList.length) installedList.forEach((k) => console.log(`  ${k} (${AGENTS[k].label})`));
    else console.log("  (none)");
    console.log("Detected, not installed:");
    if (detectedNotInstalled.length) detectedNotInstalled.forEach((k) => console.log(`  ${k} (${AGENTS[k].label})`));
    else console.log("  (none)");
    console.log("Available to install (optional):");
    if (available.length) available.forEach((k) => console.log(`  ${k} (${AGENTS[k].label})`));
    else console.log("  (none)");
  }

  if (flag("--list")) {
    printStatus();
    return;
  }
  let chosen;
  if (val("--agent")) {
    const k = val("--agent");
    if (k === "all") {
      chosen = usableAll.filter(notInstalled);
      if (!chosen.length) return console.error("Nothing to install. Remove --global or name an agent."), (process.exitCode = 1);
    } else {
      if (!AGENTS[k]) return console.error(`Unknown agent: ${k}. Known: ${all.join(", ")}`), (process.exitCode = 1);
      if (!usable(AGENTS[k])) return console.error(`${k} has no global config file. Run without --global.`), (process.exitCode = 1);
      chosen = [k];
    }
  } else if (yes || dry) {
    chosen = (found.length ? found : usableAll).filter(notInstalled);
    if (!chosen.length) return console.log("Nothing to install.");
  } else {
    const picked = await wizard(usableAll);
    if (picked === null) {
      chosen = (found.length ? found : usableAll).filter((k) => !isInstalled(k));
    } else {
      chosen = picked;
    }
  }
  if (!chosen.length) return console.log("Nothing installed.");
  for (const k of chosen) await install(k);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
