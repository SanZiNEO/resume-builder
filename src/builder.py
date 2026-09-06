"""构建编排 — section 发现、build / validate / watch。

build():   YAML → HTML（读布局 → zone 发现 → 样式三级注入 → zone 分组注入 → 写文件）
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
from src.styles import collect_styles, _scan_styles, _resolve_style_file

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def discover_sections(person_dir: str) -> dict:
    sections = {}
    yaml_files = glob.glob(os.path.join(person_dir, '*.yaml'))
    for f in sorted(yaml_files):
        name = os.path.basename(f)
        if name == 'theme.yaml':
            continue  # 全局主题配置，不当作 section
        # 私有文件 personal.yaml：解析前注入环境变量占位符（AI 只见过占位符）
        if name == 'personal.yaml':
            with open(f, 'r', encoding='utf-8') as fh:
                data = parse_yaml(inject_vars(fh.read()))
        else:
            data = read_yaml(f)
        data.pop('reference', None)
        sections[name] = data

    # 通用 collection：任一子目录都自动成为一个板块（文件夹 = 板块，文件 = 条目）
    for subdir in sorted(os.listdir(person_dir)):
        dir_path = os.path.join(person_dir, subdir)
        if not os.path.isdir(dir_path):
            continue

        meta_path = os.path.join(dir_path, '_meta.yaml')
        meta = read_yaml(meta_path) if os.path.exists(meta_path) else {}
        if not isinstance(meta, dict):
            meta = {}

        collection_files = sorted(glob.glob(os.path.join(dir_path, '*.yaml')))
        files = [f for f in collection_files if os.path.basename(f) != '_meta.yaml']
        if not files:
            continue

        loaded = []
        for f in files:
            data = read_yaml(f)
            data.pop('reference', None)
            # 条目排序由文件内 order 字段决定（缺省 999），文件名仅作同序稳定键
            loaded.append((data.get('order', 999), f, data))
        loaded.sort(key=lambda x: (x[0], x[1]))

        entries = []
        for _, _, data in loaded:
            items = data.get('items', [])
            if items:
                entries.extend(items)
            elif data.get('heading'):
                entries.append(data)
        if not entries:
            continue

        style = meta.get('style', [])
        if not isinstance(style, list):
            style = []
        sections[f'__collection_{subdir}'] = {
            'type': 'entry-list',
            'title': meta.get('title', subdir),
            'order': meta.get('order', 100),
            'zone': meta.get('zone', 'main'),
            'style': style,
            'items': entries,
        }
    return sections


def _read_theme(person_dir: str) -> dict:
    """读取 theme.yaml；没有则返回空字典。"""
    path = os.path.join(person_dir, 'theme.yaml')
    if not os.path.exists(path):
        return {}
    data = read_yaml(path)
    if not isinstance(data, dict):
        return {}
    if isinstance(data.get('theme'), dict):
        return data['theme']
    return data


def _theme_classes(theme: dict, key: str) -> str:
    value = theme.get(key, [])
    if not isinstance(value, list):
        return ''
    return ' '.join(str(v) for v in value if v)


def _load_theme_styles(theme: dict, styles_dir: str, all_css: str) -> str:
    """把 theme.yaml 引用的背景主题 CSS 合并进 all_css。"""
    for key in ('page', 'sidebar', 'main'):
        value = theme.get(key, [])
        if not isinstance(value, list):
            continue
        for name in value:
            if not isinstance(name, str) or not name:
                continue
            fpath = _resolve_style_file(styles_dir, name)
            if not fpath:
                print(f'警告: 未找到主题样式 {name}.css', file=sys.stderr)
                continue
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    all_css = all_css + '\n\n' + content
    return all_css


def build(person: str = 'me', layout_name: str = 'default',
          output_dir: str | None = None) -> str | None:
    """构建简历 HTML，返回输出路径；布局或人物不存在时返回 None。
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

    layout_path = os.path.join(BASE, 'layouts', layout_name + '.html')
    if not os.path.exists(layout_path):
        return None

    # ── 加载数据 ──
    sections_data = discover_sections(person_dir)

    # ── 读取布局 ──
    with open(layout_path, 'r', encoding='utf-8') as f:
        layout_html = f.read()

    # ── 发现布局中的 zone 占位符 ──
    zone_pattern = re.compile(r'\{zone:(\w+)\}')
    zones_in_layout = zone_pattern.findall(layout_html)
    if not zones_in_layout:
        zones_in_layout = ['main']

    # ── 收集并注入样式（按覆盖优先级排序） ──
    styles_dir = os.path.join(BASE, 'styles')

    # 1. 默认样式
    all_css = collect_styles(styles_dir)

    # 2. 布局声明的额外样式（`<!-- styles: path/to/file.css -->`）
    layout_styles = re.findall(r'<!--\s*styles:\s*(.+?)\s*-->', layout_html)
    for ref in layout_styles:
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
                print(f'警告: 未找到布局样式 {path}', file=sys.stderr)

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

    # 4. 全局主题背景（theme.yaml）
    theme = _read_theme(person_dir)
    all_css = _load_theme_styles(theme, styles_dir, all_css)
    page_class = _theme_classes(theme, 'page')
    sidebar_class = _theme_classes(theme, 'sidebar')
    main_class = _theme_classes(theme, 'main')

    layout_html = layout_html.replace('{styles}', all_css)

    # ── 按 zone 分组并排序（按 YAML 的 order 字段）──
    zone_items = {z: [] for z in zones_in_layout}
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
    for zone in zones_in_layout:
        items = sorted(zone_items.get(zone, []), key=lambda x: x[0])
        content = '\n'.join(html for _, html in items)
        layout_html = layout_html.replace(f'{{zone:{zone}}}', content)

    layout_html = re.sub(r'\{zone:\w+\}', '', layout_html)

    # ── 清理布局声明注释 ──
    layout_html = re.sub(r'<!--\s*styles:\s*.+?\s*-->\n?', '', layout_html)

    # ── 页面标题 ──
    page_title = 'Resume'
    for name in sorted(sections_data):
        data = sections_data[name]
        items = data.get('items', [])
        for item in items:
            heading = item.get('heading', '')
            if isinstance(heading, dict):
                heading = heading.get('text', '')
            if heading:
                page_title = str(heading)
                break
        if page_title != 'Resume':
            break

    layout_html = layout_html.replace('{title}', page_title)
    layout_html = layout_html.replace('{page_class}', page_class)
    layout_html = layout_html.replace('{sidebar_class}', sidebar_class)
    layout_html = layout_html.replace('{main_class}', main_class)

    ts = datetime.now().strftime('%Y%m%d-%H%M%S')
    output_path = os.path.join(output_dir, f'{person}-{ts}.html')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(layout_html)

    return output_path


_VALID_TYPES = {'block', 'entry-list', 'grouped-list'}


def _check_style_fields(data: dict, rel: str, problems: list[str]):
    """递归检查统一 style 字段必须为字符串列表。"""
    if 'style' in data:
        v = data['style']
        if not isinstance(v, list):
            problems.append(f'{rel}: style 应为列表格式（如 [card, shadow]），当前是 {type(v).__name__}')
        else:
            for idx, style in enumerate(v):
                if not isinstance(style, str):
                    problems.append(f'{rel}: style[{idx}] 应为字符串，当前是 {type(style).__name__}')
    for v in data.values():
        if isinstance(v, dict):
            _check_style_fields(v, rel, problems)
        elif isinstance(v, list):
            for item in v:
                if isinstance(item, dict):
                    _check_style_fields(item, rel, problems)


def _check_theme(theme_path: str, problems: list[str]):
    """校验 theme.yaml 的 page/sidebar/main 字段。"""
    if not os.path.exists(theme_path):
        return
    data = read_yaml(theme_path)
    if not isinstance(data, dict):
        problems.append(f'{os.path.relpath(theme_path, BASE)}: 解析结果为空')
        return
    if isinstance(data.get('theme'), dict):
        data = data['theme']
    rel = os.path.relpath(theme_path, BASE)
    for key in ('page', 'sidebar', 'main'):
        if key not in data:
            continue
        value = data[key]
        if not isinstance(value, list):
            problems.append(f'{rel}: {key} 应为样式名列表（如 [paper]）')
            continue
        for idx, item in enumerate(value):
            if not isinstance(item, str):
                problems.append(f'{rel}: {key}[{idx}] 应为字符串')


def _check_collection_meta(meta_path: str, problems: list[str]):
    """校验 collection 的 _meta.yaml 字段类型。"""
    if not os.path.exists(meta_path):
        return
    rel = os.path.relpath(meta_path, BASE)
    data = read_yaml(meta_path)
    if not isinstance(data, dict):
        problems.append(f'{rel}: 解析结果为空')
        return
    if 'title' in data and not isinstance(data['title'], str):
        problems.append(f'{rel}: title 应为字符串')
    if 'order' in data and not isinstance(data['order'], int):
        problems.append(f'{rel}: order 应为整数')
    if 'zone' in data and not isinstance(data['zone'], str):
        problems.append(f'{rel}: zone 应为字符串')
    style = data.get('style')
    if style is not None:
        if not isinstance(style, list):
            problems.append(f'{rel}: style 应为列表')
        else:
            for idx, item in enumerate(style):
                if not isinstance(item, str):
                    problems.append(f'{rel}: style[{idx}] 应为字符串')


def _check_asset_refs(data: dict, rel: str, styles_dir: str, problems: list[str]):
    """递归校验 icon/image 字段、行内 {icon:xxx} / {style:xxx} 引用是否存在。"""
    ICONS_DIR = os.path.join(BASE, 'assets', 'icons')
    if not isinstance(data, dict):
        return

    icon = data.get('icon')
    if isinstance(icon, str) and icon:
        if not os.path.exists(os.path.join(ICONS_DIR, icon + '.svg')):
            problems.append(f'{rel}: 找不到图标 assets/icons/{icon}.svg')

    icons = data.get('icons')
    if isinstance(icons, list):
        for item in icons:
            if isinstance(item, str):
                name = item
            elif isinstance(item, dict):
                name = item.get('name') or item.get('icon')
            else:
                continue
            if name and not os.path.exists(os.path.join(ICONS_DIR, name + '.svg')):
                problems.append(f'{rel}: 找不到图标 assets/icons/{name}.svg')

    image = data.get('image')
    if isinstance(image, str) and image:
        full = image if os.path.isabs(image) else os.path.join(BASE, image)
        if not os.path.exists(full):
            problems.append(f'{rel}: 找不到图片 {image}')

    images = data.get('images')
    if isinstance(images, list):
        for item in images:
            if isinstance(item, str):
                path = item
            elif isinstance(item, dict):
                path = item.get('image') or item.get('path') or item.get('src')
            else:
                continue
            if path:
                full = path if os.path.isabs(path) else os.path.join(BASE, path)
                if not os.path.exists(full):
                    problems.append(f'{rel}: 找不到图片 {path}')

    styles = data.get('style')
    if isinstance(styles, list):
        for style_name in styles:
            if isinstance(style_name, str) and style_name and not _resolve_style_file(styles_dir, style_name):
                problems.append(f'{rel}: 找不到样式 {style_name}.css')

    for v in data.values():
        if isinstance(v, str):
            for name in re.findall(r'\{icon:([^}]+)\}', v):
                if not os.path.exists(os.path.join(ICONS_DIR, name + '.svg')):
                    problems.append(f'{rel}: 找不到行内图标 assets/icons/{name}.svg')
            for combined in re.findall(r'\{style:([^}]+)\}', v):
                for name in combined.split(','):
                    name = name.strip()
                    if name and not _resolve_style_file(styles_dir, name):
                        problems.append(f'{rel}: 找不到行内样式 {name}.css')
        elif isinstance(v, dict):
            _check_asset_refs(v, rel, styles_dir, problems)
        elif isinstance(v, list):
            for item in v:
                if isinstance(item, dict):
                    _check_asset_refs(item, rel, styles_dir, problems)
                elif isinstance(item, str):
                    for name in re.findall(r'\{icon:([^}]+)\}', item):
                        if not os.path.exists(os.path.join(ICONS_DIR, name + '.svg')):
                            problems.append(f'{rel}: 找不到行内图标 assets/icons/{name}.svg')
                    for combined in re.findall(r'\{style:([^}]+)\}', item):
                        for name in combined.split(','):
                            name = name.strip()
                            if name and not _resolve_style_file(styles_dir, name):
                                problems.append(f'{rel}: 找不到行内样式 {name}.css')


def validate(person: str = 'me') -> list[str]:
    """校验 data/{person} 下所有 YAML，返回问题描述列表；空列表 = 全部通过。"""
    person_dir = os.path.join(BASE, 'data', person)
    styles_dir = os.path.join(BASE, 'styles')
    problems = []

    def check(path: str):
        rel = os.path.relpath(path, BASE)
        data = read_yaml(path)
        if not data or not isinstance(data, dict):
            problems.append(f'{rel}: 解析结果为空')
            return
        stype = data.get('type', '')
        if stype not in _VALID_TYPES:
            problems.append(f'{rel}: 未知 type {stype!r}（应为 block / entry-list / grouped-list）')
            return
        if stype == 'block' and not data.get('content', '').strip():
            problems.append(f'{rel}: block 缺少 content')
        elif stype == 'entry-list':
            if not data.get('items') and not data.get('heading'):
                problems.append(f'{rel}: entry-list 缺少 items 或 heading')
        elif stype == 'grouped-list' and not data.get('groups'):
            problems.append(f'{rel}: grouped-list 缺少 groups')
        _check_style_fields(data, rel, problems)
        _check_asset_refs(data, rel, styles_dir, problems)

    _check_theme(os.path.join(person_dir, 'theme.yaml'), problems)

    for f in sorted(glob.glob(os.path.join(person_dir, '*.yaml'))):
        if os.path.basename(f) == 'theme.yaml':
            continue
        check(f)

    for subdir in sorted(os.listdir(person_dir)):
        dir_path = os.path.join(person_dir, subdir)
        if not os.path.isdir(dir_path):
            continue
        _check_collection_meta(os.path.join(dir_path, '_meta.yaml'), problems)
        for f in sorted(glob.glob(os.path.join(dir_path, '*.yaml'))):
            if os.path.basename(f) == '_meta.yaml':
                continue
            check(f)

    return problems


def watch(person: str = 'me', layout_name: str = 'default',
          interval: float = 1.0) -> None:
    """阻塞式监听：首次立即 build 一次，之后每 interval 秒扫描
    data/{person}/ 下全部顶层与子目录 YAML 的 mtime，
    集合变化（新增/修改/删除）时重新 build；KeyboardInterrupt 时静默退出。"""
    person_dir = os.path.join(BASE, 'data', person)

    def snapshot() -> dict:
        files = list(glob.glob(os.path.join(person_dir, '*.yaml')))
        for subdir in sorted(os.listdir(person_dir)):
            dir_path = os.path.join(person_dir, subdir)
            if os.path.isdir(dir_path):
                files.extend(glob.glob(os.path.join(dir_path, '*.yaml')))
        return {f: os.path.getmtime(f) for f in files}

    last = snapshot()
    path = build(person=person, layout_name=layout_name)
    if path:
        print(f'done: {path} ({person}, {layout_name})')

    try:
        while True:
            time.sleep(interval)
            current = snapshot()
            if current != last:
                last = current
                path = build(person=person, layout_name=layout_name)
                if path:
                    print(f'done: {path} ({person}, {layout_name})')
    except KeyboardInterrupt:
        return
