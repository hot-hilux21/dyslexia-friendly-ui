// Smallest check that fails if the CLI or the packaged skill breaks.
// Runs in a temp folder so it never touches the real project or home dir.
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const cli = path.join(__dirname, "..", "bin", "cli.js");
const run = (...args) => execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" });

const pkg = require("../package.json");
const skill = fs.readFileSync(path.join(__dirname, "..", "skill", "SKILL.md"), "utf8");

assert.match(skill, /^---[\s\S]*?---/, "SKILL.md needs frontmatter");
assert.strictEqual(pkg.files.includes("skill"), true, "skill/ must ship in the package");

assert.match(run("--help"), new RegExp(pkg.name));
assert.match(run("--list"), /Detected|No supported agents/);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dfui-"));
const out = path.join(tmp, "skill");
run("--path", out);
assert.ok(fs.existsSync(path.join(out, "SKILL.md")), "--path must copy SKILL.md");
assert.strictEqual(fs.readFileSync(path.join(out, "SKILL.md"), "utf8"), skill);

// dry-run must not write anything
const untouched = path.join(tmp, "dry");
run("--path", untouched, "--dry-run");
assert.strictEqual(fs.existsSync(untouched), false, "--dry-run must not write");

fs.rmSync(tmp, { recursive: true, force: true });
console.log("smoke ok");
