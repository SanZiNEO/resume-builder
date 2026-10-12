/**
 * 样式收集 — 功能样式全局加载 + YAML/行内样式引用收集与注入。
 *
 * 样式库目录结构：styles/{content-area|zone|section|item|block|field|layout}/{name}.css
 * - 功能样式（ALWAYS_CSS：头像、布局模式、固定语义文本样式）是渲染器结构依赖，全局加载
 * - YAML 任意对象通过统一 `style` 字段引用样式；行内文本通过 `{style:xxx}` 引用样式
 */

import fs from 'node:fs'
import path from 'node:path'

import { isDict, isList, pyCompare, pyRepr, readText } from './yaml.ts'

/** 渲染器结构依赖的功能样式（头像、布局模式、固定语义文本样式），必须全局加载 */
export const ALWAYS_CSS: readonly string[] = [
  'item/avatar.css',
  'layout/vertical.css',
  'layout/horizontal.css',
  'layout/grid-2.css',
  'layout/grid-3.css',
  'field/text-highlight.css',
  'field/icon.css',
  'field/inline-image.css',
]

const INLINE_STYLE_RE = /\{style:([^}]+)\}/g

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory()
  } catch {
    return false
  }
}

/**
 * 按样式名跨全部分类目录查找 CSS 文件（通用 style 字段使用）。
 *
 * default.css 是各类别的基础结构样式，由布局加载，不作为通用 style 名。
 */
export function resolveStyleFile(stylesDir: string, name: string): string | null {
  if (name === 'default') return null
  const categories = fs
    .readdirSync(stylesDir)
    .filter((entry) => isDirectory(path.join(stylesDir, entry)))
    .sort(pyCompare)
  for (const category of categories) {
    const fpath = path.join(stylesDir, category, `${name}.css`)
    if (fs.existsSync(fpath)) return fpath
  }
  return null
}

function addStyle(style: unknown, field: string, stylesDir: string, collected: Set<string>): void {
  if (typeof style !== 'string') {
    console.error(`警告: 样式引用 ${field} 中含非字符串值 ${pyRepr(style)}，已跳过`)
    return
  }
  if (!style) return
  const fpath = resolveStyleFile(stylesDir, style)
  if (!fpath) {
    console.error(`警告: 未找到样式 ${style}.css`)
    return
  }
  collected.add(fpath)
}

function scanInlineText(text: string, stylesDir: string, collected: Set<string>): void {
  for (const match of text.matchAll(INLINE_STYLE_RE)) {
    for (const raw of (match[1] ?? '').split(',')) {
      const name = raw.trim()
      if (name) addStyle(name, 'style', stylesDir, collected)
    }
  }
}

/** 递归扫描 all dict 中的统一 style 字段与行内 {style:...} 引用。 */
export function scanStyles(data: unknown, stylesDir: string, collected: Set<string>): void {
  if (!isDict(data)) return

  const style = data['style'] ?? []
  if (isList(style)) {
    for (const item of style) addStyle(item, 'style', stylesDir, collected)
  }

  for (const value of Object.values(data)) {
    if (typeof value === 'string') {
      scanInlineText(value, stylesDir, collected)
    } else if (isDict(value)) {
      scanStyles(value, stylesDir, collected)
    } else if (isList(value)) {
      for (const item of value) {
        if (typeof item === 'string') scanInlineText(item, stylesDir, collected)
        else scanStyles(item, stylesDir, collected)
      }
    }
  }
}

/** 加载渲染器依赖的功能样式（ALWAYS_CSS）；布局声明与 YAML 引用由 builder 追加 */
export function collectStyles(stylesDir: string): string {
  const lines: string[] = []
  for (const relative of ALWAYS_CSS) {
    const fpath = path.join(stylesDir, relative)
    if (!fs.existsSync(fpath)) continue
    const content = readText(fpath).trim()
    if (content) lines.push(content)
  }
  return lines.join('\n\n')
}
