'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { SubscriptionPlan } from '@/types';
import {
  Check,
  Sparkles,
  Zap,
  Building,
  ShieldCheck,
  ArrowRight,
  Send,
  Loader2,
  CheckCircle2,
  X,
  CreditCard,
  Smartphone,
} from 'lucide-react';
import CompletePaymentModal from './CompletePaymentModal';


interface PricingViewProps {
  embedded?: boolean; // If true, render without full-screen container
  onPlanSelected?: (plan: SubscriptionPlan) => void;
}

const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_1m',
    name: 'Basic',
    durationMonths: 1,
    priceINR: 299,
    pdfDownloadLimit: 30,
    description: 'Full monthly access to commercial billing & quotations.',
    features: [
      '30 Total PDF downloads',
      'All curated design templates',
      'Instant Quotation to Invoice conversion',
      'Custom logo & business branding',
      'Client & Item catalog management',
    ],
    isActive: true,
  },
  {
    id: 'plan_3m',
    name: 'Standard',
    durationMonths: 3,
    priceINR: 849,
    pdfDownloadLimit: 90,
    description: 'Quarterly subscription with significant savings.',
    features: [
      '90 Total PDF downloads',
      'Everything in Basic plan',
      'Priority email & chat support',
      'Full financial calculation suite',
      'Quarterly billing cycle',
    ],
    isPopular: true,
    isActive: true,
  },
  {
    id: 'plan_6m',
    name: 'Premium',
    durationMonths: 6,
    priceINR: 1699,
    pdfDownloadLimit: 180,
    description: 'Half-yearly plan with maximum commercial savings.',
    features: [
      '180 Total PDF downloads',
      'Everything in Standard plan',
      'Custom terms & conditions presets',
      'Maximum savings on billing',
      'VIP onboarding assistance',
    ],
    isActive: true,
  },
  {
    id: 'plan_custom',
    name: 'Custom Plan',
    durationMonths: 12,
    priceINR: 0,
    pdfDownloadLimit: 0,
    description: 'Custom duration, high-volume documents, and enterprise invoicing.',
    features: [
      'Configurable PDF download limits',
      'Tailored contract duration',
      'Multiple users & branch offices',
      'Custom ERP/CRM integrations',
      'Dedicated account manager',
    ],
    isCustom: true,
    isActive: true,
  },
];

export default function PricingView({ embedded = false, onPlanSelected }: PricingViewProps) {
  const {
    currentUser,
    setAuthModalOpen,
    setAuthMode,
    subscription,
    refreshSubscription,
    setCurrentView,
    plans: contextPlans,
  } = useApp();

  const [plans, setPlans] = useState<SubscriptionPlan[]>(
    contextPlans && contextPlans.length > 0 ? contextPlans : DEFAULT_PLANS
  );
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<SubscriptionPlan | null>(null);
  const [customModalOpen, setCustomModalOpen] = useState(false);

  const [customSubmitted, setCustomSubmitted] = useState(false);
  const [customForm, setCustomForm] = useState({
    name: '',
    businessName: '',
    email: '',
    phone: '',
    duration: '1 Year',
    requirements: '',
  });
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  // Sync with contextPlans whenever context updates
  useEffect(() => {
    if (contextPlans && contextPlans.length > 0) {
      setPlans(contextPlans);
      setIsLoading(false);
    }
  }, [contextPlans]);

  // Fetch plans from database API as fallback or fresh sync
  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      if (!contextPlans || contextPlans.length === 0) {
        setIsLoading(true);
      }
      const res = await fetch('/api/billing/plans');
      const data = await res.json();
      if (data.plans && data.plans.length > 0) {
        setPlans(data.plans);
      }
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (plan.isCustom) {
      setCustomForm({
        name: currentUser?.name || '',
        businessName: currentUser?.businessName || '',
        email: currentUser?.email || '',
        phone: '',
        duration: '1 Year',
        requirements: '',
      });
      setCustomSubmitted(false);
      setCustomModalOpen(true);
      return;
    }

    if (!currentUser) {
      setAuthMode('signup');
      setAuthModalOpen(true);
      return;
    }

    if (onPlanSelected) {
      onPlanSelected(plan);
      return;
    }

    // Open clean manual payment & WhatsApp confirmation modal
    setSelectedPlanForPayment(plan);
  };


  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingCustom(true);
    try {
      const res = await fetch('/api/billing/custom-plan-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customForm),
      });
      if (res.ok) {
        setCustomSubmitted(true);
      } else {
        alert('Could not submit request. Please try again.');
      }
    } catch (err) {
      alert('Network error. Please try again.');
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  return (
    <div className={`w-full font-sans ${embedded ? '' : 'py-12 md:py-20 px-4 md:px-8 max-w-7xl mx-auto'}`}>
      {/* Header */}
      <div className="text-center space-y-3 mb-10 md:mb-14">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Simple, Transparent Pricing</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
          Choose the Perfect Plan for Your Business
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Every new account includes a <strong className="text-slate-900 dark:text-white font-bold">7-Day Free Trial</strong> (2 PDF downloads included). Upgrade anytime to unlock <strong className="text-blue-600 dark:text-blue-400 font-bold">higher PDF quotas (up to 180 PDFs)</strong> and multi-format commercial billing.
        </p>
      </div>

      {checkoutNotice && (
        <div className="max-w-md mx-auto mb-8 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span className="font-medium">{checkoutNotice}</span>
        </div>
      )}

      {/* Pricing Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs text-slate-500">Loading plans...</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {plans.map((plan) => {
            const isCurrent = subscription?.planId === plan.id && subscription?.status === 'ACTIVE';
            const isPopular = plan.isPopular;

            return (

              <div
                key={plan.id}
                className={`relative rounded-2xl flex flex-col justify-between transition-all duration-200 ${
                  isPopular
                    ? 'bg-white dark:bg-zinc-900 border-2 border-blue-600 shadow-xl shadow-blue-500/10 lg:-translate-y-2'
                    : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700'
                } p-6`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider rounded-full shadow-md flex items-center gap-1">
                    <Zap className="w-3 h-3 fill-current" />
                    <span>Most Popular</span>
                  </div>
                )}

                <div>
                  {/* Title & Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {plan.name}
                    </h3>
                    {plan.isCustom ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                        Enterprise
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                        {plan.durationMonths} {plan.durationMonths === 1 ? 'Month' : 'Months'}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-zinc-400 min-h-[32px] leading-relaxed mb-4">
                    {plan.description}
                  </p>

                  {/* Price Header */}
                  <div className="pb-4 mb-5 border-b border-slate-100 dark:border-zinc-800">
                    {plan.isCustom ? (
                      <div>
                        <span className="text-3xl font-extrabold text-slate-950 dark:text-white">Custom</span>
                        <p className="text-[11px] text-slate-500 mt-1">Tailored duration & invoicing</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-extrabold text-slate-950 dark:text-white">
                            ₹{plan.priceINR.toLocaleString('en-IN')}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            / {plan.durationMonths === 1 ? 'mo' : `${plan.durationMonths} mos`}
                          </span>
                        </div>
                        {plan.durationMonths > 1 && (
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                            Approx. ₹{Math.round(plan.priceINR / plan.durationMonths)} / month
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Features List */}
                  <div className="space-y-2.5 mb-6">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
                      What&apos;s Included:
                    </p>
                    <ul className="space-y-2 text-xs text-slate-700 dark:text-zinc-300">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="pt-2">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full h-11 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-default"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Current Active Plan</span>
                    </button>
                  ) : plan.isCustom ? (
                    <button
                      onClick={() => handleSelectPlan(plan)}
                      className="w-full h-11 bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <Building className="w-3.5 h-3.5" />
                      <span>Contact Sales</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(plan)}
                      className={`w-full h-11 font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 ${
                        isPopular
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/25'
                          : 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900'
                      }`}
                    >
                      {currentUser ? (
                        <>
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Pay via UPI / Bank</span>
                        </>
                      ) : (
                        <>
                          <span>Start 7-Day Free Trial</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trust & Security Footnote */}
      <div className="mt-12 text-center flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 dark:text-zinc-500">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Direct UPI & Bank Transfer Supported</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-blue-500" />
          <span>Full access to existing records even if subscription ends</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>Instant Admin & WhatsApp Verification</span>
        </div>
      </div>


      {/* Custom Plan Inquiry Modal */}
      {customModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setCustomModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {customSubmitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 dark:text-white">
                  Request Received!
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Thank you for reaching out. Our team will review your business requirements and contact you within 24 business hours with a custom arrangement.
                </p>
                <button
                  onClick={() => setCustomModalOpen(false)}
                  className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCustomSubmit} className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                    <Building className="w-5 h-5 text-blue-600" />
                    <span>Request Custom Plan</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Need annual billing, custom team seats, or custom procurement? Send us your requirements.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customForm.name}
                      onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Business Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customForm.businessName}
                      onChange={(e) => setCustomForm({ ...customForm, businessName: e.target.value })}
                      placeholder="e.g. Apex Interiors Pvt Ltd"
                      className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={customForm.email}
                      onChange={(e) => setCustomForm({ ...customForm, email: e.target.value })}
                      placeholder="rahul@apexinteriors.com"
                      className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={customForm.phone}
                      onChange={(e) => setCustomForm({ ...customForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Desired Subscription Duration
                  </label>
                  <select
                    value={customForm.duration}
                    onChange={(e) => setCustomForm({ ...customForm, duration: e.target.value })}
                    className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                  >
                    <option value="1 Year (12 Months)">1 Year (12 Months)</option>
                    <option value="2 Years (24 Months)">2 Years (24 Months)</option>
                    <option value="Multi-Year Corporate Contract">Multi-Year Corporate Contract</option>
                    <option value="Other / Custom Term">Other / Custom Term</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Specific Requirements or Team Size
                  </label>
                  <textarea
                    rows={3}
                    value={customForm.requirements}
                    onChange={(e) => setCustomForm({ ...customForm, requirements: e.target.value })}
                    placeholder="Tell us about your team size, expected document volume, or special invoicing needs..."
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCustom}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmittingCustom ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Submit Inquiry</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Complete Payment Modal */}
      {selectedPlanForPayment && (
        <CompletePaymentModal
          plan={selectedPlanForPayment}
          isOpen={Boolean(selectedPlanForPayment)}
          onClose={() => setSelectedPlanForPayment(null)}
          onSuccess={() => {
            fetchPlans();
          }}
        />
      )}
    </div>
  );
}

