"""行内文本解析 — Markdown 子集 + 自定义样式片段。

支持语法：
    **加粗**         -> <strong>
    *斜体*           -> <em>
    ==高亮==         -> <span class="text-highlight">
    `代码`           -> <code>
    [文字](url)      -> <a>
    ~~删除~~         -> <del>
    {style:name}文字{/style} -> <span class="name">

所有非协议文本都会进行 HTML 转义，只有匹配到的受控标签会生成 HTML。
"""

import html
import re

_PATTERNS = [
    (re.compile(r'\*\*(.+?)\*\*'), 'bold'),
    (re.compile(r'\*(.+?)\*'), 'italic'),
    (re.compile(r'==(.+?)=='), 'highlight'),
    (re.compile(r'`([^`]+?)`'), 'code'),
    (re.compile(r'!\[([^\]]*)\]\(([^)]+)\)'), 'image'),
    (re.compile(r'\[([^\]]+?)\]\(([^)]+?)\)'), 'link'),
    (re.compile(r'~~(.+?)~~'), 'strike'),
    (re.compile(r'\{style:([^}]+?)\}(.*?)\{/style\}'), 'style'),
    (re.compile(r'\{icon:([^}]+?)\}'), 'icon'),
]


def _esc(value) -> str:
    return html.escape(str(value))


def _render_match(match, kind: str, icon_html=None, image_html=None) -> str:
    if kind == 'bold':
        return f'<strong>{_esc(match.group(1))}</strong>'
    if kind == 'italic':
        return f'<em>{_esc(match.group(1))}</em>'
    if kind == 'highlight':
        return f'<span class="text-highlight">{_esc(match.group(1))}</span>'
    if kind == 'code':
        return f'<code>{_esc(match.group(1))}</code>'
    if kind == 'image':
        if image_html is not None:
            return image_html(match.group(2), match.group(1))
        return ''
    if kind == 'link':
        text = _esc(match.group(1))
        url = _esc(match.group(2))
        return f'<a href="{url}" target="_blank" rel="noopener" class="entry-link">{text}</a>'
    if kind == 'strike':
        return f'<del>{_esc(match.group(1))}</del>'
    if kind == 'style':
        names = ' '.join(x.strip() for x in match.group(1).split(',') if x.strip())
        return f'<span class="{_esc(names)}">{_esc(match.group(2))}</span>'
    if kind == 'icon':
        if icon_html is not None:
            return icon_html(match.group(1))
        return ''
    return _esc(match.group(0))


def render_inline(text, icon_html=None, image_html=None) -> str:
    """把包含行内协议的文本渲染为 HTML 片段。

    icon_html: 可选回调，接收图标名并返回 HTML；用于行内 {icon:xxx}。
    image_html: 可选回调，接收图片路径和 alt，返回 HTML；用于 ![alt](path)。
    """
    if text is None:
        return ''
    text = str(text)
    out = []
    pos = 0

    while pos < len(text):
        best = None
        for pattern, kind in _PATTERNS:
            m = pattern.search(text, pos)
            if m and (best is None or m.start() < best[0].start()):
                best = (m, kind)

        if best is None:
            out.append(_esc(text[pos:]))
            break

        m, kind = best
        out.append(_esc(text[pos:m.start()]))
        out.append(_render_match(m, kind, icon_html, image_html))
        pos = m.end()

    return ''.join(out)
