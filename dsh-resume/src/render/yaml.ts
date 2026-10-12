/**
 * YAML 加载 — PyYAML 语义的标准解析 + reference 区块整段截断 + 占位符注入。
 *
 * reference 约定：永远位于文件末尾（顶层 `reference:` 起），解析时从该行起
 * 整段截断丢弃，不参与解析——AI 写 reference 无任何格式负担，想怎么写怎么写。
 *
 * 占位符约定：`${KEY}` 形式，构建时由环境变量注入（仅 personal.yaml 生效），
 * 未提供的占位符保留原文并输出警告。个人隐私信息（姓名/电话/邮箱）以占位符形式
 * 存在于 personal.yaml，AI 读到的只有占位符，真实值由用户构建时手动传入。
 *
 * 与 PyYAML 的差异（都在这里抹平）：
 *   - PyYAML 是 YAML 1.1：yes/no/on/off 是布尔、0755 是八进制、1:30 是 60 进制整数
 *     → 用 `version: '1.1'` 对齐。
 *   - 1.1 的日期标量在 JS 里会变成 Date 对象（`String(date)` 是 "Mon Sep 01 2023 …"，
 *     Python 的 `str(date)` 是 "2023-09-01"）→ 直接摘掉 timestamp 标签，
 *     让日期标量保持原文（与 Python `str(date)` / `str(datetime)` 一致）。
 *   - PyYAML 允许重复键（后者胜出）→ `uniqueKeys: false`。
 *   - 字典顺序：Python 3.7+ 保插入序，JS 对象同样；不排序。
 */

import fs from 'node:fs'
import { parse } from 'yaml'
import type { Tags } from 'yaml'

/** 解析结果：Python 的 dict。 */
export type Dict = Record<string, unknown>

const REFERENCE_MARK = 'reference:'
/** `${KEY}`；Python 的 \w 是 Unicode 感知的。 */
const VAR_RE = /\$\{([\p{L}\p{N}_]+)\}/gu
const TIMESTAMP_TAG = 'tag:yaml.org,2002:timestamp'

/** Python 的 `isinstance(v, dict)`。 */
export function isDict(value: unknown): value is Dict {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  )
}

/** Python `isinstance(v, list)`。 */
export function isList(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/** Python 的真值：空 list / 空 dict / 空 str / 0 / None 都是假（JS 里只有 ''、0、NaN 是假）。 */
export function pyTruthy(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.length > 0
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value)
  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

/** Python 的 `a or b`。 */
export function pyOr<T>(a: T, b: T): T {
  return pyTruthy(a) ? a : b
}

/** Python 的 `type(v).__name__`（validate 的问题文案里要用）。 */
export function pyTypeName(value: unknown): string {
  if (value === null || value === undefined) return 'NoneType'
  if (typeof value === 'boolean') return 'bool'
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float'
  if (typeof value === 'string') return 'str'
  if (Array.isArray(value)) return 'list'
  if (value instanceof Date) return 'datetime'
  if (typeof value === 'function') return 'function'
  return 'dict'
}

/** Python 的 `repr(value)`（警告文案里要用）。 */
export function pyRepr(value: unknown): string {
  if (typeof value === 'string') {
    const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
    return `'${escaped}'`
  }
  return pyStr(value)
}

/**
 * Python `sorted()` 的顺序：按 Unicode 码点比较，不是 JS 默认的 UTF-16 码元
 * （BMP 之外才会不同，但排序结果会直接影响 CSS 注入顺序）。
 */
export function pyCompare(a: string, b: string): number {
  if (a === b) return 0
  const left = [...a]
  const right = [...b]
  const shared = Math.min(left.length, right.length)
  for (let i = 0; i < shared; i += 1) {
    const x = (left[i] ?? '').codePointAt(0) ?? 0
    const y = (right[i] ?? '').codePointAt(0) ?? 0
    if (x !== y) return x < y ? -1 : 1
  }
  return left.length - right.length
}

/**
 * Python 的 `str(value)`。
 *
 * 整数不走指数记法（`String(1e21)` 是 "1e+21"，Python 是 21 位数字）；
 * 浮点两边都是最短往返表示（`str(2026.04)` / `String(2026.04)` 同为 "2026.04"）。
 */
export function pyStr(value: unknown): string {
  if (value === null || value === undefined) return 'None'
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'number') {
    if (Number.isSafeInteger(value)) return String(value)
    if (Number.isInteger(value)) return BigInt(value).toString()
    return String(value)
  }
  if (value instanceof Date) return pyDateStr(value)
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(', ')}]`
  if (typeof value === 'object') {
    const entries = Object.entries(value).map(([key, item]) => `${pyRepr(key)}: ${pyRepr(item)}`)
    return `{${entries.join(', ')}}`
  }
  return String(value)
}

/** `str(datetime.date)` → `2023-09-01`；`str(datetime.datetime)` → `2023-09-01 10:00:00`。 */
function pyDateStr(value: Date): string {
  const date = [
    String(value.getUTCFullYear()).padStart(4, '0'),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-')
  const time = [
    String(value.getUTCHours()).padStart(2, '0'),
    String(value.getUTCMinutes()).padStart(2, '0'),
    String(value.getUTCSeconds()).padStart(2, '0'),
  ].join(':')
  if (time === '00:00:00' && value.getUTCMilliseconds() === 0) return date
  return `${date} ${time}`
}

/** 1.1 的 timestamp 标签摘掉：日期标量保持原文（= Python 的 `str(date)`）。 */
function pyTags(tags: Tags): Tags {
  return tags.filter((tag) =>
    typeof tag === 'string' ? tag !== 'timestamp' : tag.tag !== TIMESTAMP_TAG,
  )
}

/**
 * 替换文本中的 ${KEY} 占位符（仅非注释行）；未提供的 key 保留原文并输出警告。
 *
 * vars 缺省时从环境变量读取（构建时通过环境变量注入真实值，
 * 如 NAME=你的姓名 npm run build）。
 */
export function injectVars(
  text: string,
  vars?: Record<string, string | undefined> | null,
): string {
  const table = vars ?? process.env
  if (!table || Object.keys(table).length === 0) return text
  const missing = new Set<string>()

  const outLines: string[] = []
  for (const line of text.split('\n')) {
    if (line.replace(/^\s+/, '').startsWith('#')) {
      outLines.push(line) // 注释行不参与替换（${...} 只是说明文字）
      continue
    }
    outLines.push(
      line.replace(VAR_RE, (whole, key: string) => {
        const value = table[key]
        if (value !== undefined) return value
        missing.add(key)
        return whole
      }),
    )
  }
  for (const key of [...missing].sort()) {
    console.error(`警告: 未提供变量 ${key}（占位符保留，请通过环境变量传入）`)
  }
  return outLines.join('\n')
}

/**
 * 截断 reference 区块：找到无缩进的顶层 `reference:` 行，其后的内容全部丢弃。
 *
 * 折叠块（`>`）内容行必有缩进，不会误伤；嵌套的 reference 字段按顶层处理
 * （协议约定 reference 仅出现在文件末尾顶层）。
 */
function stripReference(text: string): string {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    if (line === REFERENCE_MARK || line.startsWith(`${REFERENCE_MARK} `)) {
      return lines.slice(0, i).join('\n')
    }
  }
  return text
}

/** 解析 YAML 文本（reference 区块自动截断）。 */
export function parseYaml(text: string): Dict {
  const body = stripReference(text)
  const result: unknown = parse(body, {
    version: '1.1',
    merge: true,
    uniqueKeys: false,
    customTags: pyTags,
  })
  if (!isDict(result)) return {}
  return result
}

/**
 * 读文本文件：Python 的文本模式会把 \r\n 与 \r 都归一化成 \n（universal newlines），
 * 布局、CSS、YAML 都按这个语义读，否则 CRLF 文件会多出 \r 影响逐字节比对。
 */
export function readText(file: string): string {
  return fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n')
}

/** 读一个 YAML 文件（按 Python 文本模式归一化换行）。 */
export function readYaml(path: string): Dict {
  return parseYaml(readText(path))
}
