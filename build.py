#!/usr/bin/env python3
"""
build.py — 协议化简历构建系统

读取 data/*/*.yaml → 按内容协议渲染 → 注入模板 → 输出 HTML

协议文档见 protocol-spec.md
纯 Python 标准库，零外部依赖。
"""

import os
import re
import glob
import sys
from datetime import datetime


# ── YAML 解析 ──────────────────────────────────────────────

def _parse_value(s: str):
    sv = s.strip()
    if not sv:
        return ''
    if sv == 'true': return True
    if sv == 'false': return False
    try:
        return int(sv)
    except ValueError:
        pass
    if (sv.startswith('"') and sv.endswith('"')) or (sv.startswith("'") and sv.endswith("'")):
        return sv[1:-1]
    return sv


def _parse_inline_list(s: str):
    s = s.strip()
    if s.startswith('[') and s.endswith(']'):
        inner = s[1:-1].strip()
        if not inner:
            return []
        return [_parse_value(x.strip()) for x in re.split(r',\s*', inner)]
    return None


def _find_unquoted_colon(s: str) -> int:
    in_single = False
    in_double = False
    for i, ch in enumerate(s):
        if ch == '"' and not in_single:
            in_double = not in_double
        elif ch == "'" and not in_double:
            in_single = not in_single
        elif ch == ':' and not in_single and not in_double:
            return i
    return -1


def parse_yaml(text: str) -> dict:
    result = {}
    lines = text.split('\n')
    cleaned = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue
        indent = len(line) - len(line.lstrip())
        cleaned.append((i, indent, stripped))

    stack = [(-1, result)]
    last_list_key = None

    i = 0
    while i < len(cleaned):
        line_num, indent, stripped = cleaned[i]

        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()
        current = stack[-1][1]

        if stripped == '>':
            i += 1
            continue

        colon_at = _find_unquoted_colon(stripped)
        if colon_at >= 0:
            key = stripped[:colon_at].rstrip()

            if key.startswith('- '):
                list_key = key[2:].strip()
                value = stripped[colon_at + 1:].strip()

                parent_list = None
                for level in range(len(stack) - 1, -1, -1):
                    d = stack[level][1]
                    for k, v in d.items():
                        if isinstance(v, list):
                            parent_list = v
                            break
                    if parent_list is not None:
                        break

                if parent_list is not None:
                    inline = _parse_inline_list(value)
                    if inline is not None:
                        new_item = {list_key: inline}
                        parent_list.append(new_item)
                    elif value:
                        new_item = {list_key: _parse_value(value)}
                        parent_list.append(new_item)
                    else:
                        new_item = {list_key: []}
                        parent_list.append(new_item)
                        last_list_key = list_key

                    if i + 1 < len(cleaned) and cleaned[i + 1][1] > indent:
                        stack.append((indent, new_item))

                i += 1
                continue

            value = stripped[colon_at + 1:].strip()
            inline = _parse_inline_list(value)

            if inline is not None:
                current[key] = inline
                last_list_key = key
                i += 1
                continue

            if not value or value == '>':
                if i + 1 < len(cleaned):
                    next_line = cleaned[i + 1]
                    if next_line[2] == '>' or value == '>':
                        start_j = i + 1
                        if next_line[2] == '>':
                            start_j = i + 2
                        lines_collected = []
                        j = start_j
                        while j < len(cleaned) and cleaned[j][1] > indent:
                            lines_collected.append(cleaned[j][2])
                            j += 1
                        current[key] = ' '.join(lines_collected)
                        i = j
                        continue
                    elif next_line[1] > indent:
                        if next_line[2].startswith('- '):
                            current[key] = []
                            last_list_key = key
                            stack.append((indent, current))
                            i += 1
                            continue
                        else:
                            new_dict = {}
                            current[key] = new_dict
                            stack.append((indent, new_dict))
                            i += 1
                            continue
                    else:
                        current[key] = ''
                else:
                    current[key] = ''
            else:
                current[key] = _parse_value(value)
                last_list_key = key

        elif stripped.startswith('- '):
            item_text = stripped[2:].strip()
            for level in range(len(stack) - 1, -1, -1):
                d = stack[level][1]
                if last_list_key and last_list_key in d and isinstance(d[last_list_key], list):
                    d[last_list_key].append(_parse_value(item_text))
                    break
                for k, v in d.items():
                    if isinstance(v, list):
                        v.append(_parse_value(item_text))
                        break
                else:
                    continue
                break

        i += 1

    return result


def read_yaml(path):
    with open(path, 'r', encoding='utf-8') as f:
        return parse_yaml(f.read())


# ── 常量 ────────────────────────────────────────────────────

BASE = os.path.dirname(os.path.abspath(__file__))

# ── 样式收集 ────────────────────────────────────────────────

STYLE_CATEGORIES = {
    'section_style': 'section',
    'item_style': 'item',
    'heading_style': 'field',
    'body_style': 'field',
}


def _scan_styles(data: dict, styles_dir: str, collected: set):
    """递归扫描 dict 中的 style 引用字段，收集 CSS 文件路径"""
    if not isinstance(data, dict):
        return
    for field, category in STYLE_CATEGORIES.items():
        style = data.get(field, '')
        if style:
            fpath = os.path.join(styles_dir, category, style + '.css')
            if os.path.exists(fpath):
                collected.add(fpath)
    for v in data.values():
        if isinstance(v, dict):
            _scan_styles(v, styles_dir, collected)
        elif isinstance(v, list):
            for item in v:
                _scan_styles(item, styles_dir, collected)


def collect_styles(styles_dir: str) -> str:
    """加载所有默认样式"""
    defaults = [
        os.path.join(styles_dir, 'content-area', 'default.css'),
        os.path.join(styles_dir, 'zone', 'default.css'),
        os.path.join(styles_dir, 'section', 'default.css'),
        os.path.join(styles_dir, 'item', 'default.css'),
        os.path.join(styles_dir, 'field', 'default.css'),
        os.path.join(styles_dir, 'layout', 'vertical.css'),
        os.path.join(styles_dir, 'layout', 'horizontal.css'),
    ]
    lines = []
    for fpath in defaults:
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    lines.append(content)
        except FileNotFoundError:
            pass
    return '\n\n'.join(lines)


# ── 渲染引擎 ────────────────────────────────────────────────

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
    section_class = data.get('section_class', '') or data.get('section_style', '')
    inner = f'<div class="entry"><div class="entry-body"><p class="block-text">{content}</p></div></div>'
    return _section_wrapper(title, inner, section_class)


def _render_block_in_item(block: dict) -> str:
    """渲染 item 内部的单个 block（heading + sub/tags + body）"""
    heading = block.get('heading', '')
    meta = block.get('meta', '') or ''
    sub = block.get('sub', '') or ''
    tags = block.get('tags', [])
    body = block.get('body', [])
    layout = block.get('layout', 'vertical')
    link = block.get('link', '')
    heading_class = block.get('heading_class', '') or block.get('heading_style', '')
    body_class = block.get('body_class', '') or block.get('body_style', '')

    parts = []
    # heading + link + meta
    hdr_cls = f'entry-title{" " + heading_class if heading_class else ""}'
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
        for t in tags:
            sub_parts.append(f'<span class="tag">{t}</span>')
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


def render_entry_list(data: dict, entries: list | None = None) -> str:
    if entries is None:
        entries = data.get('items', [])
    if not entries:
        heading = data.get('heading', '')
        if not heading:
            return ''
        entries = [data]

    title = data.get('title', '')
    section_class = data.get('section_class', '') or data.get('section_style', '')
    items_html = []

    for item in entries:
        item_class = item.get('item_class', '') or item.get('item_style', '')
        blocks = item.get('blocks', None)

        if blocks:
            # 多 block 模式：一个卡片内多个独立段落
            inner_html = '\n'.join(_render_block_in_item(b) for b in blocks)
        else:
            # 单 block 模式（向后兼容）：item 自身就是 block
            inner_html = _render_block_in_item(item)

        entry_cls = 'entry' + (f' {item_class}' if item_class else '')
        items_html.append(f'<div class="{entry_cls}">\n{inner_html}\n</div>')

    inner = '\n'.join(items_html)
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
    section_class = data.get('section_class', '') or data.get('section_style', '')
    return _section_wrapper(title, inner, section_class)


def render_section(data: dict) -> str:
    section_type = data.get('type', 'block')
    if section_type == 'block':
        return render_block(data)
    elif section_type == 'entry-list':
        return render_entry_list(data)
    elif section_type == 'grouped-list':
        return render_grouped_list(data)
    else:
        print(f'\u8b66\u544a: \u672a\u77e5\u7684 section type \u201c{section_type}\u201d')
        return ''


# ── section 自动发现 ─────────────────────────────────────────

def discover_sections(person_dir: str) -> dict:
    sections = {}
    yaml_files = glob.glob(os.path.join(person_dir, '*.yaml'))
    for f in sorted(yaml_files):
        name = os.path.basename(f)
        data = read_yaml(f)
        data.pop('reference', None)
        sections[name] = data

    project_dir = os.path.join(person_dir, 'projects')
    project_files = sorted(glob.glob(os.path.join(project_dir, '*.yaml')))
    if project_files:
        project_entries = []
        for pf in project_files:
            pdata = read_yaml(pf)
            pdata.pop('reference', None)
            items = pdata.get('items', [])
            if items:
                project_entries.extend(items)
            elif pdata.get('heading'):
                project_entries.append(pdata)
        if project_entries:
            sections['_projects'] = {
                'type': 'entry-list',
                'order': 50,
                'title': 'Projects',
                'items': project_entries,
            }
    return sections


# ── 主流程 ──────────────────────────────────────────────────

def main():
    data_dir = os.path.join(BASE, 'data')

    persons = sorted(d for d in os.listdir(data_dir)
                     if os.path.isdir(os.path.join(data_dir, d)))
    person = 'shuaishuai'
    i = 1
    while i < len(sys.argv):
        if sys.argv[i] in ('--person', '-p') and i + 1 < len(sys.argv):
            person = sys.argv[i + 1]
            sys.argv.pop(i)
            sys.argv.pop(i)
            break
        i += 1

    if person not in persons:
        print(f'\u4eba\u7269\u5e93: {", ".join(persons)}')
        return

    output_dir = os.path.join(BASE, 'output')
    os.makedirs(output_dir, exist_ok=True)
    person_dir = os.path.join(data_dir, person)

    available = sorted(f.replace('.html', '') for f in os.listdir(os.path.join(BASE, 'templates'))
                       if f.endswith('.html'))
    tmpl_name = 'default'
    if len(sys.argv) > 1:
        raw = sys.argv[1]
        if '=' in raw:
            arg = raw.split('=', 1)[1]
        elif raw.startswith('--') and len(sys.argv) > 2:
            arg = sys.argv[2]
        elif raw.startswith('--'):
            arg = raw[2:]
        else:
            arg = raw
        if arg in available:
            tmpl_name = arg
        else:
            print(f'\u6a21\u677f\u5e93: {", ".join(available)}')
            return

    ts = datetime.now().strftime('%Y%m%d-%H%M%S')
    output_path = os.path.join(output_dir, f'{person}-{ts}.html')
    template_path = os.path.join(BASE, 'templates', tmpl_name + '.html')
    if not os.path.exists(template_path):
        return

    # ── 加载数据 ──
    sections_data = discover_sections(person_dir)

    # ── 读取模板 ──
    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()

    # ── 发现模板中的 zone 占位符 ──
    zone_pattern = re.compile(r'\{zone:(\w+)\}')
    zones_in_template = zone_pattern.findall(template)
    if not zones_in_template:
        zones_in_template = ['main']

    # ── 收集并注入样式（按覆盖优先级排序） ──
    styles_dir = os.path.join(BASE, 'styles')

    # 1. 默认样式
    all_css = collect_styles(styles_dir)

    # 2. 模板声明的额外样式（`<!-- styles: path/to/file.css -->`）
    tmpl_styles = re.findall(r'<!--\s*styles:\s*(.+?)\s*-->', template)
    for ref in tmpl_styles:
        for path in ref.split(','):
            path = path.strip()
            if not path:
                continue
            sf = os.path.join(styles_dir, path) if not os.path.isabs(path) else path
            if os.path.exists(sf):
                with open(sf, 'r', encoding='utf-8') as f:
                    content = f.read().strip()
                    if content:
                        all_css = all_css + '\n\n' + content

    # 3. YAML 自定义样式（最优先）
    extra_set = set()
    for name, data in sections_data.items():
        _scan_styles(data, styles_dir, extra_set)
    for ef in sorted(extra_set):
        try:
            with open(ef, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    all_css = all_css + '\n\n' + content
        except FileNotFoundError:
            pass

    template = template.replace('{styles}', all_css)

    # ── 按 zone 分组并排序（按 YAML 的 order 字段）──
    zone_items = {z: [] for z in zones_in_template}
    for name in sections_data:
        data = sections_data[name]
        zone = data.get('zone', 'main')
        if zone not in zone_items:
            zone = 'main'
        order = data.get('order', 999)
        html = render_section(data)
        if html:
            zone_items[zone].append((order, html))

    # ── 注入 zone ──
    for zone in zones_in_template:
        items = sorted(zone_items.get(zone, []), key=lambda x: x[0])
        content = '\n'.join(html for _, html in items)
        template = template.replace(f'{{zone:{zone}}}', content)

    template = re.sub(r'\{zone:\w+\}', '', template)

    # ── 清理模板声明注释 ──
    template = re.sub(r'<!--\s*styles:\s*.+?\s*-->\n?', '', template)

    # ── 页面标题 ──
    page_title = 'Resume'
    for name in sorted(sections_data):
        data = sections_data[name]
        items = data.get('items', [])
        for item in items:
            heading = item.get('heading', '')
            if heading:
                page_title = heading
                break
        if page_title != 'Resume':
            break

    footer_html = ''

    template = template.replace('{title}', page_title)
    template = template.replace('{footer}', footer_html)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(template)

    print(f'done: {output_path} ({person}, {tmpl_name})')


if __name__ == '__main__':
    main()
