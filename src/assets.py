"""素材加载 — SVG 图标内联 + 通用图片 data URI。

素材目录：
    assets/icons/{name}.svg
    assets/images/{file}
    assets/decor/{name}.svg
"""

import base64
import mimetypes
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE, 'assets')


def _safe_path(path: str) -> str:
    if os.path.isabs(path):
        return path
    return os.path.join(BASE, path)


def icon_svg(name: str) -> str | None:
    """读取 assets/icons/{name}.svg，返回 SVG 内容；不存在返回 None。"""
    clean = os.path.basename(name)
    path = os.path.join(ASSETS_DIR, 'icons', clean + '.svg')
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return f.read().strip()


def image_data_uri(path: str) -> str | None:
    """读取任意图片文件，返回 data URI；不存在返回 None。"""
    full = _safe_path(path)
    if not os.path.exists(full):
        return None
    mime = mimetypes.guess_type(full)[0] or 'application/octet-stream'
    with open(full, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('ascii')
    return f'data:{mime};base64,{b64}'
