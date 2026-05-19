const { ok, bad, warn, info, head } = require('../lib/ui');
const { have, tryExec, run } = require('../lib/have');
const { confirm } = require('../lib/confirm');

const REPO = 'sunlley/openclaw';
const PKG = 'openclaw';

function version() {
  if (!have('openclaw')) return null;
  const r = tryExec('openclaw', ['--version']);
  return r.code === 0 ? r.stdout.trim() : '(version unknown)';
}

function inspect() {
  const installed = Boolean(have('openclaw'));
  const out = {
    name: 'openclaw',
    label: 'openclaw  (OpenClaw agent runtime)',
    repo: REPO,
    installed,
    extras: [],
  };
  if (installed) {
    out.path = have('openclaw');
    out.version = version();
    out.extras.push({ level: 'ok', text: `installed at ${out.path}` });
    out.extras.push({ level: 'info', text: out.version });
  } else {
    out.extras.push({ level: 'bad', text: 'not installed' });
    out.extras.push({ level: 'info', text: 'run:  hi install openclaw' });
    if (!have('npm')) out.extras.push({ level: 'warn', text: 'npm not on PATH — needed for default install method' });
  }
  return out;
}

async function install() {
  head('install openclaw');
  if (have('openclaw')) {
    ok(`already installed: ${have('openclaw')}`);
    info(version() || '(version unknown)');
    return 0;
  }
  if (!have('npm')) {
    bad('npm not on PATH — install Node first');
    return 1;
  }
  info(`method: npm i -g ${PKG}`);
  if (!(await confirm('proceed'))) { warn('skipped'); return 1; }
  const rc = run('npm', ['i', '-g', PKG]);
  if (have('openclaw')) { ok(`installed: ${version()}`); return 0; }
  bad('install ran but openclaw not found on PATH');
  return rc || 1;
}

function uninstall() {
  head('uninstall openclaw');
  if (!have('openclaw')) { warn('not installed'); return 0; }
  if (!have('npm')) { bad('npm not on PATH'); return 1; }
  info(`method: npm uninstall -g ${PKG}`);
  return run('npm', ['uninstall', '-g', PKG]);
}

module.exports = {
  name: 'openclaw',
  label: 'openclaw  (OpenClaw agent runtime)',
  repo: REPO,
  inspect,
  install,
  uninstall,
};
