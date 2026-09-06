from src.inline import render_inline


def test_bold():
    assert render_inline('**重点**') == '<strong>重点</strong>'


def test_italic():
    assert render_inline('*斜体*') == '<em>斜体</em>'


def test_highlight():
    assert render_inline('==高亮==') == '<span class="text-highlight">高亮</span>'


def test_code():
    assert render_inline('`code`') == '<code>code</code>'


def test_link():
    html = render_inline('[文字](https://example.com)')
    assert 'href="https://example.com"' in html
    assert 'class="entry-link"' in html
    assert '文字' in html


def test_custom_style():
    html = render_inline('{style:accent,shadow}重点{/style}')
    assert '<span class="accent shadow">重点</span>' in html


def test_icon_callback():
    html = render_inline('{icon:phone}', icon_html=lambda name: f'<span class="icon icon-{name}"></span>')
    assert html == '<span class="icon icon-phone"></span>'


def test_markdown_image_callback():
    html = render_inline('![示例](assets/images/demo.png)', image_html=lambda path, alt: f'<img src="{path}" alt="{alt}">')
    assert html == '<img src="assets/images/demo.png" alt="示例">'


def test_raw_text_escaped():
    assert render_inline('<b>&') == '&lt;b&gt;&amp;'
