import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <p className="text-7xl font-bold text-accent">404</p>
      <h1 className="text-xl font-bold mt-4">الصفحة غير موجودة</h1>
      <p className="text-muted text-sm mt-2">ربما تم نقل الصفحة أو أن الرابط غير صحيح</p>
      <Link href="/" className="btn-accent inline-block mt-6 px-6 py-3 rounded-xl text-sm font-bold">
        العودة للرئيسية
      </Link>
    </div>
  );
}
