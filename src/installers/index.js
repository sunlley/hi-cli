// Plugin registry. Adding a new addon = drop a file here and export it.
// Each addon must implement: { name, label, status(), install(), uninstall() }.
const rtk = require('./rtk');
const caveman = require('./caveman');
const superpowers = require('./superpowers');
const codex = require('./codex');
const opencode = require('./opencode');
const openclaw = require('./openclaw');
const hermes = require('./hermes');

const ALL = [rtk, caveman, superpowers, codex, opencode, openclaw, hermes];

function byName(name) {
  return ALL.find((p) => p.name === name) || null;
}

module.exports = { ALL, byName, rtk, caveman, superpowers, codex, opencode, openclaw, hermes };
