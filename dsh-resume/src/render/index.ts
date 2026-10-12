/**
 * 渲染器公开 API — 插件的其它部分只通过这里使用渲染器。
 *
 * 与 Python 版（src/builder.py + make.py）逐字节一致；PDF / 长图需要可选的
 * playwright 包，没装时抛带安装指引的错误。
 */

import { build, listPersons as listPersonDirs, validate } from './builder.ts'
import { exportLongImage, exportPdf } from './pdf.ts'

export interface RenderRequest {
  /** 项目根目录（含 data/ styles/ layouts/ assets/）。 */
  readonly root: string
  /** 版本目录名（data/ 下的子目录）。 */
  readonly person: string
  /** 布局名（layouts/<name>.html），缺省 default。 */
  readonly layout?: string | undefined
  /** 占位符变量（${NAME} 等）；缺省用 process.env。 */
  readonly variables?: Record<string, string> | undefined
}
/** 校验请求。 */
export interface ValidateRequest {
  readonly root: string
  readonly person: string
  readonly layout?: string | undefined
}
/** 渲染成自包含 HTML 字符串。 */
export async function renderHtml(request: RenderRequest): Promise<string> {
  const result = build({
    root: request.root,
    person: request.person,
    layout: request.layout,
    variables: request.variables,
  })
  if (result === null) {
    throw new Error(
      `渲染失败：data/ 下没有版本 ${request.person}，或找不到布局 layouts/${request.layout ?? 'default'}.html`,
    )
  }
  return result.html
}
/** 列出 data/ 下的版本目录（跳过 _ 开头）。 */
export async function listPersons(root: string): Promise<string[]> {
  return listPersonDirs(root)
}
/** 校验；返回问题列表（空数组 = 通过），文案与 Python 版一致。 */
export async function validateProject(request: ValidateRequest): Promise<string[]> {
  return validate(request.root, request.person)
}
/** 出 PDF（需要可选的 playwright 包，没装就报带指引的错误）。 */
export async function renderPdf(request: RenderRequest & { file: string }): Promise<void> {
  await exportPdf(await renderHtml(request), request.file)
}
/** 出长图 PNG（同上）。 */
export async function renderImage(request: RenderRequest & { file: string }): Promise<void> {
  await exportLongImage(await renderHtml(request), request.file)
}
