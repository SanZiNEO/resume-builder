/**
 * 校验：坏 style 字段 / 坏 theme / 坏 collection _meta / 缺资源 → 各自报出问题。
 *
 * 原 pytest 是直接调 src.builder 里的 _check_* 私有函数；这里一律走公开的
 * validateProject（临时项目根），断言的是同一条用户可见行为，还能顺带证明
 * 这些检查确实接进了 validate。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { validateProject } from '../lib/render/index.js'
import { CARD_STYLE, tempProject } from './fixtures.mjs'

async function problemsOf(t, files) {
  const root = tempProject(t, { ...CARD_STYLE, ...files })
  return validateProject({ root, person: 'me' })
}

test('theme：page 不是列表 → 报错', async (t) => {
  const problems = await problemsOf(t, { 'data/me/theme.yaml': 'page: paper\n' })

  assert.equal(problems.length, 1)
  assert.ok(problems[0].includes('page 应为样式名列表'))
})

test('theme：page 是列表 → 通过', async (t) => {
  const problems = await problemsOf(t, { 'data/me/theme.yaml': 'page: [paper]\n' })

  assert.deepEqual(problems, [])
})

test('collection _meta：order 不是整数 → 报错', async (t) => {
  const problems = await problemsOf(t, {
    'data/me/internships/_meta.yaml': 'title: 实习\norder: abc\n',
  })

  assert.ok(problems.some((problem) => problem.includes('order 应为整数')))
})

test('缺图标 → 报错', async (t) => {
  const problems = await problemsOf(t, {
    'data/me/test.yaml': 'type: block\ncontent: x\nicon: not-exist-icon\n',
  })

  assert.ok(problems.some((problem) => problem.includes('找不到图标')))
})

test('缺图片 → 报错', async (t) => {
  const problems = await problemsOf(t, {
    'data/me/test.yaml': 'type: block\ncontent: x\nimage: assets/images/not-exist.png\n',
  })

  assert.ok(problems.some((problem) => problem.includes('找不到图片')))
})

test('缺样式 → 报错（文案带 .css）', async (t) => {
  const problems = await problemsOf(t, {
    'data/me/test.yaml': 'type: block\ncontent: x\nstyle: [not-exist-style]\n',
  })

  assert.ok(problems.some((problem) => problem.includes('找不到样式 not-exist-style.css')))
})

test('行内缺图标 → 报错', async (t) => {
  const problems = await problemsOf(t, {
    'data/me/test.yaml': 'type: block\ncontent: "x {icon:not-exist-icon} hi"\n',
  })

  assert.ok(problems.some((problem) => problem.includes('找不到行内图标')))
})

test('icons 列表里缺图标 → 报错', async (t) => {
  const problems = await problemsOf(t, {
    'data/me/test.yaml': 'type: block\ncontent: x\nicons: [not-exist-icon]\n',
  })

  assert.ok(problems.some((problem) => problem.includes('找不到图标')))
})

test('images 列表里缺图片 → 报错', async (t) => {
  const problems = await problemsOf(t, {
    'data/me/test.yaml': 'type: block\ncontent: x\nimages: [assets/images/not-exist.png]\n',
  })

  assert.ok(problems.some((problem) => problem.includes('找不到图片')))
})

test('style 字段不是列表 → 报错并指出类型名', async (t) => {
  const problems = await problemsOf(t, {
    'data/me/test.yaml': 'type: block\ncontent: x\nstyle: card\n',
  })

  assert.equal(problems.length, 1)
  assert.ok(problems[0].includes('style 应为列表'))
  assert.ok(problems[0].includes('当前是 str'))
})

test('style 列表里混了非字符串 → 报错并给出下标与类型名', async (t) => {
  const problems = await problemsOf(t, {
    'data/me/test.yaml': 'type: block\ncontent: x\nstyle: [card, 1]\n',
  })

  assert.equal(problems.length, 1)
  assert.ok(problems[0].includes('style[1]'))
  assert.ok(problems[0].includes('当前是 int'))
})

test('一切正常 → 没有问题', async (t) => {
  const problems = await problemsOf(t, {
    'data/me/theme.yaml': 'page: [paper]\n',
    'data/me/summary.yaml': 'type: block\ntitle: 摘要\ncontent: 你好\nstyle: [card]\n',
    'data/me/projects/_meta.yaml': 'title: Projects\norder: 10\nzone: main\nstyle: [card]\n',
    'data/me/projects/one.yaml': 'type: entry-list\nheading: 项目\nbody:\n  - 内容\n',
    'styles/theme/paper.css': '.page.paper {}',
    'assets/icons/phone.svg': '<svg></svg>',
    'assets/images/demo.png': 'abc',
  })

  assert.deepEqual(problems, [])
})
