const fs = require('fs');
const path = require('path');
const P = require('../lib/paths');
const { c, head, ok, bad, warn, info } = require('../lib/ui');
const { confirm } = require('../lib/confirm');
const { emit, renderJSON, pick } = require('../lib/render');

// Parse YAML frontmatter from SKILL.md. Pulls `name` and `description` only.
function parseFrontmatter(md) {
  if (!md.startsWith('---')) return {};
  const end = md.indexOf('\n---', 3);
  if (end < 0) return {};
  const block = md.slice(3, end);
  const out = {};
  let key = null;
  let buf = [];
  for (const line of block.split('\n')) {
    const m = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (m) {
      if (key) out[key] = buf.join(' ').trim();
      key = m[1];
      buf = [m[2]];
    } else if (key && /^\s+\S/.test(line)) {
      buf.push(line.trim());
    }
  }
  if (key) out[key] = buf.join(' ').trim();
  if (out.description) out.description = out.description.replace(/^>\s*/, '').trim();
  return out;
}

function readSkillFrom(cli, dir, name) {
  const skillDir = path.join(dir, name);
  const skillMd = path.join(skillDir, 'SKILL.md');
  const out = { cli, name, path: skillDir, description: null, hasSkillMd: false };
  if (fs.existsSync(skillMd)) {
    out.hasSkillMd = true;
    try {
      const fm = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'));
      if (fm.description) out.description = fm.description;
    } catch {}
  }
  return out;
}

function listSource({ cli, dir }) {
  const out = { cli, dir, exists: fs.existsSync(dir), skills: [] };
  if (!out.exists) return out;
  try {
    out.skills = fs.readdirSync(dir)
      .filter((n) => !n.startsWith('.'))
      .filter((n) => {
        try { return fs.statSync(path.join(dir, n)).isDirectory(); }
        catch { return false; }
      })
      .sort()
      .map((n) => readSkillFrom(cli, dir, n));
  } catch {}
  return out;
}

function listAll() {
  return P.SKILL_SOURCES.map(listSource);
}

function flatten(groups) {
  return groups.flatMap((g) => g.skills);
}

// Resolve "<cli>/<name>" or bare "<name>" → matching skill rows.
// If qualified, return at most one. If bare and unique, return one. Otherwise return all matches.
function resolve(arg) {
  if (arg.includes('/')) {
    const [cli, name] = arg.split('/', 2);
    const source = P.SKILL_SOURCES.find((s) => s.cli === cli);
    if (!source) return [];
    const skillDir = path.join(source.dir, name);
    if (!fs.existsSync(skillDir)) return [];
    return [readSkillFrom(cli, source.dir, name)];
  }
  const matches = [];
  for (const source of P.SKILL_SOURCES) {
    if (!fs.existsSync(path.join(source.dir, arg))) continue;
    matches.push(readSkillFrom(source.cli, source.dir, arg));
  }
  return matches;
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function renderListText(groups) {
  const L = [];
  const total = groups.reduce((n, g) => n + g.skills.length, 0);
  L.push(`\n${c.bold('skills')}  ${c.dim(`${total} across ${groups.filter((g) => g.exists).length} cli${groups.filter((g) => g.exists).length === 1 ? '' : 's'}`)}`);
  for (const g of groups) {
    if (!g.exists) continue;
    L.push(`\n${c.cyan(g.cli)}  ${c.dim(g.dir)}`);
    if (g.skills.length === 0) {
      L.push(`  ${c.dim('(none)')}`);
      continue;
    }
    for (const s of g.skills) {
      const desc = s.description ? c.dim('— ' + s.description.replace(/\s+/g, ' ').slice(0, 80)) : '';
      L.push(`  ${s.name.padEnd(22)} ${desc}`);
    }
  }
  // Surface sources that don't exist on disk only as dim hints (no noise).
  const missing = groups.filter((g) => !g.exists);
  if (missing.length > 0) {
    L.push(`\n${c.dim('not installed: ' + missing.map((g) => g.cli).join(' '))}`);
  }
  L.push('');
  return L.join('\n');
}

function renderListMarkdown(groups) {
  const L = ['# skills', ''];
  for (const g of groups) {
    L.push(`## ${g.cli}`, '', `_dir: ${g.dir}${g.exists ? '' : ' (missing)'}_`, '');
    if (!g.exists || g.skills.length === 0) {
      L.push('_none_', '');
      continue;
    }
    L.push('| Name | Description |', '|---|---|');
    for (const s of g.skills) {
      L.push(`| ${s.name} | ${(s.description || '').replace(/\|/g, '\\|').replace(/\s+/g, ' ')} |`);
    }
    L.push('');
  }
  return L.join('\n');
}

function renderShowText(s) {
  const L = [`\n${c.bold(s.cli + '/' + s.name)}`, `  ${c.dim('path:')}        ${s.path}`];
  if (s.description) L.push(`  ${c.dim('description:')} ${s.description}`);
  if (!s.hasSkillMd) L.push(`  ${c.yellow('!')} no SKILL.md`);
  L.push('');
  return L.join('\n');
}

function ambiguous(matches) {
  return matches.length > 1
    ? `ambiguous — found in ${matches.length} CLIs: ${matches.map((m) => m.cli + '/' + m.name).join(', ')}. qualify with <cli>/<name>.`
    : null;
}

async function run(args, opts = {}) {
  const sub = args[0] || 'list';
  const format = opts.format || 'text';

  if (sub === 'list' || sub === 'ls') {
    const groups = listAll();
    if (format === 'json') {
      emit(renderJSON({ sources: groups }), opts.output);
      return 0;
    }
    const r = pick(format, {
      text: renderListText,
      markdown: renderListMarkdown, md: renderListMarkdown,
    });
    emit(r(groups), opts.output);
    return 0;
  }

  if (sub === 'show' || sub === 'get') {
    const arg = args[1];
    if (!arg) { const e = new Error('usage: hi skills show <name>|<cli>/<name>'); e.code = 'USAGE'; throw e; }
    const matches = resolve(arg);
    if (matches.length === 0) { bad(`skill '${arg}' not found`); return 1; }
    const msg = ambiguous(matches);
    if (msg) { bad(msg); return 1; }
    const s = matches[0];
    const r = pick(format, {
      text: renderShowText, json: () => renderJSON(s),
      markdown: () => `# ${s.cli}/${s.name}\n\n- path: \`${s.path}\`\n- description: ${s.description || '_none_'}\n`,
      md: () => `# ${s.cli}/${s.name}\n\n- path: \`${s.path}\`\n- description: ${s.description || '_none_'}\n`,
    });
    emit(r(s), opts.output);
    return 0;
  }

  if (sub === 'rm' || sub === 'remove' || sub === 'uninstall' || sub === 'delete') {
    const arg = args[1];
    if (!arg) { const e = new Error('usage: hi skills rm <name>|<cli>/<name> [--yes] [--dry-run]'); e.code = 'USAGE'; throw e; }
    const matches = resolve(arg);
    if (matches.length === 0) { bad(`skill '${arg}' not found`); return 1; }
    const msg = ambiguous(matches);
    if (msg) { bad(msg); return 1; }
    const s = matches[0];
    head(`remove skill ${s.cli}/${s.name}`);
    info(`path: ${s.path}`);
    if (opts['dry-run']) { warn('dry-run — nothing deleted'); return 0; }
    if (!(await confirm('delete this skill dir', { yes: opts.yes }))) { warn('cancelled'); return 1; }
    rmrf(s.path);
    ok(`removed ${s.cli}/${s.name}`);
    return 0;
  }

  const e = new Error(`unknown skills subcommand '${sub}', expected: list|show|rm`);
  e.code = 'USAGE';
  throw e;
}

module.exports = { run, listAll, listSource, resolve, readSkillFrom, flatten };
