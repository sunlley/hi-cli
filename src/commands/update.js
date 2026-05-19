const { head, bad, info } = require('../lib/ui');
const { run: spawnRun } = require('../lib/have');
const { rtkInstalled } = require('../lib/detect');
const caveman = require('../installers/caveman');

async function run(_args = [], _opts = {}) {
  head('update caveman');
  spawnRun('npx', ['-y', `github:${caveman.repo}`, '--', '--force', '--non-interactive']);

  head('update rtk');
  if (rtkInstalled()) info('rtk updates via its own channel — see https://github.com/rtk-ai/rtk');
  else bad('rtk not installed');
  return 0;
}

module.exports = { run };
