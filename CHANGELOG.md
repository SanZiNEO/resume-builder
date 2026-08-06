# Changelog

## [0.4.0] - 2026-08-06

### Added
- `main.py` 主入口（build / validate / watch 子命令，AI 友好）
- `screenshot.py` 一键截图：PDF + A4 分页 PNG（300dpi）+ 整页长图
- `order` 字段排序机制：板块与项目按文件内 order 排序，文件名不再决定顺序
- `.disabled` 后缀隐藏板块（扫描只匹配 `*.yaml`）
- 项目标题分级配色：`left-bar` / `left-bar-accent`（S 级紫蓝）/ `left-bar-soft`（青蓝）
- 技能九宫格：`skills-grid` 样式（渲染器新增 card-wrap 容器支持，标题在卡片外）
- 示例数据重构：demo 人物（张三）改为新结构，演示全部新功能

### Changed
- 架构从单文件 build.py 重构为 `src/` 包（builder / renderer / styles / yaml_loader / cli）
- 打印边距修复：`@page margin` 归零，内容边距由 `.page` padding 承担（与浏览器打印"边距：无"一致）
- `reference:` 段规范：文件末尾整段截断，专供 AI 读写上下文

### Fixed
- 打印双重边距（@page margin + .page padding 叠加导致内容区偏移）

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
