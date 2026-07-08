# Resume Builder

YAML 数据 + 模板 → HTML 简历的轻量构建系统。**纯 Python 标准库，零外部依赖。**

## 快速开始

```bash
# 构建默认模板简历
python build.py --person me

# 双栏布局
python build.py --person me two-column
```

## 目录结构

```
resume/
├── build.py                 # 构建脚本
├── protocol-spec.md         # 内容协议规范
├── templates/               # 区域骨架（只管结构，不管样式）
│   ├── default.html         # 单栏布局
│   └── two-column.html      # 左窄右宽双栏
├── styles/                  # 样式库（按层级分类）
│   ├── content-area/        # 页面基础视觉
│   ├── zone/                # 区域样式（dark 深色栏）
│   ├── section/             # 板块样式（underline-title, left-accent...）
│   ├── item/                # 卡片样式（border-rounded, flat-card, frosted-glass...）
│   ├── field/               # 字段样式（badge, dot-list, large-heading...）
│   └── layout/              # 排列模式（vertical, horizontal）
├── data/                    # YAML 数据
│   └── me/                  # 个人简历
│       ├── 00-profile.yaml  # 个人信息
│       ├── 01-summary.yaml  # 摘要
│       ├── 02-education.yaml
│       ├── 03-skills.yaml
│       ├── 04-github.yaml
│       └── projects/        # 项目文件
│           ├── 01-xxx.yaml
│           └── ...
└── output/                  # 构建产物（不追踪）
```

## 协议概要

每个 YAML 文件是一个板块，通过 `type` 协议统一表达：

| type | 含义 | 适用 |
|------|------|------|
| `block` | 单段文本 | summary |
| `entry-list` | 条目列表，支持 blocks 多段落 | education, projects, profile |
| `grouped-list` | 分类列表 | skills |

**字段说明：**

```yaml
type: entry-list
order: 2                    # 板块排序
zone: sidebar               # 归属区域（默认 main）
title: Education
section_style: underline-title   # 引用板块样式
items:
  - item_style: border-rounded   # 引用卡片样式
    blocks:
      - heading: 标题
        heading_style: badge     # 引用字段样式（heading）
        meta: 2023-2027
        body_style: dot-list     # 引用字段样式（body）
        layout: horizontal       # 横向排列
        body:
          - 条目1
          - 条目2
      - heading: 子段落
        tags: [标签1, 标签2]
```

`reference` 段不会写进 HTML，专供 AI 读写上下文。

## 样式库

样式按视觉效果命名，通过 YAML 的 `section_style` / `item_style` / `heading_style` / `body_style` 引用：

```yaml
section_style: underline-title   # → styles/section/underline-title.css
item_style: border-rounded       # → styles/item/border-rounded.css
heading_style: large-heading     # → styles/field/large-heading.css
body_style: dot-list             # → styles/field/dot-list.css
```

模板通过 `<!-- styles: zone/dark.css -->` 声明区域样式。
不加样式引用时使用默认无装饰样式。

## 打印

`.page { padding: 1; }`，打印边距由浏览器打印对话框手动调整。
