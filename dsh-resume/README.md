# dsh-resume —— dsh 的「简历模式」

给 [DeepSeek Harness](https://github.com/deepseek-ai) 装一个插件：**点左栏「简历」就进简历模式**——
工作区自动指向简历项目、会话模式是「简历顾问」（AI 只改简历的 YAML / CSS）、右栏挂上实时预览。

装完只多几样东西，**不删任何原有功能、不另造页面**：

| 加了什么 | 在哪 |
|---|---|
| 左栏「简历」入口 | 点它 = 进简历模式：注册工作区 + 开一个会话（主区域就是**原本的对话页**）+ 右栏打开预览 |
| 第一次点它 | 弹一次引导窗：选简历项目目录 |
| 设置 → 「简历模式」 | 之后改配置的地方：项目目录、预览版本、打开预览、刷新 |
| 一个会话模式「简历顾问」 | 设置 → Agent presets 里能看到；进入简历模式时**逐会话**设上（不动你的全局默认） |
| 一个 `export` 工具 + 写边界 | 只对用「简历顾问」模式的会话生效 |

## 装

```sh
dsh plugin --profile <profile> add ./dsh-resume-0.1.0.tgz
```

或者在桌面版里：**Plugins → Add plugin**，填 tarball 的绝对路径。

装完重启 dsh → 左栏点「简历」→ 按引导走完 → 就在对话页里开始聊了。
会话头还有个「简历预览」按钮，随时把预览叫回右栏。

## 项目目录

默认 `<用户目录>/.dsh/resume`，首次使用会把插件自带的一份模板铺进去（含 `data/me` 示例数据、样式库、布局）。
已有自己的简历项目就在引导窗或设置页里把目录改过去——**项目里要有 `data/` 和 `styles/`**（布局在 `layouts/`）。

## 需要什么

- dsh **0.2.0-rc.2**（桌面版 nightly feed 当前最新；`package.json` 的 `peerDependencies` 卡这个版本）
- **不需要 Python**。渲染器（YAML → 自包含 HTML）已经随插件分发，跑在 dsh 的 Node 里。
- 只有出 **PDF / 长图**才额外需要 `playwright`（可选）：`pnpm add playwright && npx playwright install chromium`；
  没装也能用，导出 HTML 和预览都不受影响。

## 桌面端预览窗（可选）

插件本身通过右栏标签页预览，web 与桌面壳都能用。如果想让预览**贴在主窗右侧、随主窗一起移动**（独立于 dsh 的布局），额外把 `dsh-overlay/` 应用到 dsh 源码树：

```sh
node dsh-overlay/apply.mjs <dsh 源码目录>     # 默认 ../deepseek-harness
```

它做两件事：新增 `apps/desktop/src/resume-preview-window.ts`，并在 `apps/desktop/src/main.ts` 里按锚点插两行。幂等，重复执行会跳过已应用的补丁。

不打这个补丁也能用——预览停在右栏标签页里。但要打补丁就得自己从源码构建桌面版，官方安装包改不了。

## 边界（说清楚，别当安全墙）

- 写边界是**安全网**，不是墙：用户机器上有 shell，绕过它是一条命令的事。
- 限制只针对**写**：`edit` / `write` 只能落在简历项目里、且只能是 `.yaml` / `.yml` / `.css`；
  `read` 完全不拦——读到的内容会进 AI 上下文。
- `styles/` 下**已存在**的样式文件不让改（那是所有版本共用的库），要新样式就新建
  `styles/<类别>/<名字>-custom.css`，再在 YAML 的 `style` 列表里引用。
- 预览用固定端口 `39127`。同时跑两个 dsh 实例时，第二个实例的预览起不来（端口被占），
  设置页会把错误显示出来。
- 右栏预览用的是**插件自己的标签页**（只有画面：没有地址栏、前进后退那套浏览器外壳，改完自动刷新）。
  官方「浏览器」标签页只作兜底（万一我们的类型没注册上）；都不行时退回独立窗口。

## 卸载

```sh
dsh plugin --profile <profile> remove dsh-resume
```

插件自己的东西（项目目录、预览端口、模式）随插件一起消失；简历项目目录里的文件不动。

## 包结构

```
src/index.ts         host 半：项目目录 / 预览服务（HTTP）+ 变更轮询
src/policy.ts        挂在 preset 里：写边界 guard + export 工具
src/client.ts        浏览器半：左栏入口（过场）+ 设置页 + 首次引导窗 + 会话头预览按钮
src/render/          渲染器（TS）：YAML → 自包含 HTML，PDF / 长图，独立 CLI
src/types/           宿主 API 的类型声明（手抄自已安装的 dsh 包，见文件头注释）
lib/                 构建产物（tsdown 出，随包分发）
cordis.patch.yml     装配层：host 行 + 「简历顾问」preset（照抄官方 standard preset，只换人设）
knowledge/           方法论资料库（persona 里给路径，AI 按需读）
workspace-template/  随包分发的简历项目模板（data / styles / layouts / assets）
dsh-pin.txt          运行时版本对齐说明（改代码前先读）
```

## 开发

源码是 TypeScript（跟 dsh 本身一致），构建产物在 `lib/`，`npm pack` 会自动先构建：

```sh
pnpm install
pnpm typecheck      # tsc --noEmit：对着 src/types/ 里手抄的宿主声明检查
pnpm build          # tsdown → lib/{index,policy,client}.js + lib/render/*
pnpm test           # node --test：渲染器黄金用例（对齐原 Python 版）+ 单元测试
pnpm pack           # prepack 会先 build，再出 dsh-resume-0.1.0.tgz
```

宿主包（`@deepseek-ai/*`）一律 external，由 dsh 运行时解析提供，不打进包里。
`src/types/*.d.ts` 是**手抄**的宿主声明（那些包没按 0.2.0-rc.2 发到 npm）；
升级 dsh 后对着新版 `.d.ts` 复核——它正是用来在编译期挡住「API 用错」这类问题的。

渲染器是原来那份 Python（`make.py` + `src/*.py`）的逐文件移植，`test/golden/*.html` 是
Python 版生成的参照产物：**迁完必须逐字节一致**，改渲染器时先跑 `pnpm test`。
