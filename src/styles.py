"""样式收集 — 功能样式全局加载 + YAML/行内样式引用收集与注入。

样式库目录结构：styles/{content-area|zone|section|item|block|field|layout}/{name}.css
- 功能样式（ALWAYS_CSS：头像、布局模式、固定语义文本样式）是渲染器结构依赖，全局加载
- YAML 任意对象通过统一 `style` 字段引用样式；行内文本通过 `{style:xxx}` 引用样式
"""

import os
import re
import sys

# 渲染器结构依赖的功能样式（头像、布局模式、固定语义文本样式），必须全局加载
ALWAYS_CSS = [
    'item/avatar.css',
    'layout/vertical.css',
    'layout/horizontal.css',
    'layout/grid-2.css',
    'layout/grid-3.css',
    'field/text-highlight.css',
    'field/icon.css',
    'field/inline-image.css',
]

_INLINE_STYLE_RE = re.compile(r'\{style:([^}]+)\}')


def _resolve_style_file(styles_dir: str, name: str) -> str | None:
    """按样式名跨全部分类目录查找 CSS 文件（通用 style 字段使用）。

    default.css 是各类别的基础结构样式，由布局加载，不作为通用 style 名。
    """
    if name == 'default':
        return None
    categories = sorted(d for d in os.listdir(styles_dir) if os.path.isdir(os.path.join(styles_dir, d)))
    for category in categories:
        fpath = os.path.join(styles_dir, category, name + '.css')
        if os.path.exists(fpath):
            return fpath
    return None


def _add_style(style: str, field: str, styles_dir: str, collected: set):
    if not isinstance(style, str):
        print(f'警告: 样式引用 {field} 中含非字符串值 {style!r}，已跳过', file=sys.stderr)
        return
    if not style:
        return
    fpath = _resolve_style_file(styles_dir, style)
    if not fpath:
        print(f'警告: 未找到样式 {style}.css', file=sys.stderr)
        return
    collected.add(fpath)


def _scan_inline_text(text: str, styles_dir: str, collected: set):
    for names in _INLINE_STYLE_RE.findall(text):
        for name in names.split(','):
            name = name.strip()
            if name:
                _add_style(name, 'style', styles_dir, collected)


def _scan_styles(data: dict, styles_dir: str, collected: set):
    """递归扫描 all dict 中的统一 style 字段与行内 {style:...} 引用。"""
    if not isinstance(data, dict):
        return

    style = data.get('style', [])
    if isinstance(style, list):
        for s in style:
            _add_style(s, 'style', styles_dir, collected)

    for v in data.values():
        if isinstance(v, str):
            _scan_inline_text(v, styles_dir, collected)
        elif isinstance(v, dict):
            _scan_styles(v, styles_dir, collected)
        elif isinstance(v, list):
            for item in v:
                if isinstance(item, str):
                    _scan_inline_text(item, styles_dir, collected)
                else:
                    _scan_styles(item, styles_dir, collected)


def collect_styles(styles_dir: str) -> str:
    """加载渲染器依赖的功能样式（ALWAYS_CSS）；布局声明与 YAML 引用由 builder 追加"""
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
