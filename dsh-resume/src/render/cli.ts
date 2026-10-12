/**
 * 命令行入口 —— 对齐原来的 make.py（不带 watch）：
 *     node lib/render/cli.js validate --person me
 *     node lib/render/cli.js build --person me
 *     node lib/render/cli.js build --person me --layout two-column --no-pdf --no-images
 *     node lib/render/cli.js build --person me --out <目录>
 *
 * 产物目录：--out 给了就用它，否则 <root>/output/{person}-{YYYYMMDD-HHMMSS}/，
 * 文件名 {person}-{时间戳}.html / .pdf / -long.png。
 *
 * --root 是项目根目录（含 data/ styles/ layouts/ assets/），缺省当前工作目录；
 * 从项目根跑（make.mjs 就是这么转发的）不用传。
 */

import fs from 'node:fs'
import path from 'node:path'

import { build, formatTimestamp, validate } from './builder.ts'
import { exportLongImage, exportPdf } from './pdf.ts'

interface Args {
  readonly command: 'build' | 'validate'
  readonly person: string
  readonly layout: string
  readonly noPdf: boolean
  readonly noImages: boolean
  readonly out: string | undefined
  readonly root: string
}

type Parsed = { kind: 'args'; args: Args } | { kind: 'help' } | { kind: 'error'; message: string }

const USAGE = `用法：
  node lib/render/cli.js validate --person me
  node lib/render/cli.js build --person me [--layout two-column] [--no-pdf] [--no-images] [--out 目录]

  --person <名字>   版本名（data/ 下的子目录），缺省 me
  --layout <名字>   布局名（layouts/ 下，不带 .html），缺省 default
  --no-pdf          跳过 PDF
  --no-images       跳过图片（长图）
  --out <目录>      输出目录，缺省 <项目根>/output/<person>-<时间戳>/
  --root <目录>     项目根目录，缺省当前工作目录
  -h, --help        显示这段帮助`

function parseArgs(argv: readonly string[]): Parsed {
  const args: {
    command: 'build' | 'validate'
    person: string
    layout: string
    noPdf: boolean
    noImages: boolean
    out: string | undefined
    root: string
  } = {
    command: 'build',
    person: 'me',
    layout: 'default',
    noPdf: false,
    noImages: false,
    out: undefined,
    root: process.cwd(),
  }

  let index = 0
  const first = argv[0]
  if (first === 'build' || first === 'validate') {
    args.command = first
    index = 1
  } else if (first !== undefined && !first.startsWith('-')) {
    return { kind: 'error', message: `未知子命令 ${first}` }
  }

  for (; index < argv.length; index += 1) {
    const token = argv[index] ?? ''
    const [flag, inlineValue] = token.includes('=')
      ? [token.slice(0, token.indexOf('=')), token.slice(token.indexOf('=') + 1)]
      : [token, undefined]

    const takeValue = (): string | undefined => {
      if (inlineValue !== undefined) return inlineValue
      index += 1
      return argv[index]
    }

    switch (flag) {
      case '-h':
      case '--help':
        return { kind: 'help' }
      case '--person': {
        const value = takeValue()
        if (value === undefined) return { kind: 'error', message: '--person 缺少值' }
        args.person = value
        break
      }
      case '--layout': {
        const value = takeValue()
        if (value === undefined) return { kind: 'error', message: '--layout 缺少值' }
        args.layout = value
        break
      }
      case '--out': {
        const value = takeValue()
        if (value === undefined) return { kind: 'error', message: '--out 缺少值' }
        args.out = value
        break
      }
      case '--root': {
        const value = takeValue()
        if (value === undefined) return { kind: 'error', message: '--root 缺少值' }
        args.root = value
        break
      }
      case '--no-pdf':
        args.noPdf = true
        break
      case '--no-images':
        args.noImages = true
        break
      default:
        return { kind: 'error', message: `未知参数 ${token}` }
    }
  }

  args.root = path.resolve(args.root)
  return { kind: 'args', args }
}

function commandValidate(args: Args): number {
  const problems = validate(args.root, args.person)
  if (problems.length > 0) {
    for (const problem of problems) console.log(`ERR ${problem}`)
    console.log(`共 ${problems.length} 个问题`)
    return 1
  }
  console.log('全部通过')
  return 0
}

async function commandBuild(args: Args): Promise<number> {
  const { root, person } = args
  const folder = args.out ?? path.join(root, 'output', `${person}-${formatTimestamp(new Date())}`)
  fs.mkdirSync(folder, { recursive: true })

  // 0/4 校验（发现问题即停）
  const problems = validate(root, person)
  if (problems.length > 0) {
    for (const problem of problems) console.log(`ERR ${problem}`)
    console.error(`校验未通过，共 ${problems.length} 个问题，构建中止`)
    return 1
  }

  // 1/4 构建
  console.log(`== 1/4 构建 HTML（${person}）==`)
  const result = build({ root, person, layout: args.layout, outputDir: folder })
  if (result === null || result.path === null) {
    console.error('构建失败')
    return 1
  }
  console.log('done:', result.path)
  const base = path.basename(result.path, path.extname(result.path))
  const pdfPath = path.join(folder, `${base}.pdf`)
  const longPath = path.join(folder, `${base}-long.png`)

  // 2/4 PDF
  if (!args.noPdf) {
    console.log('== 2/4 导出 PDF ==')
    await exportPdf(result.html, pdfPath)
    console.log('done:', pdfPath)
  }

  // 3/4 图片
  if (args.noImages) {
    console.log('== 跳过图片 ==')
  } else {
    console.log('== 3/4 截图（长图）==')
    await exportLongImage(result.html, longPath)
    console.log('done:', longPath)
  }

  console.log(`\n完成 → ${folder}`)
  return 0
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.kind === 'help') {
    console.log(USAGE)
    return 0
  }
  if (parsed.kind === 'error') {
    console.error(`${parsed.message}\n\n${USAGE}`)
    return 2
  }
  if (parsed.args.command === 'validate') return commandValidate(parsed.args)
  return commandBuild(parsed.args)
}

process.exitCode = await main()
