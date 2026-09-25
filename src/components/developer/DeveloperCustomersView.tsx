'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Eye,
  MoreVertical,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CreditCard,
  Building2,
  Calendar,
  Phone,
  Mail,
  RefreshCw,
  X,
  Plus,
  ArrowRight,
  Ban,
  Unlock,
  KeyRound,
} from 'lucide-react';
import { DeveloperCustomerSummary, SubscriptionPlan } from '@/types';

interface DeveloperCustomersViewProps {
  plans: SubscriptionPlan[];
  onRefreshStats: () => void;
}

export default function DeveloperCustomersView({ plans, onRefreshStats }: DeveloperCustomersViewProps) {
  const [customers, setCustomers] = useState<DeveloperCustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  // Selected customer for detailed modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Lifecycle Action Modals
  const [activeActionModal, setActiveActionModal] = useState<{
    type: 'EXTEND' | 'CHANGE_PLAN' | 'SUSPEND' | 'MANUAL_ACTIVATE' | 'CANCEL' | 'ADJUST_PDF' | 'ADD_BONUS_PDF';
    customer: DeveloperCustomerSummary;
  } | null>(null);

  const [extendDays, setExtendDays] = useState(30);
  const [selectedPlanId, setSelectedPlanId] = useState('plan_1m');
  const [suspendReason, setSuspendReason] = useState('');
  const [customPdfLimit, setCustomPdfLimit] = useState(20);
  const [bonusPdfAmount, setBonusPdfAmount] = useState(10);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ew_developer_token') || '';
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('filter', filter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/developer/customers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers || []);
      }
    } catch (e) {
      console.error('Error loading customers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [filter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  const openCustomerDetails = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setLoadingDetails(true);
    try {
      const token = localStorage.getItem('ew_developer_token') || '';
      const res = await fetch(`/api/developer/customers/${customerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setCustomerDetails(data.details);
      }
    } catch (e) {
      console.error('Error fetching customer details:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const executeCustomerAction = async () => {
    if (!activeActionModal) return;
    const { type, customer } = activeActionModal;
    setActionLoading(true);
    setStatusMessage(null);

    try {
      const token = localStorage.getItem('ew_developer_token') || '';
      let body: any = { userId: customer.id };

      if (type === 'EXTEND') {
        body.action = 'EXTEND_SUB';
        body.days = extendDays;
      } else if (type === 'CHANGE_PLAN') {
        body.action = 'CHANGE_PLAN';
        body.planId = selectedPlanId;
      } else if (type === 'SUSPEND') {
        body.action = customer.status === 'SUSPENDED' ? 'REACTIVATE' : 'SUSPEND';
        body.reason = suspendReason;
      } else if (type === 'MANUAL_ACTIVATE') {
        body.action = 'MANUAL_ACTIVATE';
        body.planId = selectedPlanId;
      } else if (type === 'CANCEL') {
        body.action = 'CANCEL_SUB';
        body.reason = suspendReason;
      } else if (type === 'ADJUST_PDF') {
        body.action = 'ADJUST_PDF_LIMIT';
        body.limit = customPdfLimit;
      } else if (type === 'ADD_BONUS_PDF') {
        body.action = 'ADD_BONUS_PDF';
        body.bonus = bonusPdfAmount;
      }

      const res = await fetch('/api/developer/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Action failed');
      }

      setStatusMessage({ type: 'success', text: data.message || 'Operation executed successfully.' });
      fetchCustomers();
      onRefreshStats();
      if (selectedCustomerId === customer.id) {
        openCustomerDetails(customer.id);
      }
      setTimeout(() => {
        setActiveActionModal(null);
        setStatusMessage(null);
      }, 1500);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Action failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPdfUsage = async (customer: DeveloperCustomerSummary) => {
    if (!confirm(`Are you sure you want to reset PDF downloads used count to 0 for ${customer.name}?`)) return;
    try {
      const token = localStorage.getItem('ew_developer_token') || '';
      const res = await fetch('/api/developer/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'RESET_PDF_USAGE', userId: customer.id }),
      });
      const data = await res.json();
      alert(data.message || 'PDF downloads usage counter reset to 0.');
      fetchCustomers();
      if (selectedCustomerId === customer.id) {
        openCustomerDetails(customer.id);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to reset PDF usage.');
    }
  };

  const handleResetAccess = async (customer: DeveloperCustomerSummary) => {
    if (!confirm(`Are you sure you want to reset verification limits and access for ${customer.name}?`)) return;
    try {
      const token = localStorage.getItem('ew_developer_token') || '';
      const res = await fetch('/api/developer/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'RESET_ACCESS', userId: customer.id }),
      });
      const data = await res.json();
      alert(data.message || 'Access reset successfully.');
      fetchCustomers();
    } catch (e: any) {
      alert(e.message || 'Failed to reset access.');
    }
  };

  const handleQuickToggleSuspend = async (customer: DeveloperCustomerSummary) => {
    if (customer.status === 'SUSPENDED') {
      if (!confirm(`Reactivate account for ${customer.name} (${customer.email})?`)) return;
      try {
        const token = localStorage.getItem('ew_developer_token') || '';
        const res = await fetch('/api/developer/customers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'REACTIVATE', userId: customer.id }),
        });
        const data = await res.json();
        if (data.success) {
          fetchCustomers();
          onRefreshStats();
        } else {
          alert(data.error || 'Failed to reactivate customer');
        }
      } catch (e: any) {
        alert(e.message || 'Error reactivating customer');
      }
    } else {
      setActiveActionModal({ type: 'SUSPEND', customer });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19] text-zinc-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Customer Lifecycle
              </span>
              <span className="text-xs text-zinc-400">• Developer Management</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Customers & Tenants</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Search, inspect profiles, manage subscription periods, change plans, and control account statuses.
            </p>
          </div>

          <button
            onClick={fetchCustomers}
            className="h-9 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, business, or phone..."
              className="w-full h-9 pl-9 pr-20 bg-[#121724] border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-blue-500"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 h-6 px-2.5 bg-blue-600 hover:bg-blue-500 text-[10px] font-semibold text-white rounded-lg cursor-pointer"
            >
              Search
            </button>
          </form>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active Pro' },
              { id: 'trialing', label: 'Trialing' },
              { id: 'expired', label: 'Expired' },
              { id: 'payment_pending', label: 'Payment Pending' },
              { id: 'suspended', label: 'Suspended' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  filter === f.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-[#121724] text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-[#121724] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300 min-w-[1000px]">
              <thead className="bg-[#0e131f] text-zinc-400 text-[11px] uppercase font-bold tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-3.5 px-4 min-w-[210px] whitespace-nowrap">Customer</th>
                  <th className="py-3.5 px-4 min-w-[150px] whitespace-nowrap">Business</th>
                  <th className="py-3.5 px-4 min-w-[180px] whitespace-nowrap">Subscription</th>
                  <th className="py-3.5 px-4 min-w-[140px] whitespace-nowrap">PDF Quota</th>
                  <th className="py-3.5 px-4 min-w-[130px] whitespace-nowrap">Documents</th>
                  <th className="py-3.5 px-4 min-w-[110px] whitespace-nowrap">Status</th>
                  <th className="py-3.5 px-4 min-w-[230px] whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span>Loading customer records...</span>
                      </div>
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      No customer accounts match your search/filter criteria.
                    </td>
                  </tr>
                ) : (
                  customers.map((cust) => {
                    const subStatus = cust.subscription?.status || 'EXPIRED';
                    const isSuspended = cust.status === 'SUSPENDED';

                    return (
                      <tr
                        key={cust.id}
                        className="hover:bg-[#161d2d] transition-colors group cursor-default"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{cust.name}</span>
                            {cust.role === 'admin' && (
                              <span className="text-[9px] px-1 rounded bg-purple-500/20 text-purple-400 font-mono">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5 mt-0.5">
                            <Mail className="w-3 h-3 text-zinc-500" />
                            <span>{cust.email}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-zinc-200 font-medium truncate max-w-[150px]">
                            {cust.businessName || '—'}
                          </div>
                          {cust.phone && (
                            <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-zinc-500" />
                              <span>{cust.phone}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                isSuspended
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : subStatus === 'ACTIVE'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : subStatus === 'TRIALING'
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {isSuspended ? 'SUSPENDED' : subStatus}
                            </span>
                            <span className="text-[11px] font-mono text-zinc-400">
                              {cust.subscription?.planName || '1 Month'}
                            </span>
                          </div>
                          {cust.subscription?.subscriptionEndsAt && (
                            <div className="text-[10px] text-zinc-400 mt-1">
                              Expires:{' '}
                              {new Date(cust.subscription.subscriptionEndsAt).toLocaleDateString()}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white font-mono">
                              {cust.subscription?.pdfDownloadsUsed ?? cust.subscription?.trialPdfDownloads ?? 0}
                            </span>
                            <span className="text-zinc-500 font-mono">
                              / {cust.subscription?.pdfDownloadLimit ?? 2}
                            </span>
                            {(cust.subscription?.pdfDownloadsRemaining !== undefined
                              ? cust.subscription.pdfDownloadsRemaining <= 0
                              : (cust.subscription?.trialPdfDownloads ?? 0) >= (cust.subscription?.pdfDownloadLimit ?? 2)) && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold">
                                LIMIT
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            {cust.subscription?.pdfDownloadsRemaining ?? 0} remaining
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-[11px] text-zinc-300">
                            <strong>{cust.quotationsCount}</strong> quotes,{' '}
                            <strong>{cust.invoicesCount}</strong> invoices
                          </div>
                          {cust.totalPaymentsINR > 0 && (
                            <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                              Paid: ₹{cust.totalPaymentsINR}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {isSuspended ? (
                            <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-semibold">
                              <Ban className="w-3 h-3" />
                              <span>Suspended</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Active</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap min-w-[230px]">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openCustomerDetails(cust.id)}
                              title="Inspect 360° Profile"
                              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-blue-400 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() =>
                                setActiveActionModal({
                                  type: 'EXTEND',
                                  customer: cust,
                                })
                              }
                              title="Extend Subscription"
                              className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              Extend
                            </button>

                            <button
                              onClick={() =>
                                setActiveActionModal({
                                  type: 'CHANGE_PLAN',
                                  customer: cust,
                                })
                              }
                              title="Change Plan"
                              className="px-2 py-1 bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              Plan
                            </button>

                            {isSuspended ? (
                              <button
                                onClick={() => handleQuickToggleSuspend(cust)}
                                title="Reactivate Customer Account"
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30"
                              >
                                <Unlock className="w-3 h-3" />
                                <span>Reactivate</span>
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  setActiveActionModal({
                                    type: 'SUSPEND',
                                    customer: cust,
                                  })
                                }
                                title="Suspend Customer Account"
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30"
                              >
                                <Ban className="w-3 h-3" />
                                <span>Suspend</span>
                              </button>
                            )}
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

      {/* Customer Full Inspection Drawer / Modal */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-[#0e131f] border-l border-zinc-800 h-full flex flex-col shadow-2xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Customer 360° Profile</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">Authoritative Tenant & Subscription Details</p>
              </div>
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingDetails || !customerDetails ? (
              <div className="flex-1 flex items-center justify-center p-12">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-zinc-400">Loading customer telemetry...</span>
                </div>
              </div>
            ) : (
              <div className="space-y-6 mt-6">
                {/* Profile Card */}
                <div className="p-4 rounded-xl bg-[#121724] border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">{customerDetails.user?.name}</h3>
                      <p className="text-xs text-zinc-400">{customerDetails.user?.email}</p>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                        customerDetails.user?.status === 'SUSPENDED'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {customerDetails.user?.status || 'ACTIVE'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs pt-2 border-t border-zinc-800/80">
                    <div>
                      <span className="text-zinc-500">Business:</span>{' '}
                      <strong className="text-white">{customerDetails.user?.businessName || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500">Phone:</span>{' '}
                      <strong className="text-white">{customerDetails.user?.phone || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500">Joined:</span>{' '}
                      <span className="text-zinc-300">
                        {new Date(customerDetails.user?.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">User ID:</span>{' '}
                      <span className="font-mono text-[10px] text-zinc-400">{customerDetails.user?.id}</span>
                    </div>
                  </div>
                </div>

                {/* Subscription Details Card */}
                <div className="p-4 rounded-xl bg-[#121724] border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                      <span>Subscription State</span>
                    </h4>
                    <span className="text-xs font-bold text-blue-400">
                      {customerDetails.subscription?.plan?.name || 'Standard Plan'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#0e131f] border border-zinc-800">
                      <span className="text-zinc-500 text-[10px] block">Current Status</span>
                      <strong className="text-white text-xs">{customerDetails.subscription?.status}</strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#0e131f] border border-zinc-800">
                      <span className="text-zinc-500 text-[10px] block">PDF Limit & Usage</span>
                      <strong className="text-white text-xs">
                        {customerDetails.subscription?.pdfDownloadsUsed ?? 0} of {customerDetails.subscription?.pdfDownloadLimit ?? 2} used
                      </strong>
                      <span className="text-[10px] text-zinc-400 block mt-0.5 font-mono">
                        {customerDetails.subscription?.pdfDownloadsRemaining ?? 0} remaining
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#0e131f] border border-zinc-800">
                      <span className="text-zinc-500 text-[10px] block">Trial Ends At</span>
                      <span className="text-zinc-300 text-xs">
                        {customerDetails.subscription?.trialEndsAt
                          ? new Date(customerDetails.subscription.trialEndsAt).toLocaleString()
                          : '—'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#0e131f] border border-zinc-800">
                      <span className="text-zinc-500 text-[10px] block">Paid Subscription Ends</span>
                      <span className="text-zinc-300 text-xs">
                        {customerDetails.subscription?.subscriptionEndsAt
                          ? new Date(customerDetails.subscription.subscriptionEndsAt).toLocaleDateString()
                          : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
                    <button
                      onClick={() =>
                        setActiveActionModal({
                          type: 'EXTEND',
                          customer: {
                            ...customerDetails.user,
                            subscription: customerDetails.subscription,
                          },
                        })
                      }
                      className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Extend Subscription
                    </button>
                    <button
                      onClick={() =>
                        setActiveActionModal({
                          type: 'CHANGE_PLAN',
                          customer: {
                            ...customerDetails.user,
                            subscription: customerDetails.subscription,
                          },
                        })
                      }
                      className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Change Plan
                    </button>
                    <button
                      onClick={() => handleResetAccess(customerDetails.user)}
                      className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Reset Access
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        setCustomPdfLimit(customerDetails.subscription?.pdfDownloadLimit ?? 20);
                        setActiveActionModal({
                          type: 'ADJUST_PDF',
                          customer: {
                            ...customerDetails.user,
                            subscription: customerDetails.subscription,
                          },
                        });
                      }}
                      className="flex-1 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Adjust PDF Limit
                    </button>
                    <button
                      onClick={() => {
                        setBonusPdfAmount(10);
                        setActiveActionModal({
                          type: 'ADD_BONUS_PDF',
                          customer: {
                            ...customerDetails.user,
                            subscription: customerDetails.subscription,
                          },
                        });
                      }}
                      className="flex-1 py-1.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    >
                      +Bonus PDFs
                    </button>
                    <button
                      onClick={() => handleResetPdfUsage(customerDetails.user)}
                      className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-amber-400 rounded-lg text-xs font-semibold cursor-pointer"
                      title="Reset PDF downloads used count to 0"
                    >
                      Reset PDF Usage
                    </button>
                  </div>
                </div>

                {/* Documents Summary */}
                <div className="p-4 rounded-xl bg-[#121724] border border-zinc-800 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Customer Documents</span>
                  </h4>

                  <div className="text-xs text-zinc-300">
                    Quotations ({customerDetails.quotations?.length || 0}) • Invoices (
                    {customerDetails.invoices?.length || 0})
                  </div>

                  {customerDetails.invoices?.length > 0 && (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {customerDetails.invoices.map((inv: any) => (
                        <div
                          key={inv.id}
                          className="p-2 rounded-lg bg-[#0e131f] border border-zinc-800/80 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-white">{inv.invoice_number}</span>
                            <span className="text-zinc-500 ml-2">{inv.customer_name}</span>
                          </div>
                          <span className="font-bold text-emerald-400">₹{inv.grand_total}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Activity & Audit Trail */}
                {customerDetails.activity?.length > 0 && (
                  <div className="p-4 rounded-xl bg-[#121724] border border-zinc-800 space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Recent Activity Audit
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {customerDetails.activity.map((act: any) => (
                        <div key={act.id} className="text-xs p-2 rounded bg-[#0e131f] border border-zinc-800/60">
                          <div className="flex items-center justify-between font-semibold text-zinc-300">
                            <span>{act.action}</span>
                            <span className="text-[10px] text-zinc-500">
                              {new Date(act.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">{act.details}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Dialog / Modal */}
      {activeActionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121724] border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                {activeActionModal.type === 'EXTEND' && 'Extend Subscription Period'}
                {activeActionModal.type === 'CHANGE_PLAN' && 'Change Subscription Plan'}
                {activeActionModal.type === 'SUSPEND' &&
                  (activeActionModal.customer.status === 'SUSPENDED' ? 'Reactivate Account' : 'Suspend Account')}
                {activeActionModal.type === 'MANUAL_ACTIVATE' && 'Direct Subscription Activation'}
                {activeActionModal.type === 'CANCEL' && 'Cancel Subscription'}
                {activeActionModal.type === 'ADJUST_PDF' && 'Adjust Customer PDF Download Limit'}
                {activeActionModal.type === 'ADD_BONUS_PDF' && 'Add Bonus PDF Downloads'}
              </h3>
              <button
                onClick={() => setActiveActionModal(null)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Customer: <strong className="text-white">{activeActionModal.customer.name}</strong> (
              {activeActionModal.customer.email})
            </p>

            {statusMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            {activeActionModal.type === 'EXTEND' && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-zinc-300">
                  Select Days to Extend
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[7, 30, 90, 180, 365].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setExtendDays(d)}
                      className={`py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                        extendDays === d
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#0e131f] border border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      +{d} Days
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeActionModal.type === 'CHANGE_PLAN' && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-zinc-300">Target Plan</label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full h-10 px-3 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs text-white"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₹{p.priceINR} ({p.durationMonths}m, {p.pdfDownloadLimit} PDFs)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeActionModal.type === 'SUSPEND' && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-zinc-300">Reason / Notes</label>
                <input
                  type="text"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="e.g. Terms violation, requested pause, duplicate trial"
                  className="w-full h-10 px-3 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500"
                />
              </div>
            )}

            {activeActionModal.type === 'ADJUST_PDF' && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-zinc-300">
                  New Total PDF Download Limit
                </label>
                <input
                  type="number"
                  min={0}
                  value={customPdfLimit}
                  onChange={(e) => setCustomPdfLimit(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. 50"
                  className="w-full h-10 px-3 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs text-white"
                />
                <p className="text-[11px] text-zinc-400">
                  Current usage: {activeActionModal.customer.subscription?.pdfDownloadsUsed ?? 0} of {activeActionModal.customer.subscription?.pdfDownloadLimit ?? 2} used ({activeActionModal.customer.subscription?.pdfDownloadsRemaining ?? 0} remaining).
                </p>
              </div>
            )}

            {activeActionModal.type === 'ADD_BONUS_PDF' && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-zinc-300">
                  Bonus PDF Downloads to Add
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 20, 50].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBonusPdfAmount(b)}
                      className={`py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                        bonusPdfAmount === b
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#0e131f] border border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      +{b} PDFs
                    </button>
                  ))}
                </div>
                <div className="pt-2">
                  <label className="block text-[11px] text-zinc-400 mb-1">Or enter custom bonus count:</label>
                  <input
                    type="number"
                    min={1}
                    value={bonusPdfAmount}
                    onChange={(e) => setBonusPdfAmount(parseInt(e.target.value, 10) || 1)}
                    className="w-full h-9 px-3 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>
                <p className="text-[11px] text-zinc-400">
                  Will increase limit from {activeActionModal.customer.subscription?.pdfDownloadLimit ?? 2} to {(activeActionModal.customer.subscription?.pdfDownloadLimit ?? 2) + bonusPdfAmount}.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setActiveActionModal(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeCustomerAction}
                disabled={actionLoading}
                className={`px-4 py-2 disabled:opacity-50 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors ${
                  activeActionModal.type === 'SUSPEND'
                    ? activeActionModal.customer.status === 'SUSPENDED'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                {actionLoading
                  ? 'Saving...'
                  : activeActionModal.type === 'SUSPEND'
                  ? activeActionModal.customer.status === 'SUSPENDED'
                    ? 'Reactivate Account'
                    : 'Suspend Account'
                  : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
