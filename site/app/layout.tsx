import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Rhythm-Sub | ترجمة الأنمي العربية', template: '%s | Rhythm-Sub' },
  description: 'الموقع الرسمي لفرقة Rhythm-Sub لترجمة الأنمي — تحميل الحلقات المترجمة بروابط مباشرة وتورنت',
  icons: { icon: [{ url: '/favicon-32.png' }, { url: '/favicon-192.png', sizes: '192x192' }] }
};

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Rhythm-Sub" className="h-10 w-auto" />
    </Link>
  );
}

const NAV = [
  { href: '/', label: 'الرئيسية' },
  { href: '/list', label: 'قائمة الأنمي' },
  { href: '/schedule', label: 'جدول الحلقات' },
  { href: '/advanced-search', label: 'البحث المتقدم' },
  { href: '/about', label: 'من نحن' }
];

function SearchForm({ className = '' }: { className?: string }) {
  return (
    <form action="/search" className={`relative ${className}`}>
      <input
        type="search"
        name="q"
        placeholder="ابحث عن أنمي..."
        aria-label="بحث"
        className="w-full bg-card border border-edge rounded-xl ps-9 pe-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
      />
      <svg viewBox="0 0 24 24" className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
    </form>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans antialiased">
        <header className="glass sticky top-0 z-50 border-b border-edge/70">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
            <Logo />
            <nav className="hidden lg:flex items-center gap-1 text-sm text-muted">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="px-3 py-2 rounded-lg hover:text-ink hover:bg-card transition-colors whitespace-nowrap">
                  {n.label}
                </Link>
              ))}
              <Link href="/random" className="px-3 py-2 rounded-lg hover:text-ink hover:bg-card transition-colors whitespace-nowrap">
                فاجئني 🎲
              </Link>
            </nav>
            <div className="ms-auto flex items-center gap-2 w-full max-w-[220px] lg:max-w-[280px]">
              <SearchForm className="hidden sm:block flex-1" />
              <a
                href="https://rhythm-sub.com/wp-login.php"
                className="btn-accent text-sm font-medium px-4 py-2 rounded-xl whitespace-nowrap"
              >
                تسجيل الدخول
              </a>
            </div>
            <details className="lg:hidden relative">
              <summary className="list-none w-10 h-10 grid place-items-center rounded-xl border border-edge cursor-pointer hover:border-accent transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </summary>
              <div className="absolute end-0 top-12 w-56 glass border border-edge rounded-2xl p-2 shadow-2xl">
                {[...NAV, { href: '/random', label: 'فاجئني 🎲' }, { href: '/support', label: 'الدعم الفني' }].map((n) => (
                  <Link key={n.href} href={n.href} className="block px-3 py-2.5 rounded-xl text-sm hover:bg-card hover:text-accent transition-colors">
                    {n.label}
                  </Link>
                ))}
                <div className="sm:hidden p-2">
                  <SearchForm />
                </div>
              </div>
            </details>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t border-edge mt-16">
          <div className="max-w-7xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-8 text-sm">
            <div>
              <Logo />
              <p className="text-muted mt-3 leading-relaxed text-xs">
                فرقة ترجمة أنمي عربية — تأسست عام 2012، وانطلق موقعها عام 2020.
              </p>
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
            <div>
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
            <p className="text-[11px]">
              بكل فخر{' '}
              <a href="http://maz-software.com/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                Rhythm-sub || Abdulla Sensei || MAZ-Software
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
