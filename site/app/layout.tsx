import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Rhythm-Sub | ترجمة الأنمي العربية', template: '%s | Rhythm-Sub' },
  description: 'الموقع الرسمي لفرقة Rhythm-Sub لترجمة الأنمي — تحميل الحلقات المترجمة بروابط مباشرة وتورنت'
};

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0">
      <span className="w-9 h-9 rounded-xl btn-accent grid place-items-center font-bold text-lg">R</span>
      <span className="font-bold text-xl tracking-tight">
        Rhythm<span className="text-accent">-Sub</span>
      </span>
    </Link>
  );
}

const NAV = [
  { href: '/', label: 'الرئيسية' },
  { href: '/list', label: 'قائمة الأنمي' },
  { href: '/advanced-search', label: 'البحث المتقدم' },
  { href: '/schedule', label: 'جدول الحلقات' },
  { href: '/about', label: 'عن الفريق' }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans antialiased">
        <header className="glass sticky top-0 z-50 border-b border-edge/70">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-6">
            <Logo />
            <nav className="hidden md:flex items-center gap-1 text-sm text-muted">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="px-3 py-2 rounded-lg hover:text-ink hover:bg-card transition-colors">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ms-auto flex items-center gap-2">
              <Link href="/advanced-search" className="btn-accent text-sm font-medium px-4 py-2 rounded-xl">
                تحميل الآن
              </Link>
            </div>
          </div>
          <nav className="md:hidden flex gap-1 overflow-x-auto no-scrollbar px-3 pb-2 text-xs text-muted">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="px-3 py-1.5 rounded-lg bg-card whitespace-nowrap">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main>{children}</main>
        <footer className="border-t border-edge mt-16">
          <div className="max-w-7xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-8 text-sm">
            <div>
              <Logo />
              <p className="text-muted mt-3 leading-relaxed">
                فرقة عربية متخصصة في ترجمة الأنمي بأعلى جودة منذ 2019.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-3">تصفح</h4>
              <ul className="space-y-2 text-muted">
                <li><Link href="/list" className="hover:text-accent">قائمة الأنمي</Link></li>
                <li><Link href="/schedule" className="hover:text-accent">جدول الحلقات</Link></li>
                <li><Link href="/advanced-search" className="hover:text-accent">بحث متقدم</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-3">الفريق</h4>
              <ul className="space-y-2 text-muted">
                <li><Link href="/about" className="hover:text-accent">من نحن</Link></li>
                <li><Link href="/support" className="hover:text-accent">الدعم الفني</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-edge py-4 text-center text-xs text-muted">
            © {new Date().getFullYear()} Rhythm-Sub — جميع الحقوق محفوظة للفريق
          </div>
        </footer>
      </body>
    </html>
  );
}
