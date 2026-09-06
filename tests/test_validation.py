import os

from src.builder import (
    _check_asset_refs,
    _check_collection_meta,
    _check_theme,
)

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STYLES_DIR = os.path.join(REPO_ROOT, 'styles')


def test_theme_rejects_non_list(workspace_tmp_path):
    theme = workspace_tmp_path / 'theme.yaml'
    theme.write_text('page: paper\n', encoding='utf-8')
    problems = []
    _check_theme(str(theme), problems)
    assert len(problems) == 1
    assert 'page 应为样式名列表' in problems[0]


def test_theme_accepts_list(workspace_tmp_path):
    theme = workspace_tmp_path / 'theme.yaml'
    theme.write_text('page: [paper]\n', encoding='utf-8')
    problems = []
    _check_theme(str(theme), problems)
    assert problems == []


def test_collection_meta_rejects_wrong_order(workspace_tmp_path):
    meta = workspace_tmp_path / '_meta.yaml'
    meta.write_text('title: 实习\norder: abc\n', encoding='utf-8')
    problems = []
    _check_collection_meta(str(meta), problems)
    assert any('order 应为整数' in p for p in problems)


def test_asset_refs_reports_missing_icon():
    problems = []
    _check_asset_refs({'icon': 'not-exist-icon'}, 'data/me/test.yaml', STYLES_DIR, problems)
    assert any('找不到图标' in p for p in problems)


def test_asset_refs_reports_missing_image():
    problems = []
    _check_asset_refs({'image': 'assets/images/not-exist.png'}, 'data/me/test.yaml', STYLES_DIR, problems)
    assert any('找不到图片' in p for p in problems)


def test_asset_refs_reports_missing_style():
    problems = []
    _check_asset_refs({'style': ['not-exist-style']}, 'data/me/test.yaml', STYLES_DIR, problems)
    assert any('找不到样式 not-exist-style.css' in p for p in problems)


def test_asset_refs_reports_missing_inline_icon():
    problems = []
    _check_asset_refs({'body': ['{icon:not-exist-icon} hi']}, 'data/me/test.yaml', STYLES_DIR, problems)
    assert any('找不到行内图标' in p for p in problems)


def test_asset_refs_reports_missing_icons_list():
    problems = []
    _check_asset_refs({'icons': ['not-exist-icon']}, 'data/me/test.yaml', STYLES_DIR, problems)
    assert any('找不到图标' in p for p in problems)


def test_asset_refs_reports_missing_images_list():
    problems = []
    _check_asset_refs({'images': ['assets/images/not-exist.png']}, 'data/me/test.yaml', STYLES_DIR, problems)
    assert any('找不到图片' in p for p in problems)
