/**
 * dsh-resume-mode —— host 半：简历项目、Python 解释器、本地预览服务。
 *
 * 这个包提供三样东西：
 *   1. `resumeProject` 服务 —— 项目目录（首次使用铺一份自带模板）、Python 探测、
 *      版本列表与选中版本、导出；
 *   2. 一个本地 HTTP 预览服务（loopback）—— `/preview` 给右栏浏览器标签页看，
 *      `/status` `/config` `/select` `/refresh` 给插件的界面用；
 *   3. `dsh-resume-mode/policy`（另一个入口）—— 写边界 + export 工具，挂在 preset 作用域上，
 *      只对「简历顾问」会话生效，不影响同一 profile 里的其它会话。
 *
 * 装配在 cordis.patch.yml。
 */
import fsp from 'node:fs/promises'
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
/** 随包分发的简历项目模板。 */
const TEMPLATE_DIR = path.join(PKG_ROOT, 'workspace-template')
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
 * 简历项目服务。装配：`- id: dsh-resume-mode, name: dsh-resume-mode`。
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
    ctx.effect(() => {
      void this.ensurePreview().catch((error: unknown) => {
        console.error('[dsh-resume-mode] 预览服务启动失败：', error)
      })
      return () => { void this.stopServer() }
    }, 'dsh-resume-mode: preview server')
  }

  /** 生效的项目目录：界面写的 > 配置行 > 默认（并确保模板已铺好）。 */
  async dir(): Promise<string> {
    const state = await readState()
    const configured = state.projectDir ?? this.config.projectDir
    if (typeof configured === 'string' && configured.trim() !== '') return path.resolve(configured)
    return await this.ensureTemplate()
  }

  /** 把插件自带的模板铺到默认目录（只补缺，不覆盖用户已改过的东西）。 */
  async ensureTemplate(): Promise<string> {
    const home = path.join(os.homedir(), '.dsh', 'resume')
    await fsp.mkdir(home, { recursive: true })
    if (!(await looksLikeProject(home))) {
      await fsp.cp(TEMPLATE_DIR, home, { recursive: true, force: false, errorOnExist: false })
    }
    return home
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

  /** 设置项目目录：落盘并重启预览服务。 */
  async setDir(dir: string): Promise<ResumeStatus> {
    await writeState({ projectDir: dir })
    this.selected = undefined
    await this.stopServer()
    return await this.status()
  }

  /** 状态快照（界面用）。 */
  async status(): Promise<ResumeStatus> {
    const root = await this.dir()
    const state = await readState()
    return {
      projectDir: root,
      projectDirSource: typeof state.projectDir === 'string' ? 'ui' : (typeof this.config.projectDir === 'string' ? 'config' : 'default'),
      templateDir: TEMPLATE_DIR,
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
    return [`导出成功（${format}，${person}）。`, ...produced.map((file) => `产出：${file}`)].join('\n')
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
