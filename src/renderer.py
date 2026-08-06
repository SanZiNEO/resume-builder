"""渲染引擎 — 按内容协议把 section dict 渲染为 HTML 片段。"""

import os
import base64
import mimetypes


def _style_classes(value) -> str:
    """style 字段值（list[str]）→ 空格拼接的 class 字符串。

    仅接受列表格式（如 [card-dark, shadow-soft]）；旧版单字符串格式已废弃，
    传 str 返回空（validate 会对旧格式报错，数据应升级为列表）。
    """
    if isinstance(value, list):
        return ' '.join(str(v) for v in value)
    return ''


def _section_wrapper(title: str, content: str, extra_class: str = '') -> str:
    if not content:
        return ''
    cls = 'section' + (f' {extra_class}' if extra_class else '')
    title_html = f'<div class="section-title">{title}</div>' if title else ''
    return f'''<div class="{cls}">
  {title_html}
  {content}
</div>'''


def render_block(data: dict) -> str:
    content = data.get('content', '').strip()
    if not content:
        return ''
    title = data.get('title', '')
    section_class = _style_classes(data.get('section_class')) or _style_classes(data.get('section_style'))
    inner = f'<div class="entry"><div class="entry-body"><p class="block-text">{content}</p></div></div>'
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


def _render_block_in_item(block: dict, person_dir: str | None = None) -> str:
    """渲染 item 内部的单个 block（heading + sub/tags + body）"""
    heading = block.get('heading', '')
    meta = block.get('meta', '') or ''
    sub = block.get('sub', '') or ''
    tags = block.get('tags', [])
    body = block.get('body', [])
    layout = block.get('layout', 'vertical')
    link = block.get('link', '')
    heading_class = _style_classes(block.get('heading_class')) or _style_classes(block.get('heading_style'))
    body_class = _style_classes(block.get('body_class')) or _style_classes(block.get('body_style'))
    tag_class = _style_classes(block.get('tag_style'))

    parts = []
    # avatar（如果存在）
    avatar_path = block.get('avatar', '')
    if avatar_path and person_dir:
        avatar_style = block.get('avatar_style', 'round')
        avatar_html = _avatar_img(avatar_path, avatar_style, person_dir)
        if avatar_html:
            parts.append(f'<div class="block-avatar-wrap">{avatar_html}</div>')
    # heading + link + meta（全空时跳过，支持 avatar-only block）
    hdr_cls = f'entry-title{" " + heading_class if heading_class else ""}'
    if heading or link or meta:
        header_parts = [f'<span class="{hdr_cls}">{heading}</span>']
        if link:
            header_parts.append(f'<span class="entry-meta"><a href="{link}" target="_blank" rel="noopener" class="entry-link">{link}</a></span>')
        if meta:
            header_parts.append(f'<span class="entry-meta">{meta}</span>')
        parts.append('<div class="entry-header">' + ''.join(header_parts) + '</div>')

    # sub + tags
    if sub or tags:
        sub_parts = []
        if sub:
            sub_parts.append(sub)
        tag_span = f'<span class="tag{" " + tag_class if tag_class else ""}">' if tags else ''
        for t in tags:
            sub_parts.append(f'{tag_span}{t}</span>')
        parts.append('<div class="entry-sub">' + ' '.join(sub_parts) + '</div>')

    # body
    if body:
        b_cls = 'entry-body' + (f' {body_class}' if body_class else '')
        if layout == 'horizontal':
            spans = '\n'.join(f'<span class="inline-item">{b}</span>' for b in body)
            parts.append(f'<div class="{b_cls} entry-body-inline">{spans}</div>')
        else:
            lis = '\n'.join(f'<li>{b}</li>' for b in body)
            parts.append(f'<div class="{b_cls}"><ul>\n{lis}\n</ul></div>')

    return '\n'.join(parts)


def render_entry_list(data: dict, entries: list | None = None, person_dir: str | None = None) -> str:
    if entries is None:
        entries = data.get('items', [])
    if not entries:
        heading = data.get('heading', '')
        if not heading:
            return ''
        entries = [data]

    title = data.get('title', '')
    section_class = _style_classes(data.get('section_class')) or _style_classes(data.get('section_style'))
    # section 级 item_style：作用于该 section 的所有条目（item 自身样式追加在后，优先覆盖）
    section_item_style = _style_classes(data.get('item_class')) or _style_classes(data.get('item_style'))
    items_html = []

    for item in entries:
        item_class = _style_classes(item.get('item_class')) or _style_classes(item.get('item_style'))
        if section_item_style and section_item_style not in item_class:
            item_class = (section_item_style + ' ' + item_class).strip()
        blocks = item.get('blocks', None)
        layout = item.get('layout', '')

        # avatar-only item（无 heading/body，仅头像）
        avatar_path = item.get('avatar', '')
        if avatar_path and not blocks and not item.get('heading'):
            avatar_style = item.get('avatar_style', 'round')
            avatar_html = _avatar_img(avatar_path, avatar_style, person_dir)
            inner_html = f'<div class="block-avatar-wrap">{avatar_html}</div>'
            item_class = (item_class + ' entry-avatar').strip()
        elif blocks:
            if layout in ('grid-2', 'grid-3'):
                cells = '\n'.join(
                    f'<div class="grid-cell">\n{_render_block_in_item(b, person_dir)}\n</div>'
                    for b in blocks)
                inner_html = cells
                item_class = (item_class + ' ' + layout).strip()
            else:
                inner_html = '\n'.join(_render_block_in_item(b, person_dir) for b in blocks)
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
        items.append(f'<span class="item"><strong>{name}\uff1a</strong>{" / ".join(item_list)}</span>')
    inner = '<div class="skills-wrap">' + ' '.join(items) + '</div>' if items else ''
    title = data.get('title', '')
    section_class = _style_classes(data.get('section_class')) or _style_classes(data.get('section_style'))
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
