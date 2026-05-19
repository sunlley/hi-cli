const readline = require('readline');

// Interactive y/N (default yes). Returns false in non-TTY so automation never blocks.
// Pass { yes: true } (typically from `--yes`/`-y`) to bypass and auto-accept.
async function confirm(prompt = 'Continue', opts = {}) {
  if (opts.yes) return true;
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ans = await new Promise((resolve) => rl.question(`  ${prompt}? [Y/n] `, resolve));
    const a = ans.trim().toLowerCase();
    return a === '' || a === 'y' || a === 'yes';
  } finally {
    rl.close();
  }
}

module.exports = { confirm };
