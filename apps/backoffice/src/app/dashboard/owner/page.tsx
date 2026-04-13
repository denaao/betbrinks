'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface League { id: number; name: string; inviteCode: string; cashbox: number; stars: number; memberCount: number; }
interface Member { userId: number; name: string; cpf: string; role: string; balance: number; }
interface Referral { userId: number; name: string; joinedAt: string; }
interface Commission { id: number; betAmount: number; leagueProfit: number; commissionPct: number; commissionAmt: number; level: number; createdAt: string; }
interface Affiliate {
  id: number; userId: number; name: string; code: string; revenueSharePct: number;
  creditLimit: number; creditUsed: number; isActive: boolean;
  referralCount: number; commissionCount: number; totalCommission: number; totalProfit: number;
  referrals: Referral[]; recentCommissions: Commission[];
}
interface Transaction { id: number; type: string; amount: number; senderName: string; receiverName: string; description: string; createdAt: string; }
interface Dashboard {
  league: { id: number; name: string; inviteCode: string; cashbox: number; stars: number };
  stats: { totalMembers: number; totalBalance: number; totalAffiliates: number; totalReferrals: number; totalCommissions: number };
  members: Member[];
  affiliates: Affiliate[];
  transactions: Transaction[];
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: '#1E1E38', border: '1px solid #2A2A45' }} className="rounded-xl p-5 flex-1 min-w-[150px]">
      <div style={{ color: '#9A94A8' }} className="text-xs font-semibold uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color || ''}`} style={color ? undefined : { color: '#F0EAE0' }}>{value}</div>
    </div>
  );
}

export default function OwnerDashboardPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'affiliates' | 'transactions'>('affiliates');
  const [expandedAffiliate, setExpandedAffiliate] = useState<number | null>(null);

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

  // Load dashboard for selected league
  useEffect(() => {
    if (!selectedLeagueId) return;
    setDashboard(null);
    apiFetch(`/admin/owner/leagues/${selectedLeagueId}/dashboard`).then(setDashboard).catch(() => {});
  }, [selectedLeagueId, apiFetch]);

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

  const tabs = [
    { key: 'affiliates', label: `Afiliados${dashboard ? ` (${dashboard.affiliates.length})` : ''}` },
    { key: 'members', label: `Membros${dashboard ? ` (${dashboard.members.length})` : ''}` },
    { key: 'transactions', label: `Transações${dashboard ? ` (${dashboard.transactions.length})` : ''}` },
  ] as const;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#F0EAE0' }}>Painel do Owner</h1>
          <p className="text-sm mt-1" style={{ color: '#9A94A8' }}>Gerencie suas ligas, afiliados e transações</p>
        </div>

        {leagues.length > 1 && (
          <select
            value={selectedLeagueId || ''}
            onChange={(e) => setSelectedLeagueId(Number(e.target.value))}
            className="rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            style={{ background: '#1E1E38', border: '1px solid #2A2A45', color: '#F0EAE0' }}
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name} ({l.memberCount} membros)</option>
            ))}
          </select>
        )}
      </div>

      {!dashboard ? (
        <div className="flex items-center justify-center h-40" style={{ color: '#9A94A8' }}>Carregando dados da liga...</div>
      ) : (
        <>
          {/* League Info Bar */}
          <div className="text-white rounded-xl p-5 mb-6 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #141B2D 0%, #1E293B 100%)' }}>
            <div>
              <div className="text-lg font-bold">{dashboard.league.name}</div>
              <div className="text-sm opacity-80 mt-0.5">
                Código: <span className="font-mono font-bold">{dashboard.league.inviteCode}</span>
                {dashboard.league.stars > 0 && <span className="ml-3">{'⭐'.repeat(dashboard.league.stars)}</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-70">Caixa da Liga</div>
              <div className="text-2xl font-bold">{dashboard.league.cashbox.toLocaleString('pt-BR')} pts</div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <StatCard label="Membros" value={dashboard.stats.totalMembers} />
            <StatCard label="Saldo distribuído" value={`${dashboard.stats.totalBalance.toLocaleString('pt-BR')} pts`} color="text-green-500" />
            <StatCard label="Afiliados" value={dashboard.stats.totalAffiliates} color="text-brand-400" />
            <StatCard label="Indicados" value={dashboard.stats.totalReferrals} color="text-amber-400" />
            <StatCard label="Comissões pagas" value={`${dashboard.stats.totalCommissions.toLocaleString('pt-BR')} pts`} color="text-red-400" />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-5" style={{ borderBottom: '1px solid #2A2A45' }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.key
                    ? '-mb-px'
                    : 'hover:bg-white/5'
                }`}
                style={activeTab === tab.key
                  ? { background: '#1E1E38', color: '#C4956A', border: '1px solid #2A2A45', borderBottom: '1px solid #1E1E38' }
                  : { color: '#9A94A8' }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="rounded-xl" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
            {/* ─── Affiliates Tab ─────────────────────────────────── */}
            {activeTab === 'affiliates' && (
              <div className="p-5">
                {dashboard.affiliates.length === 0 ? (
                  <div className="text-center py-8" style={{ color: '#9A94A8' }}>Nenhum afiliado nesta liga</div>
                ) : (
                  <div className="space-y-3">
                    {dashboard.affiliates.map((a) => (
                      <div key={a.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid #2A2A45' }}>
                        {/* Affiliate Header */}
                        <button
                          onClick={() => setExpandedAffiliate(expandedAffiliate === a.id ? null : a.id)}
                          className="w-full flex items-center justify-between p-4 transition-colors text-left hover:bg-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: '#14142B', color: '#C4956A', border: '1px solid #2A2A45' }}>
                              {a.name[0]}
                            </div>
                            <div>
                              <div className="font-semibold" style={{ color: '#F0EAE0' }}>
                                {a.name}
                                {!a.isActive && <span className="ml-2 text-xs text-red-400">(Desativado)</span>}
                              </div>
                              <div className="text-xs" style={{ color: '#9A94A8' }}>
                                <span className="font-mono" style={{ color: '#C4956A' }}>{a.code}</span>
                                <span className="mx-2">·</span>
                                {a.revenueSharePct}% comissão
                                <span className="mx-2">·</span>
                                {a.referralCount} indicados
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <div className="text-xs" style={{ color: '#9A94A8' }}>Comissão total</div>
                              <div className="font-bold text-red-400">{a.totalCommission.toLocaleString('pt-BR')} pts</div>
                            </div>
                            <div>
                              <div className="text-xs" style={{ color: '#9A94A8' }}>Crédito</div>
                              <div className="font-bold" style={{ color: '#F0EAE0' }}>
                                {a.creditUsed.toLocaleString('pt-BR')}/{a.creditLimit > 0 ? a.creditLimit.toLocaleString('pt-BR') : '∞'}
                              </div>
                            </div>
                            <svg className={`w-5 h-5 transition-transform ${expandedAffiliate === a.id ? 'rotate-180' : ''}`} style={{ color: '#9A94A8' }} viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </button>

                        {/* Expanded Details */}
                        {expandedAffiliate === a.id && (
                          <div className="p-4" style={{ borderTop: '1px solid #2A2A45', background: '#14142B' }}>
                            <div className="grid grid-cols-2 gap-4">
                              {/* Referrals */}
                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#9A94A8' }}>Indicados ({a.referrals.length})</h4>
                                {a.referrals.length === 0 ? (
                                  <div className="text-sm" style={{ color: '#9A94A8' }}>Nenhum indicado</div>
                                ) : (
                                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {a.referrals.map((r) => (
                                      <div key={r.userId} className="flex items-center justify-between text-sm rounded-lg px-3 py-2" style={{ background: '#1E1E38' }}>
                                        <span className="font-medium" style={{ color: '#F0EAE0' }}>{r.name}</span>
                                        <span className="text-xs" style={{ color: '#9A94A8' }}>{new Date(r.joinedAt).toLocaleDateString('pt-BR')}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Recent Commissions */}
                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#9A94A8' }}>Comissões recentes</h4>
                                {a.recentCommissions.length === 0 ? (
                                  <div className="text-sm" style={{ color: '#9A94A8' }}>Nenhuma comissão</div>
                                ) : (
                                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {a.recentCommissions.map((c) => (
                                      <div key={c.id} className="flex items-center justify-between text-sm rounded-lg px-3 py-2" style={{ background: '#1E1E38' }}>
                                        <div>
                                          <span className="text-xs" style={{ color: '#9A94A8' }}>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</span>
                                          <span className="ml-2" style={{ color: '#F0EAE0' }}>aposta {c.betAmount.toLocaleString('pt-BR')}</span>
                                        </div>
                                        <span className="font-semibold text-red-400">-{c.commissionAmt.toLocaleString('pt-BR')}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── Members Tab ────────────────────────────────────── */}
            {activeTab === 'members' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2A2A45' }}>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Membro</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>CPF</th>
                      <th className="text-center text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Cargo</th>
                      <th className="text-right text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.members.map((m) => (
                      <tr key={m.userId} className="transition-colors hover:bg-white/5" style={{ borderBottom: '1px solid #2A2A45' }}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style={{ background: '#14142B', color: '#C4956A', border: '1px solid #2A2A45' }}>
                              {m.name[0]}
                            </div>
                            <span className="font-medium text-sm" style={{ color: '#F0EAE0' }}>{m.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm font-mono" style={{ color: '#9A94A8' }}>{m.cpf || '—'}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            m.role === 'OWNER' ? 'text-amber-300' :
                            m.role === 'MANAGER' ? 'text-red-400' :
                            ''
                          }`} style={
                            m.role === 'OWNER' ? { background: 'rgba(196,149,106,0.15)' } :
                            m.role === 'MANAGER' ? { background: 'rgba(239,68,68,0.15)' } :
                            { background: 'rgba(255,255,255,0.08)', color: '#9A94A8' }
                          }>
                            {m.role === 'OWNER' ? 'Owner' : m.role === 'MANAGER' ? 'Gestor' : 'Membro'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-sm text-green-400">
                          {m.balance.toLocaleString('pt-BR')} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ─── Transactions Tab ───────────────────────────────── */}
            {activeTab === 'transactions' && (
              <div className="overflow-x-auto">
                {dashboard.transactions.length === 0 ? (
                  <div className="text-center py-8" style={{ color: '#9A94A8' }}>Nenhuma transação registrada</div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #2A2A45' }}>
                        <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Data</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Tipo</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>De</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Para</th>
                        <th className="text-right text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Valor</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Descrição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.transactions.map((tx) => (
                        <tr key={tx.id} className="transition-colors hover:bg-white/5" style={{ borderBottom: '1px solid #2A2A45' }}>
                          <td className="px-5 py-3 text-xs" style={{ color: '#9A94A8' }}>{new Date(tx.createdAt).toLocaleDateString('pt-BR')}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                              tx.type === 'TRANSFER' ? 'text-blue-400' :
                              tx.type === 'WITHDRAWAL' ? 'text-orange-400' :
                              tx.type === 'DEPOSIT' ? 'text-green-400' :
                              ''
                            }`} style={
                              tx.type === 'TRANSFER' ? { background: 'rgba(59,130,246,0.15)' } :
                              tx.type === 'WITHDRAWAL' ? { background: 'rgba(251,146,60,0.15)' } :
                              tx.type === 'DEPOSIT' ? { background: 'rgba(74,222,128,0.15)' } :
                              { background: 'rgba(255,255,255,0.08)', color: '#9A94A8' }
                            }>
                              {tx.type === 'TRANSFER' ? 'Envio' :
                               tx.type === 'WITHDRAWAL' ? 'Saque' :
                               tx.type === 'DEPOSIT' ? 'Depósito' : tx.type}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm" style={{ color: '#F0EAE0' }}>{tx.senderName}</td>
                          <td className="px-5 py-3 text-sm" style={{ color: '#F0EAE0' }}>{tx.receiverName}</td>
                          <td className="px-5 py-3 text-right font-bold text-sm">
                            <span className={tx.type === 'WITHDRAWAL' ? 'text-orange-400' : 'text-green-400'}>
                              {tx.amount.toLocaleString('pt-BR')} pts
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs max-w-[200px] truncate" style={{ color: '#9A94A8' }}>{tx.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
