/* Shahnoza Market — Telegram Mini App */
(() => {
  const tg = window.Telegram?.WebApp;
  const $ = (s, el = document) => el.querySelector(s);
  const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const haptic = (t = 'light') => { try { tg?.HapticFeedback?.impactOccurred(t); } catch {} };
  const notify = (t = 'success') => { try { tg?.HapticFeedback?.notificationOccurred(t); } catch {} };
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  const QUALITY = {
    premium: { label: 'Premium', icon: '💎' },
    yuqori: { label: 'Yuqori', icon: '⭐' },
    standart: { label: 'Standart', icon: '👍' },
    ekonom: { label: 'Ekonom', icon: '💰' },
  };
  const FLAGS = {
    "o'zbekiston": '🇺🇿', 'uzbekistan': '🇺🇿', 'turkiya': '🇹🇷', 'xitoy': '🇨🇳', 'janubiy koreya': '🇰🇷', 'koreya': '🇰🇷',
    'rossiya': '🇷🇺', 'germaniya': '🇩🇪', 'italiya': '🇮🇹', 'aqsh': '🇺🇸', 'yaponiya': '🇯🇵', 'baa': '🇦🇪', 'hindiston': '🇮🇳',
    'fransiya': '🇫🇷', 'polsha': '🇵🇱', "qozog'iston": '🇰🇿', 'eron': '🇮🇷', 'buyuk britaniya': '🇬🇧', 'ispaniya': '🇪🇸', 'vetnam': '🇻🇳',
  };
  const flag = (c) => FLAGS[String(c || '').toLowerCase().replace(/[‘’ʻʼ`]/g, "'")] || '🌍';
  const STATUS = { new: '🆕 Yangi', accepted: '✅ Qabul qilindi', shipping: '🚚 Yo\'lda', done: '🎉 Yetkazildi', cancelled: '❌ Bekor' };

  let D = null; // server ma'lumotlari
  let cart = store.get('cart', {});
  let favs = new Set(store.get('favs', []));
  const F = { q: '', cat: '', qualities: new Set(), countries: new Set(), min: null, max: null, sale: false, sort: 'default', inStock: false };
  let bannerTimer = null;

  const isAdmin = () => D?.me?.role === 'admin' || D?.me?.role === 'owner';
  const isOwner = () => D?.me?.role === 'owner';
  const money = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/ |,/g, ' ') + ' ' + (D?.settings?.currency || "so'm");
  const prodById = (id) => D.products.find((p) => p.id === id);
  const catById = (id) => D.categories.find((c) => c.id === id);
  const cartCount = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const img0 = (p) => p.images?.[0] || 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#c9bfff"/><text x="5" y="6.8" font-size="5" text-anchor="middle">🛍</text></svg>`);

  // ---------- API ----------
  async function api(path, opts = {}) {
    const headers = { 'X-Init-Data': tg?.initData || '' };
    let body = opts.body;
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    const r = await fetch(path, { method: opts.method || 'GET', headers, body });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Xatolik yuz berdi');
    return j;
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function confirmBox(msg) {
    return new Promise((res) => {
      if (tg?.showConfirm && tg.isVersionAtLeast?.('6.2')) tg.showConfirm(msg, res);
      else res(window.confirm(msg));
    });
  }

  // ---------- Mavzu ----------
  function applyTheme() {
    const dark = tg?.colorScheme ? tg.colorScheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const s = D?.settings;
    if (s) {
      document.documentElement.style.setProperty('--accent', s.accent || '#ff3d7f');
      document.documentElement.style.setProperty('--accent2', s.accent2 || '#7b5cff');
      document.title = s.shopName;
    }
    try {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      tg?.setHeaderColor?.(bg); tg?.setBackgroundColor?.(bg); tg?.setBottomBarColor?.(bg);
    } catch {}
  }

  // ---------- Filtrlash ----------
  function filtered() {
    let list = D.products.filter((p) => p.active !== false);
    const q = F.q.trim().toLowerCase();
    if (q) list = list.filter((p) => [p.title, p.description, p.country, catById(p.categoryId)?.name].join(' ').toLowerCase().includes(q));
    if (F.cat) list = list.filter((p) => p.categoryId === F.cat);
    if (F.qualities.size) list = list.filter((p) => F.qualities.has(p.quality));
    if (F.countries.size) list = list.filter((p) => F.countries.has(p.country));
    if (F.min != null) list = list.filter((p) => p.price >= F.min);
    if (F.max != null) list = list.filter((p) => p.price <= F.max);
    if (F.sale) list = list.filter((p) => p.oldPrice && p.oldPrice > p.price);
    if (F.inStock) list = list.filter((p) => p.stock == null || p.stock > 0);
    const sorters = {
      cheap: (a, b) => a.price - b.price, expensive: (a, b) => b.price - a.price,
      new: (a, b) => (b.createdAt || 0) - (a.createdAt || 0), popular: (a, b) => (b.sold || 0) - (a.sold || 0),
    };
    if (sorters[F.sort]) list = [...list].sort(sorters[F.sort]);
    return list;
  }
  const filterCount = () => F.qualities.size + F.countries.size + (F.min != null) + (F.max != null) + F.sale + F.inStock + (F.sort !== 'default');
  const anyFilter = () => !!(F.q || F.cat || filterCount());
  function resetFilters() { Object.assign(F, { q: '', cat: '', min: null, max: null, sale: false, sort: 'default', inStock: false }); F.qualities.clear(); F.countries.clear(); }
  const countries = () => [...new Set(D.products.map((p) => p.country).filter(Boolean))].sort();
  const priceBounds = () => {
    const ps = D.products.map((p) => p.price);
    return [0, Math.ceil(Math.max(100000, ...ps) / 10000) * 10000];
  };

  // Banner / tugma harakatlari
  function runAction(action) {
    haptic();
    const [type, ...rest] = String(action || '').split(':');
    const val = rest.join(':');
    if (type === 'url' && val) return tg?.openLink ? (/t\.me\//.test(val) ? tg.openTelegramLink(val) : tg.openLink(val)) : window.open(val);
    if (type === 'product') return openProduct(val);
    if (type === 'page') return go(val);
    resetFilters();
    if (type === 'filter' && val === 'sale') F.sale = true;
    if (type === 'filter' && val === 'premium') F.qualities.add('premium');
    if (type === 'quality') F.qualities.add(val);
    if (type === 'sort') F.sort = val;
    if (type === 'category') F.cat = val;
    if (type === 'country') F.countries.add(val);
    if (type === 'search') F.q = val;
    if (location.hash.replace('#', '')) go('');
    else render();
    setTimeout(() => $('#results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  // ---------- Komponentlar ----------
  function cardHTML(p, i = 0) {
    const qty = cart[p.id] || 0;
    const sale = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    const q = QUALITY[p.quality];
    const out = p.stock === 0;
    return `<article class="card" style="animation-delay:${Math.min(i, 10) * 40}ms" data-act="open" data-id="${p.id}">
      <div class="ph"><img loading="lazy" src="${h(img0(p))}" alt="">
        <div class="badges">${sale ? `<span class="badge sale">−${sale}%</span>` : ''}${q ? `<span class="badge q-${p.quality}">${q.icon} ${q.label}</span>` : ''}${out ? '<span class="badge off">Tugagan</span>' : ''}${p.active === false ? '<span class="badge off">Yashirin</span>' : ''}</div>
        <button class="heart ${favs.has(p.id) ? 'on' : ''}" data-act="fav" data-id="${p.id}">${favs.has(p.id) ? '❤️' : '🤍'}</button>
      </div>
      <div class="body">
        <div class="meta">${flag(p.country)} ${h(p.country || '')}</div>
        <div class="title">${h(p.title)}</div>
        <div class="price"><b>${money(p.price)}</b>${sale ? `<s>${money(p.oldPrice)}</s>` : ''}</div>
        ${out ? '' : qty ? `<div class="stepper"><button data-act="dec" data-id="${p.id}">−</button><span>${qty}</span><button data-act="inc" data-id="${p.id}">+</button></div>`
          : `<button class="add" data-act="inc" data-id="${p.id}">🛒 Savatga</button>`}
      </div></article>`;
  }

  function emptyHTML(emoji, title, text, btn) {
    return `<div class="empty"><div class="big">${emoji}</div><h3>${title}</h3><p>${text}</p>${btn || ''}</div>`;
  }

  // ---------- Sahifalar ----------
  function pageHome() {
    const s = D.settings;
    const list = filtered();
    const f = anyFilter();
    const activeChips = [];
    if (F.cat) activeChips.push(`<button class="chip x" data-act="rm" data-k="cat">${h(catById(F.cat)?.emoji)} ${h(catById(F.cat)?.name)} ✕</button>`);
    F.qualities.forEach((q) => activeChips.push(`<button class="chip x" data-act="rm" data-k="q" data-v="${q}">${QUALITY[q]?.icon} ${QUALITY[q]?.label} ✕</button>`));
    F.countries.forEach((c) => activeChips.push(`<button class="chip x" data-act="rm" data-k="c" data-v="${h(c)}">${flag(c)} ${h(c)} ✕</button>`));
    if (F.sale) activeChips.push('<button class="chip x" data-act="rm" data-k="sale">🔥 Chegirma ✕</button>');
    if (F.min != null || F.max != null) activeChips.push(`<button class="chip x" data-act="rm" data-k="price">💸 ${F.min != null ? money(F.min) : '0'} – ${F.max != null ? money(F.max) : '∞'} ✕</button>`);

    return `
    <header class="hero">
      <div class="logo">${h((s.shopName || 'S')[0])}</div>
      <div><h1>${h(s.shopName)}</h1><p>${h(s.tagline)}</p></div>
      <div class="spacer"></div>
      <button class="icon-btn" data-act="go" data-to="orders">📦</button>
    </header>
    <div class="search" id="searchbar">
      <label class="search-box">🔍<input id="q" type="search" placeholder="Mahsulot qidirish…" value="${h(F.q)}" enterkeyhint="search"></label>
      <button class="filter-btn" data-act="filters">⚙️${filterCount() ? `<span class="dot">${filterCount()}</span>` : ''}</button>
    </div>
    ${!f && D.banners.length ? `<div class="banners" id="banners">${D.banners.map((b) => `
      <button class="banner" data-act="action" data-a="${h(b.action)}" style="background:${b.image ? `linear-gradient(0deg,rgba(0,0,0,.55),rgba(0,0,0,.05)),url('${h(b.image)}') center/cover` : `linear-gradient(135deg,${h(b.from)},${h(b.to)})`}">
        ${b.emoji ? `<span class="emo">${h(b.emoji)}</span>` : ''}<h3>${h(b.title)}</h3><p>${h(b.subtitle)}</p></button>`).join('')}</div>
      <div class="dots" id="bdots">${D.banners.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
    ${D.categories.length ? `<div class="section-title"><h2>Bo'limlar</h2><button data-act="go" data-to="catalog">Barchasi →</button></div>
    <div class="cats">${D.categories.map((c) => `<button class="cat ${F.cat === c.id ? 'on' : ''}" style="--c:${h(c.color)}" data-act="cat" data-id="${c.id}"><span class="orb">${h(c.emoji)}</span>${h(c.name)}</button>`).join('')}</div>` : ''}
    <div class="chips">${activeChips.length ? activeChips.join('') + '<button class="chip" data-act="reset">Tozalash</button>'
      : D.appButtons.map((b) => `<button class="chip" data-act="action" data-a="${h(b.action)}">${h(b.emoji)} ${h(b.label)}</button>`).join('')}</div>
    <div class="section-title" id="results"><h2>${f ? `Topildi: ${list.length}` : 'Siz uchun'}</h2>
      <button data-act="sort">${{ default: '↕️ Saralash', cheap: '⬆️ Arzonroq', expensive: '⬇️ Qimmatroq', new: '✨ Yangi', popular: '🏆 Ommabop' }[F.sort]}</button></div>
    ${list.length ? `<div class="grid">${list.map(cardHTML).join('')}</div>`
      : emptyHTML('🔎', 'Hech narsa topilmadi', 'Boshqa so\'z yoki filtrni sinab ko\'ring', '<br><button class="btn ghost sm" data-act="reset" style="max-width:200px;margin:auto">Filtrlarni tozalash</button>')}`;
  }

  function pageCatalog() {
    return `<div class="page-title"><h1>Bo'limlar</h1></div>
    <div class="tiles">${D.categories.map((c) => {
      const n = D.products.filter((p) => p.categoryId === c.id && p.active !== false).length;
      return `<button class="tile" style="--c:${h(c.color)}" data-act="cat" data-id="${c.id}"><span class="ic" style="font-size:26px">${h(c.emoji)}</span><b>${h(c.name)}</b><small>${n} ta mahsulot</small></button>`;
    }).join('')}</div>
    <div class="section-title"><h2>Ishlab chiqarilgan davlat</h2></div>
    <div class="f-chips">${countries().map((c) => `<button class="chip" data-act="action" data-a="country:${h(c)}">${flag(c)} ${h(c)}</button>`).join('')}</div>
    <div class="section-title"><h2>Sifat bo'yicha</h2></div>
    <div class="f-chips">${Object.entries(QUALITY).map(([k, q]) => `<button class="chip" data-act="action" data-a="quality:${k}">${q.icon} ${q.label}</button>`).join('')}</div>`;
  }

  function pageFav() {
    const list = D.products.filter((p) => favs.has(p.id));
    return `<div class="page-title"><h1>Saralanganlar</h1></div>
    ${list.length ? `<div class="grid">${list.map(cardHTML).join('')}</div>` : emptyHTML('💝', 'Hali hech narsa yo\'q', 'Yoqqan mahsulotdagi 🤍 belgisini bosing')}`;
  }

  function pageCart() {
    const items = Object.entries(cart).map(([id, qty]) => ({ p: prodById(id), qty })).filter((x) => x.p);
    if (!items.length) return `<div class="page-title"><h1>Savat</h1></div>${emptyHTML('🛒', 'Savat bo\'sh', 'Do\'kondan o\'zingizga yoqqanini tanlang', '<br><button class="btn primary sm" data-act="go" data-to="" style="max-width:220px;margin:auto">Xarid qilish</button>')}`;
    const total = items.reduce((s, x) => s + x.p.price * x.qty, 0);
    const old = items.reduce((s, x) => s + (x.p.oldPrice > x.p.price ? x.p.oldPrice : x.p.price) * x.qty, 0);
    return `<div class="page-title"><h1>Savat</h1><button class="chip" data-act="clear-cart">🗑 Tozalash</button></div>
    ${items.map(({ p, qty }) => `<div class="cart-item"><img src="${h(img0(p))}" data-act="open" data-id="${p.id}" alt="">
      <div class="info"><div class="t">${h(p.title)}</div><div class="price"><b>${money(p.price * qty)}</b></div>
      <div class="stepper"><button data-act="dec" data-id="${p.id}">−</button><span>${qty}</span><button data-act="inc" data-id="${p.id}">+</button></div></div></div>`).join('')}
    <div class="summary">
      <div class="l"><span>Mahsulotlar (${cartCount()})</span><span>${money(old)}</span></div>
      ${old > total ? `<div class="l" style="color:#10b981"><span>Chegirma</span><span>−${money(old - total)}</span></div>` : ''}
      <div class="l total"><span>Jami</span><span>${money(total)}</span></div>
    </div>
    <button class="btn primary" data-act="checkout">✨ Buyurtma berish</button>`;
  }

  async function pageOrders() {
    const list = await api('/api/orders/my');
    return `<div class="page-title"><h1>Buyurtmalarim</h1></div>
    ${list.length ? list.map(orderHTML).join('') : emptyHTML('📦', 'Buyurtmalar yo\'q', 'Birinchi buyurtmangizni bering!')}`;
  }
  function orderHTML(o, admin) {
    return `<div class="order"><div class="top"><b>#${o.no}</b><span class="st ${o.status}">${STATUS[o.status]}</span></div>
      <div class="items">${o.items.map((i) => `${h(i.title)} × ${i.qty}`).join('<br>')}</div>
      <div class="top" style="margin:10px 0 0"><small style="color:var(--muted)">${new Date(o.createdAt).toLocaleString('ru-RU')}</small><b>${money(o.total)}</b></div>
      ${admin ? `<div class="items" style="margin-top:8px">👤 ${h(o.name)} ${o.username ? '@' + h(o.username) : ''}<br>📞 ${h(o.phone)}${o.address ? '<br>📍 ' + h(o.address) : ''}${o.comment ? '<br>💬 ' + h(o.comment) : ''}</div>
      <div class="f-chips" style="margin-top:10px">${Object.entries(STATUS).map(([k, v]) => `<button class="chip ${o.status === k ? 'on' : ''}" data-act="ord-st" data-id="${o.id}" data-st="${k}">${v}</button>`).join('')}</div>` : ''}
    </div>`;
  }

  // ---------- Admin ----------
  const ADMIN_TILES = [
    ['products', '📦', 'Mahsulotlar', '#ff3d7f'], ['categories', '🗂', 'Bo\'limlar', '#7b5cff'],
    ['orders', '🧾', 'Buyurtmalar', '#10b981'], ['banners', '🎨', 'Bannerlar', '#f59e0b'],
    ['appButtons', '🔘', 'App tugmalari', '#22d3ee'], ['botButtons', '🤖', 'Bot tugmalari', '#3b82f6'],
    ['settings', '🎛', 'Sozlamalar', '#64748b'],
  ];
  async function pageAdmin(sub) {
    if (!isAdmin()) return emptyHTML('🔒', 'Ruxsat yo\'q', 'Bu bo\'lim faqat adminlar uchun');
    if (sub) return adminSub(sub);
    const st = await api('/api/admin/stats');
    const tiles = [...ADMIN_TILES, ...(isOwner() ? [['admins', '👑', 'Adminlar', '#eab308']] : [])];
    return `<div class="admin-hero"><small>${isOwner() ? '👑 Do\'kon egasi' : '🛡 Admin'}</small><h1>Salom, ${h(D.me.name)}!</h1></div>
    <div class="stats">
      <div class="stat"><small>Daromad</small><b>${money(st.revenue)}</b></div>
      <div class="stat"><small>Yangi buyurtmalar</small><b>${st.newOrders} / ${st.orders}</b></div>
      <div class="stat"><small>Foydalanuvchilar</small><b>${st.users}</b></div>
      <div class="stat"><small>Mahsulotlar</small><b>${st.products}</b></div>
    </div>
    <div class="section-title"><h2>Boshqaruv</h2></div>
    <div class="tiles">${tiles.map(([k, ic, t, c]) => `<button class="tile" style="--c:${c}" data-act="go" data-to="admin/${k}"><span class="ic">${ic}</span><b>${t}</b></button>`).join('')}</div>`;
  }

  const COLS = {
    products: { title: 'Mahsulotlar', icon: '📦', row: (p) => [img0(p), p.title, `${money(p.price)} · ${QUALITY[p.quality]?.icon || ''} ${flag(p.country)}${p.active === false ? ' · yashirin' : ''}${p.stock != null ? ' · ' + p.stock + ' dona' : ''}`] },
    categories: { title: 'Bo\'limlar', icon: '🗂', row: (c) => [null, c.name, `${D.products.filter((p) => p.categoryId === c.id).length} ta mahsulot`, c.emoji] },
    banners: { title: 'Bannerlar', icon: '🎨', row: (b) => [b.image || null, b.title, b.subtitle, b.emoji || '🎨'] },
    appButtons: { title: 'App tugmalari', icon: '🔘', row: (b) => [null, b.label, actionLabel(b.action), b.emoji || '🔘'] },
    botButtons: { title: 'Bot tugmalari', icon: '🤖', row: (b) => [null, b.text, `Qator ${b.row + 1} · ${{ webapp: 'Mini App', url: 'Havola', text: 'Matn javob' }[b.type]}`, '⌨️'] },
  };
  function actionLabel(a) {
    const [t, ...r] = String(a || '').split(':'); const v = r.join(':');
    return ({
      filter: v === 'sale' ? 'Chegirmalar' : 'Premium', sort: v === 'new' ? 'Yangilar' : v === 'popular' ? 'Ommabop' : 'Saralash',
      category: 'Bo\'lim: ' + (catById(v)?.name || ''), country: 'Davlat: ' + v, quality: 'Sifat: ' + (QUALITY[v]?.label || v),
      url: 'Havola', search: 'Qidiruv: ' + v, product: 'Mahsulot: ' + (prodById(v)?.title || ''), page: 'Sahifa',
    })[t] || 'Harakat yo\'q';
  }

  async function adminSub(sub) {
    const back = '<button class="back" data-act="go" data-to="admin">← Panel</button>';
    if (sub === 'orders') {
      const list = await api('/api/admin/orders');
      return `${back}<div class="page-title"><h1>Buyurtmalar</h1></div>${list.length ? list.map((o) => orderHTML(o, true)).join('') : emptyHTML('🧾', 'Buyurtmalar yo\'q', 'Hali hech kim buyurtma bermadi')}`;
    }
    if (sub === 'settings') return back + settingsHTML();
    if (sub === 'admins') {
      if (!isOwner()) return emptyHTML('🔒', 'Faqat ega uchun', '');
      const users = await api('/api/owner/users');
      const adminIds = new Set(D.admins.map((a) => Number(a.id)));
      return `${back}<div class="page-title"><h1>Adminlar</h1></div>
      <p class="hint">Adminlar mahsulot, bo'lim, banner, tugmalar va buyurtmalarni boshqara oladi. Adminlarni faqat siz (ega) tayinlaysiz.</p>
      ${D.admins.length ? D.admins.map((a) => `<div class="list-item"><span class="thumb">🛡</span><div class="info"><b>${h(a.name || 'Admin')}</b><small>${a.username ? '@' + h(a.username) + ' · ' : ''}${a.id}</small></div>
        <div class="acts"><button class="mini del" data-act="rm-admin" data-id="${a.id}">🗑</button></div></div>`).join('') : '<p class="hint">Hozircha admin yo\'q.</p>'}
      <div class="section-title"><h2>ID orqali qo'shish</h2></div>
      <div class="row"><input class="input" id="new-admin" inputmode="numeric" placeholder="Telegram ID, masalan 123456789"><button class="btn primary sm" style="flex:0 0 110px" data-act="add-admin">Qo'shish</button></div>
      <p class="hint" style="margin-top:8px">ID ni bilish uchun u odam botga <b>/id</b> deb yozsin.</p>
      <div class="section-title"><h2>Bot foydalanuvchilari</h2></div>
      ${users.filter((u) => Number(u.id) !== Number(D.me.id)).map((u) => `<div class="list-item"><span class="thumb">👤</span><div class="info"><b>${h(u.name || 'Foydalanuvchi')}</b><small>${u.username ? '@' + h(u.username) + ' · ' : ''}${u.id}</small></div>
        <div class="acts">${adminIds.has(Number(u.id)) ? '<span class="st accepted">Admin</span>' : `<button class="chip" data-act="make-admin" data-id="${u.id}" data-name="${h(u.name)}">🛡 Admin qilish</button>`}</div></div>`).join('') || '<p class="hint">Hali hech kim botga /start bosmagan.</p>'}`;
    }
    const cfg = COLS[sub];
    if (!cfg) return emptyHTML('🤷', 'Topilmadi', '');
    const list = D[sub];
    let extra = '';
    if (sub === 'botButtons') {
      const rows = [];
      list.forEach((b) => (rows[b.row] = rows[b.row] || []).push(b));
      extra = `<p class="hint">Bot pastidagi menyu ko'rinishi. O'zgarishlar foydalanuvchilarda /start yoki /refresh dan keyin yangilanadi.</p>
      <div class="kb-preview">${rows.filter(Boolean).map((r) => `<div class="r">${r.map((b) => `<span class="k">${h(b.text)}</span>`).join('')}</div>`).join('') || '<small>Tugma yo\'q</small>'}</div>`;
    }
    if (sub === 'appButtons') extra = '<p class="hint">Bosh sahifadagi tezkor tugmalar (chiplar).</p>';
    return `${back}<div class="page-title"><h1>${cfg.title}</h1><button class="chip on" data-act="edit" data-col="${sub}">＋ Qo'shish</button></div>${extra}
    ${list.map((it, i) => {
      const [im, t, s, e] = cfg.row(it);
      return `<div class="list-item">${im ? `<img class="thumb" src="${h(im)}" alt="">` : `<span class="thumb">${h(e || cfg.icon)}</span>`}
        <div class="info"><b>${h(t)}</b><small>${h(s)}</small></div>
        <div class="acts">${i ? `<button class="mini" data-act="up" data-col="${sub}" data-id="${it.id}">↑</button>` : ''}
        <button class="mini" data-act="edit" data-col="${sub}" data-id="${it.id}">✏️</button>
        <button class="mini del" data-act="del" data-col="${sub}" data-id="${it.id}">🗑</button></div></div>`;
    }).join('') || emptyHTML(cfg.icon, 'Bo\'sh', 'Yangi qo\'shing')}`;
  }

  const SWATCHES = ['#ff3d7f', '#7b5cff', '#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#111827', '#a855f7'];
  function settingsHTML() {
    const s = D.settings;
    return `<div class="page-title"><h1>Sozlamalar</h1></div>
    <form id="settings-form">
      ${field('shopName', 'Do\'kon nomi', s.shopName)}${field('tagline', 'Shior', s.tagline)}${field('currency', 'Valyuta', s.currency)}
      <div class="field"><label>Asosiy rang</label><div class="swatches" data-sw="accent">${SWATCHES.map((c) => `<button type="button" class="${s.accent === c ? 'on' : ''}" style="background:${c}" data-act="sw" data-k="accent" data-c="${c}"></button>`).join('')}</div></div>
      <div class="field"><label>Ikkinchi rang</label><div class="swatches" data-sw="accent2">${SWATCHES.map((c) => `<button type="button" class="${s.accent2 === c ? 'on' : ''}" style="background:${c}" data-act="sw" data-k="accent2" data-c="${c}"></button>`).join('')}</div></div>
      <input type="hidden" name="accent" value="${h(s.accent)}"><input type="hidden" name="accent2" value="${h(s.accent2)}">
      ${field('welcomeText', 'Botdagi salomlashish matni (/start)', s.welcomeText, 'textarea')}
      <p class="hint">&lt;b&gt;qalin&lt;/b&gt;, &lt;i&gt;qiya&lt;/i&gt; yozish mumkin.</p>
      ${field('orderNote', 'Buyurtmadan keyingi xabar', s.orderNote, 'textarea')}
      <button class="btn primary" type="submit">💾 Saqlash</button>
    </form>`;
  }
  function field(name, label, val, type = 'text', extra = '') {
    if (type === 'textarea') return `<div class="field"><label>${label}</label><textarea name="${name}" ${extra}>${h(val)}</textarea></div>`;
    return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${h(val ?? '')}" ${extra}></div>`;
  }
  function select(name, label, val, opts) {
    return `<div class="field"><label>${label}</label><select name="${name}">${opts.map(([v, t]) => `<option value="${h(v)}" ${String(v) === String(val ?? '') ? 'selected' : ''}>${h(t)}</option>`).join('')}</select></div>`;
  }

  // Harakat (action) tanlovchi: banner va app tugmalari uchun
  function actionPicker(val) {
    const [t, ...r] = String(val || '').split(':'); const v = r.join(':');
    const types = [['', '— Hech narsa —'], ['filter:sale', '🔥 Chegirmalar'], ['filter:premium', '💎 Premium'], ['sort:new', '✨ Yangilar'], ['sort:popular', '🏆 Ommabop'],
      ['category', '🗂 Bo\'lim'], ['country', '🌍 Davlat'], ['quality', '⭐ Sifat'], ['search', '🔍 Qidiruv so\'zi'], ['product', '📦 Mahsulot'], ['url', '🔗 Havola']];
    const cur = ['filter', 'sort'].includes(t) ? val : t;
    return `${select('actType', 'Bosilganda nima bo\'lsin?', cur, types)}<div id="act-val">${actionValue(cur, v)}</div>`;
  }
  function actionValue(t, v) {
    if (t === 'category') return select('actVal', 'Qaysi bo\'lim', v, D.categories.map((c) => [c.id, `${c.emoji} ${c.name}`]));
    if (t === 'quality') return select('actVal', 'Qaysi sifat', v, Object.entries(QUALITY).map(([k, q]) => [k, `${q.icon} ${q.label}`]));
    if (t === 'product') return select('actVal', 'Qaysi mahsulot', v, D.products.map((p) => [p.id, p.title]));
    if (t === 'country') return field('actVal', 'Davlat nomi', v, 'text', 'list="countries"') + `<datalist id="countries">${countries().map((c) => `<option value="${h(c)}">`).join('')}</datalist>`;
    if (t === 'search') return field('actVal', 'Qidiruv so\'zi', v);
    if (t === 'url') return field('actVal', 'Havola (https://...)', v, 'url');
    return '';
  }

  function editForm(col, it = {}) {
    const isNew = !it.id;
    let body = '';
    if (col === 'products') {
      body = `${field('title', 'Nomi *', it.title, 'text', 'required')}
      ${select('categoryId', 'Bo\'lim', it.categoryId, D.categories.map((c) => [c.id, `${c.emoji} ${c.name}`]))}
      <div class="row">${field('price', 'Narxi *', it.price, 'number', 'required min="0" inputmode="numeric"')}${field('oldPrice', 'Eski narx (chegirma)', it.oldPrice, 'number', 'min="0" inputmode="numeric"')}</div>
      <div class="row">${select('quality', 'Sifat', it.quality || 'standart', Object.entries(QUALITY).map(([k, q]) => [k, `${q.icon} ${q.label}`]))}
      ${field('stock', 'Soni (bo\'sh = cheksiz)', it.stock, 'number', 'min="0" inputmode="numeric"')}</div>
      ${field('country', 'Ishlab chiqarilgan davlat', it.country, 'text', 'list="countries"')}
      <datalist id="countries">${[...new Set([...countries(), "O'zbekiston", 'Turkiya', 'Xitoy', 'Janubiy Koreya', 'Rossiya', 'Italiya', 'Fransiya', 'Germaniya', 'AQSh', 'BAA'])].map((c) => `<option value="${h(c)}">`).join('')}</datalist>
      ${field('description', 'Tavsif', it.description, 'textarea')}
      <div class="field"><label>Rasmlar</label><div class="img-picker" id="imgs"></div></div>
      <p class="hint">Telefoningizdan rasm yuklang yoki havolani qo'ying.</p>
      <div class="row" style="margin-bottom:12px"><input class="input" id="img-url" placeholder="Rasm havolasi (ixtiyoriy)"><button type="button" class="btn ghost sm" style="flex:0 0 80px" data-act="img-url">＋</button></div>
      <label class="switch">Do'konda ko'rinsin <input type="checkbox" name="active" ${it.active !== false ? 'checked' : ''}></label>`;
    } else if (col === 'categories') {
      body = `${field('name', 'Bo\'lim nomi *', it.name, 'text', 'required')}${field('emoji', 'Emoji', it.emoji || '🛍')}
      <div class="field"><label>Rang</label><div class="swatches">${SWATCHES.map((c) => `<button type="button" class="${(it.color || '#7b5cff') === c ? 'on' : ''}" style="background:${c}" data-act="sw" data-k="color" data-c="${c}"></button>`).join('')}</div></div>
      <input type="hidden" name="color" value="${h(it.color || '#7b5cff')}">`;
    } else if (col === 'banners') {
      body = `${field('title', 'Sarlavha *', it.title, 'text', 'required')}${field('subtitle', 'Qo\'shimcha matn', it.subtitle)}${field('emoji', 'Emoji', it.emoji)}
      <div class="row"><div class="field"><label>Rang 1</label><input name="from" type="color" value="${h(it.from || '#ff3d7f')}" style="height:52px;padding:4px"></div>
      <div class="field"><label>Rang 2</label><input name="to" type="color" value="${h(it.to || '#7b5cff')}" style="height:52px;padding:4px"></div></div>
      <div class="field"><label>Fon rasmi (ixtiyoriy)</label><div class="img-picker" id="imgs"></div></div>
      ${actionPicker(it.action)}`;
    } else if (col === 'appButtons') {
      body = `${field('label', 'Tugma matni *', it.label, 'text', 'required')}${field('emoji', 'Emoji', it.emoji)}${actionPicker(it.action)}`;
    } else if (col === 'botButtons') {
      body = `${field('text', 'Tugma matni *', it.text, 'text', 'required maxlength="60"')}
      ${select('type', 'Turi', it.type || 'text', [['text', '💬 Matn bilan javob beradi'], ['webapp', '📱 Mini App sahifasini ochadi'], ['url', '🔗 Havolani ochadi']])}
      <div id="bb-val">${botBtnValue(it.type || 'text', it.value)}</div>
      ${field('row', 'Qator raqami (bir qatorda bir nechta tugma bo\'lishi mumkin)', (it.row ?? 0) + 1, 'number', 'min="1" max="20"')}`;
    }
    openSheet(`<h2>${isNew ? 'Yangi' : 'Tahrirlash'}: ${COLS[col].title.toLowerCase()}</h2>
      <form id="edit-form" data-col="${col}" data-id="${it.id || ''}">${body}<br><button class="btn primary" type="submit">💾 Saqlash</button></form>`);
    const form = $('#edit-form');
    form._images = col === 'banners' ? (it.image ? [it.image] : []) : [...(it.images || [])];
    form._single = col === 'banners';
    if ($('#imgs')) renderImgs();
  }
  function botBtnValue(type, v) {
    if (type === 'webapp') return select('value', 'Qaysi sahifa', v, [['', '🏠 Bosh sahifa'], ['catalog', '🗂 Bo\'limlar'], ['cart', '🛒 Savat'], ['fav', '❤️ Saralanganlar'], ['orders', '📦 Buyurtmalarim']]);
    if (type === 'url') return field('value', 'Havola (https://...)', v, 'url', 'required');
    return field('value', 'Javob matni', v, 'textarea');
  }
  function renderImgs() {
    const form = $('#edit-form'); const box = $('#imgs');
    box.innerHTML = form._images.map((u, i) => `<div class="im"><img src="${h(u)}" alt=""><button type="button" data-act="rm-img" data-i="${i}">✕</button></div>`).join('')
      + (form._single && form._images.length ? '' : `<label class="add-im">📷<input type="file" accept="image/*" hidden id="file"></label>`);
    const file = $('#file');
    if (file) file.onchange = async () => {
      if (!file.files[0]) return;
      const fd = new FormData(); fd.append('file', file.files[0]);
      toast('Yuklanmoqda…');
      try { const r = await api('/api/admin/upload', { method: 'POST', body: fd }); form._images.push(r.url); renderImgs(); toast('Rasm qo\'shildi ✅'); } catch (e) { toast(e.message); }
    };
  }

  async function saveForm(form) {
    const col = form.dataset.col; const id = form.dataset.id;
    const fd = Object.fromEntries(new FormData(form).entries());
    if (col === 'products') { fd.images = form._images; fd.active = !!form.querySelector('[name=active]').checked; }
    if (col === 'banners') fd.image = form._images[0] || '';
    if (col === 'botButtons') fd.row = Number(fd.row || 1) - 1;
    if ('actType' in fd) {
      const t = fd.actType; fd.action = !t ? '' : t.includes(':') ? t : `${t}:${fd.actVal || ''}`;
      delete fd.actType; delete fd.actVal;
    }
    try {
      const item = await api(`/api/admin/${col}${id ? '/' + id : ''}`, { method: id ? 'PUT' : 'POST', body: fd });
      if (id) D[col] = D[col].map((x) => (x.id === id ? item : x)); else D[col].push(item);
      notify(); toast('Saqlandi ✅'); closeSheet(); render();
    } catch (e) { notify('error'); toast(e.message); }
  }

  // ---------- Bottom sheet ----------
  function openSheet(html) {
    closeSheet(true);
    $('#sheet-root').innerHTML = `<div class="sheet-back" data-act="close"></div><div class="sheet"><div class="grabber"></div><button class="close" data-act="close">✕</button>${html}</div>`;
    document.body.style.overflow = 'hidden';
    tgBack();
  }
  function closeSheet(instant) {
    const root = $('#sheet-root');
    if (!root.innerHTML) return;
    document.body.style.overflow = '';
    if (instant === true) { root.innerHTML = ''; return; }
    root.querySelector('.sheet')?.classList.add('closing'); root.querySelector('.sheet-back')?.classList.add('closing');
    setTimeout(() => { root.innerHTML = ''; tgBack(); }, 230);
  }
  const sheetOpen = () => !!$('#sheet-root').innerHTML;

  function openProduct(id) {
    const p = prodById(id); if (!p) return;
    haptic();
    const sale = p.oldPrice > p.price;
    const cat = catById(p.categoryId);
    const q = QUALITY[p.quality];
    openSheet(`<div class="gallery">${(p.images?.length ? p.images : [img0(p)]).map((u) => `<img src="${h(u)}" alt="">`).join('')}</div>
      <div class="pd-head"><div class="meta" style="color:var(--muted);font-weight:700;font-size:12px;margin-bottom:6px">${cat ? h(cat.emoji + ' ' + cat.name) : ''}</div>
      <h2>${h(p.title)}</h2><div class="pd-price"><b>${money(p.price)}</b>${sale ? `<s>${money(p.oldPrice)}</s> <span class="badge sale">−${Math.round((1 - p.price / p.oldPrice) * 100)}%</span>` : ''}</div></div>
      <div class="specs"><div class="spec"><small>Sifat</small><b>${q ? q.icon + ' ' + q.label : '—'}</b></div>
      <div class="spec"><small>Davlat</small><b>${flag(p.country)} ${h(p.country || '—')}</b></div>
      <div class="spec"><small>Mavjud</small><b>${p.stock == null ? '✅ Bor' : p.stock > 0 ? p.stock + ' dona' : '❌ Yo\'q'}</b></div></div>
      ${p.description ? `<div class="desc">${h(p.description)}</div><br>` : ''}
      <div class="row"><button class="btn ghost" style="flex:0 0 54px" data-act="fav" data-id="${p.id}">${favs.has(p.id) ? '❤️' : '🤍'}</button>
      ${p.stock === 0 ? '<button class="btn ghost" disabled>Tugagan</button>' : `<button class="btn primary" data-act="buy" data-id="${p.id}">🛒 Savatga qo'shish</button>`}</div>
      ${isAdmin() ? `<br><button class="btn ghost sm" data-act="edit" data-col="products" data-id="${p.id}">✏️ Tahrirlash (admin)</button>` : ''}`);
  }

  function openFilters() {
    const [lo, hi] = priceBounds();
    const min = F.min ?? lo; const max = F.max ?? hi;
    openSheet(`<h2>Filtrlar</h2>
    <div class="f-group"><label>💸 Narx</label>
      <div class="range"><div class="track"></div><div class="fill" id="rfill"></div>
      <input type="range" id="rmin" min="${lo}" max="${hi}" step="1000" value="${min}"><input type="range" id="rmax" min="${lo}" max="${hi}" step="1000" value="${max}"></div>
      <div class="range-vals"><input class="input" id="vmin" inputmode="numeric" value="${min}"><input class="input" id="vmax" inputmode="numeric" value="${max}"></div></div>
    <div class="f-group"><label>⭐ Sifat</label><div class="f-chips">${Object.entries(QUALITY).map(([k, q]) => `<button class="chip ${F.qualities.has(k) ? 'on' : ''}" data-act="fq" data-v="${k}">${q.icon} ${q.label}</button>`).join('')}</div></div>
    <div class="f-group"><label>🌍 Ishlab chiqarilgan davlat</label><div class="f-chips">${countries().map((c) => `<button class="chip ${F.countries.has(c) ? 'on' : ''}" data-act="fc" data-v="${h(c)}">${flag(c)} ${h(c)}</button>`).join('')}</div></div>
    <div class="f-group"><label>↕️ Saralash</label><div class="f-chips">${[['default', 'Odatiy'], ['cheap', '⬆️ Arzonroq'], ['expensive', '⬇️ Qimmatroq'], ['new', '✨ Yangi'], ['popular', '🏆 Ommabop']].map(([k, t]) => `<button class="chip ${F.sort === k ? 'on' : ''}" data-act="fs" data-v="${k}">${t}</button>`).join('')}</div></div>
    <label class="switch">🔥 Faqat chegirmadagilar <input type="checkbox" id="fsale" ${F.sale ? 'checked' : ''}></label>
    <label class="switch">📦 Faqat mavjudlari <input type="checkbox" id="fstock" ${F.inStock ? 'checked' : ''}></label><br>
    <div class="row"><button class="btn ghost" data-act="freset">Tozalash</button><button class="btn primary" data-act="fapply">Ko'rsatish</button></div>`);
    const rmin = $('#rmin'), rmax = $('#rmax'), vmin = $('#vmin'), vmax = $('#vmax'), fill = $('#rfill');
    const paint = () => {
      let a = +rmin.value, b = +rmax.value; if (a > b) [a, b] = [b, a];
      fill.style.left = ((a - lo) / (hi - lo)) * 100 + '%'; fill.style.right = (100 - ((b - lo) / (hi - lo)) * 100) + '%';
      vmin.value = a; vmax.value = b;
    };
    rmin.oninput = rmax.oninput = paint;
    vmin.onchange = () => { rmin.value = vmin.value; paint(); };
    vmax.onchange = () => { rmax.value = vmax.value; paint(); };
    paint();
    openFilters.bounds = [lo, hi];
  }

  function openCheckout() {
    const u = tg?.initDataUnsafe?.user;
    const last = store.get('contact', {});
    openSheet(`<h2>Buyurtmani rasmiylashtirish</h2>
    <form id="checkout">
      ${field('name', 'Ismingiz', last.name || [u?.first_name, u?.last_name].filter(Boolean).join(' '))}
      ${field('phone', 'Telefon raqam *', last.phone || '+998 ', 'tel', 'required')}
      ${field('address', 'Manzil', last.address)}
      ${field('comment', 'Izoh', '', 'textarea', 'placeholder="Masalan: kechqurun olib keling"')}
      <button class="btn primary" type="submit">✅ Tasdiqlash</button></form>`);
  }

  function celebrate(order) {
    openSheet(`<div class="empty" style="padding:30px 0"><div class="big">🎉</div><h3>Buyurtma #${order.no} qabul qilindi!</h3>
      <p>${h(D.settings.orderNote)}</p><br><button class="btn primary" data-act="close-go" data-to="orders">📦 Buyurtmalarim</button></div>`);
    confetti();
  }
  function confetti() {
    const colors = [getComputedStyle(document.documentElement).getPropertyValue('--accent'), getComputedStyle(document.documentElement).getPropertyValue('--accent2'), '#fbbf24', '#22d3ee'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('i');
      Object.assign(c.style, { position: 'fixed', zIndex: 80, left: Math.random() * 100 + 'vw', top: '-12px', width: '8px', height: '14px', borderRadius: '2px', background: colors[i % 4], pointerEvents: 'none' });
      document.body.appendChild(c);
      c.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${(Math.random() - .5) * 200}px, 105vh) rotate(${Math.random() * 900}deg)` }], { duration: 1600 + Math.random() * 1400, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = () => c.remove();
    }
  }

  // ---------- Savat ----------
  function setQty(id, q, fromEl) {
    const p = prodById(id);
    if (p?.stock != null && q > p.stock) { toast(`Faqat ${p.stock} dona bor`); notify('warning'); return; }
    if (q <= 0) delete cart[id]; else cart[id] = q;
    store.set('cart', cart);
    haptic(q > 0 ? 'light' : 'soft');
    if (fromEl && q === 1) flyToCart(fromEl, p);
    render(true);
  }
  function flyToCart(el, p) {
    const target = document.querySelector('#tabbar [data-to="cart"]'); if (!target) return;
    const a = el.getBoundingClientRect(); const b = target.getBoundingClientRect();
    const im = document.createElement('img'); im.className = 'fly'; im.src = img0(p);
    Object.assign(im.style, { left: a.left + a.width / 2 - 23 + 'px', top: a.top - 10 + 'px' });
    document.body.appendChild(im);
    requestAnimationFrame(() => Object.assign(im.style, { left: b.left + b.width / 2 - 12 + 'px', top: b.top + 8 + 'px', width: '24px', height: '24px', opacity: .4 }));
    setTimeout(() => im.remove(), 750);
  }

  // ---------- Router ----------
  const route = () => decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  function go(to) { haptic(); if (route() === to) render(); else location.hash = to ? '#' + to : '#'; }
  function tgBack() {
    const bb = tg?.BackButton; if (!bb) return;
    if (route() || sheetOpen()) bb.show(); else bb.hide();
  }

  function tabbar() {
    const r = route().split('/')[0];
    const tabs = [['', '🏠', 'Asosiy'], ['catalog', '🗂', 'Bo\'limlar'], ['fav', '❤️', 'Sevimli'], ['cart', '🛒', 'Savat']];
    tabs.push(isAdmin() ? ['admin', '⚙️', 'Panel'] : ['orders', '📦', 'Buyurtma']);
    const n = cartCount();
    $('#tabbar').innerHTML = tabs.map(([k, ic, t]) => `<button class="${r === k ? 'on' : ''}" data-act="go" data-to="${k}">${ic}<span>${t}</span>${k === 'cart' && n ? `<b class="dot">${n}</b>` : ''}${k === 'fav' && favs.size ? `<b class="dot">${favs.size}</b>` : ''}</button>`).join('');
  }

  let renderSeq = 0;
  async function render(keepScroll) {
    const seq = ++renderSeq;
    const [r, sub] = route().split('/');
    const y = scrollY;
    let html;
    try {
      html = r === 'catalog' ? pageCatalog() : r === 'fav' ? pageFav() : r === 'cart' ? pageCart()
        : r === 'orders' ? await pageOrders() : r === 'admin' ? await pageAdmin(sub) : pageHome();
    } catch (e) { html = emptyHTML('⚠️', 'Xatolik', h(e.message)); }
    if (seq !== renderSeq) return;
    const focused = document.activeElement?.id === 'q';
    $('#view').innerHTML = html;
    tabbar(); tgBack();
    if (keepScroll) scrollTo(0, y);
    const q = $('#q');
    if (q) {
      if (focused) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
      let t; q.oninput = () => { clearTimeout(t); t = setTimeout(() => { F.q = q.value; render(true); }, 250); };
      q.onkeydown = (e) => { if (e.key === 'Enter') q.blur(); };
    }
    setupBanners();
    mainButton();
  }

  function setupBanners() {
    clearInterval(bannerTimer);
    const el = $('#banners'); if (!el) return;
    const dots = [...document.querySelectorAll('#bdots i')];
    const idx = () => Math.round(el.scrollLeft / (el.firstElementChild.offsetWidth + 12));
    el.onscroll = () => dots.forEach((d, i) => d.classList.toggle('on', i === idx()));
    bannerTimer = setInterval(() => {
      if (!document.body.contains(el)) return clearInterval(bannerTimer);
      const n = (idx() + 1) % el.children.length;
      el.scrollTo({ left: n * (el.firstElementChild.offsetWidth + 12), behavior: 'smooth' });
    }, 4500);
  }

  function mainButton() {
    const mb = tg?.MainButton; if (!mb) return;
    mb.offClick(mainButton.cb);
    if (route() === 'cart' && cartCount() && !sheetOpen()) {
      const total = Object.entries(cart).reduce((s, [id, q]) => s + (prodById(id)?.price || 0) * q, 0);
      mb.setParams({ text: `Buyurtma berish · ${money(total)}`, is_visible: true, color: D.settings.accent, text_color: '#ffffff' });
      mainButton.cb = openCheckout; mb.onClick(mainButton.cb);
    } else mb.hide();
  }

  // ---------- Hodisalar ----------
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const { act, id, to, col } = el.dataset;
    if (el.tagName === 'ARTICLE' && e.target.closest('button')) return; // ichki tugma bosilgan
    switch (act) {
      case 'go': return go(to);
      case 'open': return openProduct(id);
      case 'inc': return setQty(id, (cart[id] || 0) + 1, el);
      case 'dec': return setQty(id, (cart[id] || 0) - 1);
      case 'buy': setQty(id, (cart[id] || 0) + 1); notify(); toast('Savatga qo\'shildi 🛒'); return closeSheet();
      case 'fav': {
        favs.has(id) ? favs.delete(id) : favs.add(id); store.set('favs', [...favs]); haptic('medium');
        if (sheetOpen()) el.textContent = favs.has(id) ? '❤️' : '🤍';
        return render(true);
      }
      case 'cat': F.cat = F.cat === id ? '' : id; haptic(); if (route()) return go(''); return render(true);
      case 'action': return runAction(el.dataset.a);
      case 'reset': resetFilters(); return render(true);
      case 'rm': {
        const { k, v } = el.dataset;
        if (k === 'cat') F.cat = ''; if (k === 'q') F.qualities.delete(v); if (k === 'c') F.countries.delete(v);
        if (k === 'sale') F.sale = false; if (k === 'price') F.min = F.max = null;
        return render(true);
      }
      case 'filters': return openFilters();
      case 'sort': {
        const order = ['default', 'cheap', 'expensive', 'new', 'popular'];
        F.sort = order[(order.indexOf(F.sort) + 1) % order.length]; haptic(); return render(true);
      }
      case 'fq': case 'fc': case 'fs': {
        haptic();
        if (act === 'fs') { el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('on')); el.classList.add('on'); }
        else el.classList.toggle('on');
        return;
      }
      case 'freset': resetFilters(); closeSheet(); return render();
      case 'fapply': {
        const s = $('.sheet'); const [lo, hi] = openFilters.bounds;
        F.qualities = new Set([...s.querySelectorAll('[data-act=fq].on')].map((c) => c.dataset.v));
        F.countries = new Set([...s.querySelectorAll('[data-act=fc].on')].map((c) => c.dataset.v));
        F.sort = s.querySelector('[data-act=fs].on')?.dataset.v || 'default';
        F.sale = $('#fsale').checked; F.inStock = $('#fstock').checked;
        const a = Math.min(+$('#vmin').value, +$('#vmax').value), b = Math.max(+$('#vmin').value, +$('#vmax').value);
        F.min = a > lo ? a : null; F.max = b < hi ? b : null;
        closeSheet(); notify();
        if (route()) go(''); else render();
        return;
      }
      case 'close': return closeSheet();
      case 'close-go': closeSheet(); return go(to);
      case 'clear-cart': if (await confirmBox('Savatni tozalaymizmi?')) { cart = {}; store.set('cart', cart); render(); } return;
      case 'checkout': return openCheckout();
      case 'edit': return editForm(col, id ? D[col].find((x) => x.id === id) : {});
      case 'del': {
        if (!(await confirmBox('Rostdan ham o\'chirasizmi?'))) return;
        try { await api(`/api/admin/${col}/${id}`, { method: 'DELETE' }); D[col] = D[col].filter((x) => x.id !== id); notify(); toast('O\'chirildi'); render(true); } catch (er) { toast(er.message); }
        return;
      }
      case 'up': {
        const list = D[col]; const i = list.findIndex((x) => x.id === id);
        [list[i - 1], list[i]] = [list[i], list[i - 1]]; haptic(); render(true);
        api(`/api/admin/${col}/reorder`, { method: 'POST', body: { ids: list.map((x) => x.id) } }).catch((er) => toast(er.message));
        return;
      }
      case 'rm-img': { const f = $('#edit-form'); f._images.splice(+el.dataset.i, 1); return renderImgs(); }
      case 'img-url': { const u = $('#img-url').value.trim(); if (u) { $('#edit-form')._images.push(u); $('#img-url').value = ''; renderImgs(); } return; }
      case 'sw': {
        const form = el.closest('form'); form.querySelector(`[name=${el.dataset.k}]`).value = el.dataset.c;
        el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)); haptic();
        if (el.dataset.k.startsWith('accent')) document.documentElement.style.setProperty('--' + el.dataset.k, el.dataset.c);
        return;
      }
      case 'ord-st': {
        try { await api(`/api/admin/orders/${id}`, { method: 'PATCH', body: { status: el.dataset.st } }); notify(); toast('Holat yangilandi, mijozga xabar yuborildi'); render(true); } catch (er) { toast(er.message); }
        return;
      }
      case 'add-admin': case 'make-admin': {
        const uid = act === 'add-admin' ? $('#new-admin').value.trim() : id;
        try { D.admins = await api('/api/owner/admins', { method: 'POST', body: { id: uid, name: el.dataset.name } }); notify(); toast('Admin tayinlandi 🛡'); render(true); } catch (er) { toast(er.message); }
        return;
      }
      case 'rm-admin': {
        if (!(await confirmBox('Adminlikdan olinsinmi?'))) return;
        try { D.admins = await api(`/api/owner/admins/${id}`, { method: 'DELETE' }); toast('Olib tashlandi'); render(true); } catch (er) { toast(er.message); }
      }
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.name === 'actType') $('#act-val').innerHTML = actionValue(e.target.value, '');
    if (e.target.name === 'type' && $('#bb-val')) $('#bb-val').innerHTML = botBtnValue(e.target.value, '');
  });

  document.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.id === 'edit-form') return saveForm(form);
    if (form.id === 'settings-form') {
      try { D.settings = await api('/api/admin/settings', { method: 'PUT', body: Object.fromEntries(new FormData(form).entries()) }); applyTheme(); notify(); toast('Saqlandi ✅'); } catch (er) { toast(er.message); }
      return;
    }
    if (form.id === 'checkout') {
      const fd = Object.fromEntries(new FormData(form).entries());
      if (fd.phone.replace(/\D/g, '').length < 9) { notify('error'); return toast('Telefon raqamini to\'liq kiriting'); }
      store.set('contact', { name: fd.name, phone: fd.phone, address: fd.address });
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Yuborilmoqda…';
      try {
        const r = await api('/api/orders', { method: 'POST', body: { ...fd, items: Object.entries(cart).map(([id, qty]) => ({ id, qty })) } });
        cart = {}; store.set('cart', cart); notify(); render(); celebrate(r.order);
        refresh();
      } catch (er) { notify('error'); toast(er.message); btn.disabled = false; btn.textContent = '✅ Tasdiqlash'; }
    }
  });

  window.addEventListener('hashchange', () => { closeSheet(true); scrollTo(0, 0); render(); });
  window.addEventListener('scroll', () => $('#searchbar')?.classList.toggle('stuck', scrollY > 70), { passive: true });
  tg?.BackButton?.onClick(() => { if (sheetOpen()) closeSheet(); else history.length > 1 ? history.back() : go(''); });
  tg?.onEvent?.('themeChanged', applyTheme);
  document.addEventListener('error', (e) => {
    const im = e.target;
    if (im.tagName === 'IMG' && !im.dataset.fb) { im.dataset.fb = 1; im.src = img0({}); }
  }, true);

  async function refresh() {
    D = await api('/api/bootstrap');
    // Savatdagi o'chirilgan mahsulotlarni tozalash
    for (const id of Object.keys(cart)) if (!prodById(id)) delete cart[id];
    store.set('cart', cart);
  }

  (async () => {
    tg?.ready(); tg?.expand();
    try { tg?.disableVerticalSwipes?.(); } catch {}
    applyTheme();
    try {
      await refresh();
      applyTheme();
      await render();
    } catch (e) {
      $('#view').innerHTML = emptyHTML('📱', 'Telegram orqali oching', `Do'konni Telegram botdagi tugma orqali oching.<br><small>${h(e.message)}</small>`);
    }
    setTimeout(() => $('#splash').classList.add('hide'), 350);
  })();
})();
