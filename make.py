#!/usr/bin/env python3
"""简历一键产出：校验 → HTML → PDF → 分页 PNG → 长图。

唯一入口，子命令式：
    python make.py                    # 一键全流程（校验 + 构建 + PDF + 图片）
    python make.py validate           # 只校验 YAML（AI 写完后自查）
    python make.py --person me
    python make.py --no-images        # 跳过图片（只构建 + PDF）
    python make.py --no-pdf           # 跳过 PDF（只构建 + 长图）

执行链（默认）：
    0. validate  YAML 结构校验（发现问题即停）
    1. build     YAML → HTML
    2. export    HTML → PDF（A4，CSS @page 边距）
    3. images    PDF → 分页 PNG（300dpi）+ 整页长图

产物目录：output/{person}-{YYYYMMDD-HHMMSS}/
    me-20260816-171234.html
    me-20260816-171234.pdf
    me-20260816-171234-page1.png ...
    me-20260816-171234-long.png

依赖：PyYAML + playwright + PyMuPDF，全部装在本仓库 .venv。
"""
import argparse
import os
import sys
from datetime import datetime

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, 'output')


def cmd_validate(args) -> int:
    from src.builder import validate
    problems = validate(person=args.person)
    if problems:
        for p in problems:
            print(f'ERR {p}')
        print(f'共 {len(problems)} 个问题')
        return 1
    print('全部通过')
    return 0


def cmd_build(args) -> int:
    person = args.person
    ts = datetime.now().strftime('%Y%m%d-%H%M%S')
    folder = os.path.join(OUT, f'{person}-{ts}')
    os.makedirs(folder, exist_ok=True)

    # 0/4 校验（发现问题即停）
    from src.builder import validate
    problems = validate(person=person)
    if problems:
        for p in problems:
            print(f'ERR {p}')
        print(f'校验未通过，共 {len(problems)} 个问题，构建中止', file=sys.stderr)
        return 1

    # 1/4 构建
    print(f'== 1/4 构建 HTML（{person}）==')
    from src.builder import build
    html = build(person=person, output_dir=folder)
    if not html:
        print('构建失败', file=sys.stderr)
        return 1
    print('done:', html)
    base = os.path.splitext(os.path.basename(html))[0]
    pdf_path = os.path.join(folder, f'{base}.pdf')
    long_path = os.path.join(folder, f'{base}-long.png')
    url = 'file:///' + html.replace(os.sep, '/')

    # 2/4 PDF
    if not args.no_pdf:
        print('== 2/4 导出 PDF ==')
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b = p.chromium.launch()
            page = b.new_page()
            page.goto(url)
            page.wait_for_timeout(400)
            page.pdf(path=pdf_path, format='A4', print_background=True,
                     prefer_css_page_size=True)
            b.close()
        print('done:', pdf_path)

    # 3/4 图片
    if args.no_images:
        print('== 跳过图片 ==')
    else:
        print('== 3/4 截图（长图 + 分页 PNG）==')
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b = p.chromium.launch()
            page = b.new_page(viewport={'width': 794, 'height': 1123},
                              device_scale_factor=2)
            page.goto(url)
            page.wait_for_timeout(400)
            page.screenshot(path=long_path, full_page=True)
            b.close()
        print('done:', long_path)

        if not args.no_pdf:
            import fitz
            doc = fitz.open(pdf_path)
            for i, pg in enumerate(doc):
                png = os.path.join(folder, f'{base}-page{i + 1}.png')
                pix = pg.get_pixmap(dpi=300)
                pix.save(png)
                print(f'done: {png} ({pix.width}x{pix.height})')
            print(f'共 {doc.page_count} 页')
            doc.close()

    print(f'\n完成 → {folder}')
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description='简历一键产出（校验 + 构建 + PDF + 截图）')
    sub = ap.add_subparsers(dest='command')

    p_build = sub.add_parser('build', help='构建 + 导出（默认命令）')
    p_build.add_argument('--person', default='me')
    p_build.add_argument('--no-images', action='store_true', help='跳过图片（只构建 + PDF）')
    p_build.add_argument('--no-pdf', action='store_true', help='跳过 PDF（只构建 + 长图）')
    p_build.set_defaults(func=cmd_build)

    p_val = sub.add_parser('validate', help='只校验 YAML（AI 写完后自查）')
    p_val.add_argument('--person', default='me')
    p_val.set_defaults(func=cmd_validate)

    # 兼容：无子命令时按 build 处理
    if len(sys.argv) == 1:
        sys.argv.append('build')

    args = ap.parse_args()
    if not hasattr(args, 'func'):
        ap.print_help()
        return 1
    return args.func(args)


if __name__ == '__main__':
    raise SystemExit(main())
