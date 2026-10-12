/** 样式收集：按名跨类别解析、扫描 YAML 引用、功能样式（ALWAYS_CSS）的加载顺序。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'

import { ALWAYS_CSS, collectStyles, resolveStyleFile, scanStyles } from '../src/render/styles.ts'
import { tempProject } from './fixtures.mjs'

test('扫描：统一 style 字段与行内 {style:x} 都收进来', (t) => {
  const root = tempProject(t, {
    'styles/section/card.css': '.section.card {}',
    'styles/field/accent.css': '.accent {}',
  })

  const data = { style: ['card'], body: ['普通 {style:accent} 高亮'] }
  const collected = new Set()
  scanStyles(data, path.join(root, 'styles'), collected)
  assert.equal(collected.size, 2)
})

test('扫描：非字符串值被跳过，不抛异常', (t) => {
  // 空的 styles/：card 也解析不到，所以收集结果是 0；整数 1 直接跳过（只打警告）
  const root = tempProject(t, { 'styles/section/.keep': '' })

  const collected = new Set()
  scanStyles({ style: ['card', 1] }, path.join(root, 'styles'), collected)
  assert.equal(collected.size, 0)
})

test('按名解析：跨类别找 styles/<类别>/<名字>.css', (t) => {
  const root = tempProject(t, {
    'styles/section/card.css': '.section.card {}',
    'styles/field/accent.css': '.accent {}',
  })
  const stylesDir = path.join(root, 'styles')

  assert.equal(resolveStyleFile(stylesDir, 'card'), path.join(stylesDir, 'section', 'card.css'))
  assert.equal(resolveStyleFile(stylesDir, 'accent'), path.join(stylesDir, 'field', 'accent.css'))
})

test('按名解析：default 不当通用样式名，找不到的返回 null', (t) => {
  const root = tempProject(t, { 'styles/section/default.css': '.section {}' })
  const stylesDir = path.join(root, 'styles')

  assert.equal(resolveStyleFile(stylesDir, 'default'), null)
  assert.equal(resolveStyleFile(stylesDir, 'nope'), null)
})

test('按名解析：多个类别都有同名文件时按类别名字典序取第一个', (t) => {
  const root = tempProject(t, {
    'styles/block/same.css': '.block {}',
    'styles/section/same.css': '.section {}',
  })
  const stylesDir = path.join(root, 'styles')

  assert.equal(resolveStyleFile(stylesDir, 'same'), path.join(stylesDir, 'block', 'same.css'))
})

test('功能样式按 ALWAYS_CSS 顺序拼接，缺的跳过', (t) => {
  const root = tempProject(t, {
    'styles/item/avatar.css': 'AVATAR',
    'styles/layout/vertical.css': 'VERTICAL',
    'styles/field/icon.css': 'ICON',
    'styles/field/inline-image.css': 'INLINE',
  })
  const stylesDir = path.join(root, 'styles')

  assert.deepEqual(ALWAYS_CSS, [
    'item/avatar.css',
    'layout/vertical.css',
    'layout/horizontal.css',
    'layout/grid-2.css',
    'layout/grid-3.css',
    'field/text-highlight.css',
    'field/icon.css',
    'field/inline-image.css',
  ])
  assert.equal(collectStyles(stylesDir), 'AVATAR\n\nVERTICAL\n\nICON\n\nINLINE')
})
