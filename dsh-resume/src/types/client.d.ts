/**
 * 浏览器端（client half）用到的宿主 API 类型。
 *
 * 照抄自 dsh 0.2.0-rc.2 已安装包的 .d.ts / 官方模板：
 *   dsh-client-modules/lib/types/client/manifest.d.ts   —— `window.__ModuleLoader__.load` 的形状
 *   dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts        —— sidebar.panellist
 *   dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts   —— conversation.session.header.actions
 *   dsh-client-ui-settings/lib/types/client/contract/slots.d.ts       —— settings.section / settings.onboarding
 *   dsh-api-workspace-controller/lib/types/client/service.d.ts        —— ctx.workspaces
 *   dsh-client-ui-workspace/lib/types/client/navigation.d.ts          —— ctx.uiWorkspace
 *   dsh-client-ui-sidebar-right/lib/types/client/service.d.ts         —— ctx.sidebarRight
 *
 * 只声明我们用到的部分；升级 dsh 后照新版复核。
 */

/** 浏览器模块表：`require('react')` 这类基线模块由宿主提供。 */
export type ClientRequire = (id: string) => unknown

/**
 * 我们用到的 React 表面。
 * 浏览器端拿不到 `@types/react`（插件不依赖宿主前端包），所以按用法手抄一份。
 */
export interface ReactLike {
  createElement(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown
  useState<T>(initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void]
  useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void
  useCallback<T extends (...args: never[]) => unknown>(callback: T, deps: readonly unknown[]): T
}

/** 一个 client 插件：`{ inject, apply }`。 */
export interface ClientPlugin {
  readonly inject: readonly string[]
  apply(ctx: ClientContext): void
}

/** `window.__ModuleLoader__.load` 的入参。 */
export interface ClientBundleRegistration {
  /** 必须是包名（与 package.json 的 name 一致）。 */
  readonly id: string
  /** 惰性工厂：首次被引用时执行一次，返回插件对象。 */
  readonly factory: (require: ClientRequire) => ClientPlugin
}

/** 一个已注册的工作区。 */
export interface WorkspaceView {
  readonly workspaceId: string
  readonly path: string
  readonly title: string
}

/** 槽位注册选项（各槽位自己的字段不同，这里只列通用的）。 */
export interface SlotOptions {
  readonly name: string
  readonly id?: string
  readonly order?: number
  readonly label?: () => string
  readonly key?: string
}

/** 可观察快照（`getSnapshot` + `subscribe`）。 */
export interface ObservableSnapshot<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/** Remote 调用的结果（`ok` 为假时带 error）。 */
export interface RemoteResult {
  readonly ok: boolean
  readonly error?: { readonly message: string }
}

/** 右栏标签页类型的静态声明（照 dsh-client-ui-sidebar-right 的 tab-registry.d.ts 手抄）。 */
export interface SidebarRightTabDefinition {
  /** 本实现的身份，唯一；同时是 body 在 `sidebar.right.pane.tab` 里注册用的 key。 */
  readonly id: string
  /** 类型判别值：`openTab(kind)` 用它。 */
  readonly kind: string
  /** 每次打开都独立（缺省：每个面板里同 kind 只留一个）。 */
  readonly multiple?: boolean
  /** 藏起来/换会话时是否保留已挂载的 body。 */
  readonly keepMounted?: boolean
  /** 页类型的判别值，缺省 'extension'（第三方）。 */
  readonly priority?: 'extension' | 'builtin' | 'fallback'
  /** 标签页标题。 */
  readonly title: (address: string) => string
  /** 右栏引导页里的入口。 */
  readonly guide?: readonly {
    readonly id: string
    readonly order: number
    readonly title: () => string
    readonly description?: () => string
    readonly icon?: unknown
  }[]
}

/** 浏览器端插件上下文（只声明我们用到的服务）。 */
export interface ClientContext {
  /** 注册一个随上下文释放的资源；返回释放函数。 */
  effect(callback: () => void | (() => void), label?: string): () => void
  readonly slots: {
    /** 等某个槽位被声明出来再注册；返回释放函数。 */
    inject(name: string, callback: () => void): () => void
    /** 往槽位里注册一个条目。 */
    register(options: SlotOptions, component: unknown): () => void
  }
  readonly workspaces: {
    readonly list: ObservableSnapshot<{ readonly items: readonly WorkspaceView[] }>
    create(input: { path: string }): Promise<WorkspaceView>
  }
  readonly uiWorkspace: {
    /** 在某个工作区开一个会话（复用已有空白会话），主区域回到对话页。 */
    startSession(workspaceId?: string): void
    /** 官方目录选择器：桌面端系统对话框，web 端内置浏览。 */
    pickDirectory(): Promise<string | null>
  }
  readonly sidebarRight: {
    /** 当前在屏的会话（全局面板占着主区域时为 undefined）。 */
    readonly mounted: ObservableSnapshot<string | undefined>
    openTab(kind: string, options?: { params?: Record<string, unknown> }): void
  }
  /** 右栏标签页类型注册表。 */
  readonly sidebarRightTabs: {
    register(definition: SidebarRightTabDefinition): () => void
  }
  readonly remote: {
    readonly settings: {
      update(namespace: string, patch: Record<string, unknown>, expectedRevision?: unknown): Promise<RemoteResult>
    }
    readonly agentPresets: {
      /** 只给这一个会话设模式（等价于在新会话页的模式选择器里点一下）。 */
      select(sessionId: string, presetId: string): Promise<RemoteResult>
    }
  }
}

declare global {
  interface Window {
    readonly __ModuleLoader__: { load(registration: ClientBundleRegistration): void }
  }
}
