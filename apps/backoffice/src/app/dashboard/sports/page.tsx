'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

interface Sport {
  id: number;
  name: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  _count?: { leagues: number };
}

export default function SportsPage() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadSports = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/sports');
      const res = data.data || data;
      setSports(Array.isArray(res) ? res : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSports();
  }, [loadSports]);

  const handleSubmit = async () => {
    if (!formName.trim()) return;
    try {
      if (editingId) {
        await api.put(`/admin/sports/${editingId}`, {
          name: formName.trim(),
          icon: formIcon.trim() || null,
        });
      } else {
        await api.post('/admin/sports', {
          name: formName.trim(),
          icon: formIcon.trim() || null,
        });
      }
      setFormName('');
      setFormIcon('');
      setShowForm(false);
      setEditingId(null);
      await loadSports();
    } catch {
      // silent
    }
  };

  const startEdit = (sport: Sport) => {
    setEditingId(sport.id);
    setFormName(sport.name);
    setFormIcon(sport.icon || '');
    setShowForm(true);
  };

  const handleToggle = async (sport: Sport) => {
    try {
      setActionLoading(sport.id);
      await api.put(`/admin/sports/${sport.id}/toggle`);
      await loadSports();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (sport: Sport) => {
    if (!confirm(`Remover modalidade "${sport.name}"? As ligas associadas ficarão sem modalidade.`)) return;
    try {
      setActionLoading(sport.id);
      await api.delete(`/admin/sports/${sport.id}`);
      await loadSports();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleMoveUp = async (sport: Sport, index: number) => {
    if (index === 0) return;
    const prev = sports[index - 1];
    try {
      await api.put(`/admin/sports/${sport.id}`, { sortOrder: prev.sortOrder });
      await api.put(`/admin/sports/${prev.id}`, { sortOrder: sport.sortOrder });
      await loadSports();
    } catch {}
  };

  const handleMoveDown = async (sport: Sport, index: number) => {
    if (index === sports.length - 1) return;
    const next = sports[index + 1];
    try {
      await api.put(`/admin/sports/${sport.id}`, { sortOrder: next.sortOrder });
      await api.put(`/admin/sports/${next.id}`, { sortOrder: sport.sortOrder });
      await loadSports();
    } catch {}
  };

  const activeCount = sports.filter((s) => s.isActive).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modalidades</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie as modalidades esportivas exibidas no app. A ordem aqui define a ordem no app.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormName('');
            setFormIcon('');
          }}
          className="px-4 py-2.5 bg-brand-700 text-white text-sm font-semibold rounded-lg hover:bg-brand-800 transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Nova Modalidade'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{sports.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-green-600 font-medium uppercase">Ativas no App</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{activeCount}</p>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? 'Editar Modalidade' : 'Nova Modalidade'}
          </h2>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Nome
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Ex: Futebol, Basquete, Tênis..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-700 focus:border-transparent"
              />
            </div>
            <div className="w-48">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Icone (emoji ou URL)
              </label>
              <input
                type="text"
                value={formIcon}
                onChange={(e) => setFormIcon(e.target.value)}
                placeholder="⚽ ou URL"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-700 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!formName.trim()}
              className="px-6 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {editingId ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </div>
      )}

      {/* Sports Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-center px-3 py-3 font-semibold text-gray-600 w-16">Ordem</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Modalidade</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Ligas</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  Carregando...
                </td>
              </tr>
            ) : sports.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  Nenhuma modalidade cadastrada. Crie a primeira acima.
                </td>
              </tr>
            ) : (
              sports.map((sport, idx) => (
                <tr
                  key={sport.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    !sport.isActive ? 'opacity-60' : ''
                  }`}
                >
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleMoveUp(sport, idx)}
                        disabled={idx === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        title="Mover para cima"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveDown(sport, idx)}
                        disabled={idx === sports.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        title="Mover para baixo"
                      >
                        ▼
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {sport.icon && (
                        sport.icon.startsWith('http') ? (
                          <img src={sport.icon} alt={sport.name} className="w-6 h-6 object-contain" />
                        ) : (
                          <span className="text-lg">{sport.icon}</span>
                        )
                      )}
                      <span className="font-medium text-gray-900">{sport.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-blue-600">
                      {sport._count?.leagues || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                        sport.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {sport.isActive ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => startEdit(sport)}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggle(sport)}
                        disabled={actionLoading === sport.id}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                          sport.isActive
                            ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {sport.isActive ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => handleDelete(sport)}
                        disabled={actionLoading === sport.id}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
