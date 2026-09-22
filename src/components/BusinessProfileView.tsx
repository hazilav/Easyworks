'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  Building2,
  Save,
  CheckCircle2,
  CreditCard,
  Percent,
  Check,
} from 'lucide-react';
import { CURRENCY_SYMBOLS } from '@/lib/calculator';

export default function BusinessProfileView() {
  const { business, updateBusiness } = useApp();
  const [formData, setFormData] = useState(business);
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateBusiness(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-purple-500" />
              Business Profile & Settings
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-zinc-400 font-normal mt-1">
              These details automatically populate in your quotations, invoices, and exported PDFs.
            </p>
          </div>

          <button
            onClick={handleSubmit}
            className="h-10 px-5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{isSaved ? 'Settings Saved' : 'Save Profile'}</span>
          </button>
        </div>

        {isSaved && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Business settings saved successfully!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Information Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 space-y-4 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span>Company Information</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Business / Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Tagline or Subtitle
                </label>
                <input
                  type="text"
                  value={formData.tagline || ''}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Contact / Owner Name
                </label>
                <input
                  type="text"
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  GST / VAT / Tax ID
                </label>
                <input
                  type="text"
                  value={formData.taxNumber || ''}
                  onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                  placeholder="32AABCE1234F1Z5"
                  className="h-10 w-full font-mono bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Office / Workshop Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Quotation Defaults Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 space-y-4 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <Percent className="w-4 h-4 text-blue-500" />
              <span>Document Defaults & Currency</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Default Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 text-xs font-semibold"
                >
                  {Object.keys(CURRENCY_SYMBOLS).map((c) => (
                    <option key={c} value={c}>
                      {c} ({CURRENCY_SYMBOLS[c]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Default Tax (GST / VAT %)
                </label>
                <input
                  type="number"
                  value={formData.defaultTaxPercentage}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultTaxPercentage: parseFloat(e.target.value) || 0 })
                  }
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Validity Period (Days)
                </label>
                <input
                  type="number"
                  value={formData.defaultValidityDays}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultValidityDays: parseInt(e.target.value, 10) || 15 })
                  }
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Default Payment Terms
                </label>
                <input
                  type="text"
                  value={formData.defaultPaymentTerms}
                  onChange={(e) => setFormData({ ...formData, defaultPaymentTerms: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Terms & Conditions (Footer of PDF)
                </label>
                <textarea
                  rows={3}
                  value={formData.termsAndConditions}
                  onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
