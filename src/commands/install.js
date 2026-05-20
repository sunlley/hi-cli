const { head, ok, warn, info, bad } = require('../lib/ui');
const { ALL, byName } = require('../installers');
const { detectAIClis, autoInstallTargetsForAIClis } = require('../lib/detect');

function resolveTargets(args, detectedClis = detectAIClis()) {
  if (args.length === 0) {
    return {
      mode: 'auto',
      detectedClis,
      targetNames: autoInstallTargetsForAIClis(detectedClis),
    };
  }
  if (args.length === 1 && args[0] === 'all') {
    return {
      mode: 'all',
      detectedClis,
      targetNames: ALL.map((addon) => addon.name),
    };
  }

  const targetNames = [];
  for (const target of args) {
    const addon = byName(target);
    if (!addon) {
      const err = new Error(`usage: hi install [${ALL.map((a) => a.name).join('|')}|all]`);
      err.code = 'USAGE';
      throw err;
    }
    targetNames.push(addon.name);
  }
  return {
    mode: 'explicit',
    detectedClis,
    targetNames,
  };
}

async function run(args, _opts = {}) {
  const plan = resolveTargets(args);

  if (plan.mode === 'auto') {
    head('install auto');
    if (plan.detectedClis.length === 0) {
      bad('no supported AI CLI detected on PATH');
      info('detectors: claude codex opencode openclaw hermes');
      info('use: hi install all   to force full setup');
      console.log('');
      return 1;
    }
    info(`detected AI CLIs: ${plan.detectedClis.join(' ')}`);
    if (plan.targetNames.length === 0) {
      warn('nothing matched the auto-install rules');
      info('use: hi install all   to force full setup');
      console.log('');
      return 1;
    }
    info(`install targets: ${plan.targetNames.join(' ')}`);
    console.log('');
  }

  if (plan.mode === 'all') {
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

  const selected = ALL.filter((addon) => plan.targetNames.includes(addon.name));
  let lastRc = 0;
  for (const addon of selected) {
    try { lastRc = (await addon.install()) || 0; }
    catch (e) { warn(`${addon.name}: ${e.message}`); lastRc = 1; }
  }
  return lastRc;
}

module.exports = { run, resolveTargets };
