/**
 * 把 workspace-template/ 打成 workspace-template.tgz（随包发布的模板压缩包）。
 *
 * 运行时 `ensureWorkspace` 用系统 tar 按缺项把条目解到用户目录，所以打包固定
 * 用「包内顶层就是 data/styles/layouts/assets/AGENTS.md」的布局——条目名不带
 * ./ 前缀，GNU tar 和 bsdtar（Windows/macOS）的按名提取行为才一致。
 *
 * 松散的 workspace-template/ 仍是模板的唯一源（可 diff、可维护），这份 tgz
 * 只是发布形态：产物不进 git（*.tgz 已忽略），每次 prepack 现打。
 *
 * 注意：Windows 上必须用 System32 自带的 bsdtar（和运行时 `tarCommand()` 的
 * 选择一致），不能用 PATH 里可能的 msys GNU tar——它被 node 直接拉起时传绝对
 * Windows 路径会莫名失败（实测见 dsh-pin.txt「template」条）。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const template = path.join(root, 'workspace-template')
const out = path.join(root, 'workspace-template.tgz')

const systemTar = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
const tar = process.platform === 'win32' && existsSync(systemTar) ? systemTar : 'tar'

rmSync(out, { force: true })
const result = spawnSync(tar, ['-czf', out, 'data', 'styles', 'layouts', 'assets', 'AGENTS.md'], { cwd: template, stdio: 'inherit' })
if (result.error !== undefined) {
  console.error('打包模板失败：无法启动 tar ——', result.error.message)
  process.exit(1)
}
if (result.status !== 0) {
  console.error(`打包模板失败：tar 退出码 ${result.status}`)
  process.exit(1)
}
console.log('workspace-template.tgz 打包完成')
