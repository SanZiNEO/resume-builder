/**
 * 渲染器黄金测试：渲染结果必须和当初那份 Python 实现**逐字节一致**。
 *
 * `test/golden/template-me-default.html` 是随包分发的简历项目模板（`workspace-template/`）
 * 由原 Python 渲染器生成的产物——它是这个移植唯一的独立参照物，别手改。
 *
 * 跑法（先构建）：
 *   pnpm build && pnpm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderHtml } from '../lib/render/index.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const templateRoot = path.resolve(here, '..', 'workspace-template')
const goldenDir = path.join(here, 'golden')

test('模板项目渲染结果与原 Python 版一致', async () => {
  const expected = fs.readFileSync(path.join(goldenDir, 'template-me-default.html'), 'utf8')
  const actual = await renderHtml({ root: templateRoot, person: 'me' })
  // 黄金产物是 Python 在 Windows 上写的（文本模式把 \n 变成 \r\n）。
  // 换行符差异不算差异（HTML 语义相同），其余必须逐字节一致。
  const normalize = (text) => text.replace(/\r\n/g, '\n')
  const expectedText = normalize(expected)
  const actualText = normalize(actual)
  if (actualText === expectedText) return
  const at = [...expectedText].findIndex((character, index) => character !== actualText[index])
  assert.fail(
    `输出不一致：长度 ${actualText.length} vs ${expectedText.length}，首个差异在第 ${at} 个字符\n` +
    `期望: ${JSON.stringify(expectedText.slice(Math.max(0, at - 80), at + 120))}\n` +
    `实际: ${JSON.stringify(actualText.slice(Math.max(0, at - 80), at + 120))}`,
  )
})
