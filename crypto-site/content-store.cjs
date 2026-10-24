const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { articles, categories } = require('./data');
const cfg = require('./site-config.json');
const originals = structuredClone(articles);
const originalCategories = structuredClone(categories).map((c, index) => ({
  ...c, parentId: '', order: index + 1, enabled: true, showSidebar: true, showSecondary: true,
  showTop: ['market', 'strategies', 'ai'].includes(c.id),
  navLabel: ({ exchanges: '交易所返佣', market: '行情快讯', strategies: '技术进阶', ai: '智能量化' })[c.id] || c.label,
}));
const originalConfig = structuredClone(cfg);
const coreIds = new Set(originalCategories.map(c => c.id));
const idPattern = /^[a-z0-9][a-z0-9-]{0,99}$/;
let database;
function db() {
  if (!database) {
    const file = process.env.PORTAL_DB_PATH || path.join(__dirname, 'storage/content.sqlite');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    database = new DatabaseSync(file);
    database.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS articles(slug TEXT PRIMARY KEY,payload TEXT NOT NULL,status TEXT NOT NULL,updated TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS content_settings(key TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS content_audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,created TEXT NOT NULL);`);
  }
  return database;
}
function setting(key, fallback) {
  const row = db().prepare('SELECT payload FROM content_settings WHERE key=?').get(key);
  return row ? JSON.parse(row.payload) : structuredClone(fallback);
}
function putSetting(key, value) {
  db().prepare('INSERT INTO content_settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload').run(key, JSON.stringify(value));
}
function audit(actor, action, target) {
  db().prepare('INSERT INTO content_audit(actor,action,target,created) VALUES(?,?,?,?)').run(actor || '管理员', action, target, new Date().toISOString());
  db().exec('DELETE FROM content_audit WHERE id NOT IN (SELECT id FROM content_audit ORDER BY id DESC LIMIT 300)');
}
function allCategories() { return setting('categories', originalCategories).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)); }
function tree(rows = allCategories(), parent = '', depth = 0) {
  return rows.filter(c => c.parentId === parent).flatMap(c => [{ ...c, depth }, ...tree(rows, c.id, depth + 1)]);
}
function categoryVisible(id, rows = allCategories()) {
  const c = rows.find(c => c.id === id);
  return !!c && c.enabled && (!c.parentId || categoryVisible(c.parentId, rows));
}
function config() { return { ...originalConfig, ...setting('site', {}), exchanges: setting('exchanges', originalConfig.exchanges).map((x, i) => ({ enabled: true, order: i + 1, ...x })).sort((a, b) => a.order - b.order) }; }
function list() {
  const overrides = new Map(db().prepare('SELECT * FROM articles').all().map(r => [r.slug, { ...JSON.parse(r.payload), status: r.status, updated: r.updated }]));
  return [...originals.map(a => overrides.get(a.slug) || { ...a, status: 'published' }), ...[...overrides.values()].filter(a => !originals.some(o => o.slug === a.slug))];
}
function refresh() {
  const rows = allCategories();
  categories.splice(0, categories.length, ...tree(rows).filter(c => categoryVisible(c.id, rows)));
  articles.splice(0, articles.length, ...list().filter(a => a.status === 'published' && categoryVisible(a.category, rows)));
  Object.assign(cfg, config());
  cfg.exchanges = cfg.exchanges.filter(x => x.enabled);
  return articles;
}
function text(value, max, label, required = false) {
  const result = String(value ?? '').trim();
  if ((required && !result) || result.length > max) throw Error(label + '不能为空或超出长度限制');
  return result;
}
function https(value, label, required = false) {
  const result = text(value, 2000, label, required);
  if (!result) return '';
  let u; try { u = new URL(result); } catch { throw Error(label + '需填写完整的 HTTPS 链接'); }
  if (u.protocol !== 'https:' || u.username || u.password) throw Error(label + '仅支持不含账号密码的 HTTPS 链接');
  return u.href;
}
function integer(value, label) {
  const n = Number(value ?? 0);
  if (!Number.isInteger(n) || Math.abs(n) > 100000) throw Error(label + '必须是 -100000 到 100000 的整数');
  return n;
}
function validateArticle(input, rows = allCategories()) {
  const a = {
    slug: text(input.slug, 100, '文章地址', true), title: text(input.title, 200, '标题', true),
    summary: text(input.summary, 1000, '摘要'), category: text(input.category, 100, '栏目', true),
    date: text(input.date, 10, '日期', true), status: input.status,
    seoTitle: text(input.seoTitle, 200, 'SEO 标题'), seoDescription: text(input.seoDescription, 500, 'SEO 描述'),
    tags: Array.isArray(input.tags) ? [...new Set(input.tags.map(t => text(t, 30, '标签')).filter(Boolean))] : [],
    cover: https(input.cover, '封面图片'), featured: input.featured === true,
    order: integer(input.order, '文章排序'), exchangeId: text(input.exchangeId, 100, '关联交易所'), sections: [],
  };
  if (a.slug === 'new' || !idPattern.test(a.slug) || !rows.some(c => c.id === a.category) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(a.date) || !Number.isFinite(Date.parse(a.date)) ||
      new Date(a.date).toISOString().slice(0, 10) !== a.date || !['draft', 'published', 'trash'].includes(a.status) || a.tags.length > 20 ||
      !Array.isArray(input.sections) || !input.sections.length || input.sections.length > 100) throw Error('请检查文章地址、栏目、日期、标签和正文');
  if (a.exchangeId && !config().exchanges.some(x => x.id === a.exchangeId)) throw Error('关联交易所不存在');
  a.sections = input.sections.map(s => {
    if (!s || typeof s.heading !== 'string' || typeof s.text !== 'string') throw Error('正文章节格式不正确');
    const links = (s.links || []).map(l => {
      const href = text(l.href, 2000, '正文链接');
      if (!(href.startsWith('/') && !/^\/[/\\]/.test(href) && !/[\s\\]/.test(href))) https(href, '正文链接', true);
      return { label: text(l.label, 100, '链接文字', true), href };
    });
    if (links.length > 20) throw Error('每节最多 20 个链接');
    return { heading: text(s.heading, 300, '章节标题'), text: text(s.text, 30000, '章节正文'), image: https(s.image, '章节图片'), ...(links.length ? { links } : {}) };
  });
  return a;
}
function writeArticle(a) {
  db().prepare('INSERT INTO articles VALUES(?,?,?,?) ON CONFLICT(slug) DO UPDATE SET payload=excluded.payload,status=excluded.status,updated=excluded.updated').run(a.slug, JSON.stringify(a), a.status, new Date().toISOString());
}
function save(input, actor) {
  const previous = list().find(x => x.slug === input.slug);
  if (input.create && previous) throw Error('文章地址已存在，请更换地址，或从文章列表编辑原文');
  // Older clients omit these fields: retain existing links and registration association.
  const data = { ...input, exchangeId: input.exchangeId ?? previous?.exchangeId ?? '' };
  if (Array.isArray(data.sections)) data.sections = data.sections.map(s => ({ ...s, links: s.links ?? previous?.sections.find(old => old.heading === s.heading)?.links }));
  const a = validateArticle(data);
  writeArticle(a); audit(actor, a.status === 'published' ? '发布文章' : '保存文章', a.title); refresh(); return a;
}
function articleAction(slugs, action, category, actor) {
  if (!Array.isArray(slugs) || !slugs.length || slugs.length > 500 || !['publish', 'draft', 'trash', 'restore', 'move'].includes(action)) throw Error('请选择文章和有效操作');
  const rows = list(), chosen = rows.filter(a => slugs.includes(a.slug));
  if (chosen.length !== new Set(slugs).size) throw Error('部分文章不存在，请刷新后再试');
  if (action === 'move' && !allCategories().some(c => c.id === category)) throw Error('目标栏目不存在');
  db().exec('BEGIN');
  try {
    for (const a of chosen) {
      if (action === 'move') a.category = category;
      else a.status = ({ publish: 'published', draft: 'draft', trash: 'trash', restore: 'draft' })[action];
      writeArticle(a);
    }
    audit(actor, '批量' + ({ publish: '发布', draft: '下架', trash: '移入回收站', restore: '恢复草稿', move: '移动栏目' })[action], chosen.length + ' 篇文章');
    db().exec('COMMIT');
  } catch (error) { db().exec('ROLLBACK'); throw error; }
  refresh(); return chosen.length;
}
function validateCategories(rows) {
  if (!Array.isArray(rows) || rows.length > 200) throw Error('最多支持 200 个栏目');
  const seen = new Set();
  const normalized = rows.map(c => {
    if (c.id === 'new' || !idPattern.test(c.id) || seen.has(c.id)) throw Error('栏目地址格式错误或重复');
    seen.add(c.id);
    return { id: c.id, label: text(c.label, 50, '栏目名称', true), description: text(c.description, 1000, '栏目描述'),
      parentId: String(c.parentId || ''), navLabel: text(c.navLabel || c.label, 50, '导航名称'), order: integer(c.order, '栏目排序'),
      enabled: c.enabled !== false, showTop: c.showTop === true, showSecondary: c.showSecondary !== false, showSidebar: c.showSidebar !== false };
  });
  for (const c of normalized) {
    const chain = new Set([c.id]); let parentId = c.parentId;
    while (parentId) {
      if (chain.has(parentId)) throw Error('父栏目不能是自己或自己的子栏目');
      const parent = normalized.find(x => x.id === parentId);
      if (!parent) throw Error('父栏目不存在');
      chain.add(parentId); parentId = parent.parentId;
      if (chain.size > 5) throw Error('栏目最多支持五级');
    }
    if (c.parentId && c.showTop) throw Error('子栏目请放在次导航或左侧导航，顶部导航用于一级栏目');
  }
  return normalized;
}
function saveCategory(input, actor) {
  const rows = allCategories(), existing = rows.findIndex(c => c.id === input.id);
  if (input.create && existing >= 0) throw Error('栏目地址已存在，请使用其他地址');
  const next = existing < 0 ? [...rows, input] : rows.map((c, i) => i === existing ? input : c);
  const result = validateCategories(next); putSetting('categories', result); audit(actor, existing < 0 ? '添加栏目' : '修改栏目', input.label); refresh(); return result;
}
function deleteCategory(id, actor) {
  if (coreIds.has(id)) throw Error('系统栏目保留用于工具页面，可修改名称或关闭导航显示');
  const rows = allCategories();
  if (!rows.some(c => c.id === id)) throw Error('栏目不存在');
  if (rows.some(c => c.parentId === id)) throw Error('请先移动或删除该栏目下的子栏目');
  if (list().some(a => a.category === id)) throw Error('栏目仍有文章（含草稿和回收站），请先批量移动到其他栏目');
  putSetting('categories', rows.filter(c => c.id !== id)); audit(actor, '删除栏目', id); refresh();
}
function validateExchange(input) {
  if (input.id === 'new' || !idPattern.test(input.id || '')) throw Error('交易所标识需使用小写字母、数字和短横线');
  const discount = input.discountPercent === '' || input.discountPercent == null ? null : Number(input.discountPercent);
  if (discount !== null && (!Number.isFinite(discount) || discount < 0 || discount > 100)) throw Error('优惠比例应为 0–100，未确认时留空');
  return { id: input.id, name: text(input.name, 100, '交易所名称', true), officialUrl: https(input.officialUrl, '官网链接', true),
    referralUrl: https(input.referralUrl, '邀请注册链接'), code: text(input.code, 200, '邀请码'), discountPercent: discount,
    note: text(input.note, 2000, '说明'), enabled: input.enabled !== false, order: integer(input.order, '交易所排序'), tutorialSlug: text(input.tutorialSlug, 100, '教程地址') };
}
function saveExchange(input, actor) {
  const rows = config().exchanges;
  if (input.create && rows.some(x => x.id === input.id)) throw Error('交易所标识已存在');
  const x = validateExchange(input);
  if (x.tutorialSlug && !list().some(a => a.slug === x.tutorialSlug)) throw Error('所选教程不存在');
  if (!rows.some(old => old.id === x.id) && rows.length >= 50) throw Error('最多支持 50 个交易所');
  putSetting('exchanges', rows.some(old => old.id === x.id) ? rows.map(old => old.id === x.id ? x : old) : [...rows, x]);
  audit(actor, '保存交易所', x.name); refresh(); return x;
}
function deleteExchange(id, actor) {
  if (list().some(a => a.exchangeId === id)) throw Error('仍有文章关联该交易所，请先解除文章关联；也可关闭该交易所展示');
  putSetting('exchanges', config().exchanges.filter(x => x.id !== id)); audit(actor, '删除交易所', id); refresh();
}
function validateSite(input) {
  return { name: text(input.name, 60, '网站名称', true), tagline: text(input.tagline, 200, '首页标题', true),
    description: text(input.description, 1000, '网站描述'), contact: text(input.contact, 500, '联系方式'),
    keywords: text(input.keywords, 500, 'SEO 关键词'), footerText: text(input.footerText, 1000, '页脚说明'),
    social: { telegram: https(input.social?.telegram, 'Telegram 链接'), x: https(input.social?.x, 'X 链接'), wechat: https(input.social?.wechat, '公众号链接') } };
}
function saveSite(input, actor) { const site = validateSite(input); putSetting('site', site); audit(actor, '修改网站设置', site.name); refresh(); return site; }
function dashboard() {
  const all = list();
  return { articles: all, categories: tree(), settings: config(), audit: db().prepare('SELECT * FROM content_audit ORDER BY id DESC LIMIT 30').all(),
    counts: { articles: all.filter(a => a.status !== 'trash').length, published: all.filter(a => a.status === 'published').length, draft: all.filter(a => a.status === 'draft').length,
      trash: all.filter(a => a.status === 'trash').length, categories: allCategories().length, exchanges: config().exchanges.length }, coreIds: [...coreIds] };
}
function backup() { return { format: 'portal-content', version: 1, exportedAt: new Date().toISOString(), categories: allCategories(), settings: config(), articles: list(), garden: require('./garden-store.cjs').exported() }; }
function restore(input, actor) {
  if (input.format !== 'portal-content' || input.version !== 1) throw Error('不是本站支持的备份文件');
  const cats = validateCategories(input.categories);
  if ([...coreIds].some(id => !cats.some(c => c.id === id))) throw Error('备份中缺少系统栏目');
  const site = validateSite(input.settings);
  if (!Array.isArray(input.settings.exchanges) || input.settings.exchanges.length > 50) throw Error('交易所备份格式不正确');
  const exchanges = input.settings.exchanges.map(validateExchange);
  if (new Set(exchanges.map(x => x.id)).size !== exchanges.length) throw Error('备份交易所标识重复');
  if (!Array.isArray(input.articles) || input.articles.length > 5000) throw Error('文章备份格式不正确');
  const garden=input.garden===undefined?null:require('./garden-store.cjs').validateBackup(input.garden);
  db().exec('BEGIN');
  try {
    putSetting('categories', cats); putSetting('site', site); putSetting('exchanges', exchanges);
    const rows = input.articles.map(a => validateArticle(a, cats));
    if (new Set(rows.map(a => a.slug)).size !== rows.length || originals.some(a => !rows.some(r => r.slug === a.slug))) throw Error('备份文章重复或缺少内置文章');
    if (exchanges.some(x => x.tutorialSlug && !rows.some(a => a.slug === x.tutorialSlug))) throw Error('备份的交易所教程不存在');
    db().exec('DELETE FROM articles'); rows.forEach(writeArticle); if(garden)require('./garden-store.cjs').importData(garden); audit(actor, '恢复内容备份', rows.length + ' 篇文章'); db().exec('COMMIT');
  } catch (error) { db().exec('ROLLBACK'); throw error; }
  refresh();
}
module.exports = { list, refresh, save, articleAction, allCategories, tree, config, saveCategory, deleteCategory, saveExchange, deleteExchange, saveSite, dashboard, backup, restore, database: db, audit };
