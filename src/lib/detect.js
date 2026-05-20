const fs = require('fs');
const path = require('path');
const P = require('./paths');
const { have } = require('./have');

const AI_CLIS = ['claude', 'codex', 'opencode', 'openclaw', 'hermes'];

function rtkInstalled() {
  return Boolean(have('rtk'));
}

function cavemanHooksInstalled() {
  if (!fs.existsSync(P.HOOKS_DIR)) return false;
  try {
    return fs.readdirSync(P.HOOKS_DIR).some((f) => f.startsWith('caveman-'));
  } catch {
    return false;
  }
}

function cavemanActiveMode() {
  try {
    return fs.readFileSync(P.CAVEMAN_FLAG, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function superpowersInstalled(pluginId) {
  if (!fs.existsSync(P.CLAUDE_PLUGINS_JSON)) return false;
  try {
    const j = JSON.parse(fs.readFileSync(P.CLAUDE_PLUGINS_JSON, 'utf8'));
    return Boolean(j && j.plugins && j.plugins[pluginId]);
  } catch {
    return false;
  }
}

function detectAIClis() {
  return AI_CLIS.filter((name) => Boolean(have(name)));
}

function autoInstallTargetsForAIClis(clis = []) {
  const detected = new Set(clis);
  const targets = new Set();

  if (detected.size > 0) {
    targets.add('rtk');
    targets.add('agenttrace');
  }
  if (detected.has('claude')) {
    targets.add('caveman');
    targets.add('superpowers');
  }
  for (const name of ['codex', 'opencode', 'openclaw', 'hermes']) {
    if (detected.has(name)) targets.add(name);
  }

  return ['rtk', 'caveman', 'superpowers', 'codex', 'opencode', 'openclaw', 'hermes', 'agenttrace']
    .filter((name) => targets.has(name));
}

module.exports = {
  AI_CLIS,
  rtkInstalled,
  cavemanHooksInstalled,
  cavemanActiveMode,
  superpowersInstalled,
  detectAIClis,
  autoInstallTargetsForAIClis,
};
