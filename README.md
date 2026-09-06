# Resume Builder

YAML 数据 + 布局 → 简历产物的轻量构建系统。一键产出 HTML / PDF / 分页 PNG / 长图。

核心特性：每个 YAML 文件末尾的 `reference:` 是 **AI 记忆区**——不会被导入简历，却能让 AI 持续追踪用户上下文、写作口径与决策历史。

仓库自带虚构示例人物：

```text
data/demo/        张三（前端架构/技术负责人）
data/demo-fe-lead/  demo-fe-lead（前端主程岗位定制示例）
data/proto/        功能/样式原型示例
```

## 快速开始

```bash
# 一键全流程：校验 YAML → 构建 HTML → 导出 PDF → 长图 + 分页 PNG
python make.py build --person demo

# 只校验 YAML（AI 写完后自查）
python make.py validate --person demo

# 指定人物 / 布局 / 跳过部分步骤
python make.py build --person demo --layout two-column
python make.py build --person demo-fe-lead --layout timeline
python make.py build --no-images        # 只构建 + PDF
python make.py build --no-pdf           # 只构建 + 长图
python make.py watch                    # 监听 YAML 变化自动重建
```

产物输出到 `output/{person}-{时间戳}/` 文件夹（每次运行新建，不覆盖旧版）。

## 目录结构

```text
resume-builder/
├── make.py                  # 唯一入口（校验 + 构建 + PDF + 截图）
├── src/                     # 核心代码包
│   ├── builder.py           # 构建编排（build / validate / watch）
│   ├── renderer.py          # 渲染引擎
│   ├── inline.py            # 行内文本解析
│   ├── styles.py            # 样式收集
│   ├── assets.py            # SVG 图标与图片加载
│   └── yaml_loader.py       # YAML 解析
├── layouts/                 # 布局骨架
│   ├── default.html
│   ├── two-column.html
│   ├── three-column.html
│   ├── hero-two-column.html
│   ├── timeline.html
│   └── portfolio-grid.html
├── styles/                  # 样式库
│   ├── content-area/ zone/ section/ item/ block/ field/ layout/ theme/
├── assets/                  # 图标和图片素材
│   ├── icons/
│   └── images/
├── data/                    # YAML 数据
│   ├── demo/
│   ├── demo-fe-lead/
│   └── proto/
├── skills/                  # 人机协作 Skill 文档
├── tests/                   # pytest 测试
└── output/                  # 构建产物（不追踪）
```

## 环境要求与安装

- Python 3.10+
- 建议使用虚拟环境

安装依赖：

```bash
python -m pip install -r requirements.txt
```

安装浏览器内核（PDF / 截图需要）：

```bash
python -m playwright install chromium
```

运行测试：

```bash
python -m pip install -r requirements-dev.txt
python -m pytest
```

## 协议概要

每个 YAML 文件是一个板块，通过 `type` 协议统一表达：

| type | 含义 | 适用 |
|------|------|------|
| `block` | 单段文本 | summary |
| `entry-list` | 条目列表，支持 blocks 多段落 | education, projects, experience, profile |
| `grouped-list` | 分类列表 | skills 的另一种形式 |

**字段说明：**

每个会生成容器的对象都可以写 `style: [样式名]`，样式列表可叠加：

```yaml
type: entry-list
order: 2
zone: sidebar
title: Education
style: [underline-title]
items:
  - style: [border-rounded, shadow-soft]
    blocks:
      - style: [panel]
        heading:
          text: 标题
          style: [large-heading]
        meta: 2023-2027
        body:
          items:
            - 条目1
            - 条目2
          style: [dot-list]
        tags:
          - text: 标签1
            style: [tag-pill]
```

### 行内文本协议

| 写法 | 效果 |
|---|---|
| `**重点**` | 加粗 |
| `*斜体*` | 斜体 |
| `==高亮==` | 高亮 |
| `` `代码` `` | 等宽代码 |
| `[文字](url)` | 链接 |
| `![alt](path)` | 插入图片 |
| `{style:name}文本{/style}` | 自定义样式片段 |
| `{icon:name}` | 插入 SVG 图标 |

### 图标与图片

```yaml
icon: phone
icons:
  - name: calendar
    position: before
image: assets/images/demo.png
images:
  - assets/images/demo.png
parts:
  - icon: location
  - text: "山东大学"
```

### 文件夹板块（Collection）

`data/{person}/` 下任意子目录自动成为一个板块：

```text
projects/    → Projects
internships/ → 实习经历
work/        → 工作经历
```

可选 `_meta.yaml`：

```yaml
title: 实习经历
order: 3
zone: main
style: [underline-title]
```

### theme.yaml

```yaml
page: [paper]
sidebar: [warm-brown]
main: []
```

## AI 记忆区：reference

每个 YAML 文件末尾的 `reference:` 是 AI 记忆区。

解析时，从顶层的 `reference:` 行开始，之后所有内容都会截断丢弃，不参与渲染。

AI 可以在这里记录：

- 用户背景与求职方向
- 用户原话与专业化表述
- 数字口径与来源
- 红线与不写什么
- 面试话术
- 项目之间的差异与叙事关系

示例：

```yaml
reference:
  用户提供信息： >
    10 年前端开发经验，目标岗位：前端架构 / 技术负责人。
  数字口径： >
    500 万日活、2000+ star 需能说明来源。
  已确认不写入： >
    与岗位无关的爱好、无法解释的绩效数字。
```

## 样式库与主题

- 样式按视觉效果命名，通过任意对象 `style` 引用
- 样式文件放在 `styles/` 下按分类组织
- 主题背景通过 `theme.yaml` 控制
- 布局通过 `--layout` 选择

常用命令：

```bash
python make.py build --person demo --layout default
python make.py build --person demo --layout two-column
python make.py build --person demo --layout three-column
python make.py build --person demo --layout hero-two-column
python make.py build --person demo --layout timeline
python make.py build --person demo --layout portfolio-grid
```

## 人机协作 Skill

`skills/resume-builder/` 包含 AI 协作流程文档：

```text
SKILL.md            # 核心流程
question-bank.md    # 提问库
protocol.md         # YAML 协议
style-layout.md     # 样式/主题/布局
asset-guide.md      # SVG/图片素材
reference-rules.md  # reference 规则/红线/隐私
```

## 打印

`.page` 采用 A4，打印边距由浏览器打印对话框手动调整。
