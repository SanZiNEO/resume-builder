# 素材指南（asset-guide）

> AI 处理 SVG 图标和图片素材时参考。
> 包含：素材目录、怎么引用、怎么新增、怎么保证自动变色。

---

## 1. 素材目录

```text
assets/
├── icons/       # SVG 小图标
│   ├── phone.svg
│   ├── mail.svg
│   ├── github.svg
│   └── ...
└── images/      # 正文图片 / 截图 / 图表
    ├── demo.png
    ├── demo.svg
    └── ...
```

图标按名字引用：

```text
icon: phone  → assets/icons/phone.svg
```

图片按相对仓库根目录路径引用：

```text
image: assets/images/demo.png
```

---

## 2. 怎么引用

### 单图标

```yaml
heading:
  text: 联系方式
  icon: phone
```

### 多图标

```yaml
meta:
  text: 2026.01 – 至今
  icons:
    - name: calendar
      position: before
    - name: clock
      position: after
```

### 行内图标

```yaml
body:
  - "联系我：{icon:phone} ${PHONE}"
```

### 单图

```yaml
body:
  items:
    - text: 项目截图
      image: assets/images/demo.png
      image_alt: 截图
      image_position: after
      image_width: 300
```

### 多图

```yaml
body:
  items:
    - text: 截图
      images:
        - assets/images/demo.png
        - path: assets/images/demo.svg
          image_alt: 备用图
```

### Markdown 图片

```yaml
body:
  - "项目截图：![截图](assets/images/demo.png)"
```

### 有序片段 parts

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

## 3. 图片字段说明

| 字段 | 作用 |
|---|---|
| `image` | 图片路径，单图 |
| `images` | 图片列表，多图 |
| `image_alt` | 替代文本 |
| `image_position` | `before` / `after`，默认 before |
| `image_width` | 像素宽度，如 `300` |

---

## 4. 图标命名规范

- 小写英文
- 用 `-` 连接单词
- 不与已有图标重名

常用现有图标：

```text
phone / mail / map-pin / link / calendar
graduation-cap / book-open / award / badge-check
briefcase / building-2 / clock
globe / languages / star / users
github / code / database / chart-column / gamepad-2
file-text / message-square / video / sparkles / target / lightbulb
user / check / arrow-right
```

---

## 5. SVG 自动变色

为了保证图标跟随主题颜色：

- 线性图标使用：

```svg
stroke="currentColor"
fill="none"
```

- 填充型品牌图标使用：

```svg
fill="currentColor"
```

- 不要写死颜色：

```svg
<!-- 坏： -->
stroke="#2563EB"

<!-- 好： -->
stroke="currentColor"
```

-

### 新建一个图标

```text
assets/icons/my-icon.svg
```

示例：

```svg
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M5 12h14" />
  <path d="m12 5 7 7-7 7" />
</svg>
```

保存后即可在 YAML 中写：

```yaml
icon: my-icon
```

---

## 6. 添加图片

把图片放进：

```text
assets/images/{file}.png|jpg|svg
```

然后在 YAML 中引用。

支持格式：

```text
png / jpg / jpeg / webp / svg
```

构建时会自动转成 base64 内嵌到 HTML，产物自包含。

---

## 7. 来源建议

- 基础线性图标：Lucide
- 品牌图标：Simple Icons
- 自定义图标：AI 手动画简单 SVG
- 正文图片：用户提供或项目截图

下载/自制后，统一检查：

```text
是否有 currentColor
是否命名规范
是否放入正确目录
是否在 YAML 中引用成功
```

---

## 8. 常见问题

### 图标不显示
- 检查文件名是否和 `icon` 完全一致
- 检查是否在 `assets/icons/` 下
- 检查 SVG 内容是否完整

### 图标不随主题变色
- 检查是否有 `stroke="#..."` / `fill="#..."`
- 改为 `currentColor`

### 图片不显示
- 检查路径是否相对仓库根目录
- 检查文件是否存在
- 检查 `validate` 是否报了找不到图片
