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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leaguesRes, sportsRes] = await Promise.all([
        api.get('/admin/leagues'),
        api.get('/admin/sports'),
      ]);
      const lr = leaguesRes.data.data || leaguesRes.data;
      const sr = sportsRes.data.data || sportsRes.data;
      setLeagues(Array.isArray(lr) ? lr : []);
      const sportsList = Array.isArray(sr) ? sr.map((s: any) => ({ id: s.id, name: s.name, icon: s.icon })) : [];
      setSports(sportsList);
      if (sportsList.length && !selectedSport) setSelectedSport(sportsList[0]);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
          <h1 className="text-2xl font-bold text-gray-900">Ligas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Habilite as ligas que deseja mostrar no app. Ao habilitar, escolha a modalidade esportiva.
          </p>
        </div>
      </div>

      {/* Sport Tabs — select sport first */}
      {sports.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-sm text-yellow-700">
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
                  ? 'border-brand-700 bg-brand-700 text-white shadow-md'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {s.icon && (
                s.icon.startsWith('http')
                  ? <img src={s.icon} alt="" className="w-5 h-5" />
                  : <span className="text-lg">{s.icon}</span>
              )}
              {s.name}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                selectedSport?.id === s.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {leagues.filter((l) => l.isEnabled && l.sportId === s.id).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase">Total Disponivel</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{leagues.length.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-green-600 font-medium uppercase">Habilitadas{selectedSport ? ` (${selectedSport.name})` : ''}</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {selectedSport
              ? leagues.filter((l) => l.isEnabled && l.sportId === selectedSport.id).length
              : enabledCount}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 font-medium uppercase">Desabilitadas</p>
          <p className="text-2xl font-bold text-gray-400 mt-1">{leagues.length - enabledCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou pais..."
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-700 focus:border-transparent"
          />
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-700"
          >
            <option value="">Todos os paises</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-700"
          >
            <option value="all">Todos status</option>
            <option value="enabled">Habilitadas</option>
            <option value="disabled">Desabilitadas</option>
          </select>
          <span className="text-xs text-gray-400">
            {filtered.length.toLocaleString()} ligas
          </span>
        </div>
      </div>

      {/* Leagues Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Liga</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Pais</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Tipo</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Modalidade</th>
                <th className="text-center px-3 py-3 font-semibold text-gray-600 w-32">Acao</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-brand-700 rounded-full"></div>
                      Carregando ligas do API-Football...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    Nenhuma liga encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filtered.map((league) => (
                  <tr
                    key={league.apiFootballId}
                    className={`border-b border-gray-50 hover:bg-gray-50/80 transition-colors ${
                      league.isEnabled ? 'bg-green-50/30' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {league.logo && (
                          <img src={league.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                        )}
                        <span className={`font-medium text-xs ${league.isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                          {league.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {league.countryFlag && (
                          <img src={league.countryFlag} alt="" className="w-4 h-3 object-contain" />
                        )}
                        <span className="text-gray-600 text-xs">{league.country}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-xs text-gray-400">
                        {league.type === 'League' ? 'Liga' : league.type === 'Cup' ? 'Copa' : league.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {league.isEnabled && league.sportName ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-700/10 text-brand-700">
                          {league.sportName}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {league.isEnabled ? (
                        <button
                          onClick={() => handleDisable(league)}
                          disabled={actionLoading === league.apiFootballId}
                          className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === league.apiFootballId ? '...' : 'Desabilitar'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEnable(league)}
                          disabled={actionLoading === league.apiFootballId || !selectedSport}
                          className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
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
