/**
 * dsh-resume-mode —— client 半（浏览器端 bundle）。
 *
 * 用户看到的东西：
 *   1. 左栏「简历」入口 —— 点它 = 进简历模式：确保简历项目已注册成工作区、开一个会话
 *      （主区域回到**原本的对话页**）、只给这个会话设成「简历顾问」、把预览停靠到右栏；
 *   2. 第一次点它 —— 弹一次引导窗（选项目目录）；
 *   3. 设置 → 「简历模式」一页 —— 之后改配置的地方（项目目录 / Python / 版本 / 预览）；
 *   4. 会话头「简历预览」按钮 —— 简历顾问会话里随时把预览叫回右栏。
 *
 * 样式抄自官方 primitives（Modal / Button / Input / settings-form），类名加 rs- 前缀，
 * 只用 --dsw-* 主题 token，所以深浅色、字号跟宿主一致。
 *
 * 人设 / 写边界 / export 工具 / 预览服务都在 host 半（src/index.ts），装配在 cordis.patch.yml。
 */
import type {
  ClientContext,
  ClientRequire,
  ObservableSnapshot,
  ReactLike,
  WorkspaceView,
} from './types/client.ts'

/** 预览服务（与 host 半的端口一致）。 */
const API = 'http://127.0.0.1:39127'
const PREVIEW_URL = `${API}/preview`
/** 插件带的会话模式 id（cordis.patch.yml 里声明）。 */
const PRESET_ID = 'resume'
/** 插件自己的右栏预览标签页：id 是 body 注册用的 key，kind 是 openTab 用的名字。 */
const PREVIEW_TAB_ID = 'dsh-resume-preview'
const PREVIEW_TAB_KIND = 'resume-preview'
/** iframe 自动刷新时轮询 `/status` 的间隔（毫秒）。 */
const PREVIEW_POLL_MS = 1500

/** 样式：抄官方 primitives 的 Modal / Button / Input / settings-form。 */
const CSS = `
.rs-section{display:flex;flex-direction:column;width:100%}
.rs-field{display:flex;flex-direction:column;gap:6px;padding:12px 0}
.rs-field+.rs-field{border-top:.5px solid var(--dsw-alias-border-l2)}
.rs-label{font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}
.rs-row{display:flex;align-items:center;gap:8px;min-width:0}
.rs-value{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);word-break:break-all;font-family:var(--dsw-font-mono)}
.rs-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.rs-error{font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary)}
.rs-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;height:28px;padding:0 10px;border:none;border-radius:var(--dsw-radius-sm);cursor:pointer;font:inherit;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);background:transparent}
.rs-button:disabled{cursor:not-allowed;opacity:.4}
.rs-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.rs-primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.rs-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.rs-outline{border:.5px solid var(--dsw-alias-border-l3)}
.rs-input{display:flex;align-items:center;gap:6px;flex:1;min-width:0;height:32px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1)}
.rs-input:focus-within{border-color:var(--dsw-alias-state-business-primary)}
.rs-input input{flex:1;min-width:0;border:none;outline:none;background:transparent;font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}
.rs-select{height:32px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}
.rs-root{pointer-events:auto;position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:max(24px,var(--dsh-frame-overlay-top,24px)) 24px}
.rs-mask{position:absolute;inset:var(--dsh-frame-chrome-top,0px) 0 0;backdrop-filter:var(--dsw-mask-blur)}
.rs-mask::after{content:'';position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1)}
.rs-dialog{box-sizing:border-box;position:relative;z-index:1;display:flex;flex-direction:column;gap:20px;width:min(460px,100%);padding:0 0 24px;overflow:hidden;border:0;border-radius:var(--dsw-radius-panel);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-prominent)}
.rs-dialogHeader{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:22px 14px 12px 24px}
.rs-dialogTitle{margin:0;font-size:16px;line-height:24px;font-weight:500;color:var(--dsw-alias-label-primary)}
.rs-close{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:var(--dsw-radius-sm);background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary);font:inherit}
.rs-close:hover{background:var(--dsw-alias-interactive-bg-hover)}
.rs-dialogBody{display:flex;flex-direction:column;gap:12px;min-width:0;padding:0 24px}
.rs-dialogFooter{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:0 24px}
.rs-text{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}
.rs-launcher{display:flex;align-items:center;justify-content:center;height:100%;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}
.rs-launcherInner{display:flex;flex-direction:column;align-items:center;gap:10px;max-width:420px;text-align:center}
`

/** host 半 `/status` 返回的形状。 */
interface ResumeStatus {
  projectDir: string
  isProject: boolean
  versions: string[]
  selected?: string
  previewUrl: string
  setupDone: boolean
  build: { at: string | null; error: string | null; building: boolean }
}

/** 槽位给的会话状态（只用到模式那一个投影）。 */
interface SessionsState {
  byId: Record<string, { projectionValues?: { agentPreset?: unknown } } | undefined>
}

/** 会话作用域槽位给组件的 props（只声明我们用到的）。 */
interface SessionProps {
  readonly sessionId?: string
  readonly useSessions?: (selector: (state: SessionsState) => unknown) => unknown
}

/** 一次性把样式挂进 head（官方包也是这么做的）。 */
function ensureStyles(): void {
  const id = 'dsh-resume-mode/styles'
  if (document.querySelector(`style[data-plugin-css="${id}"]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset['plugin'] = 'dsh-resume-mode'
  tag.dataset['pluginCss'] = id
  tag.textContent = CSS
  document.head.appendChild(tag)
}

/** 读预览服务的状态（也是"host 半在不在"的探针）。 */
async function readStatus(): Promise<ResumeStatus> {
  const response = await fetch(`${API}/status`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`预览服务返回 ${response.status}`)
  return await response.json() as ResumeStatus
}

/**
 * 等预览服务起来再读状态。
 * 冷启动要跑一遍 Python 探测 + 首次渲染，几秒内 `/status` 是连不上的——
 * 这时候不该直接给用户报错，等一会儿就好。
 */
async function readStatusWhenReady(timeoutMs = 30000): Promise<ResumeStatus> {
  const started = Date.now()
  for (;;) {
    try { return await readStatus() } catch (error) {
      if (Date.now() - started > timeoutMs) throw error
      await new Promise((resolve) => { setTimeout(resolve, 700) })
    }
  }
}

/** 写配置（项目目录 / 完成首次引导）。 */
async function writeConfig(patch: Record<string, unknown>): Promise<ResumeStatus> {
  const response = await fetch(`${API}/config`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!response.ok) throw new Error(`保存失败（${response.status}）`)
  return await response.json() as ResumeStatus
}

/** 切预览版本。 */
async function selectVersion(person: string): Promise<void> {
  await fetch(`${API}/select`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ person }),
  })
}

/** 路径比较：大小写与分隔符都不计较。 */
function samePath(left: string, right: string): boolean {
  const normalize = (value: string): string => value.replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase()
  return normalize(left) === normalize(right)
}

/**
 * 打开预览：优先用**插件自己的右栏标签页** —— 只有画面，没有地址栏/前进后退那套浏览器外壳
 * （web 与桌面壳都实测可用）。万一这个类型没注册上，退回官方「浏览器」标签页，再不行开独立窗口。
 * @returns 给用户看的一句话说明。
 */
function openPreviewTab(ctx: ClientContext): string {
  const mounted = ctx.sidebarRight.mounted.getSnapshot()
  if (mounted !== undefined) {
    try {
      ctx.sidebarRight.openTab(PREVIEW_TAB_KIND)
      return '预览已开在右栏。'
    } catch {
      // 类型没注册上：试官方浏览器标签页
    }
    try {
      ctx.sidebarRight.openTab('browser', { params: { url: PREVIEW_URL } })
      return '预览已开在右栏（浏览器标签页）。'
    } catch {
      // 都没有：退到独立窗口
    }
  }
  const handle = window.open(PREVIEW_URL, 'dsh-resume-preview', 'popup=yes,width=680,height=900')
  return handle === null || handle === undefined ? `浏览器拦了弹窗；也可以直接打开 ${PREVIEW_URL}` : '预览已开在独立窗口。'
}

/** 等会话真正在屏（`startSession` 是异步的），最多等 timeoutMs。 */
async function waitForSession(ctx: ClientContext, timeoutMs = 10000): Promise<boolean> {
  const mounted: ObservableSnapshot<string | undefined> = ctx.sidebarRight.mounted
  if (mounted.getSnapshot() !== undefined) return true
  const started = Date.now()
  while (Date.now() - started <= timeoutMs) {
    await new Promise((resolve) => { setTimeout(resolve, 150) })
    if (mounted.getSnapshot() !== undefined) return true
  }
  return false
}

/**
 * 进简历模式：确保项目是工作区 → 在该工作区开一个会话（主区域自动回到对话页）→
 * 只给这一个会话设成「简历顾问」→ 预览停靠右栏。
 * `startSession` 会复用该工作区里已有的空白会话，所以连点不会堆一堆空会话；
 * 模式是**逐会话**设的，不动设置里的全局默认。
 */
async function enterResumeMode(ctx: ClientContext, projectDir: string): Promise<void> {
  const items = ctx.workspaces.list.getSnapshot().items
  const existing = items.find((item: WorkspaceView) => samePath(item.path, projectDir))
  const workspaceId = existing !== undefined
    ? existing.workspaceId
    : (await ctx.workspaces.create({ path: projectDir })).workspaceId
  ctx.uiWorkspace.startSession(workspaceId)
  if (await waitForSession(ctx)) {
    const sessionId = ctx.sidebarRight.mounted.getSnapshot()
    if (sessionId !== undefined) {
      // 只改这个会话的模式（等价于在新会话页的模式选择器里点一下「简历顾问」）。
      await ctx.remote.agentPresets.select(sessionId, PRESET_ID).catch(() => undefined)
    }
  }
  openPreviewTab(ctx)
}

/**
 * 浏览器端插件入口。
 * @param require - 宿主提供的基线模块表（`react` 等）。
 * @returns 插件对象：声明依赖的服务，并在 `apply` 里往官方槽位注册。
 */
function createPlugin(require: ClientRequire) {
  const React = require('react') as ReactLike
  const h = React.createElement

  /** 状态轮询（设置页与引导窗共用）。 */
  function useStatus() {
    const [state, setState] = React.useState<{ status: ResumeStatus | null; error: string | null }>({ status: null, error: null })
    const load = React.useCallback(() => {
      readStatusWhenReady(8000).then(
        (status) => { setState({ status, error: null }) },
        (error: Error) => { setState((previous) => ({ status: previous.status, error: `连不上预览服务：${String(error.message ?? error)}` })) },
      )
    }, [])
    React.useEffect(() => {
      load()
      const timer = setInterval(load, 5000)
      return () => { clearInterval(timer) }
    }, [load])
    return [state, load] as const
  }

  /** 选目录：官方封装（桌面端系统对话框 / web 端内置浏览）。 */
  async function pickDirectory(ctx: ClientContext, onPicked: (dir: string) => void, onError: (message: string) => void): Promise<void> {
    try {
      const picked = await ctx.uiWorkspace.pickDirectory()
      if (typeof picked === 'string' && picked !== '') onPicked(picked)
    } catch (error) {
      onError(`选不了目录（${String((error as Error).message ?? error)}），直接填路径吧`)
    }
  }

  /** 设置 → 「简历模式」一页。 */
  function ResumeSection({ ctx }: { ctx: ClientContext }) {
    const [state, load] = useStatus()
    const [draft, setDraft] = React.useState<string | null>(null)
    const [notice, setNotice] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [busy, setBusy] = React.useState(false)
    const status = state.status

    const saveDir = async (next: string): Promise<void> => {
      setBusy(true); setError(null)
      try {
        await writeConfig({ projectDir: next })
        setDraft(null)
        load()
      } catch (cause) {
        setError(String((cause as Error).message ?? cause))
      } finally {
        setBusy(false)
      }
    }

    const refreshPreview = async (): Promise<void> => {
      const response = await fetch(`${API}/refresh`, { method: 'POST' })
      const body = await response.json().catch(() => ({})) as { ok?: boolean; error?: string }
      setNotice(body.ok === true ? '预览已重建。' : `重建失败：${body.error ?? String(response.status)}`)
      load()
    }

    if (status === null) {
      return h('div', { className: 'rs-section' },
        h('div', { className: state.error === null ? 'rs-hint' : 'rs-error' }, state.error ?? '读取中…'))
    }

    const previewState = status.build.error !== null
      ? `构建出错：${status.build.error}`
      : (status.build.at === null ? '还没构建过' : `已构建（${status.build.at}）`)

    return h('div', { className: 'rs-section' }, [
      h('div', { key: 'dir', className: 'rs-field' }, [
        h('div', { key: 'l', className: 'rs-label' }, '简历项目目录'),
        draft === null
          ? h('div', { key: 'v', className: 'rs-row' }, [
              h('span', { key: 'p', className: 'rs-value', style: { flex: 1 } }, status.projectDir),
              h('button', { key: 'b', type: 'button', className: 'rs-button rs-outline', disabled: busy, onClick: () => { setDraft(status.projectDir) } }, '改目录'),
            ])
          : h('div', { key: 'v', className: 'rs-row' }, [
              h('span', { key: 'i', className: 'rs-input' }, h('input', {
                value: draft,
                autoFocus: true,
                onChange: (event: { target: { value: string } }) => { setDraft(event.target.value) },
                onKeyDown: (event: { key: string }) => { if (event.key === 'Enter') void saveDir(draft) },
              })),
              h('button', {
                key: 'c', type: 'button', className: 'rs-button rs-outline', disabled: busy,
                onClick: () => { void pickDirectory(ctx, (dir) => { void saveDir(dir) }, setError) },
              }, '选择…'),
              h('button', { key: 's', type: 'button', className: 'rs-button rs-primary', disabled: busy, onClick: () => { void saveDir(draft) } }, '保存'),
            ]),
        h('div', { key: 'h', className: 'rs-hint' }, '项目里要有 data/ 和 styles/。插件自带一份模板，默认铺在 ~/.dsh/resume。'),
        error === null ? null : h('div', { key: 'e', className: 'rs-error' }, error),
      ]),

      h('div', { key: 'project', className: 'rs-field' }, [
        h('div', { key: 'l', className: 'rs-label' }, '项目'),
        h('div', { key: 'v', className: 'rs-value' }, status.isProject ? '看起来是简历项目（有 data/ 和 styles/）' : '这个目录里没有 data/ 或 styles/，渲染会失败'),
        h('div', { key: 'h', className: 'rs-hint' }, '渲染器在插件里（Node），不需要装 Python。'),
      ]),

      h('div', { key: 'versions', className: 'rs-field' }, [
        h('div', { key: 'l', className: 'rs-label' }, '预览的版本'),
        status.versions.length === 0
          ? h('div', { key: 'v', className: 'rs-value' }, 'data/ 下还没有版本目录')
          : h('select', {
              key: 's',
              className: 'rs-select',
              value: status.selected ?? '',
              onChange: (event: { target: { value: string } }) => { void selectVersion(event.target.value).then(load) },
            }, status.versions.map((person: string) => h('option', { key: person, value: person }, person))),
        h('div', { key: 'h', className: 'rs-hint' }, 'data/ 下每个目录是一个版本（标准版 / 各公司的目标版）。'),
      ]),

      h('div', { key: 'preview', className: 'rs-field' }, [
        h('div', { key: 'l', className: 'rs-label' }, '预览'),
        h('div', { key: 'v', className: 'rs-value' }, previewState),
        h('div', { key: 'r', className: 'rs-row' }, [
          h('button', { key: 'o', type: 'button', className: 'rs-button rs-primary', onClick: () => { setNotice(openPreviewTab(ctx)) } }, '打开预览'),
          h('button', { key: 'f', type: 'button', className: 'rs-button rs-outline', onClick: () => { void refreshPreview() } }, '刷新'),
        ]),
        h('div', { key: 'h', className: 'rs-hint' }, '改完 YAML / CSS 会自动重建；右栏开着的话改一句变一句。'),
      ]),

      notice === null ? null : h('div', { key: 'n', className: 'rs-hint' }, notice),
    ])
  }

  /** 首次引导弹窗：只确认一件事——简历项目在哪。 */
  function ResumeSetupDialog({ ctx, status, onDone }: { ctx: ClientContext; status: ResumeStatus; onDone: () => void }) {
    const [draft, setDraft] = React.useState<string | null>(null)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const directory = draft ?? status.projectDir

    const dismiss = (): void => {
      void writeConfig({ setupDone: true }).then(onDone, onDone)
    }

    const finish = async (): Promise<void> => {
      setBusy(true); setError(null)
      try {
        const trimmed = directory.trim()
        if (trimmed !== status.projectDir) await writeConfig({ projectDir: trimmed })
        // 目录既然选定了，就让它出现在左栏（已经注册过的话 create 是幂等的）。
        try { await ctx.workspaces.create({ path: trimmed }) } catch { /* 已注册 */ }
        await writeConfig({ setupDone: true })
        onDone()
      } catch (cause) {
        setError(String((cause as Error).message ?? cause))
        setBusy(false)
      }
    }

    return h('div', { className: 'rs-root' }, [
      h('div', { key: 'm', className: 'rs-mask' }),
      h('div', { key: 'd', className: 'rs-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': '简历模式' }, [
        h('div', { key: 'h', className: 'rs-dialogHeader' }, [
          h('h2', { key: 't', className: 'rs-dialogTitle' }, '简历模式'),
          h('button', { key: 'c', type: 'button', className: 'rs-close', 'aria-label': '关闭', onClick: dismiss }, '✕'),
        ]),
        h('div', { key: 'b', className: 'rs-dialogBody' }, [
          h('p', { key: 'p', className: 'rs-text' }, '先确认简历项目在哪：'),
          h('div', { key: 'dir', className: 'rs-field' }, [
            h('div', { key: 'r', className: 'rs-row' }, [
              h('span', { key: 'i', className: 'rs-input' }, h('input', {
                value: directory,
                onChange: (event: { target: { value: string } }) => { setDraft(event.target.value) },
              })),
              h('button', {
                key: 'c', type: 'button', className: 'rs-button rs-outline',
                onClick: () => { void pickDirectory(ctx, setDraft, setError) },
              }, '选择…'),
            ]),
            h('div', { key: 'h', className: 'rs-hint' }, '插件自带一份简历项目模板，已经铺在上面这个目录；有自己的项目就改成那个目录（里面要有 data/ 和 styles/）。'),
          ]),
          error === null ? null : h('div', { key: 'e', className: 'rs-error' }, error),
        ]),
        h('div', { key: 'f', className: 'rs-dialogFooter' }, [
          h('button', { key: 'later', type: 'button', className: 'rs-button rs-outline', disabled: busy, onClick: dismiss }, '稍后再说'),
          h('button', { key: 'done', type: 'button', className: 'rs-button rs-primary', disabled: busy, onClick: () => { void finish() } }, busy ? '处理中…' : '开始改简历'),
        ]),
      ]),
    ])
  }

  /**
   * 左栏「简历」点开后的中栏内容：一个过场。
   * 它自己不留页面——配好了就开一个简历会话，主区域随即回到原本的对话页。
   */
  function ResumeLauncher({ ctx }: { ctx: ClientContext }) {
    const [phase, setPhase] = React.useState<'checking' | 'setup' | 'entering' | 'error'>('checking')
    const [status, setStatus] = React.useState<ResumeStatus | null>(null)
    const [error, setError] = React.useState<string | null>(null)

    const enter = React.useCallback(async (projectDir: string): Promise<void> => {
      setPhase('entering')
      try {
        await enterResumeMode(ctx, projectDir)
      } catch (cause) {
        setPhase('error')
        setError(String((cause as Error).message ?? cause))
      }
    }, [ctx])

    React.useEffect(() => {
      let alive = true
      readStatusWhenReady().then(
        (next) => {
          if (!alive) return
          setStatus(next)
          if (next.setupDone) void enter(next.projectDir)
          else setPhase('setup')
        },
        (cause: Error) => {
          if (!alive) return
          setPhase('error')
          setError(`连不上预览服务：${String(cause.message ?? cause)}。装完插件要重启一次 dsh。`)
        },
      )
      return () => { alive = false }
    }, [enter])

    if (phase === 'setup' && status !== null) {
      return h(ResumeSetupDialog, {
        ctx,
        status,
        onDone: () => { void readStatus().then((next) => { setStatus(next); void enter(next.projectDir) }, () => { setPhase('error') }) },
      })
    }
    if (phase === 'error') {
      return h('div', { className: 'rs-launcher' }, h('div', { className: 'rs-launcherInner' }, [
        h('div', { key: 'e', className: 'rs-error' }, error),
        h('button', { key: 'r', type: 'button', className: 'rs-button rs-outline', onClick: () => { window.location.reload() } }, '重试'),
      ]))
    }
    return h('div', { className: 'rs-launcher' }, h('div', { className: 'rs-launcherInner' }, '正在打开简历模式…'))
  }

  /** 会话头的小按钮：只在「简历顾问」会话里出现，点一下把预览停靠到右栏。 */
  function ResumePreviewButton({ ctx, sessionId, useSessions }: SessionProps & { ctx: ClientContext }) {
    // 只在用「简历顾问」模式的会话里显示；拿不到会话状态就退化成一直显示。
    if (typeof useSessions === 'function' && typeof sessionId === 'string') {
      const preset = useSessions((state) => state.byId[sessionId]?.projectionValues?.agentPreset)
      if (preset !== PRESET_ID) return null
    }
    return h('button', {
      type: 'button',
      className: 'rs-button rs-outline',
      title: '在右栏打开简历预览',
      onClick: () => { openPreviewTab(ctx) },
    }, '简历预览')
  }

  /** 左栏图标（一张简历纸）。 */
  function ResumeIcon({ size = 18 }: { size?: number }) {
    return h('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true },
      h('path', {
        d: 'M6 2.5h8l4.5 4.5v14.5H6z M14 2.5V7h4.5 M9 12h6 M9 16h6',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round',
      }))
  }

  /** 右栏引导页里的图标（一副眼镜，表示"看画面"）。 */
  function PreviewTabIcon({ size = 18 }: { size?: number }) {
    return h('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true },
      h('path', {
        d: 'M2.5 12s3.5-5.5 9.5-5.5S21.5 12 21.5 12s-3.5 5.5-9.5 5.5S2.5 12 2.5 12z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round',
      }))
  }

  /**
   * 右栏预览标签页的 body：**只有画面**——一个铺满的只读 iframe，
   * 没有任何地址栏 / 前进后退 / 工具栏；简历一重建就换 src 自动刷新。
   */
  function ResumePreviewBody() {
    const [stamp, setStamp] = React.useState<string | null>(null)
    React.useEffect(() => {
      let alive = true
      const tick = (): void => {
        readStatus().then(
          (status) => { if (alive) setStamp(status.build.at) },
          () => { /* 服务没起来就先空着，下一轮再试 */ },
        )
      }
      tick()
      const timer = setInterval(tick, PREVIEW_POLL_MS)
      return () => { alive = false; clearInterval(timer) }
    }, [])
    const src = stamp === null ? PREVIEW_URL : `${PREVIEW_URL}?v=${encodeURIComponent(stamp)}`
    return h('div', { style: { position: 'relative', width: '100%', height: '100%' } },
      h('iframe', {
        src,
        title: '简历预览',
        // 只读预览：不给脚本、不给表单、不给导航权限（简历 HTML 是自包含的，不需要这些）。
        sandbox: '',
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: '0', background: '#fff' },
      }))
  }

  return {
    inject: ['slots', 'workspaces', 'uiWorkspace', 'sidebarRight', 'sidebarRightTabs', 'remote', 'remote.settings', 'remote.agentPresets'],
    apply(ctx: ClientContext): void {
      ensureStyles()

      // 右栏预览标签页的类型：只有画面，没有浏览器外壳（地址栏/前进后退那套）
      ctx.effect(() => ctx.sidebarRightTabs.register({
        id: PREVIEW_TAB_ID,
        kind: PREVIEW_TAB_KIND,
        keepMounted: true,
        title: () => '简历预览',
        guide: [{
          id: 'resume-preview',
          order: 40,
          title: () => '简历预览',
          description: () => '只读的简历画面，改完自动刷新',
          icon: PreviewTabIcon,
        }],
      }), 'dsh-resume-mode: preview tab type')

      // 它的内容（按类型的 id 注册）
      ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: PREVIEW_TAB_ID,
      }, ResumePreviewBody))

      // 左栏入口 + 它的中栏过场页（过场后主区域回到对话页）
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: 'resume',
        order: 20,
        label: () => '简历',
      }, ResumeIcon))
      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: 'resume',
      }, () => h(ResumeLauncher, { ctx })))

      // 设置 → 「简历模式」一页
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'resume',
        order: 30,
        label: () => '简历模式',
      }, () => h(ResumeSection, { ctx })))

      // 会话头：一键把预览停靠到右栏
      ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
        name: 'conversation.session.header.actions',
        id: 'resume-preview',
        order: 30,
      }, (props: SessionProps) => h(ResumePreviewButton, { ...props, ctx })))
    },
  }
}

window.__ModuleLoader__.load({
  id: 'dsh-resume-mode',
  factory: createPlugin,
})
