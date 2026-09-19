# v1.0.2 — Material 3 Expressive 语音图片笔记（Web 生产版本）

本次发布把仓库里原本只在 Android（Compose）实现的 **M3 Expressive 语音图片笔记** 完整实现为可在浏览器运行的 Web 应用，
并把它部署到 GitHub Pages。

## 在线体验

- **Web 应用（GitHub Pages）**：https://tequed232.github.io/player/

## 本次新增

### 完整 Web 应用（新增，生产构建产物）

7 个屏幕、412 × 892dp 竖屏、仅浅色模式为目标形态：

| 屏幕 | 内容 |
| --- | --- |
| 主页 | 实时语音转文字容器（surfaceContainerHigh / 28dp，点击放大为全屏面板）、总结·重点·思维导图容器（tertiaryContainer）、"长按输入文本"描边输入框（叠放在按钮组之上）、"拍照 / 导入图片"相连按钮组（内侧 8dp 圆角）、导航栏 |
| 摄像 | `getUserMedia` 实时预览（圆角 20dp）、预览左上角"返回"填充按钮、标签输入（历史标签建议）、快门写入记录并调用图片转文字 API |
| 历史 | "最近三次记录"顶部应用栏 + more_vert 菜单、搜索、记录卡片（查看 / 编辑 / 删除）、空状态 |
| 设置 | 5 项连接式列表（3dp 间距、28dp 外圆角 / 8dp 内圆角）+ 叠放其上的深色开关与两个 Expressive 滑块（16dp 粗轨道、4×44dp 竖长手柄）、"已保存"消息条 + 撤销 |
| 记录详情（屏幕 5） | 图片多浏览轮播 → 全屏查看器（左右滑动切换 / 下滑关闭）、文字要点容器 → 可滚动全屏面板、返回 / 编辑 / 删除（确认对话框） |
| API 修改 | 语音转文字 / 图片转文字 / 问答 API 与密钥、380×380 测试图片占位与真实接口测试、刷新与"删除全部 API"（确认对话框） |
| 屏幕 7 | 按草图保留的空屏幕 |

### 设计实现

- **动态配色**：能获取用户强调色时用 material-color-utilities 的 `SchemeExpressive`（高对比度）生成全套角色；
  否则逐值使用题目给定的 Green 备用配色（primary `#00391C`、tertiaryContainer `#1E4D54`、surface `#F5FBF6` …）。
  UI 只引用 `--md-sys-color-*` 角色，没有写死颜色。
- **动效**：解析求解 M3 Expressive 物理弹簧（spatial 阻尼比 0.9、effects 1.0），生成 CSS `linear()` 缓动与时长；
  页面转场（滑入 / 淡入 / 相机缩放弹簧）、面板展开、消息条、涟漪反馈全部使用同一套弹簧。
- **组件**：一律使用 `@material/web` 标准组件；库里没有的（顶部应用栏、消息条、轮播、全屏查看器、可展开面板）才自行实现。
- **图标字体**：Material Symbols Rounded 由 5.2 MB 变量字体裁剪为 **77 KB** 子集（保留 FILL/GRAD/opsz/wght 轴）。

### 数据

记录、设置、主页草稿写入 **IndexedDB** 并跨刷新保留；无假数据，无内容时显示空状态；
语音输入强度控制识别置信度门限、相机清晰度控制拍摄分辨率与 JPEG 画质，均真实生效。

## 验证

`npm run verify`（Playwright + Chromium，412×892 视口，虚拟摄像头）跑通 49 步真实流程：
主页 → 全屏面板 → 历史 / 设置 / API → 相机实时预览 → 快门生成记录 → 历史卡片 → 记录详情 → 图片查看器 →
文字面板 → 刷新后记录仍在 → 深色开关 + 撤销 → 删除确认对话框 → 长按提问生成思维导图分支 →
滑块拖动 + 刷新后保持 81% → 历史 more_vert 菜单。

结果：**全部通过，0 个 console 错误、0 个 page error**。截图见仓库 `screenshots/`。

## 构建产物

- `m3-expressive-web-1.0.2.zip` — Web 生产构建（`dist/`，53 个文件约 1.5 MB，纯静态、相对路径、含本地字体，可离线部署到任意静态服务器）。
- `app-release.apk` — Android 版（Compose 实现），`arm64-v8a`，debug 签名，可直接安装体验（versionCode 3 / versionName 1.0.2）。

## 构建方式

```bash
npm install && npm run build     # Web：生成图标子集 → 校验 → vite build（输出 dist/）
./gradlew assembleRelease        # Android：输出 app/build/outputs/apk/release/app-release.apk
```
