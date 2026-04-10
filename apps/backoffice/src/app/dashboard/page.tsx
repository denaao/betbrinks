'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface KPIs {
  users: { total: number; newToday: number; newThisWeek: number };
  bets: { total: number; today: number; active: number };
  revenue: { total: number; thisMonth: number };
}

interface ChartPoint {
  date: string;
  count?: number;
  placed?: number;
  won?: number;
  lost?: number;
}

function KpiCard({ title, value, sub, color }: { title: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <p className="text-sm font-semibold text-gray-500 mb-1">{title}</p>
      <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [regChart, setRegChart] = useState<ChartPoint[]>([]);
  const [betChart, setBetChart] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [kpiRes, regRes, betRes] = await Promise.all([
        api.get('/admin/dashboard/kpis'),
        api.get('/admin/dashboard/chart/registrations?days=14'),
        api.get('/admin/dashboard/chart/bets?days=14'),
      ]);
      setKpis(kpiRes.data.data || kpiRes.data);
      setRegChart(regRes.data.data || regRes.data || []);
      setBetChart(betRes.data.data || betRes.data || []);
    } catch {
      // Handle silently
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title="Total Usuarios"
          value={kpis?.users.total.toLocaleString('pt-BR') || '0'}
          sub={`+${kpis?.users.newToday || 0} hoje | +${kpis?.users.newThisWeek || 0} semana`}
          color="text-brand-700"
        />
        <KpiCard
          title="Apostas Totais"
          value={kpis?.bets.total.toLocaleString('pt-BR') || '0'}
          sub={`${kpis?.bets.today || 0} hoje | ${kpis?.bets.active || 0} ativas`}
          color="text-blue-600"
        />
        <KpiCard
          title="Receita Total"
          value={formatCurrency(kpis?.revenue.total || 0)}
          sub="Diamantes vendidos"
          color="text-green-600"
        />
        <KpiCard
          title="Receita Mensal"
          value={formatCurrency(kpis?.revenue.thisMonth || 0)}
          sub="Ultimos 30 dias"
          color="text-amber-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registrations Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Novos Cadastros (14 dias)</h3>
          <div className="flex items-end gap-1 h-32">
            {regChart.map((point) => {
              const max = Math.max(...regChart.map((p) => p.count || 0), 1);
              const height = ((point.count || 0) / max) * 100;
              return (
                <div key={point.date} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-brand-500 rounded-t-sm min-h-[2px] transition-all"
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${point.date}: ${point.count}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-400">{regChart[0]?.date?.slice(5) || ''}</span>
            <span className="text-xs text-gray-400">{regChart[regChart.length - 1]?.date?.slice(5) || ''}</span>
          </div>
        </div>

        {/* Bets Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Apostas (14 dias)</h3>
          <div className="flex items-end gap-1 h-32">
            {betChart.map((point) => {
              const max = Math.max(...betChart.map((p) => p.placed || 0), 1);
              const placedH = ((point.placed || 0) / max) * 100;
              return (
                <div key={point.date} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-blue-500 rounded-t-sm min-h-[2px]"
                    style={{ height: `${Math.max(placedH, 2)}%` }}
                    title={`${point.date}: ${point.placed} apostas`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-400">{betChart[0]?.date?.slice(5) || ''}</span>
            <span className="text-xs text-gray-400">{betChart[betChart.length - 1]?.date?.slice(5) || ''}</span>
          </div>
          <div className="flex gap-4 mt-3">
            <span className="text-xs text-gray-500"><span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1" />Apostas</span>
            <span className="text-xs text-gray-500"><span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1" />Ganhas</span>
            <span className="text-xs text-gray-500"><span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1" />Perdidas</span>
          </div>
        </div>
      </div>
    </div>
  );
}
