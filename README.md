# Resume Builder

YAML 数据 + 模板 → 简历产物的轻量构建系统。一键产出 HTML / PDF / 分页 PNG / 长图。

核心特性：每个 YAML 文件末尾的 `reference:` 是 **AI 记忆区**——不会被导入简历，却能让 AI 持续追踪用户上下文、写作口径与决策历史。

仓库自带虚构示例人物 `demo`（张三），克隆后可直接体验完整流程。

## 快速开始

```bash
# 一键全流程：校验 YAML → 构建 HTML → 导出 PDF → 长图 + 分页 PNG
python make.py build --person demo

# 只校验 YAML（AI 写完后自查）
python make.py validate --person demo

# 指定人物 / 跳过部分步骤
python make.py build --person me
python make.py build --no-images        # 跳过图片（只构建 + PDF）
python make.py build --no-pdf           # 跳过 PDF（只构建 + 长图）
```

产物输出到 `output/{person}-{时间戳}/` 文件夹（每次运行新建，不覆盖旧版）。

## 目录结构

```
resume-builder/
├── make.py                  # 唯一入口（校验 + 构建 + PDF + 截图）
├── src/                     # 核心代码包
│   ├── builder.py           # 构建编排（build / validate）
│   ├── renderer.py          # 渲染引擎
│   ├── styles.py            # 样式收集（功能样式全局 + 模板/YAML 引用）
│   └── yaml_loader.py       # YAML 解析
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
│   └── demo/                # 虚构示例人物（张三）
│       ├── personal.yaml    # 基本信息：姓名/联系方式/照片/求职方向（占位符，环境变量注入）
│       ├── summary.yaml     # 摘要
│       ├── education.yaml
│       ├── skills.yaml
│       ├── github.yaml
│       └── projects/        # 项目文件（板块顺序由文件内 order 字段决定）
└── output/                  # 构建产物（不追踪）
```

## 依赖

- PyYAML：构建（`.venv` 已有）
- playwright + PyMuPDF：PDF 导出与截图，用 `.venv` 安装：
  ```bash
  .venv\Scripts\python.exe -m pip install playwright PyMuPDF
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
section_style: [underline-title]   # 引用板块样式（列表，可叠加多个）
items:
  - item_style: [border-rounded]   # 引用卡片样式（列表）
    blocks:
      - heading: 标题
        heading_style: [badge]     # 引用字段样式（heading）
        meta: 2023-2027
        body_style: [dot-list]     # 引用字段样式（body）
        layout: horizontal       # 横向排列
        body:
          - 条目1
          - 条目2
      - heading: 子段落
        tags: [标签1, 标签2]
```

`reference` 段必须写在文件**末尾**，解析时整段截断丢弃（不参与解析），是 AI 的记忆区，详见下文「AI 记忆区：reference」。

## AI 记忆区：reference

这是本项目最重要的设计之一，也是它能“让 AI 跟踪用户”的原因。

### reference 不是简历内容

每个 YAML 文件末尾的 `reference:` 是 AI 记忆区。

解析时，从顶层的 `reference:` 行开始，**之后的所有内容都会被截断丢弃，不参与渲染，也不会进入简历**。

所以：

- 可以自由写长文、写决策、写规则；
- 不用担心它出现在简历里；
- 不需要符合 `type/items` 等协议格式。

### 为什么它可以跟踪用户

AI 读写简历数据时，可以通过 `reference` 持续获得用户上下文：

- 用户背景与求职方向
- 项目的真实来源与边界
- 哪些内容不写（红线）
- 数字口径与面试解释
- 项目之间的差异与叙事关系
- 措辞规则

这样 AI 可以跨文件、跨会话保持口径一致，而不是每次从零猜。

### reference 应该怎么写

不要把 reference 写成固定的“模板字段”。它更像是 AI 收到用户大量信息后，整理成的一份长期记忆。

demo 里的 reference 是**刻意写厚**的，目的就是让 AI 看到“丰富才是正常形态”。

建议记录：

- 用户提供的信息
- 整理后的判断与决策
- 数字口径与来源
- 红线与不写什么
- 面试话术
- 项目之间的差异与关系
- 后续可能的发展

不要只写几行，也不要按字段数量仿写。

### 示例（AI 记录口吻）

以 demo 人物为例：

```yaml
reference:
  用户提供信息： >
    张三，10 年前端开发经验，虚构示例人物。
    求职方向：前端架构 / 技术负责人 / 全栈。
  整理记录： >
    主投大厂与中大型互联网公司；技术管理岗优先；
    投纯执行岗时弱化团队管理，强化架构与性能。
  数字口径： >
    “500 万日活”“2000+ star”等数字均能说明来源；
    无法解释的数字不写。
  已确认不写入： >
    与前端无关的经历、虚构内容、无法解释的性能数字。
  项目成长线： >
    低代码 → H5 营销平台 → 实时协同 → 电商重构，
    体现从执行到架构设计的成长弧线。
```

### 注意

- 不要按字段数量或行数仿写；
- 应判断“重要信息是否都记录下来了”；
- 用户提供的背景、决策、数字来源、红线、面试话术都应沉淀。

## 板块排序与隐藏

- 板块顺序由 YAML 内的 `order` 字段决定（数值小的在前），**与文件名无关**。
- 项目文件加 `.disabled` 后缀即可整块隐藏（扫描只匹配 `*.yaml`），如 `some-project.yaml.disabled`。

## 私有信息与环境变量注入

`data/{person}/personal.yaml` 存放个人隐私信息（姓名/电话/邮箱/照片），**以 `${KEY}` 占位符形式存在**——外部 AI agent 读到的只有占位符，看不到真实信息。构建时通过环境变量注入真实值（不进任何文件、不进 AI 上下文）：

```bash
# Windows（cmd，已激活 venv）：set 赋值，&& 连接
set NAME=你的姓名 && set PHONE=你的电话 && set EMAIL=你的邮箱 && python make.py
# Git Bash：NAME=你的姓名 PHONE=138****0000 EMAIL=xxx@example.com python make.py
```

未注入的占位符保留原文并输出警告。照片：将图片命名为 `avatar.jpg` 放入 `data/{person}/` 即自动显示。渲染位置：侧栏顶部三列网格（左：基本信息 / 中：联系方式 / 右：照片）。

## 样式库

样式按视觉效果命名，通过 YAML 的 `section_style` / `item_style` / `heading_style` / `body_style` / `zone_style` / `layout_style` 引用，**每个字段接受样式名列表，可叠加多个**（一个元素叠加多个样式类，如卡片 = 背景 + 边框 + 阴影）：

```yaml
section_style: [underline-title]        # → styles/section/underline-title.css
item_style: [border-rounded, shadow-soft]  # → styles/item/border-rounded.css + shadow-soft.css
heading_style: [title-gradient]         # → styles/field/title-gradient.css
body_style: [dot-list]                  # → styles/field/dot-list.css
```

section 级 `item_style` 会作用于该 section 的所有条目；item 自身的样式追加在后（优先覆盖）。
模板通过 `<!-- styles: zone/dark.css -->` 声明区域样式；分类基础样式（各分类 default.css）由模板自行声明，各选各的。

## 打印

`.page { padding: 1; }`，打印边距由浏览器打印对话框手动调整。
