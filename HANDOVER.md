# وثيقة تسليم مشروع Rhythm-Sub الجديد

> آخر تحديث: 2026-08-25 — الحالة: موقع حي ومكتمل على https://rhythm-sub.pages.dev
> هذه الوثيقة مكتوبة لتتمكن أي نسخة ذكاء اصطناعي (أو مطور) من استكمال العمل دون إعادة استكشاف.

---

## 1. الهدف والسياق

- **المطلوب من العميل:** بناء موقع جديد لفرقة ترجمة الأنمي العربية "Rhythm-Sub" كهدية لهم، لأن موقعهم الحالي (rhythm-sub.com — ووردبريس محمي بالكامل بتسجيل دخول) "عشوائي".
- **المنهج:** سحب كل محتوى الموقع الأصلي بالجلسة المسجلة → بناء نموذج بيانات نظيف → موقع Next.js حديث → نشر على Cloudflare Pages.
- **قرارات العميل المعتمدة:** Next.js + CMS، المحتوى فقط بلا تعليقات/حسابات قديمة، تنزيل كل الصور، استضافة Cloudflare (حساب موجود Bocchi2277@gmail.com)، خط IBM Plex Sans Arabic (رفض العميل Cairo لكونه "خط الـAI المستهلك")، تصميم داكن RTL بلمسات من ريفايف (تنظيم) ولازيسانو (زجاجية) وفينيكس (شرائط الجودة).
- **مؤجل بطلب العميل:** نظام تسجيل الدخول الجديد، لوحة Keystatic الرسومية، الدومين الرسمي.

## 2. الحالة الحية الحالية (مُتحقق منها)

- الرابط: https://rhythm-sub.pages.dev — مشروع Pages باسم `rhythm-sub` في حساب CF `df75b665820e04fb08bf71968f774774` (Bocchi2277@gmail.com).
- مربوط بـGitHub: `bocchi2277/rhythm-sub` — أي `git push` إلى main = بناء ونشر تلقائي (~3 دقائق).
- إعدادات بناء Pages: Build command: `cd site && npm ci && npm run build` — Output: `/site/out` — Node 22 (ملفا .nvmrc بالجذر).
- 437 صفحة ثابتة. حساب CF يحوي أيضاً مشروعين آخرين (teahousesubs, teahouse-subs) **لا تلمسهما**.

## 3. بنية المشروع

```
D:\rhythm\
├── site/                      # موقع Next.js 15 (output: export)
│   ├── app/
│   │   ├── page.tsx           # الرئيسية: HeroSlider عشوائي + آخر الحلقات (ترقيم ذكي) + مشاريعنا الحالية (القائمة المنسوحة من موقعهم) + الأعلى تقييماً + لافتتا PayPal/الدعم
│   │   ├── anime/[slug]/      # صفحة العمل: هيرو، بيانات، شبكة حلقات بنمط ريفايف (EpisodeRow)، مُلخَّص القصَّة، فريق العمل (LTR)، مواضيع ذات صلة (بطاقات عمودين)
│   │   ├── list/              # قائمة [A-Z] بأغلفة مجمعة حرفاً
│   │   ├── series/            # السلاسل: 72 عائلة مبنية على بادئة slug الأولى (≥4 أحرف) بصفوف أغلفة أفقية
│   │   ├── schedule/          # جدول أسبوعي مبني من currentProjects (يوم آخر إصدار)
│   │   ├── advanced-search/   # فلاتر: نوع/حالة/تصنيف + ترتيبات (SearchClient.tsx عميل)
│   │   ├── search/            # بحث عادي (عميل، ?q=)
│   │   ├── random/            # فاجئني: تحويل عشوائي عميل
│   │   ├── about/ + support/  # محتواهما الأصلي المسحوب من data/pages/ (about.json فيه حقل key!)
│   │   └── layout.tsx         # هيدر (Header.tsx عميل: برجر→X متحرك، قوائم أنمي وعن الفريق منسدلتان، دخول بالقائمة آخرها) + فوتر (تصفح يمين/شعار وسط/فريق يسار على الحاسوب؛ توقيع "بكل فخر Rhythm-sub || Ox Alpha")
│   ├── components/            # AnimeCard (clamp مضمون inline-style + fallback اسم بلا صورة)، EpisodeCard (عرضي 16:9 للرئيسية)، EpisodeRow (صف الحلقة بنمط ريفايف)، LatestEpisodes (ترقيم ذكي عميل)، HeroSlider (عشوائي 12، 6 ثوانٍ، أسهم)
│   ├── lib/data.ts            # ⭐ قلب البيانات: يقرأ ../data/series.json + img-manifest + pages، منطق تقسيم الدفعات، franchises، currentProjects
│   ├── public/img/            # 2083 صورة WebP محسّنة (~115MB)
│   ├── public/img-manifest.json  # خريطة { رابط أصلي → /img/hash.webp }
│   ├── public/fonts/          # IBM Plex Sans Arabic woff2 (arabic+latin 400/500/700) مستضافة ذاتياً
│   ├── public/banners/        # لافتتا PayPal والدعم الأصليتان من /img/01.jpg و /img/02.jpg
│   ├── scripts/               # optimize-images.mjs، download-images.mjs، inline-css.mjs (يُحقن CSS بكل صفحة — لا تعتمد على طلب خارجي)، fetch-fonts.mjs، preview-server.mjs
│   ├── postcss.config.mjs     # ⚠️ حيوي: بدونه Tailwind v4 يخرج ثيماً بلا كلاسات (سببت أول انهيار للتصميم)
│   └── next.config.mjs        # output:'export', trailingSlash, images.unoptimized
├── scraper/src/               # أدوات السحب (Node 26 + cheerio)
│   ├── http.mjs               # fetch مع jar كوكيز يدوي، متابعة redirects (wp-login = بوابة)، retry×3
│   ├── login.mjs              # دخول wp-login.php (log/pwd/testcookie/rememberme) → .session.json
│   ├── crawl.mjs              # /page/1..101 حتى 404 + /anime-lists/ → data/post_urls.json (992)
│   ├── scrape.mjs             # حلقة سحب: 400ms، استئناف بوجود ملف JSON، re-login تلقائي عند البوابة
│   ├── parse.mjs              # ⭐ المستخلص (التفاصيل بالقسم 5)
│   ├── build-model.mjs        # تجميع السلاسل + asciiSlug + تفريد + تقسيم الدفعات + تنظيف الملخصات + العائلات
│   ├── download-images.mjs    # تنزيل الأصول (تخطي الموجود، خريطة image_map.json للأسماء الطويلة >200 محرف)
│   └── fetch-pages.mjs / fetch-home-extras.mjs / fetch-banners.mjs
├── data/
│   ├── series.json            # ⭐ النموذج النهائي: 426 سلسلة / 992+ إصداراً (بعد تقسيم الدفعات)
│   ├── post_urls.json         # 992 رابط منشور
│   ├── posts/*.json           # 992 منشوراً مُحللاً (gitignored)
│   ├── pages/about.json|support.json|_footer.json|_home_extras.json
│   ├── releases/_example.json # نموذج إضافة حلقة جديدة يدوياً (تُدمج تلقائياً في lib/data.ts)
│   └── images/                # الأصول الأصلية 895MB (gitignored — نسخة احتياطية محلية فقط)
├── .gitignore                 # يستبعد: data/images, data/posts, .env, .session.json, out/, node_modules
└── README.md
```

## 4. بيانات الدخول والوصول

- حساب الموقع الأصلي: `scraper/.env` (RHYTHM_USER=amrm31638@gmail.com) — gitignored. الجلسة في `scraper/.session.json` (كوكيز wordpress_logged_in_...). إن انتهت: `node src/login.mjs`.
- Cloudflare: متصل عبر أدوات MCP لهذه البيئة (cloudflare.request) — النسخ الأخرى بلا هذا الوصول؛ البديل: `npx wrangler` (مثبت في site/) بعد `npx wrangler login` تفاعلي.
- GitHub: الدفع عبر GCM نافذة متصفح — **مشكلة متكررة: 403 لأن المتصفح يحتفظ بحساب GitHub آخر (mohamedhossam-byte)**. الحل المجرّب: `"protocol=https`nhost=github.com`n" | git credential reject` ثم push فوراً وأكمل نافذة الدخول بحساب bocchi2277. قد تعلق المهلة 15 دقيقة إن لم تُكمل النافذة.

## 5. تفاصيل السحب من الموقع الأصلي (مكتمل — للمرجع)

- الموقع: ووردبريس 6.9.4 خلف Cloudflare، محمي بالكامل (كل صفحة تحول لـwp-login للزائر)، Wishlist Member، REST API مغلقة 401 → السحب HTML فقط بالجلسة.
- بنية المنشور (مؤكدة): `h1.entry-title`، `span.alter` (عناوين بديلة)، `img.entry-image.wp-post-image` (الغلاف عبر i0-2.wp.com Photon)، `time.entry-date.published[datetime]`، `div.bookmark[data-id]` (معرف المنشور)، `select.score[data-current-rating]` (تقييم /5 ×2 = /10)، `ul.spe li` (البيانات: التصنيف روابط /tag/، الحالة نص، استوديو /studio/، سنة، الموسم /season/، النوع /category/، الحلقات رقم).
- التحميل: `.mctnx .soraddl` → `.sorattl h3` (اسم الإصدار) + `.soraurl` لكل صف: `a.res` (وسم الجودة مثل "[0F65C485][1080p HEVC]") + روابط MEGA/nyaa-torrent/رابط تورنت داخلي `rr-torrent`.
- المحتوى `.entry-content`: أقسام مفصولة بـ`<hr>` بعناوين نصية: "دليل سلسلة الأنمي:" (روابط أعمال مرتبطة → seriesGuide)، "قصة الأنمي:" (الملخص)، "العاملون على المشروع:" (أسطر "الدور: الاسم"). **المنشورات القديمة (2019-2021) بلا هذه العناوين** — يوجد منطق احتياطي (fallback) في extractSections + parseStaffLine (يقصّ القيمة عند بداية الدور التالي لعلاج النص الملتصق مثل "SoGeBuTL: SoGeBu").
- ⚠️ فخ تم اكتشافه: إعادة تحليل HTML عبر `cheerio.load()` في إصدار cheerio المثبت **تضاعف النص** — الحل: `$(el).clone()` مع `br→\n` داخل نفس المستند (دالة textWithBreaks).
- الصور: 2083 رابطاً فريداً. curl/PowerShell يفشلان بتنزيلها (مهلة) لكن **Node fetch يعمل** — كل السحب بNode. روابط Photon تُطبَّع للأصل `photonToOrigin`. الأسماء المرمّزة الطويلة (يابانية) تتجاوز حد 260 محرف ويندوز → تجزئة sha1 مع `data/image_map.json`.

## 6. قواعد النموذج الحاسمة (لا تكسرها)

1. **asciiSlug**: كل slugs مُعقّمة (decode + NFKD + إزالة غير a-z0-9) — السبب: slugs فيها ☆/³ مُرمّزة (`%e2%98%86`) لا تطابق الملفات بعد فك ترميز الحافة → 404. التفريد عند التطابق: `-YEAR` ثم `-2,-3...` (مثال: princess-principal-crown-handler-movie-2021).
2. **تقسيم الدفعات** (lib/data.ts): إصدار رقمه نطاق `1~12` مع ≥3 صفوف جودة، أو رقم مفرد مع **≥6 صفوف** → يُفكك لحلقات مستقلة متتالية (مثال Clevatess S1: 12 بطاقة). عتبة 6 تمنع تفكيك الأفلام متعددة الجودات.
3. **displayNumber** يُستخرج من **اسم** الإصدار أولاً (يدعم "01~12") ثم رقم الـslug — علاج عدم تطابق "رقم 2 بجانب اسم 01".
4. **تنظيف الملخصات** (build-model cleanSynopsis + data.ts safeSynopsis): حذف بادئة "قصة الأنمي:"، رفض ما يبدأ بـ"التصنيف:/الحالة:..." (كانت ul.spe تتسرب كملخص)، إخفاء الصندوق إن فارغ.
5. **دور "Anime Info" يُحذف** دائماً من staff (هو رابط MAL، محفوظ في malUrl).
6. **currentProjects**: القائمة المنسوحة يدوياً من صفحتهم الرئيسية (5 أعمال عبر `_home_extras.json` → مطابقة asciiSlug) — وليس heuristic الحالة. الجدول الأسبوعي يقرأ منها.
7. **franchises**: تجميع بأول مقطع من الـslug (≥4 أحرف، >1 عضو). الاسم = عنوان أقصر عضو قبل أول نقطتين.
8. **img-manifest**: كل صورة = `/img/<sha1-16>.webp` — أي رابط غير موجود في الخريطة يعود placeholder.svg. سكربتا التنزيل/التحسين يقرآن covers + e.cover + contentImages + صور pages (لا تنسَ أي مصدر جديد).

## 7. أخطاء مكلفة وقعت (لا تكررها)

1. **نسيان postcss.config.mjs** → Tailwind v4 بلا utilities (فشل صامت: الثيم يعمل والكلاسات ميتة).
2. **استبدال PowerShell (Get-Content/Set-Content) أفسد العربية** — يقرأ UTF-8 كـANSI/1256. القاعدة: أي تعديل ملف فيه عربي = أدوات Edit/Write فقط، أو `[System.IO.File]::ReadAllText/WriteAllText` مع UTF8 صريح.
3. **مسارات فيها `[slug]`**: PowerShell يعاملها wildcards — استخدم `-LiteralPath` أو Resolve-Path.
4. **`cheerio.load()` لجزء HTML يضاعف النص** (انظر §5).
5. **`overflow-x: clip` وحده قصّ محتوى حقيقياً** — عالج مصدر التجاوز (التفاف أدوار الفريق) أولاً ثم اترك clip شبكة أمان.
6. **Start-Job/خلفية bash يعلّقان أداة الشل** — استخدم `Start-Process ... -PassThru` مع `Stop-Process` بنهاية نفس الأمر.
7. **فحص نص عربي على مخرجات curl المباشرة يفشل** (ترميز الكونسول) — احفظ لملف واقرأه بـ`[System.IO.File]::ReadAllText(path, UTF8)`.

## 8. خط أنابيب البناء والنشر

```bash
cd site
npm run build     # next build && node scripts/inline-css.mjs (حقن CSS في 437 صفحة)
git add -A && git commit && git push   # → CF Pages يبني وينشر تلقائياً
```
- التحقق المحلي: `node scripts/preview-server.mjs` يخدم out/ على :3111 (شغّله بStart-Process مؤقت).
- مراقبة النشر: GET `/accounts/{id}/pages/projects/rhythm-sub` → latest_deployment.stages.
- **inline-css.mjs إلزامي**: شبكة العميل كانت تفسد ملفات CSS المضغوطة؛ الحقن جعل كل صفحة ذاتية التنسيق. لا تحذفه من سكربت build.

## 9. العمل المؤجل (بترتيب الأولوية المتفق عليها مع العميل)

1. **نظام تسجيل الدخول**: الموقع يجب أن يكون مسدوداً لغير المسجلين كالأصل (حالياً زر "تسجيل الدخول" يفتح دخول الموقع القديم مؤقتاً). مطلوب: تصميم auth (Cloudflare Access؟ Workers D1؟) — قرار معماري لم يُحسم. العميل قال صراحة: "اترك هذا للآخر حتى نصحح ما موجود".
2. **Keystatic**: الحزم مثبتة (site/package.json) لكن غير مفعلة — يتطلب تحويل الموقع من output:export إلى SSR (@cloudflare/next-on-pages أو Workers) لأن Keystatic يحتاج API routes، أو إبقاء JSON-في-الريبو (النظام الحالي: `data/releases/*.json` حسب `_example.json` يُدمج تلقائياً في lib/data.ts).
3. **دومين رسمي**: Custom domain في إعدادات مشروع Pages (حساب CF بلا أي zone حالياً).
4. **R2 اختياري**: bucket `rhythm-images` لم يُنشأ — الصور تُخدم كأصول ثابتة من Pages (مقبول). لو انتقلت لR2: أنشئ الـbucket عبر API وارفع عبر wrangler (يحتاج توكن/تسجيل دخول).
5. **تحسينات مقترحة غير منفذة**: صفحة "الأخيرة" مستقلة، تعليقات، وضع نهاري (CSS جاهز منطقياً لكن الداكن هو الأساس).

## 10. أوامر سريعة

```bash
# سحب كامل من الصفر (لو لزم)
cd scraper && npm i && node src/login.mjs && node src/crawl.mjs && node src/scrape.mjs && node src/build-model.mjs && node src/download-images.mjs
cd ../site && npm i && node fetch-fonts.mjs && node scripts/optimize-images.mjs && npm run build

# فحص حي سريع (PowerShell)
curl.exe -sS "https://rhythm-sub.pages.dev/" -o "$env:TEMP\h.html"; [System.IO.File]::ReadAllText("$env:TEMP\h.html",[System.Text.Encoding]::UTF8).Contains("آخر الحلقات")
```

## 11. أرقام نهائية

992 منشوراً مسحوباً (0 فشل) → 426 سلسلة → 437 صفحة منشورة → 2083 صورة WebP (889MB→115MB) → 72 سلسلة مرتبطة → 5 مشاريع حالية (منسوحة) → 15+ صفحة ترقيم في "آخر الحلقات" → Lighthouse-friendly (ثابت كامل، JS مشترك 103KB).
