import { sitePage, mappedHtml, socials } from '@/lib/data';

export const metadata = { title: 'الدعم الفني' };

const SOCIAL_LABELS: Record<string, { label: string; icon: string }> = {
  't.me': { label: 'تيليغرام', icon: 'M21.9 3.4L1.6 11.2c-1.4.6-1.4 1.4-.2 1.7l5.2 1.6 2 6.2c.2.7.1 1 .9 1 .6 0 .8-.3 1.2-.6l2.7-2.6 5.6 4.1c1 .6 1.8.3 2-.9L24 4.6c.2-1.1-.4-1.6-2.1-1.2zM7.9 14.1l11.6-7.3c.6-.4 1.1-.2.7.2l-9.9 9 -.4 4-2-5.9z' },
  'discord': { label: 'ديسكورد', icon: 'M20.3 4.4A19.8 19.8 0 0 0 15.4 3c-.2.4-.5.9-.6 1.3a18.3 18.3 0 0 0-5.5 0C9.1 3.9 8.8 3.4 8.6 3a19.7 19.7 0 0 0-4.9 1.5A20.3 20.3 0 0 0 .2 18.1a19.9 19.9 0 0 0 6 3c.5-.6.9-1.3 1.3-2-.7-.3-1.4-.6-2-1l.5-.4a14.2 14.2 0 0 0 12.1 0l.5.4c-.6.4-1.3.7-2 1 .4.7.8 1.4 1.3 2a19.8 19.8 0 0 0 6-3 20.2 20.2 0 0 0-3.6-13.7zM8.7 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4zm6.6 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4z' },
  'twitter.com': { label: 'تويتر', icon: 'M23 4.9c-.8.4-1.7.6-2.6.8a4.5 4.5 0 0 0 2-2.5c-.9.5-1.9.9-2.9 1.1a4.5 4.5 0 0 0-7.7 4.1A12.8 12.8 0 0 1 2.5 3.7a4.5 4.5 0 0 0 1.4 6 4.4 4.4 0 0 1-2-.5v.1a4.5 4.5 0 0 0 3.6 4.4 4.5 4.5 0 0 1-2 .1 4.5 4.5 0 0 0 4.2 3.1A9 9 0 0 1 1 18.6a12.7 12.7 0 0 0 6.9 2c8.3 0 12.8-6.9 12.8-12.8v-.6c.9-.6 1.6-1.4 2.3-2.3z' }
};

export default function SupportPage() {
  const page = sitePage('support');
  let html = mappedHtml(page?.contentHtml ?? '');
  const hasForm = /<form[\s>]/i.test(html);
  html = html.replace(/<form[\s\S]*?<\/form>/gi, '');

  return (
    <div className="max-w-4xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold mb-6">{page?.title || 'الدعم الفني'}</h1>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {socials.map((s) => {
          const meta = Object.entries(SOCIAL_LABELS).find(([k]) => s.href.includes(k))?.[1];
          return (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="card-hover flex items-center justify-center gap-2 bg-card border border-edge rounded-2xl p-4 font-bold text-sm"
            >
              {meta && (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-accent">
                  <path d={meta.icon} />
                </svg>
              )}
              {meta?.label ?? 'قناة الفريق'}
            </a>
          );
        })}
      </div>

      {page && html && (
        <div
          className="prose-rtl bg-card border border-edge rounded-2xl p-6 md:p-10 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      {hasForm && (
        <div className="mt-6 glass border border-edge rounded-2xl p-6 text-center">
          <p className="text-sm text-muted mb-4">نموذج التواصل متاح حالياً على الموقع الأصلي حتى اكتمال انتقال البريد</p>
          <a
            href="https://rhythm-sub.com/technical-support/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent inline-block px-6 py-3 rounded-xl text-sm font-bold"
          >
            فتح نموذج التواصل الأصلي
          </a>
        </div>
      )}
    </div>
  );
}
