/**
 * PDF / 长图导出 — 浏览器渲染那一段（原 make.py 的 2/4、3/4 步）。
 *
 * 能力分层（纯 HTML 构建永远不经过这里）：
 *   ① 系统的 Chromium 内核浏览器 —— Windows 的 Edge 系统自带，其次 Chrome。
 *      puppeteer-core 只做驱动（几 MB，不含浏览器），复用系统已装的内核，
 *      headless 里 printToPDF / 全页截图，零下载；与预览同为 Chromium 系，所见即所得；
 *   ② 可选的 playwright 包（自带 Chromium，约 100MB+）——运行时按需加载；
 *   ③ 都不可用 → 抛带指引的错误。
 *
 * playwright 与 puppeteer-core 在 setContent / pdf / screenshot / newPage 上形状
 * 一致，一套手写接口面对两者；waitForTimeout 只有 playwright 有，等待统一用
 * setTimeout。两个驱动都走运行时动态 import（说明符用变量，避免打包器解析，
 * 也保证驱动缺失时绝不拖垮宿主行的激活）。
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

/** 渲染驱动的页面接口（两家驱动都实现这一形状）。 */
interface DriverPage {
  setContent(html: string, options?: Record<string, unknown>): Promise<void>
  pdf(options: Record<string, unknown>): Promise<void>
  screenshot(options: Record<string, unknown>): Promise<void>
}

/** 渲染驱动的浏览器接口。 */
interface DriverBrowser {
  newPage(options?: Record<string, unknown>): Promise<DriverPage>
  close(): Promise<void>
}

/** 可按 executablePath 启动的驱动（puppeteer-core）。 */
interface DriverLauncher {
  launch(options: Record<string, unknown>): Promise<DriverBrowser>
}

const FALLBACK_HINT = [
  'PDF / 长图渲染需要一个 Chromium 内核的浏览器，当前环境两样都没有：',
  '  · 没找到系统浏览器（Windows 自带的 Microsoft Edge 就够，装上即可）；',
  '  · 也没安装可选的 playwright 包（npm install playwright && npx playwright install chromium）。',
  '不装也能用：HTML 已导出，双击用浏览器打开后 Ctrl+P 可另存为 PDF。',
].join('\n')

/**
 * 系统 Chromium 内核浏览器探测顺序：Windows 的 Edge（系统自带）→ Chrome 的常规
 * 安装位 → macOS 的两个 .app → Linux 常见命令名（走 PATH）。命中第一个存在的。
 */
const BROWSER_CANDIDATES: readonly string[] = [
  process.env['ProgramFiles(x86)'] === undefined ? '' : `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  process.env.ProgramFiles === undefined ? '' : `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  process.env.ProgramFiles === undefined ? '' : `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  process.env['ProgramFiles(x86)'] === undefined ? '' : `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
  process.env.LOCALAPPDATA === undefined ? '' : `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'msedge',
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
].filter((entry) => entry !== '')

/** 返回第一个可用的浏览器可执行路径；全都没有则 null。 */
function findSystemBrowser(): string | null {
  for (const candidate of BROWSER_CANDIDATES) {
    if (candidate.includes('\\') || candidate.includes('/')) {
      if (existsSync(candidate)) return candidate
    } else {
      // PATH 里的命令名（Linux 常见包名）：--version 能跑就算存在
      const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore' })
      if (probe.status === 0) return candidate
    }
  }
  return null
}

/** 系统浏览器路径（puppeteer-core 驱动）。 */
async function launchSystemBrowser(executablePath: string): Promise<DriverBrowser> {
  const specifier = 'puppeteer-core'
  const loaded = (await import(specifier)) as { default: DriverLauncher }
  return await loaded.default.launch({
    executablePath,
    headless: true,
    // 内容是我们自己渲染的自包含 HTML，不是不可信网页，--no-sandbox 换取环境兼容
    args: ['--no-sandbox', '--hide-scrollbars', '--no-first-run'],
  })
}

/** playwright 兜底（可选依赖，没装报带指引的错误）。 */
async function launchPlaywright(): Promise<DriverBrowser> {
  const specifier = 'playwright'
  const loaded = (await import(specifier).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`${FALLBACK_HINT}\n（playwright 加载失败：${reason}）`)
  })) as { chromium?: { launch(): Promise<DriverBrowser> } }
  if (loaded.chromium === undefined) throw new Error(FALLBACK_HINT)
  return await loaded.chromium.launch()
}

/** 依次尝试系统浏览器与 playwright；失败给出「试到哪一步、为什么」。 */
async function launchRenderer(): Promise<{ browser: DriverBrowser; via: string }> {
  const executablePath = findSystemBrowser()
  if (executablePath !== null) {
    try {
      return { browser: await launchSystemBrowser(executablePath), via: executablePath }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.error(`[dsh-resume] 系统浏览器 ${executablePath} 启动失败，转 playwright：${reason}`)
    }
  }
  return { browser: await launchPlaywright(), via: 'playwright' }
}

/** 等排版与字体稳定：load 事件之后给渲染一点余量。 */
async function settle(milliseconds: number): Promise<void> {
  await new Promise((resolve) => { setTimeout(resolve, milliseconds) })
}

/** HTML → PDF（A4，CSS @page 边距，背景打印）。 */
export async function exportPdf(html: string, file: string): Promise<void> {
  const { browser, via } = await launchRenderer()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    await settle(400)
    await page.pdf({
      path: file,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    })
  } finally {
    await browser.close()
  }
  console.log(`[dsh-resume] PDF 已由 ${via} 渲染：${file}`)
}

/** HTML → 整页长图 PNG（794x1123 视口，2 倍像素密度）。 */
export async function exportLongImage(html: string, file: string): Promise<void> {
  const { browser, via } = await launchRenderer()
  try {
    const page = await browser.newPage({
      viewport: { width: 794, height: 1123 },
      deviceScaleFactor: 2,
    })
    await page.setContent(html, { waitUntil: 'load' })
    await settle(400)
    await page.screenshot({ path: file, fullPage: true })
  } finally {
    await browser.close()
  }
  console.log(`[dsh-resume] 长图已由 ${via} 渲染：${file}`)
}
