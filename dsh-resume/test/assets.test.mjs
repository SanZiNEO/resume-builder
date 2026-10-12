/** 素材：图标 SVG 内联、图片转 data URI、缺文件的行为。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { iconSvg, imageDataUri, mimeType } from '../src/render/assets.ts'
import { tempProject } from './fixtures.mjs'

test('图标不存在 → null', (t) => {
  const root = tempProject(t, { 'assets/icons/.keep': '' })
  assert.equal(iconSvg(root, 'phone'), null)
})

test('图标存在 → 返回 SVG 内容（首尾空白去掉）', (t) => {
  const root = tempProject(t, { 'assets/icons/phone.svg': '<svg></svg>\n' })
  assert.equal(iconSvg(root, 'phone'), '<svg></svg>')
})

test('图标名带路径时只取文件名（不接受穿越路径）', (t) => {
  const root = tempProject(t, {
    'assets/icons/phone.svg': '<svg></svg>',
    'secret/phone.svg': '<svg>secret</svg>',
  })
  assert.equal(iconSvg(root, '../secret/phone'), '<svg></svg>')
})

test('图片 → data URI（相对项目根解析）', (t) => {
  const root = tempProject(t, { 'assets/images/demo.png': 'fake-png-bytes' })
  const uri = imageDataUri(root, 'assets/images/demo.png')

  assert.ok(uri.startsWith('data:image/png;base64,'))
  assert.ok(uri.includes('ZmFrZS1wbmctYnl0ZXM='))
})

test('图片不存在 → null', (t) => {
  const root = tempProject(t, { 'assets/images/.keep': '' })
  assert.equal(imageDataUri(root, 'assets/images/not-exist.png'), null)
})

test('未知扩展名 → application/octet-stream', (t) => {
  const root = tempProject(t, { 'assets/images/weird.xyz': 'abc' })

  assert.equal(mimeType('a.xyz'), null)
  assert.equal(imageDataUri(root, 'assets/images/weird.xyz'), 'data:application/octet-stream;base64,YWJj')
})
