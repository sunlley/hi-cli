// Minimal zero-dep TUI. Renders status + hotkey menu. Pressing a key dispatches
// to the relevant command, then redraws. ESC/q exits.
const readline = require('readline');
const pkg = require('../../package.json');
const { c } = require('../lib/ui');
const statusCmd = require('./status');
const installCmd = require('./install');
const modeCmd = require('./mode');
const statsCmd = require('./stats');
const doctorCmd = require('./doctor');
const uninstallCmd = require('./uninstall');

const W = 60;

function box(lines) {
  const top = '┌' + '─'.repeat(W - 2) + '┐';
  const bot = '└' + '─'.repeat(W - 2) + '┘';
  const body = lines.map((l) => {
    const visible = l.replace(/\x1b\[[0-9;]*m/g, '');
    const pad = Math.max(0, W - 3 - visible.length);
    return '│ ' + l + ' '.repeat(pad) + '│';
  });
  return [top, ...body, bot].join('\n');
}

function header(report) {
  return `${c.bold('hi')} ${c.dim('v' + report.version)}  ${c.dim('— Claude Code add-on manager')}`;
}

function addonRow(a) {
  const tag = a.installed ? c.green('✓') : c.red('✗');
  const right = a.installed
    ? (a.name === 'rtk' ? (a.version || '') : a.name === 'caveman' ? (a.mode ? `mode: ${a.mode}` : c.yellow('inactive')) : '')
    : c.dim('not installed');
  return `  ${tag} ${a.name.padEnd(13)} ${right}`;
}

function menuLines() {
  return [
    '',
    c.dim('Press a key:'),
    `  ${c.bold('[i]')} install auto    ${c.bold('[u]')} uninstall`,
    `  ${c.bold('[m]')} mode menu       ${c.bold('[s]')} stats`,
    `  ${c.bold('[d]')} doctor          ${c.bold('[r]')} refresh`,
    `  ${c.bold('[q]')} quit`,
  ];
}

function draw() {
  process.stdout.write('\x1b[2J\x1b[H'); // clear screen + home
  const report = statusCmd.build();
  const lines = [
    header(report),
    '',
    ...report.addons.map(addonRow),
    ...menuLines(),
    '',
  ];
  process.stdout.write(box(lines) + '\n');
  if (report.missing.length > 0) {
    process.stdout.write(`\n  ${c.yellow('!')} missing: ${report.missing.join(' ')} — press ${c.bold('[i]')} to install\n`);
  }
}

function cleanup(rl) {
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  rl.close();
  process.stdin.pause();
}

async function modeMenu() {
  process.stdin.setRawMode(false);
  process.stdout.write(`\n  Choose mode: [1] lite [2] full [3] ultra [4] wenyan-full [0] off — `);
  const ch = await readChar();
  const map = { '1': 'lite', '2': 'full', '3': 'ultra', '4': 'wenyan-full', '0': 'off' };
  const m = map[ch];
  if (m) await modeCmd.run([m], { format: 'text' });
  process.stdout.write('\n  Press any key to return... ');
  await readChar();
  process.stdin.setRawMode(true);
}

function readChar() {
  return new Promise((resolve) => {
    const onData = (buf) => {
      process.stdin.removeListener('data', onData);
      resolve(buf.toString());
    };
    process.stdin.once('data', onData);
  });
}

async function run() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    // Not a TTY → fall back to status text output.
    return statusCmd.run([], { format: 'text' });
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  draw();

  return new Promise((resolve) => {
    const onKey = async (chunk) => {
      const key = chunk.toString();
      if (key === '' || key === 'q' || key === '') { // ctrl-c, q, esc
        process.stdin.removeListener('data', onKey);
        cleanup(rl);
        process.stdout.write('\n');
        resolve(0);
        return;
      }
      try {
        process.stdin.setRawMode(false);
        if (key === 'i') await installCmd.run([], { format: 'text' });
        else if (key === 'u') {
          process.stdout.write('  uninstall which? [c]aveman [r]tk [s]uperpowers [a]ll — ');
          const c2 = await readChar();
          const tmap = { c: 'caveman', r: 'rtk', s: 'superpowers', a: 'all' };
          if (tmap[c2]) await uninstallCmd.run([tmap[c2]], {});
        }
        else if (key === 'm') await modeMenu();
        else if (key === 's') await statsCmd.run([], { format: 'text' });
        else if (key === 'd') await doctorCmd.run([], { format: 'text' });
        // 'r' just redraws
        process.stdout.write('\n  Press any key to return... ');
        await readChar();
      } finally {
        if (process.stdin.isTTY) process.stdin.setRawMode(true);
        draw();
      }
    };
    process.stdin.on('data', onKey);
  });
}

module.exports = { run };
