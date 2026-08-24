import { sitePage, mappedHtml } from '@/lib/data';

export const metadata = { title: 'من نحن' };

export default function AboutPage() {
  const page = sitePage('about');

  return (
    <div className="max-w-4xl mx-auto px-4 mt-6">
      <div className="glass border border-edge rounded-3xl p-8 md:p-10 text-center fade-up">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Rhythm-Sub" className="h-20 w-auto mx-auto" />
        <h1 className="text-3xl font-bold mt-4">{page?.title || 'من نحن'}</h1>
      </div>

      {page && (
        <div
          className="prose-rtl bg-card border border-edge rounded-2xl p-6 md:p-10 mt-6 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: mappedHtml(page.contentHtml) }}
        />
      )}
    </div>
  );
}
