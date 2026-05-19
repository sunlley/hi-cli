const pkg = require('../package.json');
const { c } = require('./lib/ui');
const { parse } = require('./lib/argparse');
const { setLang, t } = require('./lib/i18n');

const GLOBAL_SPEC = {
  format: { type: 'string', alias: 'f', default: 'text', choices: ['text', 'json', 'markdown', 'md'] },
  output: { type: 'string', alias: 'o' },
  lang: { type: 'string', default: process.env.HI_LANG || 'en', choices: ['en', 'zh', 'zh-cn', 'chinese'] },
  quiet: { type: 'boolean', alias: 'q' },
  'no-color': { type: 'boolean' },
  'fail-on-missing': { type: 'boolean' },
  help: { type: 'boolean', alias: 'h' },
  version: { type: 'boolean', alias: 'v' },
  demo: { type: 'boolean' },
  yes: { type: 'boolean', alias: 'y' },
  'dry-run': { type: 'boolean' },
};

const commands = {
  status: () => require('./commands/status'),
  setup: () => ({ run: (args, opts) => require('./commands/install').run(['all'], opts) }),
  install: () => require('./commands/install'),
  uninstall: () => require('./commands/uninstall'),
  rm: () => require('./commands/uninstall'),
  mode: () => require('./commands/mode'),
  stats: () => require('./commands/stats'),
  proxy: () => require('./commands/proxy'),
  update: () => require('./commands/update'),
  upgrade: () => require('./commands/update'),
  doctor: () => require('./commands/doctor'),
  check: () => require('./commands/doctor'),
  list: () => require('./commands/list'),
  ls: () => require('./commands/list'),
  tui: () => require('./commands/tui'),
  skills: () => require('./commands/skills'),
  skill: () => require('./commands/skills'),
  plugins: () => require('./commands/plugins'),
  plugin: () => require('./commands/plugins'),
  mcp: () => require('./commands/mcp'),
};

function usage() {
  console.log(`${c.bold('hi')} v${pkg.version} — central manager for Claude Code add-ons

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
  proxy <port|off|show>    set/unset HTTP+SOCKS proxy env (eval-able exports)
  skills [list|show|rm]    manage skill dirs across every managed CLI
  plugins [list|show|rm|enable|disable|doctor|clean]
                           manage plugins across claude + openclaw;
                           doctor finds broken/missing, clean auto-disables broken,
                           --all unhides openclaw stock bundles
  mcp [list|show|rm]       manage MCP servers across claude/codex/opencode/openclaw
  update                   update caveman to latest from main

Global flags:
  -f, --format <fmt>       text | json | markdown   (default: text)
  -o, --output <file>      write report to file (stderr: "saved to ...")
      --lang <en|zh>       output language for status/doctor strings
      --fail-on-missing    exit 2 when any add-on is missing (CI gate)
  -y, --yes                auto-accept confirm prompts (CI safe)
      --dry-run            print what would be done, do nothing (skills/plugins/mcp rm)
  -q, --quiet              suppress prompts (CI safe)
      --no-color           disable ANSI colors
  -h, --help               this message
  -v, --version            print version

Examples:
  hi                              # interactive TUI
  hi status                       # text status
  hi status -f json               # JSON for scripting
  hi status -f markdown -o s.md   # save markdown
  hi status --fail-on-missing     # CI gate
  hi doctor --lang zh             # Chinese output

Repos:
  caveman      https://github.com/JuliusBrussee/caveman
  rtk          https://github.com/rtk-ai/rtk
  superpowers  https://github.com/obra/superpowers`);
}

async function main(argv) {
  // Find the subcommand (first non-flag token); parse global flags + subcommand args together.
  // Strategy: take everything as flags+positional, then first positional is the command.
  const opts = parse(argv, GLOBAL_SPEC);
  const positional = opts._;
  const cmd = positional[0];
  const rest = positional.slice(1);

  if (opts['no-color']) process.env.NO_COLOR = '1';
  setLang(opts.lang);

  if (opts.version) { console.log(pkg.version); return 0; }
  if (opts.help && !cmd) { usage(); return 0; }

  // Bare invocation → TUI (agenttrace style).
  if (!cmd) {
    return commands.tui().run([], opts);
  }
  if (cmd === 'help') { usage(); return 0; }

  const loader = commands[cmd];
  if (!loader) {
    process.stderr.write(`unknown command: ${cmd}\n\n`);
    usage();
    process.exit(1);
  }

  const mod = loader();
  const rc = await mod.run(rest, opts);
  if (typeof rc === 'number' && rc !== 0) process.exit(rc);
  return rc || 0;
}

module.exports = { main };
