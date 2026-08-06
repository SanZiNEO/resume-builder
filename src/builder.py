"""构建编排 — section 发现、build / validate / watch。

build():   YAML → HTML（读模板 → zone 发现 → 样式三级注入 → zone 分组注入 → 写文件）
validate(): 校验 data/{person} 下所有 YAML 结构与类型
watch():    零依赖轮询监听 YAML 变化自动重建
"""

import os
import re
import glob
import sys
import time
from datetime import datetime

from src.yaml_loader import read_yaml, parse_yaml, inject_vars
from src.renderer import render_section
from src.styles import STYLE_CATEGORIES, collect_styles, _scan_styles

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def discover_sections(person_dir: str) -> dict:
    sections = {}
    yaml_files = glob.glob(os.path.join(person_dir, '*.yaml'))
    for f in sorted(yaml_files):
        name = os.path.basename(f)
        # 私有文件 personal.yaml：解析前注入环境变量占位符（AI 只见过占位符）
        if name == 'personal.yaml':
            with open(f, 'r', encoding='utf-8') as fh:
                data = parse_yaml(inject_vars(fh.read()))
        else:
            data = read_yaml(f)
        data.pop('reference', None)
        sections[name] = data

    project_dir = os.path.join(person_dir, 'projects')
    project_files = glob.glob(os.path.join(project_dir, '*.yaml'))
    if project_files:
        loaded = []
        for pf in project_files:
            pdata = read_yaml(pf)
            pdata.pop('reference', None)
            # 项目排序由文件内 order 字段决定（缺省 999），文件名仅作同序稳定键
            loaded.append((pdata.get('order', 999), pf, pdata))
        loaded.sort(key=lambda x: (x[0], x[1]))
        project_entries = []
        for _, pf, pdata in loaded:
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


def build(person: str = 'me', tmpl_name: str = 'default',
          output_dir: str | None = None) -> str | None:
    """构建简历 HTML，返回输出路径；模板或人物不存在时返回 None。
    personal.yaml 的 ${KEY} 占位符由环境变量注入。"""
    data_dir = os.path.join(BASE, 'data')
    persons = sorted(d for d in os.listdir(data_dir)
                     if os.path.isdir(os.path.join(data_dir, d)))
    if person not in persons:
        print(f'人物库: {", ".join(persons)}')
        return None

    if output_dir is None:
        output_dir = os.path.join(BASE, 'output')
    os.makedirs(output_dir, exist_ok=True)
    person_dir = os.path.join(data_dir, person)

    template_path = os.path.join(BASE, 'templates', tmpl_name + '.html')
    if not os.path.exists(template_path):
        return None

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
            else:
                print(f'警告: 未找到模板样式 {path}', file=sys.stderr)

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
        html = render_section(data, person_dir)
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

    ts = datetime.now().strftime('%Y%m%d-%H%M%S')
    output_path = os.path.join(output_dir, f'{person}-{ts}.html')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(template)

    return output_path


_VALID_TYPES = {'block', 'entry-list', 'grouped-list', 'header'}


def _check_style_fields(data: dict, rel: str, problems: list[str]):
    """递归检查 style 引用字段必须为列表格式（旧版单字符串已废弃）"""
    for field in STYLE_CATEGORIES:
        v = data.get(field)
        if v is not None and not isinstance(v, list):
            problems.append(f'{rel}: {field} 应为列表格式（如 [{v}]），单字符串格式已废弃')
    for v in data.values():
        if isinstance(v, dict):
            _check_style_fields(v, rel, problems)
        elif isinstance(v, list):
            for item in v:
                if isinstance(item, dict):
                    _check_style_fields(item, rel, problems)


def validate(person: str = 'me') -> list[str]:
    """校验 data/{person} 下所有 YAML，返回问题描述列表；空列表 = 全部通过。"""
    person_dir = os.path.join(BASE, 'data', person)
    problems = []

    def check(path: str):
        rel = os.path.relpath(path, BASE)
        data = read_yaml(path)
        if not data or not isinstance(data, dict):
            problems.append(f'{rel}: 解析结果为空')
            return
        stype = data.get('type', '')
        if stype not in _VALID_TYPES:
            problems.append(f'{rel}: 未知 type {stype!r}（应为 block / entry-list / grouped-list / header）')
            return
        if stype == 'block' and not data.get('content', '').strip():
            problems.append(f'{rel}: block 缺少 content')
        elif stype == 'entry-list':
            if not data.get('items') and not data.get('heading'):
                problems.append(f'{rel}: entry-list 缺少 items 或 heading')
        elif stype == 'grouped-list' and not data.get('groups'):
            problems.append(f'{rel}: grouped-list 缺少 groups')
        elif stype == 'header' and not data.get('name', '').strip():
            problems.append(f'{rel}: header 缺少 name')
        _check_style_fields(data, rel, problems)

    for f in sorted(glob.glob(os.path.join(person_dir, '*.yaml'))):
        check(f)
    for f in sorted(glob.glob(os.path.join(person_dir, 'projects', '*.yaml'))):
        check(f)

    return problems


def watch(person: str = 'me', tmpl_name: str = 'default',
          interval: float = 1.0) -> None:
    """阻塞式监听：首次立即 build 一次，之后每 interval 秒扫描
    data/{person}/*.yaml 与 data/{person}/projects/*.yaml 的 mtime，
    集合变化（新增/修改/删除）时重新 build；KeyboardInterrupt 时静默退出。"""
    person_dir = os.path.join(BASE, 'data', person)

    def snapshot() -> dict:
        files = (glob.glob(os.path.join(person_dir, '*.yaml'))
                 + glob.glob(os.path.join(person_dir, 'projects', '*.yaml')))
        return {f: os.path.getmtime(f) for f in files}

    last = snapshot()
    path = build(person=person, tmpl_name=tmpl_name)
    if path:
        print(f'done: {path} ({person}, {tmpl_name})')

    try:
        while True:
            time.sleep(interval)
            current = snapshot()
            if current != last:
                last = current
                path = build(person=person, tmpl_name=tmpl_name)
                if path:
                    print(f'done: {path} ({person}, {tmpl_name})')
    except KeyboardInterrupt:
        return
