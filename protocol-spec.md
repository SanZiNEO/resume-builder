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

## 6. 迁移对照表

| 现有文件 | 新 type | 改动 |
|---------|---------|------|
| `profile.yaml` | `header` | 加 `type: header`，文件名可改为 `header.yaml` |
| `summary.yaml` | `block` | 加 `type: block`, `title: Summary` |
| `education.yaml` | `entry-list` | 加 `type: entry-list`, `title: Education`, `items: [...]` |
| `skills.yaml` | `grouped-list` | 加 `type: grouped-list`, `title: Skills` |
| `projects/*.yaml` | `entry-list` | 去掉 `render:` 嵌套，改用平铺字段，加 `type`/`title` |
