'use client';

import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, ShieldCheck, User, Clock, Terminal, Search, AlertTriangle, CheckCircle, Server } from 'lucide-react';
import { ActivityLog } from '@/types';
import { safeFetchJson } from '@/lib/api/client';

export default function DeveloperAuditView() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ERRORS' | 'ADMIN' | 'USER'>('ALL');
  const [systemHealth, setSystemHealth] = useState<{
    environment?: string;
    commit?: string;
    database?: string;
    serverUptime?: number;
  } | null>(null);

  const fetchHealth = async () => {
    try {
      const { data } = await safeFetchJson<any>('/api/developer/system-health');
      if (data?.success) {
        setSystemHealth(data);
      }
    } catch {}
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      fetchHealth();
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

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      log.action.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      (log.userId && log.userId.toLowerCase().includes(q)) ||
      log.actor.toLowerCase().includes(q);

    if (!matchesQuery) return false;

    if (filterType === 'ERRORS') {
      return log.action.includes('ERROR') || log.details.includes('EW-');
    }
    if (filterType === 'ADMIN') {
      return log.actor === 'SUPER_ADMIN' || log.actor === 'DEVELOPER';
    }
    if (filterType === 'USER') {
      return log.actor === 'USER';
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19] text-zinc-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Audit Trail & Telemetry
              </span>
              <span className="text-xs text-zinc-400">• System Event Log</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">System Activity & Server Diagnostics</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Trace server errors by Request ID (EW-XXXXXX), administrative actions, quota events, and payments.
            </p>
          </div>

          <button
            onClick={fetchLogs}
            className="h-9 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>

        {/* Live System Diagnostics Banner */}
        {systemHealth && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#121724] border border-zinc-800/80 rounded-xl p-4 text-xs">
            <div className="flex items-center gap-2.5">
              <Server className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Environment</div>
                <div className="font-mono text-zinc-200 font-medium">{systemHealth.environment || 'production'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Terminal className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Git Commit</div>
                <div className="font-mono text-zinc-200 font-medium">{systemHealth.commit || '9de9e7a'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Database</div>
                <div className="font-mono text-emerald-400 font-medium">SQLite ({systemHealth.database || 'connected'})</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Server Uptime</div>
                <div className="font-mono text-zinc-200 font-medium">{systemHealth.serverUptime ? `${Math.floor(systemHealth.serverUptime)}s` : 'Active'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Request ID (e.g. EW-7A9F2B), route, or user..."
              className="w-full pl-9 pr-4 py-2 bg-[#121724] border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['ALL', 'ERRORS', 'ADMIN', 'USER'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  filterType === type
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-[#121724] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 border border-zinc-800/60'
                }`}
              >
                {type === 'ALL' ? 'All Events' : type === 'ERRORS' ? 'Errors (EW-*)' : type === 'ADMIN' ? 'Admin' : 'Users'}
              </button>
            ))}
          </div>
        </div>

        {/* Audit Stream Table */}
        <div className="bg-[#121724] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#0e131f] text-zinc-400 text-[11px] uppercase font-bold tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Details / Request ID</th>
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
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-zinc-500">
                    {searchQuery ? 'No activity logs matching your search.' : 'No activity logs recorded yet.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isError = log.action.includes('ERROR');
                  const isEWRequest = log.details.includes('EW-');
                  return (
                    <tr key={log.id} className={`hover:bg-[#161d2d] transition-colors ${isError ? 'bg-red-500/5' : ''}`}>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded border text-[11px] inline-flex items-center gap-1 ${
                            isError
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}
                        >
                          {isError && <AlertTriangle className="w-3 h-3 text-red-400" />}
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-zinc-200">
                        <div className="leading-relaxed">
                          {log.details}
                        </div>
                        {log.userId && (
                          <div className="text-[10px] text-zinc-500 mt-0.5">User ID: {log.userId}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase font-mono ${
                            isError
                              ? 'bg-red-500/20 text-red-400'
                              : log.actor === 'SUPER_ADMIN'
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
