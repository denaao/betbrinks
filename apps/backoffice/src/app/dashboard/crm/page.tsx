'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role?: string;
  phoneVerified?: boolean;
  isVerified?: boolean;
  blocked?: boolean;
  createdAt: string;
  points?: number;
  diamonds?: number;
  balance?: { points: number; diamonds: number };
}

interface UserDetail extends User {
  xp: number;
  level: number;
  bets: any[];
  transactions: any[];
  purchases: any[];
  achievements: any[];
  stats: { totalBets: number; wonBets: number; lostBets: number; winRate: number };
}

export default function CRMPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [detailTab, setDetailTab] = useState<'info' | 'bets' | 'transactions' | 'achievements'>('info');
  const limit = 15;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (search) params.search = search;
      const { data: axiosData } = await api.get('/admin/users', { params });
      // API: { success, data: { data: [...], total, totalPages } }
      const wrapped = axiosData.data || axiosData;
      const list = wrapped.data || wrapped.users || wrapped.items || wrapped;
      setUsers(Array.isArray(list) ? list : []);
      setTotal(wrapped.total || 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const openDetail = async (userId: string) => {
    setDetailLoading(true);
    setSelectedUser(null);
    setDetailTab('info');
    try {
      const { data } = await api.get(`/admin/users/${userId}`);
      setSelectedUser(data.data || data);
    } catch {
      // silent
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBlock = async (userId: string, blocked: boolean) => {
    try {
      await api.post(`/admin/users/${userId}/block`, { blocked });
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({ ...selectedUser, blocked });
      }
      loadUsers();
    } catch {
      // silent
    }
  };

  const handleAdjustPoints = async () => {
    if (!selectedUser || !adjustAmount) return;
    try {
      await api.post(`/admin/users/${selectedUser.id}/adjust-points`, {
        amount: Number(adjustAmount),
        reason: adjustReason || 'Ajuste manual pelo admin',
      });
      setAdjustAmount('');
      setAdjustReason('');
      openDetail(selectedUser.id);
    } catch {
      // silent
    }
  };

  const totalPages = Math.ceil(total / limit);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const formatCurrency = (v: number | undefined | null) =>
    (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">CRM / Usuarios</h1>

      {/* Search Bar */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Buscar por nome, email ou telefone..."
          className="flex-1 h-11 border border-gray-200 rounded-lg px-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          onClick={handleSearch}
          className="px-6 h-11 bg-brand-700 text-white text-sm font-semibold rounded-lg hover:bg-brand-800 transition-colors"
        >
          Buscar
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Nome</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Telefone</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Pontos</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Cadastro</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400">Carregando...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400">Nenhum usuario encontrado</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3 text-gray-600">{user.phone}</td>
                  <td className="px-4 py-3 text-center font-medium text-brand-700">
                    {(user.points ?? user.balance?.points ?? 0).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user.blocked ? (
                      <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">Bloqueado</span>
                    ) : (user.isVerified ?? user.phoneVerified) ? (
                      <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Ativo</span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">Pendente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openDetail(user.id)}
                      className="text-brand-700 hover:text-brand-900 font-semibold text-xs"
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">{total} usuarios encontrados</p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Anterior
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Proximo
            </button>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {(selectedUser || detailLoading) && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-12 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 mb-12">
            {detailLoading ? (
              <div className="p-12 text-center text-gray-400">Carregando detalhes...</div>
            ) : selectedUser ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedUser.name}</h2>
                    <p className="text-sm text-gray-500">{selectedUser.email} | {selectedUser.phone}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleBlock(selectedUser.id, !selectedUser.blocked)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        selectedUser.blocked
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {selectedUser.blocked ? 'Desbloquear' : 'Bloquear'}
                    </button>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                  {(['info', 'bets', 'transactions', 'achievements'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab)}
                      className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                        detailTab === tab
                          ? 'text-brand-700 border-b-2 border-brand-700'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {tab === 'info' && 'Informacoes'}
                      {tab === 'bets' && 'Apostas'}
                      {tab === 'transactions' && 'Transacoes'}
                      {tab === 'achievements' && 'Conquistas'}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {detailTab === 'info' && (
                    <div className="space-y-6">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500">Pontos</p>
                          <p className="text-lg font-bold text-brand-700">
                            {(selectedUser.balance?.points || 0).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500">Diamantes</p>
                          <p className="text-lg font-bold text-cyan-600">
                            {(selectedUser.balance?.diamonds || 0).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500">Level</p>
                          <p className="text-lg font-bold text-amber-600">{selectedUser.level}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500">XP</p>
                          <p className="text-lg font-bold text-gray-700">{selectedUser.xp?.toLocaleString('pt-BR')}</p>
                        </div>
                      </div>

                      {/* Bet Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500">Total Apostas</p>
                          <p className="text-lg font-bold text-blue-700">{selectedUser.stats?.totalBets || 0}</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500">Ganhas</p>
                          <p className="text-lg font-bold text-green-700">{selectedUser.stats?.wonBets || 0}</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500">Perdidas</p>
                          <p className="text-lg font-bold text-red-700">{selectedUser.stats?.lostBets || 0}</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500">Win Rate</p>
                          <p className="text-lg font-bold text-purple-700">
                            {((selectedUser.stats?.winRate || 0) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      {/* Adjust Points */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Ajustar Pontos</h4>
                        <div className="flex gap-3">
                          <input
                            type="number"
                            value={adjustAmount}
                            onChange={(e) => setAdjustAmount(e.target.value)}
                            placeholder="Quantidade (negativo para debitar)"
                            className="flex-1 h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <input
                            type="text"
                            value={adjustReason}
                            onChange={(e) => setAdjustReason(e.target.value)}
                            placeholder="Motivo"
                            className="flex-1 h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <button
                            onClick={handleAdjustPoints}
                            className="px-4 h-10 bg-brand-700 text-white text-sm font-semibold rounded-lg hover:bg-brand-800"
                          >
                            Ajustar
                          </button>
                        </div>
                      </div>

                      {/* User Meta */}
                      <div className="text-sm text-gray-500 space-y-1">
                        <p>ID: <span className="font-mono text-gray-700">{selectedUser.id}</span></p>
                        <p>Cadastro: {formatDate(selectedUser.createdAt)}</p>
                        <p>Telefone verificado: {selectedUser.phoneVerified ? 'Sim' : 'Nao'}</p>
                        <p>Status: {selectedUser.blocked ? 'Bloqueado' : 'Ativo'}</p>
                      </div>
                    </div>
                  )}

                  {detailTab === 'bets' && (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {(selectedUser.bets || []).length === 0 ? (
                        <p className="text-center text-gray-400 py-8">Nenhuma aposta encontrada</p>
                      ) : (
                        selectedUser.bets.map((bet: any, i: number) => {
                          const fix = bet.fixture || bet.odd?.fixture;
                          const home = fix?.homeTeam || '—';
                          const away = fix?.awayTeam || '—';
                          const sH = fix?.scoreHome;
                          const sA = fix?.scoreAway;
                          const score = sH != null && sA != null ? `${sH} x ${sA}` : null;
                          const league = fix?.leagueName;
                          const betDate = bet.createdAt ? new Date(bet.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                          const matchDate = fix?.startAt ? new Date(fix.startAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

                          return (
                            <div key={i} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-semibold text-gray-900">
                                  {home} vs {away}
                                  {score && <span className="ml-2 text-xs font-bold text-brand-700">({score})</span>}
                                </p>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-gray-900">{bet.amount} pts</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-gray-500">
                                  {league && <span>{league} · </span>}
                                  {matchDate && <span>Jogo: {matchDate} · </span>}
                                  <span>Aposta: {betDate}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">Odd: {bet.oddValue}</span>
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    bet.status === 'WON' ? 'bg-green-100 text-green-700' :
                                    bet.status === 'LOST' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {bet.status === 'WON' ? 'Ganhou' : bet.status === 'LOST' ? 'Perdeu' : bet.status === 'PENDING' ? 'Pendente' : bet.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {detailTab === 'transactions' && (() => {
                    const txs = (selectedUser.transactions || []).map((tx: any) => ({
                      type: tx.type,
                      description: tx.description || '-',
                      amount: tx.amount,
                      currency: 'pts',
                      date: tx.createdAt,
                      status: null,
                    }));
                    const purchases = (selectedUser.purchases || []).map((p: any) => ({
                      type: 'COMPRA_DIAMANTES',
                      description: `Pacote ${p.packageId} — ${p.diamonds} diamantes (${p.platform || 'app'})`,
                      amount: parseFloat(p.priceBrl) || 0,
                      currency: 'BRL',
                      date: p.createdAt,
                      status: p.status,
                    }));
                    const all = [...txs, ...purchases].sort((a, b) =>
                      new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
                    );

                    return (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {all.length === 0 ? (
                          <p className="text-center text-gray-400 py-8">Nenhuma transacao encontrada</p>
                        ) : (
                          all.map((tx, i) => (
                            <div key={i} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-medium text-gray-900">{tx.type}</p>
                                <div className="flex items-center gap-2">
                                  {tx.status && (
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                      tx.status === 'VERIFIED' ? 'bg-green-100 text-green-700' :
                                      tx.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {tx.status === 'VERIFIED' ? 'Verificado' : tx.status === 'PENDING' ? 'Pendente' : tx.status}
                                    </span>
                                  )}
                                  <p className={`text-sm font-bold ${
                                    tx.currency === 'BRL' ? 'text-cyan-600' :
                                    tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {tx.currency === 'BRL'
                                      ? `R$ ${tx.amount.toFixed(2)}`
                                      : `${tx.amount > 0 ? '+' : ''}${(tx.amount ?? 0).toLocaleString('pt-BR')} pts`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-500">{tx.description}</p>
                                {tx.date && (
                                  <p className="text-xs text-gray-400">
                                    {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })()}

                  {detailTab === 'achievements' && (
                    <div className="grid grid-cols-2 gap-3">
                      {(selectedUser.achievements || []).length === 0 ? (
                        <p className="col-span-2 text-center text-gray-400 py-8">Nenhuma conquista</p>
                      ) : (
                        selectedUser.achievements.map((ach: any, i: number) => (
                          <div key={i} className="bg-amber-50 rounded-lg p-3 text-center">
                            <p className="text-2xl mb-1">{ach.achievement?.icon || '🏆'}</p>
                            <p className="text-sm font-semibold text-gray-900">{ach.achievement?.name || ach.achievementId}</p>
                            <p className="text-xs text-gray-500">{formatDate(ach.unlockedAt)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
