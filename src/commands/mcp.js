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

// `claude mcp list` has no --json flag. Parse its text output best-effort.
// Lines look like:  "name: command-or-url"  or  "name (transport): url"
function parseList(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s || /^no mcp servers/i.test(s)) continue;
    const m = s.match(/^([\w.-]+)(?:\s*\(([^)]+)\))?:\s*(.+)$/);
    if (m) rows.push({ name: m[1], transport: m[2] || null, target: m[3].trim() });
  }
  return rows;
}

function renderListText(rows, raw) {
  const L = [`\n${c.bold('mcp servers')}  ${c.dim('via claude mcp')}`];
  if (rows.length === 0) { L.push(`  ${c.dim('(none)')}\n`); return L.join('\n'); }
  for (const r of rows) {
    L.push(`  ${c.cyan(r.name.padEnd(20))} ${c.dim(r.transport || '')}  ${r.target}`);
  }
  L.push('');
  return L.join('\n');
}

function renderListMarkdown(rows) {
  const L = ['# mcp servers', '', '| Name | Transport | Target |', '|---|---|---|'];
  for (const r of rows) L.push(`| ${r.name} | ${r.transport || ''} | ${r.target} |`);
  return L.join('\n');
}

async function run_(args, opts = {}) {
  const sub = args[0] || 'list';
  const format = opts.format || 'text';

  if (sub === 'list' || sub === 'ls') {
    requireClaude();
    const r = tryExec('claude', ['mcp', 'list']);
    if (r.code !== 0 && !r.stdout) {
      bad(r.stderr.trim() || 'claude mcp list failed');
      return r.code || 1;
    }
    if (format === 'text') {
      // Passthrough is the most faithful — claude's text already formatted.
      process.stdout.write(r.stdout.endsWith('\n') ? r.stdout : r.stdout + '\n');
      return 0;
    }
    const rows = parseList(r.stdout);
    const renderer = pick(format, {
      json: () => renderJSON({ servers: rows }),
      markdown: renderListMarkdown, md: renderListMarkdown,
      text: renderListText,
    });
    emit(renderer(rows), opts.output);
    return 0;
  }

  if (sub === 'show' || sub === 'get') {
    const name = args[1];
    if (!name) { const e = new Error('usage: hi mcp show <name>'); e.code = 'USAGE'; throw e; }
    requireClaude();
    return run('claude', ['mcp', 'get', name]);
  }

  if (sub === 'rm' || sub === 'remove' || sub === 'uninstall' || sub === 'delete') {
    const name = args[1];
    if (!name) { const e = new Error('usage: hi mcp rm <name> [--yes] [--dry-run]'); e.code = 'USAGE'; throw e; }
    requireClaude();
    head(`remove mcp server ${name}`);
    if (opts['dry-run']) { info(`would run: claude mcp remove ${name}`); warn('dry-run — nothing changed'); return 0; }
    if (!(await confirm(`remove mcp '${name}'`, { yes: opts.yes }))) { warn('cancelled'); return 1; }
    return run('claude', ['mcp', 'remove', name]);
  }

  const e = new Error(`unknown mcp subcommand '${sub}', expected: list|show|rm`);
  e.code = 'USAGE';
  throw e;
}

module.exports = { run: run_, parseList };
