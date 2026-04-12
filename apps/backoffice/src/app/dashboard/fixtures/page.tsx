'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

interface Sport {
  id: number;
  name: string;
  key: string;
  icon?: string;
}

interface Fixture {
  id: string;
  apiFootballId: number;
  sportKey: string;
  homeTeam: string;
  awayTeam: string;
  leagueName: string;
  status: string;
  startAt: string;
  date?: string;
  scoreHome: number | null;
  scoreAway: number | null;
  homeScore?: number | null;
  awayScore?: number | null;
  _count?: { bets: number; markets: number };
  betCount?: number;
  marketCount?: number;
  totalBets?: number;
  totalMarkets?: number;
}

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-600',
  FIRST_HALF: 'bg-green-100 text-green-700',
  SECOND_HALF: 'bg-green-100 text-green-700',
  HALFTIME: 'bg-yellow-100 text-yellow-700',
  EXTRA_TIME: 'bg-green-100 text-green-700',
  PENALTIES: 'bg-green-100 text-green-700',
  QUARTER_1: 'bg-green-100 text-green-700',
  QUARTER_2: 'bg-green-100 text-green-700',
  QUARTER_3: 'bg-green-100 text-green-700',
  QUARTER_4: 'bg-green-100 text-green-700',
  OVERTIME: 'bg-green-100 text-green-700',
  BREAK: 'bg-yellow-100 text-yellow-700',
  SET_1: 'bg-green-100 text-green-700',
  SET_2: 'bg-green-100 text-green-700',
  SET_3: 'bg-green-100 text-green-700',
  SET_4: 'bg-green-100 text-green-700',
  SET_5: 'bg-green-100 text-green-700',
  ROUND_1: 'bg-green-100 text-green-700',
  ROUND_2: 'bg-green-100 text-green-700',
  ROUND_3: 'bg-green-100 text-green-700',
  ROUND_4: 'bg-green-100 text-green-700',
  ROUND_5: 'bg-green-100 text-green-700',
  IN_PROGRESS: 'bg-green-100 text-green-700',
  FINISHED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-red-100 text-red-700',
  POSTPONED: 'bg-orange-100 text-orange-700',
  SUSPENDED: 'bg-orange-100 text-orange-700',
};

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Agendado',
  FIRST_HALF: 'Ao Vivo (1T)',
  SECOND_HALF: 'Ao Vivo (2T)',
  HALFTIME: 'Intervalo',
  EXTRA_TIME: 'Prorrogação',
  PENALTIES: 'Pênaltis',
  QUARTER_1: 'Ao Vivo (Q1)',
  QUARTER_2: 'Ao Vivo (Q2)',
  QUARTER_3: 'Ao Vivo (Q3)',
  QUARTER_4: 'Ao Vivo (Q4)',
  OVERTIME: 'Prorrogação',
  BREAK: 'Intervalo',
  SET_1: 'Ao Vivo (Set 1)',
  SET_2: 'Ao Vivo (Set 2)',
  SET_3: 'Ao Vivo (Set 3)',
  SET_4: 'Ao Vivo (Set 4)',
  SET_5: 'Ao Vivo (Set 5)',
  ROUND_1: 'Ao Vivo (R1)',
  ROUND_2: 'Ao Vivo (R2)',
  ROUND_3: 'Ao Vivo (R3)',
  ROUND_4: 'Ao Vivo (R4)',
  ROUND_5: 'Ao Vivo (R5)',
  IN_PROGRESS: 'Ao Vivo',
  FINISHED: 'Finalizado',
  CANCELLED: 'Cancelado',
  POSTPONED: 'Adiado',
  SUSPENDED: 'Suspenso',
};

const SPORT_ICONS: Record<string, string> = {
  football: '⚽',
  basketball: '🏀',
  volleyball: '🏐',
  mma: '🥊',
  formula1: '🏎️',
};

export default function FixturesPage() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSportKey, setSelectedSportKey] = useState<string>('');
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Load sports on mount
  useEffect(() => {
    api.get('/admin/sports').then(({ data }) => {
      const list = data.data || data;
      if (Array.isArray(list) && list.length > 0) {
        const order: Record<string, number> = { football: 1, basketball: 2, volleyball: 3, mma: 4, formula1: 5 };
        const sorted = [...list].sort((a: Sport, b: Sport) => (order[a.key] || 99) - (order[b.key] || 99));
        setSports(sorted);
        setSelectedSportKey(sorted[0].key || 'football');
      }
    }).catch(() => {});
  }, []);

  const loadFixtures = useCallback(async () => {
    if (!selectedSportKey) return;
    setLoading(true);
    try {
      const params: any = { page, limit, sportKey: selectedSportKey };
      if (filter !== 'all') params.filter = filter;
      const { data: axiosData } = await api.get('/admin/fixtures', { params });
      // API response: { success, data: { data: [...], total, totalPages } }
      const wrapped = axiosData.data || axiosData;
      const list = wrapped.data || wrapped.fixtures || wrapped.items || wrapped;
      setFixtures(Array.isArray(list) ? list : []);
      setTotalPages(wrapped.totalPages || axiosData.totalPages || 1);
    } catch {
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  }, [page, filter, selectedSportKey]);

  useEffect(() => {
    loadFixtures();
  }, [loadFixtures]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });

  const isLive = (status: string) =>
    ['FIRST_HALF', 'SECOND_HALF', 'HALFTIME', 'EXTRA_TIME', 'PENALTIES', 'QUARTER_1', 'QUARTER_2', 'QUARTER_3', 'QUARTER_4', 'OVERTIME', 'BREAK', 'SET_1', 'SET_2', 'SET_3', 'SET_4', 'SET_5', 'ROUND_1', 'ROUND_2', 'ROUND_3', 'ROUND_4', 'ROUND_5', 'IN_PROGRESS'].includes(status);

  const isTeamSport = ['football', 'basketball', 'volleyball'].includes(selectedSportKey);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Jogos / Fixtures</h1>

      {/* Sport Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {sports.map((sport) => (
          <button
            key={sport.id}
            onClick={() => { setSelectedSportKey(sport.key); setPage(1); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
              selectedSportKey === sport.key
                ? 'bg-brand-700 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span>{SPORT_ICONS[sport.key] || '🏆'}</span>
            {sport.name}
          </button>
        ))}
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'live', 'upcoming', 'finished'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              filter === f
                ? 'bg-brand-700 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f === 'all' && 'Todos'}
            {f === 'live' && '🔴 Ao Vivo'}
            {f === 'upcoming' && 'Próximos'}
            {f === 'finished' && 'Finalizados'}
          </button>
        ))}
      </div>

      {/* Fixtures Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">
                {isTeamSport ? 'Jogo' : selectedSportKey === 'mma' ? 'Luta' : 'Evento'}
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Liga</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">
                {isTeamSport || selectedSportKey === 'mma' ? 'Placar' : 'Info'}
              </th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Data</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Apostas</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Mercados</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400">Carregando...</td>
              </tr>
            ) : fixtures.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400">Nenhum jogo encontrado</td>
              </tr>
            ) : (
              fixtures.map((fixture) => {
                const home = fixture.homeTeam;
                const away = fixture.awayTeam;
                const sHome = fixture.scoreHome ?? fixture.homeScore;
                const sAway = fixture.scoreAway ?? fixture.awayScore;
                const bets = fixture.totalBets ?? fixture._count?.bets ?? fixture.betCount ?? 0;
                const mkts = fixture.totalMarkets ?? fixture._count?.markets ?? fixture.marketCount ?? 0;
                const dateStr = fixture.startAt || fixture.date || '';

                return (
                  <tr
                    key={fixture.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      isLive(fixture.status) ? 'bg-green-50/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {home} <span className="text-gray-400">{isTeamSport || selectedSportKey === 'mma' ? 'vs' : '—'}</span> {away}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fixture.leagueName}</td>
                    <td className="px-4 py-3 text-center">
                      {sHome !== null && sHome !== undefined && sAway !== null && sAway !== undefined ? (
                        <span className="font-bold text-gray-900">
                          {sHome} - {sAway}
                        </span>
                      ) : (
                        <span className="text-gray-300">- x -</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                        STATUS_COLORS[fixture.status] || 'bg-gray-100 text-gray-600'
                      }`}>
                        {STATUS_LABELS[fixture.status] || fixture.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs whitespace-nowrap">
                      {dateStr ? formatDate(dateStr) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-blue-600">
                      {bets}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-purple-600">
                      {mkts}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-gray-500">
          Página {page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Anterior
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Próximo
          </button>
        </div>
      </div>
    </div>
  );
}
