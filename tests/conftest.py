import os
import tempfile
from pathlib import Path

import pytest


@pytest.fixture
def workspace_tmp_path():
    """在项目目录内创建临时目录，绕开系统临时目录的沙箱权限限制。"""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with tempfile.TemporaryDirectory(
        dir=root,
        prefix='test-tmp-',
        ignore_cleanup_errors=True,
    ) as d:
        yield Path(d)
