# dsh-resume-sp

DeepSeek Harness 的简历插件。它在会话里挂一个简历顾问，左边对话、右边实时预览，AI 只在简历项目的 YAML 与 CSS 里改内容。

一份简历是一个目录：`data/` 存内容，`styles/` 存样式，`layouts/` 存版式。插件把这个目录交给 AI 读写，并把结果渲染成页面。

## 安装

```sh
dsh plugin --profile <profile> add dsh-resume-sp
```

桌面版：Plugins → Add plugin，填包名或 tarball 路径。

## 开始

点左栏「简历」进入简历模式。第一次进入时选择简历项目目录；默认目录 `~/.dsh/resume`，插件会把随包模板写入该目录。

进入后直接说需求，例如「把学生会宣传部那段改成内容运营的语气」。AI 改 YAML，右栏预览随之刷新。

配置在 设置 → 简历模式：项目目录、预览版本、打开预览、刷新。

## 简历项目

```
data/<版本>/       一个版本一个目录，例如 data/me/
  personal.yaml    基本信息
  education.yaml   教育
  summary.yaml     个人简介
  skills.yaml      技能
  internships/     实习，一个文件一段
  projects/        项目，一个文件一段
styles/            样式库
layouts/           版式
output/            导出产物
```

每个 YAML 末尾的 `reference:` 是记忆区，构建时从该行起整段截断，不参与渲染。对话里确认的口径、数字与红线写在这里。

多版本：复制 `data/<版本>/` 并改名。

## 导出

`export` 工具先校验再构建。

| format | 输出 |
| --- | --- |
| `html` | 自包含 HTML，默认 |
| `pdf` | PDF 文件 |
| `image` | 长图 |
| `all` | 以上全部 |

PDF 与长图使用系统已安装的 Edge 或 Chrome 渲染，其次使用可选的 `playwright`。

## 预览窗口

默认形态是右栏标签页，web 与桌面壳均可用。预览服务使用固定端口 `39127`。

独立窗口并跟随主窗口时，使用仓库里的 `dsh-overlay/`：先应用到 dsh 源码树，再从源码构建桌面版。

```sh
node dsh-overlay/apply.mjs <dsh 源码目录>
```

## 环境

dsh 0.2.0-rc.2。渲染器随插件分发，运行在 dsh 的 Node 进程内，不依赖 Python。

## 开发

```sh
pnpm install
pnpm build
pnpm test
pnpm pack
```

`pnpm pack` 依次执行 build、check:bundle、template:pack。`check:bundle` 执行两遍 `lib/client.js`，校验注册 id 与包名一致、模块体位于 factory 闭包内。

包内容由 `package.json` 的 `files` 决定：`lib/`、`cordis.patch.yml`、`locale/`、`knowledge/`、`icon.svg`、`workspace-template.tgz`。

```
src/index.ts       host：项目目录、预览服务、变更轮询
src/policy.ts      写边界、记录提醒、export 工具
src/client.ts      浏览器端：入口、设置页、引导窗、预览按钮
src/render/        YAML → HTML 渲染器，PDF 与长图
cordis.patch.yml   装配层：host 行与「简历顾问」preset
```

## 许可

MIT
