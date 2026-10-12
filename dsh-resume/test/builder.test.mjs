/** builder：板块发现（顺序、collection、reference 截断、占位符注入）与版本目录列举。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'

import { discoverSections, listPersons } from '../src/render/builder.ts'
import { tempProject } from './fixtures.mjs'

function discover(root, variables) {
  return discoverSections(path.join(root, 'data', 'me'), variables)
}

test('theme.yaml 不算板块，其它 yaml 都算', (t) => {
  const root = tempProject(t, {
    'data/me/theme.yaml': 'page: [paper]\n',
    'data/me/summary.yaml': 'type: block\ncontent: 你好\n',
  })

  const sections = discover(root)
  assert.equal(sections.has('theme.yaml'), false)
  assert.equal(sections.has('summary.yaml'), true)
})

test('板块顺序：先按文件名排 yaml，再按目录名排 collection', (t) => {
  const root = tempProject(t, {
    'data/me/b.yaml': 'type: block\ncontent: b\n',
    'data/me/a.yaml': 'type: block\ncontent: a\n',
    'data/me/theme.yaml': 'page: [paper]\n',
    'data/me/zzz/one.yaml': 'type: entry-list\nheading: Z\n',
    'data/me/aaa/one.yaml': 'type: entry-list\nheading: A\n',
  })

  assert.deepEqual([...discover(root).keys()], [
    'a.yaml',
    'b.yaml',
    '__collection_aaa',
    '__collection_zzz',
  ])
})

test('collection：_meta.yaml 的 title/order/zone/style 生效，条目取 heading', (t) => {
  const root = tempProject(t, {
    'data/me/projects/_meta.yaml': 'title: Projects\norder: 50\nzone: main\nstyle: [card]\n',
    'data/me/projects/a.yaml': 'type: entry-list\nheading: 项目A\nbody:\n  - 内容\n',
  })

  const section = discover(root).get('__collection_projects')
  assert.equal(section.title, 'Projects')
  assert.equal(section.order, 50)
  assert.equal(section.zone, 'main')
  assert.deepEqual(section.style, ['card'])
  assert.equal(section.items.length, 1)
  assert.equal(section.items[0].heading, '项目A')
})

test('collection：没有 _meta.yaml 时用目录名与缺省值', (t) => {
  const root = tempProject(t, {
    'data/me/work/a.yaml': 'type: entry-list\nheading: 工作A\n',
  })

  const section = discover(root).get('__collection_work')
  assert.equal(section.title, 'work')
  assert.equal(section.order, 100)
  assert.equal(section.zone, 'main')
  assert.deepEqual(section.style, [])
})

test('collection：条目按 order 排（缺省 999），同序按文件名', (t) => {
  const root = tempProject(t, {
    'data/me/projects/b.yaml': 'type: entry-list\nheading: B\norder: 2\n',
    'data/me/projects/a.yaml': 'type: entry-list\nheading: A\norder: 1\n',
    'data/me/projects/c.yaml': 'type: entry-list\nheading: C\n',
    'data/me/projects/d.yaml': 'type: entry-list\nheading: D\n',
  })

  const section = discover(root).get('__collection_projects')
  assert.deepEqual(
    section.items.map((item) => item.heading),
    ['A', 'B', 'C', 'D'],
  )
})

test('collection：条目有 items 时展开 items，没有 items 才把文件本身当条目', (t) => {
  const root = tempProject(t, {
    'data/me/projects/one.yaml': 'type: entry-list\nitems:\n  - heading: 一\n  - heading: 二\n',
    'data/me/projects/two.yaml': 'type: entry-list\nheading: 三\n',
  })

  const section = discover(root).get('__collection_projects')
  assert.deepEqual(
    section.items.map((item) => item.heading),
    ['一', '二', '三'],
  )
})

test('reference: 区块整段截断，不参与解析', (t) => {
  const root = tempProject(t, {
    'data/me/summary.yaml':
      'type: block\ncontent: 你好\n\nreference:\n  secret: 不该出现\n  nested:\n    deep: 1\n',
  })

  const section = discover(root).get('summary.yaml')
  assert.equal(section.content, '你好')
  assert.equal('reference' in section, false)
  assert.equal('secret' in section, false)
})

test('personal.yaml 的 ${KEY} 由传入的变量注入，缺的保留原文', (t) => {
  const root = tempProject(t, {
    'data/me/personal.yaml':
      'type: entry-list\ntitle: ${NAME}\nitems:\n  - heading: ${PHONE}\n',
  })

  const section = discover(root, { NAME: '张三' }).get('personal.yaml')
  assert.equal(section.title, '张三')
  assert.equal(section.items[0].heading, '${PHONE}')
})

test('listPersons 列出版本目录，跳过 _ 开头的', async (t) => {
  const root = tempProject(t, {
    'data/me/a.yaml': 'type: block\ncontent: a\n',
    'data/proto/a.yaml': 'type: block\ncontent: a\n',
    'data/_draft/a.yaml': 'type: block\ncontent: a\n',
    'data/loose.yaml': 'type: block\ncontent: a\n',
  })

  assert.deepEqual(await listPersons(root), ['me', 'proto'])
})

test('写进 collection 的条目保持文件里的插入顺序（不排序字段）', (t) => {
  const root = tempProject(t, {
    'data/me/projects/one.yaml': 'type: entry-list\nheading: 一\nmeta: 先\nsub: 后\n',
  })

  const section = discover(root).get('__collection_projects')
  assert.deepEqual(Object.keys(section.items[0]), ['type', 'heading', 'meta', 'sub'])
})

test('collection 目录里凑不出条目时不产出板块', (t) => {
  const root = tempProject(t, {
    // 只有 _meta.yaml：没有条目文件
    'data/me/projects/_meta.yaml': 'title: Projects\n',
    // 有条目文件，但它既没有 items 也没有 heading
    'data/me/work/_meta.yaml': 'title: Work\n',
    'data/me/work/draft.yaml': 'type: block\ncontent: 不算条目\n',
  })

  assert.deepEqual([...discover(root).keys()], [])
})
