const { ok, bad, warn, info, head } = require('../lib/ui');
const { have, tryExec, run } = require('../lib/have');
const { confirm } = require('../lib/confirm');

const REPO = 'luoyuctl/agenttrace';
const INSTALL_URL = 'https://raw.githubusercontent.com/luoyuctl/agenttrace/master/install.sh';

function version() {
  if (!have('agenttrace')) return null;
  const r = tryExec('agenttrace', ['--version']);
  return r.code === 0 ? r.stdout.trim() : '(version unknown)';
}

function inspect() {
  const installed = Boolean(have('agenttrace'));
  const out = {
    name: 'agenttrace',
    label: 'agenttrace  (AI agent session trace viewer)',
    repo: REPO,
    installed,
    extras: [],
  };
  if (installed) {
    out.path = have('agenttrace');
    out.version = version();
    out.extras.push({ level: 'ok', text: `installed at ${out.path}` });
    out.extras.push({ level: 'info', text: out.version });
  } else {
    out.extras.push({ level: 'bad', text: 'not installed' });
    out.extras.push({ level: 'info', text: 'run:  hi install agenttrace' });
    let hint = null;
    if (have('curl')) hint = `  ↳ best method here: curl -fsSL ${INSTALL_URL} | sh`;
    else if (have('brew')) hint = '  ↳ fallback method here: brew install luoyuctl/tap/agenttrace';
    if (hint) out.extras.push({ level: 'info', text: hint });
    out.extras.push({ level: 'info', text: `manual: https://github.com/${REPO}#install` });
  }
  return out;
}

async function install() {
  head('install agenttrace');
  if (have('agenttrace')) {
    ok(`already installed: ${have('agenttrace')}`);
    info(version() || '(version unknown)');
    return 0;
  }

  let method = null;
  if (have('curl')) method = 'curl';
  else if (have('brew')) method = 'brew';
  else {
    bad('no installer available — need one of: curl, brew');
    info(`manual: https://github.com/${REPO}#install`);
    return 1;
  }

  let rc = 1;
  if (method === 'curl') {
    info(`method: curl -fsSL ${INSTALL_URL} | sh`);
    if (!(await confirm('proceed'))) { warn('skipped (other method: brew)'); return 1; }
    rc = run('sh', ['-c', `curl -fsSL ${INSTALL_URL} | sh`]);
  } else if (method === 'brew') {
    info('method: brew install luoyuctl/tap/agenttrace');
    if (!(await confirm('proceed'))) { warn('skipped'); return 1; }
    rc = run('brew', ['install', 'luoyuctl/tap/agenttrace']);
  }

  if (have('agenttrace')) {
    ok(`installed: ${version() || 'agenttrace'}`);
    return 0;
  }
  bad('install ran but agenttrace not found on PATH');
  if (method === 'curl') info('add to PATH:  export PATH="$HOME/.local/bin:$PATH"');
  return rc || 1;
}

function uninstall() {
  head('uninstall agenttrace');
  if (!have('agenttrace')) { warn('not installed'); return 0; }
  bad('no scripted uninstall yet — remove the installed binary manually');
  info(`binary at: ${have('agenttrace')}`);
  info(`see: https://github.com/${REPO}`);
  return 1;
}

module.exports = {
  name: 'agenttrace',
  label: 'agenttrace  (AI agent session trace viewer)',
  repo: REPO,
  inspect,
  install,
  uninstall,
};
