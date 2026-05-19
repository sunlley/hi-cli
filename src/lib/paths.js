const path = require('path');
const os = require('os');

const HOME = os.homedir();
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude');

// Every CLI we manage stores skills in its own dir. Order matters — first
// match wins when a `hi skills show <name>` lookup is ambiguous (claude first).
const SKILL_SOURCES = [
  { cli: 'claude',   dir: path.join(CLAUDE_DIR, 'skills') },
  { cli: 'codex',    dir: path.join(HOME, '.codex', 'skills') },
  { cli: 'opencode', dir: path.join(HOME, '.config', 'opencode', 'skills') },
  { cli: 'openclaw', dir: path.join(HOME, '.openclaw', 'workspace', 'skills') },
  { cli: 'hermes',   dir: path.join(HOME, '.hermes', 'skills') },
];

module.exports = {
  HOME,
  CLAUDE_DIR,
  CAVEMAN_FLAG: path.join(CLAUDE_DIR, '.caveman-active'),
  CAVEMAN_SUFFIX: path.join(CLAUDE_DIR, '.caveman-statusline-suffix'),
  CAVEMAN_HISTORY: path.join(CLAUDE_DIR, '.caveman-history.jsonl'),
  CLAUDE_PLUGINS_JSON: path.join(CLAUDE_DIR, 'plugins', 'installed_plugins.json'),
  HOOKS_DIR: path.join(CLAUDE_DIR, 'hooks'),
  SKILLS_DIR: path.join(CLAUDE_DIR, 'skills'),
  SKILL_SOURCES,
};
