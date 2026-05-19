const { c, head, ok, bad, warn, info } = require('../lib/ui');
const { have, tryExec, run } = require('../lib/have');
const { confirm } = require('../lib/confirm');
const { emit, renderJSON, pick } = require('../lib/render');

function requireClaude() {
  if (!have('claude')) {
    const e = new Error("claude CLI not on PATH — install Claude Code first");
    e.code = 'USAGE';
    throw e;
  }
}

function listJson() {
  requireClaude();
  const r = tryExec('claude', ['plugin', 'list', '--json']);
  if (r.code !== 0) throw new Error(r.stderr.trim() || 'claude plugin list --json failed');
  try { return JSON.parse(r.stdout); }
  catch (e) { throw new Error(`failed to parse claude plugin list --json: ${e.message}`); }
}

// claude plugin list --json returns a flat array of { id, version, scope, enabled, installPath, ... }.
function flatten(data) {
  if (!Array.isArray(data)) return [];
  return data.map((p) => ({
    name: p.id || p.name || null,
    version: p.version || null,
    scope: p.scope || null,
    enabled: p.enabled == null ? null : Boolean(p.enabled),
    installPath: p.installPath || null,
    installedAt: p.installedAt || null,
  }));
}

function statusGlyph(p) {
  if (p.enabled === true) return c.green('✓');
  if (p.enabled === false) return c.yellow('!');
  return c.dim('·');
}

function renderListText(rows) {
  const L = [`\n${c.bold('plugins')}  ${c.dim('via claude plugin')}`];
  if (rows.length === 0) { L.push(`  ${c.dim('(none)')}\n`); return L.join('\n'); }
  for (const p of rows) {
    L.push(`  ${statusGlyph(p)} ${c.cyan(p.name.padEnd(40))} ${c.dim((p.version || '').padEnd(18))}  ${c.dim(p.scope || '')}`);
  }
  L.push('');
  return L.join('\n');
}

function renderListMarkdown(rows) {
  const L = ['# plugins', '', '| Name | Version | Scope | Enabled |', '|---|---|---|---|'];
  for (const p of rows) L.push(`| ${p.name} | ${p.version || ''} | ${p.scope || ''} | ${p.enabled ? '✓' : '✗'} |`);
  return L.join('\n');
}

async function run_(args, opts = {}) {
  const sub = args[0] || 'list';
  const format = opts.format || 'text';

  if (sub === 'list' || sub === 'ls') {
    const data = listJson();
    const rows = flatten(data);
    const r = pick(format, {
      text: renderListText, json: () => renderJSON({ plugins: rows }),
      markdown: renderListMarkdown, md: renderListMarkdown,
    });
    emit(r(rows), opts.output);
    return 0;
  }

  if (sub === 'show' || sub === 'details' || sub === 'get') {
    const name = args[1];
    if (!name) { const e = new Error('usage: hi plugins show <name>'); e.code = 'USAGE'; throw e; }
    requireClaude();
    if (format === 'json') {
      const rows = flatten(listJson());
      const found = rows.find((p) => p.name === name);
      if (!found) { bad(`plugin '${name}' not found`); return 1; }
      emit(renderJSON(found), opts.output);
      return 0;
    }
    return run('claude', ['plugin', 'details', name]);
  }

  if (sub === 'rm' || sub === 'remove' || sub === 'uninstall' || sub === 'delete') {
    const name = args[1];
    if (!name) { const e = new Error('usage: hi plugins rm <name> [--yes] [--dry-run]'); e.code = 'USAGE'; throw e; }
    requireClaude();
    head(`uninstall plugin ${name}`);
    if (opts['dry-run']) { info(`would run: claude plugin uninstall ${name}`); warn('dry-run — nothing changed'); return 0; }
    if (!(await confirm(`uninstall ${name}`, { yes: opts.yes }))) { warn('cancelled'); return 1; }
    return run('claude', ['plugin', 'uninstall', name]);
  }

  if (sub === 'enable' || sub === 'disable') {
    const name = args[1];
    if (!name) { const e = new Error(`usage: hi plugins ${sub} <name>`); e.code = 'USAGE'; throw e; }
    requireClaude();
    return run('claude', ['plugin', sub, name]);
  }

  const e = new Error(`unknown plugins subcommand '${sub}', expected: list|show|rm|enable|disable`);
  e.code = 'USAGE';
  throw e;
}

module.exports = { run: run_, listJson, flatten };
