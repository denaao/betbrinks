'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const ADMIN_NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: '□' },
  { label: 'CRM / Usuarios', href: '/dashboard/crm', icon: '◉' },
  { label: 'Financeiro', href: '/dashboard/financial', icon: '$' },
  { label: 'Apostas', href: '/dashboard/bets', icon: '🎰' },
  { label: 'Jogos / Fixtures', href: '/dashboard/fixtures', icon: '⚽' },
  { label: 'Modalidades', href: '/dashboard/sports', icon: '🎯' },
  { label: 'Ligas', href: '/dashboard/leagues', icon: '🏆' },
  { label: 'Ligas Privadas', href: '/dashboard/private-leagues', icon: '🎲' },
  { label: 'Configuracoes', href: '/dashboard/settings', icon: '⚙' },
  { label: 'Audit Log', href: '/dashboard/audit', icon: '⎔' },
];

const OWNER_NAV = [
  { label: 'Minha Liga', href: '/dashboard/owner', icon: '👑' },
  { label: 'Apostas', href: '/dashboard/owner/bets', icon: '🎰' },
  { label: 'Membros', href: '/dashboard/owner/crm', icon: '◉' },
  { label: 'Financeiro', href: '/dashboard/owner/financial', icon: '$' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    try {
      const roleStr = localStorage.getItem('admin_role');
      const userStr = localStorage.getItem('admin_user');
      if (roleStr) {
        const role = JSON.parse(roleStr);
        setIsAdmin(role.isAdmin === true);
        setIsOwner(role.isOwner === true);
        setIsAffiliate(role.isAffiliate === true);
      }
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserName(user.name || '');
      }
    } catch {}
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_role');
    document.cookie = 'admin_token=; path=/; max-age=0';
    router.push('/login');
  };

  return (
    <aside className="w-64 min-h-screen flex flex-col" style={{ background: '#1E1E38', borderRight: '1px solid #2A2A45' }}>
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#2A2A45] flex items-center gap-3">
        <img
          src="/logo.png"
          alt="BetBrinks"
          className="w-10 h-10 rounded-lg object-contain"
          style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}
        />
        <div>
          <h1 className="text-sm font-extrabold text-white tracking-tight">BetBrinks</h1>
          <p className="text-[10px] font-medium" style={{ color: '#C4956A' }}>
            {isAdmin ? 'Admin' : 'Painel do Owner'}
          </p>
        </div>
      </div>

      {/* User */}
      {userName && (
        <div className="px-5 py-3 border-b border-[#2A2A45]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#14142B', color: '#C4956A', border: '1px solid #2A2A45' }}>
              {userName[0]}
            </div>
            <div>
              <p className="text-xs font-semibold text-white/90 truncate max-w-[150px]">{userName}</p>
              <p className="text-[10px] text-white/30">
                {isAdmin ? 'Administrador' : isOwner ? 'Owner' : 'Usuário'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {isAdmin && isOwner && (
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/20">
            Plataforma
          </div>
        )}
        {isAdmin && ADMIN_NAV.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && !pathname.startsWith('/dashboard/owner'));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'text-white shadow-md'
                  : 'text-white/40 hover:text-white/80 hover:bg-[#2A2A45]'
              }`}
              style={isActive ? { background: '#2A2A45' } : undefined}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        {isOwner && (
          <>
            {isAdmin && (
              <div className="px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: '#C4956A', borderTop: '1px solid #2A2A45' }}>
                Minha Liga
              </div>
            )}
            {OWNER_NAV.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard/owner' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white shadow-md'
                      : 'text-white/40 hover:text-white/80 hover:bg-[#2A2A45]'
                  }`}
                  style={isActive ? { background: '#2A2A45', borderLeft: '3px solid #C4956A' } : undefined}
                >
                  <span className="text-base w-5 text-center">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Affiliate Link */}
      {isAffiliate && (
        <div className="px-3 py-2 border-t border-[#2A2A45]">
          <Link
            href="/affiliate"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-[#2A2A45]"
            style={{ color: '#C4956A' }}
          >
            <span>📣</span>
            Painel Afiliado
          </Link>
        </div>
      )}

      {/* Logout */}
      <div className="px-3 py-4 border-t border-[#2A2A45]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/30 hover:text-red-400 hover:bg-[#2A2A45] transition-colors"
        >
          <span>↪</span>
          Sair
        </button>
      </div>
    </aside>
  );
}
