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
          <h1 className="text-2xl font-bold text-gray-900">Ligas Privadas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie todas as ligas privadas criadas pelos usuários
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase">Total de Ligas</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{leagues.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-green-600 font-medium uppercase">Ligas Abertas</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {leagues.filter((l) => l.status === 'OPEN').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-red-600 font-medium uppercase">Ligas Fechadas</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {leagues.filter((l) => l.status === 'CLOSED').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome ou código..."
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-700 focus:border-transparent"
          />
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as any);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-700"
          >
            <option value="all">Todos os status</option>
            <option value="OPEN">Abertas</option>
            <option value="CLOSED">Fechadas</option>
          </select>
          <span className="text-xs text-gray-400">
            {leagues.length} ligas
          </span>
        </div>
      </div>

      {/* Leagues Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Nome</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Proprietário</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Código Convite</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Caixa Atual</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Caixa Inicial</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Membros</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Data Criação</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Ação</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-brand-700 rounded-full"></div>
                    Carregando ligas...
                  </div>
                </td>
              </tr>
            ) : leagues.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-gray-400">
                  Nenhuma liga privada encontrada
                </td>
              </tr>
            ) : (
              leagues.map((league) => (
                <tr
                  key={league.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{league.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-600 text-xs">{league.ownerName || league.ownerId}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono text-gray-700">
                      {league.inviteCode}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(league.cashbox)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-gray-600 text-xs">
                      {formatCurrency(league.cashboxInitial)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${
                        league.status === 'OPEN'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {league.status === 'OPEN' ? 'Aberta' : 'Fechada'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-brand-700">
                      {league.memberCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatDate(league.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openModal(league)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors"
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
          <span className="text-sm text-gray-500">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Anterior
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Próximo
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {modal.isOpen && modal.league && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">{modal.league.name}</h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {modal.loading ? (
              <div className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin w-8 h-8 border-3 border-gray-300 border-t-brand-700 rounded-full"></div>
                  <p className="text-gray-500">Carregando detalhes...</p>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* League Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase mb-1">Nome</p>
                    <p className="text-sm font-semibold text-gray-900">{modal.league.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase mb-1">Proprietário</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {modal.league.ownerName || modal.league.ownerId}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase mb-1">Código Convite</p>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono text-gray-700">
                        {modal.league.inviteCode}
                      </code>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase mb-1">Status</p>
                    <span
                      className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${
                        modal.league.status === 'OPEN'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {modal.league.status === 'OPEN' ? 'Aberta' : 'Fechada'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase mb-1">Data de Criação</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatDate(modal.league.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase mb-1">Total de Membros</p>
                    <p className="text-sm font-semibold text-brand-700">{modal.league.memberCount}</p>
                  </div>
                </div>

                {/* Cashbox Health */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500 font-medium uppercase">Saúde da Caixa</p>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(modal.league.cashbox)} / {formatCurrency(modal.league.cashboxInitial)}
                      </span>
                    </div>
                    {(() => {
                      const health = getCashboxHealth(modal.league.cashbox, modal.league.cashboxInitial);
                      return (
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
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
                      <p className="text-gray-500">Caixa Atual</p>
                      <p className="font-bold text-gray-900">{formatCurrency(modal.league.cashbox)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Caixa Inicial</p>
                      <p className="font-bold text-gray-900">{formatCurrency(modal.league.cashboxInitial)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Diferença</p>
                      <p className={`font-bold ${modal.league.cashbox < modal.league.cashboxInitial ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(modal.league.cashbox - modal.league.cashboxInitial)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cashbox Logs */}
                {modal.league.cashboxLogs && modal.league.cashboxLogs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Histórico da Caixa</h3>
                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      {modal.league.cashboxLogs.map((log, idx) => (
                        <div
                          key={`${log.id}-${idx}`}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                        >
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-gray-900">{log.type}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{log.description}</p>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-sm font-bold ${log.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}
                            >
                              {log.amount >= 0 ? '+' : ''}{formatCurrency(log.amount)}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
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
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Membros ({modal.league.members.length})</h3>
                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      {modal.league.members.map((member, idx) => (
                        <div
                          key={`${member.userId}-${idx}`}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{member.username}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Entrou em {formatDate(member.joinedAt)}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-brand-700">
                            {formatCurrency(member.balance)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!modal.league.members || modal.league.members.length === 0) &&
                  (!modal.league.cashboxLogs || modal.league.cashboxLogs.length === 0) && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Nenhum dado disponível
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="border-t border-gray-100 p-6 bg-gray-50 flex justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-gray-200 text-gray-900 hover:bg-gray-300 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
