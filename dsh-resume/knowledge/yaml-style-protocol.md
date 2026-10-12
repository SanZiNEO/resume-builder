# YAML / 容器 / 样式 / 行内协议 使用手册

> 面向 agent 的实用手册，对齐当前实现（不是 v0.1 设计稿）。
> 目的：让你在改简历时知道"哪个字段贴哪个样式、文本内怎么写"。只讲怎么用，不讲为什么。

## 一、简历是嵌套容器

```
page → zone → section → item(entry) → block → heading / sub / body / tag / link
```

每个"会生成容器的 YAML 对象"都可以写 `style: [样式名1, 样式名2]`，多个样式名累加到同一个容器上，靠 CSS 叠加生效。

对应关系：

| YAML 对象 | HTML 容器 | 样式字段 |
|---|---|---|
| section | `.section`（标题 `.section-title`） | `style` |
| item | `.entry` | `style` |
| block | `.block` | `style` |
| heading | `.entry-title` | `style` |
| sub | `.entry-sub` | `style` |
| body | `.entry-body` | `style` |
| tag | `.tag` | `style` |
| link | `.entry-link` | `style` |

统一使用 `style`，**不要**再用旧的 `section_style / item_style / heading_style / body_style / tag_style`。

## 二、YAML 写法

### 2.1 标量字段

```yaml
# 普通写法
heading: 游戏互动产品设计与开发

# 需要贴样式时
heading:
  text: 游戏互动产品设计与开发
  style: [left-bar-accent]
```

### 2.2 列表字段

```yaml
# 普通写法
body:
  - 第一句话
  - 第二句话

# body 容器本身要贴样式
body:
  items:
    - 第一句话
    - 第二句话
  style: [dot-list]

# 列表项单独贴样式
body:
  items:
    - text: 第一句话
      style: [accent]
    - text: 第二句话
      style: [muted]
```

`tags` 同理：

```yaml
tags:
  - text: Minecraft
    style: [tag-pill]
  - text: 直播互动
    style: [tag-pill]
```

## 三、行内文本协议

所有文本字段都会经过解析器。支持的固定语义标记：

| 写法 | 效果 |
|---|---|
| `**重点**` | 加粗 / 强调 |
| `*斜体*` | 斜体 |
| `==高亮==` | 高亮（渲染为 `text-highlight`） |
| `` `代码` `` | 等宽代码 |
| `[文字](https://example.com)` | 链接（渲染为 `entry-link`） |
| `~~删除~~` | 删除线（可选） |

自定义样式片段（可引用任意样式库里的样式名，支持多个）：

```text
{style:样式名}文本{/style}
{style:accent,shadow-soft}重点内容{/style}
```

示例：

```yaml
body:
  - "独立完成**从需求定义到方案交付**的全链路项目，获社区==数万播放==与==数千收藏=="
```

## 四、样式库规则（重要）

- 样式库是**全局共享**的：解析器按**文件名**在所有类别目录下查找 `<名字>.css`
  （如 `styles/section/`, `styles/item/`, `styles/field/`, `styles/block/`, `styles/theme/`, `styles/layout/`, `styles/zone/`, `styles/content-area/`）。
- **所有版本共享同一个库**。因此：
  - **默认**：在 YAML 里**选**已有样式名 + 用 `theme.yaml` 挑主题（这些都落在 `data/<person>/` 内）。
  - **需要新样式时**：**新建专属文件** `styles/<类别>/<person>-custom.css`，只被该版本的 YAML 用
    `style: [<person>-custom]` 引用。
  - **不修改已有的库文件**。"扩库"是例外，不是默认动作。
- 主题：`theme.yaml` 里可给 `page / sidebar / main` 等指定 class（走同一套样式解析）。

## 五、完整示例

```yaml
type: entry-list
style: [section-underline]
title: Projects

items:
  - style: [item-card, shadow-soft]
    blocks:
      - style: [block-panel]
        heading:
          text: 游戏互动产品设计与开发
          style: [left-bar-accent]
        meta: 2026.01 – 至今
        sub: 独立产品人与开发者
        tags:
          - text: Minecraft
            style: [tag-pill]
          - text: 直播互动
            style: [tag-pill]
        body:
          items:
            - "独立完成**从需求定义到方案交付**的全链路项目，获社区==数万播放==与==数千收藏=="
          style: [dot-list]
```

## 六、改完必做

- 用 `export` 工具跑校验+构建；校验失败会返回错误原文，逐条修 YAML，直到通过。
- 纯文本会被 HTML 转义，只有解析出的受控标签（上面这些）才生成 HTML——不要试图在文本里写 HTML。
