# 🛍 Shahnoza Market — Telegram bot + Mini App

Telegram ichidagi zamonaviy onlayn do'kon: bot (@shahnozamarket_bot) va uning ichida ochiladigan Mini App.

## Imkoniyatlar

**Xaridor uchun**
- Bo'limlar (kategoriyalar), bannerlar karuseli, tezkor tugmalar
- Qidiruv + filtrlar: narx oralig'i, sifat (Premium / Yuqori / Standart / Ekonom), ishlab chiqarilgan davlat, chegirma, mavjudligi
- Saralash: arzon, qimmat, yangi, ommabop
- Sevimlilar, savat, buyurtma berish, "Buyurtmalarim"
- Telegram'ning yorug' / qorong'i mavzusiga moslashadi, tebranish (haptic), animatsiyalar

**Admin uchun (Mini App → ⚙️ Panel)**
- Mahsulotlar: qo'shish, tahrirlash, yashirish, o'chirish, rasm yuklash
- Bo'limlar, bannerlar, app tugmalari (nima ochishini tanlash bilan)
- Bot tugmalari: matn, turi (matn javob / Mini App sahifa / havola), qator
- Buyurtmalar: holatini o'zgartirish (mijozga avtomatik xabar boradi)
- Sozlamalar: do'kon nomi, ranglar, salomlashish matni

**Faqat ega uchun**: adminlarni tayinlash va olib tashlash (Mini App yoki botda `/addadmin ID`, `/deladmin ID`, `/admins`).

Yangi buyurtma kelganda ega va barcha adminlarga bot orqali xabar keladi, holatni shu xabardagi tugmalar bilan o'zgartirish mumkin.

## Bot buyruqlari
| Buyruq | Kim uchun | Vazifasi |
|---|---|---|
| /start | hamma | Bosh menyu |
| /id | hamma | O'z Telegram ID raqamini bilish |
| /admin | admin, ega | Boshqaruv paneli |
| /refresh | hamma | Menyu tugmalarini yangilash |
| /addadmin ID, /deladmin ID, /admins | ega | Adminlarni boshqarish |

## Sozlash (environment variables)
| Nomi | Tavsif |
|---|---|
| `BOT_TOKEN` | BotFather bergan token. **GitHub'ga yuklamang!** |
| `OWNER_ID` | Ega Telegram ID (8427771708) |
| `DATA_DIR` | Ma'lumotlar papkasi. Railway'da Volume ulangan joy: `/data` |
| `PUBLIC_URL` | Sayt manzili. Railway va Render'da avtomatik aniqlanadi |

## Railway'ga joylash (qisqacha)
1. Kodni GitHub repoga yuklang.
2. railway.com → New Project → Deploy from GitHub repo → shu repo.
3. Service → Variables: `BOT_TOKEN`, `OWNER_ID`, `DATA_DIR=/data`.
4. Service → Settings → Networking → **Generate Domain**.
5. Service ustida o'ng tugma → **Attach Volume** → Mount path: `/data`.
6. Deploy tugagach botga /start yozing.

## Kompyuterda sinash
```bash
npm install
npm run dev   # http://localhost:3000 — bot tokensiz, ega sifatida ochiladi
```
