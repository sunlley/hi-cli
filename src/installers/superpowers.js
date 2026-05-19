const { ok, bad, warn, info, head } = require('../lib/ui');
const { have, tryExec, run } = require('../lib/have');
const { confirm } = require('../lib/confirm');
const { superpowersInstalled } = require('../lib/detect');

const REPO = 'obra/superpowers';
const MARKETPLACE = 'claude-plugins-official';
const PLUGIN = `superpowers@${MARKETPLACE}`;

function inspect() {
  const installed = superpowersInstalled(PLUGIN);
  const out = {
    name: 'superpowers',
    label: 'superpowers  (obra/superpowers)',
    repo: REPO,
    plugin: PLUGIN,
    marketplace: MARKETPLACE,
    installed,
    extras: [],
  };
  if (installed) out.extras.push({ level: 'ok', text: `installed: ${PLUGIN}` });
  else {
    out.extras.push({ level: 'bad', text: 'not installed' });
    out.extras.push({ level: 'info', text: 'run:  hi install superpowers' });
    if (!have('claude')) out.extras.push({ level: 'info', text: `  ↳ claude CLI missing — fallback: /plugin install ${PLUGIN} inside Claude Code` });
  }
  return out;
}

async function install() {
  head('install superpowers');
  if (superpowersInstalled(PLUGIN)) {
    ok(`already installed: ${PLUGIN}`);
    return 0;
  }
  if (!have('claude')) {
    bad("claude CLI not on PATH — can't auto-install");
    info(`manual: open Claude Code, type:  /plugin install ${PLUGIN}`);
    info(`repo:   https://github.com/${REPO}`);
    return 1;
  }
  info(`method: claude plugin install ${PLUGIN}`);
  if (!(await confirm('proceed'))) { warn('skipped'); return 1; }

  const mlist = tryExec('claude', ['plugin', 'marketplace', 'list']);
  if (mlist.code !== 0 || !mlist.stdout.includes(MARKETPLACE)) {
    info(`registering marketplace anthropics/${MARKETPLACE}`);
    const rc = run('claude', ['plugin', 'marketplace', 'add', `anthropics/${MARKETPLACE}`]);
    if (rc !== 0) { bad('could not register marketplace'); return 1; }
  }

  const rc = run('claude', ['plugin', 'install', PLUGIN]);
  if (superpowersInstalled(PLUGIN)) {
    ok(`installed: ${PLUGIN}`);
    info('restart Claude Code session for plugin to fully load');
    return 0;
  }
  bad(`install ran but ${PLUGIN} not present in installed_plugins.json`);
  return rc || 1;
}

function uninstall() {
  head('uninstall superpowers');
  if (!have('claude')) {
    bad('claude CLI not on PATH');
    info(`manual: /plugin uninstall ${PLUGIN}  inside Claude Code`);
    return 1;
  }
  return run('claude', ['plugin', 'uninstall', PLUGIN]);
}

module.exports = {
  name: 'superpowers',
  label: 'superpowers  (obra/superpowers)',
  repo: REPO,
  plugin: PLUGIN,
  marketplace: MARKETPLACE,
  inspect,
  install,
  uninstall,
};
