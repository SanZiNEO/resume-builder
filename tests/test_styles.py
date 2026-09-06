from src.styles import _scan_styles


def test_scan_generic_style_and_inline(workspace_tmp_path):
    styles = workspace_tmp_path / 'styles'
    section = styles / 'section'
    field = styles / 'field'
    section.mkdir(parents=True)
    field.mkdir(parents=True)
    (section / 'card.css').write_text('.section.card {}', encoding='utf-8')
    (field / 'accent.css').write_text('.accent {}', encoding='utf-8')

    data = {
        'style': ['card'],
        'body': ['普通 {style:accent} 高亮'],
    }
    collected = set()
    _scan_styles(data, str(styles), collected)
    assert len(collected) == 2


def test_scan_skips_non_string(workspace_tmp_path):
    styles = workspace_tmp_path / 'styles'
    (styles / 'section').mkdir(parents=True)
    data = {'style': ['card', 1]}
    collected = set()
    _scan_styles(data, str(styles), collected)
    # 非字符串被跳过，不抛异常
    assert len(collected) == 0
