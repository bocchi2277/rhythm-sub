import type { Metadata } from 'next';
import Link from 'next/link';
import Header, { Logo } from '@/components/Header';
import { socials } from '@/lib/data';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Rhythm-Sub', template: '%s | Rhythm-Sub' },
  description: 'الموقع الرسمي لفرقة Rhythm-Sub لترجمة الأنمي — تحميل الحلقات المترجمة بروابط مباشرة وتورنت',
  icons: { icon: [{ url: '/favicon-32.png' }, { url: '/favicon-192.png', sizes: '192x192' }] }
};

const SOCIAL_ICONS: Record<string, string> = {
  'twitter.com': 'M23 4.9c-.8.4-1.7.6-2.6.8a4.5 4.5 0 0 0 2-2.5c-.9.5-1.9.9-2.9 1.1a4.5 4.5 0 0 0-7.7 4.1A12.8 12.8 0 0 1 2.5 3.7a4.5 4.5 0 0 0 1.4 6 4.4 4.4 0 0 1-2-.5v.1a4.5 4.5 0 0 0 3.6 4.4 4.5 4.5 0 0 1-2 .1 4.5 4.5 0 0 0 4.2 3.1A9 9 0 0 1 1 18.6a12.7 12.7 0 0 0 6.9 2c8.3 0 12.8-6.9 12.8-12.8v-.6c.9-.6 1.6-1.4 2.3-2.3z',
  'discord': 'M20.3 4.4A19.8 19.8 0 0 0 15.4 3c-.2.4-.5.9-.6 1.3a18.3 18.3 0 0 0-5.5 0C9.1 3.9 8.8 3.4 8.6 3a19.7 19.7 0 0 0-4.9 1.5A20.3 20.3 0 0 0 .2 18.1a19.9 19.9 0 0 0 6 3c.5-.6.9-1.3 1.3-2-.7-.3-1.4-.6-2-1l.5-.4a14.2 14.2 0 0 0 12.1 0l.5.4c-.6.4-1.3.7-2 1 .4.7.8 1.4 1.3 2a19.8 19.8 0 0 0 6-3 20.2 20.2 0 0 0-3.6-13.7zM8.7 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4zm6.6 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4z',
  't.me': 'M21.9 3.4L1.6 11.2c-1.4.6-1.4 1.4-.2 1.7l5.2 1.6 2 6.2c.2.7.1 1 .9 1 .6 0 .8-.3 1.2-.6l2.7-2.6 5.6 4.1c1 .6 1.8.3 2-.9L24 4.6c.2-1.1-.4-1.6-2.1-1.2zM7.9 14.1l11.6-7.3c.6-.4 1.1-.2.7.2l-9.9 9 -.4 4-2-5.9z',
  'youtube.com': 'M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.5 15.5v-7l6.3 3.5-6.3 3.5z',
  'facebook.com': 'M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.6-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0 0 24 12z'
};

function socialIcon(href: string) {
  const key = Object.keys(SOCIAL_ICONS).find((k) => href.includes(k));
  return key ? SOCIAL_ICONS[key] : SOCIAL_ICONS['twitter.com'];
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans antialiased">
        <Header />
        <main>{children}</main>
        <footer className="border-t border-edge mt-16">
          <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
            <div className="col-span-2 md:col-span-1 flex flex-col items-center md:items-start text-center md:text-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Rhythm-Sub" className="h-24 w-auto" />
              {socials.length > 0 && (
                <div className="flex items-center gap-2 mt-4">
                  {socials.map((s) => (
                    <a
                      key={s.href}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label || s.href}
                      className="w-9 h-9 grid place-items-center rounded-xl bg-card border border-edge hover:border-accent hover:text-accent transition-colors"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                        <path d={socialIcon(s.href)} />
                      </svg>
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 className="font-bold mb-3">تصفح</h4>
              <ul className="space-y-2 text-muted">
                <li><Link href="/list" className="hover:text-accent">قائمة الأنمي</Link></li>
                <li><Link href="/schedule" className="hover:text-accent">جدول الحلقات</Link></li>
                <li><Link href="/advanced-search" className="hover:text-accent">بحث متقدم</Link></li>
                <li><Link href="/random" className="hover:text-accent">فاجئني</Link></li>
              </ul>
            </div>
            <div className="ms-auto md:ms-auto w-fit">
              <h4 className="font-bold mb-3">الفريق</h4>
              <ul className="space-y-2 text-muted">
                <li><Link href="/about" className="hover:text-accent">من نحن</Link></li>
                <li><Link href="/support" className="hover:text-accent">الدعم الفني</Link></li>
                <li><a href="https://rhythm-sub.com" className="hover:text-accent">الموقع الأصلي</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-edge py-5 px-4 text-center text-xs text-muted space-y-2">
            <p>جميع حقوق النشر محفوظة لـ Rhythm-Sub © 2020</p>
            <p className="text-[11px] opacity-80">تنويه: هذا الموقع لا يخزن أية ملفات على الخادم. جميع المحتويات يتم توفيرها من قبل أطرافٍ ثالثة غير تابعة.</p>
            <p className="text-[11px]">بكل فخر Rhythm-sub || Ox Alpha</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
