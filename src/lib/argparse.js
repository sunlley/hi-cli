// Tiny zero-dep arg parser. Supports:
//   --flag             → boolean true
//   --no-flag          → boolean false
//   --key=value        → string
//   --key value        → string
//   -k value           → string (single-char alias)
//   -k                 → boolean
//   --                 → stop parsing flags
//   positional args returned in `_`

function parse(argv, spec = {}) {
  // spec: { format: { type: 'string', alias: 'f', default: 'text', choices: [...] },
  //         output: { type: 'string', alias: 'o' },
  //         quiet:  { type: 'boolean', alias: 'q' } }
  const aliasMap = {};
  const types = {};
  const defaults = {};
  const choices = {};
  for (const [name, s] of Object.entries(spec)) {
    if (s.alias) aliasMap[s.alias] = name;
    types[name] = s.type || 'boolean';
    if (s.default !== undefined) defaults[name] = s.default;
    if (s.choices) choices[name] = s.choices;
  }

  const out = { _: [], ...defaults };
  let i = 0;
  let stopFlags = false;
  while (i < argv.length) {
    const tok = argv[i];
    if (stopFlags) { out._.push(tok); i++; continue; }
    if (tok === '--') { stopFlags = true; i++; continue; }

    if (tok.startsWith('--')) {
      let raw = tok.slice(2);
      let value;
      const eq = raw.indexOf('=');
      if (eq >= 0) { value = raw.slice(eq + 1); raw = raw.slice(0, eq); }
      let negate = false;
      if (raw.startsWith('no-')) { negate = true; raw = raw.slice(3); }
      const name = aliasMap[raw] || raw;
      const type = types[name] || (value !== undefined ? 'string' : 'boolean');
      if (type === 'boolean') {
        out[name] = !negate;
        if (value !== undefined) out[name] = value !== 'false' && value !== '0' && !negate;
      } else {
        if (value === undefined) { value = argv[++i]; }
        if (value === undefined) throw usageError(`flag --${raw} needs a value`);
        if (choices[name] && !choices[name].includes(value)) {
          throw usageError(`--${raw}: invalid value '${value}', expected one of: ${choices[name].join(', ')}`);
        }
        out[name] = value;
      }
      i++;
      continue;
    }

    if (tok.startsWith('-') && tok.length > 1 && !/^-\d/.test(tok)) {
      const key = tok.slice(1);
      const name = aliasMap[key] || key;
      const type = types[name] || 'boolean';
      if (type === 'boolean') { out[name] = true; i++; continue; }
      const value = argv[++i];
      if (value === undefined) throw usageError(`flag -${key} needs a value`);
      if (choices[name] && !choices[name].includes(value)) {
        throw usageError(`-${key}: invalid value '${value}', expected one of: ${choices[name].join(', ')}`);
      }
      out[name] = value;
      i++;
      continue;
    }

    out._.push(tok);
    i++;
  }
  return out;
}

function usageError(msg) {
  const err = new Error(msg);
  err.code = 'USAGE';
  return err;
}

module.exports = { parse, usageError };
