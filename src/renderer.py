"""渲染引擎 — 按内容协议把 section dict 渲染为 HTML 片段。"""

import html
import os
import base64
import mimetypes

from src.assets import icon_svg, image_data_uri
from src.inline import render_inline


def _esc(value) -> str:
    return html.escape(str(value))


def _icon_html(name: str) -> str:
    """读取 assets/icons/{name}.svg 并内联为 span。"""
    name = str(name).strip()
    svg = icon_svg(name)
    if not svg:
        return ''
    return f'<span class="icon icon-{html.escape(name)}">{svg}</span>'


def _inline_image_html(path: str, alt: str = '') -> str:
    uri = image_data_uri(path)
    if not uri:
        return ''
    return f'<img src="{uri}" alt="{_esc(alt)}" class="inline-image">'


def _inline(text) -> str:
    """统一调用行内解析，支持 {icon:xxx} 与 ![alt](path)。"""
    return render_inline(text, _icon_html, _inline_image_html)


def _with_icon(text_html: str, value) -> str:
    """给一段 HTML 文本加前/后图标。支持单个 icon 或 icons 列表。"""
    if not isinstance(value, dict):
        return text_html

    icons = value.get('icons')
    if isinstance(icons, list) and icons:
        before = []
        after = []
        for item in icons:
            if isinstance(item, str):
                name = item
                pos = value.get('icon_position', 'before')
            elif isinstance(item, dict):
                name = item.get('name') or item.get('icon')
                pos = item.get('position', value.get('icon_position', 'before'))
            else:
                continue
            icon_html = _icon_html(name)
            if not icon_html:
                continue
            if pos == 'after':
                after.append(icon_html)
            else:
                before.append(icon_html)
        return ''.join(before) + text_html + ''.join(after)

    icon = value.get('icon')
    if not icon:
        return text_html
    icon_html = _icon_html(icon)
    if not icon_html:
        return text_html
    if value.get('icon_position', 'before') == 'after':
        return text_html + icon_html
    return icon_html + text_html


def _image_html(value) -> str:
    """从对象形式读取 image 字段，返回 img 标签。"""
    if not isinstance(value, dict):
        return ''
    path = value.get('image') or value.get('path') or value.get('src') or ''
    if not path:
        return ''
    uri = image_data_uri(path)
    if not uri:
        return ''
    alt = _esc(value.get('image_alt', ''))
    width = value.get('image_width', '')
    style_attr = f' style="width:{width}px"' if width else ''
    return f'<img src="{uri}" alt="{alt}" class="inline-image"{style_attr}>'


def _with_image(text_html: str, value) -> str:
    """给一段 HTML 文本加前/后图片。支持单张 image 或多张 images。"""
    if not isinstance(value, dict):
        return text_html

    images = value.get('images')
    if isinstance(images, list) and images:
        before = []
        after = []
        for item in images:
            if isinstance(item, str):
                pos = value.get('image_position', 'before')
                part = {'image': item, 'image_position': pos}
            elif isinstance(item, dict):
                part = item
                pos = item.get('image_position', value.get('image_position', 'before'))
            else:
                continue
            img_html = _image_html(part)
            if not img_html:
                continue
            if pos == 'after':
                after.append(img_html)
            else:
                before.append(img_html)
        return ''.join(before) + text_html + ''.join(after)

    if not value.get('image'):
        return text_html
    img_html = _image_html(value)
    if not img_html:
        return text_html
    if value.get('image_position', 'before') == 'after':
        return text_html + img_html
    return img_html + text_html


def _text(value, default: str = '') -> str:
    """取文本：普通值直接返回；对象形式取 text 字段。"""
    if value is None:
        return default
    if isinstance(value, dict):
        return str(value.get('text', default) or default)
    return str(value)


def _style_of(value):
    """从对象形式中提取 style；普通字符串/列表不当作样式提取。"""
    if isinstance(value, dict):
        return value.get('style')
    return None


def _merge_styles(*values) -> str:
    """合并多个样式来源，支持 list / dict.style。"""
    classes = []
    for value in values:
        if isinstance(value, dict):
            value = value.get('style', [])
        if isinstance(value, str):
            value = [value]
        if isinstance(value, list):
            for item in value:
                if item:
                    classes.append(str(item))
    return ' '.join(dict.fromkeys(classes))


def _section_wrapper(title: str, content: str, extra_class: str = '') -> str:
    if not content:
        return ''
    cls = 'section' + (f' {extra_class}' if extra_class else '')
    title_html = f'<div class="section-title">{_inline(title)}</div>' if title else ''
    return f'''<div class="{cls}">
  {title_html}
  {content}
</div>'''


def render_block(data: dict) -> str:
    content = data.get('content', '').strip()
    if not content:
        return ''
    title = data.get('title', '')
    section_class = _merge_styles(data.get('style'))
    inner = f'<div class="entry"><div class="entry-body"><p class="block-text">{_inline(content)}</p></div></div>'
    return _section_wrapper(title, inner, section_class)


def _avatar_img(avatar_path: str, avatar_style: str, person_dir: str) -> str:
    """读取头像图片，返回 base64 内嵌的 img 标签"""
    full_path = os.path.join(person_dir, avatar_path) if not os.path.isabs(avatar_path) else avatar_path
    if not os.path.exists(full_path):
        return ''
    mime = mimetypes.guess_type(full_path)[0] or 'image/png'
    with open(full_path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('ascii')
    cls = f'avatar-{avatar_style}' if avatar_style else 'avatar-round'
    return f'<img src="data:{mime};base64,{b64}" class="block-avatar {cls}" alt="avatar">'


def _parts_html(value) -> str:
    """有序片段渲染：parts 列表里可混排文本、图标、图片。"""
    if not isinstance(value, dict):
        return ''
    parts = value.get('parts', [])
    out = []
    for part in parts:
        if isinstance(part, str):
            out.append(_inline(part))
            continue
        if not isinstance(part, dict):
            continue
        if part.get('text') is not None:
            html = _inline(part['text'])
        else:
            html = ''
        html = _with_icon(html, part)
        html = _with_image(html, part)
        out.append(html)
    return ''.join(out)


def _content_html(value) -> str:
    """优先使用 parts 有序片段；否则返回普通文本 HTML。"""
    if isinstance(value, dict) and isinstance(value.get('parts'), list):
        return _parts_html(value)
    return _inline(_text(value))


def _render_block_in_item(block: dict, person_dir: str | None = None) -> str:
    """渲染 item 内部的单个 block（heading + sub/tags + body）"""
    heading = _text(block.get('heading'))
    meta = _text(block.get('meta'))
    sub = _text(block.get('sub'))
    link = _text(block.get('link'))

    tags = block.get('tags', [])
    tags_style = None
    if isinstance(tags, dict):
        tags_style = tags.get('style')
        tags = tags.get('items', tags.get('text', []))

    body = block.get('body', [])
    body_items = body
    body_style = None
    if isinstance(body, dict):
        body_items = body.get('items', body.get('text', []))
        body_style = _style_of(body)

    layout = block.get('layout', 'vertical')
    heading_style = _merge_styles(_style_of(block.get('heading')))
    meta_style = _merge_styles(_style_of(block.get('meta')))
    sub_style = _merge_styles(_style_of(block.get('sub')))
    body_class = _merge_styles(body_style)

    parts = []
    # avatar（如果存在）
    avatar_path = block.get('avatar', '')
    if avatar_path and person_dir:
        avatar_style = block.get('avatar_style', 'round')
        avatar_html = _avatar_img(avatar_path, avatar_style, person_dir)
        if avatar_html:
            parts.append(f'<div class="block-avatar-wrap">{avatar_html}</div>')

    # heading + link + meta（全空时跳过，支持 avatar-only block）
    hdr_cls = 'entry-title' + (f' {heading_style}' if heading_style else '')
    if heading or link or meta:
        header_parts = [f'<span class="{hdr_cls}">{_with_icon(_content_html(block.get("heading")), block.get("heading"))}</span>']
        if link:
            header_parts.append(f'<span class="entry-meta"><a href="{_esc(link)}" target="_blank" rel="noopener" class="entry-link">{_inline(link)}</a></span>')
        if meta:
            meta_cls = 'entry-meta' + (f' {meta_style}' if meta_style else '')
            header_parts.append(f'<span class="{meta_cls}">{_with_icon(_content_html(block.get("meta")), block.get("meta"))}</span>')
        parts.append('<div class="entry-header">' + ''.join(header_parts) + '</div>')

    # sub + tags
    if sub or tags:
        sub_parts = []
        if sub:
            sub_parts.append(_with_icon(_content_html(block.get('sub')), block.get('sub')))
        for t in tags:
            t_text = _text(t)
            t_style = _merge_styles(_style_of(t))
            tag_span = f'<span class="tag{" " + t_style if t_style else ""}">'
            sub_parts.append(f'{tag_span}{_with_icon(_content_html(t), t)}</span>')
        sub_cls = 'entry-sub' + (f' {sub_style}' if sub_style else '')
        if tags_style:
            sub_cls = _merge_styles(sub_cls, tags_style)
        parts.append(f'<div class="{sub_cls}">' + ' '.join(sub_parts) + '</div>')

    # body
    if body_items:
        b_cls = 'entry-body' + (f' {body_class}' if body_class else '')
        if layout == 'horizontal':
            spans = []
            for b in body_items:
                item_style = _merge_styles(_style_of(b))
                span_cls = 'inline-item' + (f' {item_style}' if item_style else '')
                item_html = _with_image(_with_icon(_content_html(b), b), b)
                spans.append(f'<span class="{span_cls}">{item_html}</span>')
            parts.append(f'<div class="{b_cls} entry-body-inline">' + '\n'.join(spans) + '</div>')
        else:
            lis = []
            for b in body_items:
                item_style = _merge_styles(_style_of(b))
                item_html = _with_image(_with_icon(_content_html(b), b), b)
                if item_style:
                    lis.append(f'<li class="{item_style}">{item_html}</li>')
                else:
                    lis.append(f'<li>{item_html}</li>')
            parts.append(f'<div class="{b_cls}"><ul>\n' + '\n'.join(lis) + '\n</ul></div>')

    return '\n'.join(parts)


def _block_wrapper(block: dict, content: str) -> str:
    """每个 block 都是独立容器，可带自己的 style。"""
    block_style = _merge_styles(block.get('style'))
    cls = 'block' + (f' {block_style}' if block_style else '')
    return f'<div class="{cls}">\n{content}\n</div>'


def render_entry_list(data: dict, entries: list | None = None, person_dir: str | None = None) -> str:
    if entries is None:
        entries = data.get('items', [])
    if not entries:
        heading = data.get('heading', '')
        if not heading:
            return ''
        entries = [data]

    title = data.get('title', '')
    section_class = _merge_styles(data.get('style'))
    items_html = []

    for item in entries:
        item_class = _merge_styles(item.get('style'))
        blocks = item.get('blocks', None)
        layout = item.get('layout', '')

        # avatar-only item（无 heading/body，仅头像）
        avatar_path = item.get('avatar', '')
        if avatar_path and not blocks and not item.get('heading'):
            avatar_style = item.get('avatar_style', 'round')
            avatar_html = _avatar_img(avatar_path, avatar_style, person_dir)
            inner_html = f'<div class="block-avatar-wrap">{avatar_html}</div>'
            item_class = _merge_styles(item_class, 'entry-avatar')
        elif blocks:
            if layout in ('grid-2', 'grid-3'):
                cells = []
                for b in blocks:
                    cell_content = _block_wrapper(b, _render_block_in_item(b, person_dir))
                    cells.append(f'<div class="grid-cell">\n{cell_content}\n</div>')
                inner_html = '\n'.join(cells)
                item_class = _merge_styles(item_class, layout)
            else:
                inner_html = '\n'.join(
                    _block_wrapper(b, _render_block_in_item(b, person_dir)) for b in blocks)
        else:
            inner_html = _render_block_in_item(item, person_dir)

        entry_cls = 'entry' + (f' {item_class}' if item_class else '')
        items_html.append(f'<div class="{entry_cls}">\n{inner_html}\n</div>')

    inner = '\n'.join(items_html)
    if 'skills-grid' in section_class:
        inner = f'<div class="card-wrap">\n{inner}\n</div>'
    return _section_wrapper(title, inner, section_class)


def render_grouped_list(data: dict) -> str:
    groups = data.get('groups', [])
    if not groups:
        return ''
    items = []
    for g in groups:
        name = g.get('name', '')
        item_list = g.get('items', [])
        items.append(f'<span class="item"><strong>{_inline(name)}\uff1a</strong>{" / ".join(_inline(x) for x in item_list)}</span>')
    inner = '<div class="skills-wrap">' + ' '.join(items) + '</div>' if items else ''
    title = data.get('title', '')
    section_class = _merge_styles(data.get('style'))
    return _section_wrapper(title, inner, section_class)


def render_section(data: dict, person_dir: str | None = None) -> str:
    section_type = data.get('type', 'block')
    if section_type == 'block':
        return render_block(data)
    elif section_type == 'entry-list':
        return render_entry_list(data, person_dir=person_dir)
    elif section_type == 'grouped-list':
        return render_grouped_list(data)
    else:
        print(f'\u8b66\u544a: \u672a\u77e5\u306e section type \u201c{section_type}\u201d')
        return ''
