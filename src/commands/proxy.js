const { head, ok, bad, warn, info } = require('../lib/ui');
const { emit, renderJSON } = require('../lib/render');

const OFF = new Set(['off', 'stop', 'disable', 'unset']);

function build() {
  const { https_proxy, http_proxy, all_proxy } = process.env;
  return {
    active: Boolean(https_proxy || http_proxy || all_proxy),
    https_proxy: https_proxy || null,
    http_proxy: http_proxy || null,
    all_proxy: all_proxy || null,
  };
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
  ];
}

function unsetLine() {
  return 'unset https_proxy http_proxy all_proxy';
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
      if (r.https_proxy) info(`https_proxy = ${r.https_proxy}`);
      if (r.http_proxy) info(`http_proxy  = ${r.http_proxy}`);
      if (r.all_proxy) info(`all_proxy   = ${r.all_proxy}`);
    } else {
      warn('no proxy set in current env');
    }
    return 0;
  }

  if (OFF.has(sub)) {
    return emitShell([unsetLine()], opts, `run via:  eval "$(hi proxy off)"`);
  }

  const port = parsePort(sub);
  if (port != null) {
    return emitShell(exportLines(port), opts, `run via:  eval "$(hi proxy ${port})"`);
  }

  const err = new Error(`unknown proxy arg '${sub}', expected: <port>|off|show`);
  err.code = 'USAGE';
  throw err;
}

module.exports = { run };
