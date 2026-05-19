const { ok, bad, warn, info, head } = require('../lib/ui');
const { have, tryExec, run } = require('../lib/have');
const { confirm } = require('../lib/confirm');

const REPO = 'openai/codex';
const PKG = '@openai/codex';

function version() {
  if (!have('codex')) return null;
  const r = tryExec('codex', ['--version']);
  return r.code === 0 ? r.stdout.trim() : '(version unknown)';
}

function inspect() {
  const installed = Boolean(have('codex'));
  const out = {
    name: 'codex',
    label: 'codex  (OpenAI Codex CLI)',
    repo: REPO,
    installed,
    extras: [],
  };
  if (installed) {
    out.path = have('codex');
    out.version = version();
    out.extras.push({ level: 'ok', text: `installed at ${out.path}` });
    out.extras.push({ level: 'info', text: out.version });
  } else {
    out.extras.push({ level: 'bad', text: 'not installed' });
    out.extras.push({ level: 'info', text: 'run:  hi install codex' });
    if (!have('npm')) out.extras.push({ level: 'warn', text: 'npm not on PATH — needed for default install method' });
  }
  return out;
}

async function install() {
  head('install codex');
  if (have('codex')) {
    ok(`already installed: ${have('codex')}`);
    info(version() || '(version unknown)');
    return 0;
  }
  if (!have('npm')) {
    bad('npm not on PATH — install Node first');
    info(`manual: https://github.com/${REPO}#installation`);
    return 1;
  }
  info(`method: npm i -g ${PKG}`);
  if (!(await confirm('proceed'))) { warn('skipped'); return 1; }
  const rc = run('npm', ['i', '-g', PKG]);
  if (have('codex')) { ok(`installed: ${version()}`); return 0; }
  bad('install ran but codex not found on PATH');
  return rc || 1;
}

function uninstall() {
  head('uninstall codex');
  if (!have('codex')) { warn('not installed'); return 0; }
  if (!have('npm')) {
    bad('npm not on PATH — cannot uninstall an npm-installed package without it');
    return 1;
  }
  info(`method: npm uninstall -g ${PKG}`);
  return run('npm', ['uninstall', '-g', PKG]);
}

module.exports = {
  name: 'codex',
  label: 'codex  (OpenAI Codex CLI)',
  repo: REPO,
  inspect,
  install,
  uninstall,
};
