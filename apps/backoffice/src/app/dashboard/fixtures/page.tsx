'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

interface Fixture {
  id: string;
  apiFootballId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  status: string;
  date: string;
  homeScore: number | null;
  awayScore: number | null;
  _count?: { bets: number; markets: number };
  betCount?: number;
  marketCount?: number;
}

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-600',
  LIVE_1H: 'bg-green-100 text-green-700',
  LIVE_2H: 'bg-green-100 text-green-700',
  HALFTIME: 'bg-yellow-100 text-yellow-700',
  FINISHED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-red-100 text-red-700',
  POSTPONED: 'bg-orange-100 text-orange-700',
  ABANDONED: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Agendado',
  LIVE_1H: 'Ao Vivo (1T)',
  LIVE_2H: 'Ao Vivo (2T)',
  HALFTIME: 'Intervalo',
  FINISHED: 'Finalizado',
  CANCELLED: 'Cancelado',
  POSTPONED: 'Adiado',
  ABANDONED: 'Abandonado',
};

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const loadFixtures = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (filter !== 'all') params.filter = filter;
      const { data } = await api.get('/admin/fixtures', { params });
      const res = data.data || data;
      setFixtures(res.fixtures || res.items || res || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    loadFixtures();
  }, [loadFixtures]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });

  const isLive = (status: string) => ['LIVE_1H', 'LIVE_2H', 'HALFTIME'].includes(status);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Jogos / Fixtures</h1>

      {/* Filters */}
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
            {f === 'upcoming' && 'Proximos'}
            {f === 'finished' && 'Finalizados'}
          </button>
        ))}
      </div>

      {/* Fixtures Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Jogo</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Liga</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Placar</th>
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
              fixtures.map((fixture) => (
                <tr
                  key={fixture.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    isLive(fixture.status) ? 'bg-green-50/30' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {fixture.homeTeam} <span className="text-gray-400">vs</span> {fixture.awayTeam}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{fixture.league}</td>
                  <td className="px-4 py-3 text-center">
                    {fixture.homeScore !== null && fixture.awayScore !== null ? (
                      <span className="font-bold text-gray-900">
                        {fixture.homeScore} - {fixture.awayScore}
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
                    {formatDate(fixture.date)}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-blue-600">
                    {fixture._count?.bets || fixture.betCount || 0}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-purple-600">
                    {fixture._count?.markets || fixture.marketCount || 0}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end mt-4">
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Anterior
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">Pagina {page}</span>
          <button
            disabled={fixtures.length < limit}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Proximo
          </button>
        </div>
      </div>
    </div>
  );
}
