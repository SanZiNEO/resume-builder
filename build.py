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
import base64
import mimetypes
from datetime import datetime


# ── YAML 解析（保留，零依赖）────────────────────────────────

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

        if ':' in stripped:
            colon_at = stripped.index(':')
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
                        new_item = {}
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
SECTION_TYPES = {'header', 'block', 'entry-list', 'grouped-list'}


# ── 渲染引擎 ────────────────────────────────────────────────

def render_avatar(data: dict, person_dir: str | None = None) -> str:
    """读取头像图片并生成 base64 内嵌的 img 标签"""
    avatar_path = data.get('avatar', '')
    if not avatar_path or not person_dir:
        return ''
    full_path = os.path.join(person_dir, avatar_path) if not os.path.isabs(avatar_path) else avatar_path
    if not os.path.exists(full_path):
        return ''
    mime_type, _ = mimetypes.guess_type(full_path)
    if not mime_type:
        ext_map = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                   '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp'}
        mime_type = ext_map.get(os.path.splitext(full_path)[1].lower(), 'image/png')
    with open(full_path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('ascii')
    return f'<img src="data:{mime_type};base64,{b64}" class="avatar-img" alt="avatar">'


def render_header(data: dict, avatar_html: str = '') -> str:
    """type: header → 页面头部"""
    c = data.get('contact', {})
    parts = []
    if c.get('phone'): parts.append(f'<span>{c["phone"]}</span>')
    if c.get('email'): parts.append(f'<span>{c["email"]}</span>')
    if c.get('city'): parts.append(f'<span>{c["city"]}</span>')
    age_str = f'{c.get("age", "")}\u5c81' if c.get('age') else ''
    gender = c.get('gender', '')
    if age_str or gender:
        parts.append(f'<span>{gender} \u00b7 {age_str}</span>' if gender and age_str
                     else f'<span>{age_str}{gender}</span>')

    info = ' '.join(parts)

    target_parts = []
    if data.get('target'): target_parts.append(data['target'])
    if data.get('job_status'): target_parts.append(data['job_status'])
    if data.get('max_salary'): target_parts.append(f'\u671f\u671b {data["max_salary"]}')
    sep = ' \u00b7 '
    target_line = f'<div class="target">{sep.join(target_parts)}</div>' if target_parts else ''

    if avatar_html:
        return '''<div class="header header-with-avatar">
  <div class="header-text">
    <h1>{name}</h1>
    <div class="info-line">{info}</div>
    {target}
  </div>
  <div class="header-avatar">{avatar}</div>
</div>'''.format(name=data.get('name', ''), info=info, target=target_line, avatar=avatar_html)

    return '''<div class="header">
  <h1>{name}</h1>
  <div class="info-line">{info}</div>
  {target}
</div>'''.format(name=data.get('name', ''), info=info, target=target_line)


def render_header_info_line(data: dict) -> str:
    """返回 info-line HTML（给 two-column 用）"""
    c = data.get('contact', {})
    parts = []
    if c.get('phone'): parts.append(f'<span>{c["phone"]}</span>')
    if c.get('email'): parts.append(f'<span>{c["email"]}</span>')
    if c.get('city'): parts.append(f'<span>{c["city"]}</span>')
    age_str = f'{c.get("age", "")}\u5c81' if c.get('age') else ''
    gender = c.get('gender', '')
    if age_str or gender:
        parts.append(f'<span>{gender} \u00b7 {age_str}</span>' if gender and age_str
                     else f'<span>{age_str}{gender}</span>')
    return ' '.join(parts)


def render_header_target_line(data: dict) -> str:
    """返回 target-line HTML（给 two-column 用）"""
    target_parts = []
    if data.get('target'): target_parts.append(data['target'])
    if data.get('job_status'): target_parts.append(data['job_status'])
    if data.get('max_salary'): target_parts.append(f'\u671f\u671b {data["max_salary"]}')
    sep = ' \u00b7 '
    return sep.join(target_parts) if target_parts else ''


def _section_wrapper(title: str, content: str) -> str:
    """通用 section 外壳"""
    if not content:
        return ''
    title_html = f'<div class="section-title">{title}</div>' if title else ''
    return f'''<div class="section">
  {title_html}
  {content}
</div>'''


def render_block(data: dict) -> str:
    """type: block → 单段文本"""
    content = data.get('content', '').strip()
    if not content:
        return ''
    title = data.get('title', '')
    inner = f'<div class="entry"><div class="entry-body"><p style="color:var(--text-light);font-size:12.5px;line-height:1.6">{content}</p></div></div>'
    return _section_wrapper(title, inner)


def render_entry_list(data: dict, entries: list | None = None) -> str:
    """type: entry-list → 条目列表

    两种输入模式：
    - entries 传入 → 直接渲染该条目列表（projects 合并用）
    - data['items'] 存在 → 渲染 items 列表
    - 以上都无 → 把 data 自身视为一条 entry（平铺字段模式）
    """
    if entries is None:
        entries = data.get('items', [])
    if not entries:
        # 平铺字段模式：heading/meta/sub/tags/body 在顶层
        heading = data.get('heading', '')
        if not heading:
            return ''
        entries = [data]

    title = data.get('title', '')
    items_html = []

    for item in entries:
        heading = item.get('heading', '')
        meta = item.get('meta', '') or ''
        sub = item.get('sub', '') or ''
        tags = item.get('tags', [])
        body = item.get('body', [])

        # heading + link + meta
        header_parts = [f'<span class="entry-title">{heading}</span>']
        link = item.get('link', '')
        if link:
            header_parts.append(f'<span class="entry-meta"><a href="{link}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">{link}</a></span>')
        if meta:
            header_parts.append(f'<span class="entry-meta">{meta}</span>')
        header_html = '<div class="entry-header">' + ''.join(header_parts) + '</div>'

        # sub + tags
        sub_html = ''
        if sub or tags:
            sub_parts = []
            if sub:
                sub_parts.append(sub)
            for t in tags:
                sub_parts.append(f'<span class="tag">{t}</span>')
            sub_html = '<div class="entry-sub">' + ' '.join(sub_parts) + '</div>'

        # body bullets
        body_html = ''
        if body:
            lis = '\n'.join(f'<li>{b}</li>' for b in body)
            body_html = '<div class="entry-body"><ul>\n' + lis + '\n</ul></div>'

        items_html.append(f'''<div class="entry">
  {header_html}
  {sub_html}{body_html}
</div>''')

    inner = '\n'.join(items_html)
    return _section_wrapper(title, inner)


def render_grouped_list(data: dict) -> str:
    """type: grouped-list → 分类列表（技能）"""
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
    return _section_wrapper(title, inner)


def render_section(data: dict) -> str:
    """按 type 分发到具体渲染器"""
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
    """扫描 person 目录，返回 {stem: data} 字典

    规则：
    - header.yaml → 特例，不加入 sections
    - *.yaml → 按文件名排序，加入 sections
    - projects/*.yaml → 合并为 projects 条目列表
    """
    sections = {}

    # 扫描根目录 yaml（排除 header.yaml）
    yaml_files = glob.glob(os.path.join(person_dir, '*.yaml'))
    for f in sorted(yaml_files):
        name = os.path.basename(f)
        if name == 'header.yaml':
            continue
        data = read_yaml(f)
        # 过滤掉 reference 字段
        data.pop('reference', None)
        sections[name] = data

    # 扫描 projects 子目录
    project_dir = os.path.join(person_dir, 'projects')
    project_files = sorted(glob.glob(os.path.join(project_dir, '*.yaml')))
    if project_files:
        project_entries = []
        for pf in project_files:
            pdata = read_yaml(pf)
            pdata.pop('reference', None)
            # 每个文件是一条 entry（平铺字段或 items 模式）
            items = pdata.get('items', [])
            if items:
                project_entries.extend(items)
            elif pdata.get('heading'):
                project_entries.append(pdata)
        if project_entries:
            sections['_projects'] = {
                'type': 'entry-list',
                'title': 'Projects',
                'items': project_entries,
            }

    return sections


# ── 主流程 ──────────────────────────────────────────────────

def main():
    data_dir = os.path.join(BASE, 'data')

    # 选择人物
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
    ts = datetime.now().strftime('%Y%m%d-%H%M')
    output_path = os.path.join(output_dir, f'{person}-{ts}.html')

    person_dir = os.path.join(data_dir, person)

    # 选择模板
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

    template_path = os.path.join(BASE, 'templates', tmpl_name + '.html')
    if not os.path.exists(template_path):
        return

    # ── 加载数据 ──
    header_data = read_yaml(os.path.join(person_dir, 'header.yaml'))
    sections_data = discover_sections(person_dir)

    # ── 渲染 ──
    avatar_html = render_avatar(header_data, person_dir)
    header_html = render_header(header_data, avatar_html)

    # 按文件名顺序拼接 sections
    sections_html_parts = []
    for name in sorted(sections_data):
        data = sections_data[name]
        html = render_section(data)
        if html:
            sections_html_parts.append(html)
    sections_html = '\n'.join(sections_html_parts)

    footer_html = '<div class="footer-deco">\u25c6 \u25c7 \u25c6 \u25c7 \u25c6</div>'

    # ── 读取模板并注入 ──
    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()

    template = template.replace('{title}', header_data.get('name', '\u7b80\u5386'))
    template = template.replace('{avatar}', avatar_html)
    template = template.replace('{header}', header_html)
    template = template.replace('{sections}', sections_html)
    template = template.replace('{footer}', footer_html)

    # ── 兼容 two-column 模板的特殊占位符 ──
    # 这些在 Group A 模板中不存在（replace 无副作用）
    template = template.replace('{header_content}', render_header_info_line(header_data))
    template = template.replace('{header_target}', render_header_target_line(header_data))

    # 按名称匹配 section 内容（给 two-column 等需要具体定位的模板用）
    for name, data in sections_data.items():
        section_type = data.get('type', 'block')
        if section_type == 'grouped-list':
            # skills_content 只需要 items，不要 section 外壳
            groups = data.get('groups', [])
            items = []
            for g in groups:
                gname = g.get('name', '')
                item_list = g.get('items', [])
                items.append(f'<span class="item"><strong>{gname}\uff1a</strong>{" / ".join(item_list)}</span>')
            template = template.replace('{skills_content}', ' '.join(items) if items else '')
        elif name == '_projects':
            template = template.replace('{projects}', sections_html_parts[-1] if sections_html_parts else '')
        else:
            # 按 title 匹配占位符
            title = data.get('title', '').lower().replace(' ', '_')
            html = render_section(data)
            # 生成 {section_summary}, {section_education} 等
            template = template.replace('{section_' + title + '}', html)
            # 也生成旧的直接名称（如 {summary}, {education_content}）
            slug = os.path.splitext(name)[0]  # 如 '01-summary'
            # 跳过带编号的，匹配精确 title 的占位符
            title_lower = title.lower()
            if title_lower == 'education':
                template = template.replace('{education_content}', html)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(template)

    print(f'done: {output_path} ({person}, {tmpl_name})')


if __name__ == '__main__':
    main()
