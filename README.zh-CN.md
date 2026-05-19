<h1 align="center">hi</h1>

<p align="center">
  一个 CLI，统一安装、配置、审计 Claude Code 全套插件。
</p>

<p align="center">
  <a href="README.md">English</a> | 简体中文
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@joinc/hi"><img src="https://img.shields.io/npm/v/@joinc/hi?color=00ADD8" alt="npm"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A518-339933.svg" alt="Node ≥18">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/local--first-yes-54ff00.svg" alt="local-first">
</p>

---

**hi** 是本地运行、零运行时依赖的 CLI，统一管理 Claude Code 三大插件 — `rtk`、`caveman`、`superpowers`。终端、脚本、CI 用同一套命令面。

## 为什么用 hi

Claude Code 装齐插件才好用，但每个插件都有自己的安装方式、配置路径、报错口径。**hi** 把这些统一起来。

它帮你回答：

- **我的 Claude Code 设置健康吗？** 一条命令 (`hi`) 列出所有插件状态、版本、模式、节省量。
- **新机器上要装什么？** `hi setup` 一键安装，自动选最优方式 (brew → curl → cargo / npx / claude plugin)。
- **caveman 模式生效了吗？** `hi mode full` 切换，`hi stats` 看节省。
- **能在 CI 里卡关吗？** `hi status --fail-on-missing` 缺失插件直接退出 2。
- **能用中文输出吗？** `hi --lang zh` 全部切换。

## 安装

```bash
npm i -g @joinc/hi
```

需要 Node ≥ 18。

## 快速开始

```bash
hi              # 交互式 TUI (无参数)
hi setup        # 一键安装全部
hi status       # 健康检查 (文本)
hi mode full    # 设置 caveman 模式
hi stats        # rtk + caveman 节省汇总
hi doctor       # 深度体检 (node / settings.json / claude CLI)
```

## 管理的插件

| 工具 | 作用 | 仓库 |
|---|---|---|
| **rtk** | Rust Token Killer — 代理，节省开发工具 60–90% token | [rtk-ai/rtk](https://github.com/rtk-ai/rtk) |
| **caveman** | Claude Code 超压缩输出模式 | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) |
| **superpowers** | Claude Code 技能包插件 | [obra/superpowers](https://github.com/obra/superpowers) |

## 常用工作流

```bash
# 脚本/CI 用机读输出
hi status -f json

# 保存 Markdown 健康报告
hi doctor -f markdown -o doctor.md

# CI 卡关
hi status --fail-on-missing

# 切换 caveman 模式
hi mode full

# 节省统计存为 JSON
hi stats -f json -o stats.json
```

## CLI 参考

```
用法:
  hi                       启动交互式 TUI
  hi <command> [flags]     执行单条命令 (机读友好)

命令:
  status                   全部插件健康 + 当前模式
  setup                    等同于 hi install all
  install [tool|all]       自动方式安装
  uninstall [tool|all]     卸载
  mode <lvl|off>           caveman 模式: lite|full|ultra|wenyan|wenyan-*|off
  stats                    token 节省汇总
  doctor                   深度体检
  list                     列出已管理插件
  proxy show               查看 http(s)_proxy / all_proxy
  update                   更新 caveman 到 main 最新

全局参数:
  -f, --format <fmt>       text | json | markdown   (默认 text)
  -o, --output <file>      写入文件 (stderr 输出 "saved to ...")
      --lang <en|zh>       输出语言
      --fail-on-missing    缺失插件时退出码 2 (CI 卡关)
  -q, --quiet              静默 (跳过交互提示)
      --no-color           关闭 ANSI 色
  -h, --help               帮助
  -v, --version            版本号
```

## CI 集成

```yaml
- run: npm i -g @joinc/hi
- run: hi status --fail-on-missing -f json -o hi-status.json
- uses: actions/upload-artifact@v4
  with: { name: hi-status, path: hi-status.json }
```

退出码：

| 退出码 | 含义 |
|---|---|
| 0 | 成功 |
| 1 | 运行时错误 |
| 2 | 卡关失败 (`--fail-on-missing` 且有缺失) |

## 你能得到

| 需求 | hi 给你 |
|---|---|
| 一键安装 | `hi setup` 自动选择最优渠道，逐步确认 |
| 模式切换 | `hi mode lite\|full\|ultra\|wenyan-*\|off` 写入 caveman flag |
| 汇总报告 | `hi stats` 把 rtk 与 caveman 数据合并 |
| 脚本友好 | 每个命令支持 `-f json`、`-o file` |
| CI 卡关 | `--fail-on-missing` 非零退出，可直接接入流水线 |
| 本地优先 | 纯 JS、零运行时依赖、零遥测、不联网 (除你触发的安装) |
| 双语 | `--lang en\|zh` 全文切换 |
| TUI | 裸 `hi` 启动交互式仪表盘 |

## 添加新插件

在 `src/installers/` 加一个文件：

```js
// src/installers/myaddon.js
module.exports = {
  name: 'myaddon',
  label: 'myaddon  (描述)',
  repo: 'owner/repo',
  inspect() {
    // 只读检测，返回:
    //   { name, label, installed, extras: [{ level, text }] }
  },
  async install() { /* 提示、安装，返回 0/非零 */ },
  uninstall() { /* 返回 0/非零 */ },
};
```

注册到 `src/installers/index.js` — 所有命令 (`status` / `install` / TUI 等) 自动识别。

## 隐私

`hi` 完全在本地运行。读取范围：

- `~/.claude/` (settings、hooks、plugins、caveman flag + history)
- PATH 上的 `rtk` / `node` / `claude` / `brew` / `curl` / `cargo`

只有在**你**触发 `hi install ...` 时才会联网，而且只访问对应工具的上游仓库。

## 贡献

欢迎插件 PR。一个好的 PR 通常包含：

- 在 `src/installers/<name>.js` 实现 `inspect / install / uninstall`
- 在 `src/installers/index.js` 注册
- 在 README 的"管理的插件"表加一行

## 许可证

[MIT](LICENSE)
