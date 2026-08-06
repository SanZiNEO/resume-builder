"""CLI — main.py 的 argparse 子命令入口（build/validate/watch）+ build.py 的旧参数兼容入口。"""

import os
import sys
import argparse

from src import builder


def main(argv: list[str] | None = None) -> int:
    """argparse 子命令 CLI（main.py 用）"""
    parser = argparse.ArgumentParser(
        prog='main.py',
        description='协议化简历构建系统（YAML → HTML）')
    sub = parser.add_subparsers(dest='command', required=True)

    p_build = sub.add_parser('build', help='构建简历 HTML')
    p_build.add_argument('--person', default='me', help='人物目录名（data/ 下）')
    p_build.add_argument('--template', default='default', help='模板名（templates/ 下，不带 .html）')
    p_build.set_defaults(func=cmd_build)

    p_validate = sub.add_parser('validate', help='校验所有 YAML 数据（AI 自查用）')
    p_validate.add_argument('--person', default='me')
    p_validate.set_defaults(func=cmd_validate)

    p_watch = sub.add_parser('watch', help='监听 YAML 变化自动重建')
    p_watch.add_argument('--person', default='me')
    p_watch.add_argument('--template', default='default')
    p_watch.add_argument('--interval', type=float, default=1.0, help='轮询间隔秒')
    p_watch.set_defaults(func=cmd_watch)

    args = parser.parse_args(argv)
    return args.func(args)


def cmd_build(args) -> int:
    path = builder.build(person=args.person, tmpl_name=args.template)
    if path is None:
        return 1
    print(f'done: {path} ({args.person}, {args.template})')
    return 0


def cmd_validate(args) -> int:
    problems = builder.validate(person=args.person)
    if problems:
        for p in problems:
            print(f'ERR {p}')
        print(f'共 {len(problems)} 个问题')
        return 1
    n = len(os.listdir(os.path.join(builder.BASE, 'data', args.person, 'projects'))) if os.path.isdir(
        os.path.join(builder.BASE, 'data', args.person, 'projects')) else 0
    total = len([f for f in os.listdir(os.path.join(builder.BASE, 'data', args.person))
                 if f.endswith('.yaml')]) + n
    print(f'全部通过 ({total} 个文件)')
    return 0


def cmd_watch(args) -> int:
    builder.watch(person=args.person, tmpl_name=args.template, interval=args.interval)
    return 0


def legacy_build_main() -> int:
    """build.py 旧用法兼容：`python build.py --person me [template]`（README 记载的 CLI）"""
    data_dir = os.path.join(builder.BASE, 'data')

    persons = sorted(d for d in os.listdir(data_dir)
                     if os.path.isdir(os.path.join(data_dir, d)))
    person = 'me'
    i = 1
    while i < len(sys.argv):
        if sys.argv[i] in ('--person', '-p') and i + 1 < len(sys.argv):
            person = sys.argv[i + 1]
            sys.argv.pop(i)
            sys.argv.pop(i)
            break
        i += 1

    if person not in persons:
        print(f'人物库: {", ".join(persons)}')
        return 0

    available = sorted(f.replace('.html', '') for f in os.listdir(os.path.join(builder.BASE, 'templates'))
                       if f.endswith('.html'))
    tmpl_name = 'default'
    if len(sys.argv) > 1:
        raw = sys.argv[1]
        if '=' in raw:
            arg = raw.split('=', 1)[1]
        elif raw.startswith('--') and len(sys.argv) > 2:
            arg = sys.argv[2]
        elif raw.startswith('--'):
            arg = raw[2:]
        else:
            arg = raw
        if arg in available:
            tmpl_name = arg
        else:
            print(f'模板库: {", ".join(available)}')
            return 0

    path = builder.build(person=person, tmpl_name=tmpl_name)
    if path is None:
        return 1
    print(f'done: {path} ({person}, {tmpl_name})')
    return 0
