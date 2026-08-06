# Resume Builder

YAML 数据 + 模板 → HTML 简历的轻量构建系统。仅依赖 PyYAML（标准 YAML 解析）。

## 快速开始

```bash
# 构建示例人物简历（张三，虚构数据）
python main.py build --person demo

# 校验 YAML（AI 写完自查）
python main.py validate --person demo

# 监听 YAML 变化自动重建
python main.py watch --person demo

# 一键导出 PDF / A4 分页 PNG / 长图（需 playwright + pymupdf 环境）
python screenshot.py demo all
```

## 目录结构

```
resume-builder/
├── main.py                  # 主入口（build/validate/watch 子命令）
├── build.py                 # 兼容入口（旧用法 python build.py --person demo）
├── screenshot.py            # 一键截图：PDF + 分页 PNG + 长图
├── src/                     # 核心代码包
│   ├── cli.py               # CLI 参数解析
│   ├── builder.py           # 构建编排（build / validate / watch）
│   ├── renderer.py          # 渲染引擎
│   ├── styles.py            # 样式收集
│   └── yaml_loader.py       # YAML 解析
├── protocol-spec.md         # 内容协议规范
├── templates/               # 区域骨架
│   ├── default.html         # 单栏布局
│   └── two-column.html      # 双栏布局（旧版，待适配）
├── styles/                  # 样式库（按层级分类）
│   ├── content-area/        # 页面基础视觉
│   ├── zone/                # 区域样式
│   ├── section/             # 板块样式（underline-title, skills-grid...）
│   ├── item/                # 卡片样式（border-rounded, card-accent...）
│   ├── field/               # 字段样式（badge, left-bar, left-bar-accent...）
│   └── layout/              # 排列模式
├── data/
│   └── demo/                # 示例人物（张三，虚构数据）
│       ├── personal.yaml    # 私有信息（占位符，环境变量注入）
│       ├── summary.yaml
│       ├── experience.yaml
│       ├── education.yaml
│       ├── skills.yaml
│       ├── honors.yaml
│       ├── github.yaml
│       └── projects/        # 项目文件（顺序由 order 字段决定）
└── output/                  # 构建产物（不追踪）
```

## 协议概要

每个 YAML 文件是一个板块，通过 `type` 协议统一表达：

| type | 含义 | 适用 |
|------|------|------|
| `block` | 单段文本 | summary |
| `entry-list` | 条目列表，支持 blocks 多段落 | education, experience, projects |
| `grouped-list` | 分类列表 | skills |

**关键字段：**

```yaml
type: entry-list
order: 2                    # 板块/项目排序（文件名字不影响顺序）
zone: sidebar               # 归属区域（默认 main）
title: Education
section_style: [underline-title]   # 板块样式（列表，可叠加）
items:
  - heading: 标题
    heading_style: [badge]        # 字段样式（如 left-bar / left-bar-accent / left-bar-soft）
    meta: 2023-2027
    body_style: [dot-list]
    body:
      - 条目1
```

`reference` 段必须写在文件**末尾**，解析时整段截断丢弃（不参与解析、不渲染），专供 AI 读写上下文（写作背景、数据口径、决策记录等）。

**排序机制**：所有板块与项目条目按文件内 `order` 字段排序（缺省 999），文件名前缀仅是命名习惯；`.disabled` 后缀文件可隐藏板块（扫描只匹配 `*.yaml`）。

## 私有信息与环境变量注入

`data/{person}/personal.yaml` 存放个人隐私信息（姓名/电话/邮箱/照片），以 `${KEY}` 占位符形式存在。构建时通过环境变量注入真实值（不进任何文件）：

```bash
# Git Bash
NAME=张三 PHONE=13800000000 EMAIL=zhangsan@example.com python main.py build --person demo
```

未注入的占位符保留原文并输出警告。照片：将图片命名为 `avatar.jpg`（或任意图片名）放入 `data/{person}/`，在 personal.yaml 中引用即可自动 base64 内嵌。

## 样式库

样式按视觉效果命名，通过 `section_style` / `item_style` / `heading_style` / `body_style` / `zone_style` / `layout_style` 引用，每个字段接受样式名列表，可叠加多个：

```yaml
section_style: [underline-title]            # → styles/section/underline-title.css
item_style: [border-rounded, shadow-soft]   # → 卡片 = 背景 + 边框 + 阴影
heading_style: [left-bar]                   # → 左伸圆角渐变条标题（left-bar / -accent / -soft 三档配色）
body_style: [dot-list]                      # → styles/field/dot-list.css
```

常用组合：
- 项目标题分级配色：`left-bar-accent`（S 级紫蓝渐变）/ `left-bar`（主蓝）/ `left-bar-soft`（青蓝）
- 技能九宫格：`section_style: [underline-title, skills-grid]`（每组技能为独立 item，自动包卡片容器）
- 板块标题：`underline-title`（左对齐+渐变线）/ `gradient-bar`（紫蓝渐变横条）

## 截图导出

`screenshot.py` 一键生成 PDF（按 CSS @page 渲染，边距=设计值）+ A4 分页 PNG（300dpi）+ 整页长图：

```bash
python screenshot.py demo all     # all | pdf | pages | long
```

依赖：`playwright`（Chromium）+ `pymupdf`，可用任意带这两个包的 venv 运行。

## 打印

`.page { padding: 1; }`，打印边距由 CSS 控制；PDF 导出时 `@page margin` 归零、内容边距由 `.page` padding 承担（与浏览器打印"边距：无"效果一致）。
