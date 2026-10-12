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
import { defineConfig } from 'tsdown'

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
})
