const { c, head, ok, bad, warn, info } = require('../lib/ui');
const { have, tryExec, run } = require('../lib/have');
const { confirm } = require('../lib/confirm');
const { emit, renderJSON, pick } = require('../lib/render');

// Per-CLI MCP command surface. None of these expose --json for `list`, so we
// passthrough text per source. `parse` is best-effort for the JSON renderer.
const MCP_SOURCES = [
  {
    cli: 'claude',
    bin: 'claude',
    listArgs: ['mcp', 'list'],
    getArgs: (name) => ['mcp', 'get', name],
    removeArgs: (name) => ['mcp', 'remove', name],
    parse: parseColonLines,
  },
  {
    cli: 'codex',
    bin: 'codex',
    listArgs: ['mcp', 'list'],
    getArgs: (name) => ['mcp', 'get', name],
    removeArgs: (name) => ['mcp', 'remove', name],
    parse: parseColonLines,
  },
  {
    cli: 'opencode',
    bin: 'opencode',
    listArgs: ['mcp', 'list'],
    getArgs: null,                 // opencode has no `mcp get`
    removeArgs: null,              // opencode has no `mcp remove`; use add/logout flow
    parse: parseOpencodeMcp,
  },
  {
    cli: 'openclaw',
    bin: 'openclaw',
    listArgs: ['mcp', 'list'],
    getArgs: (name) => ['mcp', 'show', name],
    removeArgs: null,              // openclaw has no remove; mcp set replaces
    parse: () => [],
  },
];

// Generic "name: target" parser used by claude + codex.
function parseColonLines(text) {
  const rows = [];
  for (const line of (text || '').split('\n')) {
    const s = line.trim();
    if (!s || /^no mcp servers/i.test(s)) continue;
    const m = s.match(/^([\w.-]+)(?:\s*\(([^)]+)\))?:\s*(.+)$/);
    if (m) rows.push({ name: m[1], transport: m[2] || null, target: m[3].trim() });
  }
  return rows;
}

// opencode prints box-drawing TUI output with names prefixed by `●  ✓` etc.
// Strip ANSI + box chars, pull `<glyph> <name> <status>` rows.
function parseOpencodeMcp(text) {
  const rows = [];
  const stripped = (text || '').replace(/\x1b\[[0-9;]*m/g, '').split('\n');
  for (let i = 0; i < stripped.length; i++) {
    const m = stripped[i].match(/[│┌└├┃]?\s*[●○]\s*[✓✗?!]?\s*([\w.-]+)\s+(connected|disconnected|unknown)?/i);
    if (m) {
      const next = (stripped[i + 1] || '').replace(/^[│┌└├┃ ]+/, '').trim();
      rows.push({ name: m[1], status: (m[2] || '').toLowerCase() || null, target: next || null });
    }
  }
  return rows;
}

function gatherSource(src) {
  const out = { cli: src.cli, installed: Boolean(have(src.bin)), servers: [], raw: null, error: null };
  if (!out.installed) return out;
  const r = tryExec(src.bin, src.listArgs);
  if (r.code !== 0 && !r.stdout) {
    out.error = (r.stderr || '').trim().split('\n').slice(0, 3).join(' ') || 'list failed';
    return out;
  }
  out.raw = r.stdout || '';
  try { out.servers = src.parse(out.raw); } catch {}
  return out;
}

function listAll() {
  return MCP_SOURCES.map(gatherSource);
}

function indent(text, by = '  ') {
  return (text || '').split('\n').map((l) => (l.length ? by + l : l)).join('\n').replace(/\n$/, '');
}

function renderListText(groups) {
  const L = [];
  const total = groups.reduce((n, g) => n + g.servers.length, 0);
  const installedCount = groups.filter((g) => g.installed).length;
  L.push(`\n${c.bold('mcp servers')}  ${c.dim(`${total} parsed across ${installedCount} cli${installedCount === 1 ? '' : 's'}`)}`);
  for (const g of groups) {
    L.push(`\n${c.cyan(g.cli)}  ${c.dim(`via ${g.cli} mcp list`)}`);
    if (!g.installed) { L.push(`  ${c.dim('(' + g.cli + ' not installed)')}`); continue; }
    if (g.error) { L.push(`  ${c.red('✗')} ${g.error}`); continue; }
    const raw = (g.raw || '').trim();
    if (!raw) { L.push(`  ${c.dim('(empty)')}`); continue; }
    L.push(indent(raw));
  }
  L.push('');
  return L.join('\n');
}

function renderListMarkdown(groups) {
  const L = ['# mcp servers', ''];
  for (const g of groups) {
    L.push(`## ${g.cli}`, '');
    if (!g.installed) { L.push(`_${g.cli} not installed_`, ''); continue; }
    if (g.error) { L.push(`_error: ${g.error}_`, ''); continue; }
    if (g.servers.length === 0 && !g.raw?.trim()) { L.push('_none_', ''); continue; }
    if (g.servers.length > 0) {
      L.push('| Name | Status/Transport | Target |', '|---|---|---|');
      for (const s of g.servers) L.push(`| ${s.name} | ${s.status || s.transport || ''} | ${s.target || ''} |`);
    } else {
      L.push('```', g.raw.trim(), '```');
    }
    L.push('');
  }
  return L.join('\n');
}

function resolveTarget(arg) {
  if (arg.includes('/')) {
    const [cli, ...rest] = arg.split('/');
    const name = rest.join('/');
    const source = MCP_SOURCES.find((s) => s.cli === cli);
    if (!source) return { error: `unknown cli '${cli}', expected one of: ${MCP_SOURCES.map((s) => s.cli).join(', ')}` };
    return { source, name };
  }
  // Without a prefix we can't know which CLI owns the server — names can collide.
  return { error: `qualify with <cli>/<name> (e.g. claude/${arg})` };
}

async function run_(args, opts = {}) {
  const sub = args[0] || 'list';
  const format = opts.format || 'text';

  if (sub === 'list' || sub === 'ls') {
    const groups = listAll();
    if (format === 'json') {
      emit(renderJSON({ sources: groups }), opts.output);
      return 0;
    }
    const r = pick(format, {
      text: renderListText, markdown: renderListMarkdown, md: renderListMarkdown,
    });
    emit(r(groups), opts.output);
    return 0;
  }

  if (sub === 'show' || sub === 'get') {
    const arg = args[1];
    if (!arg) { const e = new Error('usage: hi mcp show <cli>/<name>'); e.code = 'USAGE'; throw e; }
    const r = resolveTarget(arg);
    if (r.error) { bad(r.error); return 1; }
    if (!r.source.getArgs) { bad(`${r.source.cli} has no mcp-get verb`); return 1; }
    return run(r.source.bin, r.source.getArgs(r.name));
  }

  if (sub === 'rm' || sub === 'remove' || sub === 'uninstall' || sub === 'delete') {
    const arg = args[1];
    if (!arg) { const e = new Error('usage: hi mcp rm <cli>/<name> [--yes] [--dry-run]'); e.code = 'USAGE'; throw e; }
    const r = resolveTarget(arg);
    if (r.error) { bad(r.error); return 1; }
    if (!r.source.removeArgs) { bad(`${r.source.cli} has no mcp-remove verb`); return 1; }
    head(`remove mcp server ${r.source.cli}/${r.name}`);
    if (opts['dry-run']) { info(`would run: ${r.source.bin} ${r.source.removeArgs(r.name).join(' ')}`); warn('dry-run — nothing changed'); return 0; }
    if (!(await confirm(`remove ${r.source.cli}/${r.name}`, { yes: opts.yes }))) { warn('cancelled'); return 1; }
    return run(r.source.bin, r.source.removeArgs(r.name));
  }

  const e = new Error(`unknown mcp subcommand '${sub}', expected: list|show|rm`);
  e.code = 'USAGE';
  throw e;
}

module.exports = { run: run_, listAll, MCP_SOURCES, parseColonLines, parseOpencodeMcp };
