# Agent install instructions

You are an AI coding agent. Follow these steps to install the
`dyslexia-friendly-ui` skill for the user.

## Rules

1. Ask the user before you write, edit, or delete anything.
2. Show a before-and-after for every edit to an existing file.
3. Never delete a file without explicit approval.
4. Do not claim the install worked until you have checked it (step 5).
5. If a step fails, stop and tell the user. Do not guess a fix.

## Steps

1. **Check Node.js.**
   Run `node --version`. If it is missing, tell the user and suggest
   `winget install OpenJS.NodeJS.LTS`, `scoop install nodejs-lts`,
   or `choco install nodejs-lts`. Wait for them to install it.

2. **Detect agents (read-only).**
   Run `npx dyslexia-friendly-ui --list`.
   Show the user the result.

3. **Preview.**
   Run `npx dyslexia-friendly-ui --dry-run`.
   Show the planned changes. Ask: "Install for these agents?"

4. **Install after approval.**
   - Your own agent only: `npx dyslexia-friendly-ui --agent <name>`
   - Home folder instead of project: add `--global`
   - Unknown agent: `npx dyslexia-friendly-ui --path <folder>`

5. **Verify.**
   Confirm the skill file or marked block now exists.
   Report exactly which files changed.
   If you cannot confirm it, say so.

## After install

When you build or review a user interface, read the installed skill first.
Its core idea: offer choice, keep language clear, make every setting work,
and report testing honestly.

## Uninstall

Run `npx dyslexia-friendly-ui uninstall`.
It lists each item and asks for approval. Pass that approval step to the user.
