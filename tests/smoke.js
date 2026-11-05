// Smallest check that fails if the CLI or the packaged skill breaks.
// Runs in temp folders so it never touches the real project or home dir.
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const cli = path.join(__dirname, "..", "bin", "cli.js");
const run = (...args) => execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" });
const runIn = (dir, ...args) =>
  execFileSync(process.execPath, [cli, ...args], { encoding: "utf8", cwd: dir, stdio: ["ignore", "pipe", "pipe"] });

const pkg = require("../package.json");
const skill = fs.readFileSync(path.join(__dirname, "..", "skill", "SKILL.md"), "utf8");

assert.match(skill, /^---[\s\S]*?---/, "SKILL.md needs frontmatter");
assert.strictEqual(pkg.files.includes("skill"), true, "skill/ must ship in the package");

assert.match(run("--help"), new RegExp(pkg.name));
assert.strictEqual(run("--version").trim(), pkg.version, "--version must match package.json");
assert.match(run("--list"), /Detected|No supported agents/);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dfui-"));

// --path copies the skill verbatim
const out = path.join(tmp, "skill");
run("--path", out);
assert.ok(fs.existsSync(path.join(out, "SKILL.md")), "--path must copy SKILL.md");
assert.strictEqual(fs.readFileSync(path.join(out, "SKILL.md"), "utf8"), skill);

// --dry-run must not write anything
const untouched = path.join(tmp, "dry");
run("--path", untouched, "--dry-run");
assert.strictEqual(fs.existsSync(untouched), false, "--dry-run must not write");

// project install / reinstall / force / uninstall
const proj = path.join(tmp, "proj");
fs.mkdirSync(path.join(proj, ".cursor"), { recursive: true });
assert.match(runIn(proj, "--list"), /cursor .*not installed/);

runIn(proj, "--agent", "cursor", "--yes");
const rule = path.join(proj, ".cursor", "rules", `${pkg.name}.mdc`);
assert.ok(fs.existsSync(rule), "--agent cursor must write the rule file");
assert.match(runIn(proj, "--list"), /cursor .*installed/);

assert.match(runIn(proj, "--agent", "cursor", "--yes"), /Already up to date/);

const edited = "# hand edited\n";
fs.writeFileSync(rule, edited);
assert.match(runIn(proj, "--agent", "cursor", "--yes"), /Skipped: file exists and differs/);
assert.strictEqual(fs.readFileSync(rule, "utf8"), edited, "--yes must not clobber a differing file");

runIn(proj, "--agent", "cursor", "--yes", "--force");
assert.notStrictEqual(fs.readFileSync(rule, "utf8"), edited, "--force must overwrite");

// block install is idempotent: one marker pair after two runs
runIn(proj, "--agent", "codex", "--yes");
runIn(proj, "--agent", "codex", "--yes");
const agentsMd = fs.readFileSync(path.join(proj, "AGENTS.md"), "utf8");
assert.strictEqual(agentsMd.split(`${pkg.name}:start`).length - 1, 1, "block install must stay idempotent");

// uninstall removes what install wrote and leaves nothing behind
assert.match(runIn(proj, "uninstall", "--yes"), /Removed 2 item/);
assert.strictEqual(fs.existsSync(rule), false, "uninstall must delete the rule file");
assert.strictEqual(fs.readFileSync(path.join(proj, "AGENTS.md"), "utf8").trim(), "", "uninstall must strip its block");

// --agent all installs for every agent with a config location here
const whole = path.join(tmp, "whole");
fs.mkdirSync(whole, { recursive: true });
runIn(whole, "--agent", "all", "--yes");
assert.ok(fs.existsSync(path.join(whole, ".windsurf", "rules", `${pkg.name}.md`)), "--agent all must install every agent");
assert.match(runIn(whole, "uninstall", "--yes"), /Removed 8 item/);

// opencode + hermes install into their skill folders
const extra = path.join(tmp, "extra");
fs.mkdirSync(path.join(extra, ".opencode"), { recursive: true });
fs.mkdirSync(path.join(extra, ".hermes"), { recursive: true });
runIn(extra, "--agent", "opencode", "--yes");
runIn(extra, "--agent", "hermes", "--yes");
assert.ok(fs.existsSync(path.join(extra, ".opencode", "skills", pkg.name, "SKILL.md")));
assert.ok(fs.existsSync(path.join(extra, ".hermes", "skills", pkg.name, "SKILL.md")));
runIn(extra, "uninstall", "--yes");

// bad input fails loudly
assert.throws(() => runIn(whole, "--agent", "nope"), (e) => /Unknown agent: nope/.test(e.stderr));

fs.rmSync(tmp, { recursive: true, force: true });
console.log("smoke ok");
