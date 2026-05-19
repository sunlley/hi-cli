const fs = require('fs');
const { ok, bad, warn, info, head } = require('../lib/ui');
const { have, tryExec, run } = require('../lib/have');
const { confirm } = require('../lib/confirm');
const { cavemanHooksInstalled, cavemanActiveMode } = require('../lib/detect');
const P = require('../lib/paths');

const REPO = 'JuliusBrussee/caveman';

function nodeMajor() {
  if (!have('node')) return null;
  const r = tryExec('node', ['-v']);
  if (r.code !== 0) return null;
  const m = r.stdout.trim().replace(/^v/, '').split('.')[0];
  return Number(m) || null;
}

function inspect() {
  const installed = cavemanHooksInstalled();
  const mode = cavemanActiveMode();
  let savings = null;
  if (fs.existsSync(P.CAVEMAN_SUFFIX)) {
    try { savings = fs.readFileSync(P.CAVEMAN_SUFFIX, 'utf8').trim() || null; } catch {}
  }

  const out = {
    name: 'caveman',
    label: 'caveman',
    repo: REPO,
    installed,
    mode,
    savings,
    extras: [],
  };
  if (installed) out.extras.push({ level: 'ok', text: `hooks present in ${P.HOOKS_DIR}` });
  else { out.extras.push({ level: 'bad', text: 'hooks missing' }); out.extras.push({ level: 'info', text: 'run:  hi install caveman' }); }
  if (mode) out.extras.push({ level: 'ok', text: `active mode: ${mode}` });
  else out.extras.push({ level: 'warn', text: 'inactive (no flag file)' });
  if (savings) out.extras.push({ level: 'info', text: `lifetime savings: ${savings}` });
  return out;
}

async function install() {
  head('install caveman');
  if (cavemanHooksInstalled()) {
    ok(`hooks already present in ${P.HOOKS_DIR}`);
    if (!(await confirm('reinstall anyway'))) { info('skipping'); return 0; }
  }
  if (!have('node')) {
    bad('node not on PATH — caveman needs Node ≥18');
    info('install Node first (brew install node, nvm, etc.)');
    return 1;
  }
  const maj = nodeMajor();
  if (maj != null && maj < 18) {
    bad(`node v${maj} too old — caveman needs ≥18`);
    return 1;
  }
  info(`method: npx -y github:${REPO} -- --non-interactive`);
  if (!(await confirm('proceed'))) { warn('skipped'); return 1; }
  const rc = run('npx', ['-y', `github:${REPO}`, '--', '--non-interactive']);
  if (cavemanHooksInstalled()) {
    ok('caveman hooks installed');
    return 0;
  }
  bad(`install ran but hooks not found in ${P.HOOKS_DIR}`);
  return rc || 1;
}

function uninstall() {
  head('uninstall caveman');
  return run('npx', ['-y', `github:${REPO}`, '--', '--uninstall']);
}

module.exports = {
  name: 'caveman',
  label: 'caveman',
  repo: REPO,
  inspect,
  install,
  uninstall,
};
