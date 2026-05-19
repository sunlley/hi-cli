// Minimal i18n: t(key) lookup. EN default; ZH on `--lang zh` or HI_LANG=zh.
const EN = {
  // common
  cli_version: 'hi version %s',
  cli_saved: 'saved to %s',
  cli_error: 'error: %s',
  // status
  status_title: 'hi status',
  status_missing: 'missing: %s',
  status_install_now: 'install now',
  status_install_later: 'later: hi install %s',
  status_gate_failed: 'gate failed: addons missing → %s',
  // doctor
  doctor_title: 'hi doctor',
  doctor_node: 'node %s (caveman needs ≥18)',
  doctor_node_old: 'node %s < 18 — caveman install will fail',
  doctor_node_missing: 'node not on PATH',
  doctor_settings_ok: '%s parses as strict JSON',
  doctor_settings_jsonc: '%s has JSONC (comments/trailing commas)',
  doctor_settings_missing: 'no %s yet',
  doctor_claude_present: 'claude CLI present',
  doctor_claude_missing: "claude CLI not on PATH — Claude Code commands won't work from terminal",
  doctor_recommendations: 'recommendations',
  doctor_rec_ready: "you're set — run `hi status` for a health summary",
  doctor_rec_install_node: 'install Node ≥18 (brew install node, nvm, etc.)',
  doctor_rec_install_claude: 'install Claude Code CLI from https://claude.ai/code',
  doctor_rec_install_missing: 'run `hi install %s` to install missing add-ons',
  // mode
  mode_current: 'current: %s',
  mode_set: 'caveman mode → %s',
  mode_unset: 'caveman flag removed',
  mode_unknown: 'unknown mode: %s',
  // list
  list_title: 'hi list — managed add-ons',
};

const ZH = {
  cli_version: 'hi 版本 %s',
  cli_saved: '已保存到 %s',
  cli_error: '错误: %s',
  status_title: 'hi 状态',
  status_missing: '缺失: %s',
  status_install_now: '现在安装',
  status_install_later: '稍后: hi install %s',
  status_gate_failed: '检查失败: 缺失插件 → %s',
  doctor_title: 'hi 体检',
  doctor_node: 'node %s (caveman 需要 ≥18)',
  doctor_node_old: 'node %s < 18 — caveman 安装会失败',
  doctor_node_missing: 'node 不在 PATH 中',
  doctor_settings_ok: '%s 是严格 JSON',
  doctor_settings_jsonc: '%s 含 JSONC (注释 / 尾随逗号)',
  doctor_settings_missing: '尚无 %s',
  doctor_claude_present: 'claude CLI 可用',
  doctor_claude_missing: 'claude CLI 不在 PATH — 终端无法运行 Claude Code 命令',
  doctor_recommendations: '建议',
  doctor_rec_ready: '一切就绪 — 运行 `hi status` 查看健康摘要',
  doctor_rec_install_node: '先安装 Node ≥18 (brew install node、nvm 等)',
  doctor_rec_install_claude: '从 https://claude.ai/code 安装 Claude Code CLI',
  doctor_rec_install_missing: '运行 `hi install %s` 安装缺失插件',
  mode_current: '当前: %s',
  mode_set: 'caveman 模式 → %s',
  mode_unset: 'caveman flag 已移除',
  mode_unknown: '未知模式: %s',
  list_title: 'hi list — 已管理插件',
};

const dicts = { en: EN, zh: ZH };
let current = 'en';

function setLang(l) {
  if (!l) return;
  const norm = String(l).toLowerCase().replace('_', '-');
  if (norm === 'zh' || norm.startsWith('zh-') || norm === 'chinese') current = 'zh';
  else current = 'en';
}

function t(key, ...args) {
  const dict = dicts[current] || EN;
  let s = dict[key] != null ? dict[key] : (EN[key] != null ? EN[key] : key);
  for (const a of args) s = s.replace('%s', a);
  return s;
}

setLang(process.env.HI_LANG);

module.exports = { t, setLang, current: () => current };
