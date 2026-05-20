const fs = require('fs');
const path = require('path');
const P = require('../lib/paths');
const { head, ok, bad, warn, info } = require('../lib/ui');
const { emit, renderJSON } = require('../lib/render');

const OFF = new Set(['off', 'stop', 'disable', 'unset']);
const PROXY_KEYS = [
  ['https_proxy', 'HTTPS_PROXY'],
  ['http_proxy', 'HTTP_PROXY'],
  ['all_proxy', 'ALL_PROXY'],
];
const BLOCK_START = '# >>> hi proxy >>>';
const BLOCK_END = '# <<< hi proxy <<<';

function build() {
  const report = { active: false };
  for (const [lower, upper] of PROXY_KEYS) {
    const lowerValue = process.env[lower] || null;
    const upperValue = process.env[upper] || null;
    report[lower] = lowerValue;
    report[upper] = upperValue;
    if (lowerValue || upperValue) report.active = true;
  }
  report.persisted = readPersistedProxy();
  return report;
}

function parsePort(s) {
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 65535 ? n : null;
}

function exportLines(port) {
  const http = `http://127.0.0.1:${port}`;
  const socks = `socks5://127.0.0.1:${port}`;
  return [
    `export https_proxy="${http}"`,
    `export http_proxy="${http}"`,
    `export all_proxy="${socks}"`,
    `export HTTPS_PROXY="${http}"`,
    `export HTTP_PROXY="${http}"`,
    `export ALL_PROXY="${socks}"`,
  ];
}

function unsetLine() {
  return 'unset https_proxy http_proxy all_proxy HTTPS_PROXY HTTP_PROXY ALL_PROXY';
}

function detectShellRc(shell = process.env.SHELL || '', home = P.HOME) {
  const base = path.basename(shell);
  if (base === 'zsh') return path.join(home, '.zshrc');
  if (base === 'bash') {
    const bashProfile = path.join(home, '.bash_profile');
    const bashrc = path.join(home, '.bashrc');
    if (fs.existsSync(bashProfile)) return bashProfile;
    return bashrc;
  }
  return null;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function blockRegex() {
  return new RegExp(`${escapeRegExp(BLOCK_START)}\\n[\\s\\S]*?\\n${escapeRegExp(BLOCK_END)}\\n?`, 'm');
}

function proxyBlock(port) {
  return [BLOCK_START, ...exportLines(port), BLOCK_END].join('\n');
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function matchExport(text, key) {
  const match = text.match(new RegExp(`export ${escapeRegExp(key)}="([^"]*)"`));
  return match ? match[1] : null;
}

function readPersistedProxy(rcFile = detectShellRc()) {
  const report = { active: false, rc_file: rcFile || null };
  for (const [lower, upper] of PROXY_KEYS) {
    report[lower] = null;
    report[upper] = null;
  }
  if (!rcFile) return report;

  const text = readText(rcFile);
  const match = text.match(blockRegex());
  if (!match) return report;

  report.active = true;
  for (const [lower, upper] of PROXY_KEYS) {
    report[lower] = matchExport(match[0], lower);
    report[upper] = matchExport(match[0], upper);
  }
  return report;
}

function upsertPersistedProxy(port, rcFile = detectShellRc()) {
  if (!rcFile) return null;
  const current = readText(rcFile);
  const next = current.replace(blockRegex(), '').trimEnd();
  const out = `${next ? `${next}\n\n` : ''}${proxyBlock(port)}\n`;
  fs.mkdirSync(path.dirname(rcFile), { recursive: true });
  fs.writeFileSync(rcFile, out);
  return rcFile;
}

function removePersistedProxy(rcFile = detectShellRc()) {
  if (!rcFile) return null;
  const current = readText(rcFile);
  const next = current.replace(blockRegex(), '').trimEnd();
  fs.mkdirSync(path.dirname(rcFile), { recursive: true });
  fs.writeFileSync(rcFile, next ? `${next}\n` : '');
  return rcFile;
}

function renderProxyStatus(report) {
  for (const [lower, upper] of PROXY_KEYS) {
    if (report[lower]) info(`${lower} = ${report[lower]}`);
    if (report[upper]) info(`${upper} = ${report[upper]}`);
  }
}

function shouldPersist(opts) {
  if (opts.print) return false;
  if (opts.persist) return true;
  return (opts.format || 'text') === 'text' && process.stdout.isTTY;
}

function emitPersistResult(action, rcFile, opts) {
  if (opts.format === 'json') {
    emit(renderJSON({ persisted: action === 'set', rc_file: rcFile }), opts.output);
    return 0;
  }
  head('proxy');
  if (!rcFile) {
    bad('could not detect a supported shell rc file');
    info('use: eval "$(hi proxy <port> --print)" for current shell only');
    return 1;
  }
  if (action === 'set') ok(`persisted in ${rcFile}`);
  else ok(`removed persisted proxy from ${rcFile}`);
  info(`current shell is unchanged; run: source ${rcFile}`);
  info('new terminals will pick up the change automatically');
  return 0;
}

function emitShell(lines, opts, hint) {
  if (opts.format === 'json') {
    emit(renderJSON({ shell: lines.join('; ') }), opts.output);
    return 0;
  }
  // stdout = the eval payload (no decoration, no trailing message).
  process.stdout.write(lines.join('\n') + '\n');
  // Hint only when stdout is a TTY (user invoked directly, not via eval "$(...)").
  if (process.stdout.isTTY && !opts.quiet) {
    process.stderr.write(`hint: ${hint}\n`);
  }
  return 0;
}

async function run(args, opts = {}) {
  const sub = args[0] || 'show';

  if (sub === 'show' || sub === 'status') {
    const r = build();
    if (opts.format === 'json') { emit(renderJSON(r), opts.output); return 0; }
    head('proxy');
    if (r.active) {
      ok('active');
      renderProxyStatus(r);
    } else {
      warn('no proxy set in current env');
    }
    if (r.persisted.active) {
      info(`persisted in ${r.persisted.rc_file}`);
    } else if (r.persisted.rc_file) {
      info(`not persisted for new terminals (${r.persisted.rc_file})`);
    }
    return 0;
  }

  if (OFF.has(sub)) {
    if (shouldPersist(opts)) {
      return emitPersistResult('off', removePersistedProxy(), opts);
    }
    return emitShell([unsetLine()], opts, `run via:  eval "$(hi proxy off)"`);
  }

  const port = parsePort(sub);
  if (port != null) {
    if (shouldPersist(opts)) {
      return emitPersistResult('set', upsertPersistedProxy(port), opts);
    }
    return emitShell(exportLines(port), opts, `run via:  eval "$(hi proxy ${port})"`);
  }

  const err = new Error(`unknown proxy arg '${sub}', expected: <port>|off|show`);
  err.code = 'USAGE';
  throw err;
}

module.exports = {
  run,
  build,
  detectShellRc,
  readPersistedProxy,
  upsertPersistedProxy,
  removePersistedProxy,
};
