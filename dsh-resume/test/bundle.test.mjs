/**
 * 构建产物的装载契约测试（对着 lib/client.js 跑，不是对着 src）。
 *
 * 这两个约束 TypeScript 检查不到、单测也覆盖不到，只有真跑一遍产物才看得见：
 * 注册 id 必须等于包名；模块体必须在 factory 闭包里（否则同一脚本执行两次就
 * const 重声明，把整个 web boot 带崩）。规则与理由见 scripts/check-bundle.mjs。
 *
 * 没有 lib/ 时跳过——`npm run build` 之后再跑才有意义；发版路径由 prepack 强制。
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkBundle } from '../scripts/check-bundle.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const built = existsSync(path.join(root, 'lib', 'client.js'))

test('client bundle 满足宿主装载契约', { skip: built ? false : '还没有 lib/client.js，先 npm run build' }, () => {
  assert.deepEqual(checkBundle(root), [])
})
