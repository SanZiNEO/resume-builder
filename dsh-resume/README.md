# dsh-resume

DeepSeek Harness 的简历插件。左栏新增「简历」入口，进入后工作区指向简历项目，会话使用「简历顾问」模式，右栏显示实时预览。

## 安装

```sh
dsh plugin --profile <profile> add dsh-resume-cv
```

桌面版也可在 Plugins → Add plugin 中填入包名或 tarball 路径。

## 功能

- 左栏「简历」入口：注册工作区、新建会话、打开右栏预览。
- 首次使用引导：选择简历项目目录。
- 设置 → 简历模式：项目目录、预览版本、打开预览、刷新。
- 会话模式「简历顾问」：逐会话生效，不修改全局默认模式。
- `export` 工具：校验后导出 HTML、PDF 或长图。

## 项目目录

默认 `~/.dsh/resume`，首次使用时写入随包模板。目录需包含 `data/` 与 `styles/`，布局位于 `layouts/`。

已有项目可在引导窗或设置页中改指。

## 环境要求

- dsh 0.2.0-rc.2
- 无需 Python。渲染器随插件分发，运行在 dsh 的 Node 进程中。
- 导出 PDF 或长图需要 Chromium 内核浏览器：优先使用系统已安装的 Edge 或 Chrome，其次为可选的 `playwright`。两者都缺失时，HTML 导出与预览不受影响。

## 右栏预览

预览使用插件注册的右栏标签页，web 与桌面壳均可用。

如需预览窗口附着在主窗口右侧、随主窗口移动，可将 `dsh-overlay/` 应用到 dsh 源码树：

```sh
node dsh-overlay/apply.mjs <dsh 源码目录>
```

该脚本新增 `apps/desktop/src/resume-preview-window.ts`，并在 `apps/desktop/src/main.ts` 中插入两行；重复执行会跳过已应用的部分。使用该选项需要自行从源码构建桌面版。

## 写入限制

- 仅限制写操作：`edit` 与 `write` 只能写入简历项目内的 `.yaml`、`.yml`、`.css` 文件；`read` 不受限制。
- `styles/` 中已存在的样式文件不可修改。新增样式写入 `styles/<类别>/<名字>-custom.css`，并在 YAML 的 `style` 列表中引用。
- 限制作用于使用「简历顾问」模式的会话。

## 已知限制

- 预览使用固定端口 39127。同时运行两个 dsh 实例时，第二个实例的预览不可用，设置页会显示对应错误。
- 右栏预览不使用官方浏览器标签页，因此没有地址栏与前进/后退。该类型未注册时回退到官方浏览器标签页，再回退到独立窗口。
- 写入限制不阻止通过 shell 直接修改文件。

## 卸载

```sh
dsh plugin --profile <profile> remove dsh-resume-cv
```

插件的配置与预览服务随卸载移除，简历项目目录中的文件不受影响。

## 目录结构

```
src/index.ts          host：项目目录、预览服务（HTTP）、变更轮询
src/policy.ts         写入限制与 export 工具
src/client.ts         浏览器端：左栏入口、设置页、引导窗、会话头预览按钮
src/render/           渲染器：YAML → HTML，PDF 与长图，含独立 CLI
src/types/            宿主 API 类型声明
lib/                  构建产物，随包发布
cordis.patch.yml      装配层：host 行与「简历顾问」preset
knowledge/            方法论资料
workspace-template/   简历项目模板
dsh-pin.txt           运行时版本对齐说明
```

## 开发

```sh
pnpm install
pnpm build
pnpm test
pnpm pack
```

`pnpm pack` 依次执行 build、check:bundle 与 template:pack。check:bundle 执行两遍 `lib/client.js`，校验注册 id 与包名一致、模块体位于 factory 闭包内。

包内容由 `package.json` 的 `files` 决定：`lib/`、`cordis.patch.yml`、`locale/`、`knowledge/`、`icon.svg`、`workspace-template.tgz`。

## 发布

```sh
npm version <x.y.z> --no-git-tag-version
npm publish
```
