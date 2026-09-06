import src.assets as assets


def test_icon_svg_missing(workspace_tmp_path, monkeypatch):
    monkeypatch.setattr(assets, 'ASSETS_DIR', str(workspace_tmp_path / 'assets'))
    assert assets.icon_svg('phone') is None


def test_icon_svg_loads(workspace_tmp_path, monkeypatch):
    assets_dir = workspace_tmp_path / 'assets'
    icons = assets_dir / 'icons'
    icons.mkdir(parents=True)
    (icons / 'phone.svg').write_text('<svg></svg>', encoding='utf-8')
    monkeypatch.setattr(assets, 'ASSETS_DIR', str(assets_dir))
    assert assets.icon_svg('phone') == '<svg></svg>'


def test_image_data_uri(workspace_tmp_path, monkeypatch):
    root = workspace_tmp_path
    img_dir = root / 'assets' / 'images'
    img_dir.mkdir(parents=True)
    (img_dir / 'demo.png').write_bytes(b'fake-png-bytes')
    monkeypatch.setattr(assets, 'BASE', str(root))

    uri = assets.image_data_uri('assets/images/demo.png')
    assert uri.startswith('data:image/png;base64,')
    assert 'ZmFrZS1wbmctYnl0ZXM=' in uri
