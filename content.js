// 只需替换此文件里的文字；也可以打开“配置工具.html”可视化修改后导出。
window.TEMPLATE_CONTENT = {
  site: {name: '你的网站名称', tagline: '分享资讯，整理资源，记录值得收藏的内容', intro: '这是一个通用的三栏网站模板。你可以把这里换成网站介绍、品牌故事、服务说明或个人简介。页面保留了浅蓝配色、顶部双层导航、左右侧栏和中间内容区，不限定任何行业或主题。', copyright: '© 2026 你的网站名称', contact: 'hello@example.com'},
  navigation: [{label:'首页',href:'index.html'},{label:'资讯中心',href:'category.html?category=news'},{label:'资源分享',href:'category.html?category=resources'},{label:'专题文章',href:'category.html?category=features'},{label:'关于我们',href:'article.html?id=about'}],
  categories: [{id:'guide',label:'入门指南'},{id:'news',label:'行业资讯'},{id:'products',label:'产品展示'},{id:'downloads',label:'资料下载'},{id:'faq',label:'常见问题'},{id:'services',label:'服务项目'},{id:'features',label:'专题栏目'},{id:'cases',label:'案例分享'},{id:'resources',label:'资源导航'},{id:'community',label:'社区交流'},{id:'other',label:'更多内容'}],
  notices: ['欢迎访问你的网站','这里可以发布最新通知','新栏目现已开放','常用资料已经更新','更多内容持续整理中'],
  tools: ['常用工具入口','资料与文档','操作说明','常见问题解答','联系与反馈','资源收藏夹','更多实用链接'],
  welcomeTitle: '写给初次访问的朋友',
  welcome: ['欢迎来到你的网站。这里可以介绍网站能为访客提供什么，以及从哪里开始浏览。你可以保留当前简洁、密集的文字排版，也可以按照自己的内容长度调整说明。','两侧的公告、链接和推荐区可以独立修改。中间区域适合放入介绍、文章列表、产品说明和资源推荐。顶部的主导航与栏目导航可分别编辑。','本模板使用本地样式和图片，双击首页即可预览。需要更换内容时，可以打开随附的配置工具，修改站名、栏目和文章，然后导出新的 content.js 文件覆盖原文件。'],
  articles: [
    {id:'start',category:'guide',title:'新访客阅读指南',summary:'用一篇简短文章介绍网站的主要内容和使用方式。',date:'2026-01-01',paragraphs:['这是示例文章。请将标题、摘要和正文替换为你自己的内容。','建议先说明网站的主题，再介绍主要栏目，最后给出适合新访客的阅读顺序。']},
    {id:'update',category:'news',title:'网站最新动态',summary:'这里展示最近发布的消息、公告和内容更新。',date:'2026-01-02',paragraphs:['这里可以发布网站更新、活动安排或服务公告。','所有文字都是可替换的示例，不包含原网站文章。']},
    {id:'documents',category:'resources',title:'实用资料与工具整理',summary:'把常用资料和工具集中整理，方便访客查找。',date:'2026-01-03',paragraphs:['在这里介绍你整理的资源、资料的使用方法及适用范围。','需要提供真实下载文件时，可以把文件放入项目，并在配置文件中添加对应链接。']},
    {id:'feature',category:'features',title:'本期推荐专题',summary:'可以在这里介绍一个专题、产品系列或精选内容。',date:'2026-01-04',paragraphs:['这里是专题文章示例。你可以根据自己的主题重新编写。','模板保留文章标题、发布日期、正文及前后篇导航。']},
    {id:'case',category:'cases',title:'精选案例展示',summary:'介绍一个实际案例，以及它的过程和结果。',date:'2026-01-05',paragraphs:['这里可以展示案例背景、处理过程和最终结果。','配图可以放入 assets 文件夹，页面结构和配色无需修改。']},
    {id:'questions',category:'faq',title:'常见问题与使用说明',summary:'将访客常见的问题集中放在这一页。',date:'2026-01-06',paragraphs:['如何修改站名？使用配置工具，或者编辑 content.js 中的 site.name。','如何修改文章？在配置工具中选择文章，修改后导出 content.js，再覆盖原文件。']},
    {id:'about',category:'other',title:'关于我们',summary:'介绍网站、团队或个人，以及联系方式。',date:'2026-01-07',paragraphs:['这里可以填写你的个人简介、团队介绍或网站建立的初衷。','联系方式请在配置工具中填写；示例邮箱只是占位，不会发送邮件。']}
  ]
};
