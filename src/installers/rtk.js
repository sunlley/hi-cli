const { ok, bad, warn, info, head } = require('../lib/ui');
const { have, tryExec, run } = require('../lib/have');
const { confirm } = require('../lib/confirm');
const { rtkInstalled } = require('../lib/detect');

const REPO = 'rtk-ai/rtk';

function version() {
  if (!rtkInstalled()) return null;
  const r = tryExec('rtk', ['--version']);
  return r.code === 0 ? r.stdout.trim() : '(version unknown)';
}

function inspect() {
  const installed = rtkInstalled();
  const out = {
    name: 'rtk',
    label: 'rtk  (Rust Token Killer)',
    repo: REPO,
    installed,
    extras: [],
  };
  if (installed) {
    out.path = have('rtk');
    out.version = version();
    out.extras.push({ level: 'ok', text: `installed at ${out.path}` });
    out.extras.push({ level: 'info', text: out.version });
  } else {
    out.extras.push({ level: 'bad', text: 'not installed' });
    out.extras.push({ level: 'info', text: 'run:  hi install rtk' });
    let hint = null;
    if (have('brew')) hint = '  ↳ best method here: brew install rtk';
    else if (have('curl')) hint = '  ↳ best method here: curl install.sh';
    else if (have('cargo')) hint = '  ↳ best method here: cargo install --git';
    if (hint) out.extras.push({ level: 'info', text: hint });
    out.extras.push({ level: 'info', text: `manual: https://github.com/${REPO}#installation` });
  }
  return out;
}

async function install() {
  head('install rtk');
  if (rtkInstalled()) {
    ok(`already installed: ${have('rtk')}`);
    info(version() || '(version unknown)');
    return 0;
  }

  let method = null;
  if (have('brew')) method = 'brew';
  else if (have('curl')) method = 'curl';
  else if (have('cargo')) method = 'cargo';
  else {
    bad('no installer available — need one of: brew, curl, cargo');
    info(`manual: https://github.com/${REPO}#installation`);
    return 1;
  }

  let rc = 1;
  if (method === 'brew') {
    info('method: brew install rtk');
    if (!(await confirm('proceed'))) { warn('skipped (other methods: curl, cargo)'); return 1; }
    rc = run('brew', ['install', 'rtk']);
  } else if (method === 'curl') {
    info('method: curl install.sh | sh   (installs to ~/.local/bin)');
    if (!(await confirm('proceed'))) { warn('skipped'); return 1; }
    rc = run('sh', ['-c', 'curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh']);
  } else if (method === 'cargo') {
    info(`method: cargo install --git https://github.com/${REPO}`);
    info("(note: plain 'cargo install rtk' fetches the wrong crate)");
    if (!(await confirm('proceed'))) { warn('skipped'); return 1; }
    rc = run('cargo', ['install', '--git', `https://github.com/${REPO}`]);
  }

  if (rtkInstalled()) {
    ok(`installed: ${version() || 'rtk'}`);
    return 0;
  }
  bad('install ran but rtk not found on PATH');
  if (method === 'curl') info('add to PATH:  export PATH="$HOME/.local/bin:$PATH"');
  if (method === 'cargo') info('add to PATH:  export PATH="$HOME/.cargo/bin:$PATH"');
  return rc || 1;
}

function uninstall() {
  head('uninstall rtk');
  info(`rtk has its own uninstall path — see https://github.com/${REPO}`);
  return 0;
}

module.exports = {
  name: 'rtk',
  label: 'rtk  (Rust Token Killer)',
  repo: REPO,
  inspect,
  install,
  uninstall,
};
