# 秘密花园栏目

主站入口 `/garden`，原页面和媒体限定在 `/garden/view/`。前端保留主站导航，使用隔离 iframe 展示原始花园页面；主站行情定时更新不会重建 iframe 或中断音乐。

静态资料位于 `projects/yini-website/data/original`，网址映射位于同目录上层 `manifest.json`。完整导入4,860个已成功采集文件，包含163首MP3。服务懒加载映射，音频使用文件流和Range响应，避免整首音乐同时读入内存。

主站 `/api/health`、管理员账号、行情、会员及订单逻辑保持原接口。栏目导入情况可通过 `/garden/view/api/health` 检查。

原始网页脚本放在不允许同源访问、顶层导航或表单提交的沙箱框架内。已知13个/meng/音乐地址返回404，不替换为其他歌曲。历史留言可浏览，留言提交、Flash/Java插件未实现兼容；不应声称所有原站功能都完成。

验证：`node --test tests/garden.test.mjs`、`node tests/garden-browser.mjs`；独立资料校验 `node --test projects/yini-website/tests.mjs`。

部署继续使用现有Render服务与部署分支，不创建第二个网站或覆盖行情入口。静态素材已随代码纳入部署，构建会比此前更久。
