'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface League { id: number; name: string; memberCount: number; }
interface LinkedAffiliate { affiliateId: number; code: string; name: string; }
interface Member {
  userId: number; name: string; cpf: string; email: string; phone: string;
  role: string; balance: number; totalBets: number;
  linkedAffiliate: LinkedAffiliate | null;
  joinedAt: string; lastLoginAt: string | null; createdAt: string;
}

export default function OwnerCrmPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedMember, setExpandedMember] = useState<number | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

  const apiFetch = useCallback(async (path: string) => {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Erro ao carregar dados');
    const json = await res.json();
    return json.data || json;
  }, [token]);

  // Load leagues
  useEffect(() => {
    apiFetch('/admin/owner/leagues').then((data) => {
      setLeagues(data);
      if (data.length > 0) setSelectedLeagueId(data[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [apiFetch]);

  // Load members
  useEffect(() => {
    if (!selectedLeagueId) return;
    setLoadingMembers(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (search) params.set('search', search);

    apiFetch(`/admin/owner/leagues/${selectedLeagueId}/members?${params}`).then((data) => {
      setMembers(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      setLoadingMembers(false);
    }).catch(() => setLoadingMembers(false));
  }, [selectedLeagueId, page, search, apiFetch]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64" style={{ color: '#9A94A8' }}>Carregando...</div>;
  }

  if (leagues.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-3">🏆</div>
          <div style={{ color: '#9A94A8' }}>Você não é owner de nenhuma liga.</div>
        </div>
      </div>
    );
  }

  const roleLabel = (role: string) => {
    if (role === 'OWNER') return { text: 'Owner', bg: 'rgba(196,149,106,0.15)', color: '#C4956A' };
    if (role === 'MANAGER') return { text: 'Gestor', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' };
    return { text: 'Membro', bg: 'rgba(255,255,255,0.08)', color: '#9A94A8' };
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#F0EAE0' }}>Membros da Liga</h1>
          <p className="text-sm mt-1" style={{ color: '#9A94A8' }}>Gerencie os membros, saldos e vínculos</p>
        </div>

        {leagues.length > 1 && (
          <select
            value={selectedLeagueId || ''}
            onChange={(e) => { setSelectedLeagueId(Number(e.target.value)); setPage(1); setSearch(''); setSearchInput(''); }}
            className="rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            style={{ background: '#1E1E38', border: '1px solid #2A2A45', color: '#F0EAE0' }}
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name} ({l.memberCount} membros)</option>
            ))}
          </select>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar por nome, CPF, email ou telefone..."
            className="w-full h-11 rounded-lg pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
          />
          <svg className="absolute left-3 top-3 w-5 h-5" style={{ color: '#9A94A8' }} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </div>
        <button
          onClick={handleSearch}
          className="px-5 h-11 font-semibold rounded-lg text-sm transition-colors text-white"
          style={{ background: '#C4956A' }}
        >
          Buscar
        </button>
        {search && (
          <button
            onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
            className="px-4 h-11 rounded-lg text-sm transition-colors"
            style={{ border: '1px solid #2A2A45', color: '#9A94A8' }}
          >
            Limpar
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm" style={{ color: '#9A94A8' }}>
          {total} membro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          {search && <span> para &ldquo;{search}&rdquo;</span>}
        </span>
      </div>

      {/* Members Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
        {loadingMembers ? (
          <div className="flex items-center justify-center h-40" style={{ color: '#9A94A8' }}>Carregando membros...</div>
        ) : members.length === 0 ? (
          <div className="flex items-center justify-center h-40" style={{ color: '#9A94A8' }}>Nenhum membro encontrado</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #2A2A45', background: '#14142B' }}>
                <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Membro</th>
                <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>CPF</th>
                <th className="text-center text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Cargo</th>
                <th className="text-right text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Saldo</th>
                <th className="text-right text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Apostas</th>
                <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Afiliado</th>
                <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Entrada</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const role = roleLabel(m.role);
                return (
                  <tr
                    key={m.userId}
                    className="transition-colors cursor-pointer hover:bg-white/5"
                    style={{ borderBottom: '1px solid #2A2A45' }}
                    onClick={() => setExpandedMember(expandedMember === m.userId ? null : m.userId)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: '#14142B', color: '#C4956A', border: '1px solid #2A2A45' }}>
                          {m.name?.[0] || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-sm" style={{ color: '#F0EAE0' }}>{m.name}</div>
                          {m.email && <div className="text-xs" style={{ color: '#9A94A8' }}>{m.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm font-mono" style={{ color: '#9A94A8' }}>{m.cpf || '—'}</td>
                    <td className="px-5 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: role.bg, color: role.color }}>
                        {role.text}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-sm text-green-400">
                      {m.balance.toLocaleString('pt-BR')} pts
                    </td>
                    <td className="px-5 py-3 text-right text-sm" style={{ color: '#F0EAE0' }}>
                      {m.totalBets}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      {m.linkedAffiliate ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(196,149,106,0.15)', color: '#C4956A' }}>{m.linkedAffiliate.code}</span>
                          <span className="text-xs" style={{ color: '#9A94A8' }}>{m.linkedAffiliate.name}</span>
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: '#9A94A8' }}>—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: '#9A94A8' }}>
                      {new Date(m.joinedAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm" style={{ color: '#9A94A8' }}>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-4 py-2 text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{ border: '1px solid #2A2A45', color: '#F0EAE0' }}
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{ border: '1px solid #2A2A45', color: '#F0EAE0' }}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
