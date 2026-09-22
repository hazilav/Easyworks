'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import {
  SubscriptionPlan,
  CustomPlanRequest,
  PaymentSettings,
  ManualPaymentRequest,
} from '@/types';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  CreditCard,
  Settings2,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Search,
  Building,
  Mail,
  Phone,
  Calendar,
  Check,
  Smartphone,
  ExternalLink,
  Eye,
  CheckCheck,
  XCircle,
  QrCode,
  Upload,
} from 'lucide-react';

export default function AdminBillingView() {
  const { currentUser, setCurrentView } = useApp();

  const [activeTab, setActiveTab] = useState<
    'payments' | 'trials' | 'settings' | 'plans' | 'subscribers' | 'requests'
  >('payments');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [requests, setRequests] = useState<CustomPlanRequest[]>([]);
  const [manualPayments, setManualPayments] = useState<ManualPaymentRequest[]>([]);
  const [trialIdentities, setTrialIdentities] = useState<any[]>([]);
  const [trialFilter, setTrialFilter] = useState<'ALL' | 'REVIEW_REQUIRED' | 'ELIGIBLE' | 'NOT_ELIGIBLE'>('REVIEW_REQUIRED');
  const [isProcessingTrialId, setIsProcessingTrialId] = useState<string | null>(null);
  const [trialRejectModalUser, setTrialRejectModalUser] = useState<any | null>(null);
  const [trialRejectReason, setTrialRejectReason] = useState('');
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    id: 'default',
    upiId: '9539933265@naviaxis',
    qrCodeUrl: '',
    bankAccountName: 'Easyworks Solutions Private Limited',
    bankName: 'HDFC Bank',
    bankAccountNumber: '50200088991122',
    bankIfsc: 'HDFC0001234',
    bankBranch: 'Indiranagar Branch, Bengaluru',
    whatsappNumber: '919876543210',
    updatedAt: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Manual payment actions state
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [rejectModalReq, setRejectModalReq] = useState<ManualPaymentRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessingPaymentId, setIsProcessingPaymentId] = useState<string | null>(null);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  // Payment settings state
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Editing plan state
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Subscriber search / filter
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      // Fetch plans
      const plansRes = await fetch('/api/billing/plans?includeInactive=true');
      const plansData = await plansRes.json();
      if (plansData.plans) setPlans(plansData.plans);

      // Fetch admin data
      const adminRes = await fetch('/api/admin/billing');
      const adminData = await adminRes.json();
      if (adminData.subscribers) setSubscribers(adminData.subscribers);
      if (adminData.payments) setPayments(adminData.payments);
      if (adminData.customRequests) setRequests(adminData.customRequests);
      if (adminData.paymentSettings) setPaymentSettings(adminData.paymentSettings);
      if (adminData.manualPayments) setManualPayments(adminData.manualPayments);

      // Fetch trial identities and abuse risk records
      const trialsRes = await fetch('/api/admin/trials');
      const trialsData = await trialsRes.json();
      if (trialsData.trials) setTrialIdentities(trialsData.trials);
    } catch (err) {
      console.error('Failed to load admin billing data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveTrial = async (trial: any) => {
    if (!confirm(`Approve 7-day free trial for ${trial.user_name || trial.email}?`)) {
      return;
    }
    try {
      setIsProcessingTrialId(trial.user_id);
      const res = await fetch('/api/admin/trials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          userId: trial.user_id,
          notes: `Manually approved by ${currentUser?.name || 'Admin'}`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showMessage(`Trial approved! 7-day free trial activated for ${trial.user_name || trial.email}.`);
        fetchData();
      } else {
        alert(data.error || 'Failed to approve trial');
      }
    } catch (err: any) {
      alert(err.message || 'Error approving trial');
    } finally {
      setIsProcessingTrialId(null);
    }
  };

  const handleRejectTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trialRejectModalUser) return;
    try {
      setIsProcessingTrialId(trialRejectModalUser.user_id);
      const res = await fetch('/api/admin/trials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          userId: trialRejectModalUser.user_id,
          reason: trialRejectReason.trim() || 'Suspected trial abuse or duplicate phone/business.',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showMessage(`Trial rejected for ${trialRejectModalUser.user_name || trialRejectModalUser.email}.`);
        setTrialRejectModalUser(null);
        setTrialRejectReason('');
        fetchData();
      } else {
        alert(data.error || 'Failed to reject trial');
      }
    } catch (err: any) {
      alert(err.message || 'Error rejecting trial');
    } finally {
      setIsProcessingTrialId(null);
    }
  };

  const handleApprovePayment = async (req: ManualPaymentRequest) => {
    if (!confirm(`Approve payment of ₹${req.amountINR} for ${req.userName || 'user'} and activate ${req.planName}?`)) {
      return;
    }
    try {
      setIsProcessingPaymentId(req.id);
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: req.id,
          action: 'APPROVE',
          adminName: currentUser?.name || 'Admin',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showMessage(`Payment approved! ${req.planName} subscription activated for ${req.userName || 'user'}.`);
        fetchData();
      } else {
        alert(data.error || 'Failed to approve payment');
      }
    } catch (err: any) {
      alert(err.message || 'Error approving payment');
    } finally {
      setIsProcessingPaymentId(null);
    }
  };

  const handleRejectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalReq) return;
    try {
      setIsProcessingPaymentId(rejectModalReq.id);
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: rejectModalReq.id,
          action: 'REJECT',
          reason: rejectionReason.trim() || 'Payment details or UTR could not be verified.',
          adminName: currentUser?.name || 'Admin',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showMessage('Payment request rejected.');
        setRejectModalReq(null);
        setRejectionReason('');
        fetchData();
      } else {
        alert(data.error || 'Failed to reject payment');
      }
    } catch (err: any) {
      alert(err.message || 'Error rejecting payment');
    } finally {
      setIsProcessingPaymentId(null);
    }
  };

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingSettings(true);
      const res = await fetch('/api/billing/payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentSettings),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPaymentSettings(data.settings);
        showMessage('Business payment details saved successfully!');
      } else {
        alert(data.error || 'Failed to update payment settings');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving payment settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    try {
      setIsSavingPlan(true);
      const res = await fetch('/api/billing/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPlan),
      });
      const data = await res.json();
      if (res.ok && data.plan) {
        setPlans((prev) => prev.map((p) => (p.id === data.plan.id ? data.plan : p)));
        setEditingPlan(null);
        showMessage('Plan updated successfully!');
      } else {
        alert(data.error || 'Failed to update plan');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving plan');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleManualOverride = async (userId: string, action: 'grant' | 'revoke' | 'extend_trial', days: number = 30) => {
    try {
      const res = await fetch('/api/admin/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual_override',
          userId,
          overrideAction: action,
          days,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(`Access updated for user (${action.toUpperCase()})`);
        fetchData();
      } else {
        alert(data.error || 'Failed to update user access');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    }
  };

  const showMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };


  // Metrics
  const totalRevenue = payments.reduce((acc, p) => acc + (p.amountINR || 0), 0);
  const activeSubscribersCount = subscribers.filter((s) => s.status === 'ACTIVE').length;
  const trialingCount = subscribers.filter((s) => s.status === 'TRIALING').length;
  const expiredCount = subscribers.filter((s) => s.status === 'EXPIRED').length;

  const filteredSubscribers = subscribers.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      (s.userName && s.userName.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.businessName && s.businessName.toLowerCase().includes(q)) ||
      (s.status && s.status.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0c0e12] font-sans">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-[10px] uppercase tracking-wider">
                Admin
              </span>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                SaaS Billing Management
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Live control over subscription plans, pricing, user access rights, and custom quotes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentView('dashboard')}
              className="px-3.5 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Back to App
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Top Level Metric Cards */}
        {(() => {
          const pendingPaymentsCount = manualPayments.filter((p) => p.status === 'PENDING').length;
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    Total Revenue
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  ₹{totalRevenue.toLocaleString('en-IN')}
                </div>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  From {payments.length} verified transactions
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    Active Pro Subscribers
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {activeSubscribersCount}
                </div>
                <span className="text-[11px] text-slate-500 font-medium">Paying customers</span>
              </div>

              <div
                onClick={() => {
                  setActiveTab('payments');
                  setPaymentStatusFilter('PENDING');
                }}
                className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-2xs cursor-pointer hover:border-amber-400 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Pending Manual Payments
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
                    <Clock className="w-4 h-4 animate-pulse" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-amber-900 dark:text-amber-300 mt-2">
                  {pendingPaymentsCount}
                </div>
                <span className="text-[11px] text-amber-600 font-medium">Awaiting verification</span>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    Active Free Trials
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {trialingCount}
                </div>
                <span className="text-[11px] text-slate-500 font-medium">Inside 7-day trial</span>
              </div>
            </div>
          );
        })()}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('payments')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'payments'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Payments & Verifications</span>
            {manualPayments.filter((p) => p.status === 'PENDING').length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                {manualPayments.filter((p) => p.status === 'PENDING').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('trials')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'trials'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Trial Reviews & Abuse</span>
            {trialIdentities.filter((t) => t.eligibility_status === 'REVIEW_REQUIRED').length > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-bold">
                {trialIdentities.filter((t) => t.eligibility_status === 'REVIEW_REQUIRED').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Payment Settings</span>
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'plans'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300'
            }`}
          >
            Subscription Plans ({plans.length})
          </button>
          <button
            onClick={() => setActiveTab('subscribers')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'subscribers'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300'
            }`}
          >
            Subscribers & Access ({subscribers.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'requests'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300'
            }`}
          >
            Custom Inquiries ({requests.length})
          </button>
        </div>

        {/* Tab 0: Manual Payments */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
              <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    <span>Customer Manual Payment Verifications</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review and verify submitted UPI transaction IDs, UTR references, and payment screenshots.
                  </p>
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
                  {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((st) => {
                    const count =
                      st === 'ALL'
                        ? manualPayments.length
                        : manualPayments.filter((p) => p.status === st).length;
                    return (
                      <button
                        key={st}
                        onClick={() => setPaymentStatusFilter(st)}
                        className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                          paymentStatusFilter === st
                            ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                        }`}
                      >
                        {st === 'PENDING'
                          ? `Pending (${count})`
                          : st === 'APPROVED'
                          ? `Approved (${count})`
                          : st === 'REJECTED'
                          ? `Rejected (${count})`
                          : `All (${count})`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const filtered = manualPayments.filter((p) =>
                  paymentStatusFilter === 'ALL' ? true : p.status === paymentStatusFilter
                );

                if (filtered.length === 0) {
                  return (
                    <div className="p-12 text-center text-xs text-slate-500">
                      No payment requests found matching filter ({paymentStatusFilter}).
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-4">Customer & Business</th>
                          <th className="py-3 px-4">Plan & Amount</th>
                          <th className="py-3 px-4">Transaction ID / UTR</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Screenshot</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-700 dark:text-zinc-300">
                        {filtered.map((req) => (
                          <tr
                            key={req.id}
                            className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                          >
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900 dark:text-white">
                                {req.userName || 'User'}
                              </div>
                              <div className="text-[11px] text-slate-500">{req.userEmail}</div>
                              {req.businessName && (
                                <div className="text-[11px] text-indigo-600 font-medium">
                                  {req.businessName}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {req.planName}
                              </div>
                              <div className="text-sm font-extrabold text-indigo-600">
                                ₹{req.amountINR}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md inline-block select-all">
                                {req.utrNumber}
                              </div>
                              {req.notes && (
                                <div className="text-[11px] text-slate-500 mt-1 max-w-xs truncate">
                                  Note: {req.notes}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                              {new Date(req.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-3.5 px-4">
                              {req.screenshotUrl ? (
                                <button
                                  onClick={() => setSelectedScreenshot(req.screenshotUrl || null)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" /> View
                                </button>
                              ) : (
                                <span className="text-slate-400">No file</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {req.status === 'APPROVED' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                                  <Check className="w-3 h-3" /> Approved
                                </span>
                              ) : req.status === 'REJECTED' ? (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700 border border-red-300">
                                    <X className="w-3 h-3" /> Rejected
                                  </span>
                                  {req.rejectionReason && (
                                    <div className="text-[10px] text-red-600 mt-0.5 max-w-xs">
                                      {req.rejectionReason}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  <Clock className="w-3 h-3 animate-pulse" /> Pending Review
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              {req.status === 'PENDING' ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleApprovePayment(req)}
                                    disabled={isProcessingPaymentId === req.id}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                                  >
                                    {isProcessingPaymentId === req.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <CheckCheck className="w-3.5 h-3.5" />
                                    )}
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectModalReq(req);
                                      setRejectionReason(
                                        'Payment reference or UTR could not be verified.'
                                      );
                                    }}
                                    disabled={isProcessingPaymentId === req.id}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs border border-rose-200 transition-all disabled:opacity-50 cursor-pointer"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Reject</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">
                                  {req.reviewedBy ? `by ${req.reviewedBy}` : 'Processed'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Tab: Free-Trial Abuse Reviews & Identities */}
        {activeTab === 'trials' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
              <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    <span>Free-Trial Abuse Prevention & Identity Reviews</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Monitor 7-day trial eligibility, verified phone numbers, multi-account clusters, and override decisions.
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
                  {(['REVIEW_REQUIRED', 'ALL', 'ELIGIBLE', 'NOT_ELIGIBLE'] as const).map((filter) => {
                    const count =
                      filter === 'ALL'
                        ? trialIdentities.length
                        : trialIdentities.filter((t) => t.eligibility_status === filter).length;
                    return (
                      <button
                        key={filter}
                        onClick={() => setTrialFilter(filter)}
                        className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                          trialFilter === filter
                            ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                        }`}
                      >
                        {filter === 'REVIEW_REQUIRED'
                          ? 'Needs Review'
                          : filter === 'ELIGIBLE'
                          ? 'Eligible Trials'
                          : filter === 'NOT_ELIGIBLE'
                          ? 'Blocked / Abusive'
                          : 'All Records'}{' '}
                        ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Table */}
              {(() => {
                const filteredTrials =
                  trialFilter === 'ALL'
                    ? trialIdentities
                    : trialIdentities.filter((t) => t.eligibility_status === trialFilter);

                if (filteredTrials.length === 0) {
                  return (
                    <div className="p-12 text-center">
                      <ShieldCheck className="w-12 h-12 text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                        No trial identities in this category
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Accounts requiring security review will appear here automatically.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 uppercase tracking-wider font-semibold text-[10px]">
                        <tr>
                          <th className="py-3.5 px-4">User & Business</th>
                          <th className="py-3.5 px-4">Contact & Verifications</th>
                          <th className="py-3.5 px-4">Eligibility & Risk</th>
                          <th className="py-3.5 px-4">Abuse Signals / Reason</th>
                          <th className="py-3.5 px-4">Usage (PDFs)</th>
                          <th className="py-3.5 px-4 text-right">Admin Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                        {filteredTrials.map((t) => {
                          const isReview = t.eligibility_status === 'REVIEW_REQUIRED';
                          const isEligible = t.eligibility_status === 'ELIGIBLE';
                          const isBlocked = t.eligibility_status === 'NOT_ELIGIBLE';

                          return (
                            <tr
                              key={t.id}
                              className={`hover:bg-slate-50/80 dark:hover:bg-zinc-800/30 transition-colors ${
                                isReview ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                              }`}
                            >
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {t.user_name || 'Anonymous User'}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                                  <Building className="w-3 h-3 text-slate-400" />
                                  <span>{t.business_name || 'No business specified'}</span>
                                </div>
                                {t.gstin && (
                                  <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                                    GSTIN: {t.gstin}
                                  </div>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{t.email}</span>
                                  {t.email_verified ? (
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                                      Verified
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 text-[10px]">
                                      Unverified
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 mt-1">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  <span className="font-mono">{t.phone || 'No phone'}</span>
                                  {t.phone_verified ? (
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                                      Verified
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 text-[10px]">
                                      Unverified
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-1.5">
                                  {isEligible && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Eligible (Active)
                                    </span>
                                  )}
                                  {isReview && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse">
                                      <AlertCircle className="w-3 h-3" />
                                      Review Required
                                    </span>
                                  )}
                                  {isBlocked && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                      <XCircle className="w-3 h-3" />
                                      Not Eligible / Blocked
                                    </span>
                                  )}
                                  {!isEligible && !isReview && !isBlocked && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                                      Verification Pending
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 text-[11px] text-slate-500">
                                  Risk Score:{' '}
                                  <span
                                    className={`font-bold ${
                                      t.abuse_risk_score >= 50
                                        ? 'text-rose-600'
                                        : t.abuse_risk_score > 0
                                        ? 'text-amber-600'
                                        : 'text-emerald-600'
                                    }`}
                                  >
                                    {t.abuse_risk_score} / 100
                                  </span>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 max-w-xs">
                                <p className="text-[11px] text-slate-600 dark:text-zinc-300 truncate font-mono">
                                  {t.flag_reason || 'Clean - No abuse signals'}
                                </p>
                                {t.ip_address && (
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    IP: {t.ip_address}
                                  </div>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {t.trial_pdf_downloads ?? 0} / 2 PDFs
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {new Date(t.created_at).toLocaleDateString()}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {!isEligible && (
                                    <button
                                      onClick={() => handleApproveTrial(t)}
                                      disabled={isProcessingTrialId === t.user_id}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Approve Trial</span>
                                    </button>
                                  )}
                                  {!isBlocked && (
                                    <button
                                      onClick={() => {
                                        setTrialRejectModalUser(t);
                                        setTrialRejectReason('');
                                      }}
                                      disabled={isProcessingTrialId === t.user_id}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs border border-rose-200 transition-all cursor-pointer"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                      <span>Block / Reject</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Tab 0.5: Payment Settings */}
        {activeTab === 'settings' && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
            <div className="p-6 border-b border-slate-200 dark:border-zinc-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-600" />
                <span>Configure Business Payment Details</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                These details will be dynamically presented to customers when paying for monthly, 3-month, or 6-month subscriptions.
              </p>
            </div>

            <form onSubmit={handleSavePaymentSettings} className="p-6 space-y-6">
              {/* UPI Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" /> UPI & QR Code Settings
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      Business UPI ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={paymentSettings.upiId}
                      onChange={(e) =>
                        setPaymentSettings({ ...paymentSettings, upiId: e.target.value })
                      }
                      placeholder="e.g. company@okhdfcbank"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      Custom QR Code Image URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={paymentSettings.qrCodeUrl}
                      onChange={(e) =>
                        setPaymentSettings({ ...paymentSettings, qrCodeUrl: e.target.value })
                      }
                      placeholder="Leave blank to generate dynamic UPI QR code automatically"
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                  <Building className="w-4 h-4" /> Bank Account Transfer Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      Account Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={paymentSettings.bankAccountName}
                      onChange={(e) =>
                        setPaymentSettings({ ...paymentSettings, bankAccountName: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={paymentSettings.bankName}
                      onChange={(e) =>
                        setPaymentSettings({ ...paymentSettings, bankName: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      Account Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={paymentSettings.bankAccountNumber}
                      onChange={(e) =>
                        setPaymentSettings({
                          ...paymentSettings,
                          bankAccountNumber: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      IFSC Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={paymentSettings.bankIfsc}
                      onChange={(e) =>
                        setPaymentSettings({
                          ...paymentSettings,
                          bankIfsc: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      Bank Branch *
                    </label>
                    <input
                      type="text"
                      required
                      value={paymentSettings.bankBranch}
                      onChange={(e) =>
                        setPaymentSettings({ ...paymentSettings, bankBranch: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* WhatsApp Number */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                  <Phone className="w-4 h-4" /> WhatsApp Support Number
                </h3>
                <div className="max-w-sm">
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    WhatsApp Number (with country code) *
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentSettings.whatsappNumber}
                    onChange={(e) =>
                      setPaymentSettings({ ...paymentSettings, whatsappNumber: e.target.value })
                    }
                    placeholder="e.g. 919876543210"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Used for one-click &quot;Confirm on WhatsApp&quot; message redirection.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSavingSettings ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save Payment Settings
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}


        {/* Tab 1: Plans Management */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
              <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Configured Subscription Plans
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pricing and features here are loaded dynamically across all pricing tables and the Razorpay gateway.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Plan Name</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4">Price (INR)</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Highlighted</th>
                      <th className="py-3 px-4 text-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-700 dark:text-zinc-300">
                    {plans.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                          {p.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {p.isCustom ? 'Custom' : `${p.durationMonths} ${p.durationMonths === 1 ? 'Month' : 'Months'}`}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-white">
                          {p.isCustom ? 'Custom Quote' : `₹${p.priceINR.toLocaleString('en-IN')}`}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                              p.isActive
                                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                            }`}
                          >
                            {p.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {p.isPopular ? (
                            <span className="text-[11px] text-blue-600 font-semibold">Popular Badge</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setEditingPlan({ ...p })}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                          >
                            Edit Plan
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Plan Edit Modal */}
            {editingPlan && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
                <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <button
                    onClick={() => setEditingPlan(null)}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-blue-600" />
                    <span>Edit Plan: {editingPlan.name}</span>
                  </h3>

                  <form onSubmit={handleSavePlan} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                          Plan Name
                        </label>
                        <input
                          type="text"
                          required
                          value={editingPlan.name}
                          onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                          className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                          Price in INR (₹)
                        </label>
                        <input
                          type="number"
                          required
                          value={editingPlan.priceINR}
                          onChange={(e) =>
                            setEditingPlan({ ...editingPlan, priceINR: Number(e.target.value) })
                          }
                          className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                          Duration (Months)
                        </label>
                        <input
                          type="number"
                          required
                          min={1}
                          max={36}
                          value={editingPlan.durationMonths}
                          onChange={(e) =>
                            setEditingPlan({ ...editingPlan, durationMonths: Number(e.target.value) })
                          }
                          className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="flex items-center gap-4 pt-5">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingPlan.isActive}
                            onChange={(e) =>
                              setEditingPlan({ ...editingPlan, isActive: e.target.checked })
                            }
                            className="rounded border-slate-300 text-blue-600 w-4 h-4"
                          />
                          <span>Active</span>
                        </label>

                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingPlan.isPopular || false}
                            onChange={(e) =>
                              setEditingPlan({ ...editingPlan, isPopular: e.target.checked })
                            }
                            className="rounded border-slate-300 text-blue-600 w-4 h-4"
                          />
                          <span>Popular Tag</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                        Short Description
                      </label>
                      <input
                        type="text"
                        value={editingPlan.description}
                        onChange={(e) =>
                          setEditingPlan({ ...editingPlan, description: e.target.value })
                        }
                        className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                        Features (one per line)
                      </label>
                      <textarea
                        rows={4}
                        value={editingPlan.features.join('\n')}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            features: e.target.value.split('\n').filter((l) => l.trim().length > 0),
                          })
                        }
                        className="w-full p-2.5 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="pt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPlan(null)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingPlan}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                      >
                        {isSavingPlan ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>Save Changes</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Subscribers & Overrides */}
        {activeTab === 'subscribers' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search user, email, business or status..."
                  className="w-full h-9 pl-9 pr-3 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>
              <span className="text-xs text-slate-500">
                Showing {filteredSubscribers.length} of {subscribers.length} total users
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">User & Business</th>
                      <th className="py-3 px-4">Plan / Status</th>
                      <th className="py-3 px-4">Trial Ends</th>
                      <th className="py-3 px-4">Subscription Ends</th>
                      <th className="py-3 px-4 text-right">Manual Override Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-700 dark:text-zinc-300">
                    {filteredSubscribers.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {s.userName || 'Unnamed User'}
                          </div>
                          <div className="text-[11px] text-slate-500">{s.email}</div>
                          <div className="text-[11px] text-blue-600 font-medium">{s.businessName}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {s.planName || 'Free Trial'}
                          </div>
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              s.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-700'
                                : s.status === 'TRIALING'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {s.subscriptionEndsAt
                            ? new Date(s.subscriptionEndsAt).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => handleManualOverride(s.userId, 'grant', 30)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px] rounded-lg transition-colors cursor-pointer"
                            title="Grant 30 Days Free Pro Access"
                          >
                            +30d Pro
                          </button>
                          <button
                            onClick={() => handleManualOverride(s.userId, 'extend_trial', 7)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-semibold text-[11px] rounded-lg transition-colors cursor-pointer"
                            title="Add 7 More Trial Days"
                          >
                            +7d Trial
                          </button>
                          <button
                            onClick={() => handleManualOverride(s.userId, 'revoke', 0)}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 font-semibold text-[11px] rounded-lg transition-colors cursor-pointer"
                            title="Expire & Lock Document Creation"
                          >
                            Expire
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Custom Plan Inquiries */}
        {activeTab === 'requests' && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
            <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Customer Custom Plan Requests
                </h2>
                <p className="text-xs text-slate-500">
                  Inquiries submitted by businesses seeking custom durations, terms, or enterprise arrangements.
                </p>
              </div>
            </div>

            {requests.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No custom plan requests received yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Customer & Business</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4">Requirements</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-700 dark:text-zinc-300">
                    {requests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{r.name}</div>
                          <div className="text-[11px] text-blue-600">{r.businessName}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div>{r.email}</div>
                          <div className="text-slate-500">{r.phone}</div>
                        </td>
                        <td className="py-3.5 px-4 font-medium">{r.duration}</td>
                        <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 dark:text-zinc-400">
                          {r.requirements || 'No special requirements stated.'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Screenshot Full-Resolution Modal */}
        {selectedScreenshot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl p-2 flex flex-col items-center">
              <div className="w-full flex justify-between items-center px-4 py-2 border-b border-slate-200 dark:border-zinc-800">
                <span className="font-bold text-xs text-slate-800 dark:text-zinc-200">
                  Customer Payment Screenshot
                </span>
                <button
                  onClick={() => setSelectedScreenshot(null)}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-auto p-2 max-h-[80vh]">
                <img
                  src={selectedScreenshot}
                  alt="Payment Confirmation Screenshot"
                  className="max-w-full h-auto object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* Reject Payment Reason Modal */}
        {rejectModalReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
                  <XCircle className="w-5 h-5" />
                  <span>Reject Payment Confirmation</span>
                </div>
                <button
                  onClick={() => setRejectModalReq(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-600 dark:text-zinc-400 space-y-1">
                <div>
                  Customer:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {rejectModalReq.userName || 'User'}
                  </strong>
                </div>
                <div>
                  Plan:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {rejectModalReq.planName} (₹{rejectModalReq.amountINR})
                  </strong>
                </div>
                <div>
                  UTR:{' '}
                  <strong className="font-mono text-slate-900 dark:text-white">
                    {rejectModalReq.utrNumber}
                  </strong>
                </div>
              </div>

              <form onSubmit={handleRejectPayment} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Rejection Reason (visible to customer)
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. UTR number not found in bank statement, amount mismatch..."
                    className="w-full p-2.5 text-xs border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRejectModalReq(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(isProcessingPaymentId)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessingPaymentId ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reject Trial Modal */}
        {trialRejectModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
                  <ShieldAlert className="w-5 h-5" />
                  <span>Reject & Block Free Trial</span>
                </div>
                <button
                  onClick={() => setTrialRejectModalUser(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-600 dark:text-zinc-400 space-y-1">
                <div>
                  User: <strong className="text-slate-900 dark:text-white">{trialRejectModalUser.user_name || 'User'}</strong>
                </div>
                <div>
                  Email: <strong className="text-slate-900 dark:text-white">{trialRejectModalUser.email}</strong>
                </div>
                <div>
                  Phone: <strong className="text-slate-900 dark:text-white font-mono">{trialRejectModalUser.phone || 'N/A'}</strong>
                </div>
                {trialRejectModalUser.flag_reason && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-[11px]">
                    Current flag: {trialRejectModalUser.flag_reason}
                  </div>
                )}
              </div>

              <form onSubmit={handleRejectTrial} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Rejection Reason
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={trialRejectReason}
                    onChange={(e) => setTrialRejectReason(e.target.value)}
                    placeholder="e.g. Repeated trial abuse detected, duplicate business profile..."
                    className="w-full p-2.5 text-xs border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTrialRejectModalUser(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(isProcessingTrialId)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessingTrialId ? 'Rejecting...' : 'Confirm Reject & Block'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

