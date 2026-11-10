# وثيقة تسليم مشروع Rhythm-Sub الجديد

> آخر تحديث: 2026-08-25 — الحالة: موقع حي ومكتمل على https://rhythm-sub.pages.dev
> هذه الوثيقة مكتوبة لتتمكن أي نسخة ذكاء اصطناعي (أو مطور) من استكمال العمل دون إعادة استكشاف.
>
> ## ملحق 2026-10-07 — إصلاح المزامنة التلقائية
> - توقفت المزامنة منذ 2026-08-27 (كل تشغيل مجدول كان يفشل exit 1): Standard fresh-login من GitHub IP خلف Cloudflare + غياب `data/posts/` في الـrunner.
> - سُحبت 31 حلقة مفقودة (1027 منشوراً) محلياً ودُفعت. البناء: 440 صفحة.
> - فرع `sync-data` (orphan, commit واحد يُستبدل بـforce-push): يحمل `posts.tar.gz` (~0.9MB) وهو **المدخل الكامل** لـbuild-model في CI. يُحدَّث تلقائياً فقط عند وجود بيانات جديدة.
> - `sync.mjs` فيه حارس: يرفض إعادة البناء إن كانت ملفات posts أقل من الروابط المعروفة (بدل مسح series.json بصمت).
> - `login.mjs` يمتص كوكيز Cloudflare الأولية قبل POST، والـworkflow يستخدم Secrets فقط (أُزيلت كلمة المرور المكشوفة من الملف — **غيّر كلمة مرور الموقع لأن القديمة في سجل git**).
> - المطلوب في GitHub: Secrets باسم `RHYTHM_USER` و`RHYTHM_PASS` (Settings → Secrets → Actions).
>
> ## ملحق 2026-11-10 — تدقيق CI/المستودع (تصحيح وضع كاش الجلسة + نظافة المستودع)
> - **حقيقة مؤكدة: خط المزامنة لم ينجح ولا مرة.** عبر API: 1462 تشغيل فاشل مقابل تشغيلين ناجحين فقط (كلاهما من workflow آخر اسمه "Extract Subtitles") — أي أن `auto-sync` لم ينشر شيئاً إطلاقاً. سبب الفشل المُسجَّل في السجل: `login failed (HTTP 403)` (تحدّي Cloudflare على POST تسجيل الدخول من IP مستودع GitHub).
> - **معدّل التشغيل الفعلي 4–6 مرات/يوم وليس 48**: قِس آخر 100 تشغيل → فجوات 2.2–10.9 ساعة (وسيط ≈6.4 ساعة)، 3–8 تشغيلات يومياً. cron `*/30` ليس ضمانة.
> - **كاش الجلسة لم يكن يعمل أصلاً**: `actions/cache` post step هو `post-if: success()` فلم يُحفظ الكاش أبداً (API: `total_cache_entries: 0`)، والتشغيل يفشل عند تسجيل الدخول قبل أي حفظ ⇒ استرجاع الجلسات مستحيل. الحل: `actions/cache/restore` + `actions/cache/save` صريح بـ`if: always()` (مفتاح `rhythm-session-<run_id>-<run_attempt>`).
> - **لا تزال الجلسة المشفّرة فارغة**: أول تشغيل بعد النشر يحاول دخولاً جديداً ⇒ 403 ما لم ينجح امتصاص كوكيز Cloudflare (تعديل `login.mjs` غير المودع بعد) أو تُزرع جلسة صالحة يدوياً. **يجب زرع جلسة صالحة بعد أول نجاح، وإلا فشلت كل محاولة.**
> - `auto-sync.yml`: شرط النشر صار `steps.sync_step.outcome == 'success'` (فشل خطوة تشفير الجلسة لا يعطّل نشر البيانات)، وتحقّق سلامة لكل ملفات posts المستعادة (`JSON.parse` لكل ملف) قبل الوثوق بها، وحارس عدد (لا تُنشر لقطة بأقل من عدد ما استُعيد)، وفرع `sync-data` يبقى **commit واحد** (orphan) بدل تكديس لقطة ~1MB في كل مزامنة.
> - `ci.yml`: أضيف `concurrency` (إلغاء التشغيل المتقادم).
> - `site/package.json`: أُزيل `wrangler` (غير مستخدم في الكود؛ 57 حزمة/~حجم كبير من `@cloudflare/workerd` و`@esbuild/*` كانت تُثبَّت في كل تشغيل CI). `npm ci` صار 111 حزمة بدل 168.
> - `overrides.postcss` سليم ولا يحتاج تسجيلاً في القفل: npm لا يكتب `overrides` في `packages[""]` أصلاً (تحقّق: مشروع اختبار)، و`npm ci` ينجح بـnpm 10 وnpm 11.
> - `.gitignore`: أُضيفت `!site/public/*.txt` و`!site/public/_*.png` حتى لا تبتلع القاعدة العامة `*.txt` ملفات النشر (مثل robots.txt) بصمت.
> - **تنظيف PII**: حُذفت من هذه الوثيقة الإيميلات ومعرّف حساب Cloudflare واسم حساب GitHub (الريبو عام). ملاحظة: بيانات المؤلف في بيانات git (commit metadata) تبقى ظاهرة ولا تُزال إلا بإعادة كتابة التاريخ.
>
> ## ملحق 2026-11-09 — تحصين CI وترتيب النشر
> - `ci.yml`: عمق جلب 1، كاش npm لقفلَي site وscraper، تثبيت scraper بـ`npm ci`، ثم `npm test` (صياغة + وحدات) وtypecheck وبناء الموقع، وأخيراً `python3 site/scripts/check-css-coverage.py` بوابة حاجزة. الصلاحيات contents:read وبلا أسرار في PRs.
> - `auto-sync.yml`: المزامنة تلتزم محلياً فقط (`sync.mjs --commit-only`)؛ إن تغيّر HEAD تُحدَّث لقطة posts على `sync-data` في worktree معزول وتُدفع بـ`--force-with-lease` ويُتحقق أن المرجع البعيد يطابق الـcommit المدفوع، **ثم** يُدفع main — فشل اللقطة لا يترك النموذج المنشور بلا نسخة خام. لا تغيير في HEAD = تخطي الدفعَتين.
> - كاش الجلسة صار مشفّراً: `scraper/.session.enc` (openssl AES-256-CBC + PBKDF2) بمفتاح من السر الاختياري `RHYTHM_SESSION_KEY`؛ مفتاح الكاش `rhythm-session-<run_id>` مع restore-keys `rhythm-session-` لالتقاط الكوكيز المحدَّثة. فشل الفك يحذف الملفات التالفة ويستمر بدخول جديد، وغياب السر يتخطى الكاش كلياً. أُزيل كاش `.session.json` النصي وكاش node_modules (استُبدل بكاش setup-node).
> - فحص اللقطة قبل الفك يرفض الأسماء المطلقة/الهاربة إلى الأب ومدخلات symlink/hardlink، وجلب اللقطة يُعاد 3 محاولات.

---

## 1. الهدف والسياق

- **المطلوب من العميل:** بناء موقع جديد لفرقة ترجمة الأنمي العربية "Rhythm-Sub" كهدية لهم، لأن موقعهم الحالي (rhythm-sub.com — ووردبريس محمي بالكامل بتسجيل دخول) "عشوائي".
- **المنهج:** سحب كل محتوى الموقع الأصلي بالجلسة المسجلة → بناء نموذج بيانات نظيف → موقع Next.js حديث → نشر على Cloudflare Pages.
- **قرارات العميل المعتمدة:** Next.js + CMS، المحتوى فقط بلا تعليقات/حسابات قديمة، تنزيل كل الصور، استضافة Cloudflare (حساب موجود — بيانات الدخول محفوظة خارج الريبو ولا تُذكر هنا)، خط IBM Plex Sans Arabic (رفض العميل Cairo لكونه "خط الـAI المستهلك")، تصميم داكن RTL بلمسات من ريفايف (تنظيم) ولازيسانو (زجاجية) وفينيكس (شرائط الجودة).
- **مؤجل بطلب العميل:** نظام تسجيل الدخول الجديد، لوحة Keystatic الرسومية، الدومين الرسمي.

## 2. الحالة الحية الحالية (مُتحقق منها)

- الرابط: https://rhythm-sub.pages.dev — مشروع Pages باسم `rhythm-sub` في حساب CF واحد (معرّف الحساب وكلمة مروره محفوظان خارج الريبو؛ الريبو عام فلا تُذكر هنا).
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
│   ├── lib/data.ts            # ⭐ قلب البيانات: يقرأ ../data/series.json + img-manifest + pages، franchises، currentProjects
│   ├── public/img/            # 2083 صورة WebP محسّنة (~115MB)
│   ├── public/img-manifest.json  # خريطة { رابط أصلي → /img/hash.webp }
│   ├── public/fonts/          # IBM Plex Sans Arabic woff2 (arabic+latin 400/500/700) مستضافة ذاتياً
│   ├── public/banners/        # لافتتا PayPal والدعم الأصليتان من /img/01.jpg و /img/02.jpg
│   ├── scripts/               # optimize-images.mjs، download-images.mjs، inline-css.mjs (يُحقن CSS بكل صفحة — لا تعتمد على طلب خارجي)، fetch-fonts.mjs، preview-server.mjs
│   ├── postcss.config.mjs     # ⚠️ حيوي: بدونه Tailwind v4 يخرج ثيماً بلا كلاسات (سببت أول انهيار للتصميم)
│   └── next.config.mjs        # output:'export', trailingSlash, images.unoptimized
├── scraper/src/               # أدوات السحب (Node 22 + cheerio)
│   ├── http.mjs               # fetch مع jar كوكيز يدوي، متابعة redirects (wp-login = بوابة)، retry×3
│   ├── login.mjs              # دخول wp-login.php (log/pwd/testcookie/rememberme) → .session.json
│   ├── crawl.mjs              # /page/1..101 حتى 404 + /anime-lists/ → data/post_urls.json (992)
│   ├── scrape.mjs             # حلقة سحب: 400ms، استئناف بوجود ملف JSON، re-login تلقائي عند البوابة
│   ├── parse.mjs              # ⭐ المستخلص (التفاصيل بالقسم 5)
│   ├── build-model.mjs        # تجميع السلاسل + asciiSlug + تفريد + تنظيف الملخصات + العائلات
│   ├── download-images.mjs    # تنزيل الأصول (تخطي الموجود، خريطة image_map.json للأسماء الطويلة >200 محرف)
│   └── fetch-pages.mjs / fetch-home-extras.mjs / fetch-banners.mjs
├── data/
│   ├── series.json            # ⭐ النموذج النهائي: 426 سلسلة / 992+ إصداراً
│   ├── post_urls.json         # 992 رابط منشور
│   ├── posts/*.json           # 992 منشوراً مُحللاً (gitignored)
│   ├── pages/about.json|support.json|_footer.json|_home_extras.json
│   ├── releases/_example.json # نموذج إضافة حلقة جديدة يدوياً (تُدمج تلقائياً في lib/data.ts)
│   └── images/                # الأصول الأصلية 895MB (gitignored — نسخة احتياطية محلية فقط)
├── .gitignore                 # يستبعد: data/images, data/posts, .env, .session.json, scraper/.session.enc, out/, node_modules
└── README.md
```

## 4. بيانات الدخول والوصول

- حساب الموقع الأصلي: `scraper/.env` (المتغيران `RHYTHM_USER` و`RHYTHM_PASS` — الملف gitignored والقيم الحقيقية فيه، لا تُنسخ إلى المستودع ولا إلى الوثائق). الجلسة في `scraper/.session.json` (كوكيز wordpress_logged_in_...). إن انتهت: `node src/login.mjs`.
- Cloudflare: متصل عبر أدوات MCP لهذه البيئة (cloudflare.request) — النسخ الأخرى بلا هذا الوصول؛ البديل: `npx --yes wrangler@4` (لم يعد مثبتاً ضمن اعتماديات الموقع — أزيل لأنه غير مستخدم في الكود ويزيد حجم تثبيت CI بنحو 57 حزمة) بعد `npx wrangler login` تفاعلي.
- GitHub: الدفع عبر GCM نافذة متصفح — **مشكلة متكررة: 403 لأن المتصفح يحتفظ بحساب GitHub آخر**. الحل المجرّب: `"protocol=https`nhost=github.com`n" | git credential reject` ثم push فوراً وأكمل نافذة الدخول بحساب صاحب الريبو (المعرّف في سجل git العام). قد تعلق المهلة 15 دقيقة إن لم تُكمل النافذة.

## 5. تفاصيل السحب من الموقع الأصلي (مكتمل — للمرجع)

- الموقع: ووردبريس 6.9.4 خلف Cloudflare، محمي بالكامل (كل صفحة تحول لـwp-login للزائر)، Wishlist Member، REST API مغلقة 401 → السحب HTML فقط بالجلسة.
- بنية المنشور (مؤكدة): `h1.entry-title`، `span.alter` (عناوين بديلة)، `img.entry-image.wp-post-image` (الغلاف عبر i0-2.wp.com Photon)، `time.entry-date.published[datetime]`، `div.bookmark[data-id]` (معرف المنشور)، `select.score[data-current-rating]` (تقييم /5 ×2 = /10)، `ul.spe li` (البيانات: التصنيف روابط /tag/، الحالة نص، استوديو /studio/، سنة، الموسم /season/، النوع /category/، الحلقات رقم).
- التحميل: `.mctnx .soraddl` → `.sorattl h3` (اسم الإصدار) + `.soraurl` لكل صف: `a.res` (وسم الجودة مثل "[0F65C485][1080p HEVC]") + روابط MEGA/nyaa-torrent/رابط تورنت داخلي `rr-torrent`.
- المحتوى `.entry-content`: أقسام مفصولة بـ`<hr>` بعناوين نصية: "دليل سلسلة الأنمي:" (روابط أعمال مرتبطة → seriesGuide)، "قصة الأنمي:" (الملخص)، "العاملون على المشروع:" (أسطر "الدور: الاسم"). **المنشورات القديمة (2019-2021) بلا هذه العناوين** — يوجد منطق احتياطي (fallback) في extractSections + parseStaffLine (يقصّ القيمة عند بداية الدور التالي لعلاج النص الملتصق مثل "SoGeBuTL: SoGeBu").
- ⚠️ فخ تم اكتشافه: إعادة تحليل HTML عبر `cheerio.load()` في إصدار cheerio المثبت **تضاعف النص** — الحل: `$(el).clone()` مع `br→\n` داخل نفس المستند (دالة textWithBreaks).
- الصور: 2083 رابطاً فريداً. curl/PowerShell يفشلان بتنزيلها (مهلة) لكن **Node fetch يعمل** — كل السحب بNode. روابط Photon تُطبَّع للأصل `photonToOrigin`. الأسماء المرمّزة الطويلة (يابانية) تتجاوز حد 260 محرف ويندوز → تجزئة sha1 مع `data/image_map.json`.

## 6. قواعد النموذج الحاسمة (لا تكسرها)

1. **asciiSlug**: كل slugs مُعقّمة (decode + NFKD + إزالة غير a-z0-9) — السبب: slugs فيها ☆/³ مُرمّزة (`%e2%98%86`) لا تطابق الملفات بعد فك ترميز الحافة → 404. التفريد عند التطابق: `-YEAR` ثم `-2,-3...` (مثال: princess-principal-crown-handler-movie-2021).
2. **displayNumber** يُستخرج من **اسم** الإصدار أولاً (يدعم "01~12") ثم رقم الـslug — علاج عدم تطابق "رقم 2 بجانب اسم 01".
3. **تنظيف الملخصات** (build-model cleanSynopsis + data.ts safeSynopsis): حذف بادئة "قصة الأنمي:"، رفض ما يبدأ بـ"التصنيف:/الحالة:..." (كانت ul.spe تتسرب كملخص)، إخفاء الصندوق إن فارغ.
4. **دور "Anime Info" يُحذف** دائماً من staff (هو رابط MAL، محفوظ في malUrl).
5. **currentProjects**: القائمة المنسوحة يدوياً من صفحتهم الرئيسية (`_home_extras.json` → مطابقة asciiSlug) تُستخدم لمشاريع الرئيسية؛ جدول `/schedule` مستقل ويشتق الأعمال النشطة من الحالة وتاريخ آخر إصدار (آخر 21 يوماً).
6. **franchises**: تجميع بأول مقطع من الـslug (≥4 أحرف، >1 عضو). الاسم = عنوان أقصر عضو قبل أول نقطتين.
7. **img-manifest**: كل صورة = `/img/<sha1-16>.webp` — أي رابط غير موجود في الخريطة يعود placeholder.svg. سكربتا التنزيل/التحسين يقرآن covers + e.cover + contentImages + صور pages (لا تنسَ أي مصدر جديد).

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
(cd scraper && npm ci && npm test)   # صياغة + اختبارات وحدة — بوابة CI
cd site
npm run typecheck # فحص الأنواع — بوابة CI
npm run build     # next build && node scripts/inline-css.mjs (حقن CSS بكل صفحة)
python3 scripts/check-css-coverage.py  # بوابة CI بعد البناء: كلاسات Tailwind المستخدمة موجودة في CSS المبني
git add -A && git commit && git push   # → CF Pages يبني وينشر تلقائياً
```
- التحقق المحلي: `node scripts/preview-server.mjs` يخدم out/ على :3111 (شغّله بStart-Process مؤقت).
- مراقبة النشر: GET `/accounts/{id}/pages/projects/rhythm-sub` → latest_deployment.stages.
- **inline-css.mjs إلزامي**: شبكة العميل كانت تفسد ملفات CSS المضغوطة؛ الحقن جعل كل صفحة ذاتية التنسيق. لا تحذفه من سكربت build.

## 9. العمل المؤجل (بترتيب الأولوية المتفق عليها مع العميل)

1. **نظام تسجيل الدخول**: الموقع يجب أن يكون مسدوداً لغير المسجلين كالأصل (حالياً زر "تسجيل الدخول" يفتح دخول الموقع القديم مؤقتاً). مطلوب: تصميم auth (Cloudflare Access؟ Workers D1؟) — قرار معماري لم يُحسم. العميل قال صراحة: "اترك هذا للآخر حتى نصحح ما موجود".
2. **Keystatic**: غير مثبتة وغير مفعلة — تتطلب تحويل الموقع من output:export إلى SSR (@cloudflare/next-on-pages أو Workers) لأن Keystatic يحتاج API routes، أو إبقاء JSON-في-الريبو (النظام الحالي: `data/releases/*.json` حسب `_example.json` يُدمج تلقائياً في lib/data.ts).
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
