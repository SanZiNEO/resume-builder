/**
 * 我们用到的宿主 API 的类型声明。
 *
 * 这些声明**照着已安装的 dsh 0.2.0-rc.2 包里的 .d.ts 手抄**（不是猜的），只覆盖插件真正碰到的那几个面。
 * 对照来源（本地安装路径，仅供人工核对）：
 *   ~/.dsh/profiles/resume/node_modules/@deepseek-ai/dsh-tools/lib/types/index.d.ts
 *   ~/.dsh/profiles/resume/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/service.d.ts
 *   ~/.dsh/profiles/resume/node_modules/@deepseek-ai/dsh-api-workspace-controller/lib/types/**\/*.d.ts
 *   ~/.dsh/profiles/resume/node_modules/@deepseek-ai/dsh-client-ui-settings/lib/types/client/contract/slots.d.ts
 *   ~/.dsh/profiles/resume/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts
 *
 * 为什么不直接依赖宿主的类型包：`@deepseek-ai/dsh-tools` 等并没有按 0.2.0-rc.2 发到 npm
 * （npm 上只有 0.0.1-rc.1 的空壳），装不上；而插件是随包分发的第三方 bundle，
 * 不该在构建期拉整个宿主。所以手抄一份：够用、可对照、可评审。
 *
 * 升级 dsh 后：对着新版 .d.ts 复核本文件，尤其是签名与命名空间名。
 * 注意：本文件是 ambient 声明，**不能有顶层 import/export**（否则会变成模块增补而不是模块声明）。
 */

declare module '@deepseek-ai/cordis' {
  /** 会话执行上下文里我们能拿到的部分。 */
  export interface SessionHeader {
    readonly cwd?: string
  }

  /** 一次工具执行的信息（守卫与工具本体都用它）。 */
  export interface ToolExecution {
    readonly name: string
    readonly arguments?: Record<string, unknown>
    readonly agent?: {
      readonly session?: { readonly header?: SessionHeader }
    }
  }

  /** 工具运行时（`ctx.tools`）。 */
  export interface ToolsService {
    /**
     * 单调守卫：返回字符串 = 拒绝（理由回给模型），返回 undefined = 放行。
     * 挂在普通 ctx 上是全局的；挂在 agent / preset 作用域上只对该作用域生效。
     */
    guard(guard: (exec: ToolExecution) => string | undefined): () => void
    /** 注册工具；返回注销函数。定义本身由 `defineTool` 造，所以这里只要求它的形状。 */
    register(definition: unknown): () => void
  }

  /** 预览构建的状态（host 半 `resumeProject` 服务里的一个字段）。 */
  export interface ResumeBuildState {
    html: string | null
    at: string | null
    error: string | null
    building: boolean
  }

  /** 预览服务的状态（控制页/引导窗读它）。 */
  export interface ResumeStatus {
    readonly projectDir: string
    readonly projectDirSource: 'ui' | 'config' | 'default'
    readonly templateDir: string
    readonly isProject: boolean
    readonly versions: readonly string[]
    readonly selected: string | undefined
    readonly previewUrl: string
    readonly setupDone: boolean
    readonly build: { readonly at: string | null; readonly error: string | null; readonly building: boolean }
  }

  /**
   * 本插件 host 半提供的服务（`src/index.ts` 的 ResumeProject）。
   * 声明在这里，实现从本文件 `import type` 走，避免两处各写一遍。
   */
  export interface ResumeProjectService {
    /** 生效的项目目录（控制页写的 > 配置行 > 默认；首次使用会把自带模板铺好）。 */
    dir(): Promise<string>
    /** 当前选中的版本（控制页可改，缺省 data/ 下第一个）。 */
    selectedPerson(): Promise<string | undefined>
    /** 切选中版本并重建预览。 */
    select(person: string | undefined): Promise<void>
    /** 设置项目目录并重启预览服务。 */
    setDir(dir: string): Promise<ResumeStatus>
    /** 状态快照。 */
    status(): Promise<ResumeStatus>
    /** 确保预览服务在跑。 */
    ensurePreview(): Promise<string>
    /** 重建预览（渲染到内存，不堆 output/）。 */
    rebuild(): Promise<ResumeBuildState>
    /** 导出：先 validate 再 build，返回给模型看的文本。 */
    exportResume(options?: { person?: string | undefined; format?: string | undefined }): Promise<string>
  }

  /** 插件上下文（只声明我们用到的部分）。 */
  export interface Context {
    /** 注册一个随上下文释放的资源；返回释放函数。 */
    effect(callback: () => void | (() => void), label?: string): () => void
    /** 取已注册的服务/命名空间；没 inject 的命名空间会抛 "cannot get property ... without inject"。 */
    get(name: string): unknown
    readonly tools: ToolsService
    /** 本插件 host 半提供的服务。 */
    readonly resumeProject: ResumeProjectService
  }

  /** cordis 服务基类：`super(ctx, '<服务名>')` 即把服务挂到该名字下。 */
  export class Service {
    constructor(ctx: Context, name: string)
    readonly ctx: Context
  }
}

declare module '@deepseek-ai/schemastery' {
  /** 只声明我们用到的 schema 方法。 */
  export interface Schema<T> {
    default(value: T): Schema<T>
    description(text: string): Schema<T>
    required(): Schema<T>
  }
  export interface SchemaFactory {
    string(): Schema<string>
    number(): Schema<number>
    boolean(): Schema<boolean>
    object<T extends Record<string, unknown>>(shape: T): Schema<T>
  }
  const z: SchemaFactory
  export default z
}

declare module '@deepseek-ai/dsh-tools' {
  /** 工具执行上下文里我们能拿到的部分。 */
  export interface ToolRunContext {
    readonly agent?: {
      readonly session?: { readonly header?: { readonly cwd?: string } }
    }
  }

  /** 参数 DSL：`{ 名字: { type, required?, description? } }`。 */
  export type ParameterSchemaSpec = Record<string, unknown>

  /** 工具定义。 */
  export interface ToolDefinition {
    readonly name: string
    readonly description: string
    readonly parameters: ParameterSchemaSpec
    readonly output: {
      readonly schema: unknown
      render(args: unknown, value: unknown): readonly unknown[]
    }
    execute(args: Record<string, unknown>, exec: ToolRunContext): Promise<unknown>
  }

  /** 定义一个工具。 */
  export function defineTool(options: {
    name: string
    description: string
    parameters: ParameterSchemaSpec
    output: { schema: unknown; render(args: unknown, value: unknown): readonly unknown[] }
    execute(args: Record<string, unknown>, exec: ToolRunContext): Promise<unknown>
  }): ToolDefinition
}
