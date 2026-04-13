'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

interface PrivateLeague {
  id: string;
  name: string;
  ownerId: string;
  ownerName?: string;
  inviteCode: string;
  cashbox: number;
  cashboxInitial: number;
  status: 'OPEN' | 'CLOSED';
  memberCount: number;
  createdAt: string;
  updatedAt?: string;
}

interface LeagueDetail extends PrivateLeague {
  members?: Member[];
  cashboxLogs?: CashboxLog[];
}

interface Member {
  userId: string;
  username: string;
  balance: number;
  joinedAt: string;
}

interface CashboxLog {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

interface Modal {
  isOpen: boolean;
  league: LeagueDetail | null;
  loading: boolean;
}

export default function PrivateLeaguesPage() {
  const [leagues, setLeagues] = useState<PrivateLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'OPEN' | 'CLOSED'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modal, setModal] = useState<Modal>({ isOpen: false, league: null, loading: false });

  const limit = 20;

  const loadLeagues = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (search) params.search = search;
      if (filterStatus !== 'all') params.status = filterStatus;

      const { data: axiosData } = await api.get('/admin/private-leagues', { params });
      const wrapped = axiosData.data || axiosData;
      const list = wrapped.data || wrapped.leagues || wrapped.items || wrapped;

      setLeagues(Array.isArray(list) ? list : []);
      setTotalPages(wrapped.totalPages || axiosData.totalPages || 1);
    } catch {
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus]);

  useEffect(() => {
    loadLeagues();
  }, [loadLeagues]);

  const openModal = async (league: PrivateLeague) => {
    setModal({ isOpen: true, league: league as LeagueDetail, loading: true });
    try {
      const { data: axiosData } = await api.get(`/admin/private-leagues/${league.id}`);
      const wrapped = axiosData.data || axiosData;
      const detail: LeagueDetail = wrapped.league || wrapped;

      setModal({
        isOpen: true,
        league: detail,
        loading: false,
      });
    } catch {
      setModal({ isOpen: true, league: league as LeagueDetail, loading: false });
    }
  };

  const closeModal = () => {
    setModal({ isOpen: false, league: null, loading: false });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getCashboxHealth = (cashbox: number, initial: number): { percent: number; color: string } => {
    if (initial === 0) return { percent: 0, color: 'bg-gray-300' };
    const percent = (cashbox / initial) * 100;
    if (percent > 50) return { percent: Math.min(percent, 100), color: 'bg-green-500' };
    if (percent >= 20) return { percent: Math.min(percent, 100), color: 'bg-yellow-500' };
    return { percent: Math.min(percent, 100), color: 'bg-red-500' };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#F0EAE0' }}>Ligas Privadas</h1>
          <p className="text-sm mt-1" style={{ color: '#9A94A8' }}>
            Gerencie todas as ligas privadas criadas pelos usuários
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
          <p className="text-xs font-medium uppercase" style={{ color: '#9A94A8' }}>Total de Ligas</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#F0EAE0' }}>{leagues.length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
          <p className="text-xs font-medium uppercase" style={{ color: 'text-green-400' }}>Ligas Abertas</p>
          <p className="text-2xl font-bold mt-1 text-green-400">
            {leagues.filter((l) => l.status === 'OPEN').length}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
          <p className="text-xs font-medium uppercase text-red-400">Ligas Fechadas</p>
          <p className="text-2xl font-bold mt-1 text-red-400">
            {leagues.filter((l) => l.status === 'CLOSED').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl p-4 mb-6" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome ou código..."
            style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder-gray-500"
          />
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as any);
              setPage(1);
            }}
            style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
            className="px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="all">Todos os status</option>
            <option value="OPEN">Abertas</option>
            <option value="CLOSED">Fechadas</option>
          </select>
          <span className="text-xs" style={{ color: '#9A94A8' }}>
            {leagues.length} ligas
          </span>
        </div>
      </div>

      {/* Leagues Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
        <table className="w-full text-sm">
          <thead style={{ background: '#14142B', borderBottom: '1px solid #2A2A45' }}>
            <tr>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Nome</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Proprietário</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Código Convite</th>
              <th className="text-right px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Caixa Atual</th>
              <th className="text-right px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Caixa Inicial</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Status</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Membros</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Data Criação</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin w-6 h-6 border-2 rounded-full" style={{ borderColor: '#2A2A45', borderTopColor: '#C4956A' }}></div>
                    <span style={{ color: '#9A94A8' }}>Carregando ligas...</span>
                  </div>
                </td>
              </tr>
            ) : leagues.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8" style={{ color: '#9A94A8' }}>
                  Nenhuma liga privada encontrada
                </td>
              </tr>
            ) : (
              leagues.map((league) => (
                <tr
                  key={league.id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid #2A2A45' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: '#F0EAE0' }}>{league.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs" style={{ color: '#9A94A8' }}>{league.ownerName || league.ownerId}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <code className="px-2 py-1 rounded text-xs font-mono" style={{ background: '#14142B', color: '#C4956A', border: '1px solid #2A2A45' }}>
                      {league.inviteCode}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold" style={{ color: '#F0EAE0' }}>
                      {formatCurrency(league.cashbox)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-xs" style={{ color: '#9A94A8' }}>
                      {formatCurrency(league.cashboxInitial)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full"
                      style={{
                        background: league.status === 'OPEN' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)',
                        color: league.status === 'OPEN' ? '#4ade80' : '#f87171'
                      }}
                    >
                      {league.status === 'OPEN' ? 'Aberta' : 'Fechada'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold" style={{ color: '#C4956A' }}>
                      {league.memberCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#9A94A8' }}>
                    {formatDate(league.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openModal(league)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white hover:bg-brand-500 transition-colors"
                      style={{ background: '#C4956A' }}
                    >
                      Detalhes
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm" style={{ color: '#9A94A8' }}>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 text-sm rounded-lg disabled:opacity-40 transition-colors"
              style={{ background: '#1E1E38', border: '1px solid #2A2A45', color: '#F0EAE0' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#1E1E38')}
            >
              Anterior
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 text-sm rounded-lg disabled:opacity-40 transition-colors"
              style={{ background: '#1E1E38', border: '1px solid #2A2A45', color: '#F0EAE0' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#1E1E38')}
            >
              Próximo
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {modal.isOpen && modal.league && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ background: '#1E1E38', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 sticky top-0" style={{ borderBottom: '1px solid #2A2A45', background: '#1E1E38' }}>
              <h2 className="text-xl font-bold" style={{ color: '#F0EAE0' }}>{modal.league.name}</h2>
              <button
                onClick={closeModal}
                className="text-2xl leading-none transition-colors"
                style={{ color: '#9A94A8' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#F0EAE0')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9A94A8')}
              >
                ×
              </button>
            </div>

            {modal.loading ? (
              <div className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin w-8 h-8 border-[3px] rounded-full" style={{ borderColor: '#2A2A45', borderTopColor: '#C4956A' }}></div>
                  <p style={{ color: '#9A94A8' }}>Carregando detalhes...</p>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* League Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase mb-1" style={{ color: '#9A94A8' }}>Nome</p>
                    <p className="text-sm font-semibold" style={{ color: '#F0EAE0' }}>{modal.league.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase mb-1" style={{ color: '#9A94A8' }}>Proprietário</p>
                    <p className="text-sm font-semibold" style={{ color: '#F0EAE0' }}>
                      {modal.league.ownerName || modal.league.ownerId}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase mb-1" style={{ color: '#9A94A8' }}>Código Convite</p>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 rounded text-xs font-mono" style={{ background: '#14142B', color: '#C4956A', border: '1px solid #2A2A45' }}>
                        {modal.league.inviteCode}
                      </code>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase mb-1" style={{ color: '#9A94A8' }}>Status</p>
                    <span
                      className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full"
                      style={{
                        background: modal.league.status === 'OPEN' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)',
                        color: modal.league.status === 'OPEN' ? '#4ade80' : '#f87171'
                      }}
                    >
                      {modal.league.status === 'OPEN' ? 'Aberta' : 'Fechada'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase mb-1" style={{ color: '#9A94A8' }}>Data de Criação</p>
                    <p className="text-sm font-semibold" style={{ color: '#F0EAE0' }}>
                      {formatDate(modal.league.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase mb-1" style={{ color: '#9A94A8' }}>Total de Membros</p>
                    <p className="text-sm font-semibold" style={{ color: '#C4956A' }}>{modal.league.memberCount}</p>
                  </div>
                </div>

                {/* Cashbox Health */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium uppercase" style={{ color: '#9A94A8' }}>Saúde da Caixa</p>
                      <span className="text-sm font-semibold" style={{ color: '#F0EAE0' }}>
                        {formatCurrency(modal.league.cashbox)} / {formatCurrency(modal.league.cashboxInitial)}
                      </span>
                    </div>
                    {(() => {
                      const health = getCashboxHealth(modal.league.cashbox, modal.league.cashboxInitial);
                      return (
                        <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: '#14142B' }}>
                          <div
                            className={`h-full transition-all ${health.color}`}
                            style={{ width: `${health.percent}%` }}
                          ></div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p style={{ color: '#9A94A8' }}>Caixa Atual</p>
                      <p className="font-bold" style={{ color: '#F0EAE0' }}>{formatCurrency(modal.league.cashbox)}</p>
                    </div>
                    <div>
                      <p style={{ color: '#9A94A8' }}>Caixa Inicial</p>
                      <p className="font-bold" style={{ color: '#F0EAE0' }}>{formatCurrency(modal.league.cashboxInitial)}</p>
                    </div>
                    <div>
                      <p style={{ color: '#9A94A8' }}>Diferença</p>
                      <p className="font-bold" style={{ color: modal.league.cashbox < modal.league.cashboxInitial ? '#f87171' : '#4ade80' }}>
                        {formatCurrency(modal.league.cashbox - modal.league.cashboxInitial)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cashbox Logs */}
                {modal.league.cashboxLogs && modal.league.cashboxLogs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold mb-3" style={{ color: '#F0EAE0' }}>Histórico da Caixa</h3>
                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      {modal.league.cashboxLogs.map((log, idx) => (
                        <div
                          key={`${log.id}-${idx}`}
                          className="flex items-center justify-between p-3 rounded-lg"
                          style={{ background: '#14142B', border: '1px solid #2A2A45' }}
                        >
                          <div className="flex-1">
                            <p className="text-xs font-semibold" style={{ color: '#F0EAE0' }}>{log.type}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#9A94A8' }}>{log.description}</p>
                          </div>
                          <div className="text-right">
                            <p
                              className="text-sm font-bold"
                              style={{ color: log.amount >= 0 ? '#4ade80' : '#f87171' }}
                            >
                              {log.amount >= 0 ? '+' : ''}{formatCurrency(log.amount)}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: '#9A94A8' }}>
                              {formatDate(log.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Members List */}
                {modal.league.members && modal.league.members.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold mb-3" style={{ color: '#F0EAE0' }}>Membros ({modal.league.members.length})</h3>
                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      {modal.league.members.map((member, idx) => (
                        <div
                          key={`${member.userId}-${idx}`}
                          className="flex items-center justify-between p-3 rounded-lg"
                          style={{ background: '#14142B', border: '1px solid #2A2A45' }}
                        >
                          <div>
                            <p className="text-sm font-semibold" style={{ color: '#F0EAE0' }}>{member.username}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#9A94A8' }}>
                              Entrou em {formatDate(member.joinedAt)}
                            </p>
                          </div>
                          <p className="text-sm font-bold" style={{ color: '#C4956A' }}>
                            {formatCurrency(member.balance)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!modal.league.members || modal.league.members.length === 0) &&
                  (!modal.league.cashboxLogs || modal.league.cashboxLogs.length === 0) && (
                  <div className="text-center py-8 text-sm" style={{ color: '#9A94A8' }}>
                    Nenhum dado disponível
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-6" style={{ borderTop: '1px solid #2A2A45', background: '#14142B' }}>
              <div className="flex justify-end">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
                  style={{ background: '#2A2A45', color: '#F0EAE0' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#3A3A55')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#2A2A45')}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
