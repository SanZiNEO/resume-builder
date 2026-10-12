/** 渲染器：block / entry-list / grouped-list 的字段、样式类、图标与图片内联、转义。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { renderBlock, renderEntryList, renderGroupedList } from '../src/render/renderer.ts'
import { tempProject } from './fixtures.mjs'

test('renderBlock：内容转义，section 带样式类', (t) => {
  const root = tempProject(t)

  const html = renderBlock(root, {
    type: 'block',
    title: '摘要',
    style: ['underline-title'],
    content: '<b>内容</b>',
  })
  assert.ok(html.includes('&lt;b&gt;内容&lt;/b&gt;'))
  assert.ok(html.includes('section underline-title'))
})

test('renderEntryList：item/block/heading/body 的样式类都落到对应标签上', (t) => {
  const root = tempProject(t)

  const html = renderEntryList(
    root,
    {
      type: 'entry-list',
      style: ['underline-title'],
      title: '教育',
      items: [
        {
          style: ['card'],
          blocks: [
            {
              style: ['panel'],
              heading: { text: '标题', style: ['large-heading'] },
              body: { items: ['条目A', '条目B'], style: ['dot-list'] },
            },
          ],
        },
      ],
    },
    null,
    root,
  )

  assert.ok(html.includes('class="section underline-title"'))
  assert.ok(html.includes('class="entry card"'))
  assert.ok(html.includes('class="block panel"'))
  assert.ok(html.includes('class="entry-title large-heading"'))
  assert.ok(html.includes('class="entry-body dot-list"'))
  assert.ok(html.includes('<li>条目A</li>'))
  assert.ok(html.includes('<li>条目B</li>'))
})

test('renderEntryList：body 里的行内标记照常渲染', (t) => {
  const root = tempProject(t)

  const html = renderEntryList(
    root,
    {
      type: 'entry-list',
      items: [{ blocks: [{ body: { items: ['**加粗** ==高亮=='] } }] }],
    },
    null,
    root,
  )

  assert.ok(html.includes('<strong>加粗</strong>'))
  assert.ok(html.includes('<span class="text-highlight">高亮</span>'))
})

test('renderEntryList：heading/body 的 icon 字段内联 assets/icons/*.svg', (t) => {
  const root = tempProject(t, {
    'assets/icons/phone.svg': '<svg></svg>',
    'assets/icons/mail.svg': '<svg></svg>',
  })

  const html = renderEntryList(
    root,
    {
      type: 'entry-list',
      items: [
        {
          blocks: [
            {
              heading: { text: '联系方式', icon: 'phone' },
              body: { items: [{ text: '邮箱', icon: 'mail' }] },
            },
          ],
        },
      ],
    },
    null,
    root,
  )

  assert.ok(html.includes('<span class="icon icon-phone"><svg></svg></span>'))
  assert.ok(html.includes('<span class="icon icon-mail"><svg></svg></span>'))
})

test('renderEntryList：缺图标时只输出文本，不留空 span', (t) => {
  const root = tempProject(t)

  const html = renderEntryList(
    root,
    { type: 'entry-list', items: [{ blocks: [{ heading: { text: '标题', icon: 'nope' } }] }] },
    null,
    root,
  )

  assert.ok(html.includes('>标题</span>'))
  assert.equal(html.includes('class="icon'), false)
})

test('renderEntryList：image 字段把图片内联成 data URI', (t) => {
  const root = tempProject(t, { 'assets/images/demo.png': 'abc' })

  const html = renderEntryList(
    root,
    {
      type: 'entry-list',
      items: [{ blocks: [{ body: { items: [{ text: '截图', image: 'assets/images/demo.png' }] } }] }],
    },
    null,
    root,
  )

  assert.ok(html.includes('<img src="data:image/png;base64,YWJj" alt="" class="inline-image">'))
})

test('renderGroupedList：组名转义，条目用 " / " 连接', (t) => {
  const root = tempProject(t)

  const html = renderGroupedList(root, {
    type: 'grouped-list',
    title: '技能',
    groups: [{ name: '<语言>', items: ['Python', 'Java'] }],
  })

  assert.ok(html.includes('&lt;语言&gt;'))
  assert.ok(html.includes('Python'))
  assert.ok(html.includes('Python / Java'))
})

test('renderGroupedList：没有 groups 时返回空串', (t) => {
  const root = tempProject(t)
  assert.equal(renderGroupedList(root, { type: 'grouped-list', title: '技能' }), '')
})
