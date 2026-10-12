/**
 * 测试用的临时项目骨架：在系统临时目录里造一个最小项目根（data/ styles/ assets/），
 * 测试自己写文件、自己删——不碰仓库里的 data/ styles/ layouts/。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** 写一个相对路径的文件（自动建父目录）。 */
export function writeFile(root, relative, content) {
  const full = path.join(root, relative)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

/** 造一个临时项目根，并登记测试结束后的清理。 */
export function tempProject(t, files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-render-'))
  for (const [relative, content] of Object.entries(files)) writeFile(root, relative, content)
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return root
}

/** 一份能解析出 card 的样式库：校验用例里给它当基线，免得缺样式的问题混进来。 */
export const CARD_STYLE = { 'styles/section/card.css': '.section.card {}' }
