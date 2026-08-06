#!/usr/bin/env python3
"""兼容入口：python build.py --person me [template]（README 记载的旧用法）"""

from src.cli import legacy_build_main

if __name__ == '__main__':
    raise SystemExit(legacy_build_main())
