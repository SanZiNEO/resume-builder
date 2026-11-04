/**
 * 构建配置：入口各自出一个 ESM 文件到 lib/。
 *   src/index.ts        → lib/index.js        （host 半：服务 + 预览服务）
 *   src/policy.ts       → lib/policy.js       （挂在 preset 里：写边界 + export 工具）
 *   src/client.ts       → lib/client.js       （浏览器半：走 window.__ModuleLoader__，不打包 react）
 *   src/render/index.ts → lib/render/index.js （渲染器公开 API）
 *   src/render/cli.ts   → lib/render/cli.js   （命令行入口，make.mjs 转发到这里）
 *
 * 宿主的包（@deepseek-ai/*）一律 external：它们由 dsh 的运行时解析提供，不能打进包里。
 */
import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { name: string }

/** 只有浏览器半要包成闭包工厂；其余入口是 Node 半，原样输出。 */
const CLIENT_FILE = 'client.js'

/**
 * 宿主的 client 装载协议（见 HOST-CONTRACT.md「client 半」）：
 *   window.__ModuleLoader__.load({ id, factory })
 * 两条硬约束，任一条破掉桌面版就起不来：
 *
 * ① `id` 必须**逐字等于 package.json 的 name**。
 *    宿主按包名建 boot 图（client-modules 的 `graphRow(packageName, …)`），再拿
 *    包名回查这里注册的工厂；写成别的名字（例如 cordis 行 id `dsh-resume`）就
 *    是「loaded without registering」，整个 entry 挂掉。
 *
 * ② 模块体必须整个落在 factory 函数体内。
 *    产物是被当成 classic script 插进页面的：顶层 `const` 会落进**页面全局词法
 *    环境**。同一份脚本被第二次执行（immediate 预取 + Loader 导入，或 HMR 代码
 *    替换）就会 `Identifier 'X' has already been declared` —— 报错指向脚本第一行，
 *    把真正的原因（id 不匹配）遮得干干净净。
 *
 * 这两条都由 scripts/check-bundle.mjs 在 prepack 阶段复检，源码里不再手写 id。
 */
const CLIENT_BANNER = `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {`
const CLIENT_FOOTER = 'return createPlugin(require)\n} });'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/policy.ts',
    'src/client.ts',
    'src/render/index.ts',
    'src/render/cli.ts',
  ],
  outDir: 'lib',
  format: 'esm',
  platform: 'neutral',
  target: 'es2023',
  clean: true,
  dts: false,
  external: [/^@deepseek-ai\//, 'react'],
  banner: ({ fileName }) => (fileName === CLIENT_FILE ? CLIENT_BANNER : undefined),
  footer: ({ fileName }) => (fileName === CLIENT_FILE ? CLIENT_FOOTER : undefined),
})
