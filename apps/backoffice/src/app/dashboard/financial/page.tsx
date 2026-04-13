'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface FinancialSummary {
  totalRevenue: number;
  totalPurchases: number;
  byPackage: { packageId: string; count: number; revenue: number }[];
  byStatus: { status: string; count: number }[];
  recentPurchases: {
    id: string;
    userId: string;
    userName: string;
    packageId: string;
    amount: number;
    status: string;
    platform: string;
    createdAt: string;
  }[];
}

const PACKAGE_LABELS: Record<string, string> = {
  starter: 'Starter (R$ 4,90)',
  popular: 'Popular (R$ 19,90)',
  pro: 'Pro (R$ 39,90)',
  vip: 'VIP (R$ 79,90)',
};

const PACKAGE_COLORS: Record<string, string> = {
  starter: 'bg-blue-500',
  popular: 'bg-green-500',
  pro: 'bg-purple-500',
  vip: 'bg-amber-500',
};

const STATUS_COLORS: Record<string, string> = {
  VERIFIED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
};

export default function FinancialPage() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await api.get('/admin/financial');
      setSummary(data.data || data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number | undefined | null) =>
    (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: '#9A94A8' }}>Carregando dados financeiros...</p>
      </div>
    );
  }

  const maxPkgRevenue = Math.max(...(summary?.byPackage || []).map((p) => p.revenue), 1);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#F0EAE0' }}>Financeiro</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl p-6 border" style={{ background: '#1E1E38', borderColor: '#2A2A45' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#9A94A8' }}>Receita Total</p>
          <p className="text-3xl font-extrabold text-green-400">
            {formatCurrency(summary?.totalRevenue || 0)}
          </p>
          <p className="text-xs mt-1" style={{ color: '#9A94A8' }}>Todas as compras verificadas</p>
        </div>
        <div className="rounded-xl p-6 border" style={{ background: '#1E1E38', borderColor: '#2A2A45' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#9A94A8' }}>Total de Compras</p>
          <p className="text-3xl font-extrabold text-blue-400">
            {(summary?.totalPurchases || 0).toLocaleString('pt-BR')}
          </p>
          <p className="text-xs mt-1" style={{ color: '#9A94A8' }}>Todas as transacoes</p>
        </div>
        <div className="rounded-xl p-6 border" style={{ background: '#1E1E38', borderColor: '#2A2A45' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#9A94A8' }}>Ticket Medio</p>
          <p className="text-3xl font-extrabold text-purple-400">
            {formatCurrency(
              summary?.totalPurchases
                ? (summary.totalRevenue || 0) / summary.totalPurchases
                : 0
            )}
          </p>
          <p className="text-xs mt-1" style={{ color: '#9A94A8' }}>Receita / compras</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue by Package */}
        <div className="rounded-xl p-6 border" style={{ background: '#1E1E38', borderColor: '#2A2A45' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#F0EAE0' }}>Receita por Pacote</h3>
          <div className="space-y-3">
            {(summary?.byPackage || []).map((pkg) => (
              <div key={pkg.packageId}>
                <div className="flex justify-between text-sm mb-1">
                  <span style={{ color: '#9A94A8' }}>{PACKAGE_LABELS[pkg.packageId] || pkg.packageId}</span>
                  <span className="font-semibold" style={{ color: '#F0EAE0' }}>
                    {formatCurrency(pkg.revenue)} ({pkg.count}x)
                  </span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: '#14142B' }}>
                  <div
                    className={`h-full rounded-full ${PACKAGE_COLORS[pkg.packageId] || 'bg-gray-400'}`}
                    style={{ width: `${(pkg.revenue / maxPkgRevenue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {(summary?.byPackage || []).length === 0 && (
              <p className="text-center py-4" style={{ color: '#9A94A8' }}>Sem dados</p>
            )}
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="rounded-xl p-6 border" style={{ background: '#1E1E38', borderColor: '#2A2A45' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#F0EAE0' }}>Status das Compras</h3>
          <div className="space-y-3">
            {(summary?.byStatus || []).map((s) => (
              <div key={s.status} className="flex items-center justify-between">
                <span className="px-3 py-1 text-xs font-semibold rounded-full" style={
                  s.status === 'VERIFIED'
                    ? { background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }
                    : s.status === 'PENDING'
                    ? { background: 'rgba(202, 138, 4, 0.2)', color: '#facc15' }
                    : s.status === 'FAILED'
                    ? { background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }
                    : { background: '#14142B', color: '#9A94A8' }
                }>
                  {s.status}
                </span>
                <span className="text-sm font-bold" style={{ color: '#F0EAE0' }}>{s.count}</span>
              </div>
            ))}
            {(summary?.byStatus || []).length === 0 && (
              <p className="text-center py-4" style={{ color: '#9A94A8' }}>Sem dados</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Purchases Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: '#1E1E38', borderColor: '#2A2A45' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: '#2A2A45' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#F0EAE0' }}>Compras Recentes</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b" style={{ background: '#14142B', borderColor: '#2A2A45' }}>
            <tr>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Usuario</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Pacote</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Valor</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Plataforma</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Status</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Data</th>
            </tr>
          </thead>
          <tbody>
            {(summary?.recentPurchases || []).length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8" style={{ color: '#9A94A8' }}>Nenhuma compra encontrada</td>
              </tr>
            ) : (
              summary!.recentPurchases.map((purchase) => (
                <tr key={purchase.id} className="border-b hover:bg-white/5" style={{ borderColor: '#2A2A45' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: '#F0EAE0' }}>{purchase.userName}</td>
                  <td className="px-4 py-3" style={{ color: '#9A94A8' }}>{PACKAGE_LABELS[purchase.packageId] || purchase.packageId}</td>
                  <td className="px-4 py-3 text-center font-semibold text-green-400">{formatCurrency(purchase.amount)}</td>
                  <td className="px-4 py-3 text-center capitalize" style={{ color: '#9A94A8' }}>{purchase.platform.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full" style={
                      purchase.status === 'VERIFIED'
                        ? { background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }
                        : purchase.status === 'PENDING'
                        ? { background: 'rgba(202, 138, 4, 0.2)', color: '#facc15' }
                        : purchase.status === 'FAILED'
                        ? { background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }
                        : { background: '#14142B', color: '#9A94A8' }
                    }>
                      {purchase.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs" style={{ color: '#9A94A8' }}>{formatDate(purchase.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
