import src.renderer as renderer


def test_render_block_escapes_html():
    html = renderer.render_block({
        'type': 'block',
        'title': '摘要',
        'style': ['underline-title'],
        'content': '<b>内容</b>',
    })
    assert '&lt;b&gt;内容&lt;/b&gt;' in html
    assert 'section underline-title' in html


def test_render_entry_list_object_fields():
    data = {
        'type': 'entry-list',
        'style': ['underline-title'],
        'title': '教育',
        'items': [
            {
                'style': ['card'],
                'blocks': [
                    {
                        'style': ['panel'],
                        'heading': {'text': '标题', 'style': ['large-heading']},
                        'body': {
                            'items': ['条目A', '条目B'],
                            'style': ['dot-list'],
                        },
                    }
                ],
            }
        ],
    }
    html = renderer.render_entry_list(data)
    assert 'class="section underline-title"' in html
    assert 'class="entry card"' in html
    assert 'class="block panel"' in html
    assert 'class="entry-title large-heading"' in html
    assert 'class="entry-body dot-list"' in html
    assert '<li>条目A</li>' in html
    assert '<li>条目B</li>' in html


def test_render_entry_list_inline_markup():
    data = {
        'type': 'entry-list',
        'items': [
            {'blocks': [{'body': {'items': ['**加粗** ==高亮==']}}]},
        ],
    }
    html = renderer.render_entry_list(data)
    assert '<strong>加粗</strong>' in html
    assert '<span class="text-highlight">高亮</span>' in html


def test_render_entry_list_icon(monkeypatch):
    monkeypatch.setattr(
        renderer,
        '_icon_html',
        lambda name: f'<span class="icon icon-{name}"></span>',
    )
    data = {
        'type': 'entry-list',
        'items': [
            {
                'blocks': [
                    {
                        'heading': {'text': '联系方式', 'icon': 'phone'},
                        'body': {'items': [{'text': '邮箱', 'icon': 'mail'}]},
                    }
                ]
            }
        ],
    }
    html = renderer.render_entry_list(data)
    assert '<span class="icon icon-phone"></span>' in html
    assert '<span class="icon icon-mail"></span>' in html


def test_render_entry_list_image(monkeypatch):
    monkeypatch.setattr(
        renderer,
        'image_data_uri',
        lambda path: 'data:image/png;base64,abc',
    )
    data = {
        'type': 'entry-list',
        'items': [
            {'blocks': [{'body': {'items': [{'text': '截图', 'image': 'x.png'}]}}]},
        ],
    }
    html = renderer.render_entry_list(data)
    assert '<img src="data:image/png;base64,abc" alt="" class="inline-image">' in html


def test_render_grouped_list_escapes():
    html = renderer.render_grouped_list({
        'type': 'grouped-list',
        'title': '技能',
        'groups': [{'name': '<语言>', 'items': ['Python', 'Java']}],
    })
    assert '&lt;语言&gt;' in html
    assert 'Python' in html
