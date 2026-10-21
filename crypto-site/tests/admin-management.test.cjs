const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

test('content operations persist categories, referral settings, publication workflows and atomic backups', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-management-'));
  let child, port, cookie;
  async function start() {
    child = spawn(process.execPath, ['-e', `const http=require('node:http');const {handleSiteRequest}=require('./server');const server=http.createServer((req,res)=>handleSiteRequest(req,res,{mountPath:'/portal'}));server.listen(0,'127.0.0.1',()=>console.log('PORT='+server.address().port));`], {
      cwd: path.resolve(__dirname, '..'), env: { ...process.env, ADMIN_EMAILS: 'owner@example.com', ADMIN_PASSWORD: 'local-test-password', MARKET_AUTO_SYNC: '0', PORTAL_DB_PATH: path.join(dir, 'content.sqlite'), RESEARCH_DB_PATH: path.join(dir, 'research.sqlite'), REVIEW_DATA_DIR: path.join(dir, 'review') },
    });
    await new Promise((resolve, reject) => {
      let log = ''; const timeout = setTimeout(() => reject(Error('Server timeout: ' + log)), 10000);
      child.stdout.on('data', data => { log += data; const match = /PORT=(\d+)/.exec(log); if (match) { port = match[1]; clearTimeout(timeout); resolve(); } });
      child.stderr.on('data', data => { log += data; }); child.on('error', reject);
    });
  }
  async function stop() { if (child) { const p = child; child = null; p.kill(); await new Promise(resolve => p.once('exit', resolve)); } }
  async function request(url, method = 'GET', data, authenticated = true) {
    const response = await fetch(`http://127.0.0.1:${port}/portal${url}`, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(authenticated && cookie ? { Cookie: cookie } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
    const text = await response.text(); let value; try { value = JSON.parse(text); } catch { value = text; }
    return { status: response.status, headers: response.headers, value };
  }
  async function ok(url, method, data) { const result = await request(url, method, data); assert.equal(result.status, 200, JSON.stringify(result.value)); return result.value; }
  try {
    await start(); const login = await ok('/admin/api/login', 'POST', { email: 'owner@example.com', password: 'local-test-password' });
    // Obtain the cookie explicitly; the HTTP helper intentionally does not act as a browser jar.
    const auth = await request('/admin/api/login', 'POST', { email: 'owner@example.com', password: 'local-test-password' });
    cookie = auth.headers.getSetCookie().find(c => !c.includes('Max-Age=0')).split(';')[0];
    const initial = await ok('/admin/api/state');
    const beginnerSettings = initial.categories.find(c => c.id === 'beginners');
    await ok('/admin/api/categories', 'POST', {...beginnerSettings,showSidebar:false});
    const hiddenSidebar = (await ok('/')).match(/<aside class="left-sidebar">([\s\S]*?)<\/aside>/)[1];
    assert.doesNotMatch(hiddenSidebar,/新手入门 · 全部教程/,'sidebar visibility applies to built-in tutorial block');
    await ok('/admin/api/categories', 'POST', beginnerSettings);
    const parent = { id: 'academy', label: '学习学院', description: '学院介绍', navLabel: '学习学院', parentId: '', order: 6, enabled: true, showTop: true, showSecondary: true, showSidebar: true, create: true };
    const childCategory = { ...parent, id: 'wallet-school', label: '钱包课堂', navLabel: '钱包课堂', parentId: 'academy', order: 7, showTop: false };
    assert.equal((await request('/admin/api/categories', 'POST', {...parent,id:'new'})).status,400,'editor route name reserved');
    await ok('/admin/api/categories', 'POST', parent); await ok('/admin/api/categories', 'POST', childCategory);
    assert.match((await ok('/')).toString(), /学习学院/);
    assert.match((await ok('/category/academy')).toString(), /钱包课堂/);
    assert.equal((await request('/admin/api/categories', 'POST', parent)).status, 400, 'duplicate category cannot overwrite');
    assert.equal((await request('/admin/api/categories', 'POST', { ...parent, create: false, showTop: false, parentId: childCategory.id })).status, 400, 'cycles rejected');
    assert.equal((await request('/admin/api/categories', 'DELETE', { id: parent.id })).status, 400, 'parent with children protected');
    const article = { slug: 'wallet-class-article', title: '钱包课堂测试文章', summary: '独立分类下的完整教程', category: childCategory.id, date: '2026-10-21', status: 'published', sections: [{ heading: '先检查安全', text: '<script>alert(1)</script>\n第二行', links: [{ label: '内部教程', href: '/articles/wallet-security' }] }], tags: ['钱包', '安全'], featured: true, order: -1, seoTitle: '钱包 SEO 标题', seoDescription: '钱包 SEO 描述' };
    assert.equal((await request('/admin/api/articles', 'POST', {...article,slug:'new'})).status,400);
    await ok('/admin/api/articles', 'POST', { ...article, create: true });
    assert.equal((await request('/admin/api/articles', 'POST', { ...article, create: true })).status, 400, 'duplicate article creation protected');
    assert.equal((await request('/admin/api/articles', 'POST', { ...article, date: '2026-02-31' })).status, 400);
    assert.equal((await request('/admin/api/articles', 'POST', { ...article, sections: [{ heading: 'X', text: 'X', links: [{ label: 'X', href: 'javascript:alert(1)' }] }] })).status, 400);
    const page = await ok('/articles/' + article.slug);
    assert.match(page, /<title>钱包 SEO 标题/); assert.match(page, /content="钱包 SEO 描述"/);
    assert.match(page, /&lt;script&gt;/); assert.doesNotMatch(page, /<script>alert/);
    assert.match(page, /学习学院/); assert.match(page, /钱包课堂/);
    assert.match(await ok('/category/academy'), /钱包课堂测试文章/, 'parent includes descendant articles');
    assert.match(await ok('/category/wallet-school'), /钱包课堂测试文章/);
    assert.match(await ok('/'), /钱包课堂测试文章/, 'featured article reaches existing homepage recommendation area');
    assert.equal((await request('/admin/api/categories', 'DELETE', { id: childCategory.id })).status, 400, 'populated categories protected');
    await ok('/admin/api/categories', 'POST', { ...parent, create: false, enabled: false });
    assert.equal((await request('/articles/' + article.slug)).status, 404);
    assert.equal((await request('/category/wallet-school')).status, 404);
    assert.doesNotMatch(await ok('/sitemap.xml'), /wallet-class-article/);
    await ok('/admin/api/categories', 'POST', { ...parent, create: false });
    assert.equal((await request('/articles/' + article.slug)).status, 200);
    const binance = initial.settings.exchanges.find(x => x.id === 'binance');
    const exchange = { ...binance, referralUrl: 'https://example.com/register?ref=OWNER123', code: 'OWNER123', discountPercent: 15, enabled: true, tutorialSlug: 'binance-registration' };
    await ok('/admin/api/exchanges', 'POST', exchange);
    const go = await request('/go/binance'); assert.equal(go.status, 302); assert.equal(go.headers.get('location'), exchange.referralUrl);
    assert.match(await ok('/exchanges'), /OWNER123/); assert.match(await ok('/articles/binance-registration'), /OWNER123/);
    assert.equal((await request('/admin/api/exchanges', 'POST', { ...exchange, referralUrl: 'javascript:alert(1)' })).status, 400);
    assert.equal((await request('/admin/api/exchanges', 'POST', { ...exchange, discountPercent: 101 })).status, 400);
    assert.equal((await request('/admin/api/exchanges', 'DELETE', { id: 'binance' })).status, 400, 'linked exchange protected');
    await ok('/admin/api/exchanges', 'POST', { ...exchange, enabled: false }); assert.equal((await request('/go/binance')).status, 404);
    await ok('/admin/api/exchanges', 'POST', exchange);
    const newExchange = { id: 'sample-exchange', name: '<b>样例交易所</b>', officialUrl: 'https://example.org/', referralUrl: 'https://example.org/join', code: 'SAMPLE', discountPercent: '', enabled: true, order: 10, tutorialSlug: article.slug };
    assert.equal((await request('/admin/api/exchanges', 'POST', {...newExchange,id:'new'})).status,400);
    await ok('/admin/api/exchanges', 'POST', { ...newExchange, create: true });
    await ok('/admin/api/articles', 'POST', { ...article, exchangeId: newExchange.id });
    assert.match(await ok('/articles/' + article.slug), /&lt;b&gt;样例交易所&lt;\/b&gt;注册入口/);
    const site = { ...initial.settings, name: '<img>测试站', contact: 'hello@example.org', keywords: '钱包,安全', social: { telegram: 'https://t.me/example', x: 'https://x.com/example', wechat: '' } };
    await ok('/admin/api/settings', 'PUT', site);
    const home = await ok('/'); assert.match(home, /&lt;img&gt;测试站/); assert.doesNotMatch(home, /<img>测试站/); assert.match(home, /https:\/\/t.me\/example/);
    const backup = await ok('/admin/api/backup'); assert.equal(backup.format, 'portal-content');
    assert.ok(!JSON.stringify(backup).includes('local-test-password'));
    await ok('/admin/api/articles/bulk', 'POST', { slugs: [article.slug], action: 'trash' }); assert.equal((await request('/articles/' + article.slug)).status, 404);
    await ok('/admin/api/articles/bulk', 'POST', { slugs: [article.slug], action: 'restore' });
    assert.equal((await ok('/admin/api/state')).articles.find(a => a.slug === article.slug).status, 'draft');
    await ok('/admin/api/articles/bulk', 'POST', { slugs: [article.slug], action: 'publish' });
    await ok('/admin/api/articles/bulk', 'POST', { slugs: [article.slug], action: 'move', category: 'beginners' });
    assert.doesNotMatch(await ok('/category/academy'), /钱包课堂测试文章/);
    await ok('/admin/api/categories', 'DELETE', { id: childCategory.id }); await ok('/admin/api/categories', 'DELETE', { id: parent.id });
    const invalidBackup = structuredClone(backup); invalidBackup.settings.name = 'MUST ROLLBACK'; invalidBackup.articles[0].category = 'missing';
    assert.equal((await request('/admin/api/backup', 'POST', invalidBackup)).status, 400);
    assert.equal((await ok('/admin/api/state')).settings.name, site.name, 'invalid backup rolls back all settings atomically');
    await ok('/admin/api/backup', 'POST', backup);
    assert.match(await ok('/category/academy'), /钱包课堂测试文章/);
    assert.equal((await ok('/admin/api/state')).articles.find(a => a.slug === article.slug).category, childCategory.id);
    await stop(); await start();
    assert.match(await ok('/category/academy'), /钱包课堂测试文章/, 'content persists across restart');
    assert.equal((await request('/go/binance')).headers.get('location'), exchange.referralUrl);
    assert.match(await ok('/'), /&lt;img&gt;测试站/);
    assert.ok((await ok('/admin/api/state')).audit.some(x => x.action === '恢复内容备份'));
    assert.equal((await request('/admin/api/settings', 'PUT', site, false)).status, 401);
    assert.equal((await request('/admin/api/categories', 'POST', parent, false)).status, 401);
    assert.equal((await request('/admin/api/exchanges', 'POST', exchange, false)).status, 401);
    assert.equal((await request('/admin/api/backup', 'GET', undefined, false)).status, 401);
  } finally { await stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});
