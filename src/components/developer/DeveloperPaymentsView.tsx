'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  QrCode,
  Phone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Save,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Building2,
  FileCheck,
  Eye,
  X,
} from 'lucide-react';
import { ManualPaymentRequest, PaymentSettings } from '@/types';

interface DeveloperPaymentsViewProps {
  onRefreshStats: () => void;
}

export default function DeveloperPaymentsView({ onRefreshStats }: DeveloperPaymentsViewProps) {
  const [activeTab, setActiveTab] = useState<'queue' | 'settings'>('queue');
  const [payments, setPayments] = useState<ManualPaymentRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [loading, setLoading] = useState(true);

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Settings state
  const [settings, setSettings] = useState<PaymentSettings>({
    id: 'default',
    upiId: '9539933265@naviaxis',
    qrCodeUrl: '',
    bankAccountName: 'Easyworks Solutions Private Limited',
    bankName: 'HDFC Bank',
    bankAccountNumber: '50200088991122',
    bankIfsc: 'HDFC0001234',
    bankBranch: 'Indiranagar Branch, Bengaluru',
    whatsappNumber: '9539933265',
    updatedAt: new Date().toISOString(),
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/payments');
      const data = await res.json();
      if (data.success) {
        setPayments(data.requests || []);
      }
    } catch (e) {
      console.error('Error fetching payments:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/billing/payment-settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (e) {
      console.error('Error fetching payment settings:', e);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchSettings();
  }, []);

  const handleApprove = async (requestId: string) => {
    if (!confirm('Approve payment and activate customer subscription immediately?')) return;
    setProcessingId(requestId);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'APPROVE', adminName: 'Super Admin' }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPayments();
        onRefreshStats();
      } else {
        alert(data.error || 'Failed to approve payment');
      }
    } catch (e: any) {
      alert(e.message || 'Error approving payment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestId) return;
    setProcessingId(selectedRequestId);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedRequestId,
          action: 'REJECT',
          reason: rejectionReason || 'UTR transaction could not be verified on bank statement.',
          adminName: 'Super Admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRejectModalOpen(false);
        setSelectedRequestId(null);
        setRejectionReason('');
        fetchPayments();
        onRefreshStats();
      } else {
        alert(data.error || 'Failed to reject payment');
      }
    } catch (e: any) {
      alert(e.message || 'Error rejecting payment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const token = localStorage.getItem('ew_developer_token') || '';
      const res = await fetch('/api/developer/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'PAYMENT_SETTINGS',
          paymentSettings: settings,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2500);
      } else {
        alert(data.error || 'Failed to save payment coordinates');
      }
    } catch (e: any) {
      alert(e.message || 'Error updating settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (statusFilter === 'ALL') return true;
    return p.status === statusFilter;
  });

  const pendingCount = payments.filter((p) => p.status === 'PENDING').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19] text-zinc-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Manual Payments
              </span>
              <span className="text-xs text-zinc-400">• Developer Verification & Configuration</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Payments & UPI Coordinates</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Verify manual UTR submissions from customers and manage the business UPI, QR, and WhatsApp confirmation channel.
            </p>
          </div>

          {/* Sub-tab switcher */}
          <div className="flex items-center gap-2 bg-[#121724] p-1 border border-zinc-800 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'queue' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Verification Queue</span>
              {pendingCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-bold">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Payment Coordinates</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Verification Queue */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            {/* Status Filter Pills */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer ${
                      statusFilter === st
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#121724] text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    {st === 'PENDING' ? `Pending (${pendingCount})` : st}
                  </button>
                ))}
              </div>

              <button
                onClick={fetchPayments}
                className="h-8 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Queue</span>
              </button>
            </div>

            {/* Payments Table */}
            <div className="bg-[#121724] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-[#0e131f] text-zinc-400 text-[11px] uppercase font-bold tracking-wider border-b border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Plan & Amount</th>
                    <th className="py-3 px-4">UTR Number</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-500">
                        Loading manual payment queue...
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-500">
                        No payment requests in this state.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-[#161d2d] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{p.userName || p.userEmail}</div>
                          <div className="text-[11px] text-zinc-400">{p.userEmail}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-white text-sm">₹{p.amountINR}</span>
                          <div className="text-[11px] text-blue-400 font-mono mt-0.5">{p.planName}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-mono text-zinc-200 bg-[#0e131f] px-2 py-1 rounded-md border border-zinc-800/80 inline-block font-bold">
                            {p.utrNumber}
                          </div>
                          {p.notes && <div className="text-[10px] text-zinc-400 mt-1">{p.notes}</div>}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-zinc-300">{new Date(p.createdAt).toLocaleDateString()}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              p.status === 'APPROVED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : p.status === 'PENDING'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {p.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApprove(p.id)}
                                disabled={processingId === p.id}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                              >
                                {processingId === p.id ? 'Approving...' : 'Approve & Activate'}
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRequestId(p.id);
                                  setRejectModalOpen(true);
                                }}
                                disabled={processingId === p.id}
                                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-rose-400 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-zinc-500 font-mono">
                              {p.reviewedBy ? `by ${p.reviewedBy}` : 'Processed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Payment Settings */}
        {activeTab === 'settings' && (
          <div className="bg-[#121724] border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-xl max-w-3xl space-y-6">
            <div className="border-b border-zinc-800 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-400" />
                <span>Developer Payment Settings</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                These coordinates are rendered in the customer manual payment modal and WhatsApp link.
              </p>
            </div>

            {settingsSaved && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Payment coordinates updated successfully! Live on all customer payment modals.</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-5">
              {/* Primary UPI ID */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Business UPI ID *
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    value={settings.upiId}
                    onChange={(e) => setSettings({ ...settings, upiId: e.target.value })}
                    placeholder="e.g. 9539933265@naviaxis"
                    className="w-full h-10 px-3.5 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs font-mono text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(settings.upiId);
                      setCopiedUpi(true);
                      setTimeout(() => setCopiedUpi(false), 2000);
                    }}
                    className="absolute right-2 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedUpi ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Customers scan or copy this UPI ID to transfer subscription payments directly.
                </p>
              </div>

              {/* WhatsApp Confirmation Number */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  WhatsApp Payment Confirmation Number *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-emerald-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={settings.whatsappNumber}
                    onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                    placeholder="9539933265"
                    className="w-full h-10 pl-10 pr-3.5 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs font-mono text-white"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  After paying, customer clicks [Send WhatsApp Confirmation] to chat with this number.
                </p>
              </div>

              {/* QR Code Image URL (optional override) */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Custom Static QR Code Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={settings.qrCodeUrl || ''}
                  onChange={(e) => setSettings({ ...settings, qrCodeUrl: e.target.value })}
                  placeholder="https://... (Leave blank to use dynamic UPI QR code generator)"
                  className="w-full h-10 px-3.5 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600"
                />
              </div>

              {/* Bank Coordinates */}
              <div className="pt-4 border-t border-zinc-800/80 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Optional Wire / IMPS Bank Transfer Coordinates</span>
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Account Beneficiary Name</label>
                    <input
                      type="text"
                      value={settings.bankAccountName}
                      onChange={(e) => setSettings({ ...settings, bankAccountName: e.target.value })}
                      className="w-full h-10 px-3.5 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Bank Name</label>
                    <input
                      type="text"
                      value={settings.bankName}
                      onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                      className="w-full h-10 px-3.5 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Account Number</label>
                    <input
                      type="text"
                      value={settings.bankAccountNumber}
                      onChange={(e) => setSettings({ ...settings, bankAccountNumber: e.target.value })}
                      className="w-full h-10 px-3.5 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">IFSC Code</label>
                    <input
                      type="text"
                      value={settings.bankIfsc}
                      onChange={(e) => setSettings({ ...settings, bankIfsc: e.target.value })}
                      className="w-full h-10 px-3.5 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs font-mono text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 flex justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-md shadow-blue-600/20"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingSettings ? 'Saving...' : 'Save Payment Coordinates'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Rejection Reason Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121724] border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white">Reject Manual Payment</h3>
              <button onClick={() => setRejectModalOpen(false)} className="text-zinc-500 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Reason for Rejection *
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. UTR number not found in bank statement, amount mismatch, duplicate submission"
                  className="w-full p-3 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId !== null}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
