#!/usr/bin/env node
require('../src/cli').main(process.argv.slice(2)).catch((err) => {
  if (err && err.code === 'USAGE') {
    process.stderr.write(err.message + '\n');
    process.exit(2);
  }
  process.stderr.write((err && err.stack) || String(err));
  process.stderr.write('\n');
  process.exit(1);
});
