const { ALL, byName } = require('../installers');

async function run(args, _opts = {}) {
  const target = args[0];
  if (!target) {
    const err = new Error(`usage: hi uninstall [${ALL.map((a) => a.name).join('|')}|all]`);
    err.code = 'USAGE';
    throw err;
  }
  if (target === 'all') {
    for (const addon of ALL) {
      try { await addon.uninstall(); } catch {}
    }
    return 0;
  }
  const addon = byName(target);
  if (!addon) {
    const err = new Error(`unknown addon: ${target}`);
    err.code = 'USAGE';
    throw err;
  }
  return addon.uninstall();
}

module.exports = { run };
