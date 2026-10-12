/**
 * dsh-resume-mode/policy —— 挂在「简历顾问」preset 里的那一行。
 *
 * 两件事，都只对使用该 preset 的会话生效（同一 profile 里的其它会话不受影响）：
 *   1. 写边界：`edit` / `write` 只能落在简历项目里，且只能是 .yaml / .yml / .css；
 *      `read` 完全不拦。
 *   2. `export` 工具：先 validate 再 build，失败把错误原文交回模型自己修。
 *
 * guard 是同步的，所以项目目录在这里是**同步缓存**：激活时取一次，
 * 会话工作区本身就是简历项目时优先用它。
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Context, ToolExecution } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'resume-policy'

/** 需要简历项目服务（由 host 半提供）。 */
export const inject = ['tools', 'resumeProject']

/** 这一行的行配置。 */
export interface PolicyConfig {
  /** 禁止修改 styles/ 下已存在的共享样式文件（默认 true）。 */
  protectStyleLibrary?: boolean
}

/** 受约束的写类工具。 */
const WRITE_TOOLS = new Set(['edit', 'write'])

/** 允许写入的后缀（含仓库里 `.disabled` 停用条目的写法）。 */
const ALLOWED_EXT = /\.(css|ya?ml)(\.disabled)?$/i

/** realpath 到最深的已存在祖先，再把不存在的尾段拼回去（防符号链接逃逸）。 */
function resolveReal(input: string): string {
  const absolute = path.resolve(input)
  let current = absolute
  const tail: string[] = []
  for (;;) {
    try {
      const real = fs.realpathSync(current)
      return tail.length > 0 ? path.join(real, ...tail.reverse()) : real
    } catch {
      const parent = path.dirname(current)
      if (parent === current) return absolute
      tail.push(path.basename(current))
      current = parent
    }
  }
}

/** 路径是否落在某个根目录内（根本身不算）。 */
function inside(filePath: string, root: string): boolean {
  const realRoot = resolveReal(root)
  const target = resolveReal(path.resolve(realRoot, filePath))
  const relative = path.relative(realRoot, target)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

/** 写边界 + export 工具。 */
export function apply(ctx: Context, config: PolicyConfig = {}): void {
  const protectStyles = config.protectStyleLibrary ?? true
  /** 项目目录的同步缓存（host 半的服务是异步的）。 */
  let projectRoot: string | null = null
  void ctx.resumeProject.dir().then((dir) => { projectRoot = dir }, () => { projectRoot = null })

  ctx.effect(() => ctx.tools.guard((exec: ToolExecution) => {
    if (!WRITE_TOOLS.has(exec.name)) return undefined
    const args = exec.arguments ?? {}
    const cwd = exec.agent?.session?.header?.cwd
    const roots = [projectRoot, cwd].filter((root): root is string => typeof root === 'string' && root !== '')
    if (roots.length === 0) return '简历模式：还没确定简历项目目录，先到左栏「简历」走一遍引导'
    const filePath = args['file_path']
    const root = roots.find((candidate) => inside(String(filePath ?? ''), candidate))
    if (root === undefined) {
      return `简历模式：只能改简历项目里的文件（当前项目：${projectRoot ?? '未确定'}）`
    }
    if (!ALLOWED_EXT.test(String(filePath))) {
      return '简历模式：只能改 .yaml / .yml / .css —— 简历内容在 YAML 里，样式在 CSS 里；layouts/、assets/ 和项目工具不要动'
    }
    if (args['sandbox_permissions']) return '简历模式：本会话不允许提升沙箱权限'
    if (protectStyles) {
      const target = resolveReal(path.resolve(root, String(filePath)))
      const relative = path.relative(resolveReal(root), target).replace(/\\/g, '/')
      if (relative.startsWith('styles/') && fs.existsSync(target)) {
        return '简历模式：styles/ 下的样式文件是所有版本共用的，不能直接改；请新建 styles/<类别>/<名字>-custom.css，再在 YAML 的 style 列表里引用它'
      }
    }
    return undefined
  }), 'dsh-resume-mode: write guard')

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'export',
    description:
      '导出简历：先校验 YAML 再构建。缺省导出当前选中的版本，' +
      'format=html 打包成自包含 HTML（默认）、pdf 出 PDF、image 出长图、all 全量。' +
      '校验或构建失败时把错误原文返回，据此自己修 YAML 后重试。',
    parameters: {
      person: { type: 'string', description: '要导出的版本目录名（data/ 下的子目录）；缺省用当前选中的版本' },
      format: { type: 'string', description: 'html（默认）/ pdf / image / all' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args: unknown, value: unknown) => [{ type: 'text', text: String(value) }],
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const format = ['html', 'pdf', 'image', 'all'].includes(String(args['format'])) ? String(args['format']) : 'html'
      const person = typeof args['person'] === 'string' && args['person'] !== '' ? args['person'] : undefined
      return await ctx.resumeProject.exportResume({ person, format })
    },
  })), 'dsh-resume-mode: export tool')
}
