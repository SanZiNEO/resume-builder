/**
 * 构建编排 — section 发现、build / validate。
 *
 * build():    YAML → HTML（读布局 → zone 发现 → 样式三级注入 → zone 分组注入 → 写文件）
 * validate(): 校验 data/{person} 下所有 YAML 结构与类型
 *
 * Python 版把项目根写死在模块常量 BASE 里，这里一律由调用方传 root。
 * Python 的 `dict.get(key, default)` 只在键不存在时用默认值，JS 的 `??` 在值为
 * null 时也会用默认值——两者只在「键写了但值为空」时不同，属于畸形数据，不特意区分。
 */

import fs from 'node:fs'
import path from 'node:path'

import { renderSection } from './renderer.ts'
import { collectStyles, resolveStyleFile, scanStyles } from './styles.ts'
import { injectVars, isDict, isList, parseYaml, pyCompare, pyRepr, pyStr, pyTruthy, pyTypeName, readText, readYaml, type Dict } from './yaml.ts'

/** validate 认得的 section 类型（对应 Python 的 `_VALID_TYPES`）。 */
const VALID_TYPES = new Set(['block', 'entry-list', 'grouped-list'])

/** Python `str.replace`：全部替换，且不解释 `$&` 之类的替换模式。 */
function replaceAllLiteral(text: string, search: string, replacement: string): string {
  return text.split(search).join(replacement);
}

/** Python `isinstance(v, int)`（bool 是 int 的子类）。 */
function isPyInt(value: unknown): boolean {
  return typeof value === 'boolean' || (typeof value === 'number' && Number.isInteger(value))
}

/** data/ 下的版本目录（Python 的 `os.listdir` + `isdir`，不排序前的原始集合）。 */
function personDirs(root: string): string[] {
  const dataDir = path.join(root, 'data')
  return fs
    .readdirSync(dataDir)
    .filter((entry) => isDirectory(path.join(dataDir, entry)))
    .sort(pyCompare)
}

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory()
  } catch {
    return false
  }
}

/** 列出 data/ 下的版本目录（跳过 _ 开头）。 */
export function listPersons(root: string): string[] {
  return personDirs(root).filter((name) => !name.startsWith('_'))
}

/** Python `glob.glob(dir/*.yaml)`：只匹配 .yaml，且不含以 . 开头的名字。 */
function yamlFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((entry) => entry.endsWith('.yaml') && !entry.startsWith('.'))
    .sort(pyCompare)
    .map((entry) => path.join(dir, entry))
}

/** 目录下的子目录名（Python `sorted(os.listdir(...))` + `isdir`）。 */
function subdirs(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((entry) => isDirectory(path.join(dir, entry)))
    .sort(pyCompare)
}

/** 按 (order, 文件路径) 排序；order 同 Python 元组比较，先比 order 再比路径。 */
function compareOrder(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return pyCompare(pyStr(a), pyStr(b))
}

export function discoverSections(
  personDir: string,
  variables?: Record<string, string | undefined> | undefined,
): Map<string, Dict> {
  const sections = new Map<string, Dict>()
  for (const file of yamlFiles(personDir)) {
    const name = path.basename(file)
    if (name === 'theme.yaml') continue // 全局主题配置，不当作 section
    // 私有文件 personal.yaml：解析前注入环境变量占位符（AI 只见过占位符）
    const data =
      name === 'personal.yaml'
        ? parseYaml(injectVars(readText(file), variables))
        : readYaml(file)
    delete data['reference']
    sections.set(name, data)
  }

  // 通用 collection：任一子目录都自动成为一个板块（文件夹 = 板块，文件 = 条目）
  for (const subdir of subdirs(personDir)) {
    const dirPath = path.join(personDir, subdir)
    const metaPath = path.join(dirPath, '_meta.yaml')
    const rawMeta: Dict = fs.existsSync(metaPath) ? readYaml(metaPath) : {}
    const meta: Dict = isDict(rawMeta) ? rawMeta : {}

    const files = yamlFiles(dirPath).filter((file) => path.basename(file) !== '_meta.yaml')
    if (files.length === 0) continue

    const loaded = files.map((file) => {
      const data = readYaml(file)
      delete data['reference']
      // 条目排序由文件内 order 字段决定（缺省 999），文件名仅作同序稳定键
      return { order: data['order'] ?? 999, file, data }
    })
    loaded.sort((a, b) => compareOrder(a.order, b.order) || pyCompare(a.file, b.file))

    const entries: unknown[] = []
    for (const item of loaded) {
      const items = item.data['items'] ?? []
      if (pyTruthy(items)) entries.push(...(isList(items) ? items : []))
      else if (pyTruthy(item.data['heading'])) entries.push(item.data)
    }
    if (entries.length === 0) continue

    const style = meta['style'] ?? []
    sections.set(`__collection_${subdir}`, {
      type: 'entry-list',
      title: meta['title'] ?? subdir,
      order: meta['order'] ?? 100,
      zone: meta['zone'] ?? 'main',
      style: isList(style) ? style : [],
      items: entries,
    })
  }
  return sections
}

/** 读取 theme.yaml；没有则返回空字典。 */
function readTheme(personDir: string): Dict {
  const file = path.join(personDir, 'theme.yaml')
  if (!fs.existsSync(file)) return {}
  const data = readYaml(file)
  if (!isDict(data)) return {}
  if (isDict(data['theme'])) return data['theme']
  return data
}

function themeClasses(theme: Dict, key: string): string {
  const value = theme[key] ?? []
  if (!isList(value)) return ''
  return value.filter((item) => item).map((item) => pyStr(item)).join(' ')
}

/** 把 theme.yaml 引用的背景主题 CSS 合并进 all_css。 */
function loadThemeStyles(theme: Dict, stylesDir: string, allCss: string): string {
  let css = allCss
  for (const key of ['page', 'sidebar', 'main']) {
    const value = theme[key] ?? []
    if (!isList(value)) continue
    for (const name of value) {
      if (typeof name !== 'string' || !name) continue
      const fpath = resolveStyleFile(stylesDir, name)
      if (!fpath) {
        console.error(`警告: 未找到主题样式 ${name}.css`)
        continue
      }
      const content = readText(fpath).trim()
      if (content) css = `${css}\n\n${content}`
    }
  }
  return css
}

export interface BuildOptions {
  /** 项目根目录（含 data/ styles/ layouts/ assets/）。 */
  readonly root: string
  /** 版本目录名（data/ 下的子目录）。 */
  readonly person: string
  /** 布局名（layouts/<name>.html），缺省 default。 */
  readonly layout?: string | undefined
  /** 占位符变量（${NAME} 等）；缺省用 process.env。 */
  readonly variables?: Record<string, string> | undefined
  /** 输出目录；给了就写文件（文件名 {person}-{时间戳}.html）。 */
  readonly outputDir?: string | undefined
}

export interface BuildResult {
  readonly html: string
  /** 写出的 HTML 路径；没给 outputDir 时为 null。 */
  readonly path: string | null
}

/** 构建简历 HTML；布局或人物不存在时返回 null（并像 Python 那样打印人物库）。 */
export function build(options: BuildOptions): BuildResult | null {
  const { root } = options
  const person = options.person
  const layoutName = options.layout ?? 'default'
  const persons = personDirs(root)
  if (!persons.includes(person)) {
    console.log(`人物库: ${persons.join(', ')}`)
    return null
  }

  const outputDir = options.outputDir ?? path.join(root, 'output')
  fs.mkdirSync(outputDir, { recursive: true })
  const personDir = path.join(root, 'data', person)

  const layoutPath = path.join(root, 'layouts', `${layoutName}.html`)
  if (!fs.existsSync(layoutPath)) return null

  // ── 加载数据 ──
  const sectionsData = discoverSections(personDir, options.variables)

  // ── 读取布局 ──
  let layoutHtml = readText(layoutPath)

  // ── 发现布局中的 zone 占位符 ──
  const zonePattern = /\{zone:([\p{L}\p{N}_]+)\}/gu
  let zonesInLayout = [...layoutHtml.matchAll(zonePattern)].map((match) => match[1] ?? '')
  if (zonesInLayout.length === 0) zonesInLayout = ['main']

  // ── 收集并注入样式（按覆盖优先级排序） ──
  const stylesDir = path.join(root, 'styles')

  // 1. 默认样式
  let allCss = collectStyles(stylesDir)

  // 2. 布局声明的额外样式（`<!-- styles: path/to/file.css -->`）
  const layoutStyles = [...layoutHtml.matchAll(/<!--\s*styles:\s*([^\n]+?)\s*-->/gu)]
  for (const match of layoutStyles) {
    for (const raw of (match[1] ?? '').split(',')) {
      const ref = raw.trim()
      if (!ref) continue
      const sf = path.isAbsolute(ref) ? ref : path.join(stylesDir, ref)
      if (fs.existsSync(sf)) {
        const content = readText(sf).trim()
        if (content) allCss = `${allCss}\n\n${content}`
      } else {
        console.error(`警告: 未找到布局样式 ${ref}`)
      }
    }
  }

  // 3. YAML 自定义样式（最优先）
  const extraSet = new Set<string>()
  for (const data of sectionsData.values()) scanStyles(data, stylesDir, extraSet)
  for (const extraFile of [...extraSet].sort(pyCompare)) {
    if (!fs.existsSync(extraFile)) continue
    const content = readText(extraFile).trim()
    if (content) allCss = `${allCss}\n\n${content}`
  }

  // 4. 全局主题背景（theme.yaml）
  const theme = readTheme(personDir)
  allCss = loadThemeStyles(theme, stylesDir, allCss)
  const pageClass = themeClasses(theme, 'page')
  const sidebarClass = themeClasses(theme, 'sidebar')
  const mainClass = themeClasses(theme, 'main')

  layoutHtml = replaceAllLiteral(layoutHtml, '{styles}', allCss)

  // ── 按 zone 分组并排序（按 YAML 的 order 字段）──
  const zoneItems = new Map<string, Array<{ order: unknown; html: string }>>()
  for (const zone of zonesInLayout) {
    if (!zoneItems.has(zone)) zoneItems.set(zone, [])
  }
  for (const data of sectionsData.values()) {
    let zone = pyStr(data['zone'] ?? 'main')
    if (!zoneItems.has(zone)) zone = 'main'
    const order = data['order'] ?? 999
    const html = renderSection(root, data, personDir)
    zoneItems.get(zone)?.push({ order, html })
  }

  // ── 注入 zone ──
  for (const zone of zonesInLayout) {
    const items = [...(zoneItems.get(zone) ?? [])]
    items.sort((a, b) => compareOrder(a.order, b.order))
    const content = items
      .filter((item) => item.html)
      .map((item) => item.html)
      .join('\n')
    layoutHtml = replaceAllLiteral(layoutHtml, `{zone:${zone}}`, content)
  }

  layoutHtml = layoutHtml.replace(/\{zone:[\p{L}\p{N}_]+\}/gu, '')

  // ── 清理布局声明注释 ──
  layoutHtml = layoutHtml.replace(/<!--\s*styles:\s*[^\n]+?\s*-->\n?/gu, '')

  // ── 页面标题 ──
  let pageTitle = 'Resume'
  for (const name of [...sectionsData.keys()].sort(pyCompare)) {
    const data = sectionsData.get(name)
    if (!data) continue
    const items = data['items'] ?? []
    for (const item of isList(items) ? items : []) {
      let heading: unknown = isDict(item) ? (item['heading'] ?? '') : ''
      if (isDict(heading)) heading = heading['text'] ?? ''
      if (pyTruthy(heading)) {
        pageTitle = pyStr(heading)
        break
      }
    }
    if (pageTitle !== 'Resume') break
  }

  layoutHtml = replaceAllLiteral(layoutHtml, '{title}', pageTitle)
  layoutHtml = replaceAllLiteral(layoutHtml, '{page_class}', pageClass)
  layoutHtml = replaceAllLiteral(layoutHtml, '{sidebar_class}', sidebarClass)
  layoutHtml = replaceAllLiteral(layoutHtml, '{main_class}', mainClass)

  if (options.outputDir === undefined) return { html: layoutHtml, path: null }

  const stamp = formatTimestamp(new Date())
  const outputPath = path.join(outputDir, `${person}-${stamp}.html`)
  fs.writeFileSync(outputPath, layoutHtml, 'utf8')

  return { html: layoutHtml, path: outputPath }
}

/** `%Y%m%d-%H%M%S`（本地时间）：产物目录与文件名都用它。 */
export function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `${day}-${time}`
}

/** 递归检查统一 style 字段必须为字符串列表。 */
function checkStyleFields(data: Dict, rel: string, problems: string[]): void {
  if (Object.hasOwn(data, 'style')) {
    const value = data['style']
    if (!isList(value)) {
      problems.push(`${rel}: style 应为列表格式（如 [card, shadow]），当前是 ${pyTypeName(value)}`)
    } else {
      value.forEach((style, index) => {
        if (typeof style !== 'string') {
          problems.push(`${rel}: style[${index}] 应为字符串，当前是 ${pyTypeName(style)}`)
        }
      })
    }
  }
  for (const value of Object.values(data)) {
    if (isDict(value)) checkStyleFields(value, rel, problems)
    else if (isList(value)) {
      for (const item of value) {
        if (isDict(item)) checkStyleFields(item, rel, problems)
      }
    }
  }
}

/** 校验 theme.yaml 的 page/sidebar/main 字段。 */
function checkTheme(root: string, themePath: string, problems: string[]): void {
  if (!fs.existsSync(themePath)) return
  let data = readYaml(themePath)
  if (isDict(data['theme'])) data = data['theme']
  const rel = path.relative(root, themePath)
  for (const key of ['page', 'sidebar', 'main']) {
    if (!Object.hasOwn(data, key)) continue
    const value = data[key]
    if (!isList(value)) {
      problems.push(`${rel}: ${key} 应为样式名列表（如 [paper]）`)
      continue
    }
    value.forEach((item, index) => {
      if (typeof item !== 'string') problems.push(`${rel}: ${key}[${index}] 应为字符串`)
    })
  }
}

/** 校验 collection 的 _meta.yaml 字段类型。 */
function checkCollectionMeta(root: string, metaPath: string, problems: string[]): void {
  if (!fs.existsSync(metaPath)) return
  const rel = path.relative(root, metaPath)
  const data = readYaml(metaPath)
  if (Object.hasOwn(data, 'title') && typeof data['title'] !== 'string') {
    problems.push(`${rel}: title 应为字符串`)
  }
  if (Object.hasOwn(data, 'order') && !isPyInt(data['order'])) {
    problems.push(`${rel}: order 应为整数`)
  }
  if (Object.hasOwn(data, 'zone') && typeof data['zone'] !== 'string') {
    problems.push(`${rel}: zone 应为字符串`)
  }
  const style = data['style']
  if (style !== null && style !== undefined) {
    if (!isList(style)) {
      problems.push(`${rel}: style 应为列表`)
    } else {
      style.forEach((item, index) => {
        if (typeof item !== 'string') problems.push(`${rel}: style[${index}] 应为字符串`)
      })
    }
  }
}

/** 递归校验 icon/image 字段、行内 {icon:xxx} / {style:xxx} 引用是否存在。 */
function checkAssetRefs(
  data: Dict,
  rel: string,
  root: string,
  stylesDir: string,
  problems: string[],
): void {
  const iconsDir = path.join(root, 'assets', 'icons')

  const icon = data['icon']
  if (typeof icon === 'string' && icon) {
    if (!fs.existsSync(path.join(iconsDir, `${icon}.svg`))) {
      problems.push(`${rel}: 找不到图标 assets/icons/${icon}.svg`)
    }
  }

  const icons = data['icons']
  if (isList(icons)) {
    for (const item of icons) {
      let name: unknown
      if (typeof item === 'string') name = item
      else if (isDict(item)) name = item['name'] || item['icon']
      else continue
      if (name && !fs.existsSync(path.join(iconsDir, `${pyStr(name)}.svg`))) {
        problems.push(`${rel}: 找不到图标 assets/icons/${pyStr(name)}.svg`)
      }
    }
  }

  const image = data['image']
  if (typeof image === 'string' && image) {
    const full = path.isAbsolute(image) ? image : path.join(root, image)
    if (!fs.existsSync(full)) problems.push(`${rel}: 找不到图片 ${image}`)
  }

  const images = data['images']
  if (isList(images)) {
    for (const item of images) {
      let target: unknown
      if (typeof item === 'string') target = item
      else if (isDict(item)) target = item['image'] || item['path'] || item['src']
      else continue
      if (target) {
        const value = pyStr(target)
        const full = path.isAbsolute(value) ? value : path.join(root, value)
        if (!fs.existsSync(full)) problems.push(`${rel}: 找不到图片 ${value}`)
      }
    }
  }

  const styles = data['style']
  if (isList(styles)) {
    for (const styleName of styles) {
      if (typeof styleName === 'string' && styleName && !resolveStyleFile(stylesDir, styleName)) {
        problems.push(`${rel}: 找不到样式 ${styleName}.css`)
      }
    }
  }

  for (const value of Object.values(data)) {
    if (typeof value === 'string') {
      checkInlineRefs(value, rel, stylesDir, iconsDir, problems)
    } else if (isDict(value)) {
      checkAssetRefs(value, rel, root, stylesDir, problems)
    } else if (isList(value)) {
      for (const item of value) {
        if (isDict(item)) checkAssetRefs(item, rel, root, stylesDir, problems)
        else if (typeof item === 'string') checkInlineRefs(item, rel, stylesDir, iconsDir, problems)
      }
    }
  }
}

/** 一段文本里的 {icon:xxx} / {style:xxx} 引用检查。 */
function checkInlineRefs(
  text: string,
  rel: string,
  stylesDir: string,
  iconsDir: string,
  problems: string[],
): void {
  for (const match of text.matchAll(/\{icon:([^}]+)\}/gu)) {
    const name = match[1] ?? ''
    if (!fs.existsSync(path.join(iconsDir, `${name}.svg`))) {
      problems.push(`${rel}: 找不到行内图标 assets/icons/${name}.svg`)
    }
  }
  for (const match of text.matchAll(/\{style:([^}]+)\}/gu)) {
    for (const raw of (match[1] ?? '').split(',')) {
      const name = raw.trim()
      if (name && !resolveStyleFile(stylesDir, name)) {
        problems.push(`${rel}: 找不到行内样式 ${name}.css`)
      }
    }
  }
}

/** 校验 data/{person} 下所有 YAML，返回问题描述列表；空列表 = 全部通过。 */
export function validate(root: string, person: string): string[] {
  const personDir = path.join(root, 'data', person)
  const stylesDir = path.join(root, 'styles')
  const problems: string[] = []

  const check = (file: string): void => {
    const rel = path.relative(root, file)
    const data = readYaml(file)
    if (Object.keys(data).length === 0) {
      problems.push(`${rel}: 解析结果为空`)
      return
    }
    const sectionType = data['type'] ?? ''
    if (typeof sectionType !== 'string' || !VALID_TYPES.has(sectionType)) {
      problems.push(`${rel}: 未知 type ${pyRepr(sectionType)}（应为 block / entry-list / grouped-list）`)
      return
    }
    if (sectionType === 'block' && !pyStr(data['content'] ?? '').trim()) {
      problems.push(`${rel}: block 缺少 content`)
    } else if (sectionType === 'entry-list') {
      if (!pyTruthy(data['items']) && !pyTruthy(data['heading'])) {
        problems.push(`${rel}: entry-list 缺少 items 或 heading`)
      }
    } else if (sectionType === 'grouped-list' && !pyTruthy(data['groups'])) {
      problems.push(`${rel}: grouped-list 缺少 groups`)
    }
    checkStyleFields(data, rel, problems)
    checkAssetRefs(data, rel, root, stylesDir, problems)
  }

  checkTheme(root, path.join(personDir, 'theme.yaml'), problems)

  for (const file of yamlFiles(personDir)) {
    if (path.basename(file) === 'theme.yaml') continue
    check(file)
  }

  for (const subdir of subdirs(personDir)) {
    const dirPath = path.join(personDir, subdir)
    checkCollectionMeta(root, path.join(dirPath, '_meta.yaml'), problems)
    for (const file of yamlFiles(dirPath)) {
      if (path.basename(file) === '_meta.yaml') continue
      check(file)
    }
  }

  return problems
}
