/**
 * 渲染引擎 — 按内容协议把 section dict 渲染为 HTML 片段。
 *
 * Python 版把项目根写死在模块常量里；这里由调用方传 root（项目根）与 personDir
 * （data/{person}），其余保持逐函数对应。
 */

import fs from 'node:fs'
import path from 'node:path'

import { iconSvg, imageDataUri, mimeType } from './assets.ts'
import { esc, renderInline } from './inline.ts'
import { isDict, isList, pyOr, pyStr, pyTruthy, type Dict } from './yaml.ts'

/** 读取 assets/icons/{name}.svg 并内联为 span。 */
function iconHtml(root: string, name: unknown): string {
  const clean = pyStr(name).trim()
  const svg = iconSvg(root, clean)
  if (!svg) return ''
  return `<span class="icon icon-${esc(clean)}">${svg}</span>`
}

function inlineImageHtml(root: string, target: string, alt: string): string {
  const uri = imageDataUri(root, target)
  if (!uri) return ''
  return `<img src="${uri}" alt="${esc(alt)}" class="inline-image">`
}

/** 统一调用行内解析，支持 {icon:xxx} 与 ![alt](path)。 */
function inline(root: string, text: unknown): string {
  return renderInline(
    text,
    (name) => iconHtml(root, name),
    (target, alt) => inlineImageHtml(root, target, alt),
  )
}

/** 给一段 HTML 文本加前/后图标。支持单个 icon 或 icons 列表。 */
function withIcon(root: string, textHtml: string, value: unknown): string {
  if (!isDict(value)) return textHtml

  const icons = value['icons']
  if (isList(icons) && icons.length > 0) {
    const before: string[] = []
    const after: string[] = []
    for (const item of icons) {
      let name: unknown
      let position: unknown
      if (typeof item === 'string') {
        name = item
        position = value['icon_position'] ?? 'before'
      } else if (isDict(item)) {
        name = pyOr(item['name'], item['icon'])
        position = item['position'] ?? value['icon_position'] ?? 'before'
      } else {
        continue
      }
      const html = iconHtml(root, name)
      if (!html) continue
      if (position === 'after') after.push(html)
      else before.push(html)
    }
    return before.join('') + textHtml + after.join('')
  }

  const icon = value['icon']
  if (!pyTruthy(icon)) return textHtml
  const html = iconHtml(root, icon)
  if (!html) return textHtml
  if ((value['icon_position'] ?? 'before') === 'after') return textHtml + html
  return html + textHtml
}

/** 从对象形式读取 image 字段，返回 img 标签。 */
function imageHtml(root: string, value: unknown): string {
  if (!isDict(value)) return ''
  const target = pyOr(pyOr(pyOr(value['image'], value['path']), value['src']), '')
  if (!pyTruthy(target)) return ''
  const uri = imageDataUri(root, pyStr(target))
  if (!uri) return ''
  const alt = esc(value['image_alt'] ?? '')
  const width = value['image_width'] ?? ''
  const styleAttr = pyTruthy(width) ? ` style="width:${pyStr(width)}px"` : ''
  return `<img src="${uri}" alt="${alt}" class="inline-image"${styleAttr}>`
}

/** 给一段 HTML 文本加前/后图片。支持单张 image 或多张 images。 */
function withImage(root: string, textHtml: string, value: unknown): string {
  if (!isDict(value)) return textHtml

  const images = value['images']
  if (isList(images) && images.length > 0) {
    const before: string[] = []
    const after: string[] = []
    for (const item of images) {
      let part: Dict
      let position: unknown
      if (typeof item === 'string') {
        position = value['image_position'] ?? 'before'
        part = { image: item, image_position: position }
      } else if (isDict(item)) {
        part = item
        position = item['image_position'] ?? value['image_position'] ?? 'before'
      } else {
        continue
      }
      const html = imageHtml(root, part)
      if (!html) continue
      if (position === 'after') after.push(html)
      else before.push(html)
    }
    return before.join('') + textHtml + after.join('')
  }

  if (!pyTruthy(value['image'])) return textHtml
  const html = imageHtml(root, value)
  if (!html) return textHtml
  if ((value['image_position'] ?? 'before') === 'after') return textHtml + html
  return html + textHtml
}

/** 取文本：普通值直接返回；对象形式取 text 字段。 */
function text(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback
  if (isDict(value)) return pyStr(pyOr(pyOr(value['text'], fallback), ''))
  return pyStr(value)
}

/** 从对象形式中提取 style；普通字符串/列表不当作样式提取。 */
function styleOf(value: unknown): unknown {
  if (isDict(value)) return value['style']
  return null
}

/** 合并多个样式来源，支持 list / dict.style。 */
function mergeStyles(...values: unknown[]): string {
  const classes: string[] = []
  for (let value of values) {
    if (isDict(value)) value = value['style'] ?? []
    if (typeof value === 'string') value = [value]
    if (isList(value)) {
      for (const item of value) {
        if (pyTruthy(item)) classes.push(pyStr(item))
      }
    }
  }
  return [...new Set(classes)].join(' ')
}

/** 值按 Python 的可迭代语义展开（字符串按字符）。 */
function iterate(value: unknown): unknown[] {
  if (typeof value === 'string') return [...value]
  if (isList(value)) return value
  return []
}

function sectionWrapper(root: string, title: unknown, content: string, extraClass = ''): string {
  if (!content) return ''
  const cls = 'section' + (extraClass ? ` ${extraClass}` : '')
  const titleHtml = pyTruthy(title) ? `<div class="section-title">${inline(root, title)}</div>` : ''
  return `<div class="${cls}">
  ${titleHtml}
  ${content}
</div>`
}

export function renderBlock(root: string, data: Dict): string {
  const content = pyStr(data['content'] ?? '').trim()
  if (!content) return ''
  const title = data['title'] ?? ''
  const sectionClass = mergeStyles(data['style'])
  const inner = `<div class="entry"><div class="entry-body"><p class="block-text">${inline(root, content)}</p></div></div>`
  return sectionWrapper(root, title, inner, sectionClass)
}

/** 读取头像图片，返回 base64 内嵌的 img 标签 */
function avatarImg(root: string, avatarPath: string, avatarStyle: unknown, personDir: string): string {
  const fullPath = path.isAbsolute(avatarPath) ? avatarPath : path.join(personDir, avatarPath)
  if (!fs.existsSync(fullPath)) return ''
  const mime = mimeType(fullPath) ?? 'image/png'
  const b64 = fs.readFileSync(fullPath).toString('base64')
  const cls = avatarStyle ? `avatar-${pyStr(avatarStyle)}` : 'avatar-round'
  return `<img src="data:${mime};base64,${b64}" class="block-avatar ${cls}" alt="avatar">`
}

/** 有序片段渲染：parts 列表里可混排文本、图标、图片。 */
function partsHtml(root: string, value: unknown): string {
  if (!isDict(value)) return ''
  const parts = value['parts'] ?? []
  const out: string[] = []
  for (const part of iterate(parts)) {
    if (typeof part === 'string') {
      out.push(inline(root, part))
      continue
    }
    if (!isDict(part)) continue
    let html = part['text'] !== null && part['text'] !== undefined ? inline(root, part['text']) : ''
    html = withIcon(root, html, part)
    html = withImage(root, html, part)
    out.push(html)
  }
  return out.join('')
}

/** 优先使用 parts 有序片段；否则返回普通文本 HTML。 */
function contentHtml(root: string, value: unknown): string {
  if (isDict(value) && isList(value['parts'])) return partsHtml(root, value)
  return inline(root, text(value))
}

/** 渲染 item 内部的单个 block（heading + sub/tags + body） */
function renderBlockInItem(root: string, block: Dict, personDir: string): string {
  const heading = text(block['heading'])
  const meta = text(block['meta'])
  const sub = text(block['sub'])
  const link = text(block['link'])

  let tags: unknown = block['tags'] ?? []
  let tagsStyle: unknown = null
  if (isDict(tags)) {
    tagsStyle = tags['style']
    tags = tags['items'] ?? tags['text'] ?? []
  }

  const body = block['body'] ?? []
  let bodyItems: unknown = body
  let bodyStyle: unknown = null
  if (isDict(body)) {
    bodyItems = body['items'] ?? body['text'] ?? []
    bodyStyle = styleOf(body)
  }

  const layout = block['layout'] ?? 'vertical'
  const headingStyle = mergeStyles(styleOf(block['heading']))
  const metaStyle = mergeStyles(styleOf(block['meta']))
  const subStyle = mergeStyles(styleOf(block['sub']))
  const bodyClass = mergeStyles(bodyStyle)

  const parts: string[] = []
  // avatar（如果存在）
  const avatarPath = block['avatar'] ?? ''
  if (pyTruthy(avatarPath)) {
    const avatarStyle = block['avatar_style'] ?? 'round'
    const html = avatarImg(root, pyStr(avatarPath), avatarStyle, personDir)
    if (html) parts.push(`<div class="block-avatar-wrap">${html}</div>`)
  }

  // heading + link + meta（全空时跳过，支持 avatar-only block）
  const hdrCls = 'entry-title' + (headingStyle ? ` ${headingStyle}` : '')
  if (heading || link || meta) {
    const headerParts = [
      `<span class="${hdrCls}">${withIcon(root, contentHtml(root, block['heading']), block['heading'])}</span>`,
    ]
    if (link) {
      headerParts.push(
        `<span class="entry-meta"><a href="${esc(link)}" target="_blank" rel="noopener" class="entry-link">${inline(root, link)}</a></span>`,
      )
    }
    if (meta) {
      const metaCls = 'entry-meta' + (metaStyle ? ` ${metaStyle}` : '')
      headerParts.push(
        `<span class="${metaCls}">${withIcon(root, contentHtml(root, block['meta']), block['meta'])}</span>`,
      )
    }
    parts.push(`<div class="entry-header">${headerParts.join('')}</div>`)
  }

  // sub + tags
  const tagItems = iterate(tags)
  if (sub || tagItems.length > 0) {
    const subParts: string[] = []
    if (sub) subParts.push(withIcon(root, contentHtml(root, block['sub']), block['sub']))
    for (const tag of tagItems) {
      const tagStyle = mergeStyles(styleOf(tag))
      const tagSpan = `<span class="tag${tagStyle ? ` ${tagStyle}` : ''}">`
      subParts.push(`${tagSpan}${withIcon(root, contentHtml(root, tag), tag)}</span>`)
    }
    let subCls = 'entry-sub' + (subStyle ? ` ${subStyle}` : '')
    if (tagsStyle) subCls = mergeStyles(subCls, tagsStyle)
    parts.push(`<div class="${subCls}">${subParts.join(' ')}</div>`)
  }

  // body
  const bodyList = iterate(bodyItems)
  if (bodyList.length > 0) {
    const bodyCls = 'entry-body' + (bodyClass ? ` ${bodyClass}` : '')
    if (layout === 'horizontal') {
      const spans: string[] = []
      for (const item of bodyList) {
        const itemStyle = mergeStyles(styleOf(item))
        const spanCls = 'inline-item' + (itemStyle ? ` ${itemStyle}` : '')
        const itemHtml = withImage(root, withIcon(root, contentHtml(root, item), item), item)
        spans.push(`<span class="${spanCls}">${itemHtml}</span>`)
      }
      parts.push(`<div class="${bodyCls} entry-body-inline">${spans.join('\n')}</div>`)
    } else {
      const lis: string[] = []
      for (const item of bodyList) {
        const itemStyle = mergeStyles(styleOf(item))
        const itemHtml = withImage(root, withIcon(root, contentHtml(root, item), item), item)
        lis.push(itemStyle ? `<li class="${itemStyle}">${itemHtml}</li>` : `<li>${itemHtml}</li>`)
      }
      parts.push(`<div class="${bodyCls}"><ul>\n${lis.join('\n')}\n</ul></div>`)
    }
  }

  return parts.join('\n')
}

/** 每个 block 都是独立容器，可带自己的 style。 */
function blockWrapper(block: Dict, content: string): string {
  const blockStyle = mergeStyles(block['style'])
  const cls = 'block' + (blockStyle ? ` ${blockStyle}` : '')
  return `<div class="${cls}">\n${content}\n</div>`
}

function entryDiv(itemClass: string, innerHtml: string): string {
  const entryCls = 'entry' + (itemClass ? ` ${itemClass}` : '')
  return `<div class="${entryCls}">\n${innerHtml}\n</div>`
}

export function renderEntryList(
  root: string,
  data: Dict,
  entries: unknown[] | null,
  personDir: string,
): string {
  let list = entries ?? iterate(data['items'] ?? [])
  if (list.length === 0) {
    const heading = data['heading'] ?? ''
    if (!heading) return ''
    list = [data]
  }

  const title = data['title'] ?? ''
  const sectionClass = mergeStyles(data['style'])
  const itemsHtml: string[] = []

  for (const item of list) {
    if (!isDict(item)) continue
    let itemClass = mergeStyles(item['style'])
    const blocks = item['blocks'] ?? null
    const layout = item['layout'] ?? ''

    // avatar-only item（无 heading/body，仅头像）
    const avatarPath = item['avatar'] ?? ''
    if (pyTruthy(avatarPath) && !pyTruthy(blocks) && !pyTruthy(item['heading'])) {
      const avatarStyle = item['avatar_style'] ?? 'round'
      const html = avatarImg(root, pyStr(avatarPath), avatarStyle, personDir)
      const innerHtml = `<div class="block-avatar-wrap">${html}</div>`
      itemClass = mergeStyles(itemClass, 'entry-avatar')
      itemsHtml.push(entryDiv(itemClass, innerHtml))
      continue
    }

    let innerHtml: string
    if (pyTruthy(blocks)) {
      const blockList = iterate(blocks).filter(isDict)
      if (layout === 'grid-2' || layout === 'grid-3') {
        const cells: string[] = []
        for (const block of blockList) {
          const cellContent = blockWrapper(block, renderBlockInItem(root, block, personDir))
          cells.push(`<div class="grid-cell">\n${cellContent}\n</div>`)
        }
        innerHtml = cells.join('\n')
        itemClass = mergeStyles(itemClass, layout)
      } else {
        innerHtml = blockList
          .map((block) => blockWrapper(block, renderBlockInItem(root, block, personDir)))
          .join('\n')
      }
    } else {
      innerHtml = renderBlockInItem(root, item, personDir)
    }
    itemsHtml.push(entryDiv(itemClass, innerHtml))
  }

  let inner = itemsHtml.join('\n')
  if (sectionClass.includes('skills-grid')) {
    inner = `<div class="card-wrap">\n${inner}\n</div>`
  }
  return sectionWrapper(root, title, inner, sectionClass)
}

export function renderGroupedList(root: string, data: Dict): string {
  const groups = data['groups'] ?? []
  if (!pyTruthy(groups)) return ''
  const items: string[] = []
  for (const group of iterate(groups)) {
    if (!isDict(group)) continue
    const name = group['name'] ?? ''
    const itemList = group['items'] ?? []
    const joined = iterate(itemList)
      .map((entry) => inline(root, entry))
      .join(' / ')
    items.push(`<span class="item"><strong>${inline(root, name)}：</strong>${joined}</span>`)
  }
  const inner = items.length > 0 ? `<div class="skills-wrap">${items.join(' ')}</div>` : ''
  const title = data['title'] ?? ''
  const sectionClass = mergeStyles(data['style'])
  return sectionWrapper(root, title, inner, sectionClass)
}

export function renderSection(root: string, data: Dict, personDir: string): string {
  const sectionType = data['type'] ?? 'block'
  if (sectionType === 'block') return renderBlock(root, data)
  if (sectionType === 'entry-list') return renderEntryList(root, data, null, personDir)
  if (sectionType === 'grouped-list') return renderGroupedList(root, data)
  console.log(`警告: 未知の section type “${pyStr(sectionType)}”`)
  return ''
}
