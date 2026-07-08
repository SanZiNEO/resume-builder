# Resume Builder

数据 + 模板 → HTML 简历的轻量构建系统。**零外部依赖**（纯 Python 标准库）。

## 快速开始

```bash
# 使用示例人物构建简历
python build.py --person demo

# 选择不同模板
python build.py --person demo --template elegant-wine
python build.py --person demo --template two-column
```

> 把你的 YAML 数据放到 `data/{你的名字}/` 下，运行 `python build.py --person {你的名字}` 即可生成。

## 目录结构

```
resume-builder/
├── build.py                # 构建脚本（纯标准库，零依赖）
├── protocol-spec.md        # 内容协议规范
├── templates/              # HTML 模板（只管视觉，不管数据）
│   ├── default.html        # 卡片蓝
│   ├── elegant-wine.html   # 典雅酒红
│   ├── fresh-blue.html     # 清新蓝灰
│   ├── geek-tech.html      # 极客风尚
│   ├── minimal-white.html  # 极简纯白
│   └── two-column.html     # 沉稳双栏
├── data/                   # YAML 数据（每个人一个文件夹）
│   └── demo/               # 示例人物：熊帅帅
│       ├── header.yaml     # type: header
│       ├── 01-summary.yaml # type: block
│       ├── 02-education.yaml
│       ├── 03-skills.yaml
│       ├── 04-experience.yaml
│       ├── 05-honors.yaml
│       ├── 06-others.yaml
│       └── projects/       # 项目文件，自动合并渲染
│           ├── 01-office-platform.yaml
│           └── 02-ecommerce-refactor.yaml
└── output/                 # 构建产物（gitignore）
```

## 协议概览

所有内容通过 4 种 `type` 统一表达：

| type | 含义 | 适用板块 |
|------|------|---------|
| `header` | 页面头部（姓名/联系方式/求职目标） | profile |
| `block` | 单段文本 | summary, 个人总结 |
| `entry-list` | 条目列表，每条含 heading/meta/body | education, experience, projects |
| `grouped-list` | 分类列表（组名 → 条目） | skills |

**核心规则：**

```yaml
# 每个文件声明 type，build.py 按 type 渲染
type: entry-list
title: Education
items:
  - heading: 学校 · 专业 · 学历
    meta: 时间
    body:
      - "要点1"
      - "要点2"

# reference 段仅供 AI 读写，build.py 完全忽略
reference:
  context: "AI 可以在这里写任何备注，不会进 HTML"
```

详细规范见 [`protocol-spec.md`](protocol-spec.md)。

## 加新板块

**只需加一个 YAML 文件，不需要改 build.py 和模板。**

```
在 data/{person}/ 下放一个新的 .yaml 文件 → build.py 自动发现并渲染
文件名控制顺序：01-xxx.yaml、02-xxx.yaml
项目放在 projects/ 子目录下，自动合并到 "Projects" 板块
```

## 模板

模板使用两个占位符：
- `{header}` — 页面头部（姓名、联系方式、求职目标）
- `{sections}` — 所有内容板块，按文件名顺序拼接

**模板只管视觉样式**（颜色、字体、间距、布局），不管数据结构和内容。
