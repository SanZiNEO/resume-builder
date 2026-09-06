# 样式、主题与布局（style-layout）

> AI 做视觉时参考的文档。
> 包含：样式库怎么用、怎么新增样式积木、主题背景怎么配、布局怎么选。

---

## 1. 总原则

- 先完成所有内容 YAML，再统一处理视觉。
- 视觉通过 `style` 字段引用样式，不直接改渲染器。
- AI 可以：
  - 从现有样式库里选
  - 新建一个小 CSS 文件作为“样式积木”
  - 通过 `theme.yaml` 控制整体背景
  - 通过 `--layout` 选择页面结构

---

## 2. 样式库结构

```text
styles/
├── content-area/    # 页面基础视觉
├── zone/            # 区域样式（旧模板用）
├── section/         # 板块样式
├── item/            # 条目/卡片样式
├── block/           # block 容器样式
├── field/           # 字段/文本样式
├── layout/          # 条目排列模式
└── theme/           # 整页/区域背景主题
```

样式文件命名：

```text
styles/section/underline-title.css
styles/item/modern-card.css
styles/block/panel.css
styles/field/text-muted.css
styles/theme/paper.css
```

---

## 3. 怎么引用样式

任何容器都可以写：

```yaml
style: [样式名1, 样式名2]
```

示例：

```yaml
type: entry-list
style: [underline-title]              # 板块样式
items:
  - style: [modern-card, shadow-soft] # 条目样式
    blocks:
      - style: [panel]                 # block 样式
        heading:
          text: 项目名
          style: [left-bar]            # 标题样式
        body:
          items:
            - "正文内容"
          style: [dot-list]            # body 样式
        tags:
          - text: 标签
            style: [tag-pill]          # tag 样式
```

---

## 4. 现有样式参考（常用）

### 板块 section

```text
underline-title
gradient-bar
skills-grid
modern-section
retro-section
glass-section
neon-border
boxed / compact / divider
```

### 条目 item

```text
border-rounded
shadow-soft / shadow-glow / shadow-muted
modern-card
retro-paper
glass-card
minimal-card
neon-card
dark-card
plain-card
gradient-soft
```

### block

```text
panel
soft-box
modern-panel
retro-panel
neon-panel
glass-panel
timeline-block
quote-block
code-block
```

### 字段 field

```text
badge
large-heading
left-bar / left-bar-accent / left-bar-soft
dot-list / dot-list-accent / dot-sep
tag-pill / tag-neon / tag-retro / tag-modern
text-muted / text-accent / text-primary / text-success / text-warning / text-danger
gradient-text / neon-text / glow-text
highlight-yellow / highlight-green / highlight-pink
```

---

## 5. 主题背景 theme.yaml

```yaml
# data/{person}/theme.yaml
page: [paper]
sidebar: [warm-brown]
main: []
```

| 字段 | 作用 |
|---|---|
| `page` | 整页背景主题 |
| `sidebar` | 双栏布局的侧栏背景 |
| `main` | 双栏布局的主区背景 |

现有主题：

```text
minimal / paper / retro / warm-brown / dark-theme / neon /
glass / gradient-blue / grid / dots / aurora / sunset
```

主题文件在：

```text
styles/theme/{name}.css
```

主题会自动联动文字颜色，避免深色底配黑字。

---

## 6. 布局选择

`--layout` 决定页面结构：

```bash
python make.py build --person me --layout default
python make.py build --person me --layout two-column
python make.py build --person me --layout three-column
python make.py build --person me --layout hero-two-column
python make.py build --person me --layout timeline
python make.py build --person me --layout portfolio-grid
```

| 布局 | 适合 |
|---|---|
| `default` | 普通单栏简历 |
| `two-column` | 左栏放个人信息/技能，右栏放主要经历 |
| `three-column` | 信息密集、左右侧栏 |
| `hero-two-column` | 顶部头图/联系方式 + 下方双栏 |
| `timeline` | 时间轴经历展示 |
| `portfolio-grid` | 作品集、项目卡网格 |

布局文件在：

```text
layouts/{name}.html
```

---

## 7. AI 新增样式积木

当现有样式不够用时，AI 可以新建 CSS。

### 步骤

1. 确定作用对象：

```text
section → styles/section/{name}.css
item    → styles/item/{name}.css
block   → styles/block/{name}.css
field   → styles/field/{name}.css
```

2. 写一个简单的 CSS 文件。

3. 在原型/测试 YAML 里引用：

```yaml
style: [new-style-name]
```

4. 构建 HTML 预览。

5. 用户确认后再用于正式简历。

### 选择器写法

如果是文本/通用效果，尽量写通用 class：

```css
/* 通用文字效果 */
.text-glow {
  text-shadow: 0 0 8px rgba(96, 165, 250, 0.35);
}
```

如果是容器级样式，写容器+样式类：

```css
/* 卡片样式 */
.entry.my-card {
  background: #fff;
  border-radius: 12px;
  padding: 12px 16px;
}
```

### 注意

- 样式名需要全局唯一，不要和已有样式重名。
- `default.css` 是基础结构样式，不作为 `style` 名使用。
- 新 CSS 文件最好保持小、单一职责，不要写一个巨型文件。

---

## 8. 视觉检查流程

```text
1. 内容 YAML 完成
2. 选择布局 / 主题 / 样式
3. build HTML
4. 给用户看
5. 用户反馈
6. AI 调整
7. 重复
```

不建议 AI 自己判断“好看”，最终以用户视觉反馈为准。
