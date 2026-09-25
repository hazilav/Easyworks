'use client';

import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, ShieldCheck, User, Clock, Terminal } from 'lucide-react';
import { ActivityLog } from '@/types';
import { safeFetchJson } from '@/lib/api/client';

export default function DeveloperAuditView() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ew_developer_token') || '';
      const { data } = await safeFetchJson<{ success?: boolean; stats?: { recentActivity?: ActivityLog[] } }>(
        '/api/developer/stats',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (data?.success && data?.stats) {
        setLogs(data.stats.recentActivity || []);
      }
    } catch (e) {
      console.error('Error loading audit stream:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19] text-zinc-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Audit Trail
              </span>
              <span className="text-xs text-zinc-400">• System Event Log</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">System Activity & Audit Stream</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Immutable ledger of administrative actions, customer registrations, payment verifications, and quota events.
            </p>
          </div>

          <button
            onClick={fetchLogs}
            className="h-9 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Stream</span>
          </button>
        </div>

        {/* Audit Stream Table */}
        <div className="bg-[#121724] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#0e131f] text-zinc-400 text-[11px] uppercase font-bold tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-zinc-500">
                    Loading audit records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-zinc-500">
                    No activity logs recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#161d2d] transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-zinc-200">
                      {log.details}
                      {log.userId && (
                        <div className="text-[10px] text-zinc-500 mt-0.5">User ID: {log.userId}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase font-mono ${
                          log.actor === 'SUPER_ADMIN'
                            ? 'bg-purple-500/20 text-purple-400'
                            : log.actor === 'USER'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {log.actor}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-zinc-400">
                      <div>{new Date(log.createdAt).toLocaleDateString()}</div>
                      <div className="text-[10px] text-zinc-500">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </div>
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
