from src.builder import _check_style_fields, discover_sections


def test_discover_theme_excluded(workspace_tmp_path):
    person = workspace_tmp_path / 'me'
    person.mkdir()
    (person / 'theme.yaml').write_text('page: [paper]\n', encoding='utf-8')
    (person / 'summary.yaml').write_text('type: block\ncontent: 你好\n', encoding='utf-8')

    sections = discover_sections(str(person))
    assert 'theme.yaml' not in sections
    assert 'summary.yaml' in sections


def test_discover_collection(workspace_tmp_path):
    person = workspace_tmp_path / 'me'
    projects = person / 'projects'
    projects.mkdir(parents=True)
    (projects / '_meta.yaml').write_text(
        'title: Projects\norder: 50\nzone: main\n', encoding='utf-8'
    )
    (projects / 'a.yaml').write_text(
        'type: entry-list\nheading: 项目A\nbody:\n  - 内容\n', encoding='utf-8'
    )

    sections = discover_sections(str(person))
    key = '__collection_projects'
    assert key in sections
    assert sections[key]['title'] == 'Projects'
    assert sections[key]['order'] == 50
    assert len(sections[key]['items']) == 1
    assert sections[key]['items'][0]['heading'] == '项目A'


def test_discover_collection_without_meta(workspace_tmp_path):
    person = workspace_tmp_path / 'me'
    work = person / 'work'
    work.mkdir(parents=True)
    (work / 'a.yaml').write_text('type: entry-list\nheading: 工作A\n', encoding='utf-8')

    sections = discover_sections(str(person))
    key = '__collection_work'
    assert key in sections
    assert sections[key]['title'] == 'work'
    assert sections[key]['order'] == 100


def test_check_style_fields_rejects_non_list():
    problems = []
    _check_style_fields({'style': 'card'}, 'data/me/test.yaml', problems)
    assert len(problems) == 1
    assert 'style 应为列表' in problems[0]


def test_check_style_fields_rejects_non_string_items():
    problems = []
    _check_style_fields({'style': ['card', 1]}, 'data/me/test.yaml', problems)
    assert len(problems) == 1
    assert 'style[1]' in problems[0]
