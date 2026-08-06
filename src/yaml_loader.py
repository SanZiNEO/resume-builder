"""YAML 加载 — PyYAML 标准解析 + reference 区块整段截断 + 占位符注入。

reference 约定：永远位于文件末尾（顶层 `reference:` 起），解析时从该行起
整段截断丢弃，不参与解析——AI 写 reference 无任何格式负担，想怎么写怎么写。

占位符约定：`${KEY}` 形式，构建时由 --var KEY=VALUE 注入（仅 personal.yaml 生效），
未提供的占位符保留原文并输出警告。个人隐私信息（姓名/电话/邮箱）以占位符形式
存在于 personal.yaml，AI 读到的只有占位符，真实值由用户构建时手动传入。
"""

import os
import re
import sys

import yaml

REFERENCE_MARK = 'reference:'

_VAR_RE = re.compile(r'\$\{(\w+)\}')


def inject_vars(text: str, vars: dict | None = None) -> str:
    """替换文本中的 ${KEY} 占位符（仅非注释行）；未提供的 key 保留原文并输出警告。

    vars 缺省时从环境变量读取（构建时通过环境变量注入真实值，
    如 NAME=张三 python main.py build）。"""
    if vars is None:
        vars = os.environ
    if not vars:
        return text
    missing = set()

    def repl(m):
        key = m.group(1)
        if key in vars:
            return str(vars[key])
        missing.add(key)
        return m.group(0)

    out_lines = []
    for line in text.split('\n'):
        if line.lstrip().startswith('#'):
            out_lines.append(line)  # 注释行不参与替换（${...} 只是说明文字）
        else:
            out_lines.append(_VAR_RE.sub(repl, line))
    for key in sorted(missing):
        print(f'警告: 未提供变量 {key}（占位符保留，请通过环境变量传入）', file=sys.stderr)
    return '\n'.join(out_lines)


def _strip_reference(text: str) -> str:
    """截断 reference 区块：找到无缩进的顶层 `reference:` 行，其后的内容全部丢弃。

    折叠块（`>`）内容行必有缩进，不会误伤；嵌套的 reference 字段按顶层处理
    （协议约定 reference 仅出现在文件末尾顶层）。
    """
    lines = text.split('\n')
    for i, line in enumerate(lines):
        if line == REFERENCE_MARK or line.startswith(REFERENCE_MARK + ' '):
            return '\n'.join(lines[:i])
    return text


def parse_yaml(text: str) -> dict:
    """解析 YAML 文本（reference 区块自动截断）。"""
    body = _strip_reference(text)
    result = yaml.safe_load(body) or {}
    if not isinstance(result, dict):
        result = {}
    return result


def read_yaml(path):
    with open(path, 'r', encoding='utf-8') as f:
        return parse_yaml(f.read())
