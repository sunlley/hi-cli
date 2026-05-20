const { ok, bad, warn, info, head } = require('../lib/ui');
const { have, tryExec, run } = require('../lib/have');
const { confirm } = require('../lib/confirm');

const REPO = 'sst/opencode';

function version() {
  if (!have('opencode')) return null;
  const r = tryExec('opencode', ['--version']);
  return r.code === 0 ? r.stdout.trim() : '(version unknown)';
}

function inspect() {
  const installed = Boolean(have('opencode'));
  const out = {
    name: 'opencode',
    label: 'opencode  (sst/opencode TUI)',
    repo: REPO,
    installed,
    extras: [],
  };
  if (installed) {
    out.path = have('opencode');
    out.version = version();
    out.extras.push({ level: 'ok', text: `installed at ${out.path}` });
    out.extras.push({ level: 'info', text: out.version });
  } else {
    out.extras.push({ level: 'bad', text: 'not installed' });
    out.extras.push({ level: 'info', text: 'run:  hi install opencode' });
    let hint = null;
    if (have('curl')) hint = '  ↳ best method here: curl -fsSL opencode.ai/install | bash';
    else if (have('brew')) hint = '  ↳ fallback method here: brew install sst/tap/opencode';
    if (hint) out.extras.push({ level: 'info', text: hint });
  }
  return out;
}

async function install() {
  head('install opencode');
  if (have('opencode')) {
    ok(`already installed: ${have('opencode')}`);
    info(version() || '(version unknown)');
    return 0;
  }

  let method = null;
  if (have('curl')) method = 'curl';
  else if (have('brew')) method = 'brew';
  else {
    bad('no installer available — need one of: curl, brew');
    info(`manual: https://github.com/${REPO}#installation`);
    return 1;
  }

  let rc = 1;
  if (method === 'curl') {
    info('method: curl -fsSL opencode.ai/install | bash');
    if (!(await confirm('proceed'))) { warn('skipped (other method: brew)'); return 1; }
    rc = run('sh', ['-c', 'curl -fsSL https://opencode.ai/install | bash']);
  } else if (method === 'brew') {
    info('method: brew install sst/tap/opencode');
    if (!(await confirm('proceed'))) { warn('skipped'); return 1; }
    rc = run('brew', ['install', 'sst/tap/opencode']);
  }

  if (have('opencode')) { ok(`installed: ${version()}`); return 0; }
  bad('install ran but opencode not found on PATH');
  return rc || 1;
}

function uninstall() {
  head('uninstall opencode');
  if (!have('opencode')) { warn('not installed'); return 0; }
  if (have('brew')) {
    info('method: brew uninstall opencode');
    return run('brew', ['uninstall', 'opencode']);
  }
  bad('cannot auto-uninstall — non-brew install. Remove the binary manually.');
  info(`binary at: ${have('opencode')}`);
  return 1;
}

module.exports = {
  name: 'opencode',
  label: 'opencode  (sst/opencode TUI)',
  repo: REPO,
  inspect,
  install,
  uninstall,
};
