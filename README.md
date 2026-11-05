# dyslexia-friendly-ui

An AI agent skill for building readable, inclusive interfaces.
This package installs the skill into your coding agent with one command.

Published on npm as [`dyslexia-friendly-ui`](https://www.npmjs.com/package/dyslexia-friendly-ui).

## What the skill does

The skill (`SKILL.md`) teaches your agent to:

- Write clear, respectful interface text.
- Offer font, spacing, and colour choices instead of forcing one.
- Build reading settings that work and persist.
- Add focus aids for hover, selection, and keyboard.
- Think about numbers and dyscalculia.
- Test with real tools and real people, and report that honestly.

It does not claim any app is fully dyslexia-friendly or WCAG-conformant.

## Quick start

```bash
npx dyslexia-friendly-ui
```

The installer will:

1. Look for supported agents in your project (or your home folder with `--global`).
2. Show you what it found.
3. Ask which ones to install for.
4. Show a before-and-after for any file it edits.
5. Write the skill after you approve.

## Requirements

- Node.js (LTS recommended)
- npm (comes with Node.js)

Install Node.js with a free and open-source route:

```powershell
winget install OpenJS.NodeJS.LTS
# or
scoop install nodejs-lts
# or
choco install nodejs-lts
```

Verify the package IDs with `winget search node` (or the scoop/choco equivalent) first.

## Supported agents

The installer auto-detects these by their folders or files.
**Paths are from memory. Verify them in each tool's current docs before release.**

| Agent | Detected by | Install method |
|---|---|---|
| Claude Code | `.claude/` or `~/.claude/` | Copy to `skills/dyslexia-friendly-ui/SKILL.md` |
| Cursor | `.cursor/` | Write a rule file in `.cursor/rules/` |
| Codex CLI | `AGENTS.md` or `~/.codex/` | Add a marked block to `AGENTS.md` |
| GitHub Copilot | `.github/copilot-instructions.md` | Add a marked block |
| Gemini CLI | `GEMINI.md` or `~/.gemini/` | Add a marked block |
| Windsurf | `.windsurf/` | Write a rule file in `.windsurf/rules/` |

Anything else: use `--path` to copy the skill to a folder you choose.

## Commands

```bash
npx dyslexia-friendly-ui                 # detect and install (interactive)
npx dyslexia-friendly-ui --list          # show detected agents and installed state
npx dyslexia-friendly-ui --agent cursor  # install for one agent
npx dyslexia-friendly-ui --agent all     # install for every agent found here
npx dyslexia-friendly-ui --global        # install in your home folder
npx dyslexia-friendly-ui --dry-run       # show the changes, write nothing
npx dyslexia-friendly-ui --yes           # skip install prompts
npx dyslexia-friendly-ui --force         # overwrite a rule file that already exists
npx dyslexia-friendly-ui --path ./folder # copy SKILL.md to any folder
npx dyslexia-friendly-ui --version       # print the version
npx dyslexia-friendly-ui uninstall       # remove what this tool installed
```

`--yes` never overwrites a rule file that already exists with different content.
Use `--force` when you mean it. `--agent all` falls back to every agent when
none is detected.

## Safe by design

- **Before-and-after:** every edit to an existing file shows a diff first.
- **Marked blocks:** edits to shared files sit between markers, so they can be found and removed cleanly:

  ```md
  <!-- dyslexia-friendly-ui:start -->
  ...skill content...
  <!-- dyslexia-friendly-ui:end -->
  ```

- **Approval before removal:** `uninstall` lists each file or block and asks before deleting. `--yes` confirms the deletions.
- **Your edits survive:** a rule file that already exists with different content is left alone unless you pass `--force`.
- **No network calls** at install time. The skill ships inside the package.
- **No telemetry.**

## Project layout

```
dyslexia-friendly-ui/
├─ bin/cli.js           # the whole CLI (no dependencies)
├─ skill/SKILL.md       # the skill itself
├─ tests/smoke.js       # `npm test` check
├─ AGENT_INSTALL.md     # instructions for AI agents
├─ package.json
├─ LICENSE
└─ README.md
```

## `package.json` essentials

Only the fields that matter here. Check each against the current npm docs.

```json
{
  "name": "dyslexia-friendly-ui",
  "version": "0.2.1",
  "description": "Install the dyslexia-friendly UI skill into your AI coding agent.",
  "bin": { "dyslexia-friendly-ui": "bin/cli.js" },
  "files": ["bin", "skill", "AGENT_INSTALL.md", "LICENSE"],
  "engines": { "node": ">=18" },
  "license": "MIT",
  "repository": "github:hot-hilux21/dyslexia-friendly-ui",
  "keywords": ["accessibility", "dyslexia", "agent-skill", "a11y"]
}
```

Pick the licence yourself. MIT is a common FOSS choice.
Fonts named in the skill have their own licences. This package does not bundle any font files.

## Use with an AI agent

Tell your agent:

> Read `AGENT_INSTALL.md` in the `dyslexia-friendly-ui` package and follow it.

Or paste this:

> Run `npx dyslexia-friendly-ui --list`, show me the result, then ask before installing.

See [`AGENT_INSTALL.md`](./AGENT_INSTALL.md) for the full steps.

## Build and publish

```bash
npm pack --dry-run     # check what will be published
npm login
npm publish            # add --access public only if the name is scoped (@you/name)
```

## Contributing

1. Fork the repo.
2. Add or fix an adapter in `bin/cli.js` (the `AGENTS` map).
3. Test on a clean folder with `--dry-run` and run `npm test`.
4. Open a pull request. State which agent versions you tested.

## Honest limits

- Agent file locations change. Some adapters may be out of date.
- Installing the skill does not make an app accessible.
  Test with assistive technology and with people who have lived experience.

## Licence

MIT. See [`LICENSE`](./LICENSE).
