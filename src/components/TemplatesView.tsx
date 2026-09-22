'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { TemplateStyle } from '@/types';
import {
  Layers,
  FileText,
  Receipt,
  ArrowRight,
  Check,
} from 'lucide-react';

export default function TemplatesView() {
  const { startNewQuotation, startNewInvoice, business } = useApp();
  const [activeTab, setActiveTab] = useState<'quotation' | 'invoice'>('quotation');

  const quotationTemplates = [
    {
      id: 'modern' as TemplateStyle,
      name: 'Modern Executive',
      badge: 'Popular',
      desc: 'High-impact blue header bar, structured metric blocks, and crisp typography. Ideal for tech, creative agencies, and modern contractors.',
      features: [
        'Branded top accent bar',
        'Clean tabular line items with alternating rows',
        'Structured customer & tax summary boxes',
        'Direct download & print support',
      ],
      previewSample: {
        title: 'QUOTATION',
        ref: 'QT-2026-0042',
        client: 'Ahmed Enterprises',
        item: 'Modular Interior Cabinetry',
        amount: '₹ 84,000',
      },
    },
    {
      id: 'classic' as TemplateStyle,
      name: 'Corporate Classic',
      badge: 'Formal',
      desc: 'Traditional deep charcoal header banner, formal corporate layout, and bordered grid table. Best for established firms, engineering, and legal services.',
      features: [
        'Formal corporate header block',
        'Framed tables and clear tax breakdowns',
        'Dedicated authorized stamp & signatory space',
        'Formal commercial terms layout',
      ],
      previewSample: {
        title: 'COMMERCIAL QUOTATION',
        ref: 'QT-2026-0019',
        client: 'ABC Technologies Pvt Ltd',
        item: 'Turnkey Civil & Structural Works',
        amount: '₹ 2,45,000',
      },
    },
    {
      id: 'minimalist' as TemplateStyle,
      name: 'Minimalist Clean',
      badge: 'Contemporary',
      desc: 'Generous whitespace, ultra-thin hairline dividers, clean monochromatic hierarchy. Designed for designers, architects, and creative studios.',
      features: [
        'Lightweight borderless aesthetic',
        'Maximized whitespace for rapid readability',
        'Understated typographic emphasis',
        'Streamlined payment terms footer',
      ],
      previewSample: {
        title: 'ESTIMATE / QUOTE',
        ref: 'QT-2026-0088',
        client: 'Studio Nova Architecture',
        item: 'Identity Design & UI Consulting',
        amount: '₹ 65,000',
      },
    },
  ];

  const invoiceTemplates = [
    {
      id: 'modern' as TemplateStyle,
      name: 'Emerald Modern Invoice',
      badge: 'Standard Invoice',
      desc: 'Bold emerald accents for quick payment recognition, dual totals breakdown, and prominent bank and UPI payment block.',
      features: [
        'Emerald header highlighting invoice status & due date',
        'Clear separation of Amount Paid vs Balance Due',
        'Prominent Bank coordinates & UPI payment box',
        'Itemized line discounts & GST calculations',
      ],
      previewSample: {
        title: 'INVOICE',
        ref: 'INV-2026-0012',
        client: 'Apex Industrial Logistics',
        item: 'Quarterly Maintenance Contract',
        amount: '₹ 42,000',
      },
    },
    {
      id: 'classic' as TemplateStyle,
      name: 'Classic Standard Invoice',
      badge: 'Audit Compliant',
      desc: 'Rigid bordered corporate invoice styling adhering to statutory accounting and GST norms with structured bank coordinates.',
      features: [
        'Formal invoice ledger layout',
        'Auditor-friendly grid table columns',
        'Complete banking IFSC, Account, and SWIFT section',
        'Corporate stamp & authorized signature line',
      ],
      previewSample: {
        title: 'INVOICE',
        ref: 'INV-2026-0005',
        client: 'Global Logistics Hub',
        item: 'Annual Fleet Logistics Service',
        amount: '₹ 1,80,000',
      },
    },
    {
      id: 'minimalist' as TemplateStyle,
      name: 'Clean Slate Invoice',
      badge: 'Sleek & Simple',
      desc: 'Pure typography and hairline styling ensuring all billing items and payment terms stand out with zero visual clutter.',
      features: [
        'Understated monochromatic invoice layout',
        'Hairline table rows with clean alignments',
        'Clear payment instruction callout',
        'Compact summary of total, paid, and balance',
      ],
      previewSample: {
        title: 'INVOICE',
        ref: 'INV-2026-0031',
        client: 'Zenith Ventures',
        item: 'Product Strategy Sprint',
        amount: '₹ 95,000',
      },
    },
  ];

  const currentList = activeTab === 'quotation' ? quotationTemplates : invoiceTemplates;

  const handleUseTemplate = (templateId: TemplateStyle) => {
    if (activeTab === 'quotation') {
      startNewQuotation(templateId);
    } else {
      startNewInvoice(templateId);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Layers className="w-6 h-6 text-purple-500" />
              Document Template Gallery
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-zinc-400 font-normal mt-1">
              Select from professionally formatted designs for your quotations and invoices.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center h-10 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
            <button
              onClick={() => setActiveTab('quotation')}
              className={`h-8 flex items-center space-x-2 px-3.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'quotation'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Quotations (3)</span>
            </button>
            <button
              onClick={() => setActiveTab('invoice')}
              className={`h-8 flex items-center space-x-2 px-3.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'invoice'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Invoices (3)</span>
            </button>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {currentList.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              {/* Card Header & Preview */}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                    {tpl.badge}
                  </span>
                  <span className="text-xs font-mono font-medium text-slate-400">
                    {tpl.id}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {tpl.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-normal mt-1 leading-relaxed">
                    {tpl.desc}
                  </p>
                </div>

                {/* Visual Mini Preview Container */}
                <div
                  className={`border rounded-xl p-4 text-xs space-y-3 ${
                    tpl.id === 'classic'
                      ? 'border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/40'
                      : tpl.id === 'minimalist'
                      ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50'
                      : 'border-slate-200 dark:border-zinc-800 bg-blue-50/20 dark:bg-blue-950/10'
                  }`}
                >
                  <div className="flex justify-between items-start pb-2 border-b border-slate-200 dark:border-zinc-700/60">
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white">
                        {business.businessName || 'EASYWORKS'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{tpl.previewSample.ref}</p>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                        activeTab === 'quotation'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}
                    >
                      {tpl.previewSample.title}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] text-slate-400 uppercase font-medium">
                      Client: <span className="text-slate-800 dark:text-zinc-200 font-semibold">{tpl.previewSample.client}</span>
                    </p>
                    <div className="flex justify-between items-center bg-white dark:bg-zinc-800/80 p-2 rounded-lg border border-slate-100 dark:border-zinc-700/50 text-xs">
                      <span className="truncate pr-2 font-normal text-slate-700 dark:text-zinc-300">{tpl.previewSample.item}</span>
                      <span className="font-bold text-slate-900 dark:text-white shrink-0">
                        {tpl.previewSample.amount}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-zinc-700/60 flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span>Includes Tax & Terms</span>
                    <span className="font-bold text-slate-700 dark:text-zinc-300">
                      Authoritative PDF
                    </span>
                  </div>
                </div>

                {/* Feature Bullets */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                    Design Highlights
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-300">
                    {tpl.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <span className="text-xs font-normal">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="p-6 bg-slate-50 dark:bg-zinc-800/40 border-t border-slate-100 dark:border-zinc-800">
                <button
                  onClick={() => handleUseTemplate(tpl.id)}
                  className={`w-full h-10 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98 ${
                    activeTab === 'quotation'
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                  }`}
                >
                  <span>Use This {activeTab === 'quotation' ? 'Quotation' : 'Invoice'} Template</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
