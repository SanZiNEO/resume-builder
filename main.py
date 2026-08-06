"""主入口（AI 友好 CLI）：python main.py build|validate|watch [--person me] [--template default]"""

from src.cli import main

if __name__ == '__main__':
    raise SystemExit(main())
