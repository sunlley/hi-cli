const fs = require('fs');
const path = require('path');
const pkg = require('../../package.json');
const P = require('../lib/paths');
const { c } = require('../lib/ui');
const { have, tryExec } = require('../lib/have');
const { t } = require('../lib/i18n');
const { emit, renderJSON, pick } = require('../lib/render');
const statusCmd = require('./status');

function build() {
  const out = {
    tool: 'hi',
    version: pkg.version,
    generated_at: new Date().toISOString(),
    checks: [],
    recommendations: [],
  };

  // node check
  if (have('node')) {
    const r = tryExec('node', ['-v']);
    const ver = r.stdout.trim();
    const maj = Number(ver.replace(/^v/, '').split('.')[0]) || 0;
    if (maj >= 18) out.checks.push({ name: 'node', level: 'ok', text: t('doctor_node', ver) });
    else out.checks.push({ name: 'node', level: 'bad', text: t('doctor_node_old', ver) });
  } else {
    out.checks.push({ name: 'node', level: 'bad', text: t('doctor_node_missing') });
    out.recommendations.push(t('doctor_rec_install_node'));
  }

  // claude settings.json
  const sj = path.join(P.CLAUDE_DIR, 'settings.json');
  if (fs.existsSync(sj)) {
    try { JSON.parse(fs.readFileSync(sj, 'utf8')); out.checks.push({ name: 'settings.json', level: 'ok', text: t('doctor_settings_ok', sj) }); }
    catch { out.checks.push({ name: 'settings.json', level: 'warn', text: t('doctor_settings_jsonc', sj) }); }
  } else {
    out.checks.push({ name: 'settings.json', level: 'warn', text: t('doctor_settings_missing', sj) });
  }

  // claude CLI
  if (have('claude')) out.checks.push({ name: 'claude-cli', level: 'ok', text: t('doctor_claude_present') });
  else {
    out.checks.push({ name: 'claude-cli', level: 'warn', text: t('doctor_claude_missing') });
    out.recommendations.push(t('doctor_rec_install_claude'));
  }

  // status report
  out.status = statusCmd.build();
  if (out.status.missing.length > 0) {
    out.recommendations.push(t('doctor_rec_install_missing', out.status.missing.join(' ')));
  }
  if (out.recommendations.length === 0) out.recommendations.push(t('doctor_rec_ready'));
  return out;
}

function renderText(report) {
  const L = [];
  L.push(`\n${c.bold(t('doctor_title'))}  ${c.dim('v' + report.version)}`);
  L.push('');
  L.push(statusCmd.renderText(report.status).trimEnd());
  L.push(`\n${c.cyan('checks')}`);
  for (const ck of report.checks) {
    const glyph = ck.level === 'ok' ? c.green('✓') : ck.level === 'bad' ? c.red('✗') : c.yellow('!');
    L.push(`  ${glyph} ${ck.text}`);
  }
  L.push(`\n${c.cyan(t('doctor_recommendations'))}`);
  for (const r of report.recommendations) L.push(`  ${c.dim('·')} ${r}`);
  L.push('');
  return L.join('\n') + '\n';
}

function renderMarkdown(report) {
  const L = [];
  L.push(`# ${t('doctor_title')}`);
  L.push(`\n_hi v${report.version} — generated ${report.generated_at}_`);
  L.push('\n## Checks\n');
  L.push('| Check | Level | Detail |');
  L.push('|---|---|---|');
  for (const ck of report.checks) L.push(`| ${ck.name} | ${ck.level} | ${ck.text} |`);
  L.push('\n## Add-ons\n');
  L.push(statusCmd.renderMarkdown(report.status).split('\n').slice(2).join('\n'));
  L.push('\n## Recommendations\n');
  for (const r of report.recommendations) L.push(`- ${r}`);
  return L.join('\n') + '\n';
}

async function run(args, opts = {}) {
  const report = build();
  const format = opts.format || 'text';
  const renderer = pick(format, { text: renderText, json: (r) => renderJSON(r), markdown: renderMarkdown, md: renderMarkdown });
  emit(renderer(report), opts.output);
  return 0;
}

module.exports = { run, build, renderText, renderMarkdown };
