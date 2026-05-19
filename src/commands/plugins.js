const fs = require('fs');
const path = require('path');
const P = require('../lib/paths');
const { c, head, ok, bad, warn, info } = require('../lib/ui');
const { have, tryExec, run } = require('../lib/have');
const { confirm } = require('../lib/confirm');
const { emit, renderJSON, pick } = require('../lib/render');

const OPENCLAW_CONFIG = path.join(P.HOME, '.openclaw', 'openclaw.json');

function readOpenclawConfig() {
  try { return JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf8')); }
  catch { return null; }
}

// Names a user has explicitly touched (entries with config, or in allow list).
function openclawConfiguredNames() {
  const cfg = readOpenclawConfig();
  if (!cfg || !cfg.plugins) return new Set();
  const out = new Set();
  if (cfg.plugins.entries && typeof cfg.plugins.entries === 'object') {
    for (const k of Object.keys(cfg.plugins.entries)) out.add(k);
  }
  if (Array.isArray(cfg.plugins.allow)) for (const n of cfg.plugins.allow) out.add(n);
  return out;
}

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
      origin: null,
      configured: true,
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
      const items = Array.isArray(data?.plugins) ? data.plugins
        : Array.isArray(data?.installed) ? data.installed
        : Array.isArray(data) ? data : [];
      const configured = openclawConfiguredNames();
      return items.map((p) => {
        const name = p.id || p.name || null;
        return {
          cli: 'openclaw',
          name,
          version: p.version || null,
          scope: p.format || p.scope || null,
          enabled: typeof p.status === 'string' ? p.status === 'loaded' : (p.enabled ?? null),
          installPath: p.rootDir || p.source || null,
          origin: p.origin || null,        // "bundled" | "external" | null
          status: p.status || null,
          configured: configured.has(name),
        };
      });
    },
    detailsArgs: (name) => ['plugins', 'inspect', name],
    uninstallArgs: null,           // openclaw uses disable/enable; no uninstall verb
    enableArgs: (name) => ['plugins', 'enable', name],
    disableArgs: (name) => ['plugins', 'disable', name],
    doctorArgs: ['plugins', 'doctor'],
  },
];

// By default we hide stock bundled plugins that the user has never touched —
// otherwise the openclaw row buries everything else under 90 default providers.
// Pass `opts.all` to bypass the filter.
function filterNoise(plugins, opts = {}) {
  if (opts.all) return plugins;
  return plugins.filter((p) => p.origin !== 'bundled' || p.configured);
}

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

function listAll(opts = {}) {
  return PLUGIN_SOURCES.map(gatherSource).map((g) => {
    if (!g.plugins || g.plugins.length === 0) return g;
    g.plugins = filterNoise(g.plugins, opts);
    return g;
  });
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
    const groups = listAll(opts);
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
    const groups = listAll(opts);
    const r = resolveTarget(arg, groups);
    if (r.error) { bad(r.error); return 1; }
    if (!r.source.detailsArgs) { bad(`${r.source.cli} has no details command`); return 1; }
    return run(r.source.bin, r.source.detailsArgs(r.name));
  }

  if (sub === 'rm' || sub === 'remove' || sub === 'uninstall' || sub === 'delete') {
    const arg = args[1];
    if (!arg) { const e = new Error('usage: hi plugins rm <name>|<cli>/<name> [--yes] [--dry-run]'); e.code = 'USAGE'; throw e; }
    const groups = listAll(opts);
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
    const groups = listAll(opts);
    const r = resolveTarget(arg, groups);
    if (r.error) { bad(r.error); return 1; }
    const argsFn = sub === 'enable' ? r.source.enableArgs : r.source.disableArgs;
    if (!argsFn) { bad(`${r.source.cli} has no ${sub} command`); return 1; }
    return run(r.source.bin, argsFn(r.name));
  }

  if (sub === 'doctor' || sub === 'diagnose') {
    return runDoctor(opts);
  }

  if (sub === 'clean' || sub === 'cleanup' || sub === 'autoremove') {
    return runClean(opts);
  }

  const e = new Error(`unknown plugins subcommand '${sub}', expected: list|show|rm|enable|disable|doctor|clean`);
  e.code = 'USAGE';
  throw e;
}

// ── doctor / clean ─────────────────────────────────────────────────────────
// Categories of plugin trouble we can detect:
//   missing   — referenced in config (plugins.allow / .entries) but not installed
//   broken    — installed but failed to load (status: "error" or doctor diagnostic)
// Auto-fix (hi plugins clean):
//   broken → disable via CLI    (safe; user can re-enable later)
//   missing → reported, not fixed (we don't know whether to install or remove from config)

function diagnoseClaude() {
  const out = { cli: 'claude', missing: [], broken: [], notes: [] };
  const r = tryExec('claude', ['plugin', 'list', '--json']);
  if (r.code !== 0) { out.notes.push(`plugin list failed: ${r.stderr.trim()}`); return out; }
  let data; try { data = JSON.parse(r.stdout); } catch { out.notes.push('plugin list --json: parse failed'); return out; }
  if (!Array.isArray(data)) return out;
  for (const p of data) {
    const name = p.id || p.name;
    if (!name) continue;
    if (p.status === 'error' || p.error) out.broken.push({ name, reason: String(p.error || p.status) });
    // claude doesn't currently surface "missing" plugins in list output
  }
  return out;
}

function diagnoseOpenclaw() {
  const out = { cli: 'openclaw', missing: [], broken: [], notes: [] };
  // doctor's diagnostics + warnings give us both categories
  const dr = tryExec('openclaw', ['plugins', 'doctor']);
  const text = (dr.stdout || '') + '\n' + (dr.stderr || '');

  // "plugin not installed: <name>" → referenced in allow/entries but missing on disk
  const missingRe = /plugin not installed:\s*([\w@/.-]+)/g;
  let m;
  while ((m = missingRe.exec(text))) out.missing.push({ name: m[1] });

  // "Diagnostics:" section lists "- <name>: <error>" lines
  const diagIdx = text.indexOf('Diagnostics:');
  if (diagIdx >= 0) {
    const tail = text.slice(diagIdx).split('\n').slice(1);
    for (const line of tail) {
      const mm = line.match(/^\s*-\s*([\w@/.-]+):\s*(.+?)\s*$/);
      if (mm) out.broken.push({ name: mm[1], reason: mm[2] });
    }
  }

  // Cross-check with `plugins list --json`: any external plugin where status !== "loaded"
  // is broken; ignore bundled noise.
  const lr = tryExec('openclaw', ['plugins', 'list', '--json']);
  if (lr.code === 0) {
    try {
      const data = JSON.parse(lr.stdout);
      const items = Array.isArray(data?.plugins) ? data.plugins : (Array.isArray(data) ? data : []);
      for (const p of items) {
        if (p.origin === 'bundled') continue;
        if (p.status && p.status !== 'loaded') {
          const name = p.id || p.name;
          if (!out.broken.find((b) => b.name === name)) {
            out.broken.push({ name, reason: `status=${p.status}` });
          }
        }
      }
    } catch {}
  }
  return out;
}

function runDoctorReport(opts) {
  const reports = [];
  if (have('claude'))   reports.push(diagnoseClaude());
  if (have('openclaw')) reports.push(diagnoseOpenclaw());
  return reports;
}

function renderDoctorText(reports) {
  const L = [];
  L.push(`\n${c.bold('plugins doctor')}`);
  let issues = 0;
  for (const r of reports) {
    L.push(`\n${c.cyan(r.cli)}`);
    if (r.missing.length === 0 && r.broken.length === 0 && r.notes.length === 0) {
      L.push(`  ${c.green('✓')} clean`);
      continue;
    }
    for (const m of r.missing) { L.push(`  ${c.yellow('!')} missing  ${m.name}`); issues++; }
    for (const b of r.broken)  { L.push(`  ${c.red('✗')} broken   ${b.name}  ${c.dim(b.reason || '')}`); issues++; }
    for (const n of r.notes)   { L.push(`  ${c.dim('·')} ${n}`); }
  }
  if (issues > 0) {
    L.push(`\n${c.dim('run')}  ${c.bold('hi plugins clean')}  ${c.dim('to auto-disable broken plugins')}`);
  }
  L.push('');
  return L.join('\n');
}

async function runDoctor(opts) {
  const reports = runDoctorReport(opts);
  const format = opts.format || 'text';
  if (format === 'json') {
    emit(renderJSON({ reports }), opts.output);
    return 0;
  }
  emit(renderDoctorText(reports), opts.output);
  return 0;
}

async function runClean(opts) {
  const reports = runDoctorReport(opts);
  const fixable = [];
  const skipped = [];
  for (const r of reports) {
    const src = PLUGIN_SOURCES.find((s) => s.cli === r.cli);
    if (!src || !src.disableArgs) continue;
    for (const b of r.broken) fixable.push({ cli: r.cli, name: b.name, reason: b.reason, src });
    for (const m of r.missing) skipped.push({ cli: r.cli, name: m.name, reason: 'missing — install or remove from config manually' });
  }

  head('plugins clean');
  if (fixable.length === 0 && skipped.length === 0) { ok('no broken or missing plugins'); return 0; }

  for (const f of fixable) info(`will disable: ${f.cli}/${f.name}  ${c.dim('(' + (f.reason || '') + ')')}`);
  for (const s of skipped) warn(`skip:         ${s.cli}/${s.name}  ${c.dim(s.reason)}`);

  if (fixable.length === 0) {
    warn('nothing to auto-fix (missing plugins must be resolved by hand)');
    return 0;
  }

  if (opts['dry-run']) { warn('dry-run — nothing changed'); return 0; }
  if (!(await confirm(`disable ${fixable.length} broken plugin${fixable.length === 1 ? '' : 's'}`, { yes: opts.yes }))) {
    warn('cancelled');
    return 1;
  }

  let failures = 0;
  for (const f of fixable) {
    const rc = run(f.src.bin, f.src.disableArgs(f.name));
    if (rc === 0) ok(`disabled ${f.cli}/${f.name}`);
    else { bad(`failed to disable ${f.cli}/${f.name}`); failures++; }
  }
  return failures === 0 ? 0 : 1;
}

module.exports = { run: run_, listAll, PLUGIN_SOURCES };
