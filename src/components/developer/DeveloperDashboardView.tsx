'use client';

import React from 'react';
import {
  Users,
  CreditCard,
  Layers,
  Clock,
  CheckCircle2,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { DeveloperStats } from '@/types';

interface DeveloperDashboardViewProps {
  stats: DeveloperStats | null;
  loading: boolean;
  onNavigate: (tab: any) => void;
  onApprovePayment: (requestId: string) => void;
  onRejectPayment: (requestId: string) => void;
}

export default function DeveloperDashboardView({
  stats,
  loading,
  onNavigate,
  onApprovePayment,
  onRejectPayment,
}: DeveloperDashboardViewProps) {
  if (loading || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-[#0b0f19]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-zinc-400 font-medium">Aggregating live platform metrics...</span>
        </div>
      </div>
    );
  }

  const metricCards = [
    {
      title: 'Total Customers',
      value: stats.totalCustomers,
      subtitle: `${stats.newCustomers} joined this week`,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      tab: 'customers',
    },
    {
      title: 'Active Subscriptions',
      value: stats.activeSubscriptions,
      subtitle: 'Paid Pro Accounts',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      tab: 'customers',
    },
    {
      title: 'Trial Customers',
      value: stats.trialCustomers,
      subtitle: '7-day evaluation period',
      icon: Clock,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10 border-sky-500/20',
      tab: 'customers',
    },
    {
      title: 'Expired Customers',
      value: stats.expiredCustomers,
      subtitle: 'Trial or Plan ended',
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      tab: 'customers',
    },
    {
      title: 'Payment Pending',
      value: stats.paymentPending,
      subtitle: 'Awaiting your verification',
      icon: CreditCard,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
      tab: 'payments',
    },
    {
      title: 'Payment Verified',
      value: stats.paymentVerified,
      subtitle: 'Manually approved',
      icon: CheckCircle2,
      color: 'text-teal-400',
      bg: 'bg-teal-500/10 border-teal-500/20',
      tab: 'payments',
    },
    {
      title: 'Total Revenue',
      value: `₹${stats.totalRevenueINR.toLocaleString('en-IN')}`,
      subtitle: 'All-time verified payments',
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      tab: 'payments',
    },
    {
      title: 'PDFs Generated',
      value: stats.pdfsGenerated,
      subtitle: 'Tracked downloads (Max 2 on Trial)',
      icon: FileText,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      tab: 'customers',
    },
    {
      title: 'Active Today',
      value: stats.activeToday,
      subtitle: 'Users with session/activity',
      icon: Activity,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
      tab: 'audit',
    },
    {
      title: 'New Customers',
      value: stats.newCustomers,
      subtitle: 'Last 7 days signups',
      icon: ArrowUpRight,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      tab: 'customers',
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19] text-zinc-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Easyworks SaaS
              </span>
              <span className="text-xs text-zinc-400">• Developer & Super Admin</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">System Command Center</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Live telemetry, customer lifecycle, subscription statuses, and manual payment verification.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNavigate('payments')}
              className="h-9 px-3.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-amber-500/20"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Pending Payments ({stats.paymentPending})</span>
            </button>
            <button
              onClick={() => onNavigate('customers')}
              className="h-9 px-3.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-blue-600/20"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Manage Customers</span>
            </button>
          </div>
        </div>

        {/* 10 Key Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {metricCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                onClick={() => onNavigate(card.tab)}
                className={`p-4 rounded-2xl border transition-all hover:scale-102 hover:shadow-lg cursor-pointer ${card.bg}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium text-zinc-400 truncate">{card.title}</span>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <div className="text-xl font-bold text-white tracking-tight">{card.value}</div>
                <div className="text-[10px] text-zinc-400 mt-1 truncate">{card.subtitle}</div>
              </div>
            );
          })}
        </div>

        {/* Two Columns: Recent Payments & Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recent Manual Payment Requests (8 Cols) */}
          <div className="lg:col-span-7 bg-[#121724] border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white">Manual Payment Queue</h2>
              </div>
              <button
                onClick={() => onNavigate('payments')}
                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>View All ({stats.recentPayments.length})</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {stats.recentPayments.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                No manual payment requests received yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {stats.recentPayments.slice(0, 5).map((pay) => (
                  <div
                    key={pay.id}
                    className="p-3 bg-[#0e131f] border border-zinc-800/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {pay.userName || pay.userEmail}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-blue-500/20 text-blue-400">
                          {pay.planName}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            pay.status === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : pay.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {pay.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-3">
                        <span>
                          Amount: <strong className="text-white">₹{pay.amountINR}</strong>
                        </span>
                        <span>•</span>
                        <span className="font-mono">UTR: {pay.utrNumber}</span>
                        <span>•</span>
                        <span>{new Date(pay.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {pay.status === 'PENDING' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onApprovePayment(pay.id)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => onRejectPayment(pay.id)}
                          className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-rose-400 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Log (5 Cols) */}
          <div className="lg:col-span-5 bg-[#121724] border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-bold text-white">System Audit Stream</h2>
              </div>
              <button
                onClick={() => onNavigate('audit')}
                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>Full Audit</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {stats.recentActivity.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                No recent activity logged.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {stats.recentActivity.slice(0, 8).map((act) => (
                  <div
                    key={act.id}
                    className="p-2.5 bg-[#0e131f] border border-zinc-800/60 rounded-xl flex items-start gap-2.5"
                  >
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-zinc-200 truncate">
                          {act.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-zinc-500 shrink-0 font-mono">
                          {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{act.details}</p>
                      <div className="text-[9px] text-zinc-500 mt-1 uppercase font-mono">
                        Actor: {act.actor}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
