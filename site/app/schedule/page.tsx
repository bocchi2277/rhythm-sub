import Link from 'next/link';
import { currentProjects, allSeries } from '@/lib/data';

export const metadata = { title: 'جدول الحلقات' };

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function weekdayOf(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCDay();
}

function isFresh(iso: string | null): boolean {
  if (!iso) return false;
  const diff = Date.now() - new Date(iso).getTime();
  return diff >= 0 && diff < 21 * 24 * 3600 * 1000;
}

export default function SchedulePage() {
  const active = currentProjects.filter((s) => s.episodes.length > 0 && s.episodes.some((e) => isFresh(e.date)));
  const source = active.length ? active : currentProjects;

  const byDay = new Map<number, typeof allSeries>();
  for (const s of source) {
    const last = s.episodes[s.episodes.length - 1];
    const wd = weekdayOf(last?.date ?? s.lastReleaseAt);
    if (wd == null) continue;
    if (!byDay.has(wd)) byDay.set(wd, []);
    byDay.get(wd)!.push(s);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold mb-2">جدول الحلقات</h1>
      <p className="text-muted text-sm mb-8">
        توزيع الأعمال الجارية حسب يوم آخر إصدار — يتحدث تلقائياً مع كل حلقة جديدة
      </p>

      {byDay.size === 0 ? (
        <p className="text-muted">لا توجد أعمال جارية حالياً.</p>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {DAYS.map((day, i) =>
            byDay.has(i) ? (
              <div key={day} className="bg-card border border-edge rounded-2xl overflow-hidden">
                <div className="btn-accent px-4 py-3 font-bold text-sm">{day}</div>
                <ul className="divide-y divide-edge">
                  {byDay.get(i)!.map((s) => (
                    <li key={s.key}>
                      <Link href={`/anime/${s.slug}/`} className="block p-3.5 hover:bg-panel transition-colors">
                        <p dir="ltr" className="text-sm font-medium text-end line-clamp-1">
                          {s.title}
                        </p>
                        <p className="text-xs text-muted mt-1">آخر حلقة: {(s.episodes.at(-1)?.number != null) ? `#${s.episodes.at(-1)!.number}` : '—'}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
