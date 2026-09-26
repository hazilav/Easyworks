'use client';

import React, { useState, useEffect } from 'react';
import { SubscriptionPlan, PaymentSettings } from '@/types';
import { useApp } from '@/context/AppContext';
import {
  X,
  Copy,
  Check,
  QrCode,
  Building,
  Smartphone,
  MessageSquare,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { safeFetchJson } from '@/lib/api/client';

interface CompletePaymentModalProps {
  plan: SubscriptionPlan;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CompletePaymentModal({
  plan,
  isOpen,
  onClose,
  onSuccess,
}: CompletePaymentModalProps) {
  const { currentUser, refreshSubscription, setCurrentView } = useApp();

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    id: 'default',
    upiId: '9539933265@naviaxis',
    qrCodeUrl: '',
    bankAccountName: 'Easyworks Cloud Solutions',
    bankName: 'HDFC Bank',
    bankAccountNumber: '50200088991122',
    bankIfsc: 'HDFC0001234',
    bankBranch: 'Indiranagar Branch, Bengaluru',
    whatsappNumber: '919876543210',
    updatedAt: '',
  });

  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [activeTab, setActiveTab] = useState<'upi' | 'bank'>('upi');

  // Form states
  const [utrNumber, setUtrNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [screenshotFileName, setScreenshotFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Copy states
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPaymentSettings();
      setIsSubmitted(false);
      setErrorMessage(null);
      setUtrNumber('');
      setNotes('');
      setScreenshotDataUrl(null);
      setScreenshotFileName(null);
    }
  }, [isOpen]);

  const fetchPaymentSettings = async () => {
    try {
      setIsLoadingSettings(true);
      const { data } = await safeFetchJson<{ success?: boolean; settings?: PaymentSettings }>('/api/billing/payment-settings');
      if (data?.success && data?.settings) {
        setPaymentSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to load payment settings:', err);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  if (!isOpen) return null;

  const copyToClipboard = (text: string, type: 'upi' | 'bank') => {
    navigator.clipboard.writeText(text);
    if (type === 'upi') {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } else {
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Screenshot file size must be less than 5MB.');
      return;
    }

    setScreenshotFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const getWhatsAppUrl = () => {
    const rawNumber = paymentSettings.whatsappNumber.replace(/[^0-9]/g, '');
    const cleanNumber = rawNumber.startsWith('91') ? rawNumber : `91${rawNumber}`;

    const text = `Hello, I have made the payment for the Easyworks subscription.
Plan: ${plan.name}
Amount: ₹${plan.priceINR}
Name: ${currentUser?.name || 'User'}
Business: ${currentUser?.businessName || 'N/A'}
Email: ${currentUser?.email || ''}
Transaction ID / UTR: ${utrNumber.trim() ? utrNumber.trim() : '[Attached in screenshot]'}
Please activate my account.`;

    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;
  };

  const handleSubmitConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrNumber.trim()) {
      setErrorMessage('Please enter the Transaction ID / UTR number.');
      return;
    }

    if (!currentUser) {
      setErrorMessage('User session not found. Please log in.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const { ok, data, error } = await safeFetchJson<{ success?: boolean; error?: string }>('/api/billing/manual-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          planId: plan.id,
          utrNumber: utrNumber.trim(),
          screenshotUrl: screenshotDataUrl,
          notes: notes.trim() || undefined,
        }),
      });

      if (!ok || !data?.success) {
        throw new Error(data?.error || error || 'Failed to submit payment confirmation');
      }

      await refreshSubscription();
      setIsSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error submitting payment confirmation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // UPI deep link
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(
    paymentSettings.upiId
  )}&pn=Easyworks&am=${plan.priceINR}&cu=INR`;

  // QR Code URL: use admin custom QR or dynamic public QR generator
  const qrCodeDisplayUrl =
    paymentSettings.qrCodeUrl && paymentSettings.qrCodeUrl.trim().length > 0
      ? paymentSettings.qrCodeUrl
      : `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
          upiDeepLink
        )}`;

  const bankDetailsCopyText = `Account Name: ${paymentSettings.bankAccountName}
Bank: ${paymentSettings.bankName}
Account Number: ${paymentSettings.bankAccountNumber}
IFSC Code: ${paymentSettings.bankIfsc}
Branch: ${paymentSettings.bankBranch}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold">Complete Your Payment</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Plan Summary Banner */}
        <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Selected Subscription
            </div>
            <div className="text-xl font-extrabold text-slate-900">{plan.name} Plan</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-indigo-700">₹{plan.priceINR}</div>
            <div className="text-xs font-medium text-emerald-600 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> {plan.pdfDownloadLimit ? `${plan.pdfDownloadLimit} PDF Downloads Included` : 'PDF Downloads Included'}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {isSubmitted ? (
            /* Success State */
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-2xl font-extrabold text-slate-900">Payment Submitted!</h4>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Your payment confirmation (UTR: <strong className="text-slate-900 font-mono">{utrNumber}</strong>)
                has been received and is currently under review.
              </p>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="w-4 h-4" /> Subscription Status: PAYMENT_PENDING
                </div>
                <div>
                  Our team will verify your payment details and activate your subscription shortly.
                  For instant priority verification, send a quick message to our team on WhatsApp.
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={getWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-500/20 transition-all text-sm"
                >
                  <MessageSquare className="w-4 h-4" /> Confirm on WhatsApp
                </a>
                <button
                  onClick={() => {
                    onClose();
                    setCurrentView('billing');
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl transition-all text-sm"
                >
                  <FileText className="w-4 h-4" /> View Billing Page
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Payment Method Selector Tabs */}
              <div className="flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('upi')}
                  className={`flex-1 pb-3 text-sm font-bold border-b-2 flex items-center justify-center gap-2 transition-colors ${
                    activeTab === 'upi'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Smartphone className="w-4 h-4" /> UPI Payment & QR Code
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('bank')}
                  className={`flex-1 pb-3 text-sm font-bold border-b-2 flex items-center justify-center gap-2 transition-colors ${
                    activeTab === 'bank'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Building className="w-4 h-4" /> Bank Account Transfer
                </button>
              </div>

              {/* UPI Tab */}
              {activeTab === 'upi' && (
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex flex-col items-center justify-center p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                      <img
                        src={qrCodeDisplayUrl}
                        alt="Scan UPI QR Code"
                        className="w-44 h-44 object-contain rounded"
                      />
                      <span className="text-[11px] font-semibold text-slate-500 mt-2 flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5" /> Scan with any UPI App
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500">Business UPI ID</label>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 font-mono text-sm font-bold text-slate-900 bg-white px-3 py-2 rounded-lg border border-slate-300 select-all">
                            {paymentSettings.upiId}
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(paymentSettings.upiId, 'upi')}
                            className="p-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold shrink-0"
                            title="Copy UPI ID"
                          >
                            {copiedUpi ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 leading-relaxed">
                        Payable Amount:{' '}
                        <strong className="text-slate-900 text-sm font-extrabold">
                          ₹{plan.priceINR}
                        </strong>
                      </div>

                      {/* Direct UPI Intent Link for Mobile */}
                      <a
                        href={upiDeepLink}
                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                      >
                        <Smartphone className="w-3.5 h-3.5" /> Pay via UPI App (PhonePe / GPay / Paytm)
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Bank Transfer Tab */}
              {activeTab === 'bank' && (
                <div className="space-y-4 pt-1">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                      <span className="font-semibold text-slate-500">Account Name:</span>
                      <strong className="font-bold text-slate-900 select-all">
                        {paymentSettings.bankAccountName}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                      <span className="font-semibold text-slate-500">Bank Name:</span>
                      <strong className="font-bold text-slate-900 select-all">
                        {paymentSettings.bankName}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                      <span className="font-semibold text-slate-500">Account Number:</span>
                      <strong className="font-mono font-bold text-slate-900 select-all">
                        {paymentSettings.bankAccountNumber}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                      <span className="font-semibold text-slate-500">IFSC Code:</span>
                      <strong className="font-mono font-bold text-slate-900 select-all">
                        {paymentSettings.bankIfsc}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-500">Branch:</span>
                      <strong className="font-medium text-slate-900 select-all">
                        {paymentSettings.bankBranch}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(bankDetailsCopyText, 'bank')}
                    className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 transition-colors"
                  >
                    {copiedBank ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Bank Details Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Bank Details
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* WhatsApp Fast Confirmation Banner */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5 text-left">
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-600" /> WhatsApp Quick Confirmation
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Send your screenshot and transaction reference on WhatsApp for faster verification.
                  </div>
                </div>
                <a
                  href={getWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shrink-0 shadow-sm transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Confirm on WhatsApp <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Confirmation Form */}
              <form onSubmit={handleSubmitConfirmation} className="space-y-4 pt-2">
                <div className="border-t border-slate-200 pt-4">
                  <h4 className="text-sm font-bold text-slate-900 mb-1">
                    Submit Payment Confirmation Form
                  </h4>
                  <p className="text-xs text-slate-500 mb-3">
                    Enter your Transaction ID or UTR number below after completing your transfer.
                  </p>

                  {errorMessage && (
                    <div className="p-3 mb-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    {/* UTR Input */}
                    <div>
                      <label className="block text-xs font-bold text-black mb-1">
                        Transaction ID / UTR Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={utrNumber}
                        onChange={(e) => setUtrNumber(e.target.value)}
                        placeholder="e.g. 423984712948 or UPI Ref No."
                        className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white text-black placeholder:text-slate-400"
                      />
                    </div>

                    {/* Screenshot Upload */}
                    <div>
                      <label className="block text-xs font-bold text-black mb-1">
                        Payment Screenshot (Optional but recommended)
                      </label>
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-black text-xs font-semibold rounded-lg border border-slate-300 transition-colors">
                          <Upload className="w-3.5 h-3.5 text-slate-500" />
                          <span>Choose Screenshot</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                        {screenshotFileName && (
                          <span className="text-xs text-black truncate max-w-xs font-mono">
                            {screenshotFileName}
                          </span>
                        )}
                      </div>
                      {screenshotDataUrl && (
                        <div className="mt-2 relative inline-block border border-slate-200 rounded-lg overflow-hidden">
                          <img
                            src={screenshotDataUrl}
                            alt="Screenshot preview"
                            className="h-20 w-auto object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setScreenshotDataUrl(null);
                              setScreenshotFileName(null);
                            }}
                            className="absolute top-1 right-1 p-1 bg-slate-900/80 hover:bg-red-600 text-white rounded-full transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-xs font-semibold text-black mb-1">
                        Notes / Remarks (Optional)
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any additional details (e.g. sender bank or name)"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white text-black placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" /> Submit Payment Confirmation
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
