'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { safeFetchJson } from '@/lib/api/client';
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Clock,
  Check,
  Terminal,
} from 'lucide-react';

interface DeveloperErrorsViewProps {
  token: string;
}

export function DeveloperErrorsView({ token }: DeveloperErrorsViewProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [category, setCategory] = useState<string>('ALL');
  const [severity, setSeverity] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        token,
        limit: '100',
      });
      if (category !== 'ALL') params.set('category', category);
      if (severity !== 'ALL') params.set('severity', severity);
      if (status !== 'ALL') params.set('status', status);
      if (search.trim()) params.set('search', search.trim());

      const res = await safeFetchJson(`/api/developer/errors?${params.toString()}`);
      if (res.ok && res.data) {
        setLogs(res.data.logs || []);
        setStats(res.data.stats || null);
      }
    } catch (e) {
      console.error('Failed to load error logs:', e);
    } finally {
      setLoading(false);
    }
  }, [token, category, severity, status, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleAction = async (id: string, action: 'RESOLVE' | 'ACKNOWLEDGE') => {
    setActionLoadingId(id);
    try {
      const res = await safeFetchJson('/api/developer/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, token, adminName: 'Super Admin' }),
      });
      if (res.ok) {
        // Refresh logs list
        await fetchLogs();
      }
    } catch (e) {
      console.error('Failed to update error log:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30';
      case 'HIGH':
        return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'LOW':
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusBadgeClass = (st: string) => {
    switch (st) {
      case 'RESOLVED':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'RECOVERED':
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
      default:
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border">
          <span className="text-xs font-medium text-muted-foreground uppercase">Unresolved Errors</span>
          <p className="text-2xl font-bold text-foreground mt-1">{stats?.totalUnresolved ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <span className="text-xs font-medium text-muted-foreground uppercase">Critical Alerts</span>
          <p className="text-2xl font-bold text-destructive mt-1">{stats?.criticalCount ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <span className="text-xs font-medium text-muted-foreground uppercase">High Severity</span>
          <p className="text-2xl font-bold text-amber-500 mt-1">{stats?.highCount ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <span className="text-xs font-medium text-muted-foreground uppercase">Past 24 Hours</span>
          <p className="text-2xl font-bold text-primary mt-1">{stats?.last24hCount ?? 0}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by Request ID, route, or message text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-background border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-background border border-border/80 text-xs font-medium focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="API">API</option>
            <option value="DATABASE">Database</option>
            <option value="AUTH">Auth / OTP</option>
            <option value="PAYMENT">Payment</option>
            <option value="EMAIL">Email</option>
            <option value="PDF">PDF</option>
            <option value="REALTIME">Realtime</option>
            <option value="FRONTEND">Frontend</option>
            <option value="RUNTIME">Runtime</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="px-3 py-2 rounded-xl bg-background border border-border/80 text-xs font-medium focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-background border border-border/80 text-xs font-medium focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="RECOVERED">Recovered</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          <button
            onClick={() => fetchLogs()}
            className="p-2 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Logs List */}
      <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm flex flex-col items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin mb-2 text-primary" />
            Loading error telemetry logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm flex flex-col items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
            No error logs match the selected filters. System running cleanly!
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {logs.map((log) => {
              const isExpanded = expandedId === log.id;
              const isActionLoading = actionLoadingId === log.id;

              return (
                <div key={log.id} className="p-4 hover:bg-muted/30 transition">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Left: Request ID, Category, Severity & Route */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="font-mono text-xs font-bold text-foreground bg-secondary px-2 py-0.5 rounded border border-border/40">
                          {log.requestId}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getSeverityBadgeClass(
                            log.severity
                          )}`}
                        >
                          {log.severity}
                        </span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary/80 text-muted-foreground border border-border/40">
                          {log.category}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(
                            log.recoveryStatus
                          )}`}
                        >
                          {log.recoveryStatus}
                        </span>
                        {log.occurrenceCount > 1 && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                            Repeated {log.occurrenceCount}x
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto md:ml-0">
                          <Clock className="w-3 h-3" />
                          {new Date(log.lastSeenAt).toLocaleTimeString()} (
                          {new Date(log.lastSeenAt).toLocaleDateString()})
                        </span>
                      </div>

                      {/* Route and Message */}
                      <div className="flex items-start gap-2">
                        {log.route && (
                          <span className="text-xs font-mono font-medium text-primary shrink-0">
                            [{log.route}]
                          </span>
                        )}
                        <p className="text-sm font-medium text-foreground truncate">{log.message}</p>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {log.recoveryStatus !== 'RESOLVED' && (
                        <button
                          onClick={() => handleAction(log.id, 'RESOLVE')}
                          disabled={isActionLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition border border-emerald-500/20 cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Resolve
                        </button>
                      )}
                      {log.recoveryStatus === 'PENDING' && (
                        <button
                          onClick={() => handleAction(log.id, 'ACKNOWLEDGE')}
                          disabled={isActionLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold transition border border-blue-500/20 cursor-pointer disabled:opacity-50"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition cursor-pointer"
                        title="Toggle details"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Diagnostics & Stack Trace */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border/40 space-y-2 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                        <div>
                          <strong>First Seen:</strong> {new Date(log.firstSeenAt).toLocaleString()}
                        </div>
                        <div>
                          <strong>Last Seen:</strong> {new Date(log.lastSeenAt).toLocaleString()}
                        </div>
                        {log.userId && (
                          <div>
                            <strong>User ID:</strong> <span className="font-mono">{log.userId}</span>
                          </div>
                        )}
                        {log.resolvedBy && (
                          <div>
                            <strong>Resolved By:</strong> {log.resolvedBy} (
                            {log.resolvedAt ? new Date(log.resolvedAt).toLocaleString() : ''})
                          </div>
                        )}
                      </div>

                      {log.stackTrace && (
                        <div className="mt-2">
                          <span className="font-semibold text-muted-foreground block mb-1">
                            Sanitized Stack Trace:
                          </span>
                          <pre className="p-3 rounded-xl bg-muted/80 text-foreground font-mono text-[11px] overflow-x-auto whitespace-pre-wrap border border-border/60">
                            {log.stackTrace}
                          </pre>
                        </div>
                      )}

                      {log.metadata && (
                        <div className="mt-2">
                          <span className="font-semibold text-muted-foreground block mb-1">Metadata:</span>
                          <pre className="p-2 rounded-lg bg-muted/50 text-foreground font-mono text-[11px] overflow-x-auto border border-border/40">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
