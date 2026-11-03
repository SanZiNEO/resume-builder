/**
 * dsh-resume —— host 半：简历项目、Python 解释器、本地预览服务。
 *
 * 这个包提供三样东西：
 *   1. `resumeProject` 服务 —— 项目目录（首次使用铺一份自带模板）、Python 探测、
 *      版本列表与选中版本、导出；
 *   2. 一个本地 HTTP 预览服务（loopback）—— `/preview` 给右栏浏览器标签页看，
 *      `/status` `/config` `/select` `/refresh` 给插件的界面用；
 *   3. `dsh-resume/policy`（另一个入口）—— 写边界 + export 工具，挂在 preset 作用域上，
 *      只对「简历顾问」会话生效，不影响同一 profile 里的其它会话。
 *
 * 装配在 cordis.patch.yml。
 */
import { spawn } from 'node:child_process'
import fsp from 'node:fs/promises'
import { existsSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Service } from '@deepseek-ai/cordis'
import type { Context, ResumeBuildState, ResumeProjectService, ResumeStatus } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { renderHtml, renderImage, renderPdf, validateProject } from './render/index.ts'

/** 插件包根目录（构建产物在 lib/ 下，包根是它的上一级）。 */
const PKG_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
/** 随包分发的简历项目模板：prepack 从 workspace-template/ 打出的压缩包，运行时用系统 tar 解。 */
const TEMPLATE_ARCHIVE = path.join(PKG_ROOT, 'workspace-template.tgz')
/** 模板里的基础资产：四个目录 + AGENTS.md，迁移时缺哪项补哪项。 */
const TEMPLATE_ITEMS = ['data', 'styles', 'layouts', 'assets', 'AGENTS.md']
/** 预览服务端口；客户端半写死同一个值。 */
export const PREVIEW_PORT = 39127
/** 控制页/右栏读取的固定预览地址。 */
export const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}/preview`
/** 插件自己的小状态文件（控制页里改的目录 / 选中版本 / 首次引导标记落在这里）。 */
const STATE_FILE = path.join(os.homedir(), '.dsh', 'dsh-resume.json')

/** 插件状态文件的内容。 */
interface PluginState {
  projectDir?: string | undefined
  selectedPerson?: string | undefined
  setupDone?: boolean | undefined
}

/** 支持的导出格式。 */
const EXPORT_FORMATS: readonly string[] = ['html', 'pdf', 'image', 'all']

/** 读插件状态文件。 */
async function readState(): Promise<PluginState> {
  try { return JSON.parse(await fsp.readFile(STATE_FILE, 'utf8')) as PluginState } catch { return {} }
}

/** 合并写插件状态文件。 */
async function writeState(patch: PluginState): Promise<PluginState> {
  const next = { ...(await readState()), ...patch }
  await fsp.mkdir(path.dirname(STATE_FILE), { recursive: true })
  await fsp.writeFile(STATE_FILE, JSON.stringify(next, null, 2) + '\n')
  return next
}

/** 一个目录是不是简历项目（有 data/ 与 styles/）。 */
export async function looksLikeProject(dir: string): Promise<boolean> {
  try {
    await fsp.access(path.join(dir, 'data'))
    await fsp.access(path.join(dir, 'styles'))
    return true
  } catch { return false }
}

/**
 * 确保目标目录里有我们的基础资产：缺哪项补哪项，已存在的一律不覆盖。
 *
 * 默认目录和用户在引导窗里自选的目录走同一条路——选哪个目录就在哪个目录铺，
 * 目录里原本有什么与迁移无关（我们只解出缺的项，根本不碰已有的）。
 *
 * 模板随包发布为一份 tgz：千余个小文件（样式库）在 Windows 上逐个复制极慢
 * （每文件一次创建 + 一次 Defender 扫描），这里按缺项用系统 tar 一次性解到
 * 目标目录——一次迁移一个进程，原生写盘。
 */
export async function ensureWorkspace(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true })
  const missing = TEMPLATE_ITEMS.filter((item) => !existsSync(path.join(dir, item)))
  if (missing.length === 0) return
  await extractArchive(TEMPLATE_ARCHIVE, dir, missing)
}

/** 系统 tar 的可执行路径：Windows 显式用自带 bsdtar（System32，Win10 1803+ 必有）。
 *
 * 不能无脑用 PATH 里第一个 tar：msys 的 GNU tar 被 node 直接拉起时，创建/提取
 * 传绝对 Windows 路径会莫名失败（shell 子进程重定向 + 参数启发式转换，实测
 * 见 dsh-pin.txt「template」条）；System32 的 bsdtar 原生处理 Windows 路径。
 * macOS / Linux 的 tar 没有这问题，直接用 PATH 里的。
 */
let tarBin: string | undefined
function tarCommand(): string {
  if (tarBin !== undefined) return tarBin
  if (process.platform === 'win32') {
    const systemTar = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
    if (existsSync(systemTar)) return (tarBin = systemTar)
  }
  return (tarBin = 'tar')
}

/** 用系统 tar 把模板包里的缺项直接解到目标目录。
 *
 * 目标目录走 `cwd`：tar 按包内顶层条目名（data/styles/...）提取，一次进程
 * 原生写完千余个小文件，缺什么解什么、已有的根本不碰。
 */
function extractArchive(archive: string, dest: string, items: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(tarCommand(), ['-xzf', archive, ...items], { cwd: dest, stdio: 'ignore' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`tar 解压模板失败（exit ${code ?? signal}）：${archive}`))
    })
  })
}

/** 输出目录名用的时间戳（与原来 Python 版一致：YYYYMMDD-HHMMSS）。 */
function timestamp(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

/** `data/` 下的版本目录名（`_` 开头的不算）。 */
async function listVersions(root: string): Promise<string[]> {
  try {
    const entries = await fsp.readdir(path.join(root, 'data'), { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('_')).map((entry) => entry.name).sort()
  } catch { return [] }
}

/**
 * 简历项目服务。装配：`- id: dsh-resume, name: dsh-resume`。
 */
export class ResumeProject extends Service implements ResumeProjectService {
  static Config = z.object({
    projectDir: z.string().description('简历项目目录（含 data/ 与 styles/）。默认 <home>/.dsh/resume，首次使用会铺一份插件自带模板；界面上也能改'),
    protectStyleLibrary: z.boolean().default(true).description('是否禁止修改 styles/ 下已存在的共享样式文件（只能新建 <名字>-custom.css）'),
  })

  /** 行配置（cordis.patch.yml 里那一行的 config）。 */
  private readonly config: { projectDir?: string; protectStyleLibrary?: boolean }
  /** 预览服务。 */
  private server: http.Server | null = null
  private serverRoot: string | null = null
  /** 当前选中版本（内存 + 状态文件）。 */
  private selected: string | undefined
  /** 最近一次预览构建。 */
  private build: ResumeBuildState = { html: null, at: null, error: null, building: false }
  /** 变更轮询。 */
  private watching: NodeJS.Timeout | null = null
  private stamps = new Map<string, number>()

  constructor(ctx: Context, config: ResumeProject['config'] = {}) {
    super(ctx, 'resumeProject')
    this.config = config ?? {}
    // 激活即拉起预览服务：界面与右栏预览都靠它，不能等到有人问才启动。
    // 顺手把项目目录登记成 dsh 工作区，新会话的 cwd 才会落在项目里。
    ctx.effect(() => {
      void this.ensurePreview().catch((error: unknown) => {
        console.error('[dsh-resume] 预览服务启动失败：', error)
      })
      this.syncWorkspace()
      return () => { void this.stopServer() }
    }, 'dsh-resume: preview server')
  }

  /** 生效的项目目录：界面写的 > 配置行 > 默认。三条路径都会确保资产齐备。 */
  async dir(): Promise<string> {
    const state = await readState()
    const configured = state.projectDir ?? this.config.projectDir
    const target = typeof configured === 'string' && configured.trim() !== ''
      ? path.resolve(configured)
      : path.join(os.homedir(), '.dsh', 'resume')
    await ensureWorkspace(target)
    return target
  }

  /** 选中版本（界面可改；缺省 data/ 下第一个）。 */
  async selectedPerson(): Promise<string | undefined> {
    const state = await readState()
    if (typeof state.selectedPerson === 'string') return state.selectedPerson
    return this.selected ?? (await listVersions(await this.dir()))[0]
  }

  /** 切选中版本：落盘并立刻重建预览。 */
  async select(person: string | undefined): Promise<void> {
    this.selected = person
    await writeState({ selectedPerson: person })
    await this.rebuild()
  }

  /**
   * 设置项目目录：落盘、把变更监视挪到新根并立刻重建预览。
   *
   * 预览服务本身**不**重启：路由层每个请求都实时读当前目录，服务常驻即可。
   * 之前这里 `stopServer()` 之后没有任何地方把它拉起来（`ensurePreview` 只在
   * 激活时调用一次），改完目录右栏就一直 `Failed to fetch`。
   */
  async setDir(dir: string): Promise<ResumeStatus> {
    await writeState({ projectDir: dir })
    this.selected = undefined
    const root = await this.dir()
    if (this.server !== null) {
      this.serverRoot = root
      this.rewatch(root)
    }
    await this.rebuild()
    this.syncWorkspace()
    return await this.status()
  }

  /** 把 mtime 轮询挪到新的项目根（切目录时用；预览服务保持常驻）。 */
  private rewatch(root: string): void {
    if (this.watching !== null) { clearInterval(this.watching); this.watching = null }
    this.stamps.clear()
    this.watch(root)
  }

  /**
   * 把当前项目目录登记为 dsh 工作区：左栏出现同名工作区，**新会话的 cwd 就落在
   * 项目里**——agent 的相对路径读写、AGENTS.md 注入、预览、导出才指向同一份内容。
   *
   * `create` 幂等（同一路径重复调用返回已有记录），激活时和每次改目录都调一遍。
   * 走 `ctx.inject` 惰性访问：宿主没装配 workspaceRegistry（如 headless）时回调
   * 不执行，预览与导出完全不受影响；失败只打日志。
   */
  private syncWorkspace(): void {
    this.ctx.inject(['workspaceRegistry'], (child) => {
      void (async () => {
        const dir = await this.dir()
        await child.workspaceRegistry?.create(dir)
      })().catch((error: unknown) => {
        console.error('[dsh-resume] 注册工作区失败（预览与导出不受影响）：', error)
      })
    })
  }

  /** 状态快照（界面用）。 */
  async status(): Promise<ResumeStatus> {
    const root = await this.dir()
    const state = await readState()
    return {
      projectDir: root,
      projectDirSource: typeof state.projectDir === 'string' ? 'ui' : (typeof this.config.projectDir === 'string' ? 'config' : 'default'),
      templateArchive: TEMPLATE_ARCHIVE,
      isProject: await looksLikeProject(root),
      versions: await listVersions(root),
      selected: await this.selectedPerson(),
      previewUrl: PREVIEW_URL,
      setupDone: state.setupDone === true,
      build: { at: this.build.at, error: this.build.error, building: this.build.building },
    }
  }

  /** 确保预览服务在跑，返回预览地址。 */
  async ensurePreview(): Promise<string> {
    const root = await this.dir()
    if (this.server !== null && this.serverRoot === root) return PREVIEW_URL
    await this.stopServer()
    const server = http.createServer((request, response) => { void this.handle(request, response) })
    const listening = Promise.withResolvers<void>()
    server.once('error', listening.reject)
    server.listen(PREVIEW_PORT, '127.0.0.1', listening.resolve)
    await listening.promise
    this.server = server
    this.serverRoot = root
    await this.rebuild().catch(() => {})
    this.watch(root)
    return PREVIEW_URL
  }

  /** 关闭预览服务。 */
  async stopServer(): Promise<void> {
    if (this.watching !== null) { clearInterval(this.watching); this.watching = null }
    this.stamps.clear()
    const server = this.server
    this.server = null
    this.serverRoot = null
    if (server !== null) {
      const closed = Promise.withResolvers<void>()
      server.close(() => { closed.resolve() })
      // keep-alive 连接会一直拖住 close() 的回调；走到这里服务正在拆除，直接断掉。
      server.closeAllConnections()
      await closed.promise
    }
  }

  /** 轮询 `data/**` `styles/**` 的 mtime：改了 YAML 或 CSS 就重建预览。 */
  private watch(root: string): void {
    const stamp = async (): Promise<void> => {
      let latest = 0
      const walk = async (dir: string): Promise<void> => {
        let entries
        try { entries = await fsp.readdir(dir, { withFileTypes: true }) } catch { return }
        for (const entry of entries) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) { await walk(full); continue }
          try { latest = Math.max(latest, (await fsp.stat(full)).mtimeMs) } catch { /* 读不到就算了 */ }
        }
      }
      for (const rel of ['data', 'styles']) await walk(path.join(root, rel))
      const previous = this.stamps.get(root)
      this.stamps.set(root, latest)
      if (previous !== undefined && latest > previous) await this.rebuild().catch(() => {})
    }
    void stamp()
    this.watching = setInterval(() => { void stamp() }, 1500)
  }

  /** 重建预览：用项目自己的渲染器把 HTML 出到临时目录、读进内存再删掉。 */
  async rebuild(): Promise<ResumeBuildState> {
    const root = await this.dir()
    if (!(await looksLikeProject(root))) {
      this.build = { html: null, at: null, error: `不是简历项目（缺少 data/ 或 styles/）：${root}`, building: false }
      return this.build
    }
    const person = await this.selectedPerson()
    if (person === undefined) {
      this.build = { html: null, at: null, error: 'data/ 下还没有任何版本目录', building: false }
      return this.build
    }
    this.build.building = true
    try {
      // 渲染器在包内（进程内直接调），不起子进程、不落中间文件。
      const html = await renderHtml({ root, person })
      this.build = { html, at: new Date().toISOString(), error: null, building: false }
      return this.build
    } catch (error) {
      this.build = { html: null, at: null, error: String((error as Error).message ?? error).slice(0, 4000), building: false }
      return this.build
    }
  }

  /** 导出：validate → 渲染（可选 PDF / 长图），返回给模型看的文本。 */
  async exportResume(options: { person?: string; format?: string } = {}): Promise<string> {
    const root = await this.dir()
    if (!(await looksLikeProject(root))) return `导出中止：不是简历项目（缺少 data/ 或 styles/）：${root}`
    const format = options.format !== undefined && EXPORT_FORMATS.includes(options.format) ? options.format : 'html'
    const person = options.person ?? await this.selectedPerson()
    if (person === undefined) return '导出中止：data/ 下还没有任何版本目录'

    const problems = await validateProject({ root, person })
    if (problems.length > 0) return ['校验未通过：', ...problems].join('\n')

    const stamp = timestamp()
    const outDir = path.join(root, 'output', `${person}-${stamp}`)
    await fsp.mkdir(outDir, { recursive: true })
    const produced: string[] = []
    try {
      const html = await renderHtml({ root, person })
      const htmlFile = path.join(outDir, `${person}-${stamp}.html`)
      await fsp.writeFile(htmlFile, html)
      produced.push(htmlFile)
      if (format === 'pdf' || format === 'all') {
        const pdfFile = path.join(outDir, `${person}-${stamp}.pdf`)
        await renderPdf({ root, person, file: pdfFile })
        produced.push(pdfFile)
      }
      if (format === 'image' || format === 'all') {
        const imageFile = path.join(outDir, `${person}-${stamp}-long.png`)
        await renderImage({ root, person, file: imageFile })
        produced.push(imageFile)
      }
    } catch (error) {
      const message = String((error as Error).message ?? error)
      return [`导出失败（${format}，${person}）：`, message, ...produced.map((file) => `已产出：${file}`)].join('\n')
    }
    return [
      `导出成功（${format}，${person}）。`,
      ...produced.map((file) => `产出：${file}`),
      '',
      '调用 `present` 把上面这些文件声明为交付物（每个文件一条，带一句说明），用户才能点开。',
    ].join('\n')
  }

  /** 预览服务的 HTTP 路由。 */
  private async handle(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${PREVIEW_PORT}`)
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'cache-control': 'no-store' }
    if (request.method === 'OPTIONS') { response.writeHead(204, headers); response.end(); return }
    try {
      if (url.pathname === '/preview') {
        const build = this.build.html === null && !this.build.building ? await this.rebuild() : this.build
        response.writeHead(200, { ...headers, 'content-type': 'text/html; charset=utf-8' })
        response.end(build.html ?? placeholder(build))
        return
      }
      if (url.pathname === '/status') {
        response.writeHead(200, { ...headers, 'content-type': 'application/json; charset=utf-8' })
        response.end(JSON.stringify(await this.status()))
        return
      }
      if (url.pathname === '/refresh') {
        await this.rebuild()
        response.writeHead(200, { ...headers, 'content-type': 'application/json; charset=utf-8' })
        response.end(JSON.stringify({ ok: this.build.error === null, error: this.build.error }))
        return
      }
      if (url.pathname === '/select' && request.method === 'POST') {
        const body = await readBody(request)
        await this.select(typeof body['person'] === 'string' ? body['person'] : undefined)
        response.writeHead(200, { ...headers, 'content-type': 'application/json; charset=utf-8' })
        response.end(JSON.stringify(await this.status()))
        return
      }
      if (url.pathname === '/config' && request.method === 'POST') {
        const body = await readBody(request)
        const dir = body['projectDir']
        if (typeof dir === 'string' && dir.trim() !== '') await this.setDir(path.resolve(dir.trim()))
        if (body['setupDone'] === true) await writeState({ setupDone: true })
        response.writeHead(200, { ...headers, 'content-type': 'application/json; charset=utf-8' })
        response.end(JSON.stringify(await this.status()))
        return
      }
      response.writeHead(404, headers)
      response.end('not found')
    } catch (error) {
      response.writeHead(500, { ...headers, 'content-type': 'text/plain; charset=utf-8' })
      response.end(String(error))
    }
  }
}

/** 读一个 JSON 请求体（限 64 KiB）。 */
async function readBody(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > 65536) break
    chunks.push(buffer)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> } catch { return {} }
}

/** 预览还没就绪时右栏里显示的东西（自带样式、不依赖项目）。 */
function placeholder(build: ResumeBuildState): string {
  const message = build.building ? '正在构建预览…' : (build.error ?? '还没有可预览的内容')
  const escaped = message.replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character] ?? character)
  return `<!doctype html><html lang="zh"><meta charset="utf-8"><title>简历预览</title>
<body style="margin:0;display:grid;place-items:center;height:100vh;background:#fafafa;color:#333;
font:14px/1.7 system-ui,-apple-system,'Segoe UI',sans-serif">
<div style="max-width:560px;padding:24px">
<div style="font-size:15px;margin-bottom:8px">简历预览</div>
<pre style="white-space:pre-wrap;word-break:break-all;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:12px;margin:0">${escaped}</pre>
<div style="margin-top:10px;color:#888">改完 YAML / CSS 会自动重建；也可以在设置里点「刷新」。</div>
</div></body></html>`
}

export default ResumeProject
