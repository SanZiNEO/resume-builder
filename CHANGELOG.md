# Changelog

## [0.3.0] - 2026-07-09

### Added
- 内容协议（4 种 type：block / entry-list / grouped-list / header）
- blocks 多段落结构（一个卡片内多个独立段落）
- zone 区域系统（模板声明 `{zone:xxx}`，YAML 指定 `zone`）
- 样式库 `styles/`，按层级分类（content-area / zone / section / item / field / layout）
- YAML 样式引用（`section_style` / `item_style` / `heading_style` / `body_style`）
- 模板通过 `<!-- styles: xxx.css -->` 声明区域样式，build.py 按需加载
- layout 布局模式（vertical / horizontal）

### Changed
- 重构 build.py：删除 200+ 行特例代码，改为协议化渲染引擎
- 模板瘦身：从 6 套删至 2 套（default / two-column），仅保留区域骨架
- YAML 数据：删除 `type: header` 特例，改为 `entry-list` + `blocks`
- 样式分离：所有视觉样式从模板移至 `styles/` 样式库
- 样式命名：按视觉效果命名（border-rounded, frosted-glass, underline-title...）
- `.page` padding 改为 `1`，打印边距由浏览器对话框控制

### Removed
- 4 套主题模板（elegant-wine / fresh-blue / geek-tech / minimal-white）
- `render_header()` 等 3 个特例渲染函数
- 内联样式、emoji
- 自定义 YAML 解析器中的嵌套 bug（`items → blocks` 三层嵌套支持已修复）
