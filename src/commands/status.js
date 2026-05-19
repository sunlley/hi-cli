const pkg = require('../../package.json');
const { c } = require('../lib/ui');
const { confirm } = require('../lib/confirm');
const { t } = require('../lib/i18n');
const { ALL } = require('../installers');
const { emit, renderJSON, pick } = require('../lib/render');
const installCmd = require('./install');

function build() {
  const addons = ALL.map((a) => a.inspect());
  const missing = addons.filter((a) => !a.installed).map((a) => a.name);
  return {
    tool: 'hi',
    version: pkg.version,
    generated_at: new Date().toISOString(),
    addons,
    missing,
    healthy: missing.length === 0,
  };
}

function renderText(report) {
  const L = [];
  L.push(`\n${c.bold(t('status_title'))}  ${c.dim('v' + report.version)}`);
  for (const a of report.addons) {
    L.push(`\n${c.cyan(a.label)}`);
    for (const x of a.extras) {
      const glyph = x.level === 'ok' ? c.green('✓')
        : x.level === 'bad' ? c.red('✗')
        : x.level === 'warn' ? c.yellow('!')
        : c.dim('·');
      L.push(`  ${glyph} ${x.text}`);
    }
  }
  L.push('');
  if (report.missing.length > 0) {
    L.push(`${c.cyan(t('status_missing', report.missing.join(' ')))}`);
  }
  return L.join('\n') + '\n';
}

function renderMarkdown(report) {
  const L = [];
  L.push(`# ${t('status_title')}`);
  L.push(`\n_hi v${report.version} — generated ${report.generated_at}_`);
  L.push('\n| Add-on | Installed | Notes |');
  L.push('|---|---|---|');
  for (const a of report.addons) {
    const notes = a.extras.map((x) => x.text).join('<br>');
    L.push(`| ${a.label} | ${a.installed ? '✓' : '✗'} | ${notes} |`);
  }
  if (report.missing.length > 0) {
    L.push(`\n**Missing:** ${report.missing.join(', ')}`);
  }
  return L.join('\n') + '\n';
}

async function run(args, opts = {}) {
  const report = build();
  const format = opts.format || 'text';
  const renderer = pick(format, { text: renderText, json: (r) => renderJSON(r), markdown: renderMarkdown, md: renderMarkdown });
  const out = renderer(report);
  emit(out, opts.output);

  // CI gating
  if (opts['fail-on-missing'] && !report.healthy) {
    process.stderr.write(t('status_gate_failed', report.missing.join(' ')) + '\n');
    process.exit(2);
  }

  // Interactive: offer install when TTY + no -o + no --json
  if (format === 'text' && !opts.output && !opts.quiet && report.missing.length > 0 && process.stdin.isTTY) {
    if (await confirm(t('status_install_now'))) {
      await installCmd.run(report.missing.length === ALL.length ? ['all'] : report.missing, opts);
    } else {
      process.stdout.write(`  · ${t('status_install_later', report.missing.join(' '))}\n\n`);
    }
  }
  return 0;
}

module.exports = { run, build, renderText, renderMarkdown };
