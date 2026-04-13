'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Commission {
  id: number;
  betAmount: number;
  leagueProfit: number;
  commissionPct: number;
  commissionAmt: number;
  level: number;
  createdAt: string;
}

interface Referral {
  userId: number;
  userName: string;
  joinedAt: string;
}

interface SubAffiliate {
  id: number;
  userId: number;
  userName: string;
  affiliateCode: string;
  revenueSharePct: number;
  referralCount: number;
}

interface DashboardData {
  affiliate: {
    id: number;
    code: string;
    revenueSharePct: number;
    userName: string;
    leagueName: string;
    isActive: boolean;
  };
  stats: {
    totalReferrals: number;
    totalCommission: number;
    totalLeagueProfit: number;
    recentCommissions: Commission[];
    monthly: { month: string; commission: number; bets: number }[];
  };
  referrals: Referral[];
  subAffiliates: SubAffiliate[];
}

interface AffiliateInfo {
  affiliateId: number;
  leagueId: number;
  leagueName: string;
  affiliateCode: string;
  revenueSharePct: number;
}

// ─── Bets types ──────────────────────────────────────────
interface BetUser { id: number; name: string; cpf: string; }
interface BetFixture {
  id: number; homeTeam: string; awayTeam: string;
  scoreHome: number | null; scoreAway: number | null; startAt: string; status: string;
  leagueName: string; sportKey: string;
}
interface BetOdd { name: string; value: number; marketType: string; }
interface BetItem {
  id: number; user: BetUser; fixture: BetFixture; odd: BetOdd;
  amount: number; oddValue: number; potentialReturn: number; status: string;
  createdAt: string; settledAt: string | null;
}
interface BetStats { totalBets: number; totalWon: number; totalLost: number; totalPending: number; totalAmount: number; }
interface BetResponse {
  stats: BetStats; data: BetItem[];
  total: number; page: number; limit: number; totalPages: number;
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pendente', color: '#facc15', bg: 'rgba(250,204,21,0.15)' },
  WON: { label: 'Ganhou', color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
  LOST: { label: 'Perdeu', color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
  VOID: { label: 'Anulada', color: '#9A94A8', bg: 'rgba(255,255,255,0.08)' },
  CASHOUT: { label: 'Cashout', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)' },
};

const MARKET_LABELS: Record<string, string> = {
  MATCH_WINNER: 'Resultado',
  OVER_UNDER_25: 'Gols +/- 2.5',
  BOTH_TEAMS_SCORE: 'Ambos Marcam',
  DOUBLE_CHANCE: 'Dupla Chance',
  DRAW_NO_BET: 'Sem Empate',
};

export default function AffiliatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'referrals' | 'commissions' | 'bets' | 'subs'>('overview');
  const [affiliates, setAffiliates] = useState<AffiliateInfo[]>([]);
  const [selectedAffiliate, setSelectedAffiliate] = useState<number | null>(null);

  // ─── Bets state ──────────────────────────────────────────
  const [betsData, setBetsData] = useState<BetResponse | null>(null);
  const [betsLoading, setBetsLoading] = useState(false);
  const [betsPage, setBetsPage] = useState(1);
  const [betsSearch, setBetsSearch] = useState('');
  const [betsSearchInput, setBetsSearchInput] = useState('');
  const [betsStatus, setBetsStatus] = useState('ALL');
  const [betsDateFrom, setBetsDateFrom] = useState('');
  const [betsDateTo, setBetsDateTo] = useState('');

  const fetchDashboard = useCallback(async (token: string, affiliateId: number) => {
    try {
      const res = await fetch(`${API}/affiliates/backoffice/dashboard/${affiliateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Sessão expirada');
      const json = await res.json();
      const data = json.data || json;
      setDashboard(data);
    } catch {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_role');
      router.push('/login');
    }
  }, [router]);

  // ─── Fetch bets ──────────────────────────────────────────
  const fetchBets = useCallback(async (affiliateId: number) => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setBetsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(betsPage), limit: '25' });
      if (betsSearch) params.set('search', betsSearch);
      if (betsStatus !== 'ALL') params.set('status', betsStatus);
      if (betsDateFrom) params.set('dateFrom', betsDateFrom);
      if (betsDateTo) params.set('dateTo', betsDateTo);

      const res = await fetch(`${API}/affiliates/backoffice/${affiliateId}/bets?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erro');
      const json = await res.json();
      setBetsData(json.data || json);
    } catch {
      setBetsData(null);
    } finally {
      setBetsLoading(false);
    }
  }, [betsPage, betsSearch, betsStatus, betsDateFrom, betsDateTo]);

  // Load bets when tab is active or filters change
  useEffect(() => {
    if (activeTab === 'bets' && selectedAffiliate) {
      fetchBets(selectedAffiliate);
    }
  }, [activeTab, selectedAffiliate, fetchBets]);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const roleStr = localStorage.getItem('admin_role');

    if (!token || !roleStr) {
      router.push('/login');
      return;
    }

    try {
      const role = JSON.parse(roleStr);
      if (!role.isAffiliate || !role.affiliates || role.affiliates.length === 0) {
        router.push('/dashboard');
        return;
      }

      setAffiliates(role.affiliates);
      const firstId = role.affiliates[0].affiliateId;
      setSelectedAffiliate(firstId);
      fetchDashboard(token, firstId);
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [fetchDashboard, router]);

  const handleSwitchAffiliate = (affiliateId: number) => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setSelectedAffiliate(affiliateId);
    setDashboard(null);
    setBetsData(null);
    fetchDashboard(token, affiliateId);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_role');
    router.push('/login');
  };

  const handleBetsSearch = () => { setBetsPage(1); setBetsSearch(betsSearchInput); };
  const clearBetsFilters = () => {
    setBetsSearchInput(''); setBetsSearch(''); setBetsStatus('ALL');
    setBetsDateFrom(''); setBetsDateTo(''); setBetsPage(1);
  };

  if (loading || !dashboard) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0d1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#9A94A8' }}>Carregando...</div>
      </div>
    );
  }

  const affiliate = dashboard.affiliate || { id: 0, code: '', revenueSharePct: 0, userName: '', leagueName: '', isActive: false };
  const stats = dashboard.stats || { totalReferrals: 0, totalCommission: 0, totalLeagueProfit: 0, recentCommissions: [], monthly: [] };
  const referrals = dashboard.referrals || [];
  const subAffiliates = dashboard.subAffiliates || [];

  const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div style={{ background: '#1E1E38', borderRadius: 12, padding: 20, flex: 1, minWidth: 150 }}>
      <div style={{ color: '#9A94A8', fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#F0EAE0', fontSize: 24, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: '#6E6880', fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const tabs = [
    { key: 'overview', label: 'Visão Geral' },
    { key: 'referrals', label: `Indicados (${referrals.length})` },
    { key: 'bets', label: 'Apostas' },
    { key: 'commissions', label: 'Comissões' },
    { key: 'subs', label: `Sub-afiliados (${subAffiliates.length})` },
  ] as const;

  let isAlsoAdmin = false;
  try {
    const roleStr = localStorage.getItem('admin_role');
    if (roleStr) {
      const role = JSON.parse(roleStr);
      isAlsoAdmin = role.isAdmin === true;
    }
  } catch {}

  const fmt = (v: number) => v.toLocaleString('pt-BR');

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d1f', color: '#F0EAE0' }}>
      {/* Header */}
      <div style={{ background: '#1E1E38', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2A2A45' }}>
        <div>
          <span style={{ color: '#C4956A', fontWeight: 700, fontSize: 18 }}>BetBrinks</span>
          <span style={{ color: '#9A94A8', marginLeft: 12, fontSize: 13 }}>Painel do Afiliado</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {affiliates.length > 1 && (
            <select
              value={selectedAffiliate || ''}
              onChange={(e) => handleSwitchAffiliate(Number(e.target.value))}
              style={{ background: '#14142B', border: '1px solid #2A2A45', borderRadius: 6, padding: '4px 8px', color: '#F0EAE0', fontSize: 12 }}
            >
              {affiliates.map((a) => (
                <option key={a.affiliateId} value={a.affiliateId}>
                  {a.leagueName} ({a.affiliateCode})
                </option>
              ))}
            </select>
          )}
          <span style={{ color: '#F0EAE0', fontSize: 13 }}>{affiliate.userName}</span>
          <span style={{ background: '#14142B', padding: '4px 10px', borderRadius: 6, fontSize: 12, color: '#C4956A' }}>
            {affiliate.code}
          </span>
          {isAlsoAdmin && (
            <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: '1px solid #2A2A45', borderRadius: 6, padding: '4px 12px', color: '#6BCB77', cursor: 'pointer', fontSize: 12 }}>
              Painel Admin
            </button>
          )}
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #2A2A45', borderRadius: 6, padding: '4px 12px', color: '#9A94A8', cursor: 'pointer', fontSize: 12 }}>
            Sair
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        {/* Info */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Olá, {affiliate.userName}</h2>
          <div style={{ color: '#9A94A8', fontSize: 13 }}>
            Liga: <strong style={{ color: '#C4956A' }}>{affiliate.leagueName}</strong> · Revenue Share: <strong style={{ color: '#6BCB77' }}>{affiliate.revenueSharePct}%</strong>
            {!affiliate.isActive && <span style={{ color: '#E07A5F', marginLeft: 8 }}>(Desativado)</span>}
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard label="Indicados" value={stats.totalReferrals} />
          <StatCard label="Comissão Total" value={stats.totalCommission.toLocaleString('pt-BR') + ' pts'} />
          <StatCard label="Lucro Gerado" value={stats.totalLeagueProfit.toLocaleString('pt-BR') + ' pts'} sub="apostas perdidas dos indicados" />
          <StatCard label="Sub-afiliados" value={subAffiliates.length} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #2A2A45', paddingBottom: 0 }}>
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                background: activeTab === tab.key ? '#2A2A45' : 'transparent',
                color: activeTab === tab.key ? '#F0EAE0' : '#6E6880',
                border: 'none', padding: '8px 16px', borderRadius: '8px 8px 0 0',
                cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ background: '#1E1E38', borderRadius: 12, padding: 20 }}>
          {activeTab === 'overview' && (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#C4956A' }}>Resumo Mensal</h3>
              {stats.monthly.length === 0 ? (
                <div style={{ color: '#6E6880', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhuma comissão ainda</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2A2A45' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, color: '#9A94A8' }}>Mês</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#9A94A8' }}>Apostas</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#9A94A8' }}>Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.monthly.map((m) => (
                      <tr key={m.month} style={{ borderBottom: '1px solid #1a1a35' }}>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>{m.month}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'right' }}>{m.bets}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'right', color: '#6BCB77' }}>{m.commission.toLocaleString('pt-BR')} pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'referrals' && (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#C4956A' }}>Seus Indicados</h3>
              {referrals.length === 0 ? (
                <div style={{ color: '#6E6880', fontSize: 13, textAlign: 'center', padding: 20 }}>
                  Nenhum indicado ainda. Compartilhe seu código: <strong style={{ color: '#C4956A' }}>{affiliate.code}</strong>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2A2A45' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, color: '#9A94A8' }}>Jogador</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#9A94A8' }}>Entrou em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((r) => (
                      <tr key={r.userId} style={{ borderBottom: '1px solid #1a1a35' }}>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>{r.userName}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'right', color: '#9A94A8' }}>
                          {new Date(r.joinedAt).toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ─── BETS TAB ──────────────────────────────────────────── */}
          {activeTab === 'bets' && (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#C4956A' }}>Apostas dos Indicados</h3>

              {/* Bets Stats */}
              {betsData?.stats && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ background: '#14142B', borderRadius: 8, padding: '10px 16px', flex: 1, minWidth: 100 }}>
                    <div style={{ fontSize: 11, color: '#9A94A8' }}>Total</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#F0EAE0' }}>{fmt(betsData.stats.totalBets)}</div>
                  </div>
                  <div style={{ background: '#14142B', borderRadius: 8, padding: '10px 16px', flex: 1, minWidth: 100 }}>
                    <div style={{ fontSize: 11, color: '#9A94A8' }}>Pendentes</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#facc15' }}>{fmt(betsData.stats.totalPending)}</div>
                  </div>
                  <div style={{ background: '#14142B', borderRadius: 8, padding: '10px 16px', flex: 1, minWidth: 100 }}>
                    <div style={{ fontSize: 11, color: '#9A94A8' }}>Ganhas</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80' }}>{fmt(betsData.stats.totalWon)}</div>
                  </div>
                  <div style={{ background: '#14142B', borderRadius: 8, padding: '10px 16px', flex: 1, minWidth: 100 }}>
                    <div style={{ fontSize: 11, color: '#9A94A8' }}>Perdidas</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#f87171' }}>{fmt(betsData.stats.totalLost)}</div>
                  </div>
                  <div style={{ background: '#14142B', borderRadius: 8, padding: '10px 16px', flex: 1, minWidth: 100 }}>
                    <div style={{ fontSize: 11, color: '#9A94A8' }}>Vol. Apostado</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#C4956A' }}>{fmt(betsData.stats.totalAmount)} pts</div>
                  </div>
                </div>
              )}

              {/* Bets Filters */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 11, color: '#9A94A8', marginBottom: 4 }}>Buscar</div>
                  <input
                    type="text"
                    value={betsSearchInput}
                    onChange={(e) => setBetsSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBetsSearch()}
                    placeholder="Nome ou CPF..."
                    style={{ width: '100%', height: 36, background: '#14142B', border: '1px solid #2A2A45', borderRadius: 6, padding: '0 10px', color: '#F0EAE0', fontSize: 13, outline: 'none' }}
                  />
                </div>
                <div style={{ minWidth: 120 }}>
                  <div style={{ fontSize: 11, color: '#9A94A8', marginBottom: 4 }}>Status</div>
                  <select
                    value={betsStatus}
                    onChange={(e) => { setBetsStatus(e.target.value); setBetsPage(1); }}
                    style={{ width: '100%', height: 36, background: '#14142B', border: '1px solid #2A2A45', borderRadius: 6, padding: '0 8px', color: '#F0EAE0', fontSize: 13 }}
                  >
                    <option value="ALL">Todos</option>
                    <option value="PENDING">Pendente</option>
                    <option value="WON">Ganhou</option>
                    <option value="LOST">Perdeu</option>
                    <option value="VOID">Anulada</option>
                    <option value="CASHOUT">Cashout</option>
                  </select>
                </div>
                <div style={{ minWidth: 130 }}>
                  <div style={{ fontSize: 11, color: '#9A94A8', marginBottom: 4 }}>De</div>
                  <input
                    type="date" value={betsDateFrom}
                    onChange={(e) => { setBetsDateFrom(e.target.value); setBetsPage(1); }}
                    style={{ width: '100%', height: 36, background: '#14142B', border: '1px solid #2A2A45', borderRadius: 6, padding: '0 8px', color: '#F0EAE0', fontSize: 13 }}
                  />
                </div>
                <div style={{ minWidth: 130 }}>
                  <div style={{ fontSize: 11, color: '#9A94A8', marginBottom: 4 }}>Até</div>
                  <input
                    type="date" value={betsDateTo}
                    onChange={(e) => { setBetsDateTo(e.target.value); setBetsPage(1); }}
                    style={{ width: '100%', height: 36, background: '#14142B', border: '1px solid #2A2A45', borderRadius: 6, padding: '0 8px', color: '#F0EAE0', fontSize: 13 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handleBetsSearch} style={{ height: 36, padding: '0 14px', background: '#C4956A', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Buscar
                  </button>
                  <button onClick={clearBetsFilters} style={{ height: 36, padding: '0 14px', background: 'none', color: '#9A94A8', border: '1px solid #2A2A45', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                    Limpar
                  </button>
                </div>
              </div>

              {/* Bets count */}
              {betsData && (
                <div style={{ fontSize: 12, color: '#9A94A8', marginBottom: 12 }}>
                  {betsData.total} aposta{betsData.total !== 1 ? 's' : ''} encontrada{betsData.total !== 1 ? 's' : ''}
                </div>
              )}

              {/* Bets Table */}
              {betsLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9A94A8', fontSize: 13 }}>Carregando apostas...</div>
              ) : !betsData || betsData.data.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#6E6880', fontSize: 13 }}>Nenhuma aposta encontrada</div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #2A2A45', background: '#14142B' }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#9A94A8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Apostador</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#9A94A8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jogo</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#9A94A8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aposta</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, color: '#9A94A8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: '#9A94A8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Odd</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, color: '#9A94A8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Retorno</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: '#9A94A8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, color: '#9A94A8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {betsData.data.map((bet) => {
                          const st = STATUS_STYLES[bet.status] || STATUS_STYLES.VOID;
                          return (
                            <tr key={bet.id} style={{ borderBottom: '1px solid #1a1a35' }}>
                              <td style={{ padding: '8px 10px' }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: '#F0EAE0' }}>{bet.user.name}</div>
                                <div style={{ fontSize: 11, color: '#9A94A8', fontFamily: 'monospace' }}>{bet.user.cpf || '—'}</div>
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <div style={{ fontSize: 13, color: '#F0EAE0' }}>{bet.fixture.homeTeam} vs {bet.fixture.awayTeam}</div>
                                <div style={{ fontSize: 11, color: '#9A94A8' }}>
                                  {bet.fixture.leagueName}
                                  {bet.fixture.scoreHome !== null && (
                                    <span style={{ marginLeft: 6, fontWeight: 700, color: '#60a5fa' }}>
                                      {bet.fixture.scoreHome} x {bet.fixture.scoreAway}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: '#C4956A' }}>{bet.odd.name}</div>
                                <div style={{ fontSize: 11, color: '#9A94A8' }}>{MARKET_LABELS[bet.odd.marketType] || bet.odd.marketType}</div>
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#F0EAE0' }}>
                                {fmt(bet.amount)} pts
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#facc15', fontFamily: 'monospace' }}>
                                {bet.oddValue.toFixed(2)}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#4ade80' }}>
                                {fmt(bet.potentialReturn)} pts
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                                  {st.label}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, color: '#9A94A8', whiteSpace: 'nowrap' }}>
                                {new Date(bet.createdAt).toLocaleDateString('pt-BR')}
                                <div style={{ color: '#6B6580' }}>
                                  {new Date(bet.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Bets Pagination */}
                  {betsData.totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                      <span style={{ fontSize: 12, color: '#9A94A8' }}>
                        Página {betsData.page} de {betsData.totalPages}
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => setBetsPage(Math.max(1, betsPage - 1))}
                          disabled={betsPage <= 1}
                          style={{ padding: '6px 14px', fontSize: 12, border: '1px solid #2A2A45', borderRadius: 6, color: '#F0EAE0', background: 'none', cursor: betsPage <= 1 ? 'not-allowed' : 'pointer', opacity: betsPage <= 1 ? 0.4 : 1 }}
                        >
                          Anterior
                        </button>
                        <button
                          onClick={() => setBetsPage(Math.min(betsData.totalPages, betsPage + 1))}
                          disabled={betsPage >= betsData.totalPages}
                          style={{ padding: '6px 14px', fontSize: 12, border: '1px solid #2A2A45', borderRadius: 6, color: '#F0EAE0', background: 'none', cursor: betsPage >= betsData.totalPages ? 'not-allowed' : 'pointer', opacity: betsPage >= betsData.totalPages ? 0.4 : 1 }}
                        >
                          Próxima
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'commissions' && (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#C4956A' }}>Comissões Recentes</h3>
              {stats.recentCommissions.length === 0 ? (
                <div style={{ color: '#6E6880', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhuma comissão registrada</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2A2A45' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, color: '#9A94A8' }}>Data</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#9A94A8' }}>Aposta</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#9A94A8' }}>Lucro Liga</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#9A94A8' }}>%</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#9A94A8' }}>Comissão</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, color: '#9A94A8' }}>Nível</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentCommissions.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #1a1a35' }}>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: '#9A94A8' }}>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'right' }}>{c.betAmount.toLocaleString('pt-BR')}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'right' }}>{c.leagueProfit.toLocaleString('pt-BR')}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'right', color: '#E2B866' }}>{c.commissionPct}%</td>
                        <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'right', color: '#6BCB77', fontWeight: 600 }}>{c.commissionAmt.toLocaleString('pt-BR')}</td>
                        <td style={{ padding: '8px 12px', fontSize: 11, textAlign: 'center', color: c.level === 1 ? '#C4956A' : '#9A94A8' }}>{c.level === 1 ? 'Direto' : 'Sub'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'subs' && (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#C4956A' }}>Sub-afiliados</h3>
              {subAffiliates.length === 0 ? (
                <div style={{ color: '#6E6880', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhum sub-afiliado</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2A2A45' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, color: '#9A94A8' }}>Nome</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, color: '#9A94A8' }}>Código</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#9A94A8' }}>Revenue %</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#9A94A8' }}>Indicados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subAffiliates.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #1a1a35' }}>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>{s.userName}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'center', color: '#C4956A' }}>{s.affiliateCode}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'right', color: '#6BCB77' }}>{s.revenueSharePct}%</td>
                        <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'right' }}>{s.referralCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
