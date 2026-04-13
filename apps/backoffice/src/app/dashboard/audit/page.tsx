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

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  LOGIN: { bg: 'rgba(96, 165, 250, 0.2)', text: '#60a5fa' },
  BLOCK_USER: { bg: 'rgba(248, 113, 113, 0.2)', text: '#f87171' },
  UNBLOCK_USER: { bg: 'rgba(74, 222, 128, 0.2)', text: '#4ade80' },
  ADJUST_POINTS: { bg: 'rgba(251, 146, 60, 0.2)', text: '#fb923c' },
  UPDATE_CONFIG: { bg: 'rgba(168, 85, 247, 0.2)', text: '#a855f7' },
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
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#F0EAE0' }}>Audit Log</h1>

      <div className="rounded-xl overflow-hidden" style={{ background: '#1E1E38', border: '1px solid #2A2A45' }}>
        <table className="w-full text-sm">
          <thead style={{ background: '#14142B', borderBottom: '1px solid #2A2A45' }}>
            <tr>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Data/Hora</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Admin</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Acao</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Entidade</th>
              <th className="text-center px-4 py-3 font-semibold" style={{ color: '#9A94A8' }}>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8" style={{ color: '#9A94A8' }}>Carregando...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8" style={{ color: '#9A94A8' }}>Nenhum registro encontrado</td>
              </tr>
            ) : (
              logs.map((log) => (
                <>
                  <tr key={log.id} className="transition-colors" style={{ borderBottom: '1px solid #2A2A45' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#9A94A8' }}>{formatDate(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium" style={{ color: '#F0EAE0' }}>{log.adminUser?.name || '-'}</p>
                      <p className="text-xs" style={{ color: '#9A94A8' }}>{log.adminUser?.email || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full" style={{
                        background: ACTION_COLORS[log.action]?.bg || 'rgba(128, 128, 128, 0.2)',
                        color: ACTION_COLORS[log.action]?.text || '#9A94A8'
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm" style={{ color: '#F0EAE0' }}>{log.entity}</p>
                      <p className="text-xs font-mono" style={{ color: '#9A94A8' }}>{log.entityId?.slice(0, 8)}...</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {log.details ? (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="text-xs font-semibold"
                          style={{ color: '#C4956A' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#D4A578')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#C4956A')}
                        >
                          {expandedId === log.id ? 'Fechar' : 'Ver'}
                        </button>
                      ) : (
                        <span className="text-xs" style={{ color: '#4A4A60' }}>-</span>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && log.details && (
                    <tr key={`${log.id}-detail`} style={{ background: '#14142B' }}>
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="text-xs rounded-lg p-3 overflow-x-auto" style={{ background: '#0d0d1f', color: '#9A94A8', border: '1px solid #2A2A45' }}>
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
          <p className="text-sm" style={{ color: '#9A94A8' }}>{total} registros</p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 text-sm rounded-lg disabled:opacity-40 transition-colors"
              style={{ background: '#1E1E38', border: '1px solid #2A2A45', color: '#F0EAE0' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#1E1E38')}
            >
              Anterior
            </button>
            <span className="px-3 py-1.5 text-sm" style={{ color: '#9A94A8' }}>
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 text-sm rounded-lg disabled:opacity-40 transition-colors"
              style={{ background: '#1E1E38', border: '1px solid #2A2A45', color: '#F0EAE0' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#1E1E38')}
            >
              Proximo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
