// Shahnoza Market — Telegram bot + Mini App server
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const db = require('./db');
const { createBot } = require('./bot');

const TOKEN = process.env.BOT_TOKEN || '';
const OWNER_ID = Number(process.env.OWNER_ID || 8427771708);
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = (process.env.PUBLIC_URL
  || (process.env.RAILWAY_PUBLIC_DOMAIN && `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`)
  || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const DEV_USER_ID = process.env.DEV_USER_ID ? Number(process.env.DEV_USER_ID) : null;

const isOwner = (id) => Number(id) === OWNER_ID;
const isAdmin = (id) => isOwner(id) || db.data.admins.some((a) => Number(a.id) === Number(id));
const roleOf = (id) => (isOwner(id) ? 'owner' : isAdmin(id) ? 'admin' : 'user');

// ---------- Telegram initData tekshiruvi ----------
function verifyInitData(initData) {
  if (!initData || !TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  const calc = crypto.createHmac('sha256', secret).update(check).digest('hex');
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  const authDate = Number(params.get('auth_date') || 0);
  if (Date.now() / 1000 - authDate > 7 * 24 * 3600) return null;
  try { return JSON.parse(params.get('user')); } catch { return null; }
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use('/api', (req, res, next) => {
  let user = verifyInitData(req.get('X-Init-Data'));
  if (!user && DEV_USER_ID) user = { id: DEV_USER_ID, first_name: 'Dev' };
  if (!user) return res.status(401).json({ error: 'Telegram orqali oching' });
  req.user = user;
  req.role = roleOf(user.id);
  next();
});
const adminOnly = (req, res, next) => (req.role === 'user' ? res.status(403).json({ error: 'Ruxsat yo\'q' }) : next());
const ownerOnly = (req, res, next) => (req.role !== 'owner' ? res.status(403).json({ error: 'Faqat ega uchun' }) : next());

// ---------- Ommaviy API ----------
app.get('/api/bootstrap', (req, res) => {
  const d = db.data;
  const admin = req.role !== 'user';
  res.json({
    me: { id: req.user.id, name: req.user.first_name, role: req.role },
    settings: d.settings,
    payments: paymentsOn(),
    categories: d.categories,
    products: admin ? d.products : d.products.filter((p) => p.active),
    banners: d.banners,
    appButtons: d.appButtons,
    ...(admin && { botButtons: d.botButtons }),
    ...(req.role === 'owner' && { admins: d.admins }),
  });
});

const ORDER_STATUSES = ['new', 'accepted', 'shipping', 'done', 'cancelled'];
let botApi = null;

const PAYMENT_TOKEN = process.env.PAYMENT_PROVIDER_TOKEN || '';
const paymentsOn = () => !!(PAYMENT_TOKEN && botApi);
const visible = (o) => o.status !== 'unpaid';

// To'lov tasdiqlangandan keyin: zaxirani kamaytirish va adminlarga xabar
function finalizeOrder(order) {
  for (const l of order.items) {
    const p = db.data.products.find((x) => x.id === l.id);
    if (p) { p.sold = (p.sold || 0) + l.qty; if (typeof p.stock === 'number') p.stock = Math.max(0, p.stock - l.qty); }
  }
  db.save();
  if (botApi) botApi.notifyNewOrder(order).catch((e) => console.error('notify', e.message));
}

app.post('/api/orders', async (req, res) => {
  const { items, name, phone, address, comment } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Savat bo\'sh' });
  if (!String(phone || '').trim()) return res.status(400).json({ error: 'Telefon raqamini kiriting' });
  const lines = [];
  for (const it of items.slice(0, 50)) {
    const p = db.data.products.find((x) => x.id === it.id && x.active);
    const qty = Math.max(1, Math.min(99, Number(it.qty) || 1));
    if (!p) continue;
    if (typeof p.stock === 'number' && p.stock < qty) return res.status(400).json({ error: `"${p.title}" dan faqat ${p.stock} dona qolgan` });
    lines.push({ id: p.id, title: p.title, price: p.price, qty });
  }
  if (!lines.length) return res.status(400).json({ error: 'Mahsulotlar topilmadi' });
  const pay = paymentsOn();
  const order = {
    id: db.uid(), no: (db.data.orders.length ? Math.max(...db.data.orders.map((o) => o.no || 0)) : 1000) + 1,
    userId: req.user.id, username: req.user.username || '', name: String(name || req.user.first_name || '').slice(0, 80),
    phone: String(phone).slice(0, 30), address: String(address || '').slice(0, 300), comment: String(comment || '').slice(0, 500),
    items: lines, total: lines.reduce((s, l) => s + l.price * l.qty, 0), status: pay ? 'unpaid' : 'new', paid: false, createdAt: Date.now(),
  };
  // eski to'lanmagan buyurtmalarni tozalash (24 soatdan oshgan)
  db.data.orders = db.data.orders.filter((o) => o.status !== 'unpaid' || Date.now() - o.createdAt < 864e5);
  db.data.orders.unshift(order);
  db.save();
  if (!pay) { finalizeOrder(order); return res.json({ ok: true, order }); }
  try {
    const invoiceUrl = await botApi.createInvoice(order, PAYMENT_TOKEN);
    res.json({ ok: true, order, invoiceUrl });
  } catch (e) {
    console.error('invoice', e.message);
    db.data.orders = db.data.orders.filter((o) => o.id !== order.id);
    db.save();
    res.status(500).json({ error: 'To\'lov oynasini ochib bo\'lmadi. Keyinroq urinib ko\'ring.' });
  }
});

app.get('/api/orders/my', (req, res) => {
  res.json(db.data.orders.filter((o) => visible(o) && Number(o.userId) === Number(req.user.id)));
});

// ---------- Admin API ----------
app.get('/api/admin/orders', adminOnly, (req, res) => res.json(db.data.orders.filter(visible)));
app.patch('/api/admin/orders/:id', adminOnly, async (req, res) => {
  const o = db.data.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Topilmadi' });
  if (!ORDER_STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Noto\'g\'ri holat' });
  o.status = req.body.status;
  db.save();
  if (botApi) botApi.notifyStatus(o).catch(() => {});
  res.json(o);
});

app.get('/api/admin/stats', adminOnly, (req, res) => {
  const d = db.data;
  const all = d.orders.filter(visible);
  const done = all.filter((o) => o.status !== 'cancelled');
  res.json({
    users: Object.keys(d.users).length,
    orders: all.length,
    newOrders: all.filter((o) => o.status === 'new').length,
    revenue: done.reduce((s, o) => s + o.total, 0),
    products: d.products.length,
  });
});

const str = (v, n = 200) => String(v ?? '').trim().slice(0, n);
const num = (v) => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));
const SCHEMAS = {
  products: (b) => ({
    title: str(b.title, 120), description: str(b.description, 2000), categoryId: str(b.categoryId, 40),
    price: num(b.price) ?? 0, oldPrice: num(b.oldPrice), quality: str(b.quality, 30) || 'standart',
    country: str(b.country, 60), stock: num(b.stock), active: b.active !== false,
    images: (Array.isArray(b.images) ? b.images : []).map((x) => str(x, 500)).filter(Boolean).slice(0, 8),
  }),
  categories: (b) => ({ name: str(b.name, 60), emoji: str(b.emoji, 8) || '🛍', color: str(b.color, 20) || '#7b5cff' }),
  banners: (b) => ({
    title: str(b.title, 80), subtitle: str(b.subtitle, 120), emoji: str(b.emoji, 8), image: str(b.image, 500),
    from: str(b.from, 20) || '#ff3d7f', to: str(b.to, 20) || '#7b5cff', action: str(b.action, 200),
  }),
  appButtons: (b) => ({ label: str(b.label, 30), emoji: str(b.emoji, 8), action: str(b.action, 200) }),
  botButtons: (b) => ({
    text: str(b.text, 60), type: ['webapp', 'url', 'text'].includes(b.type) ? b.type : 'text',
    value: str(b.value, 2000), row: Math.max(0, Math.min(20, Number(b.row) || 0)),
  }),
};
const colGuard = (req, res, next) => (SCHEMAS[req.params.col] ? next() : next('route'));

app.post('/api/admin/:col', adminOnly, colGuard, (req, res) => {
  const item = { id: db.uid(), ...SCHEMAS[req.params.col](req.body || {}) };
  if (req.params.col === 'products') Object.assign(item, { sold: 0, createdAt: Date.now() });
  db.data[req.params.col].push(item);
  db.save();
  res.json(item);
});
app.put('/api/admin/:col/:id', adminOnly, colGuard, (req, res) => {
  const list = db.data[req.params.col];
  const item = list.find((x) => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Topilmadi' });
  Object.assign(item, SCHEMAS[req.params.col]({ ...item, ...req.body }));
  db.save();
  res.json(item);
});
app.delete('/api/admin/:col/:id', adminOnly, colGuard, (req, res) => {
  db.data[req.params.col] = db.data[req.params.col].filter((x) => x.id !== req.params.id);
  db.save();
  res.json({ ok: true });
});
app.post('/api/admin/:col/reorder', adminOnly, colGuard, (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const list = db.data[req.params.col];
  list.sort((a, b) => (ids.indexOf(a.id) + 1 || 1e9) - (ids.indexOf(b.id) + 1 || 1e9));
  db.save();
  res.json({ ok: true });
});

app.put('/api/admin/settings', adminOnly, (req, res) => {
  const b = req.body || {};
  const s = db.data.settings;
  for (const k of ['shopName', 'tagline', 'currency', 'accent', 'accent2', 'phone']) if (k in b) s[k] = str(b[k], 120);
  for (const k of ['welcomeText', 'orderNote']) if (k in b) s[k] = str(b[k], 3000);
  db.save();
  res.json(s);
});

const upload = multer({
  storage: multer.diskStorage({
    destination: db.UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, db.uid() + (path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.jpg')),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});
app.post('/api/admin/upload', adminOnly, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Rasm yuklanmadi' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ---------- Ega API: adminlar ----------
app.get('/api/owner/users', ownerOnly, (req, res) => {
  res.json(Object.values(db.data.users).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 300));
});
app.post('/api/owner/admins', ownerOnly, (req, res) => {
  const id = Number(req.body.id);
  if (!id) return res.status(400).json({ error: 'Telegram ID raqam bo\'lishi kerak' });
  if (isOwner(id)) return res.status(400).json({ error: 'Bu do\'kon egasi' });
  if (!db.data.admins.some((a) => Number(a.id) === id)) {
    const u = db.data.users[id];
    db.data.admins.push({ id, name: str(req.body.name, 60) || u?.name || '', username: u?.username || '', addedAt: Date.now() });
    db.save();
    if (botApi) botApi.notifyAdminChange(id, true).catch(() => {});
  }
  res.json(db.data.admins);
});
app.delete('/api/owner/admins/:id', ownerOnly, (req, res) => {
  const id = Number(req.params.id);
  db.data.admins = db.data.admins.filter((a) => Number(a.id) !== id);
  db.save();
  if (botApi) botApi.notifyAdminChange(id, false).catch(() => {});
  res.json(db.data.admins);
});

// ---------- Statik fayllar ----------
app.use('/uploads', express.static(db.UPLOAD_DIR, { maxAge: '30d' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: 0 }));
app.get('/health', (req, res) => res.send('ok'));

// ---------- Ishga tushirish ----------
(async () => {
  if (TOKEN) {
    const { bot, api } = createBot({ token: TOKEN, publicUrl: PUBLIC_URL, isAdmin, isOwner, ownerId: OWNER_ID, finalizeOrder });
    botApi = api;
    if (PUBLIC_URL.startsWith('https://')) {
      const { webhookCallback } = require('grammy');
      const secretPath = '/tg/' + crypto.createHash('sha256').update(TOKEN).digest('hex').slice(0, 24);
      app.post(secretPath, webhookCallback(bot, 'express'));
      app.listen(PORT, () => console.log(`Server: ${PORT}`));
      await bot.init();
      await bot.api.setWebhook(PUBLIC_URL + secretPath, { drop_pending_updates: false });
      await api.setup();
      console.log('Bot webhook rejimida ishlayapti:', PUBLIC_URL);
    } else {
      app.listen(PORT, () => console.log(`Server: ${PORT}`));
      await bot.api.deleteWebhook().catch(() => {});
      await api.setup().catch((e) => console.error(e.message));
      bot.start({ onStart: (i) => console.log('Bot polling rejimida: @' + i.username) });
    }
  } else {
    app.listen(PORT, () => console.log(`Server (botsiz, BOT_TOKEN yo'q): ${PORT}`));
  }
})().catch((e) => { console.error(e); process.exit(1); });
