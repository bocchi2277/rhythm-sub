# Rhythm-Sub — الموقع الجديد

موقع فرقة Rhythm-Sub لترجمة الأنمي، مبني من الصفر: Next.js 15 + TailwindCSS 4، توليد ثابت كامل، عربي RTL، خط IBM Plex Sans Arabic مستضاف ذاتياً، صور WebP محسّنة.

## البنية

```
rhythm/
├── site/                 موقع Next.js (output: export → out/)
│   ├── app/              الصفحات: الرئيسية، /anime/[slug]، /list، /advanced-search، /schedule، /about، /support
│   ├── components/       AnimeCard وغيرها
│   ├── lib/data.ts       تحميل data/series.json + خريطة صور img-manifest.json
│   ├── public/img/       2076 صورة WebP محسّنة (~114MB)
│   └── public/fonts/     خطوط woff2 مستضافة ذاتياً
├── scraper/src/          أدوات السحب (Node.js + cheerio)
└── data/
    ├── series.json       النموذج الكامل: 426 سلسلة / 992 إصدار
    ├── images/           الأصول الأصلية المنزلة (~900MB، غير مرفوعة للمستودع)
    └── report.md         تقرير التحقق من السحب
```

## أوامر الموقع

```bash
cd site
npm install
npm run dev      # تطوير على localhost:3000
npm run build    # توليد out/ ثابت بالكامل (427 صفحة)
```

## إضافة حلقة جديدة (للفريق)

1. أضف ملف JSON جديد في `data/releases/` بنفس بنية الحقول (انظر نموذجاً في `data/releases/_example.json`)
2. ارفع (commit + push) — يعاد بناء الموقع ونشره تلقائياً
3. الحلقة تُدمج تلقائياً مع سلسلتها حسب حقل seriesSlug

> واجهة إدارة Keystatic مخطط لها كمرحلة تالية لتغليف الخطوة (1) بواجهة رسومية.

## سكربتات scraper

```bash
cd scraper && npm install
node src/login.mjs            # تسجيل الدخول (يتطلب .env)
node src/crawl.mjs            # جمع روابط كل المنشورات
node src/scrape.mjs           # سحب وتحليل (استئناف تلقائي)
node src/build-model.mjs      # تجميع السلاسل + التقرير
node src/download-images.mjs  # تنزيل الصور الأصلية
# scripts/optimize-images.mjs داخل site/: توليد WebP + manifest
```

⚠️ لا ترفع `.env` (بيانات الدخول) ولا مجلد `data/images/` — مستبعدة أصلاً عبر .gitignore.
