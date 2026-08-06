# -*- coding: utf-8 -*-
"""简历一键转 PDF + A4 分页 PNG + 整页长图

用法（用 web-scout/.venv 的 python）:
    E:/Documents/GitHub/web-scout/.venv/Scripts/python.exe screenshot.py [person] [mode]

参数:
    person  默认 me（对应 output/me-*.html）
    mode    all=PDF+分页PNG+长图（默认）| pdf | pages | long

说明:
    PDF 由 Playwright 按 CSS @page 渲染（边距=简历设计值，不受浏览器打印
    对话框设置影响）；分页 PNG 由 PyMuPDF 以 300dpi 渲染 PDF 每页。
"""
import glob
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, 'output')


def find_latest_html(person: str) -> str | None:
    files = sorted(glob.glob(os.path.join(OUT, f'{person}-*.html')))
    return files[-1] if files else None


def main() -> int:
    person = sys.argv[1] if len(sys.argv) > 1 else 'me'
    mode = sys.argv[2] if len(sys.argv) > 2 else 'all'
    html = find_latest_html(person)
    if not html:
        print(f'未找到 output/{person}-*.html，请先执行 build')
        return 1

    base = os.path.splitext(os.path.basename(html))[0]
    pdf_path = os.path.join(OUT, f'{base}.pdf')
    long_path = os.path.join(OUT, f'{base}-long.png')
    url = 'file:///' + html.replace(os.sep, '/')

    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()

        if mode in ('all', 'long'):
            page = browser.new_page(viewport={'width': 794, 'height': 1123},
                                    device_scale_factor=2)
            page.goto(url)
            page.wait_for_timeout(400)
            page.screenshot(path=long_path, full_page=True)
            print(f'[长图] {long_path}')

        if mode in ('all', 'pdf', 'pages'):
            page = browser.new_page()
            page.goto(url)
            page.wait_for_timeout(400)
            page.pdf(path=pdf_path, format='A4', print_background=True,
                     prefer_css_page_size=True)
            print(f'[PDF ] {pdf_path}')

        browser.close()

    if mode in ('all', 'pages'):
        import fitz
        doc = fitz.open(pdf_path)
        for i, pg in enumerate(doc):
            png = os.path.join(OUT, f'{base}-page{i + 1}.png')
            pix = pg.get_pixmap(dpi=300)
            pix.save(png)
            print(f'[分页] {png} ({pix.width}x{pix.height})')
        print(f'共 {doc.page_count} 页')
        doc.close()

    print('完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
