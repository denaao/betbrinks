'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface BetUser { id: number; name: string; cpf: string; }
interface BetFixture {
  id: number; homeTeam: string; awayTeam: string; homeLogo: string | null; awayLogo: string | null;
  scoreHome: number | null; scoreAway: number | null; startAt: string; status: string;
  leagueName: string; sportKey: string;
}
interface BetOdd { name: string; value: number; marketType: string; }
interface BetLeague { id: number; name: string; }
interface BetAffiliate { code: string; name: string; }
interface BetItem {
  id: number; user: BetUser; fixture: BetFixture; odd: BetOdd;
  league: BetLeague | null; amount: number; oddValue: number;
  potentialReturn: number; status: string; affiliate: BetAffiliate | null;
  createdAt: string; settledAt: string | null;
}
interface BetStats { totalBets: number; totalWon: number; totalLost: number; totalPending: number; }
interface BetResponse {
  stats: BetStats;
  data: BetItem[];
  total: number; page: number; limit: number; totalPages: number;
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pendente', color: '#facc15', bg: 'rgba(250,204,21,0.15)' },
  WON: { label: 'Ganhou', color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
  LOST: { label: 'Perdeu', color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
  VOID: { label: 'Anulada', color: '#9A94A8', bg: 'rgba(255,255,255,0.08)' },
  CASHOUT: { label: 'Cashout', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)' },
};

const MARKET_LABELS: Record<string, string> = {
  MATCH_WINNER: 'Resultado',
  OVER_UNDER_25: 'Gols +/- 2.5',
  BOTH_TEAMS_SCORE: 'Ambos Marcam',
  DOUBLE_CHANCE: 'Dupla Chance',
  DRAW_NO_BET: 'Sem Empate',
};

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl p-4 flex-1 min-w-[140px]" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
      <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#9A94A8' }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: color || '#F0EAE0' }}>{value.toLocaleString('pt-BR')}</div>
    </div>
  );
}

export default function AdminBetsPage() {
  const [response, setResponse] = useState<BetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sportFilter, setSportFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

  const apiFetch = useCallback(async (path: string) => {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Erro ao carregar');
    const json = await res.json();
    return json.data || json;
  }, [token]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (search) params.set('search', search);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (sportFilter) params.set('sportKey', sportFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    apiFetch(`/admin/bets?${params}`).then((data) => {
      setResponse(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [page, search, statusFilter, sportFilter, dateFrom, dateTo, apiFetch]);

  const handleSearch = () => { setPage(1); setSearch(searchInput); };
  const clearFilters = () => {
    setSearchInput(''); setSearch(''); setStatusFilter('ALL');
    setSportFilter(''); setDateFrom(''); setDateTo(''); setPage(1);
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR');

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#F0EAE0' }}>Apostas</h1>
        <p className="text-sm mt-1" style={{ color: '#9A94A8' }}>Todas as apostas da plataforma</p>
      </div>

      {/* Stats */}
      {response?.stats && (
        <div className="flex gap-4 mb-6 flex-wrap">
          <StatCard label="Total" value={response.stats.totalBets} />
          <StatCard label="Pendentes" value={response.stats.totalPending} color="#facc15" />
          <StatCard label="Ganhas" value={response.stats.totalWon} color="#4ade80" />
          <StatCard label="Perdidas" value={response.stats.totalLost} color="#f87171" />
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl p-4 mb-5" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
        <div className="flex gap-3 flex-wrap items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold mb-1 block" style={{ color: '#9A94A8' }}>Buscar</label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Nome ou CPF do apostador..."
              className="w-full h-10 rounded-lg pl-3 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
            />
          </div>

          {/* Status */}
          <div className="min-w-[140px]">
            <label className="text-xs font-semibold mb-1 block" style={{ color: '#9A94A8' }}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full h-10 rounded-lg px-3 text-sm focus:outline-none"
              style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
            >
              <option value="ALL">Todos</option>
              <option value="PENDING">Pendente</option>
              <option value="WON">Ganhou</option>
              <option value="LOST">Perdeu</option>
              <option value="VOID">Anulada</option>
              <option value="CASHOUT">Cashout</option>
            </select>
          </div>

          {/* Sport */}
          <div className="min-w-[140px]">
            <label className="text-xs font-semibold mb-1 block" style={{ color: '#9A94A8' }}>Esporte</label>
            <select
              value={sportFilter}
              onChange={(e) => { setSportFilter(e.target.value); setPage(1); }}
              className="w-full h-10 rounded-lg px-3 text-sm focus:outline-none"
              style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
            >
              <option value="">Todos</option>
              <option value="football">Futebol</option>
              <option value="basketball">Basquete</option>
              <option value="tennis">Tênis</option>
              <option value="mma">MMA</option>
            </select>
          </div>

          {/* Date From */}
          <div className="min-w-[150px]">
            <label className="text-xs font-semibold mb-1 block" style={{ color: '#9A94A8' }}>De</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-full h-10 rounded-lg px-3 text-sm focus:outline-none"
              style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
            />
          </div>

          {/* Date To */}
          <div className="min-w-[150px]">
            <label className="text-xs font-semibold mb-1 block" style={{ color: '#9A94A8' }}>Até</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-full h-10 rounded-lg px-3 text-sm focus:outline-none"
              style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button onClick={handleSearch} className="h-10 px-4 rounded-lg text-sm font-semibold text-white" style={{ background: '#C4956A' }}>
              Buscar
            </button>
            <button onClick={clearFilters} className="h-10 px-4 rounded-lg text-sm" style={{ border: '1px solid #2A2A45', color: '#9A94A8' }}>
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Results count */}
      {response && (
        <div className="mb-3 text-sm" style={{ color: '#9A94A8' }}>
          {response.total} aposta{response.total !== 1 ? 's' : ''} encontrada{response.total !== 1 ? 's' : ''}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: '#9A94A8' }}>Carregando apostas...</div>
        ) : !response || response.data.length === 0 ? (
          <div className="flex items-center justify-center h-40" style={{ color: '#9A94A8' }}>Nenhuma aposta encontrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #2A2A45', background: '#14142B' }}>
                  <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#9A94A8' }}>Apostador</th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#9A94A8' }}>Jogo</th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#9A94A8' }}>Aposta</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#9A94A8' }}>Valor</th>
                  <th className="text-center text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#9A94A8' }}>Odd</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#9A94A8' }}>Retorno</th>
                  <th className="text-center text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#9A94A8' }}>Status</th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#9A94A8' }}>Liga</th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#9A94A8' }}>Afiliado</th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#9A94A8' }}>Data</th>
                </tr>
              </thead>
              <tbody>
                {response.data.map((bet) => {
                  const st = STATUS_STYLES[bet.status] || STATUS_STYLES.VOID;
                  return (
                    <tr key={bet.id} className="hover:bg-white/5 transition-colors" style={{ borderBottom: '1px solid #2A2A45' }}>
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium" style={{ color: '#F0EAE0' }}>{bet.user.name}</div>
                        <div className="text-xs font-mono" style={{ color: '#9A94A8' }}>{bet.user.cpf || '—'}</div>
                      </td>

                      {/* Fixture */}
                      <td className="px-4 py-3">
                        <div className="text-sm" style={{ color: '#F0EAE0' }}>
                          {bet.fixture.homeTeam} vs {bet.fixture.awayTeam}
                        </div>
                        <div className="text-xs" style={{ color: '#9A94A8' }}>
                          {bet.fixture.leagueName}
                          {bet.fixture.scoreHome !== null && (
                            <span className="ml-2 font-bold" style={{ color: '#60a5fa' }}>
                              {bet.fixture.scoreHome} x {bet.fixture.scoreAway}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Odd choice */}
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium" style={{ color: '#C4956A' }}>{bet.odd.name}</div>
                        <div className="text-xs" style={{ color: '#9A94A8' }}>{MARKET_LABELS[bet.odd.marketType] || bet.odd.marketType}</div>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right text-sm font-bold" style={{ color: '#F0EAE0' }}>
                        {fmt(bet.amount)} pts
                      </td>

                      {/* Odd value */}
                      <td className="px-4 py-3 text-center text-sm font-mono font-bold" style={{ color: '#facc15' }}>
                        {bet.oddValue.toFixed(2)}
                      </td>

                      {/* Potential return */}
                      <td className="px-4 py-3 text-right text-sm font-bold text-green-400">
                        {fmt(bet.potentialReturn)} pts
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      </td>

                      {/* League */}
                      <td className="px-4 py-3 text-sm" style={{ color: '#9A94A8' }}>
                        {bet.league?.name || '—'}
                      </td>

                      {/* Affiliate */}
                      <td className="px-4 py-3 text-sm">
                        {bet.affiliate ? (
                          <div>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(196,149,106,0.15)', color: '#C4956A' }}>
                              {bet.affiliate.code}
                            </span>
                            <div className="text-xs mt-0.5" style={{ color: '#9A94A8' }}>{bet.affiliate.name}</div>
                          </div>
                        ) : (
                          <span style={{ color: '#9A94A8' }}>—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#9A94A8' }}>
                        {new Date(bet.createdAt).toLocaleDateString('pt-BR')}
                        <div style={{ color: '#6B6580' }}>
                          {new Date(bet.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {response && response.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm" style={{ color: '#9A94A8' }}>
            Página {response.page} de {response.totalPages}
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
              onClick={() => setPage(Math.min(response.totalPages, page + 1))}
              disabled={page >= response.totalPages}
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
