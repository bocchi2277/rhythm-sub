import { sitePage, mappedHtml } from '@/lib/data';

export const metadata = { title: 'الدعم الفني' };

export default function SupportPage() {
  const page = sitePage('support');
  let html = mappedHtml(page?.contentHtml ?? '');
  const hasForm = /<form[\s>]/i.test(html);
  html = html.replace(/<form[\s\S]*?<\/form>/gi, '');

  return (
    <div className="max-w-4xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold mb-6">{page?.title || 'الدعم الفني'}</h1>

      {page && (
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
