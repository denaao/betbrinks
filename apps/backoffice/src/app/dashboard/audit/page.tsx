'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details: any;
  adminUser?: { name: string; email: string };
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-700',
  BLOCK_USER: 'bg-red-100 text-red-700',
  UNBLOCK_USER: 'bg-green-100 text-green-700',
  ADJUST_POINTS: 'bg-amber-100 text-amber-700',
  UPDATE_CONFIG: 'bg-purple-100 text-purple-700',
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 20;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data: axiosData } = await api.get('/admin/audit-logs', { params: { page, limit } });
      // API: { success, data: { data: [...], total, totalPages } }
      const wrapped = axiosData.data || axiosData;
      const list = wrapped.data || wrapped.logs || wrapped.items || wrapped;
      setLogs(Array.isArray(list) ? list : []);
      setTotal(wrapped.total || 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const totalPages = Math.ceil(total / limit);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Log</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Data/Hora</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Admin</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Acao</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Entidade</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">Carregando...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">Nenhum registro encontrado</td>
              </tr>
            ) : (
              logs.map((log) => (
                <>
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{log.adminUser?.name || '-'}</p>
                      <p className="text-xs text-gray-400">{log.adminUser?.email || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700">{log.entity}</p>
                      <p className="text-xs text-gray-400 font-mono">{log.entityId?.slice(0, 8)}...</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {log.details ? (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="text-brand-700 hover:text-brand-900 text-xs font-semibold"
                        >
                          {expandedId === log.id ? 'Fechar' : 'Ver'}
                        </button>
                      ) : (
                        <span className="text-gray-300 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && log.details && (
                    <tr key={`${log.id}-detail`} className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="text-xs text-gray-600 bg-gray-100 rounded-lg p-3 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">{total} registros</p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Anterior
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Proximo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
