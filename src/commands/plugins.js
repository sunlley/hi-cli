const { c, head, ok, bad, warn, info } = require('../lib/ui');
const { have, tryExec, run } = require('../lib/have');
const { confirm } = require('../lib/confirm');
const { emit, renderJSON, pick } = require('../lib/render');

// Per-CLI plugin command surface. codex/opencode are intentionally absent:
// codex `plugin` exposes only `marketplace` (no `list`); opencode `plugin`
// only installs from npm and has no `list`.
const PLUGIN_SOURCES = [
  {
    cli: 'claude',
    bin: 'claude',
    listArgs: ['plugin', 'list', '--json'],
    isJson: true,
    parse: (data) => Array.isArray(data) ? data.map((p) => ({
      cli: 'claude',
      name: p.id || p.name || null,
      version: p.version || null,
      scope: p.scope || null,
      enabled: p.enabled == null ? null : Boolean(p.enabled),
      installPath: p.installPath || null,
    })) : [],
    detailsArgs: (name) => ['plugin', 'details', name],
    uninstallArgs: (name) => ['plugin', 'uninstall', name],
    enableArgs: (name) => ['plugin', 'enable', name],
    disableArgs: (name) => ['plugin', 'disable', name],
  },
  {
    cli: 'openclaw',
    bin: 'openclaw',
    listArgs: ['plugins', 'list', '--json'],
    isJson: true,
    parse: (data) => {
      // openclaw shape: { registry, plugins?: [...] } or array. Be tolerant.
      const items = Array.isArray(data?.plugins) ? data.plugins
        : Array.isArray(data?.installed) ? data.installed
        : Array.isArray(data) ? data : [];
      return items.map((p) => ({
        cli: 'openclaw',
        name: p.id || p.name || null,
        version: p.version || null,
        scope: p.scope || p.source || p.format || null,
        enabled: typeof p.status === 'string' ? p.status === 'enabled' : (p.enabled ?? null),
        installPath: p.path || p.source || null,
      }));
    },
    detailsArgs: (name) => ['plugins', 'inspect', name],
    uninstallArgs: null,           // openclaw uses disable/enable; no uninstall verb
    enableArgs: (name) => ['plugins', 'enable', name],
    disableArgs: (name) => ['plugins', 'disable', name],
  },
];

function gatherSource(src) {
  const out = { cli: src.cli, installed: Boolean(have(src.bin)), plugins: [], raw: null, error: null };
  if (!out.installed) return out;
  const r = tryExec(src.bin, src.listArgs);
  if (r.code !== 0) {
    out.error = (r.stderr || r.stdout || '').trim().split('\n').slice(0, 3).join(' ');
    out.raw = r.stdout;
    return out;
  }
  if (src.isJson) {
    try { out.plugins = src.parse(JSON.parse(r.stdout)); }
    catch (e) { out.error = `parse failed: ${e.message}`; out.raw = r.stdout; }
  } else {
    out.raw = r.stdout;
  }
  return out;
}

function listAll() {
  return PLUGIN_SOURCES.map(gatherSource);
}

function statusGlyph(p) {
  if (p.enabled === true) return c.green('✓');
  if (p.enabled === false) return c.yellow('!');
  return c.dim('·');
}

function renderListText(groups) {
  const L = [];
  const total = groups.reduce((n, g) => n + g.plugins.length, 0);
  const installedCount = groups.filter((g) => g.installed).length;
  L.push(`\n${c.bold('plugins')}  ${c.dim(`${total} across ${installedCount} cli${installedCount === 1 ? '' : 's'}`)}`);
  for (const g of groups) {
    L.push(`\n${c.cyan(g.cli)}`);
    if (!g.installed) { L.push(`  ${c.dim('(' + g.cli + ' not installed)')}`); continue; }
    if (g.error) { L.push(`  ${c.red('✗')} ${g.error}`); continue; }
    if (g.plugins.length === 0) { L.push(`  ${c.dim('(none)')}`); continue; }
    for (const p of g.plugins) {
      L.push(`  ${statusGlyph(p)} ${(p.name || '').padEnd(40)} ${c.dim((p.version || '').padEnd(18))}  ${c.dim(p.scope || '')}`);
    }
  }
  L.push('');
  return L.join('\n');
}

function renderListMarkdown(groups) {
  const L = ['# plugins', ''];
  for (const g of groups) {
    L.push(`## ${g.cli}`, '');
    if (!g.installed) { L.push(`_${g.cli} not installed_`, ''); continue; }
    if (g.error) { L.push(`_error: ${g.error}_`, ''); continue; }
    if (g.plugins.length === 0) { L.push('_none_', ''); continue; }
    L.push('| Name | Version | Scope | Enabled |', '|---|---|---|---|');
    for (const p of g.plugins) L.push(`| ${p.name} | ${p.version || ''} | ${p.scope || ''} | ${p.enabled ? '✓' : '✗'} |`);
    L.push('');
  }
  return L.join('\n');
}

// Resolve "<cli>/<name>" → { source, name }. Bare "<name>" works only when unique.
function resolveTarget(arg, groups) {
  if (arg.includes('/')) {
    const [cli, ...rest] = arg.split('/');
    const name = rest.join('/');
    const source = PLUGIN_SOURCES.find((s) => s.cli === cli);
    if (!source) return { error: `unknown cli '${cli}', expected one of: ${PLUGIN_SOURCES.map((s) => s.cli).join(', ')}` };
    return { source, name };
  }
  const matches = [];
  for (const g of groups) {
    for (const p of g.plugins) if (p.name === arg) matches.push({ source: PLUGIN_SOURCES.find((s) => s.cli === g.cli), name: arg });
  }
  if (matches.length === 0) return { error: `plugin '${arg}' not found in any cli` };
  if (matches.length > 1) return { error: `ambiguous — found in ${matches.length} clis. qualify with <cli>/<name>` };
  return matches[0];
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

  if (sub === 'show' || sub === 'details' || sub === 'get') {
    const arg = args[1];
    if (!arg) { const e = new Error('usage: hi plugins show <name>|<cli>/<name>'); e.code = 'USAGE'; throw e; }
    const groups = listAll();
    const r = resolveTarget(arg, groups);
    if (r.error) { bad(r.error); return 1; }
    if (!r.source.detailsArgs) { bad(`${r.source.cli} has no details command`); return 1; }
    return run(r.source.bin, r.source.detailsArgs(r.name));
  }

  if (sub === 'rm' || sub === 'remove' || sub === 'uninstall' || sub === 'delete') {
    const arg = args[1];
    if (!arg) { const e = new Error('usage: hi plugins rm <name>|<cli>/<name> [--yes] [--dry-run]'); e.code = 'USAGE'; throw e; }
    const groups = listAll();
    const r = resolveTarget(arg, groups);
    if (r.error) { bad(r.error); return 1; }
    if (!r.source.uninstallArgs) {
      bad(`${r.source.cli} has no uninstall verb — try:  hi plugins disable ${r.source.cli}/${r.name}`);
      return 1;
    }
    head(`uninstall plugin ${r.source.cli}/${r.name}`);
    if (opts['dry-run']) { info(`would run: ${r.source.bin} ${r.source.uninstallArgs(r.name).join(' ')}`); warn('dry-run — nothing changed'); return 0; }
    if (!(await confirm(`uninstall ${r.source.cli}/${r.name}`, { yes: opts.yes }))) { warn('cancelled'); return 1; }
    return run(r.source.bin, r.source.uninstallArgs(r.name));
  }

  if (sub === 'enable' || sub === 'disable') {
    const arg = args[1];
    if (!arg) { const e = new Error(`usage: hi plugins ${sub} <name>|<cli>/<name>`); e.code = 'USAGE'; throw e; }
    const groups = listAll();
    const r = resolveTarget(arg, groups);
    if (r.error) { bad(r.error); return 1; }
    const argsFn = sub === 'enable' ? r.source.enableArgs : r.source.disableArgs;
    if (!argsFn) { bad(`${r.source.cli} has no ${sub} command`); return 1; }
    return run(r.source.bin, argsFn(r.name));
  }

  const e = new Error(`unknown plugins subcommand '${sub}', expected: list|show|rm|enable|disable`);
  e.code = 'USAGE';
  throw e;
}

module.exports = { run: run_, listAll, PLUGIN_SOURCES };
