const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const proxy = require('../src/commands/proxy');

const ROOT = path.resolve(__dirname, '..');

function run(args, env = {}) {
  return spawnSync(process.execPath, ['bin/hi.js', ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

test('proxy set emits lower and upper case exports', () => {
  const res = run(['proxy', '8899']);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(
    res.stdout,
    [
      'export https_proxy="http://127.0.0.1:8899"',
      'export http_proxy="http://127.0.0.1:8899"',
      'export all_proxy="socks5://127.0.0.1:8899"',
      'export HTTPS_PROXY="http://127.0.0.1:8899"',
      'export HTTP_PROXY="http://127.0.0.1:8899"',
      'export ALL_PROXY="socks5://127.0.0.1:8899"',
      '',
    ].join('\n')
  );
});

test('proxy off unsets lower and upper case vars', () => {
  const res = run(['proxy', 'off']);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(
    res.stdout,
    'unset https_proxy http_proxy all_proxy HTTPS_PROXY HTTP_PROXY ALL_PROXY\n'
  );
});

test('proxy persist writes and removes a zshrc block', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-proxy-'));
  const rcFile = path.join(home, '.zshrc');
  fs.writeFileSync(rcFile, 'export PATH="/usr/bin"\n');

  let res = run(['proxy', '8899', '--persist'], { HOME: home, SHELL: '/bin/zsh' });
  assert.equal(res.status, 0, res.stderr);
  let rcText = fs.readFileSync(rcFile, 'utf8');
  assert.match(rcText, /# >>> hi proxy >>>/);
  assert.match(rcText, /export HTTPS_PROXY="http:\/\/127\.0\.0\.1:8899"/);
  assert.deepEqual(proxy.readPersistedProxy(rcFile), {
    active: true,
    rc_file: rcFile,
    https_proxy: 'http://127.0.0.1:8899',
    HTTPS_PROXY: 'http://127.0.0.1:8899',
    http_proxy: 'http://127.0.0.1:8899',
    HTTP_PROXY: 'http://127.0.0.1:8899',
    all_proxy: 'socks5://127.0.0.1:8899',
    ALL_PROXY: 'socks5://127.0.0.1:8899',
  });

  res = run(['proxy', 'off', '--persist'], { HOME: home, SHELL: '/bin/zsh' });
  assert.equal(res.status, 0, res.stderr);
  rcText = fs.readFileSync(rcFile, 'utf8');
  assert.equal(rcText, 'export PATH="/usr/bin"\n');
});

test('proxy detects zsh rc path from shell', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-proxy-home-'));
  assert.equal(proxy.detectShellRc('/bin/zsh', home), path.join(home, '.zshrc'));
});

test('proxy show json reports uppercase env vars', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-proxy-json-'));
  const res = run(['proxy', 'show', '-f', 'json'], {
    HOME: home,
    SHELL: '/bin/zsh',
    HTTPS_PROXY: 'http://127.0.0.1:9999',
    HTTP_PROXY: 'http://127.0.0.1:9999',
    ALL_PROXY: 'socks5://127.0.0.1:9999',
    https_proxy: '',
    http_proxy: '',
    all_proxy: '',
  });
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(JSON.parse(res.stdout), {
    active: true,
    https_proxy: null,
    HTTPS_PROXY: 'http://127.0.0.1:9999',
    http_proxy: null,
    HTTP_PROXY: 'http://127.0.0.1:9999',
    all_proxy: null,
    ALL_PROXY: 'socks5://127.0.0.1:9999',
    persisted: {
      active: false,
      rc_file: path.join(home, '.zshrc'),
      https_proxy: null,
      HTTPS_PROXY: null,
      http_proxy: null,
      HTTP_PROXY: null,
      all_proxy: null,
      ALL_PROXY: null,
    },
  });
});

test('proxy rejects invalid port with usage exit code', () => {
  const res = run(['proxy', '65536']);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /unknown proxy arg '65536', expected: <port>\|off\|show/);
});
