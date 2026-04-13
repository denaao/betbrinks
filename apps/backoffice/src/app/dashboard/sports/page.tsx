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
          <h1 className="text-2xl font-bold" style={{ color: '#F0EAE0' }}>Modalidades</h1>
          <p className="text-sm mt-1" style={{ color: '#9A94A8' }}>
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
          className="px-4 py-2.5 bg-brand-400 text-white text-sm font-semibold rounded-lg hover:bg-brand-500 transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Nova Modalidade'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div style={{ background: '#1E1E38', border: '1px solid #2A2A45' }} className="rounded-xl p-4">
          <p className="text-xs font-medium uppercase" style={{ color: '#9A94A8' }}>Total</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#F0EAE0' }}>{sports.length}</p>
        </div>
        <div style={{ background: '#1E1E38', border: '1px solid #2A2A45' }} className="rounded-xl p-4">
          <p className="text-xs font-medium uppercase" style={{ color: '#10B981' }}>Ativas no App</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#10B981' }}>{activeCount}</p>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div style={{ background: '#1E1E38', border: '1px solid #2A2A45' }} className="rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: '#F0EAE0' }}>
            {editingId ? 'Editar Modalidade' : 'Nova Modalidade'}
          </h2>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: '#9A94A8' }}>
                Nome
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Ex: Futebol, Basquete, Tênis..."
                style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
                className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              />
            </div>
            <div className="w-48">
              <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: '#9A94A8' }}>
                Icone (emoji ou URL)
              </label>
              <input
                type="text"
                value={formIcon}
                onChange={(e) => setFormIcon(e.target.value)}
                placeholder="⚽ ou URL"
                style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
                className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!formName.trim()}
              className="px-6 py-2.5 text-white text-sm font-semibold rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
              style={{ background: '#C4956A' }}
            >
              {editingId ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </div>
      )}

      {/* Sports Table */}
      <div style={{ background: '#1E1E38', border: '1px solid #2A2A45' }} className="rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: '#14142B', borderBottom: '1px solid #2A2A45' }}>
            <tr>
              <th className="text-center px-3 py-3 font-semibold w-16" style={{ color: '#9A94A8' }}>Ordem</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Modalidade</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Ligas</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Status</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8" style={{ color: '#9A94A8' }}>
                  Carregando...
                </td>
              </tr>
            ) : sports.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8" style={{ color: '#9A94A8' }}>
                  Nenhuma modalidade cadastrada. Crie a primeira acima.
                </td>
              </tr>
            ) : (
              sports.map((sport, idx) => (
                <tr
                  key={sport.id}
                  style={{ borderBottom: '1px solid #2A2A45' }}
                  className={`hover:bg-white/5 transition-colors ${
                    !sport.isActive ? 'opacity-60' : ''
                  }`}
                >
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleMoveUp(sport, idx)}
                        disabled={idx === 0}
                        className="p-1 disabled:opacity-30"
                        style={{ color: '#9A94A8' }}
                        title="Mover para cima"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveDown(sport, idx)}
                        disabled={idx === sports.length - 1}
                        className="p-1 disabled:opacity-30"
                        style={{ color: '#9A94A8' }}
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
                      <span className="font-medium" style={{ color: '#F0EAE0' }}>{sport.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold" style={{ color: '#60A5FA' }}>
                      {sport._count?.leagues || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                        sport.isActive
                          ? ''
                          : ''
                      }`}
                      style={sport.isActive ? { background: 'rgba(16, 185, 129, 0.2)', color: '#10B981' } : { background: 'rgba(156, 163, 175, 0.15)', color: '#9CA3AF' }}
                    >
                      {sport.isActive ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => startEdit(sport)}
                        className="px-3 py-1 text-xs font-semibold rounded-lg transition-colors"
                        style={{ background: 'rgba(96, 165, 250, 0.15)', color: '#60A5FA' }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggle(sport)}
                        disabled={actionLoading === sport.id}
                        className="px-3 py-1 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                        style={sport.isActive ? { background: 'rgba(234, 179, 8, 0.15)', color: '#FBBF24' } : { background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}
                      >
                        {sport.isActive ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => handleDelete(sport)}
                        disabled={actionLoading === sport.id}
                        className="px-3 py-1 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                        style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#F87171' }}
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
