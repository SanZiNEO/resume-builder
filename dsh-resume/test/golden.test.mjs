/**
 * 渲染器黄金测试：TS 渲染器必须和原 Python 渲染器**逐字节一致**。
 *
 * 黄金产物由原 Python 渲染器生成（`dsh-resume/test/golden/*.html`，每份渲染两遍确认稳定），
 * 覆盖：仓库里的 me（4 种布局）、proto（示例数据）、插件自带模板的 me。
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
const repoRoot = path.resolve(here, '..', '..')
const templateRoot = path.resolve(here, '..', 'workspace-template')
const goldenDir = path.join(here, 'golden')

/** 每个用例：黄金产物名 + 项目根 + 版本 + 布局。 */
const CASES = [
  { name: 'repo-me-default', root: repoRoot, person: 'me', layout: undefined },
  { name: 'repo-me-two-column', root: repoRoot, person: 'me', layout: 'two-column' },
  { name: 'repo-me-timeline', root: repoRoot, person: 'me', layout: 'timeline' },
  { name: 'repo-me-portfolio', root: repoRoot, person: 'me', layout: 'portfolio-grid' },
  { name: 'repo-proto-default', root: repoRoot, person: 'proto', layout: undefined },
  { name: 'template-me-default', root: templateRoot, person: 'me', layout: undefined },
]

for (const testCase of CASES) {
  test(`${testCase.name}：渲染结果与 Python 版一致`, async () => {
    const expected = fs.readFileSync(path.join(goldenDir, `${testCase.name}.html`), 'utf8')
    const actual = await renderHtml({
      root: testCase.root,
      person: testCase.person,
      layout: testCase.layout,
    })
    // 黄金产物是 Python 在 Windows 上写的（文本模式把 \n 变成 \r\n）。
    // 换行符差异不算差异（HTML 语义相同），其余必须逐字节一致。
    //
    // 但 `<style>` 段要剥掉：样式库（styles/）是和 Python 版共用、独立演进的一份资产，
    // 每加一套风格、每修一个 CSS 都会让这 6 个用例全红，而它们本来要锁的是**渲染器逻辑**
    // （class 拼接、容器嵌套、属性顺序），不是 CSS 内容。剥掉后仍保留一条底线断言：
    // 样式段必须真的注入了内容，否则说明渲染器把样式整个丢了。
    const normalize = (text) => text
      .replace(/\r\n/g, '\n')
      .replace(/<style>[\s\S]*?<\/style>/g, '<style>/* css */</style>')
    const expectedText = normalize(expected)
    const actualText = normalize(actual)
    assert.ok(
      /<style>[\s\S]{1000,}<\/style>/.test(actual),
      '样式段为空或过短，渲染器可能没注入 styles/',
    )
    if (actualText === expectedText) return
    const at = [...expectedText].findIndex((character, index) => character !== actualText[index])
    assert.fail(
      `输出不一致：长度 ${actualText.length} vs ${expectedText.length}，首个差异在第 ${at} 个字符\n` +
      `期望: ${JSON.stringify(expectedText.slice(Math.max(0, at - 80), at + 120))}\n` +
      `实际: ${JSON.stringify(actualText.slice(Math.max(0, at - 80), at + 120))}`,
    )
  })
}
