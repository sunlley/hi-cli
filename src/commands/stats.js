const fs = require('fs');
const P = require('../lib/paths');
const pkg = require('../../package.json');
const { c } = require('../lib/ui');
const { rtkInstalled } = require('../lib/detect');
const { run: spawnRun, tryExec } = require('../lib/have');
const { emit, renderJSON, pick } = require('../lib/render');

function k(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
const pct = (s, o) => (o > 0 ? (s / o) * 100 : 0);
function bar(p, w = 24) {
  const f = Math.max(0, Math.min(w, Math.round((p / 100) * w)));
  return '█'.repeat(f) + '░'.repeat(w - f);
}

function loadCaveman() {
  if (!fs.existsSync(P.CAVEMAN_HISTORY)) return null;
  const records = fs.readFileSync(P.CAVEMAN_HISTORY, 'utf8')
    .split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
  if (records.length === 0) return { sessions: [], totals: { output: 0, saved: 0, usd: 0 }, by_mode: [] };

  const bySession = new Map();
  for (const r of records) {
    const prev = bySession.get(r.session_id);
    if (!prev || r.ts > prev.ts) bySession.set(r.session_id, r);
  }
  const sessions = [...bySession.values()];
  const totals = sessions.reduce((a, r) => {
    a.output += r.output_tokens || 0; a.saved += r.est_saved_tokens || 0; a.usd += r.est_saved_usd || 0;
    return a;
  }, { output: 0, saved: 0, usd: 0 });

  const byMode = new Map();
  for (const r of sessions) {
    const m = r.mode || 'unknown';
    const cur = byMode.get(m) || { mode: m, sessions: 0, output: 0, saved: 0, usd: 0 };
    cur.sessions += 1; cur.output += r.output_tokens || 0; cur.saved += r.est_saved_tokens || 0; cur.usd += r.est_saved_usd || 0;
    byMode.set(m, cur);
  }
  return { sessions, totals, by_mode: [...byMode.values()].sort((a, b) => b.saved - a.saved) };
}

function loadRtk() {
  if (!rtkInstalled()) return null;
  const r = tryExec('rtk', ['gain']);
  return { exit: r.code, text: r.stdout + r.stderr };
}

function build() {
  return {
    tool: 'hi',
    version: pkg.version,
    generated_at: new Date().toISOString(),
    rtk: loadRtk(),
    caveman: loadCaveman(),
  };
}

function renderText(report) {
  const L = [];
  L.push(`\n${c.bold('hi stats')}  ${c.dim('v' + report.version)}`);
  L.push(`\n${c.cyan('rtk gain')}`);
  if (!report.rtk) L.push(`  ${c.red('✗')} rtk not installed`);
  else L.push(report.rtk.text.trimEnd());

  L.push(`\n${c.cyan('caveman')}`);
  const cm = report.caveman;
  if (!cm) { L.push(`  ${c.red('✗')} no history yet — open Claude Code with caveman active`); L.push(''); return L.join('\n') + '\n'; }
  if (cm.sessions.length === 0) { L.push('  (history file empty)'); return L.join('\n') + '\n'; }

  const totalPct = pct(cm.totals.saved, cm.totals.output);
  L.push('');
  L.push('Caveman Token Savings (lifetime)');
  L.push('═'.repeat(60));
  L.push('');
  L.push(`Sessions:          ${cm.sessions.length}`);
  L.push(`Output tokens:     ${k(cm.totals.output)}`);
  L.push(`Tokens saved:      ${k(cm.totals.saved)} (${totalPct.toFixed(1)}%)`);
  L.push(`Est. cost saved:   $${cm.totals.usd.toFixed(4)}`);
  L.push(`Efficiency meter:  ${bar(totalPct)} ${totalPct.toFixed(1)}%`);
  L.push('');
  L.push('By Mode');
  L.push('─'.repeat(67));
  L.push('  Mode           Sessions  Output    Saved    Avg%    Impact');
  L.push('─'.repeat(67));
  for (const s of cm.by_mode) {
    const p = pct(s.saved, s.output);
    L.push([
      `  ${s.mode.padEnd(13)}`,
      String(s.sessions).padStart(8),
      `  ${k(s.output).padStart(7)}`,
      `  ${k(s.saved).padStart(6)}`,
      `  ${p.toFixed(1).padStart(4)}%`,
      `  ${bar(p, 10)}`,
    ].join(''));
  }
  L.push('─'.repeat(67));
  if (cm.totals.saved === 0) {
    L.push('');
    L.push(c.dim('  note: lite/ultra/wenyan have no benchmark coefficient yet;'));
    L.push(c.dim('  only `full` mode produces non-zero savings estimates.'));
    L.push(c.dim('  switch via: hi mode full'));
  }
  L.push('');
  return L.join('\n') + '\n';
}

function renderMarkdown(report) {
  const L = [];
  L.push('# hi stats');
  L.push(`\n_hi v${report.version}_`);
  L.push('\n## rtk gain\n');
  L.push('```\n' + (report.rtk ? report.rtk.text.trimEnd() : 'rtk not installed') + '\n```');
  const cm = report.caveman;
  L.push('\n## Caveman\n');
  if (!cm || cm.sessions.length === 0) L.push('_no history yet_');
  else {
    L.push(`- Sessions: ${cm.sessions.length}`);
    L.push(`- Output tokens: ${k(cm.totals.output)}`);
    L.push(`- Tokens saved: ${k(cm.totals.saved)} (${pct(cm.totals.saved, cm.totals.output).toFixed(1)}%)`);
    L.push(`- Est. cost saved: $${cm.totals.usd.toFixed(4)}`);
    L.push('\n| Mode | Sessions | Output | Saved | Avg% |');
    L.push('|---|---:|---:|---:|---:|');
    for (const s of cm.by_mode) L.push(`| ${s.mode} | ${s.sessions} | ${k(s.output)} | ${k(s.saved)} | ${pct(s.saved, s.output).toFixed(1)}% |`);
  }
  return L.join('\n') + '\n';
}

async function run(args, opts = {}) {
  const report = build();
  const format = opts.format || 'text';
  if (format === 'text' && !opts.output) {
    // Live rtk gain: stream output instead of buffering, agenttrace-style.
    process.stdout.write(`\n${c.bold('hi stats')}  ${c.dim('v' + report.version)}\n`);
    process.stdout.write(`\n${c.cyan('rtk gain')}\n`);
    if (rtkInstalled()) spawnRun('rtk', ['gain']);
    else process.stdout.write(`  ${c.red('✗')} rtk not installed\n`);
    process.stdout.write(`\n${c.cyan('caveman')}\n`);
    process.stdout.write(renderText({ ...report, rtk: { text: '' } }).split('\n').slice(4).join('\n'));
    return 0;
  }
  const renderer = pick(format, { json: (r) => renderJSON(r), markdown: renderMarkdown, md: renderMarkdown, text: renderText });
  emit(renderer(report), opts.output);
  return 0;
}

module.exports = { run, build };
