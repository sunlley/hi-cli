# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@joinc/hi` — a single CommonJS Node CLI (Node ≥ 18, zero runtime deps) that manages three Claude Code add-ons: `rtk`, `caveman`, and `superpowers`. It installs/uninstalls them, switches caveman modes, aggregates token-savings stats, and runs a deep doctor check. Pure local-first: only network call is the installer the user explicitly triggers.

## Commands

```bash
node bin/hi.js help                  # usage
node bin/hi.js                       # bare → TUI (falls back to status text if non-TTY)
node bin/hi.js status -f json        # machine-readable health
node bin/hi.js doctor -f markdown    # deep health check
npm start                            # = node bin/hi.js
npm test                             # smoke: help + status + doctor + list + mode (all JSON, exits 0)
```

No build step, no linter, no test framework. `npm test` is a smoke script — a single `node bin/hi.js <cmd>` invocation is the way to reproduce / debug.

## Architecture

Entry: `bin/hi.js` → `src/cli.js#main(argv)`.

`cli.js` parses **all** flags + positionals globally with `lib/argparse.js` (zero-dep, supports `--flag`, `--no-flag`, `--key=value`, `--key value`, `-k value`, `-k`, `--`). The first positional becomes the subcommand. The dispatch table in `cli.js` lazy-`require()`s each command module — touch a command file, no other wiring changes.

Three layers:

1. **`src/commands/*.js`** — one file per subcommand. Each exports `run(args, opts)` returning a numeric exit code. Commands that produce reports always go through `lib/render.js`'s `emit/pick/renderJSON` so every command supports `-f text|json|markdown` and `-o file` uniformly. `text` renderers write stdout; `-o` writes the file and prints `"saved to ..."` to **stderr** (so stdout piping stays clean).

2. **`src/installers/*.js`** — one file per managed add-on. The contract is `{ name, label, repo, inspect(), install(), uninstall() }`. `inspect()` is **read-only** and returns `{ name, label, installed, extras: [{ level: 'ok'|'bad'|'warn'|'info', text }], ... }`. Register new add-ons by adding them to the `ALL` array in `src/installers/index.js` — `status`, `install`, `uninstall`, `list`, and TUI iterate `ALL` automatically.

3. **`src/lib/*.js`** — shared primitives:
   - `paths.js` — single source of truth for filesystem locations. **Always** read via `require('./paths')`; never hardcode `~/.claude/...`. Respects `CLAUDE_CONFIG_DIR` env var.
   - `detect.js` — read-only probes (`rtkInstalled`, `cavemanHooksInstalled`, `cavemanActiveMode`, `superpowersInstalled`). Detection lives here, not in installers.
   - `have.js` — `have(cmd)`, `tryExec`, `run` for shelling out.
   - `i18n.js` — `setLang` / `t(key, ...args)` for en/zh; set once in `cli.js#main` from `--lang`.
   - `ui.js`, `confirm.js`, `render.js`, `argparse.js` — colors, TTY prompts, output emission, flag parsing.

### Caveman mode is a file, not state

`hi mode <lvl|off>` just writes (or unlinks) `~/.claude/.caveman-active` (= `P.CAVEMAN_FLAG`). Every other tool that cares — including the caveman hooks themselves — reads that file. `cavemanActiveMode()` is the single reader. Valid modes: `lite|full|ultra|wenyan|wenyan-lite|wenyan-full|wenyan-ultra`; `off|disable|stop` deletes the flag.

### TUI vs CLI

`src/commands/tui.js` is a zero-dep raw-mode readline TUI. It calls the **same** command modules as the CLI (`statusCmd.build()`, `installCmd.run`, etc.) — never duplicate logic between TUI and CLI; surface it through a command module.

### skills / plugins / mcp commands

Three thin "manager" commands sit outside the `installers/` add-on registry because they wrap **arbitrary** Claude Code resources, not the curated `hi`-managed set:

- `src/commands/skills.js` — pure filesystem over `P.SKILLS_DIR` (`~/.claude/skills/<name>/`). Parses YAML frontmatter from `SKILL.md` to extract `description`. `rm` is a `fs.rmSync({ recursive, force })`.
- `src/commands/plugins.js` — shells out to `claude plugin list --json` / `claude plugin uninstall|enable|disable|details`. `claude plugin list --json` returns a flat array of `{ id, version, scope, enabled, ... }` — schema is **different** from `installed_plugins.json` (which is `{ plugins: { id: [...] } }`); always prefer the CLI's JSON to that file.
- `src/commands/mcp.js` — shells out to `claude mcp list|get|remove`. `claude mcp list` has **no** `--json` flag — text passthrough for `format=text`, best-effort regex parse for `json`/`markdown`. If Anthropic ships `--json`, swap the parse for direct decode.

All three honor the global `-y`/`--yes` (bypass confirm) and `--dry-run` flags wired in `cli.js`'s `GLOBAL_SPEC`. The `confirm()` helper in `lib/confirm.js` accepts `{ yes: true }` as a second arg — pass `{ yes: opts.yes }` from every destructive command.

### CI gating

`--fail-on-missing` exits **2** (not 1) when any add-on is absent. Exit 1 is reserved for runtime errors, 2 for gate failure. Honor this when adding new gates.

## Conventions

- CommonJS (`"type": "commonjs"`). No ESM, no TypeScript, no transpile.
- Zero runtime dependencies. Adding one is a deliberate decision — the README's "local-first" promise depends on it.
- Every report-style command must support `text`, `json`, and `markdown`; route through `lib/render.js#pick`.
- File paths: always import from `lib/paths.js`.
- New add-on PR = one file in `src/installers/<name>.js` + registration in `installers/index.js` + a row in README's "Managed add-ons" table.
