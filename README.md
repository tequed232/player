# M3 Expressive · 语音图片笔记

Material 3 Expressive 风格的移动端 Web 应用：**实时语音转文字 + 图片转文字总结 + 历史记录 + 设置/API 配置**。
目标形态为竖屏手机 **412 × 892dp**，浏览器内运行（`dist/` 为可直接部署的 production build）。

> 仓库同时包含一份 Kotlin/Compose 的 Android 实现（`app/`，Gradle 工程）。本 README 描述 **Web 实现**。

---

## 快速开始

```bash
npm install
npm run build      # 生成 Material Symbols 子集 -> 校验图标 -> vite build
npm run preview    # 预览 production build (http://127.0.0.1:4173)
npm run dev        # 开发模式 (http://127.0.0.1:5173)
npm run verify     # 用 Chromium 真机视口跑一遍全流程并截图（screenshots/）
```

**交付物：`dist/`**（53 个文件、约 1.5 MB）— 纯静态站点，任意静态服务器直接托管即可。

```
dist/
  index.html                       入口（相对路径引用，可放在任意子目录）
  assets/index-*.js  425 KB        React + Material Web + 业务代码
  assets/bootstrap-*.js 292 KB     Material Web 组件
  assets/index-*.css  75 KB        设计令牌 + 组件样式
  assets/material-symbols-rounded-subset-*.woff2  77 KB   Material Symbols Rounded（71 个图标子集）
  assets/roboto-*-normal-*.woff2                  Roboto 400/500/700（本地字体，离线可用）
```

---

## 屏幕与功能

| 路由 | 屏幕 | 主要能力 |
| --- | --- | --- |
| `home` | 主页 | 实时语音转文字容器（点击 → 全屏面板）、总结/重点/思维导图容器（点击 → 全屏面板）、长按输入框进入提问模式、"拍照 / 导入图片" 相连按钮组、导航栏 |
| `camera` | 摄像 | `getUserMedia` 实时预览（圆角 20dp）、预览左上角"返回"填充按钮、标签输入（含历史标签建议）、快门写入记录并调用图片转文字 API |
| `history` | 历史 | "最近三次记录"顶部应用栏 + more_vert 菜单、搜索框、记录卡片列表、卡片菜单（查看/编辑/删除）、空状态 |
| `settings` | 设置 | 5 项列表（3dp 间距、28dp 外圆角 / 8dp 内圆角）+ 叠放其上的开关与两个 Expressive 滑块、已保存消息条（撤销） |
| `record` | 屏幕 5 · 记录详情 | 图片多浏览轮播 → 全屏查看器（左右滑动 / 下滑关闭）、文字要点容器 → 可滚动全屏面板、顶部返回 / 编辑 / 删除（确认对话框） |
| `apiEdit` | API 修改 | 语音转文字 / 图片转文字 / 问答 API 与密钥、380×380 测试图片占位、刷新（重新载入）与删除全部 API（确认对话框）、保存后消息条 + 撤销 |
| `blank` | 屏幕 7 | 按草图保留的空屏幕 |

### 真实数据

* 记录、设置、主页草稿全部写入 **IndexedDB**（`m3-expressive-notes`），刷新后保留；IndexedDB 不可用时自动降级到 `localStorage`。
* 没有示例/假数据：没有记录时显示空状态；没有图片时显示占位符；没有配置 API 时明确提示而不是编造结果。
* 语音识别的置信度门限由"语音输入强度"设置控制；拍摄分辨率与 JPEG 画质由"相机清晰度"设置控制（两者都真实生效并持久化）。
* 提问回答来源分为：`问答接口`（已配置且调用成功）、`本次记录内容`（在真实转写/总结中检索到的片段）、`未找到相关内容`（会新建分支但如实说明）。

---

## 设计实现要点

* **动态配色** — `web/src/theme/palette.ts`。能从环境拿到用户强调色时（`?seed=`、`window.__MD_SYS_SEED__`、已存强调色、CSS `accent-color`），用
  `@material/material-color-utilities` 的 **SchemeExpressive**（高对比度）生成全套角色；拿不到就用题目给定的 Green 备用配色逐值写入。所有 UI 只引用
  `--md-sys-color-*` 角色，代码里没有写死颜色。
* **动效** — `web/src/theme/motion.ts` 解析求解 M3 Expressive 的物理弹簧（spatial 0.9 / effects 1.0 阻尼比，stiffness 1400·700·300 / 3800·1600·800），
  生成 CSS `linear()` 缓动与时长并写入自定义属性，用于页面转场、面板展开、消息条与涟漪反馈。
* **页面栈导航** — `web/src/nav/navigation.tsx`：`slide`（右侧滑入）/ `fade`（淡入）/ `zoom`（相机缩放弹簧）三种转场，栈同步到 `history.state`，
  系统返回手势与返回键和页面内返回按钮行为一致（反向播放进入动画）。
* **组件** — 一律使用 **Material Web**（`@material/web`）标准组件：filled/outlined/tonal/text button、outlined text field、switch、slider、navigation bar/tab、
  filled/elevated/outlined card、dialog、menu、list-item、fab、divider、icon、circular-progress、ripple。库里没有的（顶部应用栏、消息条、轮播、全屏查看器、可展开面板）
  才自行实现。
* **图标** — Material Symbols Rounded；`scripts/subset-icons.mjs` 用 fontkit 把 5.2 MB 变量字体按 PUA 码位裁剪到 **77 KB**（保留 FILL/GRAD/opsz/wght 轴），
  `scripts/check-icons.mjs` 在构建时保证没有图标名漏出子集。

## 浏览器验证

`npm run verify`（Playwright + Chromium，412×892 视口，含虚拟摄像头）走的真实流程：

```
主页渲染 → 容器全屏面板展开/收起 → 历史/设置/API 页 → 相机实时预览 → 快门生成记录
→ 历史卡片 → 记录详情 → 图片全屏查看器 → 文字面板 → 刷新后记录仍在（IndexedDB）
→ 深色模式开关 + 撤销 → 删除确认对话框 + 取消 → 长按进入提问模式 → 提问生成思维导图分支
→ 滑块拖动 + 刷新后仍为 81% → 历史 more_vert 菜单
```

结果：**全部通过，0 个 console 错误、0 个 page error**；截图见 `screenshots/`（`report.json` 内含配色、尺寸与令牌核对数据）。

## 与草图的三处有意偏差

1. **深色模式开关**：题目要求"只做浅色模式"，但草图中的开关又必须可用。默认仍是浅色（设计目标），开关则用同一 seed 生成的 Expressive 深色方案真实生效并持久化，
   不使用死控件。
2. **图标语义**：设置列表中"深色模式""关于本软件"使用 `dark_mode` / `info`（草图里两处都写 `person`，明显是占位）。
3. **屏幕 5 只有一个顶部应用栏**：草图把同一个 "Title" 应用栏叠了两遍，实际实现为一个（返回 / 编辑 / 删除），避免出现两条一样的标题栏。
   旋转木马按草图为 4 张卡片的布局，但只渲染真实存在的图片（不造假的图片数据）。

## 目录

```
web/index.html            Vite 入口
web/src/
  main.tsx bootstrap.tsx  Material Web 注册、主题引导
  App.tsx                 412×892 舞台 + 屏幕栈 + 消息条
  components/             md.tsx（Material Web 封装）、layout / overlays / content
  screens/                7 个屏幕
  nav/ state/ lib/ theme/ 导航、全局状态、IndexedDB / 语音 / API / 图像、设计令牌
scripts/                  subset-icons.mjs、check-icons.mjs、verify.mjs
vite.config.ts            root=web，outDir=dist
```
