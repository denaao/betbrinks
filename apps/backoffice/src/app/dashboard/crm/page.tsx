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
      <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#F0EAE0', marginBottom: '1.5rem' }}>CRM / Usuarios</h1>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Buscar por nome, email ou telefone..."
          style={{
            flex: 1,
            height: '2.75rem',
            border: '1px solid #2A2A45',
            borderRadius: '0.5rem',
            paddingLeft: '1rem',
            paddingRight: '1rem',
            fontSize: '0.875rem',
            color: '#F0EAE0',
            background: '#1E1E38',
            outline: 'none',
          }}
          onFocus={(e) => (e.currentTarget.style.border = '1px solid #C4956A')}
          onBlur={(e) => (e.currentTarget.style.border = '1px solid #2A2A45')}
        />
        <button
          onClick={handleSearch}
          style={{
            paddingLeft: '1.5rem',
            paddingRight: '1.5rem',
            height: '2.75rem',
            background: '#C4956A',
            color: 'white',
            fontSize: '0.875rem',
            fontWeight: '600',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#d9a86a')}
          onMouseOut={(e) => (e.currentTarget.style.background = '#C4956A')}
        >
          Buscar
        </button>
      </div>

      {/* Users Table */}
      <div style={{ background: '#1E1E38', borderRadius: '0.75rem', border: '1px solid #2A2A45', overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: '0.875rem' }}>
          <thead style={{ background: '#14142B', borderBottom: '1px solid #2A2A45' }}>
            <tr>
              <th style={{ textAlign: 'left', paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', fontWeight: '600', color: '#9A94A8' }}>Nome</th>
              <th style={{ textAlign: 'left', paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', fontWeight: '600', color: '#9A94A8' }}>Email</th>
              <th style={{ textAlign: 'left', paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', fontWeight: '600', color: '#9A94A8' }}>Telefone</th>
              <th style={{ textAlign: 'center', paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', fontWeight: '600', color: '#9A94A8' }}>Pontos</th>
              <th style={{ textAlign: 'center', paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', fontWeight: '600', color: '#9A94A8' }}>Status</th>
              <th style={{ textAlign: 'center', paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', fontWeight: '600', color: '#9A94A8' }}>Cadastro</th>
              <th style={{ textAlign: 'center', paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', fontWeight: '600', color: '#9A94A8' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', paddingTop: '2rem', paddingBottom: '2rem', color: '#9A94A8' }}>Carregando...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', paddingTop: '2rem', paddingBottom: '2rem', color: '#9A94A8' }}>Nenhum usuario encontrado</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid #2A2A45' }} onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')} onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', fontWeight: '500', color: '#F0EAE0' }}>{user.name}</td>
                  <td style={{ paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', color: '#9A94A8' }}>{user.email}</td>
                  <td style={{ paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', color: '#9A94A8' }}>{user.phone}</td>
                  <td style={{ paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', textAlign: 'center', fontWeight: '500', color: '#C4956A' }}>
                    {(user.points ?? user.balance?.points ?? 0).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', textAlign: 'center' }}>
                    {user.blocked ? (
                      <span style={{ display: 'inline-block', paddingLeft: '0.5rem', paddingRight: '0.5rem', paddingTop: '0.125rem', paddingBottom: '0.125rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '0.75rem', fontWeight: '600', borderRadius: '9999px' }}>Bloqueado</span>
                    ) : (user.isVerified ?? user.phoneVerified) ? (
                      <span style={{ display: 'inline-block', paddingLeft: '0.5rem', paddingRight: '0.5rem', paddingTop: '0.125rem', paddingBottom: '0.125rem', background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontSize: '0.75rem', fontWeight: '600', borderRadius: '9999px' }}>Ativo</span>
                    ) : (
                      <span style={{ display: 'inline-block', paddingLeft: '0.5rem', paddingRight: '0.5rem', paddingTop: '0.125rem', paddingBottom: '0.125rem', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontSize: '0.75rem', fontWeight: '600', borderRadius: '9999px' }}>Pendente</span>
                    )}
                  </td>
                  <td style={{ paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', textAlign: 'center', color: '#9A94A8' }}>{formatDate(user.createdAt)}</td>
                  <td style={{ paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', textAlign: 'center' }}>
                    <button
                      onClick={() => openDetail(user.id)}
                      style={{ color: '#C4956A', fontWeight: '600', fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseOver={(e) => (e.currentTarget.style.color = '#d9a86a')}
                      onMouseOut={(e) => (e.currentTarget.style.color = '#C4956A')}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: '#9A94A8' }}>{total} usuarios encontrados</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              style={{
                paddingLeft: '0.75rem',
                paddingRight: '0.75rem',
                paddingTop: '0.375rem',
                paddingBottom: '0.375rem',
                fontSize: '0.875rem',
                border: '1px solid #2A2A45',
                borderRadius: '0.5rem',
                opacity: page <= 1 ? 0.4 : 1,
                background: 'transparent',
                color: '#F0EAE0',
                cursor: page <= 1 ? 'default' : 'pointer',
              }}
              onMouseOver={(e) => page > 1 && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Anterior
            </button>
            <span style={{ paddingLeft: '0.75rem', paddingRight: '0.75rem', paddingTop: '0.375rem', paddingBottom: '0.375rem', fontSize: '0.875rem', color: '#9A94A8' }}>
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              style={{
                paddingLeft: '0.75rem',
                paddingRight: '0.75rem',
                paddingTop: '0.375rem',
                paddingBottom: '0.375rem',
                fontSize: '0.875rem',
                border: '1px solid #2A2A45',
                borderRadius: '0.5rem',
                opacity: page >= totalPages ? 0.4 : 1,
                background: 'transparent',
                color: '#F0EAE0',
                cursor: page >= totalPages ? 'default' : 'pointer',
              }}
              onMouseOver={(e) => page < totalPages && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Proximo
            </button>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {(selectedUser || detailLoading) && (
        <div style={{ position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '3rem', zIndex: 50, overflowY: 'auto' }}>
          <div style={{ background: '#1E1E38', borderRadius: '1rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', width: '100%', maxWidth: '48rem', marginLeft: '1rem', marginRight: '1rem', marginBottom: '3rem' }}>
            {detailLoading ? (
              <div style={{ paddingTop: '3rem', paddingBottom: '3rem', textAlign: 'center', color: '#9A94A8' }}>Carregando detalhes...</div>
            ) : selectedUser ? (
              <>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '1.5rem', paddingRight: '1.5rem', paddingTop: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #2A2A45' }}>
                  <div>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#F0EAE0' }}>{selectedUser.name}</h2>
                    <p style={{ fontSize: '0.875rem', color: '#9A94A8' }}>{selectedUser.email} | {selectedUser.phone}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      onClick={() => handleBlock(selectedUser.id, !selectedUser.blocked)}
                      style={{
                        paddingLeft: '0.75rem',
                        paddingRight: '0.75rem',
                        paddingTop: '0.375rem',
                        paddingBottom: '0.375rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        borderRadius: '0.5rem',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        background: selectedUser.blocked ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)',
                        color: selectedUser.blocked ? '#4ade80' : '#ef4444',
                      }}
                    >
                      {selectedUser.blocked ? 'Desbloquear' : 'Bloquear'}
                    </button>
                    <button
                      onClick={() => setSelectedUser(null)}
                      style={{
                        color: '#9A94A8',
                        background: 'none',
                        border: 'none',
                        fontSize: '1.25rem',
                        lineHeight: '1rem',
                        cursor: 'pointer',
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.color = '#F0EAE0')}
                      onMouseOut={(e) => (e.currentTarget.style.color = '#9A94A8')}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #2A2A45' }}>
                  {(['info', 'bets', 'transactions', 'achievements'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab)}
                      style={{
                        flex: 1,
                        paddingTop: '0.75rem',
                        paddingBottom: '0.75rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        color: detailTab === tab ? '#C4956A' : '#9A94A8',
                        background: 'none',
                        border: 'none',
                        borderBottom: detailTab === tab ? '2px solid #C4956A' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {tab === 'info' && 'Informacoes'}
                      {tab === 'bets' && 'Apostas'}
                      {tab === 'transactions' && 'Transacoes'}
                      {tab === 'achievements' && 'Conquistas'}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                  {detailTab === 'info' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Stats Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                        <div style={{ background: '#14142B', borderRadius: '0.5rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', paddingLeft: '0.75rem', paddingRight: '0.75rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '0.75rem', color: '#9A94A8' }}>Pontos</p>
                          <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#C4956A' }}>
                            {(selectedUser.balance?.points || 0).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div style={{ background: '#14142B', borderRadius: '0.5rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', paddingLeft: '0.75rem', paddingRight: '0.75rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '0.75rem', color: '#9A94A8' }}>Diamantes</p>
                          <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#60a5fa' }}>
                            {(selectedUser.balance?.diamonds || 0).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div style={{ background: '#14142B', borderRadius: '0.5rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', paddingLeft: '0.75rem', paddingRight: '0.75rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '0.75rem', color: '#9A94A8' }}>Level</p>
                          <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#fb923c' }}>{selectedUser.level}</p>
                        </div>
                        <div style={{ background: '#14142B', borderRadius: '0.5rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', paddingLeft: '0.75rem', paddingRight: '0.75rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '0.75rem', color: '#9A94A8' }}>XP</p>
                          <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#F0EAE0' }}>{selectedUser.xp?.toLocaleString('pt-BR')}</p>
                        </div>
                      </div>

                      {/* Bet Stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                        <div style={{ background: 'rgba(59,130,246,0.15)', borderRadius: '0.5rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', paddingLeft: '0.75rem', paddingRight: '0.75rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '0.75rem', color: '#9A94A8' }}>Total Apostas</p>
                          <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#60a5fa' }}>{selectedUser.stats?.totalBets || 0}</p>
                        </div>
                        <div style={{ background: 'rgba(74,222,128,0.15)', borderRadius: '0.5rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', paddingLeft: '0.75rem', paddingRight: '0.75rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '0.75rem', color: '#9A94A8' }}>Ganhas</p>
                          <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#4ade80' }}>{selectedUser.stats?.wonBets || 0}</p>
                        </div>
                        <div style={{ background: 'rgba(239,68,68,0.15)', borderRadius: '0.5rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', paddingLeft: '0.75rem', paddingRight: '0.75rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '0.75rem', color: '#9A94A8' }}>Perdidas</p>
                          <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#ef4444' }}>{selectedUser.stats?.lostBets || 0}</p>
                        </div>
                        <div style={{ background: 'rgba(196,149,106,0.15)', borderRadius: '0.5rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', paddingLeft: '0.75rem', paddingRight: '0.75rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '0.75rem', color: '#9A94A8' }}>Win Rate</p>
                          <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#C4956A' }}>
                            {((selectedUser.stats?.winRate || 0) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      {/* Adjust Points */}
                      <div style={{ background: '#14142B', borderRadius: '0.5rem', paddingTop: '1rem', paddingBottom: '1rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#F0EAE0', marginBottom: '0.75rem' }}>Ajustar Pontos</h4>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <input
                            type="number"
                            value={adjustAmount}
                            onChange={(e) => setAdjustAmount(e.target.value)}
                            placeholder="Quantidade (negativo para debitar)"
                            style={{
                              flex: 1,
                              height: '2.5rem',
                              border: '1px solid #2A2A45',
                              borderRadius: '0.5rem',
                              paddingLeft: '0.75rem',
                              paddingRight: '0.75rem',
                              fontSize: '0.875rem',
                              background: '#1E1E38',
                              color: '#F0EAE0',
                              outline: 'none',
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = '#C4956A')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = '#2A2A45')}
                          />
                          <input
                            type="text"
                            value={adjustReason}
                            onChange={(e) => setAdjustReason(e.target.value)}
                            placeholder="Motivo"
                            style={{
                              flex: 1,
                              height: '2.5rem',
                              border: '1px solid #2A2A45',
                              borderRadius: '0.5rem',
                              paddingLeft: '0.75rem',
                              paddingRight: '0.75rem',
                              fontSize: '0.875rem',
                              background: '#1E1E38',
                              color: '#F0EAE0',
                              outline: 'none',
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = '#C4956A')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = '#2A2A45')}
                          />
                          <button
                            onClick={handleAdjustPoints}
                            style={{
                              paddingLeft: '1rem',
                              paddingRight: '1rem',
                              height: '2.5rem',
                              background: '#C4956A',
                              color: 'white',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              borderRadius: '0.5rem',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'background 0.2s',
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.background = '#d9a86a')}
                            onMouseOut={(e) => (e.currentTarget.style.background = '#C4956A')}
                          >
                            Ajustar
                          </button>
                        </div>
                      </div>

                      {/* User Meta */}
                      <div style={{ fontSize: '0.875rem', color: '#9A94A8', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <p>ID: <span style={{ fontFamily: 'monospace', color: '#F0EAE0' }}>{selectedUser.id}</span></p>
                        <p>Cadastro: {formatDate(selectedUser.createdAt)}</p>
                        <p>Telefone verificado: {selectedUser.phoneVerified ? 'Sim' : 'Nao'}</p>
                        <p>Status: {selectedUser.blocked ? 'Bloqueado' : 'Ativo'}</p>
                      </div>
                    </div>
                  )}

                  {detailTab === 'bets' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '20rem', overflowY: 'auto' }}>
                      {(selectedUser.bets || []).length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#9A94A8', paddingTop: '2rem', paddingBottom: '2rem' }}>Nenhuma aposta encontrada</p>
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
                            <div key={i} style={{ background: '#14142B', borderRadius: '0.5rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', paddingLeft: '0.75rem', paddingRight: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#F0EAE0' }}>
                                  {home} vs {away}
                                  {score && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#C4956A' }}>({score})</span>}
                                </p>
                                <div style={{ textAlign: 'right' }}>
                                  <p style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#F0EAE0' }}>{bet.amount} pts</p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontSize: '0.75rem', color: '#9A94A8' }}>
                                  {league && <span>{league} · </span>}
                                  {matchDate && <span>Jogo: {matchDate} · </span>}
                                  <span>Aposta: {betDate}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.75rem', color: '#9A94A8' }}>Odd: {bet.oddValue}</span>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    paddingLeft: '0.5rem',
                                    paddingRight: '0.5rem',
                                    paddingTop: '0.125rem',
                                    paddingBottom: '0.125rem',
                                    borderRadius: '9999px',
                                    background: bet.status === 'WON' ? 'rgba(74,222,128,0.15)' : bet.status === 'LOST' ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.15)',
                                    color: bet.status === 'WON' ? '#4ade80' : bet.status === 'LOST' ? '#ef4444' : '#fbbf24',
                                  }}>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '20rem', overflowY: 'auto' }}>
                        {all.length === 0 ? (
                          <p style={{ textAlign: 'center', color: '#9A94A8', paddingTop: '2rem', paddingBottom: '2rem' }}>Nenhuma transacao encontrada</p>
                        ) : (
                          all.map((tx, i) => (
                            <div key={i} style={{ background: '#14142B', borderRadius: '0.5rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', paddingLeft: '0.75rem', paddingRight: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#F0EAE0' }}>{tx.type}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  {tx.status && (
                                    <span style={{
                                      fontSize: '0.75rem',
                                      fontWeight: '600',
                                      paddingLeft: '0.5rem',
                                      paddingRight: '0.5rem',
                                      paddingTop: '0.125rem',
                                      paddingBottom: '0.125rem',
                                      borderRadius: '9999px',
                                      background: tx.status === 'VERIFIED' ? 'rgba(74,222,128,0.15)' : tx.status === 'PENDING' ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
                                      color: tx.status === 'VERIFIED' ? '#4ade80' : tx.status === 'PENDING' ? '#fbbf24' : '#ef4444',
                                    }}>
                                      {tx.status === 'VERIFIED' ? 'Verificado' : tx.status === 'PENDING' ? 'Pendente' : tx.status}
                                    </span>
                                  )}
                                  <p style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 'bold',
                                    color: tx.currency === 'BRL' ? '#60a5fa' : tx.amount > 0 ? '#4ade80' : '#ef4444',
                                  }}>
                                    {tx.currency === 'BRL'
                                      ? `R$ ${tx.amount.toFixed(2)}`
                                      : `${tx.amount > 0 ? '+' : ''}${(tx.amount ?? 0).toLocaleString('pt-BR')} pts`}
                                  </p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <p style={{ fontSize: '0.75rem', color: '#9A94A8' }}>{tx.description}</p>
                                {tx.date && (
                                  <p style={{ fontSize: '0.75rem', color: '#9A94A8' }}>
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                      {(selectedUser.achievements || []).length === 0 ? (
                        <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#9A94A8', paddingTop: '2rem', paddingBottom: '2rem' }}>Nenhuma conquista</p>
                      ) : (
                        selectedUser.achievements.map((ach: any, i: number) => (
                          <div key={i} style={{ background: 'rgba(196,149,106,0.15)', borderRadius: '0.5rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', paddingLeft: '0.75rem', paddingRight: '0.75rem', textAlign: 'center' }}>
                            <p style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{ach.achievement?.icon || '🏆'}</p>
                            <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#F0EAE0' }}>{ach.achievement?.name || ach.achievementId}</p>
                            <p style={{ fontSize: '0.75rem', color: '#9A94A8' }}>{formatDate(ach.unlockedAt)}</p>
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
