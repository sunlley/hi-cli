const test = require('node:test');
const assert = require('node:assert/strict');
const { autoInstallTargetsForAIClis } = require('../src/lib/detect');
const { resolveTargets } = require('../src/commands/install');

test('auto install targets for claude include claude-specific addons', () => {
  assert.deepEqual(
    autoInstallTargetsForAIClis(['claude']),
    ['rtk', 'caveman', 'superpowers', 'agenttrace']
  );
});

test('auto install targets for sibling ai clis include their own installers', () => {
  assert.deepEqual(
    autoInstallTargetsForAIClis(['codex', 'openclaw']),
    ['rtk', 'codex', 'openclaw', 'agenttrace']
  );
});

test('resolveTargets defaults to auto mode without explicit args', () => {
  assert.deepEqual(
    resolveTargets([], ['claude', 'opencode']),
    {
      mode: 'auto',
      detectedClis: ['claude', 'opencode'],
      targetNames: ['rtk', 'caveman', 'superpowers', 'opencode', 'agenttrace'],
    }
  );
});

test('resolveTargets keeps explicit all mode', () => {
  const plan = resolveTargets(['all'], ['claude']);
  assert.equal(plan.mode, 'all');
  assert.ok(plan.targetNames.includes('rtk'));
  assert.ok(plan.targetNames.includes('agenttrace'));
});
