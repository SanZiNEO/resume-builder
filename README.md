# Resume Builder

YAML 数据 + 布局 → 简历产物的轻量构建系统。
一键产出 HTML / PDF / 分页 PNG / 长图，适合 AI 与用户协作生成、迭代简历。

## 特性

- **数据驱动**：简历内容全部由 `data/{person}/` 下的 YAML 定义
- **AI 记忆区**：每个 YAML 末尾的 `reference:` 会被构建器截断，不参与渲染，用于记录口径、红线、决策与用户原话
- **样式 / 主题 / 布局**：通过 `style`、`theme.yaml`、`--layout` 控制视觉
- **一键导出**：HTML、PDF、长图、分页 PNG
- **多人物 / 多版本**：一个人物一个目录，互不干扰

## 效果预览

```bash
python make.py build --person demo
```

然后打开 `output/demo-*/demo-*.html` 查看构建结果。

## 快速开始

```bash
# 校验所有 YAML
python make.py validate --person demo

# 完整构建（HTML + PDF + 长图 + 分页 PNG）
python make.py build --person demo

# 指定布局
python make.py build --person demo --layout two-column

# 只构建 HTML/长图，不导出 PDF
python make.py build --person demo --no-pdf

# 监听 YAML 变化自动重建
python make.py watch
```

## 项目用法（AI）

使用本项目和 AI 协作时：

1. 先加载仓库根目录的 `AGENTS.md`
2. 按其中的“简历顾问”角色开始聊天
3. 直接围绕用户简历内容讨论，不需要先介绍项目
4. 一个 YAML 一个 YAML 来，边讨论、边确认、边修改

AI 不需要做：代码审查、项目结构讲解、git 状态汇报、内部流程说明。

## 使用方式

### 创建一份新简历

```text
data/{person}/
```

每个目录代表一份简历。目录下放顶层板块 YAML，也可以放子目录作为 collection。

### 添加一个板块

```yaml
# data/{person}/education.yaml
type: entry-list
title: 教育背景
order: 1
style:
  - underline-title
items:
  - heading:
      text: 山东大学 · 工商管理 · 本科
    meta: 2023.09 - 2027.06
    body:
      - 主修课程：市场营销学、管理学、Python 数据分析
```

### 添加一个项目 / 经历条目

子目录会自动成为一个板块，例如：

```yaml
# data/{person}/projects/_meta.yaml
title: 项目经历
order: 2
zone: main
style:
  - underline-title
```

每个条目一个 YAML：

```yaml
# data/{person}/projects/example.yaml
type: entry-list
heading:
  text: 项目名称
body:
  - 项目描述
  - 使用的方法与工具
  - 可量化的成果
```

### AI 记忆区（reference）

每个 YAML 文件末尾都可以写：

```yaml
reference:
  用户原话: >
    用户说“我可以使用 Excel 做数据透视表”
  口径: >
    技能只写真实使用过的，不写“精通”
  红线: >
    不虚构经历、不编造数字
```

`reference:` 之后的内容构建时会被整段截断，不会出现在简历成品里。

所有讨论记录、口径、红线、待确认事项都写进对应 YAML 的 `reference`；
不要另外创建 `_notes.md`、`ai-notes.md` 等独立记忆文件。
所有 YAML 使用同一套协议，没有特殊格式。

## 与 AI 协作的使用建议

- **一个 YAML 一个 YAML 来**：不要一次性收集完整简历后再统一写。先聊当前板块，确认后再落盘。
- **边讨论边修改**：用户说一段、AI 给反馈或草稿、确认后再写对应的 YAML，再进入下一个板块。
- **板块顺序灵活**：不需要严格从前往后。用户当前最想改哪块，就先讨论哪块。
- **总结类内容最后处理**：`skills`、`summary`、`personal` 这类需要基于教育/实习/项目提炼的内容，放到最后再写，避免一开始空洞或前后矛盾。
- **`reference` 同步记录**：讨论中形成的口径、红线、待确认事项随时记入 `reference`，但不打断对话节奏。
- **JD 定制**：如果用户需要按岗位 JD 调整简历，先确认哪份是“标准通用简历”，复制一份并重命名，在副本里做针对性调整，不直接改动标准版。

## YAML 协议简述

| type | 用途 |
|---|---|
| `block` | 单段文本，如自我评价 |
| `entry-list` | 条目列表，如教育、实习、项目、技能 |
| `grouped-list` | 分组列表，如技能分类 |

常用字段：

```text
order   # 板块顺序
zone    # main / sidebar
title   # 板块标题
style   # 样式列表，可叠加
items   # 条目列表
blocks  # 多段落结构
heading / meta / sub / body / tags
```

行内标记：

```text
**加粗**        ==高亮==        `代码`
{style:name}文本{/style}
{icon:name}     ![图片](assets/images/demo.png)
```

更完整的示例直接看：

```text
data/demo/
data/demo-fe-lead/
data/proto/
```

这些是虚构示例数据，不是真实用户简历。

## 目录结构

```text
resume-builder/
├── make.py                  # 唯一入口：校验 + 构建 + PDF + 截图
├── src/                     # 核心代码
├── layouts/                 # 页面布局
├── styles/                  # 样式库
├── assets/                  # 图标与图片
├── data/                    # YAML 简历数据
├── tests/                   # pytest 测试
└── output/                  # 构建产物（不追踪）
```

## 环境要求

- Python 3.10+

安装依赖：

```bash
python -m pip install -r requirements.txt
```

导出 PDF / PNG 需要浏览器内核：

```bash
python -m playwright install chromium
```

安装测试依赖并运行：

```bash
python -m pip install -r requirements-dev.txt
python -m pytest
```

## 布局

```text
default / two-column / three-column / hero-two-column / timeline / portfolio-grid
```

## License

MIT
