# Rhythm-Sub — موقع فرقة الترجمة

موقع جديد لفرقة Rhythm-Sub لترجمة الأنمي: Next.js 15 + TailwindCSS 4 بتصميم داكن RTL مع خط IBM Plex Sans Arabic وصور WebP محسّنة. يُنشر كموقع ثابت (static export) على Cloudflare Pages.

## بنية المشروع

```
rhythm/
├── shared/rules.mjs      القواعد المشتركة بين الموقع والسكريبَر (مصدر وحيد: slug/الملخص/الترتيب/staff)
├── site/                 الموقع Next.js (output: export ← out/)
│   ├── app/              الصفحات: الرئيسية /anime/[slug] /list /advanced-search /schedule /about /support
│   ├── components/       AnimeCard وباقي المكوّنات
│   ├── lib/              طبقة البيانات (مقسّمة حسب المسؤولية):
│   │   ├── data.ts       جذر التركيب: تحميل → تحقق → إصلاح → تطبيع → دمج → اشتقاق
│   │   ├── validate.ts   تحقق شكل البيانات عند التحميل (fail-loud)
│   │   ├── images.ts     بحث img-manifest.json + تحويل روابط الصور إلى أصول محلية
│   │   ├── text.ts       تنظيف العناوين والملخّصات (القواعد المشتركة من shared/rules.mjs)
│   │   ├── slug.ts       قواعد slug ومفتاح السلسلة (re-export من shared/rules.mjs)
│   │   ├── episodes.ts   ترتيب الحلقات (re-export من shared/rules.mjs)
│   │   ├── types.ts      أنواع النطاق (pure)
│   │   ├── sanitize.ts   قائمة سماح HTML (allowlist)
│   │   ├── url.ts        قائمة سماح المخططات (http/https/magnet/mailto)
│   │   ├── css-url.ts    تهريب قيم CSS (client-safe)
│   │   ├── pages.ts      تحميل الصفحات الثابتة + تعقيمها
│   │   ├── series-split.ts فصل المنشورات الخاصة بسلسلة أخرى
│   │   └── team-releases.ts دمج data/releases/*.json
│   ├── public/img/       صور WebP محسّنة (أسماء content-hash من bytes الصورة)
│   ├── public/fonts/     خطوط IBM Plex Sans Arabic woff2 مستضافة ذاتياً
│   └── public/_headers   ترويسات الأمان والتخزين المؤقت لـ Cloudflare Pages
├── scraper/src/          أدوات السحب (Node.js + cheerio)
└── data/
    ├── series.json       النموذج النهائي: السلاسل والإصدارات (حقول العرض فقط)
    ├── images/           الأصول الأصلية (~900MB، مستبعدة من git)
    └── report.md         تقرير آخر سحب
```

## تشغيل الموقع محلياً

```bash
cd site
npm install
npm run dev         # التطوير على localhost:3000
npm run build       # إنتاج out/: فهرس البحث → next build → حقن CSS → حقن CSP hashes (~440 صفحة)
npm run typecheck   # فحص الأنواع (tsc --noEmit)
npm run lint        # فحص ESLint (next/core-web-vitals + next/typescript)
npm run check:assets  # بعد البناء: بوابة "لا أصول من طرف ثالث" (كما في CI)
python scripts/check-css-coverage.py  # بعد البناء: بوابة تغطية كلاسات CSS (كما في CI؛ على ويندوز استخدم python — أمر python3 هناك وهمي من Microsoft Store، بينما CI على ubuntu يستخدم python3)
npm start           # معاينة out/ على المنفذ 3111
```

> **حقن CSS**: البناء يحقن ملف CSS المترجم داخل كل صفحة (‏~42KB لكل صفحة، ‏18MB إجمالاً) — هذا يزيل طلباً حاجباً للعرض لكنه يمنع المتصفح من تخزين CSS مؤقتاً بين الصفحات. لتفريغ ذاكرة التخزين المؤقت بدل ذلك: `SKIP_CSS_INLINE=1 npm run build`.

> **CSP بالـhashes**: خطوة `scripts/csp-hashes.mjs` تحقن في كل صفحة `<meta http-equiv="Content-Security-Policy">` تحوي hashes ‏sha256 **مقتبسة** لكل سكربت inline (سكربتات hydration الخاصة بـNext). لهذا لا يوجد `script-src` ولا `default-src` في `_headers` إطلاقاً — سياسات الـheader والـmeta تتقاطع، وأي `script-src` في الـheader سيحجب السكربتات المحقونة. `'unsafe-inline'` للسكربتات لم يعد مستخدماً (يبقى للأنماط فقط لأن React يحتاج style attributes). الإثبات الحقيقي بعد البناء: `PLAYWRIGHT_MODULE=<مسار playwright-core> node scripts/verify-round4.mjs` — يفتح Chromium حقيقي ويفحص: 0 انتهاكات CSP، البحث يرندر نتائج ويجلب الفهرس، القائمة تتفاعل (hydration)، صفحة الأنمي تعرض الحلقات.

> **فهرس البحث immutable**: `scripts/build-search-index.mjs` يولّد `public/search-index/<hash>.json` (‏149KB، كاش سنة immutable) ويشير إليه `site/search-index-manifest.json` الملتزم به. صفحتا `/search` و`/advanced-search` تجلبانه بـfetch مرة واحدة (نفس مدخل الكاش للصفحتين) بدل حقنه في HTML كل صفحة (صفحة البحث كانت ~215KB وصارت 65KB). المجلد مولّد عند كل بناء ومستبعد من git.

> **الصور content-addressed**: أسماء ملفات WebP مشتقة من sha1 للـbytes المحسّنة (لا من رابط المصدر) — تغيّر الصورة عند نفس الرابط ينتج اسماً جديداً فينكسر كاش immutable تلقائياً، والصور المتطابقة تندمج في ملف واحد. `npm run optimize:force` في scraper يعيد تحسين الكل وينظّف الملفات اليتيمة (غير المشار إليها في img-manifest.json).

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
npm run optimize              # إنتاج WebP بأسماء content-hash + img-manifest.json (src/optimize-images.mjs)
npm run optimize:force        # إعادة تحسين كل الصور + تنظيف اليتامى (هجرة/تغيّر محتوى المصدر)
```

## المزامنة التلقائية والجودة

- `.github/workflows/auto-sync.yml` — سحب دوري للإصدارات الجديدة (cron `*/30`؛ القياس الفعلي على GitHub 4–6 تشغيلات/يوم لا 48): التزام محلي فقط (`--commit-only`) ثم نشر لقطة posts على فرع `sync-data` والتحقق منها **قبل** دفع main (فشل اللقطة يمنع دفع main). اللقطة تُفحص قبل الاستعمال (أسماء مطلقة/هاربة، symlink/hardlink، أعضاء خارج `posts/`، وJSON تالف لكل ملف) ولا تُنشر إذا كانت أصغر من المستعاد.
- `.github/workflows/ci.yml` — بوابة جودة على main وكل PR: اختبارات scraper (`npm test`: صياغة + وحدات) + typecheck + lint (ESLint) + بناء كامل + بوابة تغطية CSS (`check-css-coverage.py`) + بوابة "لا أصول من طرف ثالث" (`npm run check:assets`)، مع `concurrency` لإلغاء التشغيل المتقادم.
- الأسرار المطلوبة في GitHub (Settings → Secrets and variables → Actions): `RHYTHM_USER` و`RHYTHM_PASS` (إلزاميان)، و`RHYTHM_SESSION_KEY` اختياري — يفعّل كاش جلسة مشفّراً (`scraper/.session.enc` عبر AES-256-GCM + PBKDF2 بـ600000 تكرار، `scraper/src/session-crypto.mjs`) في auto-sync؛ بدونه يسجّل الدخول من جديد كل تشغيل. توليد المفتاح: `openssl rand -base64 32`. **إذا لم يُضبط، لا يُحفظ أي كاش جلسة إطلاقاً** (الخطوة تتخطى التشفير والحفظ — لا تخزين نصي أبداً).
  - الأسرار **محجوبة على مستوى الخطوة** (step-level `env`) وليست على مستوى الـjob: `npm ci` لا يحتاجها ولا يجب أن يراها.
  - التشفير الآن **AES-256-GCM (AEAD)** عبر `node:crypto` (`scraper/src/session-crypto.mjs`) — يستبدل AES-256-CBC القديم غير المصادَق عليه؛ الكاشات القديمة بصيغة CBC تُفك للقراءة فقط ثم يُعاد تشفيرها بـGCM تلقائياً. ملاحظة متبقية: على الريبو العام أي fork PR يستطيع **قراءة** مدخلات الكاش (توثيق GitHub) — الحماية هي التشفير بالمفتاح السري، وليس إخفاء الـblob نفسه.
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
