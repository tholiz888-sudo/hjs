# 主站秘密花园栏目

入口位于主站左侧“秘密花园”，并在次导航提供手机入口。挂载在 `/crypto` 时地址为 `/crypto/garden`，独立运行门户时地址为 `/garden`。

进入后不加载门户的蓝色CSS或行情脚本，使用原站绿色背景、原始图片、文字排版和逐页背景音乐；只提供轻量的返回主站按钮。花园页面位于隔离框架中，原脚本不能操作主站账号或顶层页面。

资源在 `data/original`，清单为 `data/manifest.json`。4,870个成功采集文件全部纳入，包括163首MP3；音频支持流式Range播放。访问 `/crypto/garden/view/api/health` 可核对导入数量。

已知缺失：13个原站/meng/音乐地址返回404；部分历史失效图片/链接；留言提交与验证码尚未重建。Flash已接入本地Ruffle兼容播放；Java旧插件改用Canvas实现，原图缺失时会明确标记待补齐。保留已取得的历史留言，禁止提交回原站，不用其他音乐冒充缺失曲目。

本栏目不修改现有投研、交易复盘、CMS或账号接口，也不建立新的付费云服务。主站沿用 main 分支和原来的启动命令。

## 后台内容管理

主站后台 `/crypto/admin#garden` 提供：原页面搜索与分页、保留HTML排版的覆盖编辑、新篇发布、草稿与回收站、栏目启用与排序、163首原音乐选择、已有图片搜索及2MB以内图片上传。新篇和原页面修改立即从数据库读取，无需重新部署。草稿、停用栏目及回收内容不会公开；预览接口也要求管理员登录。

原始采集文件不覆盖。编辑内容与栏目保存在主站内容数据库；上传图片位于该数据库旁的garden-media目录。现有主站JSON备份包含花园编辑和栏目，不包含图片文件。旧版主站备份恢复时不会清空花园内容。

公开HTML统一转换为UTF-8并清理原站域名、外链及备案号，保留内部跳转和返回主站。原始资料仍原样保留。页面与预览均使用CSP沙箱，原页面脚本不能取得主站同源权限。

测试：`node --test crypto-site/tests/garden-management.test.cjs crypto-site/tests/garden.test.cjs`；浏览器实际操作：`node crypto-site/tests/garden-browser.mjs`（需要已有Playwright与Chromium）。

## 旧特效兼容

- 飘雪脚本替换为requestAnimationFrame动画，不执行原脚本中的旧广告代码。
- 已采集的15个Flash页面使用同站自托管Ruffle 0.7.1（MIT/Apache-2.0），原SWF保留；不要求安装Flash。运行包来源与完整性在compat/ruffle/SOURCE.json，许可证随包保存。
- 4个Java Applet页面按原参数尺寸实现雨、雪、湖面倒影和渐变，不再运行Java插件。这些不是原Java字节码的逐指令模拟。
- 点击烟花在原背景和OGG资源未补齐时使用Canvas交互实现；资源齐全后自动恢复原始H5引擎。
- 原采集遗漏的/welcome/java下6张Applet图片、烟花背景与3个OGG音效共10项，已于2026-10-24从用户补采包校验后纳入清单；烟花现在使用原始H5引擎及原音效。补采工具保留于tools/effect-assets-helper.zip。
- Flash使用同源公共资源CORS，框架继续保持不允许同源身份的沙箱；主站私有接口不开放CORS。播放器外链操作关闭。
- 测试node --test crypto-site/tests/garden-effects.test.cjs；浏览器验证node crypto-site/tests/garden-effects-browser.mjs。
