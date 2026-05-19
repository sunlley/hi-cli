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

function readSkill(name) {
  const dir = path.join(P.SKILLS_DIR, name);
  const skillMd = path.join(dir, 'SKILL.md');
  const out = { name, path: dir, description: null, hasSkillMd: false };
  if (fs.existsSync(skillMd)) {
    out.hasSkillMd = true;
    try {
      const fm = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'));
      if (fm.description) out.description = fm.description;
    } catch {}
  }
  return out;
}

function list() {
  if (!fs.existsSync(P.SKILLS_DIR)) return [];
  return fs.readdirSync(P.SKILLS_DIR)
    .filter((n) => {
      try { return fs.statSync(path.join(P.SKILLS_DIR, n)).isDirectory(); }
      catch { return false; }
    })
    .sort()
    .map(readSkill);
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function renderListText(skills) {
  const L = [`\n${c.bold('skills')}  ${c.dim(P.SKILLS_DIR)}`];
  if (skills.length === 0) { L.push(`  ${c.dim('(none)')}\n`); return L.join('\n'); }
  for (const s of skills) {
    L.push(`  ${c.cyan(s.name)}  ${s.description ? c.dim('— ' + s.description.slice(0, 80)) : ''}`);
  }
  L.push('');
  return L.join('\n');
}

function renderListMarkdown(skills) {
  const L = ['# skills', '', `_dir: ${P.SKILLS_DIR}_`, ''];
  if (skills.length === 0) { L.push('_none_'); return L.join('\n'); }
  L.push('| Name | Description |', '|---|---|');
  for (const s of skills) L.push(`| ${s.name} | ${(s.description || '').replace(/\|/g, '\\|')} |`);
  return L.join('\n');
}

function renderShowText(s) {
  const L = [`\n${c.bold(s.name)}`, `  ${c.dim('path:')}        ${s.path}`];
  if (s.description) L.push(`  ${c.dim('description:')} ${s.description}`);
  if (!s.hasSkillMd) L.push(`  ${c.yellow('!')} no SKILL.md`);
  L.push('');
  return L.join('\n');
}

async function run(args, opts = {}) {
  const sub = args[0] || 'list';
  const format = opts.format || 'text';

  if (sub === 'list' || sub === 'ls') {
    const skills = list();
    const r = pick(format, {
      text: renderListText, json: () => renderJSON({ dir: P.SKILLS_DIR, skills }),
      markdown: renderListMarkdown, md: renderListMarkdown,
    });
    emit(r(skills), opts.output);
    return 0;
  }

  if (sub === 'show' || sub === 'get') {
    const name = args[1];
    if (!name) { const e = new Error('usage: hi skills show <name>'); e.code = 'USAGE'; throw e; }
    const dir = path.join(P.SKILLS_DIR, name);
    if (!fs.existsSync(dir)) { bad(`skill '${name}' not found`); return 1; }
    const s = readSkill(name);
    const r = pick(format, {
      text: renderShowText, json: () => renderJSON(s),
      markdown: () => `# ${s.name}\n\n- path: \`${s.path}\`\n- description: ${s.description || '_none_'}\n`,
      md: () => `# ${s.name}\n\n- path: \`${s.path}\`\n- description: ${s.description || '_none_'}\n`,
    });
    emit(r(s), opts.output);
    return 0;
  }

  if (sub === 'rm' || sub === 'remove' || sub === 'uninstall' || sub === 'delete') {
    const name = args[1];
    if (!name) { const e = new Error('usage: hi skills rm <name> [--yes] [--dry-run]'); e.code = 'USAGE'; throw e; }
    const dir = path.join(P.SKILLS_DIR, name);
    if (!fs.existsSync(dir)) { bad(`skill '${name}' not found`); return 1; }
    head(`remove skill ${name}`);
    info(`path: ${dir}`);
    if (opts['dry-run']) { warn('dry-run — nothing deleted'); return 0; }
    if (!(await confirm('delete this skill dir', { yes: opts.yes }))) { warn('cancelled'); return 1; }
    rmrf(dir);
    ok(`removed ${name}`);
    return 0;
  }

  const e = new Error(`unknown skills subcommand '${sub}', expected: list|show|rm`);
  e.code = 'USAGE';
  throw e;
}

module.exports = { run, list, readSkill };
