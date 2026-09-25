'use client';

import React from 'react';
import { Layers, FileText, CheckCircle2, Sparkles, Check } from 'lucide-react';

export default function DeveloperTemplatesView() {
  const templates = [
    {
      id: 'modern',
      name: 'Modern Executive',
      badge: 'Popular',
      desc: 'High-impact blue header bar, structured metric blocks, and crisp typography. Ideal for tech, creative agencies, and modern contractors.',
      type: 'Quotation & Invoice',
      status: 'Active',
      features: [
        'Branded top accent bar',
        'Clean tabular line items with alternating rows',
        'Structured customer & tax summary boxes',
        'Direct download & print support',
      ],
    },
    {
      id: 'classic',
      name: 'Corporate Classic',
      badge: 'Formal',
      desc: 'Traditional deep charcoal header banner, formal corporate layout, and bordered grid table. Best for established firms, engineering, and legal services.',
      type: 'Quotation & Invoice',
      status: 'Active',
      features: [
        'Formal corporate header block',
        'Framed tables and clear tax breakdowns',
        'Dedicated authorized stamp & signatory space',
        'Formal commercial terms layout',
      ],
    },
    {
      id: 'minimalist',
      name: 'Minimalist Clean',
      badge: 'Contemporary',
      desc: 'Refined whitespace, uncluttered single-line hierarchy, and subtle dividing rules. Designed for freelancers, architects, and consultancies.',
      type: 'Quotation & Invoice',
      status: 'Active',
      features: [
        'Minimalist typography and subtle dividers',
        'Lightweight borderless table design',
        'Compact summary and payment bank notes',
        'Optimized for fast rendering and mobile PDF reading',
      ],
    },
    {
      id: 'executive_invoice',
      name: 'Executive Tax Invoice',
      badge: 'Tax Compliant',
      desc: 'Full GST tax invoice with dedicated HSN/SAC code columns, CGST, SGST, IGST calculations, and bank UPI QR code box.',
      type: 'Invoice Only',
      status: 'Active',
      features: [
        'GSTIN and place of supply columns',
        'Tax summary with CGST/SGST/IGST breakdown',
        'Direct bank transfer and UPI QR section',
        'Official authorized signatory signature box',
      ],
    },
    {
      id: 'compact_bill',
      name: 'Compact Retail Bill',
      badge: 'Fast Billing',
      desc: 'High-density layout designed for quick retail sales, itemized hardware sales, and instant cash/UPI receipt generation.',
      type: 'Invoice Only',
      status: 'Active',
      features: [
        'High-density item lines',
        'Instant cash/UPI payment status pill',
        'Compact single-page thermal/A4 printing',
        'Customer terms & return policy footer',
      ],
    },
    {
      id: 'turnkey_contract',
      name: 'Turnkey Contract Quotation',
      badge: 'Comprehensive',
      desc: 'Multi-section commercial tender quotation with milestone payment schedules, scope of works, and warranty declarations.',
      type: 'Quotation Only',
      status: 'Active',
      features: [
        'Milestone payment stages schedule',
        'Detailed scope and exclusions block',
        'Validity term and advance payment clause',
        'Client signature acceptance block',
      ],
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19] text-zinc-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Design Library
              </span>
              <span className="text-xs text-zinc-400">• Curated Document Engines</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Document Templates</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Engineered document layouts available to active subscribers for generating quotes and invoices.
            </p>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-2xl border border-zinc-800 bg-[#121724] p-5 flex flex-col justify-between shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {tpl.badge}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {tpl.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white tracking-tight">{tpl.name}</h3>
                <span className="text-[11px] font-mono text-zinc-400">{tpl.type}</span>
                <p className="text-xs text-zinc-400 mt-2 min-h-[48px]">{tpl.desc}</p>

                <div className="space-y-1.5 pt-3 border-t border-zinc-800/80 mt-4">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    Layout Capabilities:
                  </span>
                  {tpl.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-xs text-zinc-300">
                      <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                <span className="font-mono text-[11px]">ID: {tpl.id}</span>
                <span className="text-blue-400 font-semibold text-[11px]">Available to all tiers</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
