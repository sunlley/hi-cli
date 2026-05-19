const fs = require('fs');
const path = require('path');
const P = require('../lib/paths');
const { ok, bad, warn, info, head } = require('../lib/ui');
const { have, tryExec, run } = require('../lib/have');
const { confirm } = require('../lib/confirm');

const REPO = 'NousResearch/hermes-agent';
const INSTALL_URL = 'https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh';
const HERMES_DIR = path.join(P.HOME, '.hermes');

function version() {
  if (!have('hermes')) return null;
  const r = tryExec('hermes', ['--version']);
  if (r.code === 0 && r.stdout.trim()) return r.stdout.trim();
  // Some builds expose version via `hermes doctor`; fall back to a generic marker.
  return '(version unknown)';
}

function inspect() {
  const onPath = Boolean(have('hermes'));
  const hasHome = fs.existsSync(HERMES_DIR);
  const installed = onPath || hasHome;
  const out = {
    name: 'hermes',
    label: 'hermes  (Hermes Agent — Nous Research)',
    repo: REPO,
    installed,
    extras: [],
  };
  if (onPath) {
    out.path = have('hermes');
    out.version = version();
    out.extras.push({ level: 'ok', text: `installed at ${out.path}` });
    out.extras.push({ level: 'info', text: out.version });
  } else if (hasHome) {
    out.extras.push({ level: 'warn', text: `${HERMES_DIR} exists but 'hermes' not on PATH` });
    out.extras.push({ level: 'info', text: 'add ~/.local/bin to PATH, or re-run installer' });
  } else {
    out.extras.push({ level: 'bad', text: 'not installed' });
    out.extras.push({ level: 'info', text: 'run:  hi install hermes' });
    if (!have('curl')) out.extras.push({ level: 'warn', text: 'curl not on PATH — required by installer' });
  }
  return out;
}

async function install() {
  head('install hermes');
  if (have('hermes')) {
    ok(`already installed: ${have('hermes')}`);
    info(version() || '(version unknown)');
    return 0;
  }
  if (!have('curl')) {
    bad('curl not on PATH — required by installer');
    info(`manual: https://github.com/${REPO}#installation`);
    return 1;
  }
  info(`method: curl -fsSL ${INSTALL_URL} | bash`);
  info('installer pulls uv, Python 3.11, Node, ripgrep, ffmpeg — may take a few minutes');
  if (!(await confirm('proceed'))) { warn('skipped'); return 1; }
  const rc = run('sh', ['-c', `curl -fsSL ${INSTALL_URL} | bash`]);
  if (have('hermes')) { ok(`installed: ${version()}`); return 0; }
  bad('install ran but hermes not found on PATH');
  info('add to PATH:  export PATH="$HOME/.local/bin:$PATH"');
  return rc || 1;
}

function uninstall() {
  head('uninstall hermes');
  if (!fs.existsSync(HERMES_DIR) && !have('hermes')) { warn('not installed'); return 0; }
  bad('no scripted uninstall — hermes has no `--uninstall` flag');
  info('manual cleanup:');
  info(`  rm -rf ${HERMES_DIR}`);
  info('  rm -f ~/.local/bin/hermes');
  info(`  see ${`https://github.com/${REPO}`} for full path list`);
  return 1;
}

module.exports = {
  name: 'hermes',
  label: 'hermes  (Hermes Agent — Nous Research)',
  repo: REPO,
  inspect,
  install,
  uninstall,
};
