const fs = require('fs');
const path = require('path');
const P = require('./paths');
const { have } = require('./have');

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

module.exports = { rtkInstalled, cavemanHooksInstalled, cavemanActiveMode, superpowersInstalled };
