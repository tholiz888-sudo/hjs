(() => {
  const base = document.body.dataset.base;
  const status = document.getElementById('status');
  const workspace = document.getElementById('workspace');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const date = value => value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '初始内容';
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
  const labels = { published: '已发布', draft: '草稿', trash: '回收站' };
  let state, dirty = false, currentHash = '', articlePage = 1, selected = new Set(), pendingBackup;
  let filters = { query: '', category: '', status: '' };
  async function api(path, method = 'GET', data) {
    const response = await fetch(base + '/admin/api/' + path, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
    const value = await response.json();
    if (!response.ok) throw Error(value.error || '请求失败');
    return value;
  }
  function message(text, error = false) { status.textContent = text; status.hidden = !text; status.classList.toggle('error', error); if (text) status.scrollIntoView({ block: 'nearest' }); }
  async function refresh() { state = await api('state'); }
  function heading(title, description, actions = '') { return `<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`; }
  function options(rows, value, empty = '请选择') { return `<option value="">${escape(empty)}</option>` + rows.map(c => `<option value="${escape(c.id)}" ${c.id === value ? 'selected' : ''}>${'　'.repeat(c.depth || 0)}${escape(c.label || c.name)}${c.enabled === false ? '（已停用）' : ''}</option>`).join(''); }
  function field(name, title, value = '', extra = '') { return `<label>${title}<input name="${name}" value="${escape(value)}" ${extra}></label>`; }
  function check(name, title, value) { return `<label class="check"><input type="checkbox" name="${name}" ${value ? 'checked' : ''}>${title}</label>`; }
  function empty(title, description) { return `<div class="empty"><strong>${title}</strong>${description}</div>`; }
  function categoryName(id) { return state.categories.find(c => c.id === id)?.label || '未分类'; }
  function badge(a) { return `<span class="badge ${a.status}">${labels[a.status]}</span>`; }
  function auditList() { return state.audit.length ? `<ul class="audit-list">${state.audit.slice(0, 8).map(x => `<li><div><strong>${escape(x.action)}</strong><br><span>${escape(x.target)}</span></div><small>${date(x.created)}</small></li>`).join('')}</ul>` : empty('还没有操作记录', '保存文章或设置后，记录会出现在这里。'); }
  function overview() {
    const c = state.counts;
    workspace.innerHTML = heading('管理工作台', '从内容发布到推荐链接，在这里管理网站的日常运营。', '<a class="button primary" href="#article/new">＋ 发布文章</a>') +
      `<div class="stats-grid">${[[c.articles, '文章总数', c.published + ' 篇已发布 · ' + c.draft + ' 篇草稿'], [c.categories, '栏目与子栏目', '按层级组织内容与导航'], [c.exchanges, '交易所入口', '链接、邀请码与活动说明'], [c.trash, '回收站', '可恢复为草稿，避免误删内容']].map(([count, title, note]) => `<div class="stat-card"><small>${title}</small><strong>${count}</strong><p>${note}</p></div>`).join('')}</div>` +
      `<div class="two-columns"><div><section class="card"><div class="card-heading"><h2>常用操作</h2><span class="muted">内容运营</span></div><div class="quick-grid"><a class="quick-link" href="#article/new">＋ 写一篇新文章<small>栏目、正文、封面与 SEO</small></a><a class="quick-link" href="#category/new">＋ 添加栏目<small>父子层级、排序与导航位置</small></a><a class="quick-link" href="#exchanges">管理交易所优惠<small>更新注册链接与邀请码</small></a><a class="quick-link" href="#settings">调整网站设置<small>站名、介绍与社群链接</small></a></div></section><section class="card"><div class="card-heading"><h2>应用管理入口</h2><span class="muted">沿用原有完整后台</span></div><div class="module-cards"><div class="module-card"><h3>秘密花园</h3><p>发布新篇、编辑原页面、选择音乐与配图。</p><a href="#garden">进入秘密花园后台 →</a></div><div class="module-card"><h3>天机看盘</h3><p>策略、选币、文章、会员与服务设置。</p><a href="${base}/admin/research">进入天机看盘后台 →</a></div><div class="module-card"><h3>BIT浪浪研究室</h3><p>交易记录与用户管理。</p><a href="${base}/admin/review">进入BIT浪浪研究室后台 →</a></div></div></section><div class="notice">前台保留原有模板。这里保存的栏目、文章、交易所信息会直接应用到网站，无需重新部署。</div></div><section class="card"><div class="card-heading"><h2>最近操作</h2><span class="muted">北京时间</span></div>${auditList()}</section></div>`;
  }
  function articlesPanel() {
    workspace.innerHTML = heading('文章管理', '按栏目和状态整理文章，支持批量发布、下架、移动与回收。', '<a class="button primary" href="#article/new">＋ 新建文章</a>') +
      `<section class="card"><div class="filter-bar"><input id="article-query" aria-label="搜索文章" placeholder="搜索标题、摘要、标签或文章地址" value="${escape(filters.query)}"><select id="article-category" aria-label="筛选栏目">${options(state.categories, filters.category, '全部栏目')}</select><select id="article-status" aria-label="筛选文章状态"><option value="">全部有效文章</option>${Object.entries(labels).map(([k,v]) => `<option value="${k}" ${filters.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div><div id="article-table" class="table-wrap"></div><div class="batch-bar"><select id="bulk-action" aria-label="批量操作"><option value="">批量操作</option><option value="publish">批量发布</option><option value="draft">设为草稿 / 下架</option><option value="move">移动到其他栏目</option><option value="trash">移入回收站</option><option value="restore">恢复为草稿</option></select><select id="bulk-category" aria-label="移动目标栏目" hidden>${options(state.categories, '', '选择目标栏目')}</select><button data-action="bulk">执行操作</button><span id="selected-count" class="muted"></span></div><div id="article-pagination" class="pagination"></div></section>`;
    $('#article-query').oninput = event => { filters.query = event.target.value; articlePage = 1; articleTable(); };
    $('#article-category').onchange = event => { filters.category = event.target.value; articlePage = 1; articleTable(); };
    $('#article-status').onchange = event => { filters.status = event.target.value; articlePage = 1; selected.clear(); articleTable(); };
    $('#bulk-action').onchange = event => { $('#bulk-category').hidden = event.target.value !== 'move'; };
    articleTable();
  }
  function articleTable() {
    const rows = state.articles.filter(a => (filters.status ? a.status === filters.status : a.status !== 'trash') && (!filters.category || descendant(a.category, filters.category)) && (!filters.query || [a.title, a.summary, a.slug, ...(a.tags || [])].join(' ').toLowerCase().includes(filters.query.toLowerCase()))).sort((a, b) => (b.updated || b.date).localeCompare(a.updated || a.date));
    const pages = Math.max(1, Math.ceil(rows.length / 15)); articlePage = Math.min(pages, articlePage);
    const visible = rows.slice((articlePage - 1) * 15, articlePage * 15);
    $('#article-table').innerHTML = visible.length ? `<table><thead><tr><th><input id="select-page" type="checkbox" aria-label="选择本页文章" ${visible.every(a => selected.has(a.slug)) ? 'checked' : ''}></th><th>文章标题 / 地址</th><th>所属栏目</th><th>状态</th><th>更新时间</th><th>操作</th></tr></thead><tbody>${visible.map(a => `<tr><td><input type="checkbox" data-select="${a.slug}" aria-label="选择${escape(a.title)}" ${selected.has(a.slug) ? 'checked' : ''}></td><td class="title-cell"><strong>${escape(a.title)}</strong>${a.featured ? ' <span class="badge">推荐</span>' : ''}<small>/${a.slug}</small></td><td>${escape(categoryName(a.category))}</td><td>${badge(a)}</td><td><small>${date(a.updated || a.date)}</small></td><td><div class="cell-actions"><a class="button small" href="#article/${a.slug}">编辑</a>${a.status === 'published' ? `<a class="button small" target="_blank" rel="noopener" href="${base}/articles/${a.slug}">查看</a>` : ''}<button class="small ${a.status === 'trash' ? '' : 'danger'}" data-action="${a.status === 'trash' ? 'restore-article' : 'trash-article'}" data-id="${a.slug}">${a.status === 'trash' ? '恢复' : '回收'}</button></div></td></tr>`).join('')}</tbody></table>` : empty('没有匹配的文章', '调整筛选条件，或点击“新建文章”开始撰写。');
    $('#selected-count').textContent = '已选择 ' + selected.size + ' 篇';
    $('#article-pagination').innerHTML = `<span>共 ${rows.length} 篇 · 第 ${articlePage} / ${pages} 页</span><div class="row"><button class="small" data-action="prev-page" ${articlePage === 1 ? 'disabled' : ''}>上一页</button><button class="small" data-action="next-page" ${articlePage === pages ? 'disabled' : ''}>下一页</button></div>`;
    if ($('#select-page')) $('#select-page').onchange = event => { visible.forEach(a => event.target.checked ? selected.add(a.slug) : selected.delete(a.slug)); articleTable(); };
    $$('[data-select]').forEach(input => input.onchange = () => { input.checked ? selected.add(input.dataset.select) : selected.delete(input.dataset.select); $('#selected-count').textContent = '已选择 ' + selected.size + ' 篇'; });
  }
  function sectionMarkup(s = {}, i = 0) {
    return `<div class="section-editor"><div class="section-toolbar"><strong>章节 ${i + 1}</strong><button type="button" class="small" data-action="section-up" aria-label="上移章节">↑</button><button type="button" class="small" data-action="section-down" aria-label="下移章节">↓</button><button type="button" class="small danger" data-action="section-delete">移除</button></div><label>小标题<input class="section-heading" value="${escape(s.heading)}" maxlength="300"></label><label>正文<textarea class="section-text" rows="7" maxlength="30000">${escape(s.text)}</textarea></label><details ${s.image || s.links?.length ? 'open' : ''}><summary class="muted">图片与关联链接（可选）</summary><label>图片链接<input class="section-image" type="url" placeholder="https://…" value="${escape(s.image)}"></label><div class="section-links">${(s.links || []).map(linkMarkup).join('')}</div><button type="button" class="small" data-action="add-link">＋ 添加链接</button></details></div>`;
  }
  function linkMarkup(l = {}) { return `<div class="link-editor"><input class="link-label" aria-label="链接文字" maxlength="100" placeholder="链接文字" value="${escape(l.label)}"><input class="link-href" aria-label="链接地址" placeholder="https://… 或 /articles/…" value="${escape(l.href)}"><button type="button" class="small danger" data-action="delete-link" aria-label="移除链接">×</button></div>`; }
  function sectionsData() { return $$('.section-editor').map(el => ({ heading: $('.section-heading', el).value, text: $('.section-text', el).value, image: $('.section-image', el).value, links: $$('.link-editor', el).map(row => ({ label: $('.link-label', row).value, href: $('.link-href', row).value })) })); }
  function articleEditor(slug) {
    const a = slug === 'new' ? null : state.articles.find(a => a.slug === slug);
    if (slug !== 'new' && !a) { workspace.innerHTML = empty('文章不存在', '<a href="#articles">返回文章管理</a>'); return; }
    workspace.innerHTML = heading(a ? '编辑文章' : '新建文章', '分节编辑正文，为文章选择栏目、发布状态和搜索展示信息。', '<a class="button" href="#articles">← 返回列表</a>') +
      `<form id="editor"><div class="editor-grid"><div><section class="card"><div class="card-heading"><h2>文章内容</h2><span id="dirty-mark" class="unsaved-dot" hidden>尚未保存</span></div>${field('title', '文章标题', a?.title, 'required maxlength="200" placeholder="输入清晰、具体的文章标题"')}${field('slug', '文章地址', a?.slug, `required pattern="[a-z0-9][a-z0-9-]{0,99}" maxlength="100" placeholder="例如：okx-registration-guide" ${a ? 'readonly' : ''}`)}<p class="hint">地址仅支持小写字母、数字和短横线，保存后固定，避免原有链接失效。</p><label style="margin-top:18px">内容摘要<textarea name="summary" rows="3" maxlength="1000" placeholder="概括这篇文章解决什么问题">${escape(a?.summary)}</textarea></label><div class="card-heading"><h2>正文编辑</h2><button type="button" class="small" data-action="add-section">＋ 添加章节</button></div><div id="sections">${(a?.sections || [{ heading: '', text: '' }]).map(sectionMarkup).join('')}</div><div class="row"><button type="button" data-action="add-section">＋ 添加章节</button><button type="button" data-action="preview-article">预览正文</button></div><div id="body-preview" class="article-preview" hidden></div></section><section class="card"><h2>搜索引擎展示</h2><p class="hint">留空时使用文章标题和摘要。</p>${field('seoTitle', 'SEO 标题', a?.seoTitle, 'maxlength="200"') }<label>SEO 描述<textarea name="seoDescription" maxlength="500" rows="3">${escape(a?.seoDescription)}</textarea></label></section></div><aside class="editor-aside"><section class="card"><h2>发布设置</h2><label>所属栏目<select name="category" required>${options(state.categories, a?.category, '选择栏目或子栏目')}</select></label><label>发布日期<input type="date" name="date" required value="${escape(a?.date || today())}"></label><label>状态<select name="status"><option value="draft" ${!a || a.status === 'draft' ? 'selected' : ''}>草稿</option><option value="published" ${a?.status === 'published' ? 'selected' : ''}>已发布</option>${a?.status === 'trash' ? '<option value="trash" selected>回收站</option>' : ''}</select></label>${check('featured', '推荐至首页精选（按排序展示前 3 篇）', a?.featured)}${field('order', '栏目内排序', a?.order || 0, 'type="number" min="-100000" max="100000"')}<small class="muted">数值越小越靠前；新手栏目保留原有入门教程顺序。</small><div class="form-actions" style="margin-top:18px"><button class="primary" type="submit">保存文章</button><button type="submit" data-status="published">${a?.status === 'published' ? '更新发布' : '立即发布'}</button><button type="submit" data-status="draft">存为草稿</button></div>${a?.status === 'published' ? `<a class="button small" style="margin-top:12px" href="${base}/articles/${a.slug}" target="_blank" rel="noopener">查看前台文章 ↗</a>` : ''}</section><section class="card"><h2>扩展信息</h2>${field('cover', '封面图片链接', a?.cover, 'type="url" placeholder="https://…"')}${field('tags', '文章标签', (a?.tags || []).join('，'), 'placeholder="逗号分隔，如：币安，注册，安全"')}<label>关联交易所<select name="exchangeId">${options(state.settings.exchanges, a?.exchangeId, '不关联交易所')}</select><small>关联后文章可展示该平台的注册链接和邀请码。</small></label></section><div class="notice">草稿、回收站文章不会在前台展示。文章所属栏目停用时，该栏目内的文章也会暂时隐藏。</div></aside></div></form>`;
    $('#editor').onsubmit = async event => {
      event.preventDefault(); const form = event.target;
      const data = Object.fromEntries(new FormData(form));
      data.status = event.submitter?.dataset.status || data.status; data.featured = form.elements.featured.checked;
      data.tags = data.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean); data.sections = sectionsData(); data.create = !a;
      if (a?.status === 'published' && data.status !== 'published' && !confirm('保存为草稿后，文章将从前台下架。继续吗？')) return;
      await submit(event.submitter, async () => { await api('articles', 'POST', data); dirty = false; await refresh(); history.replaceState(null, '', '#article/' + data.slug); currentHash = location.hash; articleEditor(data.slug); message(data.status === 'published' ? '文章已发布，前台已同步更新。' : '文章已保存。'); });
    };
  }
  function categoriesPanel(id) {
    const c = id && id !== 'new' ? state.categories.find(c => c.id === id) : null;
    const rows = state.categories;
    workspace.innerHTML = heading('栏目管理', '管理父子层级、栏目名称、排序和导航展示。支持最多五级分类。', '<a class="button primary" href="#category/new">＋ 新建栏目</a>') +
      `<div class="category-split"><section class="card"><div class="card-heading"><h2>栏目结构</h2><span class="muted">${rows.length} 个栏目</span></div><div class="table-wrap"><table class="category-list"><thead><tr><th>栏目名称 / 导航位置</th><th>文章</th><th>排序</th><th>操作</th></tr></thead><tbody>${rows.map(row => `<tr><td><div class="category-name" style="padding-left:${(row.depth || 0) * 15}px"><span class="tree-mark">${row.depth ? '└' : '▦'}</span><div><strong>${escape(row.label)}</strong>${row.enabled ? '' : ' <span class="badge">停用</span>'}<div class="category-flags">${[row.showTop ? '顶部' : '', row.showSecondary ? '次导航' : '', row.showSidebar ? '左侧' : ''].filter(Boolean).join(' · ') || '不在导航展示'}</div></div></div></td><td>${state.articles.filter(a => a.category === row.id && a.status !== 'trash').length}</td><td>${row.order}</td><td><a class="button small" href="#category/${row.id}">编辑</a></td></tr>`).join('')}</tbody></table></div><p class="hint">父栏目页面同时展示子栏目的文章。停用父栏目时，其下所有子栏目和文章一并隐藏。</p></section><section class="card"><div class="card-heading"><h2>${c ? '编辑栏目' : '添加栏目'}</h2>${c ? '<a href="#category/new">新建</a>' : ''}</div><form id="category-form">${field('label', '栏目名称', c?.label, 'required maxlength="50"')}${field('id', '栏目地址标识', c?.id, `required pattern="[a-z0-9][a-z0-9-]{0,99}" ${c ? 'readonly' : ''} placeholder="例如：wallet-guides"`)}<label>父栏目<select name="parentId">${options(rows.filter(row => !c || !descendant(row.id, c.id)), c?.parentId, '无，作为一级栏目')}</select></label>${field('navLabel', '导航显示名称', c?.navLabel, 'maxlength="50" placeholder="留空时使用栏目名称"')}<label>栏目介绍<textarea name="description" rows="3" maxlength="1000">${escape(c?.description)}</textarea></label>${field('order', '显示排序（越小越靠前）', c?.order ?? rows.length + 1, 'type="number" min="-100000" max="100000"')}<h3>导航与可见性</h3><div class="checks">${check('enabled', '启用栏目', c ? c.enabled : true)}${check('showTop', '顶部导航（仅一级）', c?.showTop)}${check('showSecondary', '次导航', c ? c.showSecondary : true)}${check('showSidebar', '左侧导航', c ? c.showSidebar : true)}</div><div class="form-actions"><button class="primary">保存栏目</button>${c && !state.coreIds.includes(c.id) ? `<button type="button" class="danger" data-action="delete-category" data-id="${c.id}">删除栏目</button>` : ''}</div>${c && state.coreIds.includes(c.id) ? '<p class="hint">系统栏目可改名称、排序和显示位置，保留固定地址用于已有工具页面。</p>' : ''}</form></section></div>`;
    const parentSelect = $('#category-form [name=parentId]'), topCheck = $('#category-form [name=showTop]');
    parentSelect.onchange = () => { if (parentSelect.value) topCheck.checked = false; topCheck.disabled = !!parentSelect.value; };
    parentSelect.onchange();
    $('#category-form').onsubmit = async event => { event.preventDefault(); const form = event.target, data = Object.fromEntries(new FormData(form)); for (const key of ['enabled', 'showTop', 'showSecondary', 'showSidebar']) data[key] = form.elements[key].checked; data.create = !c; await submit($('button.primary', form), async () => { await api('categories', 'POST', data); dirty = false; await refresh(); history.replaceState(null, '', '#category/' + data.id); currentHash = location.hash; categoriesPanel(data.id); message('栏目已保存，前台导航和文章分类已同步。'); }); };
  }
  function descendant(id, parent) { const c = state.categories.find(c => c.id === id); return id === parent || !!(c?.parentId && descendant(c.parentId, parent)); }
  function exchangesPanel(id) {
    const rows = state.settings.exchanges;
    const x = id && id !== 'new' ? rows.find(x => x.id === id) : null;
    workspace.innerHTML = heading('交易所管理', '自己维护官网、推荐链接和邀请码，全站入口统一生效。', '<a class="button primary" href="#exchange/new">＋ 添加交易所</a>') +
      `<div class="exchange-split"><div><div class="exchange-list">${rows.map(row => `<a class="exchange-item ${x?.id === row.id ? 'selected' : ''}" href="#exchange/${row.id}"><div class="exchange-icon">${escape(row.name.slice(0, 1))}</div><div class="exchange-info"><h3>${escape(row.name)} <span class="badge ${row.enabled ? 'enabled' : ''}">${row.enabled ? '展示中' : '已隐藏'}</span></h3><p>邀请码：${escape(row.code || '未填写')} · ${row.discountPercent == null ? '优惠未填写' : row.discountPercent + '% 减免'}</p><p>${row.referralUrl ? '已配置推荐注册链接' : '当前使用官网链接'}</p></div><span>编辑 →</span></a>`).join('')}</div><div class="notice" style="margin-top:20px">保存后同步到交易所对比页、文章推荐卡片、右侧推荐栏和注册跳转入口。没有确认的优惠比例可以留空。</div></div><section class="card"><div class="card-heading"><h2>${x ? '编辑交易所' : '添加交易所'}</h2></div><form id="exchange-form">${field('name', '交易所名称', x?.name, 'required maxlength="100" placeholder="例如：Binance 币安"')}${field('id', '交易所标识', x?.id, `required pattern="[a-z0-9][a-z0-9-]{0,99}" ${x ? 'readonly' : ''} placeholder="例如：binance"`)}${field('officialUrl', '官网链接', x?.officialUrl, 'type="url" required placeholder="https://…"')}${field('referralUrl', '邀请注册链接', x?.referralUrl, 'type="url" placeholder="填写你的完整推荐链接"')}${field('code', '邀请码', x?.code, 'maxlength="200"')}${field('discountPercent', '手续费减免比例（%）', x?.discountPercent ?? '', 'type="number" min="0" max="100" step="any" placeholder="未确认请留空"')}<label>关联注册教程<select name="tutorialSlug">${options(state.articles.filter(a => a.status !== 'trash').map(a => ({ id: a.slug, label: a.title })), x?.tutorialSlug || (x?.id === 'binance' ? 'binance-registration' : ''), '不指定教程')}</select></label><label>优惠 / 使用说明<textarea name="note" maxlength="2000" rows="3">${escape(x?.note)}</textarea></label>${field('order', '展示排序', x?.order ?? rows.length + 1, 'type="number" min="-100000" max="100000"')}${check('enabled', '在前台展示该交易所', x ? x.enabled : true)}<div id="exchange-preview" class="link-preview"></div><div class="form-actions"><button class="primary">保存交易所</button>${x ? `<button type="button" class="danger" data-action="delete-exchange" data-id="${x.id}">删除</button>` : ''}</div></form></section></div>`;
    const form = $('#exchange-form');
    function preview() { const url = form.elements.referralUrl.value || form.elements.officialUrl.value; $('#exchange-preview').innerHTML = `<strong>前台入口预览</strong><p>${escape(form.elements.name.value || '交易所名称')} · 邀请码 ${escape(form.elements.code.value || '未填写')}</p><p>跳转到：${escape(url || '请填写链接')}</p>`; }
    form.addEventListener('input', preview); preview();
    form.onsubmit = async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(form)); data.enabled = form.elements.enabled.checked; data.create = !x; await submit($('button.primary', form), async () => { await api('exchanges', 'POST', data); dirty = false; await refresh(); history.replaceState(null, '', '#exchange/' + data.id); currentHash = location.hash; exchangesPanel(data.id); message('交易所配置已保存，全站推荐入口已更新。'); }); };
  }
  function settingsPanel() {
    const s = state.settings;
    workspace.innerHTML = heading('网站设置', '维护站点信息、搜索展示和社群联系方式。原有首页模板布局保持不变。') +
      `<form id="settings-form"><div class="two-columns"><section class="card"><div class="card-heading"><h2>基础信息</h2></div>${field('name', '网站名称', s.name, 'required maxlength="60"')}${field('tagline', '首页主标题', s.tagline, 'required maxlength="200"')}<label>网站介绍 / 默认 SEO 描述<textarea name="description" rows="5" maxlength="1000">${escape(s.description)}</textarea></label>${field('keywords', 'SEO 关键词', s.keywords, 'maxlength="500" placeholder="用逗号分隔"')}<label>页脚说明<textarea name="footerText" rows="4" maxlength="1000" placeholder="留空使用现有说明">${escape(s.footerText)}</textarea></label></section><section class="card"><div class="card-heading"><h2>联系与社群</h2></div>${field('contact', '公开联系方式', s.contact, 'maxlength="500" placeholder="邮箱或其他公开联系方式"')}${field('telegram', 'Telegram 频道 / 社群', s.social.telegram, 'type="url" placeholder="https://t.me/…"')}${field('x', 'X 主页', s.social.x, 'type="url" placeholder="https://x.com/…"')}${field('wechat', '公众号介绍页', s.social.wechat, 'type="url" placeholder="https://…"')}<p class="hint">联系方式和社群链接将公开展示在网站。这里只填写公开信息；管理员密码继续通过账号设置或服务环境变量管理。</p></section></div><div class="form-actions"><button class="primary">保存网站设置</button></div></form>`;
    $('#settings-form').onsubmit = async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); data.social = { telegram: data.telegram, x: data.x, wechat: data.wechat }; await submit($('button.primary', event.target), async () => { await api('settings', 'PUT', data); dirty = false; await refresh(); message('网站设置已保存，前台已同步。'); }); };
  }
  function backupPanel() {
    pendingBackup = null;
    workspace.innerHTML = heading('备份与恢复', '下载主站内容备份，或从之前导出的备份恢复。') +
      `<div class="two-columns"><section class="card"><div class="card-heading"><h2>导出内容备份</h2><span class="badge">JSON 文件</span></div><p>包含主站文章、草稿、回收站、栏目层级、交易所配置、网站设置，以及秘密花园的编辑内容和栏目。</p><p class="hint">不包含管理员密码、登录会话、天机看盘与 BIT浪浪研究室的数据库或秘密花园上传的图片文件。应用数据与媒体文件需分别备份。</p><div class="backup-actions" style="margin-top:20px"><button class="primary" data-action="export-backup">下载内容备份</button></div></section><section class="card"><div class="card-heading"><h2>从备份恢复</h2></div><div class="notice warning">恢复会替换当前主站的文章和设置。请先下载当前备份，再选择可信的本站备份文件。</div><label>选择备份文件<input id="backup-file" type="file" accept=".json,application/json"></label><div id="backup-preview" hidden></div><button class="danger" data-action="restore-backup" disabled>确认恢复备份</button></section></div><section class="card"><h2>数据保存说明</h2><p class="hint">内容保存在服务器数据库。Render 免费实例重新部署或重建时，本地文件可能丢失。正式运营请配置持久磁盘并定期下载备份；内容备份不能代替两个应用数据库的完整备份。</p></section>`;
    $('#backup-file').onchange = async event => {
      pendingBackup = null; $('[data-action="restore-backup"]').disabled = true;
      const file = event.target.files[0]; if (!file) return;
      try { if (file.size > 16 * 1024 * 1024) throw Error('备份文件不能超过 16MB'); const value = JSON.parse(await file.text()); if (value.format !== 'portal-content' || value.version !== 1 || !Array.isArray(value.articles) || !Array.isArray(value.categories)) throw Error('不是本站支持的备份文件'); pendingBackup = value; $('#backup-preview').hidden = false; $('#backup-preview').textContent = `备份时间：${value.exportedAt || '未知'}\n文章：${value.articles.length} 篇\n栏目：${value.categories.length} 个\n交易所：${value.settings?.exchanges?.length || 0} 个`; $('[data-action="restore-backup"]').disabled = false; }
      catch (error) { message(error.message, true); }
    };
  }
  async function submit(button, work) { if (button) button.disabled = true; try { await work(); } catch (error) { message(error.message, true); } finally { if (button?.isConnected) button.disabled = false; } }
  function markDirty() { dirty = true; if ($('#dirty-mark')) $('#dirty-mark').hidden = false; }
  function route() {
    const hash = location.hash || '#overview';
    if (dirty && hash !== currentHash && !confirm('当前修改尚未保存，确定离开吗？')) { history.replaceState(null, '', currentHash || '#overview'); return; }
    dirty = false; currentHash = hash; message('');
    const [panel, id] = hash.slice(1).split('/');
    const section = ({ article: 'articles', category: 'categories', exchange: 'exchanges' })[panel] || panel;
    $$('[data-panel]').forEach(a => a.classList.toggle('active', a.dataset.panel === section));
    $('#panel-title').textContent = ({ overview: '工作台', articles: '文章管理', categories: '栏目管理', exchanges: '交易所管理', settings: '网站设置', backup: '备份与恢复', garden: '秘密花园' })[section] || '工作台';
    if (panel === 'garden') {window.GardenAdmin.render({workspace,base,api,message,markDirty,clearDirty:()=>{dirty=false},isDirty:()=>dirty}).catch(error=>message(error.message,true));} else if (panel === 'articles') articlesPanel(); else if (panel === 'article') articleEditor(id || 'new');
    else if (panel === 'categories' || panel === 'category') categoriesPanel(id);
    else if (panel === 'exchanges' || panel === 'exchange') exchangesPanel(id);
    else if (panel === 'settings') settingsPanel(); else if (panel === 'backup') backupPanel(); else overview();
    window.scrollTo({top: 0, behavior: 'instant'});
  }
  const login = $('#login');
  if (login) { login.onsubmit = async event => { event.preventDefault(); await submit($('button', login), async () => { await api('login', 'POST', Object.fromEntries(new FormData(login))); location.reload(); }); }; return; }
  if (!workspace) return;
  $('#logout').onclick = async () => { if (dirty && !confirm('修改尚未保存，确定退出登录吗？')) return; await submit($('#logout'), async () => { await api('logout', 'POST', {}); dirty = false; location.reload(); }); };
  workspace.addEventListener('input', event => { if (event.target.closest('form') && event.target.id !== 'garden-image-query') markDirty(); });
  workspace.addEventListener('change', event => { if (event.target.closest('form') && event.target.id !== 'garden-image-query') markDirty(); });
  document.addEventListener('click', event => { const a = event.target.closest('a'); if (a && !a.hash && a.target !== '_blank' && dirty && !confirm('当前修改尚未保存，确定离开吗？')) event.preventDefault(); });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('hashchange', route);
  workspace.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const action = button.dataset.action, id = button.dataset.id;
    if (action === 'add-section') { $('#sections').insertAdjacentHTML('beforeend', sectionMarkup({}, $$('.section-editor').length)); markDirty(); return; }
    if (action === 'section-delete') { if ($$('.section-editor').length === 1) { message('请至少保留一个章节。', true); return; } if (confirm('移除这个章节？保存文章后生效。')) { button.closest('.section-editor').remove(); markDirty(); } return; }
    if (action === 'section-up' || action === 'section-down') { const el = button.closest('.section-editor'); const next = action === 'section-up' ? el.previousElementSibling : el.nextElementSibling; if (next) { if (action === 'section-up') next.before(el); else next.after(el); markDirty(); } return; }
    if (action === 'add-link') { $('.section-links', button.closest('.section-editor')).insertAdjacentHTML('beforeend', linkMarkup()); markDirty(); return; }
    if (action === 'delete-link') { button.closest('.link-editor').remove(); markDirty(); return; }
    if (action === 'preview-article') { const preview = $('#body-preview'); preview.hidden = false; preview.innerHTML = `<h2>${escape($('#editor').elements.title.value || '文章标题')}</h2>` + sectionsData().map(s => `<h2>${escape(s.heading)}</h2><p>${escape(s.text)}</p>${s.image.startsWith('https://') ? `<img src="${escape(s.image)}" alt="${escape(s.heading)}">` : ''}${s.links.map(l => `<p>${escape(l.label)}：${escape(l.href)}</p>`).join('')}`).join(''); preview.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    if (action === 'prev-page' || action === 'next-page') { articlePage += action === 'prev-page' ? -1 : 1; articleTable(); return; }
    await submit(button, async () => {
      if (action === 'bulk' || action === 'trash-article' || action === 'restore-article') {
        const operation = action === 'bulk' ? $('#bulk-action').value : action === 'trash-article' ? 'trash' : 'restore';
        const slugs = action === 'bulk' ? [...selected] : [id];
        if (!operation || !slugs.length) throw Error('请先选择文章和操作');
        if (!confirm(`将对 ${slugs.length} 篇文章执行“${({ publish: '发布', draft: '下架为草稿', move: '移动栏目', trash: '移入回收站', restore: '恢复草稿' })[operation]}”，确认继续？`)) return;
        const result = await api('articles/bulk', 'POST', { slugs, action: operation, category: $('#bulk-category').value }); selected.clear(); await refresh(); articlesPanel(); message('已处理 ' + result.count + ' 篇文章。');
      } else if (action === 'delete-category' || action === 'delete-exchange') {
        if (!confirm('确认删除？仍有内容关联时系统会阻止删除。')) return;
        await api(action === 'delete-category' ? 'categories' : 'exchanges', 'DELETE', { id }); dirty = false; await refresh(); history.replaceState(null, '', action === 'delete-category' ? '#categories' : '#exchanges'); route(); message('已删除。');
      } else if (action === 'export-backup') {
        const backup = await api('backup'); const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = '网站内容备份-' + today() + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('备份已生成，请妥善保存下载文件。');
      } else if (action === 'restore-backup') {
        if (!pendingBackup || !confirm('恢复将覆盖当前主站内容和配置。请确认已经备份当前数据，继续恢复吗？')) return;
        await api('backup', 'POST', pendingBackup); await refresh(); backupPanel(); message('备份恢复完成，前台已同步。');
      }
    });
  });
  refresh().then(route).catch(error => message(error.message, true));
})();
