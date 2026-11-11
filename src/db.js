// Oddiy va ishonchli JSON baza: barcha ma'lumotlar DATA_DIR/db.json faylida saqlanadi.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const uid = () => crypto.randomBytes(6).toString('hex');

function seed() {
  const cats = [
    { id: uid(), name: 'Kiyim-kechak', emoji: '👗', color: '#ff6b9d' },
    { id: uid(), name: 'Go\'zallik', emoji: '💄', color: '#c471ed' },
    { id: uid(), name: 'Elektronika', emoji: '🎧', color: '#4facfe' },
    { id: uid(), name: 'Uy uchun', emoji: '🏡', color: '#43e97b' },
    { id: uid(), name: 'Bolalar', emoji: '🧸', color: '#fda085' },
    { id: uid(), name: 'Oziq-ovqat', emoji: '🍯', color: '#f6d365' },
  ];
  const img = (q) => `https://images.unsplash.com/${q}?w=800&q=80&auto=format&fit=crop`;
  const p = (title, ci, price, oldPrice, quality, country, image, description, stock = 20) => ({
    id: uid(), title, categoryId: cats[ci].id, price, oldPrice, quality, country,
    images: [img(image)], description, stock, active: true, sold: Math.floor(Math.random() * 120),
    createdAt: Date.now() - Math.floor(Math.random() * 1e9),
  });
  return {
    settings: {
      shopName: 'Shahnoza Market',
      tagline: 'Sevimli narsalaringiz — bir bosishda',
      currency: "so'm",
      accent: '#ff3d7f',
      accent2: '#7b5cff',
      phone: '',
      welcomeText: '✨ <b>Shahnoza Market</b>ga xush kelibsiz!\n\nEng sara mahsulotlar, qulay narxlar va tez yetkazib berish. Do\'konni ochish uchun pastdagi tugmani bosing 👇',
      orderNote: 'Buyurtmangiz qabul qilindi! Tez orada operatorimiz siz bilan bog\'lanadi.',
    },
    admins: [],
    categories: cats,
    products: [
      p('Ipak ro\'mol "Bahor"', 0, 189000, 249000, 'premium', 'Turkiya', 'photo-1601924994987-69e26d50dc26', 'Tabiiy ipakdan tikilgan, yengil va nafis ro\'mol. 90×90 sm.'),
      p('Oversize futbolka', 0, 129000, null, 'yuqori', 'O\'zbekiston', 'photo-1521572163474-6864f9cf17ab', '100% paxta, Toshkentda tikilgan. Barcha o\'lchamlar mavjud.'),
      p('Charm sumka', 0, 459000, 590000, 'premium', 'Italiya', 'photo-1584917865442-de89df76afd3', 'Haqiqiy charm, qo\'lda tikilgan. Har kuni uchun ideal.'),
      p('Namlovchi krem', 1, 145000, null, 'premium', 'Janubiy Koreya', 'photo-1556228578-8c89e6adf883', 'Gialuron kislotali krem, barcha teri turlari uchun.'),
      p('Atir "Noir"', 1, 520000, 650000, 'premium', 'Fransiya', 'photo-1541643600914-78b084683601', 'Sharqona yog\'och va vanil notalari. 50 ml.'),
      p('Lab bo\'yog\'i to\'plami', 1, 99000, 135000, 'standart', 'Xitoy', 'photo-1586495777744-4413f21062fa', '6 xil rang, uzoq saqlanadi.'),
      p('Simsiz quloqchin', 2, 349000, 420000, 'yuqori', 'Xitoy', 'photo-1505740420928-5e560c06d30e', 'Shovqinni so\'ndirish, 30 soat ishlash.'),
      p('Aqlli soat', 2, 699000, null, 'premium', 'Janubiy Koreya', 'photo-1523275335684-37898b6baf30', 'Puls, uyqu va sport monitoringi. AMOLED ekran.'),
      p('Keramik vaza', 3, 175000, null, 'yuqori', 'O\'zbekiston', 'photo-1578500494198-246f612d3b3d', 'Rishton ustalari qo\'lida yasalgan.'),
      p('Ifor sham', 3, 69000, 89000, 'standart', 'Turkiya', 'photo-1603006905003-be475563bc59', 'Soya mumi, lavanda hidi. 40 soat yonadi.'),
      p('Yumshoq ayiqcha', 4, 119000, null, 'yuqori', 'Xitoy', 'photo-1559454403-b8fb88521f11', 'Gipoallergen material, 40 sm.'),
      p('Tabiiy asal', 5, 85000, null, 'premium', 'O\'zbekiston', 'photo-1587049352846-4a222e784d38', 'Tog\' asali, 1 kg. Qo\'shimchalarsiz.'),
      p('Quritilgan mevalar', 5, 59000, 72000, 'ekonom', 'O\'zbekiston', 'photo-1596591606975-97ee5cef3a1e', 'O\'rik, mayiz, anjir aralashmasi, 500 g.'),
    ],
    banners: [
      { id: uid(), title: 'Kuzgi chegirmalar', subtitle: '30% gacha arzon', emoji: '🍂', from: '#ff3d7f', to: '#ff9a44', action: 'filter:sale' },
      { id: uid(), title: 'Premium to\'plam', subtitle: 'Eng sara mahsulotlar', emoji: '💎', from: '#7b5cff', to: '#22d3ee', action: 'filter:premium' },
      { id: uid(), title: 'Mahalliy ishlab chiqarish', subtitle: 'O\'zbekistonda yaratilgan', emoji: '🇺🇿', from: '#10b981', to: '#3b82f6', action: "country:O'zbekiston" },
    ],
    appButtons: [
      { id: uid(), label: 'Chegirmalar', emoji: '🔥', action: 'filter:sale' },
      { id: uid(), label: 'Yangi', emoji: '✨', action: 'sort:new' },
      { id: uid(), label: 'Premium', emoji: '💎', action: 'filter:premium' },
      { id: uid(), label: 'Ommabop', emoji: '🏆', action: 'sort:popular' },
    ],
    botButtons: [
      { id: uid(), text: '🛍 Do\'konni ochish', type: 'webapp', value: '', row: 0 },
      { id: uid(), text: '📦 Buyurtmalarim', type: 'webapp', value: 'orders', row: 1 },
      { id: uid(), text: '📞 Aloqa', type: 'text', value: 'Biz bilan bog\'lanish: @nodir786', row: 1 },
      { id: uid(), text: 'ℹ️ Biz haqimizda', type: 'text', value: 'Shahnoza Market — sifatli mahsulotlar va samimiy xizmat. 💖', row: 2 },
    ],
    orders: [],
    users: {},
  };
}

let data;
try {
  data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} catch {
  data = seed();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DB_FILE);
  }, 150);
}

module.exports = { get data() { return data; }, save, uid, UPLOAD_DIR, DATA_DIR };
