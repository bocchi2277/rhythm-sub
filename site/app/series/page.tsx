import Link from 'next/link';
import { franchises, formatWorksCount, img } from '@/lib/data';

export const metadata = { title: 'السلاسل' };

export default function SeriesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold mb-8">السلاسل</h1>

      <div className="space-y-10">
        {franchises.map((f) => (
          <section key={f.name}>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-3">
              <span className="w-1.5 h-5 rounded-full btn-accent block" />
              <span dir="ltr">{f.name}</span>
              <span className="text-muted text-sm font-normal">({formatWorksCount(f.works.length)})</span>
            </h2>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
              {f.works.map((s) => (
                <Link
                  key={s.key}
                  href={`/anime/${s.slug}/`}
                  className="card-hover group shrink-0 w-[150px] bg-card rounded-2xl overflow-hidden border border-edge"
                >
                  <div className="relative aspect-[2/3] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img(s.cover)}
                      alt={s.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    {s.rating != null && (
                      <span className="absolute bottom-2 start-2 text-xs font-bold px-2 py-1 rounded-lg glass border border-edge">
                        ★ {s.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p dir="ltr" className="clamp-2-hard p-2.5 text-xs font-medium leading-snug text-left group-hover:text-accent transition-colors" title={s.title}>
                    {s.title}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
