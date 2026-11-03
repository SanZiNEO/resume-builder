#!/usr/bin/env python3
"""样式手册生成器：把 styles/ 里所有风格套打包成可交付的成品。

    python scripts/style_book.py                # 全流程：画廊 + 手册 + PDF + 打包
    python scripts/style_book.py --no-pdf       # 只出 HTML（快）
    python scripts/style_book.py --no-zip       # 出目录不压缩
    python scripts/style_book.py --out output/xx

产物（默认 output/styles-book-{YYYYMMDD-HHMMSS}/）：
    00-README.md                包内说明 + 风格清单表
    gallery.html                横向对比画廊（2 列卡片，浏览器直接看）
    specimen.html               A4 手册源文件（1 页封面 + 每套 1 页）
    简历样式手册-{N}套-{M}页.pdf
                                手册成品，A4 竖版（名字自带套数与页数）
    suites/01-ed-editorial.pdf  单套拆页 PDF，方便单独发给别人
    css/…                       全部样式文件副本，包是自包含的
    suites.yaml                 风格登记表副本
    manifest.json               机器可读清单（含每套文件列表）

数据源是 styles/suites.yaml，新增风格只要在样式目录放好文件、在登记表加一条。
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import shutil
import sys
import zipfile
from datetime import datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STYLES = os.path.join(BASE, 'styles')
OUT = os.path.join(BASE, 'output')
PREVIEW = os.path.join(BASE, 'preview')

CATS = ['theme', 'section', 'item', 'block', 'field']
BASE_CATS = ['content-area', 'zone', 'section', 'item', 'block', 'field', 'layout']


# ──────────────────────────────────────────────────────────────
# 数据
# ──────────────────────────────────────────────────────────────
def load_suites() -> list[dict]:
    """读取 styles/suites.yaml，返回扁平化的套件列表（带 group 字段）。"""
    import yaml

    path = os.path.join(STYLES, 'suites.yaml')
    with open(path, encoding='utf-8') as f:
        data = yaml.safe_load(f)

    suites = []
    for group in data.get('groups', []):
        gname = group.get('name', '')
        for s in group.get('suites', []):
            suites.append({**s, 'group': gname})
    return suites


def collect_css(prefix: str) -> str:
    """把一套风格引用的全部 CSS 拼起来（含 theme/{prefix}.css 这类单文件老样式）。"""
    chunks = []
    for cat in CATS:
        folder = os.path.join(STYLES, cat)
        for p in sorted(glob.glob(os.path.join(folder, f'{prefix}-*.css'))):
            chunks.append(_read(p))
        single = os.path.join(folder, f'{prefix}.css')
        if os.path.exists(single):
            chunks.append(_read(single))
    return '\n\n'.join(chunks)


def base_css() -> str:
    """各分类的 default.css，是渲染的结构底座。"""
    chunks = []
    for cat in BASE_CATS:
        p = os.path.join(STYLES, cat, 'default.css')
        if os.path.exists(p):
            chunks.append(_read(p))
    return '\n'.join(chunks)


def _read(path: str) -> str:
    with open(path, encoding='utf-8') as f:
        return f.read().strip()


def suite_files(prefix: str) -> list[str]:
    out = []
    for cat in CATS:
        for p in sorted(glob.glob(os.path.join(STYLES, cat, f'{prefix}-*.css'))):
            out.append(f'{cat}/{os.path.basename(p)}')
        if os.path.exists(os.path.join(STYLES, cat, f'{prefix}.css')):
            out.append(f'{cat}/{prefix}.css')
    return out


def slug(en: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', en.lower()).strip('-')


# ──────────────────────────────────────────────────────────────
# 示范内容（虚构，仅用于排版对比）
# ──────────────────────────────────────────────────────────────
DEMO_MAIN = dict(
    title='校园二手书流转小程序',
    meta='2025.03 – 2025.09',
    sub='产品负责人 · 3 人团队',
    tags=['微信小程序', '产品设计', '冷启动'],
    bullets=[
        '访谈 6 个院系 32 位同学、回收 214 份问卷，发现「教材只用一学期」才是二手书流转的真实阻力',
        '把发布流程从 7 步压到 3 步，扫码识别 ISBN 自动填充书名与原价，首月成交 1,180 单',
    ],
    metric='<strong>1,180</strong> 首月成交 · <strong>46%</strong> 次月留存 · <strong>3 步</strong> 发布路径 · <strong>214</strong> 份有效问卷',
    grid=[
        '需求验证：访谈 + 问卷交叉',
        '流程重做：7 步压到 3 步',
        '冷启动：先做 3 个院系',
        '数据看板：成交 / 留存 / 转手率',
    ],
    quote='「书不用卖，让它自己找到下一届。」',
    flat=dict(
        title='内容增长实验', meta='2025.10 – 2025.12', sub='独立完成',
        tags=['内容运营', '数据分析'],
        bullets=[
            '拆解 320 条同类笔记，定位到「封面 + 前 3 秒」是完播率的两处断点',
            '改版 12 条后平均完播率从 21% 提到 39%，单条最高 8.6 万播放',
        ],
    ),
    rule=dict(
        title='电商平台 · 运营实习生', meta='2025.07 – 2025.09', sub='活动运营',
        tags=['活动配置', 'SQL'],
        bullets=[
            '负责 3 个品类的日常活动配置，累计上线 27 场，平均转化率提升 12%',
            '用 SQL 重建活动效果看板，把一次复盘从 2 天压缩到 2 小时',
        ],
    ),
    skill='用户访谈 · 问卷设计 · 竞品分析 · 内容策略 · 活动策划 · SQL · Python · Figma',
    skill_sub='英语 CET-6 · 普通话二级甲等',
    skill_tags=['可实习 4 天 / 周', '2026 届'],
)


def demo_body(prefix: str, compact: bool = False) -> str:
    """一套风格的示范正文；compact=True 时只留一个条目（画廊用）。"""
    c = lambda kind: f'{PREFIX(prefix)}-{kind}'
    d = DEMO_MAIN
    tags = ''.join(f'<span class="tag {c("tag")}">{t}</span>' for t in d['tags'])
    bullets = ''.join(f'<li>{b}</li>' for b in d['bullets'])

    card = f'''
      <div class="entry {c('card')}">
        <div class="block {c('block')}">
          <div class="entry-header">
            <span class="entry-title {c('title')}">{d['title']}</span>
            <span class="entry-meta {c('meta')}">{d['meta']}</span>
          </div>
          <div class="entry-sub {c('sub')}">{d['sub']}{tags}</div>
          <div class="entry-body {c('body')} dot-list"><ul>{bullets}</ul></div>
        </div>'''

    if compact:
        return card + '\n      </div>'

    grid = ''.join(f'<li>{g}</li>' for g in d['grid'])
    return card + f'''
        <div class="block {c('block')} {c('metric')}">
          <div class="entry-body {c('body')}"><ul><li>{d['metric']}</li></ul></div>
        </div>
        <div class="block {c('block')} {c('grid')}">
          <div class="entry-body {c('body')}"><ul>{grid}</ul></div>
        </div>
        <div class="block {c('block')} {c('quote')}">
          <div class="entry-body {c('body')}"><p class="block-text">{d['quote']}</p></div>
        </div>
      </div>'''


def PREFIX(prefix: str) -> str:  # noqa: N802 —— 保持模板可读性
    return prefix


def entry_block(prefix: str, variant: str) -> str:
    c = lambda kind: f'{prefix}-{kind}'
    d = DEMO_MAIN[variant]
    tags = ''.join(f'<span class="tag {c("tag")}">{t}</span>' for t in d['tags'])
    bullets = ''.join(f'<li>{b}</li>' for b in d['bullets'])
    return f'''
        <div class="entry {c('card-' + variant)}">
          <div class="entry-header">
            <span class="entry-title {c('title')}">{d['title']}</span>
            <span class="entry-meta {c('meta')}">{d['meta']}</span>
          </div>
          <div class="entry-sub {c('sub')}">{d['sub']}{tags}</div>
          <div class="entry-body {c('body')} dot-list"><ul>{bullets}</ul></div>
        </div>'''


# ──────────────────────────────────────────────────────────────
# HTML：画廊
# ──────────────────────────────────────────────────────────────
GALLERY_SHELL_CSS = '''
* { box-sizing: border-box; }
body { margin: 0; padding: 34px 20px 70px; background: #e7e7e7;
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; color: #111; }
.g-head { max-width: 940px; margin: 0 auto 10px; }
.g-head h1 { font-size: 22px; margin: 0 0 8px; letter-spacing: -0.01em; }
.g-head p { margin: 0; font-size: 12.5px; line-height: 1.8; color: #555; }
.g-nav { max-width: 940px; margin: 18px auto 0; font-size: 11.5px; line-height: 2; color: #666; }
.g-nav a { color: #444; text-decoration: none; border-bottom: 1px solid #bbb; margin-right: 10px; }
.g-sub { max-width: 940px; margin: 38px auto 14px; font-size: 13px; font-weight: 700;
  color: #333; padding-bottom: 6px; border-bottom: 1px solid #c9c9c9; }
.g-grid { max-width: 940px; margin: 0 auto; display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.g-item { display: flex; flex-direction: column; }
.g-label { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.g-label b { font-size: 12.5px; }
.g-label code { background: #d9d9d9; padding: 0 5px; border-radius: 3px; font-size: 10.5px; }
.g-label span { font-size: 10.5px; color: #666; }
.g-demo { background: #fff; border-radius: 8px; overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 16px; flex: 1; }
.g-demo .page { padding: 0; }
'''


def build_gallery_html(suites: list[dict]) -> str:
    groups: list[str] = []
    for s in suites:
        if s['group'] not in groups:
            groups.append(s['group'])

    parts, css_parts = [], []
    for g in groups:
        items = []
        for s in suites:
            if s['group'] != g:
                continue
            p = s['prefix']
            css_parts.append(f'/* ═══ {s["zh"]} {p} ═══ */\n' + collect_css(p))
            items.append(
                f'<section class="g-item"><div class="g-label"><b>{s["zh"]} {s["en"]}</b>'
                f'<code>{p}-</code><span>{s["desc"]}</span></div>'
                f'<div class="g-demo"><div class="page {s["page_class"]}">'
                f'<div class="section {p}-section {p}-header">'
                f'<div class="section-title">项目经历</div>{demo_body(p, compact=True)}'
                f'</div></div></div></section>'
            )
        parts.append(
            f'<div class="g-sub" id="{groups.index(g)}">{g} · {len(items)} 套</div>'
            f'<div class="g-grid">{"".join(items)}</div>'
        )

    nav = ''.join(f'<a href="#{i}">{g}</a>' for i, g in enumerate(groups))
    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>样式画廊 · {len(suites)} 套完整风格</title>
<style>
{GALLERY_SHELL_CSS}
{base_css()}
{chr(10).join(css_parts)}
</style>
</head>
<body>
<div class="g-head">
  <h1>样式画廊 · {len(suites)} 套完整风格</h1>
  <p>每套用同一段虚构文案渲染，方便横向比较。切换整套只需改 <code>data/{'{person}'}/theme.yaml</code> 的 page / sidebar / main，
  再把各板块的 <code>style:</code> 换成本套前缀；完整清单见 <code>styles/INDEX.md</code>。</p>
  <div class="g-nav">{nav}</div>
</div>
{''.join(parts)}
</body>
</html>'''


# ──────────────────────────────────────────────────────────────
# HTML：A4 手册
# ──────────────────────────────────────────────────────────────
SPECIMEN_CSS = '''
@page { size: A4; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; color: #111; }
.sheet {
  width: 210mm; height: 297mm; padding: 11mm 12mm 9mm;
  page-break-after: always; break-after: page;
  display: flex; flex-direction: column; overflow: hidden; background: #fff;
}
.sheet:last-child { page-break-after: auto; break-after: auto; }
.cap { display: flex; align-items: baseline; gap: 10px; padding-bottom: 5px;
  border-bottom: 1px solid #111; margin-bottom: 7mm; flex: 0 0 auto; }
.cap-l { display: flex; align-items: baseline; gap: 7px; }
.cap-no { font-size: 8pt; font-weight: 700; color: #999; font-variant-numeric: tabular-nums; }
.cap-name { font-size: 12pt; font-weight: 700; letter-spacing: -0.01em; }
.cap-name em { font-style: normal; font-weight: 400; color: #777; font-size: 9pt; margin-left: 3px; }
.cap-code { background: #eee; padding: 0 5px; border-radius: 3px; font-size: 8pt; color: #444; }
.cap-desc { margin-left: auto; font-size: 8pt; color: #777; text-align: right; }
.stage { flex: 1 1 auto; overflow: hidden; border: 1px solid #e2e2e2; border-radius: 2px; }
.stage-inner { zoom: 1; height: 100%; }
.stage-inner > .page { padding: 5.5mm 6.5mm; min-height: 100%; }

.cover { padding: 26mm 20mm 14mm; }
.cover-kicker { font-size: 8pt; letter-spacing: 0.34em; color: #999; }
.cover h1 { font-size: 30pt; margin: 4mm 0 3mm; letter-spacing: -0.02em; font-weight: 800; }
.cover-sub { font-size: 9.5pt; color: #555; line-height: 1.7; }
.cover-note { margin-top: 10mm; padding: 5mm 6mm; background: #f7f7f5; border-left: 3px solid #111; }
.cover-note b { font-size: 9pt; }
.cover-note p { margin: 2mm 0 0; font-size: 8.5pt; line-height: 1.85; color: #444; }
.toc { margin-top: 10mm; display: grid; grid-template-columns: 1fr 1fr; gap: 6mm 12mm; }
.toc-col h3 { font-size: 9pt; margin: 0 0 2mm; padding-bottom: 1.5mm; border-bottom: 1px solid #ddd; color: #333; }
.toc-col ul { margin: 0; padding: 0; list-style: none; }
.toc-col li { font-size: 8pt; line-height: 1.95; color: #444; }
.toc-col code { background: #f0f0f0; padding: 0 4px; border-radius: 2px; font-size: 7.5pt; color: #555; }
.toc-col em { font-style: normal; color: #999; font-size: 7.5pt; }
.cover-foot { margin-top: auto; font-size: 7.5pt; color: #aaa; letter-spacing: 0.05em; }
'''

FIT_JS = '''
window.__fit = function() {
  const stages = Array.from(document.querySelectorAll('.stage'));
  let shr = 0, grow = 0;
  stages.forEach(st => {
    const inner = st.querySelector('.stage-inner');
    const page = inner.querySelector('.page');
    const H = st.clientHeight - 2;
    const apply = z => {
      const h = H / z;
      inner.style.zoom = z;
      inner.style.height = h + 'px';
      page.style.height = h + 'px';
    };
    const fits = z => { apply(z); return page.scrollHeight <= page.clientHeight + 1; };
    let z = 1;
    if (!fits(1)) {
      while (z > 0.55 && !fits(z - 0.02)) z -= 0.02;
      if (z < 0.999) shr++;
    } else {
      while (z < 1.18 && fits(z + 0.02)) z += 0.02;
      if (z > 1.001) grow++;
    }
    apply(z);
    st.setAttribute('data-z', z.toFixed(2));
  });
  return [shr, grow];
};
'''


def spec_sheet(idx: int, s: dict) -> str:
    p = s['prefix']
    c = lambda kind: f'{p}-{kind}'
    d = DEMO_MAIN
    tags = ''.join(f'<span class="tag {c("tag")}">{t}</span>' for t in d['tags'])
    bullets = ''.join(f'<li>{b}</li>' for b in d['bullets'])
    grid = ''.join(f'<li>{g}</li>' for g in d['grid'])
    skill_tags = ''.join(f'<span class="tag {c("tag")}">{t}</span>' for t in d['skill_tags'])

    return f'''
<section class="sheet">
  <div class="cap">
    <div class="cap-l">
      <span class="cap-no">{idx:02d}</span>
      <span class="cap-name">{s["zh"]} <em>{s["en"]}</em></span>
      <code class="cap-code">{p}-</code>
    </div>
    <div class="cap-desc">{s["desc"]}</div>
  </div>

  <div class="stage">
   <div class="stage-inner">
    <div class="page {s["page_class"]}">

      <div class="section {c('section')} {c('header')}">
        <div class="section-title">项目经历</div>

        <div class="entry {c('card')}">
          <div class="block {c('block')}">
            <div class="entry-header">
              <span class="entry-title {c('title')}">{d['title']}</span>
              <span class="entry-meta {c('meta')}">{d['meta']}</span>
            </div>
            <div class="entry-sub {c('sub')}">{d['sub']}{tags}</div>
            <div class="entry-body {c('body')} dot-list"><ul>{bullets}</ul></div>
          </div>

          <div class="block {c('block')} {c('metric')}">
            <div class="entry-body {c('body')}"><ul><li>{d['metric']}</li></ul></div>
          </div>

          <div class="block {c('block')} {c('grid')}">
            <div class="entry-body {c('body')}"><ul>{grid}</ul></div>
          </div>

          <div class="block {c('block')} {c('quote')}">
            <div class="entry-body {c('body')}"><p class="block-text">{d['quote']}</p></div>
          </div>
        </div>
      </div>

      <div class="section {c('divider')} {c('header')}">
        <div class="section-title">实习与成长</div>
        {entry_block(p, 'flat')}
        {entry_block(p, 'rule')}
      </div>

      <div class="section {c('section')} {c('header')}">
        <div class="section-title">技能与其他</div>
        <div class="entry {c('card')}">
          <div class="block {c('block')}">
            <div class="entry-body {c('body')}"><ul><li>{d['skill']}</li></ul></div>
            <div class="entry-sub {c('sub')}">{d['skill_sub']}{skill_tags}</div>
          </div>
        </div>
      </div>

    </div>
   </div>
  </div>
</section>'''


def spec_cover(suites: list[dict]) -> str:
    groups: list[str] = []
    for s in suites:
        if s['group'] not in groups:
            groups.append(s['group'])

    cols = []
    for g in groups:
        items = [s for s in suites if s['group'] == g]
        lis = ''.join(f'<li><code>{s["prefix"]}-</code> {s["zh"]} <em>{s["en"]}</em></li>' for s in items)
        cols.append(f'<div class="toc-col"><h3>{g} · {len(items)}</h3><ul>{lis}</ul></div>')

    return f'''
<section class="sheet cover">
  <div class="cover-top">
    <div class="cover-kicker">RESUME STYLE BOOK</div>
    <h1>简历样式手册</h1>
    <div class="cover-sub">{len(suites)} 套完整风格 · 每套 16 个样式文件 · 覆盖 theme / section / item / block / field 五个层级</div>
  </div>

  <div class="cover-note">
    <b>关于本册内容</b>
    <p>所有页面里的项目、数字均为<strong>排版示范用的虚构内容</strong>，与任何真实简历无关；同一段文字在每套风格里重复渲染，只改样式、不改文案，方便直接横向比较。<br>
    每页展示：板块容器与板块标题、分隔装饰、三种条目卡（card / card-flat / card-rule）、四种内容块（block / metric / grid / quote）、以及标题、副标题、元信息、正文、标签五类字段。</p>
  </div>

  <div class="toc">{''.join(cols)}</div>

  <div class="cover-foot">resume · styles/ · 由 styles/suites.yaml 自动生成</div>
</section>'''


def build_specimen_html(suites: list[dict]) -> str:
    sheets = ''.join(spec_sheet(i + 1, s) for i, s in enumerate(suites))
    css = '\n'.join(f'/* ═══ {s["zh"]} {s["prefix"]} ═══ */\n' + collect_css(s['prefix']) for s in suites)
    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>简历样式手册 · {len(suites)} 套</title>
<style>
{SPECIMEN_CSS}
{base_css()}
{css}
</style>
</head>
<body>
{spec_cover(suites)}
{sheets}
<script>{FIT_JS}</script>
</body>
</html>'''


# ──────────────────────────────────────────────────────────────
# 导出
# ──────────────────────────────────────────────────────────────
def export_pdf(html_path: str, pdf_path: str) -> int:
    """打印 A4 PDF；先跑自适应缩放，保证每页不溢出不裁切。返回页数。"""
    from playwright.sync_api import sync_playwright

    url = 'file:///' + html_path.replace(os.sep, '/')
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={'width': 1240, 'height': 1754})
        page.goto(url, wait_until='load')
        page.wait_for_timeout(1200)
        shrunk, grow = page.evaluate('window.__fit()')
        page.wait_for_timeout(400)
        page.pdf(path=pdf_path, format='A4', print_background=True,
                 margin={'top': '0', 'bottom': '0', 'left': '0', 'right': '0'},
                 prefer_css_page_size=True)
        browser.close()
    print(f'  缩放：溢出收缩 {shrunk} 页，留白放大 {grow} 页')

    # 裁掉未使用的字形，体积能小三分之一左右
    import pymupdf
    doc = pymupdf.open(pdf_path)
    try:
        doc.subset_fonts()
    except Exception:
        pass
    tmp = pdf_path + '.tmp'
    doc.save(tmp, garbage=4, deflate=True)
    n = doc.page_count
    doc.close()
    os.replace(tmp, pdf_path)
    return n


def split_pdf(pdf_path: str, suites: list[dict], out_dir: str) -> list[str]:
    """把合订本按套拆成单页 PDF（第 0 页是封面，往后依次对应）。"""
    import pymupdf

    os.makedirs(out_dir, exist_ok=True)
    src = pymupdf.open(pdf_path)
    made = []
    for i, s in enumerate(suites):
        page_no = i + 1
        if page_no >= src.page_count:
            break
        name = f'{i + 1:02d}-{s["prefix"]}-{slug(s["en"])}.pdf'
        path = os.path.join(out_dir, name)
        dst = pymupdf.open()
        dst.insert_pdf(src, from_page=page_no, to_page=page_no)
        try:
            dst.subset_fonts()
        except Exception:
            pass
        dst.save(path, garbage=4, deflate=True, clean=True)
        dst.close()
        made.append(name)
    src.close()
    return made


def write_readme(path: str, suites: list[dict], page_count: int, book_name: str):
    rows = '\n'.join(
        f'| {i + 1:02d} | `{s["prefix"]}-` | {s["zh"]} | {s["en"]} | {s["desc"]} | {s["fit"]} |'
        for i, s in enumerate(suites)
    )
    text = f'''# 简历样式包 · {len(suites)} 套

用同一段虚构文案渲染的排版样张，只改样式不改内容，可直接横向比较。

## 怎么用

1. **先挑**：打开 `gallery.html`（浏览器直接开）或 `{book_name}`（A4 手册，每套一页）。
2. **换整套**：新建 `data/{{person}}/theme.yaml`，把页面、左栏、右栏都挂上该套主题类：

   ```yaml
   theme:
     page: [sw-theme]
     sidebar: [sw-theme]
     main: [sw-theme]
   ```

   再把各板块 YAML 的 `style:` 换成本套前缀（`sw-section` / `sw-header` / `sw-card` / `sw-title` / `sw-body` / `sw-tag` …）。
3. **只要某一套**：`suites/` 下有单套 PDF，可直接发给别人看。

## 包里有什么

| 路径 | 内容 |
|---|---|
| `gallery.html` | 横向对比画廊（2 列卡片） |
| `specimen.html` | A4 手册源文件（封面 + {len(suites)} 页样张） |
| `{book_name}` | 手册成品，A4 竖版，共 {page_count} 页 |
| `suites/` | 单套拆页 PDF，共 {len(suites)} 份 |
| `css/` | 全部样式文件副本，包是自包含的 |
| `suites.yaml` | 风格登记表（数据源） |
| `manifest.json` | 机器可读清单，含每套文件列表 |

## 风格清单

| # | 前缀 | 中文名 | 英文名 | 视觉特征 | 适合投什么 |
|---|---|---|---|---|---|
{rows}

---

所有样张中的人物、项目与数字均为排版示范用的虚构内容，不对应任何真实简历。
'''
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def write_manifest(path: str, suites: list[dict], page_count: int):
    data = {
        'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'total_suites': len(suites),
        'pdf_pages': page_count,
        'groups': [],
    }
    for s in suites:
        g = next((x for x in data['groups'] if x['name'] == s['group']), None)
        if g is None:
            g = {'name': s['group'], 'suites': []}
            data['groups'].append(g)
        g['suites'].append({
            'prefix': s['prefix'],
            'page_class': s['page_class'],
            'name_zh': s['zh'],
            'name_en': s['en'],
            'desc': s['desc'],
            'fit': s['fit'],
            'files': suite_files(s['prefix']),
        })
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


CAT_DESC = {
    'content-area': '内容区容器', 'zone': '区域（sidebar / main）',
    'section': '板块容器', 'item': '条目卡片', 'block': '块级容器',
    'field': '字段（标题 / 副标题 / 正文 / 标签 / 徽章）',
    'layout': '布局（vertical / horizontal / grid-2 / grid-3）',
    'theme': '主题（配色变量 + 页面底色）',
}


def write_index(suites: list[dict]):
    """从 suites.yaml 重生成 styles/INDEX.md 与 styles/manifest.json。"""
    import collections

    cats = list(CAT_DESC.keys())
    rows = []
    for cat in cats:
        for p in sorted(glob.glob(os.path.join(STYLES, cat, '*.css'))):
            name = os.path.splitext(os.path.basename(p))[0]
            rows.append({'cat': cat, 'name': name})

    suite_map = {s['prefix']: suite_files(s['prefix']) for s in suites}
    claimed = {os.path.basename(f) for v in suite_map.values() for f in v}
    functional = [r for r in rows if r['name'] + '.css' not in claimed]

    # manifest.json
    manifest = {
        'generated_by': 'python make.py styles（数据源 styles/suites.yaml）',
        'total': len(rows),
        'categories': {c: sum(1 for r in rows if r['cat'] == c) for c in cats},
        'suite_count': len(suites),
        'suites': [
            {'group': s['group'], 'prefix': s['prefix'], 'name_zh': s['zh'], 'name_en': s['en'],
             'style': s['desc'], 'fit': s['fit'], 'page_class': s['page_class'],
             'files': suite_map[s['prefix']], 'count': len(suite_map[s['prefix']])}
            for s in suites
        ],
        'functional': sorted(f"{r['cat']}/{r['name']}" for r in functional),
    }
    with open(os.path.join(STYLES, 'manifest.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    # INDEX.md
    groups: list[str] = []
    for s in suites:
        if s['group'] not in groups:
            groups.append(s['group'])

    L = []
    A = L.append
    A('# 样式库索引\n')
    A(f'> 共 **{len(rows)}** 个样式文件 · **{len(cats)}** 个分类 · **{len(suites)}** 套完整风格\n')
    A('> 由 `python make.py styles` 依据 `styles/suites.yaml` 自动生成，不要手改；机器可读版本见 `manifest.json`。\n')
    A('\n## 一、目录结构\n')
    A('```')
    A('styles/')
    for c in cats:
        n = sum(1 for r in rows if r['cat'] == c)
        A(f'├── {c + "/":14s} {n:4d}   {CAT_DESC[c]}')
    A('```\n')
    A('\n## 二、加载机制\n')
    A('- **全局加载**：`src/styles.py` 的 `ALWAYS_CSS` 固定加载结构依赖样式（头像 / 布局模式 / 文本高亮 / 图标 / 行内图片）')
    A('- **按需注入**：其余样式只有被 YAML 的 `style: [名称]` 或文本内 `{style:名称}` 引用时，才会写进页面')
    A('- **结论**：样式库可以放心扩充，未引用的文件不产生渲染开销\n')
    A('\n## 三、风格套总览\n')
    A('| 组 | 前缀 | 名称 | 视觉特征 | 适合投什么 | 文件数 |')
    A('|---|---|---|---|---|---|')
    last = None
    for s in suites:
        gname = f'**{s["group"]}**' if s['group'] != last else ''
        last = s['group']
        A(f'| {gname} | `{s["prefix"]}-` | {s["zh"]} {s["en"]} | {s["desc"]} | {s["fit"]} | {len(suite_map[s["prefix"]])} |')
    A('\n## 四、切换整套风格\n')
    A('**第 1 步**：新建 `data/{person}/theme.yaml`：\n')
    A('```yaml')
    A('theme:')
    A('  page: [sw-theme]      # 页面底色与字体')
    A('  sidebar: [sw-theme]   # 左栏底色')
    A('  main: [sw-theme]      # 右栏底色')
    A('```\n')
    A('**第 2 步**：把各板块 YAML 的 `style:` 换成本套前缀：\n')
    A('```yaml')
    A('section:')
    A('  style: [sw-section, sw-header]   # 板块容器 + 板块标题')
    A('item:')
    A('  style: [sw-card]                 # 可换 sw-card-flat / sw-card-rule')
    A('heading:')
    A('  style: [sw-title]')
    A('body:')
    A('  style: [sw-body, dot-list]       # 可叠加功能样式')
    A('```\n')
    A('想先看效果：`python make.py styles` 会生成 `preview/gallery.html`（横向对比）与 `preview/简历样式手册-*套-*页.pdf`（A4 手册）。\n')
    A('\n## 五、每套的文件骨架\n')
    A('| 层级 | 文件 | 作用 |')
    A('|---|---|---|')
    for row in [
        ('theme', '{p}-theme', '变量、页面 / 左右栏底色、字体族'),
        ('section', '{p}-section', '板块容器：边框、底色、圆角、内距'),
        ('section', '{p}-header', '板块标题：字号、字距、前置图形'),
        ('section', '{p}-divider', '板块分隔装饰'),
        ('item', '{p}-card', '条目卡（主用）'),
        ('item', '{p}-card-flat', '扁平变体：无底无框，适合密集列表'),
        ('item', '{p}-card-rule', '线条变体：单边强调，适合时间线'),
        ('block', '{p}-block', '块容器：内嵌底色 / 边框'),
        ('block', '{p}-metric', '数字强调：套在 `**数字**` 上'),
        ('block', '{p}-quote', '引言 / 结论块'),
        ('block', '{p}-grid', '内容网格：把列表排成 2–3 栏'),
        ('field', '{p}-title', '条目标题'),
        ('field', '{p}-sub', '副标题 / 角色'),
        ('field', '{p}-meta', '时间、地点等元信息'),
        ('field', '{p}-body', '正文列表'),
        ('field', '{p}-tag', '标签'),
    ]:
        A(f'| {row[0]} | `{row[1]}` | {row[2]} |')
    A('\n## 六、各套文件清单\n')
    for g in groups:
        A(f'### {g}\n')
        for s in suites:
            if s['group'] != g:
                continue
            files = suite_map[s['prefix']]
            A(f'**{s["zh"]} `{s["prefix"]}-`**（{len(files)} 个）\n')
            bycat = collections.defaultdict(list)
            for f in files:
                cat, name = f.split('/', 1)
                bycat[cat].append(os.path.splitext(name)[0])
            for c in CATS:
                if bycat[c]:
                    A(f'- {c}: `' + '` `'.join(sorted(bycat[c])) + '`')
            A('')
    A('\n## 七、命名规范\n')
    A('```')
    A('{前缀}-{层级}            例：ed-section / co-title / sw-tag')
    A('{前缀}-{层级}-{变体}     例：ed-card-flat / co-card-rule / hw-card-rule')
    A('```\n')
    A('**层级词表**：`theme` `section` `header` `divider` `card` `block` `metric` `quote` `grid` `title` `sub` `meta` `body` `tag`\n')
    A('\n## 八、功能样式清单（无风格前缀）\n')
    bycat_func = collections.defaultdict(list)
    for r in functional:
        bycat_func[r['cat']].append(r['name'])
    for c in cats:
        if bycat_func[c]:
            A(f'- **{c}**（{len(bycat_func[c])}）: `' + '` `'.join(sorted(bycat_func[c])) + '`')
    A('')
    with open(os.path.join(STYLES, 'INDEX.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(L))


def copy_css(dest: str):
    """把 styles/ 下的样式文件整份复制进包里，保持分类目录。"""
    for cat in CATS + ['content-area', 'zone', 'layout']:
        src_dir = os.path.join(STYLES, cat)
        if not os.path.isdir(src_dir):
            continue
        dst_dir = os.path.join(dest, 'css', cat)
        os.makedirs(dst_dir, exist_ok=True)
        for name in os.listdir(src_dir):
            if name.endswith('.css'):
                shutil.copyfile(os.path.join(src_dir, name), os.path.join(dst_dir, name))


# ──────────────────────────────────────────────────────────────
# 主流程
# ──────────────────────────────────────────────────────────────
def build(out_dir: str | None = None, make_pdf: bool = True, make_zip: bool = True) -> str:
    suites = load_suites()
    ts = datetime.now().strftime('%Y%m%d-%H%M%S')
    out_dir = out_dir or os.path.join(OUT, f'styles-book-{ts}')
    os.makedirs(out_dir, exist_ok=True)

    print(f'== 1/5 生成 HTML（{len(suites)} 套）==')
    os.makedirs(PREVIEW, exist_ok=True)
    gallery = os.path.join(PREVIEW, 'gallery.html')
    specimen = os.path.join(PREVIEW, 'specimen.html')
    with open(gallery, 'w', encoding='utf-8', newline='\n') as f:
        f.write(build_gallery_html(suites))
    with open(specimen, 'w', encoding='utf-8', newline='\n') as f:
        f.write(build_specimen_html(suites))
    print('  预览 →', gallery)
    print('  预览 →', specimen)

    print('== 2/5 导出 PDF ==')
    raw_pdf = os.path.join(PREVIEW, '简历样式手册.pdf')
    book_name = 'resume-style-book.pdf'
    page_count = 0
    if make_pdf:
        page_count = export_pdf(specimen, raw_pdf)
        # 成品名自带套数与页数，避免和旧版本同名、也方便一眼核对有没有拿错文件
        book_name = f'简历样式手册-{len(suites)}套-{page_count}页.pdf'
        pdf_path = os.path.join(PREVIEW, book_name)
        os.replace(raw_pdf, pdf_path)
        print(f'  {page_count} 页 → {pdf_path}')
    else:
        pdf_path = raw_pdf
        print('  跳过（--no-pdf）')

    print('== 3/5 组装交付目录 ==')
    shutil.copyfile(gallery, os.path.join(out_dir, 'gallery.html'))
    shutil.copyfile(specimen, os.path.join(out_dir, 'specimen.html'))
    if make_pdf and os.path.exists(pdf_path):
        shutil.copyfile(pdf_path, os.path.join(out_dir, book_name))
        made = split_pdf(pdf_path, suites, os.path.join(out_dir, 'suites'))
        print(f'  单套 PDF {len(made)} 份')
    copy_css(out_dir)
    shutil.copyfile(os.path.join(STYLES, 'suites.yaml'), os.path.join(out_dir, 'suites.yaml'))
    write_readme(os.path.join(out_dir, '00-README.md'), suites, page_count or len(suites) + 1, book_name)
    write_manifest(os.path.join(out_dir, 'manifest.json'), suites, page_count)
    write_index(suites)
    print('  索引 → styles/INDEX.md, styles/manifest.json')
    print('  目录 →', out_dir)

    print('== 4/5 压缩 ==')
    zip_path = out_dir.rstrip(os.sep) + '.zip'
    if make_zip:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
            for root, _dirs, files in os.walk(out_dir):
                for name in files:
                    full = os.path.join(root, name)
                    rel = os.path.relpath(full, out_dir)
                    z.write(full, os.path.join(os.path.basename(out_dir), rel))
        size = os.path.getsize(zip_path) / 1024 / 1024
        print(f'  {zip_path}（{size:.1f} MB）')
    else:
        print('  跳过（--no-zip）')

    print('== 5/5 完成 ==')
    print(f'风格套 {len(suites)} · 样式文件 {len(glob.glob(os.path.join(STYLES, "**", "*.css"), recursive=True))}')
    print(f'成品目录 {out_dir}')
    return out_dir


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description='把 styles/ 里所有风格打包成可交付的样式手册')
    ap.add_argument('--out', help='输出目录（默认 output/styles-book-{时间戳}）')
    ap.add_argument('--no-pdf', action='store_true', help='跳过 PDF 导出')
    ap.add_argument('--no-zip', action='store_true', help='不压缩成 zip')
    args = ap.parse_args(argv)

    build(out_dir=args.out, make_pdf=not args.no_pdf, make_zip=not args.no_zip)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
