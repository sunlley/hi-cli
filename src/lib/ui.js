const useColor = process.stdout.isTTY && process.env.NO_COLOR == null;

const wrap = (code) => (s) => useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s);
const c = {
  bold: wrap(1),
  dim: wrap(2),
  green: wrap(32),
  red: wrap(31),
  yellow: wrap(33),
  cyan: wrap(36),
};

const ok = (s) => console.log(`  ${c.green('✓')} ${s}`);
const bad = (s) => console.log(`  ${c.red('✗')} ${s}`);
const warn = (s) => console.log(`  ${c.yellow('!')} ${s}`);
const info = (s) => console.log(`  ${c.dim('·')} ${s}`);
const head = (s) => console.log(`\n${c.bold(s)}`);
const sub = (s) => console.log(`\n${c.cyan(s)}`);
const plain = (s = '') => console.log(s);

module.exports = { c, ok, bad, warn, info, head, sub, plain };
