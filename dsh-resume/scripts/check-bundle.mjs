/**
 * client bundle 装载契约自检（prepack 阶段跑，不通过就不许打包/发版）。
 *
 * 查的是宿主真正依赖、而 TypeScript 完全看不见的两件事——2026-11-04 桌面版起不来的
 * 那两条根因，都是这里漏掉的：
 *
 * ① 注册 id 必须逐字等于 package.json 的 name。
 *    宿主按包名建 boot 图（client-modules 的 graphRow(packageName, …)），再拿包名回查
 *    __ModuleLoader__ 注册的工厂。id 写成别的名字（例如 cordis 行 id）→ 这个 entry
 *    永远「loaded without registering」→ web boot 失败、桌面弹「应用无法启动」。
 *
 * ② 整个模块体必须在 factory 闭包里，且重复执行不能炸。
 *    产物是 classic script（不是 module）：顶层 const 会落进页面全局词法环境。
 *    同一份脚本被第二次执行（immediate 预取 + Loader 导入、HMR 代码替换）就
 *    `Identifier 'API' has already been declared`，报错还指向脚本第一行，
 *    把真因遮得干干净净。
 *
 * 做法不是正则猜：真的在同一个 vm 上下文里执行两遍，用一个模拟宿主的 loader 观察
 * 注册了谁、第二次抛的是什么、全局有没有被污染。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

/**
 * 建一个最小页面环境：`window.__ModuleLoader__` 按宿主的 ClientModuleSystem#register
 * 的行为——同一个 id 只许登记一次，第二次直接抛。
 * @returns 上下文与登记表。
 */
function newSandbox() {
  const registered = []
  const loader = {
    mode: 'live',
    load(registration) {
      const id = registration?.id
      if (typeof id !== 'string') throw new Error('client-modules: registration without id')
      if (registered.includes(id)) {
        throw new Error(`client-modules: duplicate factory registration for "${id}"`)
      }
      if (typeof registration.factory !== 'function') throw new Error(`client-modules: ${id} registration without factory`)
      registered.push(id)
    },
  }
  return { registered, context: vm.createContext({ window: { __ModuleLoader__: loader }, console }) }
}

/** 执行一遍 bundle，返回抛出的错误（没抛就是 undefined）。 */
function execute(source, context) {
  try {
    vm.runInContext(source, context, { filename: 'client.js' })
    return undefined
  } catch (thrown) {
    return thrown
  }
}

/**
 * 闭包收口前的最后一行代码。宿主拼组合脚本时会在末尾追加 `;` 和
 * `//# sourceMappingURL=…`，所以比对前要把这类尾巴剥掉——磁盘产物和线上产物
 * 都用同一套判定。
 * @param source - bundle 文本。
 * @returns 最后一行有效代码。
 */
function tailCode(source) {
  const lines = source.trimEnd().split('\n')
  while (lines.length > 0) {
    const line = lines[lines.length - 1].trim()
    if (line === ';' || line.startsWith('//# sourceMappingURL=')) {
      lines.pop()
      continue
    }
    break
  }
  return (lines[lines.length - 1] ?? '').trim()
}

/**
 * 校验一个构建产物。
 * @param root - 插件根目录。
 * @returns 问题列表；空数组表示通过。
 */
export function checkBundle(root = ROOT) {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  const source = readFileSync(path.join(root, 'lib', 'client.js'), 'utf8')
  const problems = []

  const head = source.slice(0, source.indexOf('\n')).trim()
  const expectedHead = `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {`
  if (head !== expectedHead) problems.push(`首行不是登记头：期望 ${expectedHead}，实际 ${head}`)

  const body = tailCode(source)
  if (body !== '} });') problems.push(`末行不是闭包收口：实际 ${body}`)

  const sandbox = newSandbox()
  const first = execute(source, sandbox.context)
  if (first !== undefined) {
    problems.push(`第一次执行就抛错：${first}`)
  } else {
    if (sandbox.registered.length !== 1 || sandbox.registered[0] !== pkg.name) {
      problems.push(`注册 id 与包名不一致：注册了 ${JSON.stringify(sandbox.registered)}，包名是 ${JSON.stringify(pkg.name)}`)
    }
    const leaked = vm.runInContext(
      'typeof API !== "undefined" || typeof CSS !== "undefined" || typeof createPlugin !== "undefined"',
      sandbox.context,
    )
    if (leaked === true) problems.push('模块体泄漏到页面全局词法环境（顶层声明没被 factory 包住）')
  }

  // 同一份脚本、同一个上下文再执行一遍：闭包形态只会在登记处被宿主拦下，绝不该是 SyntaxError。
  const second = execute(source, sandbox.context)
  if (second === undefined) {
    problems.push('第二次执行没有报错，说明登记逻辑没走宿主 loader')
  } else if (second.name === 'SyntaxError') {
    problems.push(`第二次执行抛 SyntaxError（顶层声明没进闭包）：${second.message}`)
  } else if (!String(second.message).includes('duplicate factory registration')) {
    problems.push(`第二次执行的报错不是宿主的重复登记：${second}`)
  }

  return problems
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkBundle()
  if (problems.length > 0) {
    console.error('client bundle 契约自检未通过：')
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exit(1)
  }
  console.log('client bundle 契约自检通过：id 与包名一致、模块体在闭包内、二次执行不炸。')
}
