'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface SystemConfig {
  id: string;
  key: string;
  value: string;
  description: string;
  updatedAt: string;
}

export default function SettingsPage() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const { data } = await api.get('/admin/configs');
      setConfigs(data.data || data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (config: SystemConfig) => {
    setEditingKey(config.key);
    setEditValue(config.value);
  };

  const saveEdit = async (key: string) => {
    setSaving(true);
    try {
      await api.put(`/admin/configs/${key}`, { value: editValue });
      setEditingKey(null);
      loadConfigs();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const addConfig = async () => {
    if (!newKey || !newValue) return;
    setSaving(true);
    try {
      await api.put(`/admin/configs/${newKey}`, {
        value: newValue,
        description: newDesc,
      });
      setNewKey('');
      setNewValue('');
      setNewDesc('');
      setShowAdd(false);
      loadConfigs();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: '#9A94A8' }}>Carregando configuracoes...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#F0EAE0' }}>Configuracoes do Sistema</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors"
          style={{ background: '#C4956A' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#D4A578')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#C4956A')}
        >
          {showAdd ? 'Cancelar' : '+ Nova Config'}
        </button>
      </div>

      {/* Add New Config */}
      {showAdd && (
        <div className="rounded-xl p-6 mb-6" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#F0EAE0' }}>Nova Configuracao</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Chave (ex: max_daily_bets)"
              style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
              className="h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-gray-500"
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Valor"
              style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
              className="h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-gray-500"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Descricao (opcional)"
              style={{ background: '#14142B', border: '1px solid #2A2A45', color: '#F0EAE0' }}
              className="h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-gray-500"
            />
          </div>
          <button
            onClick={addConfig}
            disabled={saving || !newKey || !newValue}
            className="mt-3 px-6 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
            style={{ background: saving || !newKey || !newValue ? '#888' : '#4ade80' }}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = '#22c55e')}
            onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = '#4ade80')}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      )}

      {/* Config List */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
        <table className="w-full text-sm">
          <thead style={{ background: '#14142B', borderBottom: '1px solid #2A2A45' }}>
            <tr>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Chave</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Valor</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Descricao</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Atualizado</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {configs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8" style={{ color: '#9A94A8' }}>Nenhuma configuracao encontrada</td>
              </tr>
            ) : (
              configs.map((config) => (
                <tr key={config.key} style={{ borderBottom: '1px solid #2A2A45' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-4 py-3 font-mono text-sm" style={{ color: '#F0EAE0' }}>{config.key}</td>
                  <td className="px-4 py-3">
                    {editingKey === config.key ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        style={{ background: '#14142B', border: '1px solid #C4956A', color: '#F0EAE0' }}
                        className="w-full h-8 rounded px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                        autoFocus
                      />
                    ) : (
                      <span style={{ color: '#F0EAE0' }}>{config.value}</span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#9A94A8' }}>{config.description || '-'}</td>
                  <td className="px-4 py-3 text-center text-xs" style={{ color: '#9A94A8' }}>{formatDate(config.updatedAt)}</td>
                  <td className="px-4 py-3 text-center">
                    {editingKey === config.key ? (
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => saveEdit(config.key)}
                          disabled={saving}
                          className="text-xs font-semibold"
                          style={{ color: saving ? '#999' : '#4ade80' }}
                        >
                          {saving ? '...' : 'Salvar'}
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          className="text-xs font-semibold"
                          style={{ color: '#9A94A8' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#F0EAE0')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#9A94A8')}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(config)}
                        className="text-xs font-semibold"
                        style={{ color: '#C4956A' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#D4A578')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#C4956A')}
                      >
                        Editar
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
  );
}
