const fs = require('fs');
const path = require('path');
const P = require('../lib/paths');
const { ok, info, plain } = require('../lib/ui');
const { t } = require('../lib/i18n');
const { cavemanActiveMode } = require('../lib/detect');
const { emit, renderJSON, pick } = require('../lib/render');

const VALID = new Set(['lite', 'full', 'ultra', 'wenyan', 'wenyan-lite', 'wenyan-full', 'wenyan-ultra']);
const OFF = new Set(['off', 'disable', 'stop']);

async function run(args, opts = {}) {
  const m = args[0];
  const format = opts.format || 'text';

  if (!m) {
    const cur = cavemanActiveMode() || 'off';
    if (format === 'json') {
      emit(renderJSON({ mode: cur, valid: [...VALID] }), opts.output);
      return 0;
    }
    info(t('mode_current', cur));
    plain('usage: hi mode [lite|full|ultra|wenyan|wenyan-lite|wenyan-full|wenyan-ultra|off]');
    return 0;
  }
  if (VALID.has(m)) {
    fs.mkdirSync(path.dirname(P.CAVEMAN_FLAG), { recursive: true });
    fs.writeFileSync(P.CAVEMAN_FLAG, m);
    if (format === 'json') { emit(renderJSON({ mode: m }), opts.output); return 0; }
    ok(t('mode_set', m));
    info('applies to new Claude Code sessions (and any agent reading flag)');
    return 0;
  }
  if (OFF.has(m)) {
    try { fs.unlinkSync(P.CAVEMAN_FLAG); } catch {}
    if (format === 'json') { emit(renderJSON({ mode: 'off' }), opts.output); return 0; }
    ok(t('mode_unset'));
    return 0;
  }
  const err = new Error(t('mode_unknown', m));
  err.code = 'USAGE';
  throw err;
}

module.exports = { run };
