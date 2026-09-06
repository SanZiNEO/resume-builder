# YAML 协议（protocol）

> AI 写简历内容时参考的语法说明。
> 这里的重点是“内容怎么表达”，不是“样式怎么做”。

---

## 1. 板块类型

每个顶层 YAML 文件是一个板块，用 `type` 声明类型：

| type | 用途 |
|---|---|
| `block` | 单段文本，如 summary |
| `entry-list` | 条目列表，适合教育、项目、实习、工作、技能等 |
| `grouped-list` | 分类列表，适合按组展示的技能/证书 |

示例：

```yaml
type: block
title: Summary
style: [underline-title]
content: "..."
```

---

## 2. 顶层通用字段

```yaml
type: entry-list
order: 2            # 板块排序，越小越靠前
zone: main          # main / sidebar；默认 main
title: Education
style: [gradient-bar]  # 板块容器样式
items: [...]
```

- `order`：板块排序
- `zone`：内容进哪个区域
- `title`：板块标题
- `style`：板块样式列表，可叠加

---

## 3. 对象式字段

普通文本字段可以直接写字符串，也可以写成对象，以便单独贴样式：

```yaml
# 简单写法
heading: 项目名

# 带样式写法
heading:
  text: 项目名
  style: [left-bar]
```

列表字段同理：

```yaml
# 简单写法
body:
  - 条目1
  - 条目2

# 容器带样式
body:
  items:
    - 条目1
    - 条目2
  style: [dot-list]

# 列表项带样式
body:
  items:
    - text: 条目1
      style: [text-muted]
```

---

## 4. 容器与 style

所有会生成容器的对象都可以写 `style`：

| 对象 | 渲染容器 |
|---|---|
| 板块 | `.section` |
| 条目 | `.entry` |
| block | `.block` |
| heading | `.entry-title` |
| meta | `.entry-meta` |
| sub | `.entry-sub` |
| body | `.entry-body` |
| tag | `.tag` |

`style` 接受列表，可叠加：

```yaml
style: [border-rounded, shadow-soft]
```

---

## 5. 行内文本协议

所有文本字段内部支持：

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

示例：

```yaml
body:
  - "独立完成**需求定义到方案交付**，获社区==数万播放=="
  - "项目：{icon:github} GitHub"
  - "截图：![项目截图](assets/images/demo.png)"
```

---

## 6. 图标与图片

### icon（单图标）

```yaml
heading:
  text: 联系方式
  icon: phone
```

### icons（多图标）

```yaml
meta:
  text: 2026.01 – 至今
  icons:
    - name: calendar
      position: before
    - name: clock
      position: after
```

### image（单图）

```yaml
body:
  items:
    - text: 项目截图
      image: assets/images/demo.png
      image_alt: 截图
      image_position: after
      image_width: 300
```

### images（多图）

```yaml
body:
  items:
    - text: 截图
      images:
        - assets/images/demo.png
        - path: assets/images/demo.svg
          image_alt: 备用图
```

### parts（有序片段）

```yaml
body:
  items:
    - parts:
        - icon: location
        - text: "山东大学"
        - icon: link
        - text: "作品集"
```

---

## 7. 文件夹板块（collection）

`data/{person}/` 下任意子目录自动成为一个板块：

```text
data/me/
├── projects/
├── internships/
├── work/
└── awards/
```

文件夹里：

- 每个 `*.yaml` = 一个条目
- `_meta.yaml` = 可选配置
- 条目顺序由文件内 `order` 决定

`_meta.yaml` 示例：

```yaml
title: 实习经历
order: 3
zone: main
style: [underline-title]
```

字段：

| 字段 | 说明 |
|---|---|
| `title` | 板块标题 |
| `order` | 板块顺序 |
| `zone` | main / sidebar |
| `style` | 板块样式 |

如果没有 `_meta.yaml`：

```text
title = 文件夹名
order = 100
zone = main
```

---

## 8. theme.yaml

控制整页/区域背景：

```yaml
page: [paper]          # 整页背景
sidebar: [warm-brown]  # 侧栏背景
main: []               # 不设置则透明
```

theme 样式放在 `styles/theme/*.css`。

---

## 9. 隐私占位符

`personal.yaml` 中的隐私信息用 `${KEY}` 占位：

```yaml
heading:
  text: ${NAME}
body:
  - "电话：${PHONE}"
```

构建时通过环境变量注入：

```bash
NAME=你的姓名 PHONE=你的电话 EMAIL=你的邮箱 python make.py build
```

未注入时保留占位符并输出警告。

---

## 10. reference 段

每个 YAML 末尾都可以写 `reference:`：

```yaml
reference:
  用户原话: >
    用户当时说“我搞了个东西，很多人用”
  专业化表述: >
    独立完成开源项目，获社区数万播放
  待确认: >
    播放量具体数字待确认
```

规则：

- 必须写在文件末尾
- 构建时整段截断，不参与渲染
- 格式自由，AI 自行组织
- 用来保存口径、数字来源、红线、用户原话、待确认事项

---

## 11. 常用命令

```bash
python make.py validate                         # 校验数据
python make.py build --person me --layout default  # 构建 HTML
python make.py build --person me --layout two-column
python make.py watch                            # 监听变化自动重建
python -m pytest                                # 跑测试
```

布局名：

```text
default / two-column / three-column / hero-two-column / timeline / portfolio-grid
```
