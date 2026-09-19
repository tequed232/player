# v1.0.3 — 内嵌课表屏幕 + Android 16 / ColorOS 流体云 构建

本次新增 **课表**（四分课表）屏幕：把学校教务系统导出的 `学生课表.doc` 解析后**内嵌进应用**，
并在 Web 与 Android 两端都提供独立的课表屏幕；Android 端同时升级到 **Android 16 (API 36)**，
接入 **Android 16 Live Updates / ColorOS 流体云** 实况通知。

## 在线体验 / 下载

- **Web 应用（GitHub Pages）**：https://tequed232.github.io/player/
- **Android APK**：本 Release 附件 `m3-expressive-android-1.0.3.apk`（arm64-v8a，适配天玑 9400 / ColorOS 16）

## 本次新增

### 课表屏幕（Web + Android）

- **自主嵌入**：`scripts/import-schedule.mjs` 解析 `学生课表.doc`（RTF 表格），生成
  `web/src/data/schedule.ts` 与 `app/.../ScheduleData.kt`，应用启动即自带课表（罗瑞谦 · 2026-2027-1 ·
  7 节次 × 7 天 · 24 门课），无需每次手动导入。
- **四日表格**：左侧是按 **上午 / 中午 / 下午 / 晚上** 分段的时间轴，上方**并排展示四天**；
  在表格上**左右拖动跟手切换日期窗口**（松手回弹），点击某一天选中该日，下方列出当天全部课程。
- **课程详情**：默认只显示课程名，点击课程弹出详情（授课老师、节次与时间、周次、地点）。
- **周次**：按学期开始日期计算当前教学周（可调），表格只显示该周实际开设的课程；◀ ▶ 切换周次。
- **导航**：点击课程地点 → 启动地图应用检索该地址；未设置默认地图时先弹出地图选择列表，
  可「记住选择」写入设置（Web 端在设置页有「默认跳转地图」项）。
- **筛选**：顶部搜索图标进入「筛选」屏幕，按 老师 / 课程 / 地点 / 时间 四个标签检索，
  结果按 课程 · 老师 · 地点 三列排列；点击条目回到课表并**高亮该课程 5 秒**（若该课程不在当前周，
  自动跳到它开课的那一周并提示）。
- **导入 / 替换**：课表页右上角「课表数据」面板支持导入 `.doc/.rtf`（教务系统导出）、`.html`（表格另存为）、
  `.csv/.txt`（粘贴文本），或一键恢复内置课表；导入结果保存在浏览器 IndexedDB。

### Android 16 / 天玑 9400 / ColorOS 流体云

- `compileSdk = 36`、`targetSdk = 36`（Android 16），`abiFilters = arm64-v8a`（天玑 9400 / MT6991）。
- **流体云（实况通知）**：语音识别与拍照处理时发布 Android 16 **Live Updates**
  （`Notification.ProgressStyle` + `setRequestPromotedOngoing(true)`），ColorOS 16 会将其展示为
  **流体云**卡片；完成时显示 100% 结果并在数秒后自动收起。
  该 API 仅存在于 Android 16，代码通过反射调用，同一 APK 在旧系统上自动退化为普通进行中通知。
- 新增 `POST_NOTIFICATIONS` 权限（Android 13+ 运行时申请）、`enableOnBackInvokedCallback`
  （Android 16 预测式返回）、`windowSoftInputMode=adjustResize`。
- Android 端导航栏新增 **课表** 标签页，与 Web 端共用同一份课表数据。

## 构建方式

```bash
# Web：解析课表 -> 生成图标子集 -> 校验 -> vite build
node scripts/import-schedule.mjs "学生课表.doc"     # 生成 web/src/data/schedule.ts + ScheduleData.kt
npm install && npm run build                        # 输出 dist/

# Android：输出 app/build/outputs/apk/release/app-release.apk（versionCode 4 / versionName 1.0.3）
./gradlew assembleRelease
```

## 验证

- Web：`npm run verify`（Playwright + Chromium，412×892、虚拟摄像头）共 **57 步**全部通过，
  0 console 错误、0 page error，截图见 `screenshots/`（含课表、筛选、高亮、导入面板）。
- Android：`./gradlew assembleRelease` 构建通过，APK 清单核对 `targetSdkVersion=36`、
  `native-code: arm64-v8a`、`POST_NOTIFICATIONS` 权限。
