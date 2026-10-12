/** 行内标记：Markdown 子集 + {style:x} / {icon:x} / ![alt](path) 与转义。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { renderInline } from '../src/render/inline.ts'

test('**加粗** → strong', () => {
  assert.equal(renderInline('**重点**'), '<strong>重点</strong>')
})

test('*斜体* → em', () => {
  assert.equal(renderInline('*斜体*'), '<em>斜体</em>')
})

test('==高亮== → text-highlight', () => {
  assert.equal(renderInline('==高亮=='), '<span class="text-highlight">高亮</span>')
})

test('`代码` → code', () => {
  assert.equal(renderInline('`code`'), '<code>code</code>')
})

test('[文字](url) → 链接', () => {
  const html = renderInline('[文字](https://example.com)')
  assert.ok(html.includes('href="https://example.com"'))
  assert.ok(html.includes('class="entry-link"'))
  assert.ok(html.includes('文字'))
})

test('{style:a,b}文字{/style} → 多类名 span', () => {
  const html = renderInline('{style:accent,shadow}重点{/style}')
  assert.ok(html.includes('<span class="accent shadow">重点</span>'))
})

test('{icon:x} 走回调', () => {
  const html = renderInline('{icon:phone}', (name) => `<span class="icon icon-${name}"></span>`)
  assert.equal(html, '<span class="icon icon-phone"></span>')
})

test('![alt](path) 走回调（回调收 path 与 alt）', () => {
  const html = renderInline(
    '![示例](assets/images/demo.png)',
    null,
    (path, alt) => `<img src="${path}" alt="${alt}">`,
  )
  assert.equal(html, '<img src="assets/images/demo.png" alt="示例">')
})

test('没有回调时 {icon:x} / ![alt](path) 渲染成空', () => {
  assert.equal(renderInline('a{icon:phone}b'), 'ab')
  assert.equal(renderInline('a![示例](demo.png)b'), 'ab')
})

test('普通文本被 HTML 转义', () => {
  assert.equal(renderInline('<b>&'), '&lt;b&gt;&amp;')
})

test('引号也转义（&quot; / &#x27;）', () => {
  assert.equal(renderInline(`"a" 'b'`), '&quot;a&quot; &#x27;b&#x27;')
})

test('~~删除~~ → del', () => {
  assert.equal(renderInline('~~旧~~'), '<del>旧</del>')
})

test('匹配之外的文本原样转义，标记之间的内容不再嵌套解析', () => {
  assert.equal(renderInline('**<i>**'), '<strong>&lt;i&gt;</strong>')
})
