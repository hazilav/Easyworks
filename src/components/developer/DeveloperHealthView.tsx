'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { safeFetchJson } from '@/lib/api/client';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Database,
  Radio,
  Mail,
  Cpu,
  Server,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface DeveloperHealthViewProps {
  token: string;
}

export function DeveloperHealthView({ token }: DeveloperHealthViewProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [healthData, setHealthData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await safeFetchJson(`/api/developer/system-health?token=${encodeURIComponent(token)}`);
      if (res.ok && res.data) {
        setHealthData(res.data);
      } else {
        setError(res.error || 'Failed to fetch system diagnostics');
      }
    } catch (e: any) {
      setError(e?.message || 'Error connecting to health service');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => fetchHealth(true), 15000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading && !healthData) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
        <RefreshCw className="w-8 h-8 animate-spin mb-4 text-primary" />
        <p className="text-sm">Running system health & diagnostic checks...</p>
      </div>
    );
  }

  const status = healthData?.status || 'UNKNOWN';
  const isHealthy = status === 'HEALTHY';
  const isDegraded = status === 'DEGRADED';

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0s';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Refresh Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-xs ${
              isHealthy
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                : isDegraded
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}
          >
            {isHealthy ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : isDegraded ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <XCircle className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">System Health Diagnostics</h2>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  isHealthy
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : isDegraded
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-destructive/15 text-destructive border border-destructive/30'
                }`}
              >
                {status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live automated monitoring across database, real-time bus, email service, and server runtime.
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchHealth(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium transition cursor-pointer self-start sm:self-auto border border-border/50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Now'}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Database Status */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Database Engine</span>
            <Database className="w-4 h-4 text-primary" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">SQLite WAL</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {healthData?.database?.integrity === 'ok' ? 'Integrity OK' : 'Checking'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {healthData?.database?.databasePath || 'easyworks.db'}
          </p>
        </div>

        {/* Real-time Event Bus */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Real-Time Event Bus</span>
            <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">
              {healthData?.realtime?.totalConnections ?? 0} Active
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              SSE + Poll
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Admin: {healthData?.realtime?.adminConnections ?? 0} | Customer: {healthData?.realtime?.customerConnections ?? 0}
          </p>
        </div>

        {/* Email Service Health */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Email Provider</span>
            <Mail className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">
              {healthData?.email?.configured ? 'Configured' : 'Missing'}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                healthData?.email?.configured
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              }`}
            >
              {healthData?.email?.provider || 'SMTP'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {healthData?.email?.senderEmail || 'No sender address'}
          </p>
        </div>

        {/* Unresolved Errors */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Error Tracking</span>
            <Activity className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">
              {healthData?.errors?.totalUnresolved ?? 0} Open
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                (healthData?.errors?.criticalCount ?? 0) > 0
                  ? 'bg-destructive/15 text-destructive border border-destructive/20'
                  : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
              }`}
            >
              {healthData?.errors?.criticalCount ?? 0} Critical
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Past 24h: {healthData?.errors?.last24hCount ?? 0} events recorded
          </p>
        </div>
      </div>

      {/* Detailed Diagnostic Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Database Diagnostic Table */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Database Table Verification</h3>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              Size: {Math.round((healthData?.database?.databaseSizeBytes ?? 0) / 1024)} KB
            </span>
          </div>

          <div className="divide-y divide-border/50 text-sm">
            {healthData?.database?.tableCounts &&
              Object.entries(healthData.database.tableCounts).map(([table, count]) => (
                <div key={table} className="py-2.5 flex items-center justify-between">
                  <span className="font-mono text-xs text-foreground">{table}</span>
                  <span className="text-xs font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                    {String(count)} rows
                  </span>
                </div>
              ))}
          </div>

          <div className="pt-2 flex items-center gap-2 text-xs text-emerald-500">
            <ShieldCheck className="w-4 h-4" />
            <span>Exclusive transaction retry & WAL journal mode enabled</span>
          </div>
        </div>

        {/* Runtime & Memory Information */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Runtime & Host Environment</h3>
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Uptime: {formatUptime(healthData?.serverUptime)}
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground text-xs">Framework / Engine</span>
              <span className="font-medium text-xs text-foreground">{healthData?.build}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground text-xs">Node.js Runtime</span>
              <span className="font-mono text-xs text-foreground">{healthData?.nodeVersion}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground text-xs">Commit Revision</span>
              <span className="font-mono text-xs text-foreground">{healthData?.commit}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground text-xs">Memory RSS</span>
              <span className="font-mono text-xs text-foreground">{healthData?.memory?.rssMB} MB</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground text-xs">Heap Allocation</span>
              <span className="font-mono text-xs text-foreground">
                {healthData?.memory?.heapUsedMB} MB / {healthData?.memory?.heapTotalMB} MB
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Cpu className="w-4 h-4 text-primary" />
            <span>Active process monitored with supervisor auto-restart policy</span>
          </div>
        </div>
      </div>
    </div>
  );
}
