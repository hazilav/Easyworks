'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { Sparkles, AlertCircle, ArrowRight, X, CheckCircle2, ShieldCheck } from 'lucide-react';

interface TrialExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TrialExpiredModal({ isOpen, onClose }: TrialExpiredModalProps) {
  const { setCurrentView, subscription } = useApp();

  if (!isOpen) return null;

  const isExpired = subscription?.status === 'EXPIRED';

  const handleGoToBilling = () => {
    onClose();
    setCurrentView('billing');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Heading */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-300 dark:border-amber-800 shadow-xs">
            <AlertCircle className="w-6 h-6" />
          </div>

          <h3 className="text-xl font-bold text-slate-950 dark:text-white">
            {isExpired ? 'Free Trial Period Expired' : 'Subscription Required'}
          </h3>

          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed max-w-sm">
            Your 7-day free trial has concluded. All your existing quotations, invoices, clients, and catalog items remain completely safe and viewable.
          </p>
        </div>

        {/* Value Proposition Box */}
        <div className="my-5 p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 text-xs space-y-2.5">
          <div className="font-semibold text-slate-900 dark:text-zinc-200 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Upgrade to Easyworks Pro to unlock:</span>
          </div>
          <ul className="space-y-1.5 text-slate-600 dark:text-zinc-400 pl-1">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Unlimited new quotation & invoice generation</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>High-resolution PDF export with custom branding</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Dedicated customer management & catalog rates</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={handleGoToBilling}
            className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>View Plans & Subscribe</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="w-full h-10 bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-medium rounded-xl transition-colors cursor-pointer"
          >
            Continue viewing existing records
          </button>
        </div>

        {/* Footer Guarantee */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-500">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
          <span>Direct UPI & Bank Transfer • Up to 120 PDF downloads</span>
        </div>

      </div>
    </div>
  );
}
