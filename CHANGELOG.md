# Changelog

## [0.2.0] - 2026-07-08

### Added
- 5 套 HTML 模板（来自 wangyafu/resume-skills）存入 `_preview/`
- 修复所有模板：`@page { size: A4 }`、`@media print`、内嵌 CSS、去外部依赖
- 浏览器预览样式：灰色背景 + 纸张居中 + 阴影
- 分页策略：不限制分页，浏览器自动处理
- 更新规划文档：记录模板决策、评估记录、不做清单
- `docs/PLAN.md` 完整更新

### Changed
- 从 wangyafu/resume-skills 补充 8 条内容规则到 resume skill
- 核心原则第 6 条：亮点前移
- 新增"内容筛选标准"（相关性/含金量/时效性）
- 新增"多页策略"（核心放第一页）
- 新增"校招特殊规则"
- 新增"长条目排版技巧"
- 新增"交互规范"
- remark 字段更名为 ai_notes

### Removed
- 一页双向控制策略（用户内容多，改为多页策略）
- `example/` 目录（存放过的候选模板均不采用）

## [0.1.0] - 2026-07-08

### Added
- 项目初始化，空仓库创建
- 规划文档 `docs/PLAN.md`
- 目录结构：`data/`、`templates/`、`output/`、`docs/`
- `.gitignore` 基础配置
- resume skill 初始版本（.kilo/skills/resume/）
