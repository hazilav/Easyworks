'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import {
  FileText,
  Receipt,
  Clock,
  CheckCircle2,
  TrendingUp,
  Plus,
  Download,
  Edit3,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { formatCurrency } from '@/lib/calculator';
import { generateQuotationPDF, generateInvoicePDF } from '@/lib/pdfGenerator';
import { Quotation, Invoice } from '@/types';

export default function DashboardView() {
  const {
    quotations,
    invoices,
    startNewQuotation,
    startNewInvoice,
    editQuotation,
    editInvoice,
    setCurrentView,
    business,
    requestPdfDownload,
  } = useApp();

  const totalQuotations = quotations.length;
  const totalInvoices = invoices.length;
  const draftQuotes = quotations.filter((q) => q.status === 'draft').length;
  const draftInvoices = invoices.filter((i) => i.status === 'draft').length;
  const totalDrafts = draftQuotes + draftInvoices;

  const totalQuotedAmount = quotations.reduce((acc, q) => acc + (q.totals?.grandTotal || 0), 0);
  const totalInvoicedAmount = invoices.reduce((acc, i) => acc + (i.totals?.grandTotal || 0), 0);

  const handleDownloadQuote = async (quote: Quotation) => {
    const allowed = await requestPdfDownload('quotation', quote.id);
    if (!allowed) return;
    const doc = generateQuotationPDF(quote, business);
    doc.save(`${quote.quotationNumber}.pdf`);
  };

  const handleDownloadInvoice = async (inv: Invoice) => {
    const allowed = await requestPdfDownload('invoice', inv.id);
    if (!allowed) return;
    const doc = generateInvoicePDF(inv, business);
    doc.save(`${inv.invoiceNumber}.pdf`);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header with Consistent Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Document Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 font-normal mt-1">
              Create, track, and manage commercial quotations, invoices, and client billing.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => startNewQuotation()}
              className="flex-1 sm:flex-none h-10 px-3.5 sm:px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Create Quotation</span>
            </button>

            <button
              onClick={() => startNewInvoice()}
              className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-emerald-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>Create Invoice</span>
            </button>
          </div>
        </div>

        {/* Metric KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            onClick={() => setCurrentView('quotations')}
            className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs hover:border-blue-300 dark:hover:border-blue-900 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-medium">Total Quotations</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalQuotations}</p>
              <p className="text-[11px] font-normal text-slate-400 mt-1">
                Value: {formatCurrency(totalQuotedAmount, business.currency)}
              </p>
            </div>
          </div>

          <div
            onClick={() => setCurrentView('invoices')}
            className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-900 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-medium">Total Invoices</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalInvoices}</p>
              <p className="text-[11px] font-normal text-slate-400 mt-1">
                Billed: {formatCurrency(totalInvoicedAmount, business.currency)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-medium">Draft Documents</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totalDrafts}</p>
              <p className="text-[11px] font-normal text-slate-400 mt-1">
                {draftQuotes} quotes • {draftInvoices} invoices
              </p>
            </div>
          </div>

          <div
            onClick={() => setCurrentView('templates')}
            className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs hover:border-purple-300 dark:hover:border-purple-900 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-medium">Design Templates</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">6 Styles</p>
              <p className="text-[11px] font-medium text-purple-600 dark:text-purple-400 mt-1">
                Modern, Classic, Minimalist →
              </p>
            </div>
          </div>
        </div>

        {/* Two Tables Side-by-Side: Recent Quotations & Recent Invoices */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Quotations Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <FileText className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Recent Quotations
                </h2>
              </div>
              <button
                onClick={() => setCurrentView('quotations')}
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View All ({quotations.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {quotations.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 space-y-2 flex-1 flex flex-col items-center justify-center">
                <FileText className="w-8 h-8 text-slate-300 dark:text-zinc-700" />
                <p className="font-semibold text-slate-600 dark:text-zinc-400">
                  No quotations created yet
                </p>
                <button
                  onClick={() => startNewQuotation()}
                  className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  + Create your first quotation
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                {quotations.slice(0, 5).map((q) => (
                  <div
                    key={q.id}
                    className="p-4 hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 flex items-center justify-between transition-colors text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-blue-600 dark:text-blue-400">
                          {q.quotationNumber}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${
                            q.status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {q.status}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-white mt-1">
                        {q.customer.name || 'Customer'}
                      </p>
                      <p className="text-[11px] font-normal text-slate-400 mt-0.5">
                        {q.date} • {q.items.length} items
                      </p>
                    </div>

                    <div className="text-right space-y-1.5">
                      <p className="font-bold text-slate-900 dark:text-white text-xs">
                        {formatCurrency(q.totals.grandTotal, q.currency)}
                      </p>
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => editQuotation(q)}
                          className="h-7 px-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDownloadQuote(q)}
                          className="h-7 w-7 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-blue-600 rounded-lg text-slate-400 cursor-pointer transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Invoices Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Receipt className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Recent Invoices
                </h2>
              </div>
              <button
                onClick={() => setCurrentView('invoices')}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View All ({invoices.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {invoices.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 space-y-2 flex-1 flex flex-col items-center justify-center">
                <Receipt className="w-8 h-8 text-slate-300 dark:text-zinc-700" />
                <p className="font-semibold text-slate-600 dark:text-zinc-400">
                  No invoices created yet
                </p>
                <button
                  onClick={() => startNewInvoice()}
                  className="text-xs text-emerald-600 font-semibold hover:underline cursor-pointer"
                >
                  + Create your first invoice
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                {invoices.slice(0, 5).map((inv) => (
                  <div
                    key={inv.id}
                    className="p-4 hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 flex items-center justify-between transition-colors text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {inv.invoiceNumber}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${
                            inv.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-white mt-1">
                        {inv.customer.name || 'Customer'}
                      </p>
                      <p className="text-[11px] font-normal text-slate-400 mt-0.5">
                        {inv.date} • Due: {inv.dueDate}
                      </p>
                    </div>

                    <div className="text-right space-y-1.5">
                      <p className="font-bold text-slate-900 dark:text-white text-xs">
                        {formatCurrency(inv.totals.grandTotal, inv.currency)}
                      </p>
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => editInvoice(inv)}
                          className="h-7 px-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDownloadInvoice(inv)}
                          className="h-7 w-7 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-emerald-600 rounded-lg text-slate-400 cursor-pointer transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
