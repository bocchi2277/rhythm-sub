import { allSeries } from '@/lib/data';

export const metadata = { title: 'عن الفريق' };

export default function AboutPage() {
  const totalEpisodes = allSeries.reduce((n, s) => n + s.episodes.length, 0);
  const years = new Set(allSeries.map((s) => s.year).filter(Boolean));

  return (
    <div className="max-w-4xl mx-auto px-4 mt-6">
      <div className="glass border border-edge rounded-3xl p-8 md:p-12 text-center fade-up">
        <span className="btn-accent w-16 h-16 rounded-2xl grid place-items-center font-bold text-3xl mx-auto">R</span>
        <h1 className="text-3xl font-bold mt-5">فرقة Rhythm-Sub</h1>
        <p className="text-muted mt-4 leading-relaxed max-w-xl mx-auto">
          فرقة ترجمة عربية متخصصة في الأنمي، تعمل بشغف منذ عام 2019 لنقل أعمالنا المفضلة إلى الجمهور العربي
          بجودة عالية وترجمة دقيقة، مع إخراج حروف فني ومونتاج متقن.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        {[
          [`${allSeries.length}+`, 'عمل مترجم'],
          [`${totalEpisodes}+`, 'إصدار'],
          [`${years.size}`, 'سنة نشاط'],
          ['2019', 'بداية الرحلة']
        ].map(([n, l]) => (
          <div key={l} className="bg-card border border-edge rounded-2xl p-6 text-center">
            <p className="text-2xl font-bold text-accent">{n}</p>
            <p className="text-xs text-muted mt-1">{l}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 bg-card border border-edge rounded-2xl p-8">
        <h2 className="text-lg font-bold mb-4">أدوار الفريق</h2>
        <div className="grid sm:grid-cols-2 gap-x-10 gap-y-3 text-sm">
          {[
            ['TL', 'المترجم — الترجمة من اليابانية'],
            ['TLC', 'مراجع الترجمة — التدقيق اللغوي'],
            ['TS', 'مصمم الحروف — إخراج النصوص على الشاشة'],
            ['Karaoke', 'الكاريوكي — تأثيرات أغاني البداية والنهاية'],
            ['Encode', 'الرافع — ضبط الجودة والأحجام'],
            ['QC', 'مراقبة الجودة — المراجعة النهائية'],
            ['Timer', 'ضابط التوقيتات — مزامنة النص مع الصوت'],
            ['Edit', 'المحرر — صياغة النص النهائي']
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <span className="text-accent font-bold shrink-0 w-16" dir="ltr">
                {k}
              </span>
              <span className="text-muted">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 bg-card border border-edge rounded-2xl p-8 text-center">
        <h2 className="font-bold mb-2">هل وجدت رابطاً لا يعمل؟</h2>
        <p className="text-muted text-sm mb-4">تواصل معنا عبر صفحة الدعم الفني وسنقوم بالإصلاح سريعاً</p>
        <a href="/support/" className="btn-accent inline-block px-6 py-3 rounded-xl text-sm font-bold">
          الدعم الفني
        </a>
      </div>
    </div>
  );
}
