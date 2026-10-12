/**
 * 行内文本解析 — Markdown 子集 + 自定义样式片段。
 *
 * 支持语法：
 *     **加粗**         -> <strong>
 *     *斜体*           -> <em>
 *     ==高亮==         -> <span class="text-highlight">
 *     `代码`           -> <code>
 *     [文字](url)      -> <a>
 *     ~~删除~~         -> <del>
 *     {style:name}文字{/style} -> <span class="name">
 *
 * 所有非协议文本都会进行 HTML 转义，只有匹配到的受控标签会生成 HTML。
 *
 * 与 Python `re` 的两处对齐：`.` 换成 `[^\n]`（Python 的 `.` 不匹配 \n，
 * JS 的 `.` 连 \r 也不匹配）；每次 exec 前重置 lastIndex（= `pattern.search(text, pos)`）。
 */

import { pyStr } from './yaml.ts'

export type IconHtml = (name: string) => string
export type ImageHtml = (path: string, alt: string) => string

type Kind = 'bold' | 'italic' | 'highlight' | 'code' | 'image' | 'link' | 'strike' | 'style' | 'icon'

/** 顺序即优先级：同一位置多个模式命中时，靠前的胜出。 */
const PATTERNS: ReadonlyArray<readonly [RegExp, Kind]> = [
  [/\*\*([^\n]+?)\*\*/g, 'bold'],
  [/\*([^\n]+?)\*/g, 'italic'],
  [/==([^\n]+?)==/g, 'highlight'],
  [/`([^`]+?)`/g, 'code'],
  [/!\[([^\]]*)\]\(([^)]+)\)/g, 'image'],
  [/\[([^\]]+?)\]\(([^)]+?)\)/g, 'link'],
  [/~~([^\n]+?)~~/g, 'strike'],
  [/\{style:([^}]+?)\}([^\n]*?)\{\/style\}/g, 'style'],
  [/\{icon:([^}]+?)\}/g, 'icon'],
]

/** Python 的 `html.escape(str(value))`。 */
export function esc(value: unknown): string {
  return pyStr(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

function renderMatch(
  match: RegExpExecArray,
  kind: Kind,
  iconHtml: IconHtml | null,
  imageHtml: ImageHtml | null,
): string {
  const first = match[1] ?? ''
  switch (kind) {
    case 'bold':
      return `<strong>${esc(first)}</strong>`
    case 'italic':
      return `<em>${esc(first)}</em>`
    case 'highlight':
      return `<span class="text-highlight">${esc(first)}</span>`
    case 'code':
      return `<code>${esc(first)}</code>`
    case 'image':
      return imageHtml === null ? '' : imageHtml(match[2] ?? '', first)
    case 'link':
      return `<a href="${esc(match[2] ?? '')}" target="_blank" rel="noopener" class="entry-link">${esc(first)}</a>`
    case 'strike':
      return `<del>${esc(first)}</del>`
    case 'style': {
      const names = first
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name)
        .join(' ')
      return `<span class="${esc(names)}">${esc(match[2] ?? '')}</span>`
    }
    case 'icon':
      return iconHtml === null ? '' : iconHtml(first)
    default:
      return esc(match[0])
  }
}

/**
 * 把包含行内协议的文本渲染为 HTML 片段。
 *
 * iconHtml: 可选回调，接收图标名并返回 HTML；用于行内 {icon:xxx}。
 * imageHtml: 可选回调，接收图片路径和 alt，返回 HTML；用于 ![alt](path)。
 */
export function renderInline(
  text: unknown,
  iconHtml?: IconHtml | null,
  imageHtml?: ImageHtml | null,
): string {
  if (text === null || text === undefined) return ''
  const source = pyStr(text)
  const icons = iconHtml ?? null
  const images = imageHtml ?? null
  let out = ''
  let pos = 0

  while (pos < source.length) {
    let bestMatch: RegExpExecArray | null = null
    let bestKind: Kind = 'bold'
    for (const [pattern, kind] of PATTERNS) {
      pattern.lastIndex = pos
      const found = pattern.exec(source)
      if (found && (bestMatch === null || found.index < bestMatch.index)) {
        bestMatch = found
        bestKind = kind
      }
    }

    if (bestMatch === null) {
      out += esc(source.slice(pos))
      break
    }

    out += esc(source.slice(pos, bestMatch.index))
    out += renderMatch(bestMatch, bestKind, icons, images)
    pos = bestMatch.index + bestMatch[0].length
  }

  return out
}
