const path = require('path');
const os = require('os');

const HOME = os.homedir();
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude');

module.exports = {
  HOME,
  CLAUDE_DIR,
  CAVEMAN_FLAG: path.join(CLAUDE_DIR, '.caveman-active'),
  CAVEMAN_SUFFIX: path.join(CLAUDE_DIR, '.caveman-statusline-suffix'),
  CAVEMAN_HISTORY: path.join(CLAUDE_DIR, '.caveman-history.jsonl'),
  CLAUDE_PLUGINS_JSON: path.join(CLAUDE_DIR, 'plugins', 'installed_plugins.json'),
  HOOKS_DIR: path.join(CLAUDE_DIR, 'hooks'),
  SKILLS_DIR: path.join(CLAUDE_DIR, 'skills'),
};
