# 样式库索引

> 共 **999** 个样式文件 · **8** 个分类 · **54** 套完整风格

> 由 `python make.py styles` 依据 `styles/suites.yaml` 自动生成，不要手改；机器可读版本见 `manifest.json`。


## 一、目录结构

```
styles/
├── content-area/     1   内容区容器
├── zone/             2   区域（sidebar / main）
├── section/        178   板块容器
├── item/           188   条目卡片
├── block/          243   块级容器
├── field/          317   字段（标题 / 副标题 / 正文 / 标签 / 徽章）
├── layout/           4   布局（vertical / horizontal / grid-2 / grid-3）
├── theme/           66   主题（配色变量 + 页面底色）
```


## 二、加载机制

- **全局加载**：`src/styles.py` 的 `ALWAYS_CSS` 固定加载结构依赖样式（头像 / 布局模式 / 文本高亮 / 图标 / 行内图片）
- **按需注入**：其余样式只有被 YAML 的 `style: [名称]` 或文本内 `{style:名称}` 引用时，才会写进页面
- **结论**：样式库可以放心扩充，未引用的文件不产生渲染开销


## 三、风格套总览

| 组 | 前缀 | 名称 | 视觉特征 | 适合投什么 | 文件数 |
|---|---|---|---|---|---|
| **经典排版** | `ed-` | 杂志编辑 editorial | 纸白底 / 衬线标题 / 砖红眉题 / 首字下沉 / 拉引块 | 内容 / 媒体 / 品牌 / 市场 | 17 |
|  | `co-` | 商务金融 corporate | 藏青标题条 / 白底细边卡 / 数据卡 / 等宽数字 | 金融 / 咨询 / 大厂 / 商分 | 17 |
|  | `sw-` | 极简瑞士 swiss | 网格 / 大量留白 / 瑞士红方点 / 无圆角无阴影 | 通用（最高级感） | 16 |
|  | `ac-` | 学术论文 academic | 衬线正文 / 自动编号 / 三线表 / 首行缩进 | 研究岗 / 读研 / 学术 | 18 |
|  | `np-` | 报纸活字 newsprint | 窄栏密排 / 双线报头 / 灰底反白 / 高密度 | 媒体 / 咨询 / 信息密集岗 | 17 |
|  | `lf-` | 高奢时装 luxury | 象牙白 / 细衬线大字 / 超宽字距 / 金色只用一次 | 奢侈 / 时尚 / 品牌 | 16 |
|  | `lg-` | 合同文书 legal | 纯白条款 / 自动编号 / 两端对齐 / 括号元信息 | 法务 / 公文 / 体制内 | 16 |
|  | `ar-` | 年报 annual report | 深蓝标题带 / 金色数字 / 报表式网格 | 金融 / 咨询 / 审计 | 16 |
| **单色与几何** | `mc-` | 单色极简 monochrome | 纯黑白灰 / 发丝线 / 超宽字距 / 零装饰 | 通用 / 设计 / 咨询 | 16 |
|  | `bh-` | 包豪斯 bauhaus | 三原色 / 粗黑边 / 硬阴影方块 / 几何构成 | 设计 / 品牌 / 创意 | 16 |
|  | `ds-` | 风格派 de stijl | 蒙德里安黑格 / 三原色角块 / 纯正矩形 | 设计 / 建筑 / 艺术 | 16 |
|  | `br-` | 粗野主义 brutalist | 生边框 / 无修饰 / 撞色块 / 超粗字 | 创意 / 潮流 / 内容 | 17 |
|  | `cs-` | 构成主义 constructivism | 斜切红杠 / 黑底反白 / 重字距 / 宣传画感 | 品牌 / 广告 / 策划 | 16 |
|  | `mp-` | 孟菲斯 memphis | 跳跃几何 / 高饱和撞色 / 波点 / 俏皮 | 创意 / 运营 / 校园 | 16 |
| **复古印刷** | `retro-` | 复古印刷 retro | 旧纸底 / 衬线 / 砖红 / 硬阴影 | 内容 / 文化 / 出版 | 20 |
|  | `vintage-` | 复古做旧 vintage | 羊皮纸 / 角饰边框 / 内描边 / 暗金 | 文化 / 出版 / 博物 | 18 |
|  | `rs-` | 孔版印刷 risograph | 双色套印 / 网点 / 错位叠印 / 荧光粉蓝 | 设计 / 潮流 / 青年文化 | 17 |
|  | `zn-` | 手工志 zine | 剪贴纸片 / 胶带 / 荧光笔 / 手作微歪 | 创意 / 内容 / 社群 | 16 |
|  | `nv-` | 新艺术 art nouveau | 金色藤蔓弧线 / 米色纸 / 灰绿衬线 | 文化 / 品牌 / 艺术 | 16 |
|  | `bq-` | 巴洛克 baroque | 酒红双线框 / 金色菱形 / 居中大写衬线 | 文化 / 高端服务 / 古典 | 16 |
|  | `sy-` | 七十年代 seventies | 奶油底 / 砖橙与芥末黄 / 圆角贴纸标题 | 快消 / 生活方式 / 内容 | 16 |
|  | `sp-` | 太空时代 space age | 灰白纸 / 火箭橙 / 刻度尺分隔 / 技术标注 | 工程 / 硬件 / 航天 | 16 |
|  | `va-` | 校队 varsity | 米白与深红 / 双杠框 / 厚重衬线 / 方块标签 | 教育 / 体育 / 校园 | 16 |
| **科技深色** | `cy-` | 赛博科技 cyber | 深空底 / 网格扫描线 / 青霓虹 / 终端块 | 游戏 / 互联网 / 技术 | 17 |
|  | `neon-` | 霓虹 neon | 深底 / 青洋红发光 / 霓虹描边 | 游戏 / 娱乐 / 电竞 | 20 |
|  | `tm-` | 终端 terminal | 等宽字 / 命令行提示符 / 荧光绿 / 代码块 | 技术 / 数据 / 运维 | 16 |
|  | `bp-` | 蓝图 blueprint | 工程蓝底 / 网格 / 虚线图纸框 / 标注体 | 工程 / 硬件 / 制造 | 16 |
|  | `vw-` | 蒸汽波 vaporwave | 紫粉渐变 / 网格地平线 / 复古未来 | 创意 / 潮流 / 游戏 | 17 |
|  | `yk-` | 千禧 y2k | 银蓝渐变 / 圆角气泡 / 高光 / 千禧未来感 | 潮流 / 消费 / 互联网 | 16 |
|  | `hl-` | 镭射 holographic | 深灰底 / 全息渐变描边 / 虹彩微光 | 潮流 / 美妆 / 数字艺术 | 16 |
|  | `db-` | 数据面板 dashboard | 深灰面板 / 状态色 / 等宽数字 / 指标格 | 数据 / 增长 / 商业分析 | 16 |
| **柔和质感** | `modern-` | 现代简约 modern | 白底 / 蓝点标题 / 圆角浅灰卡 | 通用 | 18 |
|  | `paper-` | 纸张 paper | 米白纸底 / 墨线 / 点线框 / 衬线 | 出版 / 学术 / 文职 | 18 |
|  | `frosted-` | 磨砂玻璃 frosted | 浅灰蓝径向底 / 半透明卡 / 光边 | 科技 / 产品 / SaaS | 18 |
|  | `glass-` | 玻璃拟态 glass | 半透明白 / 毛玻璃 / 细光边 | 科技 / 设计 / 产品 | 18 |
|  | `gradient-` | 渐变 gradient | 紫粉渐变描边 / 渐变标题 / 浅渐变底 | 互联网 / 创意 | 22 |
|  | `wb-` | 侘寂 wabi-sabi | 亚麻底 / 陶土色 / 极细线 / 大留白 | 研究 / 内容 / 设计 | 16 |
|  | `mrd-` | 莫兰迪 morandi | 低饱和灰调 / 柔光圆角 / 无强对比 | 美妆 / 时尚 / 消费品 | 16 |
|  | `sc-` | 北欧 scandinavian | 白桦白 / 雾蓝小点 / 发丝线 / 大留白 | 通用 / 家居 / 设计 | 16 |
|  | `bt-` | 植物标本 botanical | 牛皮纸 / 鼠尾草绿 / 标本签标签 / 衬线斜体 | 环保 / 食品 / 茶饮 | 16 |
| **现代组件** | `bn-` | 便当盒 bento | 模块化白盒 / 彩色圆点 / 圆角网格 | 互联网 / 产品 / 运营 | 16 |
|  | `nm-` | 新拟态 neumorphism | 同色双向柔光 / 凸起与凹槽 / 低对比 | 产品 / 交互 / 设计 | 16 |
|  | `cl-` | 黏土 clay | 糖果色 / 膨胀圆角 / 柔和投影 | 快消 / 文创 / 教育 | 16 |
|  | `dt-` | 双色调 duotone | 深紫 + 酸性黄绿 / 双彩竖条 / 撞色克制 | 广告 / 设计 / 新消费 | 16 |
|  | `hw-` | 手写笔记 handwritten | 横线纸 / 便签框 / 纸胶带 / 荧光笔 | 创意 / 教育 / 运营 | 17 |
|  | `ad-` | 装饰艺术 art deco | 金线 / 扇形角饰 / 双线框 / 沙漏标题 | 高端 / 奢侈 / 酒店 | 17 |
|  | `na-` | 航海 nautical | 深藏青双线框 / 绳索金 / 大写衬线 | 航运 / 酒店 / 传统行业 | 16 |
|  | `cln-` | 临床 clinical | 冷白青绿 / 表单格 / 青绿标签 | 医疗 / 医药 / 健康 | 16 |
|  | `bd-` | 登机牌 boarding pass | 米黄票面 / 齿孔虚线 / 等宽字段 | 航空 / 旅行 / 服务 | 16 |
|  | `sl-` | 生态未来 solarpunk | 薄荷白 / 深绿 / 角括号 / 叶绿高亮 | 新能源 / 环保 / ESG | 16 |
| **字体与表现** | `fn-` | 黑色电影 noir | 纯黑灰阶 / 极宽字距细体 / 硬光切边 | 影视 / 内容 / 品牌 | 16 |
|  | `kn-` | 动能 kinetic | 倾斜重体 / 速度线 / 黑黄撞色 | 广告 / 创意 / 活动 | 16 |
|  | `kw-` | 可爱贴纸 kawaii | 粉紫糖果色 / 粗描边 / 偏移阴影 | 母婴 / 文创 / 社交 | 16 |
|  | `mk-` | 马克笔 marker | 手绘框 / 荧光笔画痕 / 便签歪贴 | 教育 / 创意 / 活动 | 16 |

## 四、切换整套风格

**第 1 步**：新建 `data/{person}/theme.yaml`：

```yaml
theme:
  page: [sw-theme]      # 页面底色与字体
  sidebar: [sw-theme]   # 左栏底色
  main: [sw-theme]      # 右栏底色
```

**第 2 步**：把各板块 YAML 的 `style:` 换成本套前缀：

```yaml
section:
  style: [sw-section, sw-header]   # 板块容器 + 板块标题
item:
  style: [sw-card]                 # 可换 sw-card-flat / sw-card-rule
heading:
  style: [sw-title]
body:
  style: [sw-body, dot-list]       # 可叠加功能样式
```

想先看效果：`python make.py styles` 会生成 `preview/gallery.html`（横向对比）与 `preview/简历样式手册-*套-*页.pdf`（A4 手册）。


## 五、每套的文件骨架

| 层级 | 文件 | 作用 |
|---|---|---|
| theme | `{p}-theme` | 变量、页面 / 左右栏底色、字体族 |
| section | `{p}-section` | 板块容器：边框、底色、圆角、内距 |
| section | `{p}-header` | 板块标题：字号、字距、前置图形 |
| section | `{p}-divider` | 板块分隔装饰 |
| item | `{p}-card` | 条目卡（主用） |
| item | `{p}-card-flat` | 扁平变体：无底无框，适合密集列表 |
| item | `{p}-card-rule` | 线条变体：单边强调，适合时间线 |
| block | `{p}-block` | 块容器：内嵌底色 / 边框 |
| block | `{p}-metric` | 数字强调：套在 `**数字**` 上 |
| block | `{p}-quote` | 引言 / 结论块 |
| block | `{p}-grid` | 内容网格：把列表排成 2–3 栏 |
| field | `{p}-title` | 条目标题 |
| field | `{p}-sub` | 副标题 / 角色 |
| field | `{p}-meta` | 时间、地点等元信息 |
| field | `{p}-body` | 正文列表 |
| field | `{p}-tag` | 标签 |

## 六、各套文件清单

### 经典排版

**杂志编辑 `ed-`**（17 个）

- theme: `ed-theme`
- section: `ed-divider` `ed-header` `ed-section`
- item: `ed-card` `ed-card-flat` `ed-card-rule`
- block: `ed-block` `ed-dropcap` `ed-figure` `ed-grid` `ed-quote`
- field: `ed-body` `ed-meta` `ed-sub` `ed-tag` `ed-title`

**商务金融 `co-`**（17 个）

- theme: `co-theme`
- section: `co-divider` `co-header` `co-section`
- item: `co-card` `co-card-flat` `co-card-rule`
- block: `co-block` `co-figure` `co-grid` `co-metric` `co-quote`
- field: `co-body` `co-meta` `co-sub` `co-tag` `co-title`

**极简瑞士 `sw-`**（16 个）

- theme: `sw-theme`
- section: `sw-divider` `sw-header` `sw-section`
- item: `sw-card` `sw-card-flat` `sw-card-rule`
- block: `sw-block` `sw-grid` `sw-metric` `sw-quote`
- field: `sw-body` `sw-meta` `sw-sub` `sw-tag` `sw-title`

**学术论文 `ac-`**（18 个）

- theme: `ac-theme`
- section: `ac-divider` `ac-header` `ac-section`
- item: `ac-card` `ac-card-flat` `ac-card-rule`
- block: `ac-abstract` `ac-block` `ac-figure` `ac-grid` `ac-quote` `ac-table`
- field: `ac-body` `ac-meta` `ac-sub` `ac-tag` `ac-title`

**报纸活字 `np-`**（17 个）

- theme: `np-theme`
- section: `np-divider` `np-header` `np-section`
- item: `np-card` `np-card-flat` `np-card-rule`
- block: `np-block` `np-columns` `np-grid` `np-metric` `np-quote`
- field: `np-body` `np-meta` `np-sub` `np-tag` `np-title`

**高奢时装 `lf-`**（16 个）

- theme: `lf-theme`
- section: `lf-divider` `lf-header` `lf-section`
- item: `lf-card` `lf-card-flat` `lf-card-rule`
- block: `lf-block` `lf-grid` `lf-metric` `lf-quote`
- field: `lf-body` `lf-meta` `lf-sub` `lf-tag` `lf-title`

**合同文书 `lg-`**（16 个）

- theme: `lg-theme`
- section: `lg-divider` `lg-header` `lg-section`
- item: `lg-card` `lg-card-flat` `lg-card-rule`
- block: `lg-block` `lg-grid` `lg-metric` `lg-quote`
- field: `lg-body` `lg-meta` `lg-sub` `lg-tag` `lg-title`

**年报 `ar-`**（16 个）

- theme: `ar-theme`
- section: `ar-divider` `ar-header` `ar-section`
- item: `ar-card` `ar-card-flat` `ar-card-rule`
- block: `ar-block` `ar-grid` `ar-metric` `ar-quote`
- field: `ar-body` `ar-meta` `ar-sub` `ar-tag` `ar-title`

### 单色与几何

**单色极简 `mc-`**（16 个）

- theme: `mc-theme`
- section: `mc-divider` `mc-header` `mc-section`
- item: `mc-card` `mc-card-flat` `mc-card-rule`
- block: `mc-block` `mc-grid` `mc-metric` `mc-quote`
- field: `mc-body` `mc-meta` `mc-sub` `mc-tag` `mc-title`

**包豪斯 `bh-`**（16 个）

- theme: `bh-theme`
- section: `bh-divider` `bh-header` `bh-section`
- item: `bh-card` `bh-card-flat` `bh-card-rule`
- block: `bh-block` `bh-grid` `bh-metric` `bh-quote`
- field: `bh-body` `bh-meta` `bh-sub` `bh-tag` `bh-title`

**风格派 `ds-`**（16 个）

- theme: `ds-theme`
- section: `ds-divider` `ds-header` `ds-section`
- item: `ds-card` `ds-card-flat` `ds-card-rule`
- block: `ds-block` `ds-grid` `ds-metric` `ds-quote`
- field: `ds-body` `ds-meta` `ds-sub` `ds-tag` `ds-title`

**粗野主义 `br-`**（17 个）

- theme: `br-theme`
- section: `br-divider` `br-header` `br-section`
- item: `br-card` `br-card-flat` `br-card-rule`
- block: `br-block` `br-grid` `br-marquee` `br-metric` `br-quote`
- field: `br-body` `br-meta` `br-sub` `br-tag` `br-title`

**构成主义 `cs-`**（16 个）

- theme: `cs-theme`
- section: `cs-divider` `cs-header` `cs-section`
- item: `cs-card` `cs-card-flat` `cs-card-rule`
- block: `cs-block` `cs-grid` `cs-metric` `cs-quote`
- field: `cs-body` `cs-meta` `cs-sub` `cs-tag` `cs-title`

**孟菲斯 `mp-`**（16 个）

- theme: `mp-theme`
- section: `mp-divider` `mp-header` `mp-section`
- item: `mp-card` `mp-card-flat` `mp-card-rule`
- block: `mp-block` `mp-grid` `mp-metric` `mp-quote`
- field: `mp-body` `mp-meta` `mp-sub` `mp-tag` `mp-title`

### 复古印刷

**复古印刷 `retro-`**（20 个）

- theme: `retro` `retro-theme`
- section: `retro-divider` `retro-header` `retro-section`
- item: `retro-card` `retro-card-flat` `retro-card-rule` `retro-paper`
- block: `retro-block` `retro-grid` `retro-metric` `retro-panel` `retro-quote`
- field: `retro-body` `retro-meta` `retro-serif` `retro-sub` `retro-tag` `retro-title`

**复古做旧 `vintage-`**（18 个）

- theme: `vintage-theme`
- section: `vintage-divider` `vintage-header` `vintage-section`
- item: `vintage-border` `vintage-card` `vintage-card-flat` `vintage-card-rule`
- block: `vintage-block` `vintage-grid` `vintage-metric` `vintage-panel` `vintage-quote`
- field: `vintage-body` `vintage-meta` `vintage-sub` `vintage-tag` `vintage-title`

**孔版印刷 `rs-`**（17 个）

- theme: `rs-theme`
- section: `rs-divider` `rs-header` `rs-section`
- item: `rs-card` `rs-card-flat` `rs-card-rule`
- block: `rs-block` `rs-duotone` `rs-grid` `rs-metric` `rs-quote`
- field: `rs-body` `rs-meta` `rs-sub` `rs-tag` `rs-title`

**手工志 `zn-`**（16 个）

- theme: `zn-theme`
- section: `zn-divider` `zn-header` `zn-section`
- item: `zn-card` `zn-card-flat` `zn-card-rule`
- block: `zn-block` `zn-grid` `zn-metric` `zn-quote`
- field: `zn-body` `zn-meta` `zn-sub` `zn-tag` `zn-title`

**新艺术 `nv-`**（16 个）

- theme: `nv-theme`
- section: `nv-divider` `nv-header` `nv-section`
- item: `nv-card` `nv-card-flat` `nv-card-rule`
- block: `nv-block` `nv-grid` `nv-metric` `nv-quote`
- field: `nv-body` `nv-meta` `nv-sub` `nv-tag` `nv-title`

**巴洛克 `bq-`**（16 个）

- theme: `bq-theme`
- section: `bq-divider` `bq-header` `bq-section`
- item: `bq-card` `bq-card-flat` `bq-card-rule`
- block: `bq-block` `bq-grid` `bq-metric` `bq-quote`
- field: `bq-body` `bq-meta` `bq-sub` `bq-tag` `bq-title`

**七十年代 `sy-`**（16 个）

- theme: `sy-theme`
- section: `sy-divider` `sy-header` `sy-section`
- item: `sy-card` `sy-card-flat` `sy-card-rule`
- block: `sy-block` `sy-grid` `sy-metric` `sy-quote`
- field: `sy-body` `sy-meta` `sy-sub` `sy-tag` `sy-title`

**太空时代 `sp-`**（16 个）

- theme: `sp-theme`
- section: `sp-divider` `sp-header` `sp-section`
- item: `sp-card` `sp-card-flat` `sp-card-rule`
- block: `sp-block` `sp-grid` `sp-metric` `sp-quote`
- field: `sp-body` `sp-meta` `sp-sub` `sp-tag` `sp-title`

**校队 `va-`**（16 个）

- theme: `va-theme`
- section: `va-divider` `va-header` `va-section`
- item: `va-card` `va-card-flat` `va-card-rule`
- block: `va-block` `va-grid` `va-metric` `va-quote`
- field: `va-body` `va-meta` `va-sub` `va-tag` `va-title`

### 科技深色

**赛博科技 `cy-`**（17 个）

- theme: `cy-theme`
- section: `cy-divider` `cy-header` `cy-section`
- item: `cy-card` `cy-card-flat` `cy-card-rule`
- block: `cy-block` `cy-grid` `cy-metric` `cy-quote` `cy-term`
- field: `cy-body` `cy-meta` `cy-sub` `cy-tag` `cy-title`

**霓虹 `neon-`**（20 个）

- theme: `neon` `neon-theme`
- section: `neon-border` `neon-divider` `neon-header` `neon-section`
- item: `neon-card` `neon-card-flat` `neon-card-rule`
- block: `neon-block` `neon-grid` `neon-metric` `neon-panel` `neon-quote`
- field: `neon-body` `neon-meta` `neon-sub` `neon-tag` `neon-text` `neon-title`

**终端 `tm-`**（16 个）

- theme: `tm-theme`
- section: `tm-divider` `tm-header` `tm-section`
- item: `tm-card` `tm-card-flat` `tm-card-rule`
- block: `tm-block` `tm-grid` `tm-metric` `tm-quote`
- field: `tm-body` `tm-meta` `tm-sub` `tm-tag` `tm-title`

**蓝图 `bp-`**（16 个）

- theme: `bp-theme`
- section: `bp-divider` `bp-header` `bp-section`
- item: `bp-card` `bp-card-flat` `bp-card-rule`
- block: `bp-block` `bp-grid` `bp-metric` `bp-quote`
- field: `bp-body` `bp-meta` `bp-sub` `bp-tag` `bp-title`

**蒸汽波 `vw-`**（17 个）

- theme: `vw-theme`
- section: `vw-divider` `vw-header` `vw-section`
- item: `vw-card` `vw-card-flat` `vw-card-rule`
- block: `vw-block` `vw-glitch` `vw-grid` `vw-metric` `vw-quote`
- field: `vw-body` `vw-meta` `vw-sub` `vw-tag` `vw-title`

**千禧 `yk-`**（16 个）

- theme: `yk-theme`
- section: `yk-divider` `yk-header` `yk-section`
- item: `yk-card` `yk-card-flat` `yk-card-rule`
- block: `yk-block` `yk-grid` `yk-metric` `yk-quote`
- field: `yk-body` `yk-meta` `yk-sub` `yk-tag` `yk-title`

**镭射 `hl-`**（16 个）

- theme: `hl-theme`
- section: `hl-divider` `hl-header` `hl-section`
- item: `hl-card` `hl-card-flat` `hl-card-rule`
- block: `hl-block` `hl-grid` `hl-metric` `hl-quote`
- field: `hl-body` `hl-meta` `hl-sub` `hl-tag` `hl-title`

**数据面板 `db-`**（16 个）

- theme: `db-theme`
- section: `db-divider` `db-header` `db-section`
- item: `db-card` `db-card-flat` `db-card-rule`
- block: `db-block` `db-grid` `db-metric` `db-quote`
- field: `db-body` `db-meta` `db-sub` `db-tag` `db-title`

### 柔和质感

**现代简约 `modern-`**（18 个）

- theme: `modern-theme`
- section: `modern-divider` `modern-header` `modern-section`
- item: `modern-card` `modern-card-flat` `modern-card-rule`
- block: `modern-block` `modern-grid` `modern-metric` `modern-panel` `modern-quote`
- field: `modern-body` `modern-meta` `modern-sans` `modern-sub` `modern-tag` `modern-title`

**纸张 `paper-`**（18 个）

- theme: `paper` `paper-theme`
- section: `paper-card` `paper-divider` `paper-header` `paper-section`
- item: `paper-card` `paper-card-flat` `paper-card-rule`
- block: `paper-block` `paper-grid` `paper-metric` `paper-quote`
- field: `paper-body` `paper-meta` `paper-sub` `paper-tag` `paper-title`

**磨砂玻璃 `frosted-`**（18 个）

- theme: `frosted-theme`
- section: `frosted-divider` `frosted-header` `frosted-section`
- item: `frosted-card` `frosted-card-flat` `frosted-card-rule` `frosted-glass`
- block: `frosted` `frosted-block` `frosted-grid` `frosted-metric` `frosted-quote`
- field: `frosted-body` `frosted-meta` `frosted-sub` `frosted-tag` `frosted-title`

**玻璃拟态 `glass-`**（18 个）

- theme: `glass` `glass-theme`
- section: `glass-divider` `glass-header` `glass-section`
- item: `glass-card` `glass-card-flat` `glass-card-rule`
- block: `glass-block` `glass-grid` `glass-metric` `glass-panel` `glass-quote`
- field: `glass-body` `glass-meta` `glass-sub` `glass-tag` `glass-title`

**渐变 `gradient-`**（22 个）

- theme: `gradient-blue` `gradient-theme`
- section: `gradient-bar` `gradient-divider` `gradient-header` `gradient-section`
- item: `gradient-border` `gradient-card` `gradient-card-flat` `gradient-card-rule` `gradient-soft`
- block: `gradient-block` `gradient-grid` `gradient-metric` `gradient-panel` `gradient-quote`
- field: `gradient-body` `gradient-meta` `gradient-sub` `gradient-tag` `gradient-text` `gradient-title`

**侘寂 `wb-`**（16 个）

- theme: `wb-theme`
- section: `wb-divider` `wb-header` `wb-section`
- item: `wb-card` `wb-card-flat` `wb-card-rule`
- block: `wb-block` `wb-grid` `wb-metric` `wb-quote`
- field: `wb-body` `wb-meta` `wb-sub` `wb-tag` `wb-title`

**莫兰迪 `mrd-`**（16 个）

- theme: `mrd-theme`
- section: `mrd-divider` `mrd-header` `mrd-section`
- item: `mrd-card` `mrd-card-flat` `mrd-card-rule`
- block: `mrd-block` `mrd-grid` `mrd-metric` `mrd-quote`
- field: `mrd-body` `mrd-meta` `mrd-sub` `mrd-tag` `mrd-title`

**北欧 `sc-`**（16 个）

- theme: `sc-theme`
- section: `sc-divider` `sc-header` `sc-section`
- item: `sc-card` `sc-card-flat` `sc-card-rule`
- block: `sc-block` `sc-grid` `sc-metric` `sc-quote`
- field: `sc-body` `sc-meta` `sc-sub` `sc-tag` `sc-title`

**植物标本 `bt-`**（16 个）

- theme: `bt-theme`
- section: `bt-divider` `bt-header` `bt-section`
- item: `bt-card` `bt-card-flat` `bt-card-rule`
- block: `bt-block` `bt-grid` `bt-metric` `bt-quote`
- field: `bt-body` `bt-meta` `bt-sub` `bt-tag` `bt-title`

### 现代组件

**便当盒 `bn-`**（16 个）

- theme: `bn-theme`
- section: `bn-divider` `bn-header` `bn-section`
- item: `bn-card` `bn-card-flat` `bn-card-rule`
- block: `bn-block` `bn-grid` `bn-metric` `bn-quote`
- field: `bn-body` `bn-meta` `bn-sub` `bn-tag` `bn-title`

**新拟态 `nm-`**（16 个）

- theme: `nm-theme`
- section: `nm-divider` `nm-header` `nm-section`
- item: `nm-card` `nm-card-flat` `nm-card-rule`
- block: `nm-block` `nm-grid` `nm-metric` `nm-quote`
- field: `nm-body` `nm-meta` `nm-sub` `nm-tag` `nm-title`

**黏土 `cl-`**（16 个）

- theme: `cl-theme`
- section: `cl-divider` `cl-header` `cl-section`
- item: `cl-card` `cl-card-flat` `cl-card-rule`
- block: `cl-block` `cl-grid` `cl-metric` `cl-quote`
- field: `cl-body` `cl-meta` `cl-sub` `cl-tag` `cl-title`

**双色调 `dt-`**（16 个）

- theme: `dt-theme`
- section: `dt-divider` `dt-header` `dt-section`
- item: `dt-card` `dt-card-flat` `dt-card-rule`
- block: `dt-block` `dt-grid` `dt-metric` `dt-quote`
- field: `dt-body` `dt-meta` `dt-sub` `dt-tag` `dt-title`

**手写笔记 `hw-`**（17 个）

- theme: `hw-theme`
- section: `hw-divider` `hw-header` `hw-section`
- item: `hw-card` `hw-card-flat` `hw-card-rule`
- block: `hw-block` `hw-grid` `hw-highlight` `hw-metric` `hw-quote`
- field: `hw-body` `hw-meta` `hw-sub` `hw-tag` `hw-title`

**装饰艺术 `ad-`**（17 个）

- theme: `ad-theme`
- section: `ad-divider` `ad-header` `ad-section`
- item: `ad-card` `ad-card-flat` `ad-card-rule`
- block: `ad-block` `ad-grid` `ad-metric` `ad-ornament` `ad-quote`
- field: `ad-body` `ad-meta` `ad-sub` `ad-tag` `ad-title`

**航海 `na-`**（16 个）

- theme: `na-theme`
- section: `na-divider` `na-header` `na-section`
- item: `na-card` `na-card-flat` `na-card-rule`
- block: `na-block` `na-grid` `na-metric` `na-quote`
- field: `na-body` `na-meta` `na-sub` `na-tag` `na-title`

**临床 `cln-`**（16 个）

- theme: `cln-theme`
- section: `cln-divider` `cln-header` `cln-section`
- item: `cln-card` `cln-card-flat` `cln-card-rule`
- block: `cln-block` `cln-grid` `cln-metric` `cln-quote`
- field: `cln-body` `cln-meta` `cln-sub` `cln-tag` `cln-title`

**登机牌 `bd-`**（16 个）

- theme: `bd-theme`
- section: `bd-divider` `bd-header` `bd-section`
- item: `bd-card` `bd-card-flat` `bd-card-rule`
- block: `bd-block` `bd-grid` `bd-metric` `bd-quote`
- field: `bd-body` `bd-meta` `bd-sub` `bd-tag` `bd-title`

**生态未来 `sl-`**（16 个）

- theme: `sl-theme`
- section: `sl-divider` `sl-header` `sl-section`
- item: `sl-card` `sl-card-flat` `sl-card-rule`
- block: `sl-block` `sl-grid` `sl-metric` `sl-quote`
- field: `sl-body` `sl-meta` `sl-sub` `sl-tag` `sl-title`

### 字体与表现

**黑色电影 `fn-`**（16 个）

- theme: `fn-theme`
- section: `fn-divider` `fn-header` `fn-section`
- item: `fn-card` `fn-card-flat` `fn-card-rule`
- block: `fn-block` `fn-grid` `fn-metric` `fn-quote`
- field: `fn-body` `fn-meta` `fn-sub` `fn-tag` `fn-title`

**动能 `kn-`**（16 个）

- theme: `kn-theme`
- section: `kn-divider` `kn-header` `kn-section`
- item: `kn-card` `kn-card-flat` `kn-card-rule`
- block: `kn-block` `kn-grid` `kn-metric` `kn-quote`
- field: `kn-body` `kn-meta` `kn-sub` `kn-tag` `kn-title`

**可爱贴纸 `kw-`**（16 个）

- theme: `kw-theme`
- section: `kw-divider` `kw-header` `kw-section`
- item: `kw-card` `kw-card-flat` `kw-card-rule`
- block: `kw-block` `kw-grid` `kw-metric` `kw-quote`
- field: `kw-body` `kw-meta` `kw-sub` `kw-tag` `kw-title`

**马克笔 `mk-`**（16 个）

- theme: `mk-theme`
- section: `mk-divider` `mk-header` `mk-section`
- item: `mk-card` `mk-card-flat` `mk-card-rule`
- block: `mk-block` `mk-grid` `mk-metric` `mk-quote`
- field: `mk-body` `mk-meta` `mk-sub` `mk-tag` `mk-title`


## 七、命名规范

```
{前缀}-{层级}            例：ed-section / co-title / sw-tag
{前缀}-{层级}-{变体}     例：ed-card-flat / co-card-rule / hw-card-rule
```

**层级词表**：`theme` `section` `header` `divider` `card` `block` `metric` `quote` `grid` `title` `sub` `meta` `body` `tag`


## 八、功能样式清单（无风格前缀）

- **content-area**（1）: `default`
- **zone**（2）: `dark` `default`
- **section**（13）: `boxed` `card-left-border` `compact` `cyber-header` `default` `divider` `horizontal-flex` `left-accent` `minimal-line` `ornate-divider` `pill-title` `skills-grid` `underline-title`
- **item**（21）: `avatar` `bg-gradient-blue` `bg-soft-blue` `bg-soft-purple` `bg-white` `border-accent-left` `border-accent-top` `border-rounded` `card-accent` `corner-accent` `dark-card` `default` `flat-card` `hover-lift` `minimal-card` `plain-card` `shadow-glow` `shadow-muted` `shadow-soft` `soft-modern` `top-stripe`
- **block**（9）: `accent-top` `border-left` `code-block` `default` `outline-block` `panel` `quote-block` `soft-box` `timeline-block`
- **field**（43）: `accent` `badge` `badge-gradient` `badge-outline` `badge-solid` `body-panel` `bold-label` `columns-3` `default` `dot-list` `dot-list-accent` `dot-sep` `glow-text` `highlight-green` `highlight-pink` `highlight-yellow` `icon` `inline-image` `large-heading` `left-bar` `left-bar-accent` `left-bar-soft` `mono-tag` `serif-heading` `strike-through` `tag-ghost` `tag-modern` `tag-neon` `tag-outline` `tag-pill` `tag-retro` `tag-solid` `text-accent` `text-danger` `text-highlight` `text-muted` `text-primary` `text-secondary` `text-success` `text-warning` `title-gradient` `typewriter` `underline-thick`
- **layout**（4）: `grid-2` `grid-3` `horizontal` `vertical`
- **theme**（7）: `aurora` `dark-theme` `dots` `grid` `minimal` `sunset` `warm-brown`
