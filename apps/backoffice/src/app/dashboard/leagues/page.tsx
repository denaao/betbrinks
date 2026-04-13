'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import api from '@/lib/api';

interface Sport {
  id: number;
  name: string;
  icon: string | null;
}

interface League {
  apiFootballId: number;
  name: string;
  country: string;
  countryFlag?: string;
  logo?: string;
  type: string;
  dbId: number | null;
  isEnabled: boolean;
  sportId: number | null;
  sportName: string | null;
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);

  const loadSports = useCallback(async () => {
    try {
      const sportsRes = await api.get('/admin/sports');
      const sr = sportsRes.data.data || sportsRes.data;
      const sportsList = Array.isArray(sr) ? sr.map((s: any) => ({ id: s.id, name: s.name, icon: s.icon })) : [];
      setSports(sportsList);
      if (sportsList.length && !selectedSport) setSelectedSport(sportsList[0]);
      return sportsList;
    } catch {
      return [];
    }
  }, []);

  const loadLeagues = useCallback(async (sportId?: number) => {
    setLoading(true);
    try {
      const url = sportId ? `/admin/leagues?sportId=${sportId}` : '/admin/leagues';
      const leaguesRes = await api.get(url);
      const lr = leaguesRes.data.data || leaguesRes.data;
      setLeagues(Array.isArray(lr) ? lr : []);
    } catch {
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load sports once, then leagues are loaded when selectedSport changes
  useEffect(() => {
    loadSports();
  }, [loadSports]);

  useEffect(() => {
    if (selectedSport) loadLeagues(selectedSport.id);
  }, [selectedSport, loadLeagues]);

  // ─── Derived data ──────────────────────────────────────────────────

  const countries = useMemo(() => {
    const set = new Set(leagues.map((l) => l.country));
    return Array.from(set).sort();
  }, [leagues]);

  const filtered = useMemo(() => {
    let list = leagues;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.country.toLowerCase().includes(q),
      );
    }
    if (filterCountry) {
      list = list.filter((l) => l.country === filterCountry);
    }
    if (filterStatus === 'enabled') {
      list = list.filter((l) => l.isEnabled);
    } else if (filterStatus === 'disabled') {
      list = list.filter((l) => !l.isEnabled);
    }
    return list;
  }, [leagues, search, filterCountry, filterStatus]);

  const enabledCount = leagues.filter((l) => l.isEnabled).length;
  const [sportEnabledCounts, setSportEnabledCounts] = useState<Record<number, number>>({});

  // Load enabled counts per sport for the tab badges
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/admin/leagues/enabled');
        const data = res.data.data || res.data;
        if (Array.isArray(data)) {
          const counts: Record<number, number> = {};
          data.forEach((l: any) => {
            if (l.isActive && l.sportId) {
              counts[l.sportId] = (counts[l.sportId] || 0) + 1;
            }
          });
          setSportEnabledCounts(counts);
        }
      } catch { /* silent */ }
    })();
  }, [leagues]);

  // ─── Actions ───────────────────────────────────────────────────────

  const handleEnable = async (league: League) => {
    if (!selectedSport) return;
    try {
      setActionLoading(league.apiFootballId);
      await api.post('/admin/leagues/enable', {
        apiFootballId: league.apiFootballId,
        name: league.name,
        country: league.country,
        logo: league.logo,
        sportId: selectedSport.id,
      });
      setLeagues((prev) =>
        prev.map((l) =>
          l.apiFootballId === league.apiFootballId
            ? { ...l, isEnabled: true, sportId: selectedSport.id, sportName: selectedSport.name }
            : l,
        ),
      );
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisable = async (league: League) => {
    try {
      setActionLoading(league.apiFootballId);
      await api.post('/admin/leagues/disable', {
        apiFootballId: league.apiFootballId,
      });
      setLeagues((prev) =>
        prev.map((l) =>
          l.apiFootballId === league.apiFootballId
            ? { ...l, isEnabled: false }
            : l,
        ),
      );
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };


  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#F0EAE0' }}>Ligas</h1>
          <p className="text-sm mt-1" style={{ color: '#9A94A8' }}>
            Habilite as ligas que deseja mostrar no app. Ao habilitar, escolha a modalidade esportiva.
          </p>
        </div>
      </div>

      {/* Sport Tabs — select sport first */}
      {sports.length === 0 ? (
        <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#FBBF24' }} className="rounded-xl p-4 mb-6 text-sm">
          Nenhuma modalidade cadastrada. Vá em <strong>Modalidades</strong> e crie pelo menos uma (ex: Futebol) antes de habilitar ligas.
        </div>
      ) : (
        <div className="flex gap-2 mb-6 flex-wrap">
          {sports.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelectedSport(s); setFilterCountry(''); setSearch(''); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                selectedSport?.id === s.id
                  ? 'border-brand-400 bg-brand-400 text-white shadow-md'
                  : 'text-gray-300 hover:bg-white/5'
              }`}
              style={selectedSport?.id === s.id ? {} : { borderColor: '#2A2A45', background: 'transparent' }}
            >
              {s.icon && (
                s.icon.startsWith('http')
                  ? <img src={s.icon} alt="" className="w-5 h-5" />
                  : <span className="text-lg">{s.icon}</span>
              )}
              {s.name}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                selectedSport?.id === s.id ? 'bg-white/20 text-white' : ''
              }`}
              style={selectedSport?.id === s.id ? {} : { background: 'rgba(156, 163, 175, 0.15)', color: '#9CA3AF' }}
              >
                {sportEnabledCounts[s.id] || 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div style={{ background: '#1E1E38', border: '1px solid #2A2A45' }} className="rounded-xl p-4">
          <p className="text-xs font-medium uppercase" style={{ color: '#9A94A8' }}>Total Disponivel</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#F0EAE0' }}>{leagues.length.toLocaleString()}</p>
        </div>
        <div style={{ background: '#1E1E38', border: '1px solid #2A2A45' }} className="rounded-xl p-4">
          <p className="text-xs font-medium uppercase" style={{ color: '#10B981' }}>Habilitadas{selectedSport ? ` (${selectedSport.name})` : ''}</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#10B981' }}>
            {enabledCount}
          </p>
        </div>
        <div style={{ background: '#1E1E38', border: '1px solid #2A2A45' }} className="rounded-xl p-4">
          <p className="text-xs font-medium uppercase" style={{ color: '#9A94A8' }}>Desabilitadas</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#9A94A8' }}>{leagues.length - enabledCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: '#1E1E38', border: '1px solid #2A2A45' }} className="rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou pais..."
            style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
          />
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
            className="px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">Todos os paises</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
            className="px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="all">Todos status</option>
            <option value="enabled">Habilitadas</option>
            <option value="disabled">Desabilitadas</option>
          </select>
          <span className="text-xs" style={{ color: '#9A94A8' }}>
            {filtered.length.toLocaleString()} ligas
          </span>
        </div>
      </div>

      {/* Leagues Table */}
      <div style={{ background: '#1E1E38', border: '1px solid #2A2A45' }} className="rounded-xl overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead style={{ background: '#14142B', borderBottom: '1px solid #2A2A45' }} className="sticky top-0 z-10">
              <tr>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Liga</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Pais</th>
                <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Tipo</th>
                <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Modalidade</th>
                <th className="text-center px-3 py-3 font-semibold w-32" style={{ color: '#9A94A8' }}>Acao</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12" style={{ color: '#9A94A8' }}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin w-6 h-6 border-2 rounded-full" style={{ borderColor: '#2A2A45', borderTopColor: '#C4956A' }}></div>
                      Carregando ligas do API-Football...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12" style={{ color: '#9A94A8' }}>
                    Nenhuma liga encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filtered.map((league) => (
                  <tr
                    key={league.apiFootballId}
                    style={{ borderBottom: '1px solid #2A2A45', background: league.isEnabled ? 'rgba(16, 185, 129, 0.08)' : 'transparent' }}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {league.logo && (
                          <img src={league.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                        )}
                        <span className="font-medium text-xs" style={{ color: league.isEnabled ? '#F0EAE0' : '#9A94A8' }}>
                          {league.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {league.countryFlag && (
                          <img src={league.countryFlag} alt="" className="w-4 h-3 object-contain" />
                        )}
                        <span className="text-xs" style={{ color: '#9A94A8' }}>{league.country}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-xs" style={{ color: '#9A94A8' }}>
                        {league.type === 'League' ? 'Liga' : league.type === 'Cup' ? 'Copa' : league.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {league.isEnabled && league.sportName ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full" style={{ background: 'rgba(196, 149, 106, 0.2)', color: '#C4956A' }}>
                          {league.sportName}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: '#9A94A8' }}>—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {league.isEnabled ? (
                        <button
                          onClick={() => handleDisable(league)}
                          disabled={actionLoading === league.apiFootballId}
                          className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#F87171' }}
                        >
                          {actionLoading === league.apiFootballId ? '...' : 'Desabilitar'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEnable(league)}
                          disabled={actionLoading === league.apiFootballId || !selectedSport}
                          className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                          style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}
                          title={!selectedSport ? 'Selecione uma modalidade acima' : `Habilitar para ${selectedSport.name}`}
                        >
                          {actionLoading === league.apiFootballId ? '...' : 'Habilitar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
