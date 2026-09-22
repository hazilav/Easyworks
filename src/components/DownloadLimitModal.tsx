'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { FileText, ArrowRight, X, Sparkles, CheckCircle2 } from 'lucide-react';

interface DownloadLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DownloadLimitModal({ isOpen, onClose }: DownloadLimitModalProps) {
  const { setCurrentView } = useApp();

  if (!isOpen) return null;

  const handleUpgrade = () => {
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
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800 shadow-xs">
            <FileText className="w-6 h-6" />
          </div>

          <h3 className="text-xl font-bold text-slate-950 dark:text-white leading-snug">
            You&apos;ve used your 2 free PDF downloads.
          </h3>

          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed max-w-sm">
            Upgrade to Easyworks to unlock unlimited PDF downloads.
          </p>
        </div>

        {/* Value Proposition Box */}
        <div className="my-5 p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 text-xs space-y-2">
          <div className="font-semibold text-slate-900 dark:text-zinc-200 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Always Available in Free Trial:</span>
          </div>
          <ul className="space-y-1.5 text-slate-600 dark:text-zinc-400 pl-1">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Create unlimited quotations & invoices</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Edit, preview, and save documents anytime</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Switch and customize all design templates</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={handleUpgrade}
            className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>Upgrade — ₹249/month</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="w-full h-10 bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-medium rounded-xl transition-colors cursor-pointer"
          >
            Continue creating & saving documents
          </button>
        </div>
      </div>
    </div>
  );
}
