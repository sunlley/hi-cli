const { head, ok, warn } = require('../lib/ui');
const { ALL, byName } = require('../installers');

async function run(args, _opts = {}) {
  // Accept either ["all"], ["rtk"], or multiple names like ["rtk","caveman"]
  const list = args.length === 0 ? ['all'] : args;
  if (list.length === 1 && list[0] === 'all') {
    const results = {};
    for (const addon of ALL) {
      try { results[addon.name] = await addon.install(); }
      catch (e) { results[addon.name] = 1; warn(`${addon.name}: ${e.message}`); }
    }
    head('summary');
    for (const addon of ALL) {
      const rc = results[addon.name];
      if (rc === 0) ok(`${addon.name.padEnd(12)} ok`);
      else warn(`${addon.name.padEnd(12)} not installed`);
    }
    console.log('');
    return 0;
  }

  let lastRc = 0;
  for (const target of list) {
    const addon = byName(target);
    if (!addon) {
      const err = new Error(`usage: hi install [${ALL.map((a) => a.name).join('|')}|all]`);
      err.code = 'USAGE';
      throw err;
    }
    try { lastRc = (await addon.install()) || 0; }
    catch (e) { warn(`${addon.name}: ${e.message}`); lastRc = 1; }
  }
  return lastRc;
}

module.exports = { run };
