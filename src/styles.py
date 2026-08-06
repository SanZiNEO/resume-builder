"""样式收集 — 功能样式全局加载 + 模板/YAML 样式引用收集与注入。

样式库目录结构：styles/{content-area|zone|section|item|field|layout}/{name}.css
- 功能样式（ALWAYS_CSS：头像、布局模式）是渲染器结构依赖，全局加载
- 分类主题样式（各分类 default.css 与具名样式）由模板 <!-- styles: --> 声明、
  YAML 通过 STYLE_CATEGORIES 字段引用——各选各的，不全局默认加载
"""

import os
import sys

STYLE_CATEGORIES = {
    'section_style': 'section',
    'item_style': 'item',
    'heading_style': 'field',
    'body_style': 'field',
    'tag_style': 'field',
    'zone_style': 'zone',
    'layout_style': 'layout',
}

# 渲染器结构依赖的功能样式（头像、vertical/horizontal 布局模式），必须全局加载
ALWAYS_CSS = ['item/avatar.css', 'layout/vertical.css', 'layout/horizontal.css', 'layout/grid-2.css', 'layout/grid-3.css']


def _scan_styles(data: dict, styles_dir: str, collected: set):
    """递归扫描 dict 中的 style 引用字段（list[str]），收集 CSS 文件路径；
    缺失样式输出警告（不中断）。单字符串旧格式已废弃，跳过（validate 会报错）。"""
    if not isinstance(data, dict):
        return
    for field, category in STYLE_CATEGORIES.items():
        styles = data.get(field, [])
        if not isinstance(styles, list):
            continue  # 废弃的单字符串格式
        for style in styles:
            if not style:
                continue
            fpath = os.path.join(styles_dir, category, style + '.css')
            if os.path.exists(fpath):
                collected.add(fpath)
            else:
                print(f'警告: 未找到样式 {category}/{style}.css', file=sys.stderr)
    for v in data.values():
        if isinstance(v, dict):
            _scan_styles(v, styles_dir, collected)
        elif isinstance(v, list):
            for item in v:
                _scan_styles(item, styles_dir, collected)


def collect_styles(styles_dir: str) -> str:
    """加载渲染器依赖的功能样式（ALWAYS_CSS）；模板声明与 YAML 引用由 builder 追加"""
    lines = []
    for fpath in [os.path.join(styles_dir, p) for p in ALWAYS_CSS]:
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    lines.append(content)
        except FileNotFoundError:
            pass
    return '\n\n'.join(lines)
