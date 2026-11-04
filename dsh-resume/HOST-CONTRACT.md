# dsh-resume 宿主契约

本文件记录插件依赖的 dsh 行为，以及在目标版本上的实测结论。改动涉及宿主的代码前先读。

目标版本为 dsh 0.2.0-rc.2（桌面版）。`peerDependencies` 声明为 `*`，升级 dsh 后需按本文逐条复核。

## 装配

preset 的 `plugins` 列表是完整替换，没有继承。注册表在挂载时逐行审计，任意一行 import 失败会导致整个 preset 挂载失败。

`cordis.patch.yml` 中列出的包名必须在目标运行时存在。升级 dsh 后，按该版本的 `@deepseek-ai/dsh-web-app/presets/standard.patch.yml` 重新同步。

## 客户端

`package.json#dsh.client` 与 `exports["./client"]` 指向构建产物。`dsh.client.inject` 只决定激活顺序，不加载模块。

产物由宿主的 client-modules 以 classic script 形式加载，有三项约束：

- 注册 id 必须与 `package.json` 的 `name` 一致。宿主按包名建立 boot 图，再按包名回查工厂；id 不一致时该条目不会激活。
- 模块体必须位于 `load({ id, factory })` 的 factory 内。顶层声明会进入页面全局词法环境，同一脚本二次执行会因重复声明报错。
- `factory` 的返回值为插件对象，由该对象提供 `inject` 与 `apply`。

`scripts/check-bundle.mjs` 在前两条上做打包前校验。

## 会话与工具

- 0.2.0-rc.2 没有 `ctx.workingDirectory`。会话工作区为 `agent.session.header.cwd`。
- `ctx.tools.guard()` 挂在普通 ctx 上作用于全局，挂在 preset 作用域内只作用于该会话。`ctx.tools.restrict()` 需要 agent 作用域。
- `dsh-persona` 只能挂在 preset 内。`complete: true` 会将系统提示压成单段，工具说明、plan 模式说明与 harness 身份一并丢失，本插件不使用该选项。

## 预览

预览是插件注册的右栏标签页，由 `ctx.sidebarRightTabs.register` 与 `sidebar.right.pane.tab` 的 body 组成。iframe 指向 `127.0.0.1:39127`，web 与桌面壳均可用。

官方的浏览器标签页带地址栏，仅在该类型未注册时作为回退。

## 渲染器

渲染器位于 `src/render/`，在宿主进程内运行，不启动子进程，不写临时文件，不依赖 Python。

导出 PDF 与长图时使用 `puppeteer-core` 驱动系统 Edge 或 Chrome，缺失时回退到可选的 `playwright`。`test/golden/` 保存原 Python 实现的逐字节参照产物。
