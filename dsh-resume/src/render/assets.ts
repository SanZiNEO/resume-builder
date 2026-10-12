/**
 * 素材加载 — SVG 图标内联 + 通用图片 data URI。
 *
 * 素材目录（相对项目根）：
 *     assets/icons/{name}.svg
 *     assets/images/{file}
 *     assets/decor/{name}.svg
 */

import fs from 'node:fs'
import path from 'node:path'

/** Python `mimetypes.guess_type` 对常见图片格式的结果。 */
const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jpe': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.svgz': 'image/svg+xml',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/vnd.microsoft.icon',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.pdf': 'application/pdf',
}

function safePath(root: string, target: string): string {
  if (path.isAbsolute(target)) return target
  return path.join(root, target)
}

/** 读取 assets/icons/{name}.svg，返回 SVG 内容；不存在返回 null。 */
export function iconSvg(root: string, name: string): string | null {
  const clean = path.basename(name)
  const file = path.join(root, 'assets', 'icons', `${clean}.svg`)
  if (!fs.existsSync(file)) return null
  return fs.readFileSync(file, 'utf8').trim()
}

/** 按扩展名猜 MIME（对应 Python `mimetypes.guess_type()[0]`，未知返回 null）。 */
export function mimeType(file: string): string | null {
  return MIME_BY_EXT[path.extname(file).toLowerCase()] ?? null
}

/** 读取任意图片文件，返回 data URI；不存在返回 null。 */
export function imageDataUri(root: string, target: string): string | null {
  const full = safePath(root, target)
  if (!fs.existsSync(full)) return null
  const mime = mimeType(full) ?? 'application/octet-stream'
  const b64 = fs.readFileSync(full).toString('base64')
  return `data:${mime};base64,${b64}`
}
