const fs = require('fs');
const path = require('path');
const { t } = require('./i18n');

// Write rendered output to file (or stdout). agenttrace-style: "saved to %s" → stderr.
function emit(out, output) {
  if (output) {
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, out.endsWith('\n') ? out : out + '\n');
    process.stderr.write(t('cli_saved', output) + '\n');
    return;
  }
  process.stdout.write(out.endsWith('\n') ? out : out + '\n');
}

function renderJSON(obj) {
  return JSON.stringify(obj, null, 2);
}

// Pick renderer by format; throw USAGE on unknown.
function pick(format, renderers) {
  const r = renderers[format];
  if (r) return r;
  const err = new Error(`unsupported format '${format}', expected: ${Object.keys(renderers).join(', ')}`);
  err.code = 'USAGE';
  throw err;
}

module.exports = { emit, renderJSON, pick };
