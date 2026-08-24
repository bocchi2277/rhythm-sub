export const metadata = { title: 'الدعم الفني' };

const CHANNELS = [
  {
    name: 'البريد الإلكتروني',
    value: 'راسلنا عبر نموذج التواصل الرسمي للفريق',
    hint: 'للإبلاغ عن روابط معطلة أو مشاكل تحميل'
  },
  {
    name: 'سيرفر الفريق',
    value: 'انضم إلى مجتمعنا للحصول على آخر الأخبار والدعم المباشر',
    hint: 'الأسرع للرد على الاستفسارات'
  },
  {
    name: 'طلبات الترجمة',
    value: 'تُستقبل الطلبات خلال فترات مفتوحة يعلن عنها الفريق',
    hint: 'تابع صفحة الفريق للإعلانات'
  }
];

export default function SupportPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold mb-2">الدعم الفني</h1>
      <p className="text-muted text-sm mb-8">نحن هنا لمساعدتك — اختر القناة الأنسب لطلبك</p>

      <div className="space-y-4">
        {CHANNELS.map((c) => (
          <div key={c.name} className="bg-card border border-edge rounded-2xl p-6 hover:border-accent/50 transition-colors">
            <h2 className="font-bold">{c.name}</h2>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">{c.value}</p>
            <p className="text-xs text-accent mt-2">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 glass border border-edge rounded-2xl p-6">
        <h2 className="font-bold mb-3">أسئلة شائعة</h2>
        <div className="space-y-3">
          {[
            ['كيف أحمّل الحلقات؟', 'ادخل صفحة الأنمي، اضغط على الحلقة المطلوبة في قائمة الحلقات لتظهر لك جودات التحميل وروابطها (MEGA / تورنت).'],
            ['لا يعمل رابط MEGA، ماذا أفعل؟', 'جرّب الرابط البديل (تورنت) من نفس الحلقة، أو أبلغنا عبر قنوات الدعم أعلاه ليتم تحديثه.'],
            ['هل يمكنكم إعادة رفع عمل قديم؟', 'نعم في حال توفر النسخ الأصلية لدينا — أبلغنا عبر الدعم وسيُدرج ضمن طابور الإصلاحات.'],
            ['متى تُنشر الحلقات الجديدة؟', 'وفق جدول كل موسم، وتجد التوزيع الأسبوعي في صفحة جدول الحلقات.']
          ].map(([q, a]) => (
            <details key={q} className="group border border-edge rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between p-4 cursor-pointer list-none text-sm font-medium hover:bg-panel transition-colors">
                {q}
                <span className="text-muted group-open:hidden">+</span>
                <span className="text-muted hidden group-open:inline">−</span>
              </summary>
              <p className="px-4 pb-4 text-sm text-muted leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
