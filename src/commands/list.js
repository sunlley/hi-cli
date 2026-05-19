const pkg = require('../../package.json');
const { c } = require('../lib/ui');
const { t } = require('../lib/i18n');
const { ALL } = require('../installers');
const { emit, renderJSON, pick } = require('../lib/render');

function build() {
  return {
    tool: 'hi',
    version: pkg.version,
    generated_at: new Date().toISOString(),
    addons: ALL.map((a) => {
      const i = a.inspect();
      return {
        name: i.name,
        label: i.label,
        repo: `https://github.com/${i.repo}`,
        installed: i.installed,
        version: i.version || null,
        mode: i.mode || null,
      };
    }),
  };
}

function renderText(report) {
  const L = [];
  L.push(`\n${c.bold(t('list_title'))}  ${c.dim('v' + report.version)}`);
  L.push('');
  const namew = Math.max(...report.addons.map((a) => a.name.length), 4);
  for (const a of report.addons) {
    const tag = a.installed ? c.green('✓') : c.red('✗');
    L.push(`  ${tag} ${a.name.padEnd(namew)}  ${c.dim(a.repo)}`);
  }
  L.push('');
  return L.join('\n') + '\n';
}

function renderMarkdown(report) {
  const L = [];
  L.push(`# ${t('list_title')}`);
  L.push(`\n_hi v${report.version}_`);
  L.push('\n| Add-on | Installed | Repo |');
  L.push('|---|---|---|');
  for (const a of report.addons) L.push(`| ${a.name} | ${a.installed ? '✓' : '✗'} | ${a.repo} |`);
  return L.join('\n') + '\n';
}

async function run(args, opts = {}) {
  const report = build();
  const format = opts.format || 'text';
  const renderer = pick(format, { text: renderText, json: (r) => renderJSON(r), markdown: renderMarkdown, md: renderMarkdown });
  emit(renderer(report), opts.output);
  return 0;
}

module.exports = { run, build };
