import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-8">
          <Link href="/admin" className="text-lg font-bold text-gray-900">
            追加質問管理
          </Link>
          <nav className="flex gap-6">
            <Link
              href="/admin"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              セッション一覧
            </Link>
            <Link
              href="/admin/new"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              新規作成
            </Link>
            <Link
              href="/admin/jobs"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              求人管理
            </Link>
            <Link
              href="/admin/templates"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              テンプレート管理
            </Link>
          </nav>
          <form method="POST" action="/api/admin/logout" className="ml-auto">
            <button
              type="submit"
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
