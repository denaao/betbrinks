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
        <p className="text-gray-400">Carregando configuracoes...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuracoes do Sistema</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-brand-700 text-white text-sm font-semibold rounded-lg hover:bg-brand-800 transition-colors"
        >
          {showAdd ? 'Cancelar' : '+ Nova Config'}
        </button>
      </div>

      {/* Add New Config */}
      {showAdd && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Nova Configuracao</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Chave (ex: max_daily_bets)"
              className="h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Valor"
              className="h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Descricao (opcional)"
              className="h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            onClick={addConfig}
            disabled={saving || !newKey || !newValue}
            className="mt-3 px-6 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      )}

      {/* Config List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Chave</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Valor</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Descricao</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Atualizado</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {configs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">Nenhuma configuracao encontrada</td>
              </tr>
            ) : (
              configs.map((config) => (
                <tr key={config.key} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm text-gray-900">{config.key}</td>
                  <td className="px-4 py-3">
                    {editingKey === config.key ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full h-8 border border-brand-300 rounded px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        autoFocus
                      />
                    ) : (
                      <span className="text-gray-700">{config.value}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{config.description || '-'}</td>
                  <td className="px-4 py-3 text-center text-gray-400 text-xs">{formatDate(config.updatedAt)}</td>
                  <td className="px-4 py-3 text-center">
                    {editingKey === config.key ? (
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => saveEdit(config.key)}
                          disabled={saving}
                          className="text-green-600 hover:text-green-800 text-xs font-semibold"
                        >
                          {saving ? '...' : 'Salvar'}
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          className="text-gray-400 hover:text-gray-600 text-xs font-semibold"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(config)}
                        className="text-brand-700 hover:text-brand-900 text-xs font-semibold"
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
