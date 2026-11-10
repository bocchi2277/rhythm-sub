# Rhythm-Sub — موقع فرقة الترجمة

موقع جديد لفرقة Rhythm-Sub لترجمة الأنمي: Next.js 15 + TailwindCSS 4 بتصميم داكن RTL مع خط IBM Plex Sans Arabic وصور WebP محسّنة. يُنشر كموقع ثابت (static export) على Cloudflare Pages.

## بنية المشروع

```
rhythm/
├── site/                 الموقع Next.js (output: export ← out/)
│   ├── app/              الصفحات: الرئيسية /anime/[slug] /list /advanced-search /schedule /about /support
│   ├── components/       AnimeCard وباقي المكوّنات
│   ├── lib/              طبقة البيانات (مقسّمة حسب المسؤولية):
│   │   ├── data.ts       جذر التركيب: تحميل → تحقق → إصلاح → تطبيع → دمج → اشتقاق
│   │   ├── images.ts     بحث img-manifest.json + تحويل روابط الصور إلى أصول محلية
│   │   ├── text.ts       تنظيف العناوين والملخّصات (pure)
│   │   ├── slug.ts       قواعد slug ومفتاح السلسلة (pure)
│   │   ├── types.ts      أنواع النطاق (pure)
│   │   ├── sanitize.ts   قائمة سماح HTML (allowlist)
│   │   ├── url.ts        قائمة سماح المخططات (http/https/magnet/mailto)
│   │   ├── css-url.ts    تهريب قيم CSS (client-safe)
│   │   ├── pages.ts      تحميل الصفحات الثابتة + تعقيمها
│   │   ├── series-split.ts فصل المنشورات الخاصة بسلسلة أخرى
│   │   └── team-releases.ts دمج data/releases/*.json
│   ├── public/img/       صور WebP محسّنة
│   ├── public/fonts/     خطوط IBM Plex Sans Arabic woff2 مستضافة ذاتياً
│   └── public/_headers   ترويسات الأمان والتخزين المؤقت لـ Cloudflare Pages
├── scraper/src/          أدوات السحب (Node.js + cheerio)
└── data/
    ├── series.json       النموذج النهائي: السلاسل والإصدارات
    ├── images/           الأصول الأصلية (~900MB، مستبعدة من git)
    └── report.md         تقرير آخر سحب
```

## تشغيل الموقع محلياً

```bash
cd site
npm install
npm run dev         # التطوير على localhost:3000
npm run build       # إنتاج out/ للنشر (~440 صفحة + حقن CSS)
npm run typecheck   # فحص الأنواع (tsc --noEmit)
npm run check:assets  # بعد البناء: بوابة "لا أصول من طرف ثالث" (كما في CI)
python3 scripts/check-css-coverage.py  # بعد البناء: بوابة تغطية كلاسات CSS (كما في CI)
npm start           # معاينة out/ على المنفذ 3111
```

> **حقن CSS**: البناء يحقن ملف CSS المترجم داخل كل صفحة (‏~42KB لكل صفحة، ‏18MB إجمالاً) — هذا يزيل طلباً حاجباً للعرض لكنه يمنع المتصفح من تخزين CSS مؤقتاً بين الصفحات. لتفريغ ذاكرة التخزين المؤقت بدل ذلك: `SKIP_CSS_INLINE=1 npm run build`.

## إضافة حلقة جديدة يدوياً (بدون سحب)

1. أنشئ ملف JSON باسم مطابق في `data/releases/` على غرار `data/releases/_example.json`.
2. أرسل (commit + push) — يُعاد بناء الموقع ونشره تلقائياً على Cloudflare Pages.
3. تأكد أن الحقل `seriesSlug` يطابق slug السلسلة.

> البديل: واجهة Keystatic الرسومية مؤجلة (تتطلب الانتقال من `output: export` إلى SSR).

## خط أنابيب scraper

```bash
cd scraper && npm install
npm test                      # فحص الصياغة + اختبارات الوحدة (بوابة CI)
node src/login.mjs            # تسجيل الدخول (يقرأ scraper/.env)
node src/crawl.mjs            # حصر كل روابط المنشورات → data/post_urls.json
node src/scrape.mjs           # سحب تفاصيل المنشورات (يستأنف بوجود ملفات JSON)
node src/build-model.mjs      # بناء السلاسل → data/series.json
node src/download-images.mjs  # تنزيل الصور الأصلية
# site/scripts/optimize-images.mjs: إنتاج WebP + img-manifest.json
```

## المزامنة التلقائية والجودة

- `.github/workflows/auto-sync.yml` — سحب دوري للإصدارات الجديدة (cron `*/30`؛ القياس الفعلي على GitHub 4–6 تشغيلات/يوم لا 48): التزام محلي فقط (`--commit-only`) ثم نشر لقطة posts على فرع `sync-data` والتحقق منها **قبل** دفع main (فشل اللقطة يمنع دفع main). اللقطة تُفحص قبل الاستعمال (أسماء مطلقة/هاربة، symlink/hardlink، وJSON تالف لكل ملف) ولا تُنشر إذا كانت أصغر من المستعاد.
- `.github/workflows/ci.yml` — بوابة جودة على main وكل PR: اختبارات scraper (`npm test`: صياغة + وحدات) + typecheck + بناء كامل + بوابة تغطية CSS (`check-css-coverage.py`) + بوابة "لا أصول من طرف ثالث" (`npm run check:assets`)، مع `concurrency` لإلغاء التشغيل المتقادم.
- الأسرار المطلوبة في GitHub (Settings → Secrets and variables → Actions): `RHYTHM_USER` و`RHYTHM_PASS` (إلزاميان)، و`RHYTHM_SESSION_KEY` اختياري — يفعّل كاش جلسة مشفّراً (`scraper/.session.enc` عبر AES-256-CBC + PBKDF2 بـ600000 تكرار) في auto-sync؛ بدونه يسجّل الدخول من جديد كل تشغيل. توليد المفتاح: `openssl rand -base64 32`. **إذا لم يُضبط، تُحفظ الجلسات بلا تشفير — لا تفعل ذلك.**
  - الأسرار **محجوبة على مستوى الخطوة** (step-level `env`) وليست على مستوى الـjob: `npm ci` لا يحتاجها ولا يجب أن يراها.
  - ⚠️ AES-256-CBC بلا مصادقة (MAC) — التبديل إلى `age` أو `openssl dgst -hmac` موصى به (انظر HANDOVER.md).
- `RHYTHM_COOKIE` اختياري — بديل عند حجب `wp-login.php` لعناوين الـrunner (Cloudflare أو Wordfence على عناوين سحابية). يحقن الكوكي في الجلسة ويُتخطّى الدخول كلياً. **يُجدد كل 14 يوماً** (انتهاء "remember me" الافتراضي في ووردبريس).  format: `name=value; name2=value2`.

### كيف تحصل على `RHYTHM_COOKIE`

1. ادخل `rhythm-sub.com` من المتصفح مع تفعيل **«تذكرني»** (remember me).
2. DevTools → تبويب **Network** → حدّث الصفحة → اختر أي طلب → تبويب **Headers** → انسخ قيمة `Cookie` كاملة من ترويسات الطلب.
   (أو Application → Cookies → انسخ كل إدخالات `rhythm-sub.com` بصيغة `name=value` مفصولة بـ`؛ `).
3. GitHub → Settings → Secrets and variables → Actions → **New repository secret** → الاسم `RHYTHM_COOKIE` والقيمة المنسوخة.

**لإطالة العمر** (إن كان حسابك أدمن): أضف في `functions.php` أو إضافة must-use:
`add_filter('auth_cookie_expiration', fn() => 365 * DAY_IN_SECONDS);`
عندها يكفي التجديد مرة في السنة.
- النشر تلقائي عبر Cloudflare Pages من فرع main (`/site/out`).

⚠️ الريبو **عام**: لا تضع أي بريد أو معرّف حساب أو كلمة مرور في المستودع أو في `HANDOVER.md` (تم تنظيفه) — الأسرار عبر `scraper/.env` محلياً و`Secrets` في GitHub. لا ترفع ملف `.env` (يحتوي بيانات الدخول) ولا مجلد `data/images/` ولا `data/posts/` — كلها مستبعدة في `.gitignore`. راجع `HANDOVER.md` لتفاصيل التشغيل والنشر.
