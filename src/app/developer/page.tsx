'use client';

import React, { useState, useEffect } from 'react';
import DeveloperLoginView from '@/components/developer/DeveloperLoginView';
import DeveloperSidebar, { DeveloperTab } from '@/components/developer/DeveloperSidebar';
import DeveloperDashboardView from '@/components/developer/DeveloperDashboardView';
import DeveloperCustomersView from '@/components/developer/DeveloperCustomersView';
import DeveloperPlansView from '@/components/developer/DeveloperPlansView';
import DeveloperPaymentsView from '@/components/developer/DeveloperPaymentsView';
import DeveloperSecurityView from '@/components/developer/DeveloperSecurityView';
import DeveloperAuditView from '@/components/developer/DeveloperAuditView';
import { DeveloperStats, SubscriptionPlan } from '@/types';
import { Menu } from 'lucide-react';

export default function DeveloperPage() {
  const [developerUser, setDeveloperUser] = useState<any | null>(null);
  const [currentTab, setCurrentTab] = useState<DeveloperTab>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [stats, setStats] = useState<DeveloperStats | null>(null);
  const [plans, setPlans] = useState<(SubscriptionPlan & { activeSubscribers?: number })[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  // Check existing session
  useEffect(() => {
    const token = localStorage.getItem('ew_developer_token');
    const savedUser = localStorage.getItem('ew_developer_user');

    if (token && savedUser) {
      try {
        setDeveloperUser(JSON.parse(savedUser));
        verifySession(token);
      } catch {
        handleLogout();
      }
    } else {
      setAuthChecking(false);
    }
  }, []);

  const verifySession = async (token: string) => {
    try {
      const res = await fetch('/api/developer/auth', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.authenticated && data.user) {
        setDeveloperUser(data.user);
        loadStats(token);
        loadPlans(token);
      } else {
        handleLogout();
      }
    } catch {
      handleLogout();
    } finally {
      setAuthChecking(false);
    }
  };

  const loadStats = async (token = localStorage.getItem('ew_developer_token')) => {
    if (!token) return;
    try {
      setLoadingStats(true);
      const res = await fetch('/api/developer/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats);
      }
    } catch (e) {
      console.error('Error loading developer stats:', e);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadPlans = async (token = localStorage.getItem('ew_developer_token')) => {
    try {
      const res = await fetch('/api/developer/plans', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success && data.plans) {
        setPlans(data.plans);
      }
    } catch (e) {
      console.error('Error loading plans:', e);
    }
  };

  const handleLoginSuccess = (user: any, token: string) => {
    setDeveloperUser(user);
    loadStats(token);
    loadPlans(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('ew_developer_token');
    localStorage.removeItem('ew_developer_user');
    setDeveloperUser(null);
    setStats(null);
  };

  const handleQuickApprovePayment = async (requestId: string) => {
    if (!confirm('Approve payment and activate subscription?')) return;
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'APPROVE', adminName: 'Super Admin' }),
      });
      const data = await res.json();
      if (data.success) {
        loadStats();
      } else {
        alert(data.error || 'Failed to approve payment');
      }
    } catch (e: any) {
      alert(e.message || 'Error approving payment');
    }
  };

  const handleQuickRejectPayment = async (requestId: string) => {
    const reason = prompt('Reason for rejection:', 'Transaction reference could not be verified on bank records');
    if (!reason) return;
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'REJECT', reason, adminName: 'Super Admin' }),
      });
      const data = await res.json();
      if (data.success) {
        loadStats();
      } else {
        alert(data.error || 'Failed to reject payment');
      }
    } catch (e: any) {
      alert(e.message || 'Error rejecting payment');
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen w-full bg-[#0b0f19] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-zinc-400">Verifying Super Admin clearance...</span>
        </div>
      </div>
    );
  }

  // Not authenticated as Super Admin
  if (!developerUser) {
    return <DeveloperLoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0f19] text-zinc-100 font-sans flex-col md:flex-row">
      {/* Mobile Top Header (only visible < md) */}
      <header className="md:hidden flex items-center justify-between px-3.5 py-2.5 bg-[#0e131f] text-white border-b border-zinc-800/80 shrink-0 z-30">
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-1.5 -ml-1 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              DEV
            </div>
            <span className="text-sm font-bold tracking-tight">Easyworks Admin</span>
            <span className="text-[9px] font-mono px-1 rounded bg-red-500/20 text-red-400 border border-red-500/30">
              SUPER
            </span>
          </div>
        </div>

        {stats?.paymentPending ? (
          <button
            onClick={() => setCurrentTab('payments')}
            className="text-[11px] px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>{stats.paymentPending} Pending</span>
          </button>
        ) : null}
      </header>

      {/* Developer Sidebar */}
      <DeveloperSidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        developerUser={developerUser}
        onLogout={handleLogout}
        pendingPaymentsCount={stats?.paymentPending || 0}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Developer Tab Main Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {currentTab === 'dashboard' && (
          <DeveloperDashboardView
            stats={stats}
            loading={loadingStats}
            onNavigate={setCurrentTab}
            onApprovePayment={handleQuickApprovePayment}
            onRejectPayment={handleQuickRejectPayment}
          />
        )}

        {currentTab === 'customers' && (
          <DeveloperCustomersView
            plans={plans}
            onRefreshStats={loadStats}
          />
        )}

        {currentTab === 'plans' && (
          <DeveloperPlansView
            plans={plans}
            onRefreshPlans={loadPlans}
          />
        )}

        {currentTab === 'payments' && (
          <DeveloperPaymentsView
            onRefreshStats={loadStats}
          />
        )}

        {currentTab === 'security' && (
          <DeveloperSecurityView />
        )}

        {currentTab === 'audit' && (
          <DeveloperAuditView />
        )}

        {currentTab === 'settings' && (
          <DeveloperPaymentsView
            onRefreshStats={loadStats}
          />
        )}
      </main>
    </div>
  );
}
