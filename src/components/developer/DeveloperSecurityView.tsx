'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Lock,
  Smartphone,
  Mail,
  Building2,
  Globe,
  Radio,
} from 'lucide-react';
import { TrialIdentity } from '@/types';
import { safeFetchJson } from '@/lib/api/client';

export default function DeveloperSecurityView() {
  const [trials, setTrials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'SUSPICIOUS' | 'REVIEW' | 'ELIGIBLE' | 'NOT_ELIGIBLE'>('ALL');
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const fetchTrials = async () => {
    try {
      setLoading(true);
      const { data } = await safeFetchJson<{ trials?: any[] }>('/api/admin/trials');
      if (data?.trials) {
        setTrials(data.trials);
      }
    } catch (e) {
      console.error('Error fetching trial security logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrials();
  }, []);

  const handleApproveTrial = async (userId: string) => {
    if (!confirm('Override and mark this trial as ELIGIBLE?')) return;
    setProcessingUserId(userId);
    try {
      const { ok, data, error } = await safeFetchJson<{ success?: boolean; error?: string }>(
        '/api/admin/trials',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve', userId, notes: 'Manually verified by Super Admin' }),
        }
      );
      if (ok && data?.success) {
        fetchTrials();
      } else {
        alert(data?.error || error || 'Failed to approve trial');
      }
    } catch (e: any) {
      alert(e.message || 'Error updating trial');
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleRejectTrial = async (userId: string) => {
    const reason = prompt('Enter reason for trial rejection:', 'Duplicate trial abuse / multi-account detected');
    if (!reason) return;
    setProcessingUserId(userId);
    try {
      const { ok, data, error } = await safeFetchJson<{ success?: boolean; error?: string }>(
        '/api/admin/trials',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reject', userId, reason }),
        }
      );
      if (ok && data?.success) {
        fetchTrials();
      } else {
        alert(data?.error || error || 'Failed to reject trial');
      }
    } catch (e: any) {
      alert(e.message || 'Error rejecting trial');
    } finally {
      setProcessingUserId(null);
    }
  };

  const filteredTrials = trials.filter((t) => {
    if (filter === 'ALL') return true;
    if (filter === 'SUSPICIOUS') return (t.abuse_risk_score || 0) >= 30;
    if (filter === 'REVIEW') return t.eligibility_status === 'REVIEW_REQUIRED';
    if (filter === 'ELIGIBLE') return t.eligibility_status === 'ELIGIBLE';
    if (filter === 'NOT_ELIGIBLE') return t.eligibility_status === 'NOT_ELIGIBLE';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19] text-zinc-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Security & Anti-Abuse
              </span>
              <span className="text-xs text-zinc-400">• Multi-Signal Trial Protection</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Trial Abuse Monitor</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Multi-signal risk telemetry: disposable emails, normalized identities, device sessions, and admin overrides.
            </p>
          </div>

          <button
            onClick={fetchTrials}
            className="h-9 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 text-xs">
          {[
            { id: 'ALL', label: `All Trials (${trials.length})` },
            { id: 'SUSPICIOUS', label: 'High Risk (Score ≥ 30)' },
            { id: 'REVIEW', label: 'Review Required' },
            { id: 'ELIGIBLE', label: 'Verified & Eligible' },
            { id: 'NOT_ELIGIBLE', label: 'Blocked / Abusive' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer ${
                filter === f.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#121724] text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Trials Table */}
        <div className="bg-[#121724] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#0e131f] text-zinc-400 text-[11px] uppercase font-bold tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">User / Email</th>
                <th className="py-3 px-4">Signals & Verification</th>
                <th className="py-3 px-4">Trial PDF Limit</th>
                <th className="py-3 px-4">Abuse Risk Score</th>
                <th className="py-3 px-4">Eligibility Status</th>
                <th className="py-3 px-4 text-right">Admin Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    Loading trial identity telemetry...
                  </td>
                </tr>
              ) : filteredTrials.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No records found matching this security filter.
                  </td>
                </tr>
              ) : (
                filteredTrials.map((t) => (
                  <tr key={t.id} className="hover:bg-[#161d2d] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{t.user_name || t.email}</div>
                      <div className="text-[11px] text-zinc-400 font-mono">{t.email}</div>
                      {t.business_name && (
                        <div className="text-[10px] text-zinc-500 mt-0.5">Biz: {t.business_name}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            t.email_verified
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          Email {t.email_verified ? 'Verified' : 'Pending'}
                        </span>
                        {t.phone && (
                          <span className="text-[10px] text-zinc-400 font-mono">{t.phone}</span>
                        )}
                      </div>
                      {t.device_id && (
                        <div className="text-[9px] text-zinc-500 font-mono truncate max-w-[160px]">
                          Dev: {t.device_id.slice(0, 16)}...
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-mono">
                        <strong className="text-white">{t.trial_pdf_downloads ?? 0}</strong>
                        <span className="text-zinc-500">/ 2 downloads</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${
                            (t.abuse_risk_score || 0) >= 40
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : (t.abuse_risk_score || 0) >= 20
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {t.abuse_risk_score || 0} / 100
                        </span>
                      </div>
                      {t.flag_reason && (
                        <p className="text-[10px] text-zinc-400 mt-1 line-clamp-1">{t.flag_reason}</p>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          t.eligibility_status === 'ELIGIBLE'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : t.eligibility_status === 'REQUIRES_VERIFICATION'
                            ? 'bg-blue-500/20 text-blue-400'
                            : t.eligibility_status === 'REVIEW_REQUIRED'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {t.eligibility_status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleApproveTrial(t.user_id)}
                          disabled={processingUserId === t.user_id}
                          className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectTrial(t.user_id)}
                          disabled={processingUserId === t.user_id}
                          className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Block
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
    </div>
  );
}
