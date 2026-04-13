'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface League { id: number; name: string; memberCount: number; }
interface TxSummary { type: string; totalAmount: number; count: number; }
interface Transaction {
  id: number; type: string; amount: number;
  senderName: string; receiverName: string;
  description: string; createdAt: string;
}
interface FinancialData {
  league: { id: number; name: string; cashbox: number; cashboxInitial: number; cashboxMinAlert: number };
  summary: {
    cashbox: number; totalDistributed: number;
    totalCommissions: number; totalLeagueProfit: number;
    transactionsByType: TxSummary[];
  };
  transactions: {
    data: Transaction[]; total: number;
    page: number; limit: number; totalPages: number;
  };
}

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div className="rounded-xl p-5 flex-1 min-w-[170px]" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
      <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#9A94A8' }}>{label}</div>
      <div className={`text-2xl font-bold ${color || ''}`} style={color ? undefined : { color: '#F0EAE0' }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: '#9A94A8' }}>{sub}</div>}
    </div>
  );
}

const TX_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  TRANSFER: { label: 'Envio', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)' },
  WITHDRAWAL: { label: 'Saque', color: '#fb923c', bg: 'rgba(251,146,60,0.15)' },
  DEPOSIT: { label: 'Depósito', color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
  CREDIT: { label: 'Crédito', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  COMMISSION: { label: 'Comissão', color: '#C4956A', bg: 'rgba(196,149,106,0.15)' },
  CASHBOX_LOAD: { label: 'Recarga Caixa', color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)' },
};

export default function OwnerFinancialPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [financial, setFinancial] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [page, setPage] = useState(1);

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

  // Load financial data
  useEffect(() => {
    if (!selectedLeagueId) return;
    setLoadingData(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });

    apiFetch(`/admin/owner/leagues/${selectedLeagueId}/financial?${params}`).then((data) => {
      setFinancial(data);
      setLoadingData(false);
    }).catch(() => setLoadingData(false));
  }, [selectedLeagueId, page, apiFetch]);

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

  const fmt = (v: number) => v.toLocaleString('pt-BR');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#F0EAE0' }}>Financeiro</h1>
          <p className="text-sm mt-1" style={{ color: '#9A94A8' }}>Controle do caixa, saldos e transações da liga</p>
        </div>

        {leagues.length > 1 && (
          <select
            value={selectedLeagueId || ''}
            onChange={(e) => { setSelectedLeagueId(Number(e.target.value)); setPage(1); }}
            className="rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            style={{ background: '#1E1E38', border: '1px solid #2A2A45', color: '#F0EAE0' }}
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}
      </div>

      {loadingData || !financial ? (
        <div className="flex items-center justify-center h-40" style={{ color: '#9A94A8' }}>Carregando dados financeiros...</div>
      ) : (
        <>
          {/* Cashbox Banner */}
          <div className="rounded-xl p-5 mb-6 flex items-center justify-between text-white"
            style={{
              background: financial.summary.cashbox <= (financial.league.cashboxMinAlert || 0) && financial.league.cashboxMinAlert > 0
                ? 'linear-gradient(135deg, #991B1B 0%, #B91C1C 100%)'
                : 'linear-gradient(135deg, #141B2D 0%, #1E293B 100%)'
            }}>
            <div>
              <div className="text-lg font-bold">{financial.league.name}</div>
              <div className="text-sm opacity-80 mt-0.5">
                Saldo inicial: {fmt(financial.league.cashboxInitial || 0)} pts
                {financial.league.cashboxMinAlert > 0 && (
                  <span className="ml-3">Alerta mín: {fmt(financial.league.cashboxMinAlert)} pts</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-70">Caixa da Liga</div>
              <div className="text-3xl font-bold">{fmt(financial.summary.cashbox)} pts</div>
              {financial.summary.cashbox <= (financial.league.cashboxMinAlert || 0) && financial.league.cashboxMinAlert > 0 && (
                <div className="text-xs mt-1 opacity-90">⚠ Abaixo do alerta mínimo</div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <StatCard
              label="Saldo distribuído"
              value={`${fmt(financial.summary.totalDistributed)} pts`}
              color="text-green-400"
              sub="Total em saldos dos membros"
            />
            <StatCard
              label="Comissões pagas"
              value={`${fmt(financial.summary.totalCommissions)} pts`}
              color="text-red-400"
              sub="Total pago a afiliados"
            />
            <StatCard
              label="Lucro da liga"
              value={`${fmt(financial.summary.totalLeagueProfit)} pts`}
              color="text-brand-400"
              sub="Lucro gerado via apostas"
            />
          </div>

          {/* Transaction Type Summary */}
          {financial.summary.transactionsByType.length > 0 && (
            <div className="rounded-xl p-5 mb-6" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#F0EAE0' }}>Resumo por tipo de transação</h3>
              <div className="flex gap-4 flex-wrap">
                {financial.summary.transactionsByType.map((ts) => {
                  const info = TX_TYPE_LABELS[ts.type] || { label: ts.type, color: '#9A94A8', bg: 'rgba(255,255,255,0.08)' };
                  return (
                    <div key={ts.type} className="flex items-center gap-3 rounded-lg px-4 py-3 min-w-[180px]" style={{ background: '#14142B' }}>
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: info.bg, color: info.color }}>
                        {info.label}
                      </span>
                      <div>
                        <div className="text-sm font-bold" style={{ color: '#F0EAE0' }}>{fmt(ts.totalAmount)} pts</div>
                        <div className="text-xs" style={{ color: '#9A94A8' }}>{ts.count} transaçõ{ts.count === 1 ? '' : 'es'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Transactions Table */}
          <div className="rounded-xl overflow-hidden" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #2A2A45' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#F0EAE0' }}>
                Histórico de transações ({financial.transactions.total})
              </h3>
            </div>

            {financial.transactions.data.length === 0 ? (
              <div className="text-center py-8" style={{ color: '#9A94A8' }}>Nenhuma transação registrada</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2A2A45', background: '#14142B' }}>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Data</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Tipo</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>De</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Para</th>
                      <th className="text-right text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Valor</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#9A94A8' }}>Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financial.transactions.data.map((tx) => {
                      const info = TX_TYPE_LABELS[tx.type] || { label: tx.type, color: '#9A94A8', bg: 'rgba(255,255,255,0.08)' };
                      return (
                        <tr key={tx.id} className="transition-colors hover:bg-white/5" style={{ borderBottom: '1px solid #2A2A45' }}>
                          <td className="px-5 py-3 text-xs whitespace-nowrap" style={{ color: '#9A94A8' }}>
                            {new Date(tx.createdAt).toLocaleDateString('pt-BR')}
                            <span className="ml-1" style={{ color: '#6B6580' }}>{new Date(tx.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: info.bg, color: info.color }}>
                              {info.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm" style={{ color: '#F0EAE0' }}>{tx.senderName}</td>
                          <td className="px-5 py-3 text-sm" style={{ color: '#F0EAE0' }}>{tx.receiverName}</td>
                          <td className="px-5 py-3 text-right font-bold text-sm">
                            <span className={tx.type === 'WITHDRAWAL' ? 'text-orange-400' : tx.type === 'COMMISSION' ? 'text-red-400' : 'text-green-400'}>
                              {fmt(tx.amount)} pts
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs max-w-[200px] truncate" style={{ color: '#9A94A8' }}>{tx.description || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {financial.transactions.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm" style={{ color: '#9A94A8' }}>
                Página {financial.transactions.page} de {financial.transactions.totalPages}
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
                  onClick={() => setPage(Math.min(financial.transactions.totalPages, page + 1))}
                  disabled={page >= financial.transactions.totalPages}
                  className="px-4 py-2 text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  style={{ border: '1px solid #2A2A45', color: '#F0EAE0' }}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
