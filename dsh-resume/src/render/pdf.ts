/**
 * PDF / 长图导出 — 浏览器截图那一段（原 make.py 的 2/4、3/4 步）。
 *
 * playwright 是可选的：没装就抛一个带安装指引的错误，不影响纯 HTML 构建。
 * 原来的分页 PNG 走 PyMuPDF（fitz）把 PDF 逐页光栅化，JS 侧没有等价依赖，
 * 公开 API 也只暴露 PDF 与长图，故不再产出分页 PNG。
 */

interface Page {
  setContent(html: string, options?: Record<string, unknown>): Promise<void>
  waitForTimeout(milliseconds: number): Promise<void>
  pdf(options: Record<string, unknown>): Promise<void>
  screenshot(options: Record<string, unknown>): Promise<void>
}

interface Browser {
  newPage(options?: Record<string, unknown>): Promise<Page>
  close(): Promise<void>
}

interface Chromium {
  launch(): Promise<Browser>
}

const INSTALL_HINT = [
  '导出 PDF / 长图需要可选的 playwright 包：',
  '  npm install playwright',
  '  npx playwright install chromium',
].join('\n')

async function loadChromium(): Promise<Chromium> {
  // playwright 是可选依赖：不进 package.json，所以静态 import 会让 tsc / 打包器
  // 在它没装时直接报错——只能在运行时按需加载（说明符用变量，避免被打包器解析）。
  const specifier = 'playwright'
  let loaded: { chromium?: Chromium }
  try {
    loaded = (await import(specifier)) as { chromium?: Chromium }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`${INSTALL_HINT}\n（${reason}）`)
  }
  if (!loaded.chromium) throw new Error(INSTALL_HINT)
  return loaded.chromium
}

/** HTML → PDF（A4，CSS @page 边距，背景打印）。 */
export async function exportPdf(html: string, file: string): Promise<void> {
  const chromium = await loadChromium()
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    await page.waitForTimeout(400)
    await page.pdf({
      path: file,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    })
  } finally {
    await browser.close()
  }
}

/** HTML → 整页长图 PNG（794x1123 视口，2 倍像素密度）。 */
export async function exportLongImage(html: string, file: string): Promise<void> {
  const chromium = await loadChromium()
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({
      viewport: { width: 794, height: 1123 },
      deviceScaleFactor: 2,
    })
    await page.setContent(html, { waitUntil: 'load' })
    await page.waitForTimeout(400)
    await page.screenshot({ path: file, fullPage: true })
  } finally {
    await browser.close()
  }
}
