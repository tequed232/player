# 多分课表 v1.0.5

Material 3 Expressive 课表与多模态记录（Web + Android）。本版是 **v1.0.4 之后的修复版**。

## 修复

- **液态玻璃 × 原生 M3 互斥**：设置里改成「底边栏风格（互斥）」二选一——Material 3 原生（surfaceContainer 容器色）
  或 液态玻璃（模糊 + 折射，同时关闭 M3 容器底色与阴影），两套表面语言不再叠加打架。
- **识别页容器自适应**：「实时语音转文字」保持 148–216dp 的可读区间随窗口收缩，「总结 · 重点 · 思维导图」吃掉剩余空间，
  矮屏 / 大字体下两个容器都完整可见，不再互相抢位置。
- **滑块不再抽搐**：拖动过程不回写数值，松手时才磁吸到 0/25/50/75/100 卡扣；旁边的数字仍可点开精确编辑。
- **微信内置浏览器适配**：「关于」的美术图自适应收小（144×192，一屏可见），开屏图与猫娘按钮同步收档，
  微信内自动关闭 backdrop-filter（X5 内核不稳），设计说明卡片默认折叠。
- **Cloudflare CDN**：`deploy/cloudflare/` 给出接入 Cloudflare 边缘缓存的完整步骤（DNS 代理、SSL、两条 Cache Rule、
  Brotli/HTTP3 建议）与 Cloudflare Pages 的 `_headers`（assets 长缓存、HTML 不缓存）。
- **Android**：首页标题更名「多分课表」，内容改为可滚动，小屏/大字体不再被裁切。

## Android（本包）

- 应用名 **多分课表**，图标为猫娘美术资源（自适应图标 + mdpi~xxxhdpi PNG + 圆形版）。
- 课表标签页支持 **系统文件管理器（SAF）导入** .doc/.rtf/.html/.csv，并可恢复内置课表。
- 录音进度条 + 系统通知；Android 16 / ColorOS 流体云（Live Updates 渠道 + ProgressStyle 提升）。
- 支持**可预测式返回**：非首页先回首页，首页再按一次才退出。
- arm64-v8a，minSdk 26，targetSdk 35。

## 验证

Web 端本地与线上各跑一遍：91 步全部通过，0 console 错误、0 page error。
Web：https://tequed232.github.io/duofen-kebiao/
