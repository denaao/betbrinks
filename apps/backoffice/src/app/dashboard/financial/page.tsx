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

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Carregando dados financeiros...</p>
      </div>
    );
  }

  const maxPkgRevenue = Math.max(...(summary?.byPackage || []).map((p) => p.revenue), 1);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Financeiro</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm font-semibold text-gray-500 mb-1">Receita Total</p>
          <p className="text-3xl font-extrabold text-green-600">
            {formatCurrency(summary?.totalRevenue || 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Todas as compras verificadas</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm font-semibold text-gray-500 mb-1">Total de Compras</p>
          <p className="text-3xl font-extrabold text-blue-600">
            {(summary?.totalPurchases || 0).toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-gray-400 mt-1">Todas as transacoes</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm font-semibold text-gray-500 mb-1">Ticket Medio</p>
          <p className="text-3xl font-extrabold text-purple-600">
            {formatCurrency(
              summary?.totalPurchases
                ? (summary.totalRevenue || 0) / summary.totalPurchases
                : 0
            )}
          </p>
          <p className="text-xs text-gray-400 mt-1">Receita / compras</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue by Package */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Receita por Pacote</h3>
          <div className="space-y-3">
            {(summary?.byPackage || []).map((pkg) => (
              <div key={pkg.packageId}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{PACKAGE_LABELS[pkg.packageId] || pkg.packageId}</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(pkg.revenue)} ({pkg.count}x)
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${PACKAGE_COLORS[pkg.packageId] || 'bg-gray-400'}`}
                    style={{ width: `${(pkg.revenue / maxPkgRevenue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {(summary?.byPackage || []).length === 0 && (
              <p className="text-center text-gray-400 py-4">Sem dados</p>
            )}
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Status das Compras</h3>
          <div className="space-y-3">
            {(summary?.byStatus || []).map((s) => (
              <div key={s.status} className="flex items-center justify-between">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>
                  {s.status}
                </span>
                <span className="text-sm font-bold text-gray-900">{s.count}</span>
              </div>
            ))}
            {(summary?.byStatus || []).length === 0 && (
              <p className="text-center text-gray-400 py-4">Sem dados</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Purchases Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Compras Recentes</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Usuario</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Pacote</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Valor</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Plataforma</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Data</th>
            </tr>
          </thead>
          <tbody>
            {(summary?.recentPurchases || []).length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400">Nenhuma compra encontrada</td>
              </tr>
            ) : (
              summary!.recentPurchases.map((purchase) => (
                <tr key={purchase.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{purchase.userName}</td>
                  <td className="px-4 py-3 text-gray-600">{PACKAGE_LABELS[purchase.packageId] || purchase.packageId}</td>
                  <td className="px-4 py-3 text-center font-semibold text-green-600">{formatCurrency(purchase.amount)}</td>
                  <td className="px-4 py-3 text-center text-gray-500 capitalize">{purchase.platform.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[purchase.status] || 'bg-gray-100 text-gray-600'}`}>
                      {purchase.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs">{formatDate(purchase.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
