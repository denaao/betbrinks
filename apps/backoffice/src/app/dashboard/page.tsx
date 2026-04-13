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
    <div style={{ background: '#1E1E38', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #2A2A45' }}>
      <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#9A94A8', marginBottom: '0.25rem' }}>{title}</p>
      <p style={{ fontSize: '1.875rem', fontWeight: '800', lineHeight: '2.25rem' }} className={color}>{value}</p>
      <p style={{ fontSize: '0.75rem', color: '#9A94A8', marginTop: '0.25rem' }}>{sub}</p>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '16rem' }}>
        <p style={{ color: '#9A94A8' }}>Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#F0EAE0', marginBottom: '1.5rem' }}>Dashboard</h1>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <KpiCard
          title="Total Usuarios"
          value={kpis?.users.total.toLocaleString('pt-BR') || '0'}
          sub={`+${kpis?.users.newToday || 0} hoje | +${kpis?.users.newThisWeek || 0} semana`}
          color="text-brand-400"
        />
        <KpiCard
          title="Apostas Totais"
          value={kpis?.bets.total.toLocaleString('pt-BR') || '0'}
          sub={`${kpis?.bets.today || 0} hoje | ${kpis?.bets.active || 0} ativas`}
          color="text-blue-400"
        />
        <KpiCard
          title="Receita Total"
          value={formatCurrency(kpis?.revenue.total || 0)}
          sub="Diamantes vendidos"
          color="text-green-400"
        />
        <KpiCard
          title="Receita Mensal"
          value={formatCurrency(kpis?.revenue.thisMonth || 0)}
          sub="Ultimos 30 dias"
          color="text-orange-400"
        />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {/* Registrations Chart */}
        <div style={{ background: '#1E1E38', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #2A2A45' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#F0EAE0', marginBottom: '1rem' }}>Novos Cadastros (14 dias)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.25rem', height: '8rem' }}>
            {regChart.map((point) => {
              const max = Math.max(...regChart.map((p) => p.count || 0), 1);
              const height = ((point.count || 0) / max) * 100;
              return (
                <div key={point.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '100%',
                      background: '#C4956A',
                      borderTopLeftRadius: '0.125rem',
                      borderTopRightRadius: '0.125rem',
                      minHeight: '2px',
                      height: `${Math.max(height, 2)}%`,
                      transition: 'all 0.3s ease',
                    }}
                    title={`${point.date}: ${point.count}`}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#9A94A8' }}>{regChart[0]?.date?.slice(5) || ''}</span>
            <span style={{ fontSize: '0.75rem', color: '#9A94A8' }}>{regChart[regChart.length - 1]?.date?.slice(5) || ''}</span>
          </div>
        </div>

        {/* Bets Chart */}
        <div style={{ background: '#1E1E38', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #2A2A45' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#F0EAE0', marginBottom: '1rem' }}>Apostas (14 dias)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.25rem', height: '8rem' }}>
            {betChart.map((point) => {
              const max = Math.max(...betChart.map((p) => p.placed || 0), 1);
              const placedH = ((point.placed || 0) / max) * 100;
              return (
                <div key={point.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '100%',
                      background: '#60a5fa',
                      borderTopLeftRadius: '0.125rem',
                      borderTopRightRadius: '0.125rem',
                      minHeight: '2px',
                      height: `${Math.max(placedH, 2)}%`,
                    }}
                    title={`${point.date}: ${point.placed} apostas`}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#9A94A8' }}>{betChart[0]?.date?.slice(5) || ''}</span>
            <span style={{ fontSize: '0.75rem', color: '#9A94A8' }}>{betChart[betChart.length - 1]?.date?.slice(5) || ''}</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#9A94A8' }}><span style={{ display: 'inline-block', width: '0.5rem', height: '0.5rem', background: '#60a5fa', borderRadius: '50%', marginRight: '0.25rem' }} />Apostas</span>
            <span style={{ fontSize: '0.75rem', color: '#9A94A8' }}><span style={{ display: 'inline-block', width: '0.5rem', height: '0.5rem', background: '#4ade80', borderRadius: '50%', marginRight: '0.25rem' }} />Ganhas</span>
            <span style={{ fontSize: '0.75rem', color: '#9A94A8' }}><span style={{ display: 'inline-block', width: '0.5rem', height: '0.5rem', background: '#ef4444', borderRadius: '50%', marginRight: '0.25rem' }} />Perdidas</span>
          </div>
        </div>
      </div>
    </div>
  );
}
