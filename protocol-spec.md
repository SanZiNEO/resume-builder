# 简历内容协议 v1

## 核心理念

> **YAML 数据与 build 端通过同一套协议联通。**
>
> 所有内容板块共用同一套字段结构，
> build 端按 `type` 分发到对应的渲染器。
> 加新板块 = 新建 yaml 文件，不需要改 build 代码。

---

## 1. type 体系

四种 type 覆盖所有现有板块：

| type | 含义 | 渲染方式 | 适用板块 |
|------|------|---------|---------|
| `header` | 页面头部（特例） | 专属渲染：姓名/联系方式/求职目标/状态 | profile |
| `block` | 单段富文本 | 一段文字，支持多行 | summary |
| `entry-list` | 条目列表 | heading/meta/sub/tags + 多个 bullets | education, projects |
| `grouped-list` | 分类列表 | 组名 → 条目列表 | skills |

---

## 2. 各 type 的字段定义

### 2.1 `type: header`

```yaml
type: header
name: 杨泽易
avatar: avatar.jpg          # 可选，头像图片路径（相对于人物目录）
contact:
  phone:
  email:
  city: 全国
  age: 22
  gender: 男
target: 游戏策划 / 用户研究 / 商业分析 / 营销分析
job_status: 在校-随时到岗
max_salary: 面议
```

所有字段可选，渲染时跳过空字段。
`avatar` 指定头像图片路径，build 自动读取并 base64 内嵌到 HTML，
支持 jpg/png/gif/webp 格式。单栏模板中头像靠右，双栏模板中头像在左侧栏居中。

### 2.2 `type: block`

```yaml
type: block
title: Summary              # 可选，section 标题
content: >                  # 多行折叠文本
  山东大学 工商管理类数字营销方向。
  独立完成 20+ 品牌 / 7000+ 用户的微博画像研究……
```

### 2.3 `type: entry-list`

```yaml
type: entry-list
title: Education            # section 标题
items:                      # 条目数组
  - heading: 山东大学 · 工商管理（数字营销方向）· 本科
    meta: 2023.09 - 2027.06
    sub:                    # 可选，副标题/角色
    link: https://...       # 可选，可点击链接
    tags: []                # 可选，标签列表
    body:                   # 要点列表
      - "科研助理（2024.03 – 2026.03）：……"
      - "社会实践（2025.07 – 2025.09）：……"
```

对于 projects（单文件单条目），简化为：

```yaml
type: entry-list
title: Projects             # 会被多个文件共享同一 title
heading: 游戏互动产品创新与商业化探索
meta: 2026.01 – 至今
sub: 独立产品人与开发者
tags: [Minecraft, 直播互动, 开源]
body:
  - "发现Minecraft整合包制作场景……"
  - "设计并开发直播互动商业化系统……"
```

### 2.4 `type: grouped-list`

```yaml
type: grouped-list
title: Skills
groups:
  - name: 大数据类
    items: [数据挖掘, 数据建模, 数据分析, MySQL, SPSS, SQL]
  - name: 开发编程类
    items: [Python, Java, SQLite]
```

---

## 3. `reference:` 字段 —— AI 专属元数据

**所有 type 都可以带 `reference`，build.py 完全忽略它，不渲染到 HTML。**

用途：AI 下次读这个文件时可以知道上下文、关联信息、原始设计意图等。

```yaml
type: entry-list
title: Projects
heading: 游戏互动产品创新与商业化探索
meta: 2026.01 – 至今
body:
  - "发现Minecraft整合包制作场景……"
  - "设计并开发直播互动商业化系统……"

reference:
  context: "这是一款Minecraft模组+直播互动系统的全栈项目"
  skills_used: [Java, Python, WebSocket, Protobuf]
  highlights: [MIT开源上架CurseForge, 两周产生收入]
```

---

## 4. 文件发现规则

build.py 启动时：

1. 扫描 `data/{person}/` 下所有 `.yaml` 文件（**不包括** `header.yaml`）
2. 按文件名**字典序**排序 → 作为 section 依次渲染
3. 扫描 `data/{person}/projects/*.yaml` → 归入一个 "Projects" section
4. 读取 `data/{person}/header.yaml` → 渲染为页面头部

**效果：**
- 想加一个新板块 → 在 person 目录下放一个新的 `.yaml`，取名控制顺序即可
- 想调整顺序 → 重命名文件（如 `01-xxx.yaml` → `03-xxx.yaml`）
- 想删除板块 → 删除文件
- 所有操作**不需要改 build.py 和模板**

### 项目文件的特殊处理

`projects/*.yaml` 虽然也是 `type: entry-list`，但由于每个文件只有一条 entry，
渲染时会将所有项目的条目合并到同一个 "Projects" section 下。

---

## 5. 模板渲染

不再用 `str.replace()` 逐个替换占位符。

新的渲染流程：

```
读取 header.yaml       → 生成 `<div class="header">...</div>`
读取所有 section yaml  → 
  for each file:
    根据 type 选择渲染器:
      block         → 生成 `<div class="section">block</div>`
      entry-list    → 生成 `<div class="section">entries</div>`
      grouped-list  → 生成 `<div class="section">groups</div>`
  合并所有 section HTML
注入模板 → 输出 HTML
```

模板中只保留两个占位符：
- `{header}` — 页面头部
- `{sections}` — 所有板块的拼接 HTML

---

## 6. 理想架构（v2 方向）

当前协议仍存在硬编码（header 的特殊处理、two-column 的兼容代码）。
v2 应当消除所有特例，让协议完全通用。

### 6.1 核心原则

> **模板声明区域，YAML 指定归属，builder 按规则分配。**

不再有 `type: header`、`render_header_info_line()` 等特例。
个人信息跟项目经历一样是普通数据，只是摆放区域不同。

### 6.2 层级模型

```
纸张（Page）
  └── 内容区域（Content Area）
        ├── 区域 A（Zone: sidebar）
        │     ├── 板块 1（Section）    ← YAML 文件
        │     │     ├── 卡片 1（Item）
        │     │     │     ├── 字段（heading / meta / body ...）
        │     │     │     └── layout: vertical | horizontal
        │     │     └── 卡片 2
        │     └── 板块 2
        └── 区域 B（Zone: main）
              └── ...
```

### 6.3 模板声明区域

模板在 HTML 中用 `{zone:xxx}` 占位符标记区域，builder 扫描模板发现所有 zone 占位符：

```html
<!-- two-column.html：双栏布局，模板自己声明两个区域 -->
<div class="page">
  <div class="left">
    {zone:sidebar}
  </div>
  <div class="right">
    {zone:main}
  </div>
</div>
```

```html
<!-- default.html：单栏布局，只有一个主区域 -->
<div class="page">
  {zone:main}
</div>
```

builder 扫描模板，发现 `{zone:sidebar}` 和 `{zone:main}` → 把带 `zone: sidebar` 的 YAML 塞进 `{zone:sidebar}`，其余塞进 `{zone:main}`。

### 6.4 YAML 指定区域

每个 YAML 文件可选的 `zone` 字段告诉 builder 去哪个区域：

```yaml
# 个人基本信息 → 侧边栏
type: entry-list
zone: sidebar
title: Personal Info
items:
  - heading: 杨泽易
    layout: horizontal
    fields: [13800000000, email@example.com, 上海, 22岁]
  - heading: 求职意向
    tags: [数据分析, 游戏策划, 面议]
```

```yaml
# 项目经历 → 主区域
type: entry-list
title: Projects
# 没有 zone，默认去 main
items:
  - heading: 游戏互动产品
    body:
      - "......"
```

区域分配规则：
1. 如果模板没有 `{zone:sidebar}`，即使 YAML 写了 `zone: sidebar` 也归入 `main`
2. 如果 YAML 没写 `zone`，归入 `main`
3. 模板可以有任意数量的区域（`sidebar`、`main`、`header`、`footer`、`left`、`right`...）

### 6.5 布局模式（`layout`）

每个 item 可以指定内部布局模式：

| 模式 | 含义 | 适用 |
|------|------|------|
| `vertical`（默认） | 纵向排列 | 项目要点、长文本 bullets |
| `horizontal` | 横向排列，自动换行 | 联系方式、标签、短字段列表 |

```yaml
type: entry-list
title: Personal Info
items:
  - heading: 杨泽易
    layout: horizontal
    fields:
      - 13800000000
      - email@example.com
      - 上海
      - 22岁
```

`layout: horizontal` 的项目，`body` 或 `fields` 中的每一项渲染为内联元素（span），自动换行。
`layout: vertical`（默认）渲染为列表项（li）。

### 6.6 消除特例对照

| 当前特例 | v2 方案 |
|---------|--------|
| `type: header` 专属渲染 | 用 `entry-list` + `zone: sidebar` + `layout: horizontal` 替代 |
| `target/job_status/max_salary` 硬编码字段 | 统一为 `tags` 或 `fields`，渲染器遍历输出 |
| `contact.phone/email/city` 硬编码 | 用 `layout: horizontal` 的 `fields` 列表 |
| `two-column` 兼容代码 | 模板声明 `{zone:sidebar}` + `{zone:main}`，builder 通用处理 |
| `render_header_info_line()` 重复函数 | 合并到通用 `entry-list` 渲染器 |
| `render_header_target_line()` 重复函数 | 同上 |

### 6.7 收益

- build.py 只需处理 `{zone:xxx}` 占位符分配，不再关心具体字段名
- 所有特殊字段变成普通数据，渲染器不关心字段名
- 加新模板 = 加 HTML 文件 + 声明 zone 占位符，不需要改 build.py
- 模板可以自由组合布局（左栏/右栏/上下栏/三栏），协议不受限
- 个人信息换个区域放 = 改 YAML 里的 `zone` 值，不动模板

---

## 7. 迁移对照表

| 现有文件 | 新 type | 改动 |
|---------|---------|------|
| `profile.yaml` | `header` | 加 `type: header`，文件名可改为 `header.yaml` |
| `summary.yaml` | `block` | 加 `type: block`, `title: Summary` |
| `education.yaml` | `entry-list` | 加 `type: entry-list`, `title: Education`, `items: [...]` |
| `skills.yaml` | `grouped-list` | 加 `type: grouped-list`, `title: Skills` |
| `projects/*.yaml` | `entry-list` | 去掉 `render:` 嵌套，改用平铺字段，加 `type`/`title` |
