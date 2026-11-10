import Link from 'next/link';
import { allSeries } from '@/lib/data';
import type { Episode, Series } from '@/lib/data';

export const metadata = { title: 'جدول الحلقات' };

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// Constructed once: `new Intl.DateTimeFormat` is expensive to build and this
// runs for every ongoing series on every build.
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: 'Asia/Riyadh'
});

const DAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function weekdayOf(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const dayName = WEEKDAY_FORMATTER.format(d);
    return DAY_MAP[dayName] ?? d.getDay();
  } catch {
    return d.getDay();
  }
}

/**
 * The newest episode that actually carries a date.
 *
 * `episodes[0]` is NOT reliable here: episodes are ordered by date first, but
 * an undated entry (a BD batch, a manually-added release) sorts by episode
 * number and can land at index 0. Using it would drop a perfectly valid
 * weekly series from the schedule.
 */
function newestDatedEpisode(episodes: Episode[]): Episode | null {
  for (const ep of episodes) {
    if (ep.date && !Number.isNaN(new Date(ep.date).getTime())) return ep;
  }
  return null;
}

export default function SchedulePage() {
  /* Only active ongoing episodic series releasing weekly in current broadcast period (الأعمال المستمرة الجارية فقط) */
  const ongoingSeries = allSeries
    .filter((s) => /ongoing|airing|currently/i.test(s.status ?? ''))
    .filter((s) => !/END$/i.test(s.title) && !/movie|film|فيلم/i.test(s.type?.text ?? ''))
    .filter((s) => !/\bBD\b|Vol\.|Blu-ray/i.test(s.title))
    .filter((s) => {
      const latest = newestDatedEpisode(s.episodes);
      if (!latest) return false;
      if (/\bBD\b|Vol\./i.test(latest.displayNum ?? '')) return false;
      return Date.now() - new Date(latest.date!).getTime() < 21 * 24 * 3600 * 1000;
    })
    .sort((a, b) => String(b.lastReleaseAt ?? '').localeCompare(String(a.lastReleaseAt ?? '')));

  const byDay = new Map<number, Series[]>();
  for (const s of ongoingSeries) {
    const latestEp = newestDatedEpisode(s.episodes);
    const wd = weekdayOf(latestEp?.date ?? s.lastReleaseAt);
    if (wd == null) continue;
    const bucket = byDay.get(wd);
    if (bucket) bucket.push(s);
    else byDay.set(wd, [s]);
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
                    const latestEp = newestDatedEpisode(s.episodes);
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
