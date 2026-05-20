<h1 align="center">hi</h1>

<p align="center">
  One CLI to install, configure, and audit every Claude Code add-on worth running.
</p>

<p align="center">
  English | <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@joinc/hi"><img src="https://img.shields.io/npm/v/@joinc/hi?color=00ADD8" alt="npm"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A518-339933.svg" alt="Node ≥18">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/local--first-yes-54ff00.svg" alt="local-first">
</p>

---

**hi** is a local, dependency-free CLI that manages your AI-agent toolkit. It installs, removes, and reports on the Claude Code add-on stack (`rtk`, `caveman`, `superpowers`) plus four sibling CLIs you tend to install alongside it (`codex`, `opencode`, `openclaw`, `hermes`) — all through one command surface that works in your terminal, in scripts, and in CI.

## Why hi?

Claude Code becomes useful once you stack the right add-ons. But each one has its own installer, its own config path, its own way of saying "I'm broken." **hi** unifies them.

It helps you answer:

- **Is my Claude Code setup healthy?** One command (`hi`) shows every add-on, version, mode, and savings number.
- **What do I run on a fresh machine?** `hi setup` installs everything with auto-detected methods (brew → curl → cargo, npx, claude plugin).
- **Is my caveman mode active?** `hi mode full` switches it, `hi stats` proves it's saving tokens.
- **Can I gate this in CI?** `hi status --fail-on-missing` exits non-zero when anything drifts.
- **Can I read this in Chinese?** `hi --lang zh` flips all reports.

## Install

```bash
npm i -g @joinc/hi
```

Requires Node ≥ 18.

## Quick start

```bash
hi              # interactive TUI dashboard (no args)
hi setup        # install everything, asks per tool
hi status       # one-shot health check (text)
hi mode full    # set caveman mode
hi stats        # combined rtk + caveman savings
hi doctor       # deep health check (node, settings.json, claude CLI)
hi skills       # list ~/.claude/skills/*
hi plugins      # list installed Claude Code plugins
hi mcp          # list configured MCP servers
```

## Managing skills / plugins / MCP

`hi` includes thin wrappers over the underlying Claude Code surfaces so you can list, inspect, and remove them without remembering separate command shapes:

```bash
# Skills (filesystem under ~/.claude/skills/)
hi skills                       # = hi skills list
hi skills show <name>           # frontmatter + path
hi skills rm <name>             # delete dir, confirms (or pass -y to skip)
hi skills rm <name> --dry-run   # show what would be deleted

# Plugins (delegates to: claude plugin)
hi plugins                      # = hi plugins list (with enabled/version/scope)
hi plugins show <name>          # = claude plugin details <name>
hi plugins rm <name>            # = claude plugin uninstall <name>  (confirms)
hi plugins enable <name>
hi plugins disable <name>

# MCP servers (delegates to: claude mcp)
hi mcp                          # = hi mcp list
hi mcp show <name>              # = claude mcp get <name>
hi mcp rm <name>                # = claude mcp remove <name>  (confirms)
```

All three support `-f json|markdown -o file.ext` for scripting / CI, and `-y` / `--yes` to bypass the confirm prompt. `--dry-run` prints the intended action without performing it.

## Managed add-ons

Claude Code add-ons:

| Tool | What it does | Repo |
|---|---|---|
| **rtk** | Rust Token Killer — proxy that cuts dev-tool tokens 60–90 % | [rtk-ai/rtk](https://github.com/rtk-ai/rtk) |
| **caveman** | Ultra-compressed output mode for Claude Code | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) |
| **superpowers** | Skill-pack plugin for Claude Code | [obra/superpowers](https://github.com/obra/superpowers) |

Sibling AI CLIs (install via `hi install <name>`):

| Tool | What it does | Install via | Repo |
|---|---|---|---|
| **codex** | OpenAI Codex CLI | `npm i -g @openai/codex` | [openai/codex](https://github.com/openai/codex) |
| **opencode** | sst/opencode terminal agent | `brew install sst/tap/opencode` (or `curl opencode.ai/install`) | [sst/opencode](https://github.com/sst/opencode) |
| **openclaw** | OpenClaw agent runtime | `npm i -g openclaw` | — |
| **hermes** | Nous Research Hermes Agent | `curl install.sh` | [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) |

## Common workflows

```bash
# Machine-readable status for scripts / CI
hi status -f json

# Save a Markdown health report
hi doctor -f markdown -o doctor.md

# Gate CI on a complete install
hi status --fail-on-missing

# Switch caveman mode without opening Claude Code
hi mode full

# Inspect savings as JSON
hi stats -f json -o stats.json
```

## CLI reference

```
Usage:
  hi                       launch interactive TUI dashboard
  hi <command> [flags]     run a single command (machine-friendly)

Commands:
  status                   health + active mode for all managed tools
  setup                    alias for: hi install all
  install [tool|all]       install with auto-detected method
  uninstall [tool|all]     uninstall
  mode <lvl|off>           caveman mode: lite|full|ultra|wenyan|wenyan-*|off
  stats                    combined token-savings report
  doctor                   deep health check (node, settings.json, claude CLI)
  list                     list managed add-ons + repos
  proxy <port|off|show>    direct use persists proxy; eval/--print emits shell exports
  skills [list|show|rm]    manage ~/.claude/skills/*
  plugins [list|show|rm|enable|disable]
                           manage Claude Code plugins (via claude plugin)
  mcp [list|show|rm]       manage MCP servers (via claude mcp)
  update                   update caveman to latest from main

Global flags:
  -f, --format <fmt>       text | json | markdown   (default: text)
  -o, --output <file>      write report to file (stderr: "saved to ...")
      --lang <en|zh>       output language for status/doctor strings
      --fail-on-missing    exit 2 when any add-on is missing (CI gate)
  -y, --yes                auto-accept confirms on rm (skills/plugins/mcp)
      --dry-run            print intended action without doing it (rm)
  -q, --quiet              suppress prompts (CI safe)
      --no-color           disable ANSI colors
  -h, --help               this message
  -v, --version            print version
```

## CI integration

```yaml
# .github/workflows/agent-health.yml
- run: npm i -g @joinc/hi
- run: hi status --fail-on-missing -f json -o hi-status.json
- uses: actions/upload-artifact@v4
  with: { name: hi-status, path: hi-status.json }
```

Exit codes:

| Code | Meaning |
|---|---|
| 0 | success |
| 1 | runtime error |
| 2 | gate failure (`--fail-on-missing` and something is missing) |

## What you get

| Need | hi gives you |
|---|---|
| One-shot install | `hi setup` picks the right channel per tool, prompts before each step |
| Mode switching | `hi mode lite\|full\|ultra\|wenyan-*\|off` writes the caveman flag |
| Combined report | `hi stats` aggregates rtk savings + caveman lifetime stats |
| Scriptable | `-f json` on every command, `-o file` to capture output |
| CI gate | `--fail-on-missing` exits non-zero — drop straight into your pipeline |
| Local-first | Pure JS, zero runtime deps, no telemetry, no network calls except installers you trigger |
| Bilingual | `--lang en\|zh` for status / doctor / mode strings |
| TUI | Bare `hi` launches an interactive dashboard with hotkeys |

## Proxy behavior

```bash
hi proxy 7890                    # persist to your shell rc (~/.zshrc on zsh)
hi proxy off                     # remove the persisted block
eval "$(hi proxy 7890 --print)"  # current shell only
hi proxy show                    # inspect current env + persistence state
```

## Adding a new add-on

Drop a file under `src/installers/`:

```js
// src/installers/myaddon.js
module.exports = {
  name: 'myaddon',
  label: 'myaddon  (description)',
  repo: 'owner/repo',
  inspect() {
    // Read-only detection. Return:
    //   { name, label, installed, extras: [{ level: 'ok'|'bad'|'warn'|'info', text }] }
  },
  async install() { /* prompt, install, return 0/non-zero */ },
  uninstall() { /* return 0/non-zero */ },
};
```

Register it in `src/installers/index.js` — every command (`status`, `install`, `uninstall`, `list`, TUI) picks it up automatically.

## Privacy

`hi` runs entirely on your machine. It reads:

- `~/.claude/` (settings, hooks, plugins, caveman flag + history)
- the PATH lookup for `rtk`, `node`, `claude`, `brew`, `curl`, `cargo`

It never sends a network request unless **you** trigger an installer (`hi install …`) — and then only to the upstream of that specific tool.

## Contributing

Add-on PRs welcome. A good add-on PR usually includes:

- a file under `src/installers/<name>.js` exporting `inspect / install / uninstall`
- registration in `src/installers/index.js`
- a one-line entry in this README's "Managed add-ons" table

## License

[MIT](LICENSE)
