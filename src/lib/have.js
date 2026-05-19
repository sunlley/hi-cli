const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Cross-platform: check if a command is on PATH.
function have(cmd) {
  const isWin = process.platform === 'win32';
  const pathExt = isWin ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';') : [''];
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of dirs) {
    for (const ext of pathExt) {
      const full = path.join(dir, cmd + ext);
      try {
        const st = fs.statSync(full);
        if (st.isFile()) return full;
      } catch {}
    }
  }
  return null;
}

function tryExec(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function run(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  return r.status ?? 1;
}

module.exports = { have, tryExec, run };
