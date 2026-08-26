import Link from 'next/link';
import { allSeries } from '@/lib/data';

export const metadata = { title: 'جدول الحلقات' };

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function weekdayOf(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay();
}

export default function SchedulePage() {
  /* Only active ongoing episodic series releasing weekly in current broadcast period (الأعمال المستمرة الجارية فقط) */
  const ongoingSeries = allSeries
    .filter((s) => /ongoing|airing|currently/i.test(s.status ?? ''))
    .filter((s) => !/END$/i.test(s.title) && !/movie|film|فيلم/i.test(s.type?.text ?? ''))
    .filter((s) => !/BD|Vol\.|Blu-ray/i.test(s.title))
    .filter((s) => {
      const latest = s.episodes[0];
      if (!latest) return false;
      if (/BD|Vol\./i.test(latest.displayNum ?? '')) return false;
      if (!latest.date) return false;
      return Date.now() - new Date(latest.date).getTime() < 21 * 24 * 3600 * 1000;
    })
    .sort((a, b) => String(b.lastReleaseAt ?? '').localeCompare(String(a.lastReleaseAt ?? '')));

  const byDay = new Map<number, typeof allSeries>();
  for (const s of ongoingSeries) {
    const latestEp = s.episodes[0];
    const wd = weekdayOf(latestEp?.date ?? s.lastReleaseAt);
    if (wd == null) continue;
    if (!byDay.has(wd)) byDay.set(wd, []);
    byDay.get(wd)!.push(s);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold mb-2">جدول الحلقات</h1>
      <p className="text-muted text-sm mb-8">
        توزيع الأعمال حسب يوم آخر إصدار — يتحدث تلقائياً مع كل حلقة جديدة
      </p>

      {byDay.size === 0 ? (
        <p className="text-muted">لا توجد أعمال في الجدول حالياً.</p>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {DAYS.map((day, i) =>
            byDay.has(i) ? (
              <div key={day} className="bg-card border border-edge rounded-2xl overflow-hidden">
                <div className="btn-accent px-4 py-3 font-bold text-sm flex items-center justify-between">
                  <span>{day}</span>
                  <span className="text-xs font-normal opacity-90">({byDay.get(i)!.length} أعمال)</span>
                </div>
                <ul className="divide-y divide-edge">
                  {byDay.get(i)!.map((s) => {
                    const latestEp = s.episodes[0];
                    const epText = latestEp
                      ? latestEp.displayNum || (latestEp.number != null ? `الحلقة ${latestEp.number}` : latestEp.label || 'إصدار جديد')
                      : '—';
                    return (
                      <li key={s.key}>
                        <Link href={`/anime/${s.slug}/`} className="block p-3.5 hover:bg-panel transition-colors">
                          <p dir="ltr" className="text-sm font-medium text-end line-clamp-1">
                            {s.title}
                          </p>
                          <p className="text-xs text-accent mt-1 flex items-center justify-between">
                            <span className="text-muted text-[11px]">آخر إصدار:</span>
                            <span className="font-medium">{epText}</span>
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
