'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: '□' },
  { label: 'CRM / Usuarios', href: '/dashboard/crm', icon: '◉' },
  { label: 'Financeiro', href: '/dashboard/financial', icon: '$' },
  { label: 'Jogos / Fixtures', href: '/dashboard/fixtures', icon: '⚽' },
  { label: 'Modalidades', href: '/dashboard/sports', icon: '🎯' },
  { label: 'Ligas', href: '/dashboard/leagues', icon: '🏆' },
  { label: 'Configuracoes', href: '/dashboard/settings', icon: '⚙' },
  { label: 'Audit Log', href: '/dashboard/audit', icon: '⎔' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-gray-900 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <h1 className="text-xl font-extrabold text-white">betbrinks</h1>
        <p className="text-xs text-gray-500 mt-0.5">Backoffice</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors"
        >
          <span>↪</span>
          Sair
        </button>
      </div>
    </aside>
  );
}
