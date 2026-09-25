'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { PaymentRecord, SubscriptionPlan, ManualPaymentRequest } from '@/types';
import PricingView from '@/components/PricingView';
import { generatePaymentReceiptPDF } from '@/lib/receiptGenerator';
import { safeFetchJson } from '@/lib/api/client';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Calendar,
  Sparkles,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Receipt,
  FileText,
  ChevronRight,
  Check,
  Loader2,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';

export default function BillingView() {
  const {
    currentUser,
    business,
    subscription,
    refreshSubscription,
    setCurrentView,
  } = useApp();

  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [manualRequests, setManualRequests] = useState<ManualPaymentRequest[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showUpgradePlans, setShowUpgradePlans] = useState(false);

  useEffect(() => {
    fetchPaymentHistory();
  }, [currentUser]);

  const fetchPaymentHistory = async () => {
    if (!currentUser) return;
    try {
      setIsLoadingHistory(true);
      // Fetch subscription payments
      const { data } = await safeFetchJson<{ payments?: PaymentRecord[] }>(`/api/billing/subscription?userId=${currentUser.id}`);
      if (data?.payments) {
        setPaymentHistory(data.payments);
      }

      // Fetch manual payment requests
      const { data: mData } = await safeFetchJson<{ requests?: ManualPaymentRequest[] }>(`/api/billing/manual-payment?userId=${currentUser.id}`);
      if (mData?.requests) {
        setManualRequests(mData.requests);
      }
    } catch (err) {
      console.error('Failed to fetch payment history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDownloadReceipt = async (record: PaymentRecord) => {
    try {
      setDownloadingId(record.id);
      const doc = generatePaymentReceiptPDF({
        payment: record,
        subscription,
        user: currentUser
          ? {
              name: currentUser.name,
              email: currentUser.email,
              businessName: currentUser.businessName || business.businessName,
            }
          : null,
      });
      doc.save(`Easyworks_Receipt_${record.receiptNumber}.pdf`);
    } catch (err) {
      alert('Error generating PDF receipt: ' + String(err));
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = () => {
    if (!subscription) return null;
    switch (subscription.status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Active Subscription</span>
          </span>
        );
      case 'PAYMENT_PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span>Payment Pending Verification</span>
          </span>
        );
      case 'PAYMENT_REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-400 border border-red-300 dark:border-red-800">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Payment Rejected</span>
          </span>
        );
      case 'TRIALING':
      case 'TRIAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Free Trial ({subscription.trialDaysRemaining ?? 0} {subscription.trialDaysRemaining === 1 ? 'day' : 'days'} left)
            </span>
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Trial Expired</span>
          </span>
        );
      case 'PAST_DUE':
      case 'PAYMENT_FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Past Due</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            <span>Cancelled</span>
          </span>
        );
      default:
        return null;
    }
  };


  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0c0e12] font-sans">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                Subscription & Billing
              </h1>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Manage your plan, check renewal dates, and access past payment receipts.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                refreshSubscription();
                fetchPaymentHistory();
              }}
              title="Refresh status"
              className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowUpgradePlans(!showUpgradePlans)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{showUpgradePlans ? 'Hide Plans' : 'Change or Upgrade Plan'}</span>
            </button>
          </div>
        </div>

        {/* Current Plan Overview Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Plan Info */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Current Plan
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {subscription?.status === 'ACTIVE'
                  ? 'Active Plan'
                  : subscription?.status === 'PAYMENT_PENDING'
                  ? 'Payment Pending'
                  : subscription?.status === 'PAYMENT_REJECTED'
                  ? 'Payment Rejected'
                  : subscription?.status === 'TRIALING' || subscription?.status === 'TRIAL'
                  ? 'Free Trial'
                  : 'Subscription Expired'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {subscription?.status === 'ACTIVE'
                  ? (subscription?.plan?.name || 'Easyworks Pro') + ' — Full commercial license.'
                  : subscription?.status === 'PAYMENT_PENDING'
                  ? 'Your payment confirmation has been submitted and is awaiting admin approval.'
                  : subscription?.status === 'PAYMENT_REJECTED'
                  ? 'Your manual payment submission was rejected. Please review details and resubmit.'
                  : '7-Day full access trial to explore templates and document creation.'}
              </p>
            </div>

            {/* Dates & Status */}
            <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-100 dark:border-zinc-800 md:pl-6 pt-4 md:pt-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Billing Cycle
              </span>
              {subscription?.status === 'ACTIVE' ? (
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    <span>
                      {subscription?.subscriptionEndsAt
                        ? `Renews / Ends: ${formatDate(subscription.subscriptionEndsAt)}`
                        : 'Continuous Pro Access'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Started on: {formatDate(subscription?.subscriptionStartedAt || subscription?.createdAt)}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span>{subscription?.trialDaysRemaining ?? 0} days remaining in trial</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Trial concludes on: {formatDate(subscription?.trialEndsAt)}
                  </p>
                </div>
              )}
            </div>

            {/* PDF Downloads & Document Access Status */}
            {/* PDF Downloads & Document Access Status */}
            <div className="space-y-3 border-t md:border-t-0 md:border-l border-slate-100 dark:border-zinc-800 md:pl-6 pt-4 md:pt-0 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    <span>PDF Downloads</span>
                  </h3>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-zinc-300">
                    {subscription?.pdfDownloadsRemaining ?? 0} remaining
                  </span>
                </div>

                <div className="mt-2 text-xs font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    {subscription?.plan?.name || (subscription?.status === 'TRIALING' ? 'Free Trial' : 'Subscription')}
                  </span>
                  <span className="font-mono text-slate-500 dark:text-zinc-400">
                    {subscription?.pdfDownloadLimit ?? 2} PDF downloads
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-2 w-full h-2.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      (subscription?.pdfDownloadsRemaining ?? 0) <= 0
                        ? 'bg-rose-500'
                        : ((subscription?.pdfDownloadsUsed ?? 0) / Math.max(1, subscription?.pdfDownloadLimit ?? 2)) >= 0.8
                        ? 'bg-amber-500'
                        : 'bg-blue-600'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((subscription?.pdfDownloadsUsed ?? 0) /
                            Math.max(1, subscription?.pdfDownloadLimit ?? 2)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-600 dark:text-zinc-400 font-medium">
                  <span>
                    <strong>{subscription?.pdfDownloadsUsed ?? 0}</strong> used · <strong>{subscription?.pdfDownloadsRemaining ?? 0}</strong> remaining
                  </span>
                  <span className="font-mono">
                    {Math.round(
                      ((subscription?.pdfDownloadsUsed ?? 0) /
                        Math.max(1, subscription?.pdfDownloadLimit ?? 2)) *
                        100
                    )}%
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-2">
                  {(subscription?.pdfDownloadsRemaining ?? 0) <= 0 ? (
                    <span className="text-rose-500 font-semibold">
                      PDF download limit reached. Upgrade or renew your plan to continue.
                    </span>
                  ) : ((subscription?.pdfDownloadsUsed ?? 0) / Math.max(1, subscription?.pdfDownloadLimit ?? 2)) >= 0.8 ? (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      You're close to your PDF limit. {subscription?.pdfDownloadsRemaining ?? 0} downloads remaining.
                    </span>
                  ) : (
                    'Document creation, editing, preview, and saving remain unlimited.'
                  )}
                </p>
              </div>

              {((subscription?.pdfDownloadsRemaining ?? 0) <= 0 || subscription?.status !== 'ACTIVE') && (
                <button
                  onClick={() => setShowUpgradePlans(true)}
                  className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>
                    {(subscription?.pdfDownloadsRemaining ?? 0) <= 0 && subscription?.status === 'ACTIVE'
                      ? 'Renew / Add Quota'
                      : 'Upgrade — Starting ₹299/mo'}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Pending Banner */}
          {subscription?.status === 'PAYMENT_PENDING' && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 animate-pulse" />
                <div>
                  <span className="font-bold">Manual Payment Confirmation Received</span>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Our team is reviewing your transaction reference. Your subscription will be activated upon approval.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUpgradePlans(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs shrink-0 transition-colors"
              >
                View Plans & Methods
              </button>
            </div>
          )}

          {/* Rejected Banner */}
          {subscription?.status === 'PAYMENT_REJECTED' && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-900 dark:text-red-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <div>
                  <span className="font-bold">Payment Verification Incomplete</span>
                  <p className="text-[11px] text-red-700 dark:text-red-400 mt-0.5">
                    The submitted payment details could not be validated. Please check the UTR or resubmit.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUpgradePlans(true)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs shrink-0 transition-colors"
              >
                Resubmit Payment
              </button>
            </div>
          )}
        </div>


        {/* Upgrade Plans Accordion / Section */}
        {showUpgradePlans && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-blue-200 dark:border-blue-900/60 p-6 shadow-md transition-all animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Available Subscription Plans
                </h2>
                <p className="text-xs text-slate-500">
                  Choose a monthly, 3-month, or 6-month plan. Automatic immediate activation.
                </p>
              </div>
              <button
                onClick={() => setShowUpgradePlans(false)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
              >
                Close Plans
              </button>
            </div>
            <PricingView embedded={true} />
          </div>
        )}

        {/* Manual Payment Submissions Table (if any) */}
        {manualRequests.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>Manual Payment Submissions</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Track verification status of your UPI and Bank transfer submissions.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                {manualRequests.length} {manualRequests.length === 1 ? 'Submission' : 'Submissions'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Plan</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Transaction ID / UTR</th>
                    <th className="py-3 px-4">Screenshot</th>
                    <th className="py-3 px-4">Verification Status</th>
                    <th className="py-3 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-700 dark:text-zinc-300">
                  {manualRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-slate-500">{formatDate(req.createdAt)}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">{req.planName}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">₹{req.amountINR}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-zinc-200 select-all">{req.utrNumber}</td>
                      <td className="py-3.5 px-4">
                        {req.screenshotUrl ? (
                          <a
                            href={req.screenshotUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-semibold"
                          >
                            <span>View</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {req.status === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                            <Check className="w-3 h-3" /> Approved & Active
                          </span>
                        ) : req.status === 'REJECTED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-100 text-red-700 border border-red-300">
                            <AlertCircle className="w-3 h-3" /> Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3 animate-pulse" /> In Review
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {req.rejectionReason ? (
                          <span className="text-red-600 font-medium">{req.rejectionReason}</span>
                        ) : req.notes ? (
                          <span>{req.notes}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment History Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-xs">
          <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-600" />
                <span>Payment & Invoicing History</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Download official PDF tax receipts for your business accounting and records.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
              {paymentHistory.length} {paymentHistory.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>

          {isLoadingHistory ? (
            <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Loading payment history...</span>
            </div>
          ) : paymentHistory.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-400 flex items-center justify-center mx-auto">
                <CreditCard className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                No payment transactions yet
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                Once you subscribe or make a payment, your itemized receipts will appear here with downloadable PDFs.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Plan / Description</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-700 dark:text-zinc-300">
                  {paymentHistory.map((rec) => (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                        {rec.receiptNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400">
                        {formatDate(rec.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                        {rec.planName}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        ₹{rec.amountINR.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 capitalize">
                        {rec.paymentMethod || 'Manual UPI/Bank'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                          <Check className="w-3 h-3" />
                          <span>Paid</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDownloadReceipt(rec)}
                          disabled={downloadingId === rec.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          {downloadingId === rec.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Business Invoice Notes */}
        <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              All payments are verified directly. Official PDF tax receipts are generated immediately upon admin confirmation. Need custom invoice billing? Contact support.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

