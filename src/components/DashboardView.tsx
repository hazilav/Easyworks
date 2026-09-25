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
    subscription,
  } = useApp();

  const totalQuotations = quotations.length;
  const totalInvoices = invoices.length;
  const draftQuotes = quotations.filter((q) => q.status === 'draft').length;
  const draftInvoices = invoices.filter((i) => i.status === 'draft').length;
  const totalDrafts = draftQuotes + draftInvoices;

  const totalQuotedAmount = quotations.reduce((acc, q) => acc + (q.totals?.grandTotal || 0), 0);
  const totalInvoicedAmount = invoices.reduce((acc, i) => acc + (i.totals?.grandTotal || 0), 0);

  const pdfLimit = subscription?.pdfDownloadLimit ?? 2;
  const pdfUsed = subscription?.pdfDownloadsUsed ?? subscription?.trialPdfDownloads ?? 0;
  const pdfRemaining = subscription?.pdfDownloadsRemaining ?? Math.max(0, pdfLimit - pdfUsed);

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

        {/* PDF Quota Status Card */}
        <div className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          pdfRemaining <= 0
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60'
            : pdfRemaining <= 5
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60'
            : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              pdfRemaining <= 0
                ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400'
                : pdfRemaining <= 5
                ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400'
                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
            }`}>
              <Download className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  PDF Download Quota:
                </span>
                <span className={`text-xs font-mono font-bold ${
                  pdfRemaining <= 0 ? 'text-rose-600 dark:text-rose-400' : pdfRemaining <= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
                }`}>
                  {pdfRemaining} remaining of {pdfLimit}
                </span>
                {pdfRemaining <= 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">
                    LIMIT REACHED
                  </span>
                )}
                {pdfRemaining > 0 && pdfRemaining <= 5 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                    LOW QUOTA
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                {pdfRemaining <= 0
                  ? 'All PDF downloads included in your plan have been used. Upgrade or renew to export more PDFs.'
                  : `${pdfUsed} PDFs downloaded so far. Quotation and invoice drafting is always unlimited.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="hidden md:flex flex-col items-end gap-1 min-w-[100px]">
              <span className="text-[10px] text-slate-400 font-mono">
                {Math.round((pdfUsed / Math.max(1, pdfLimit)) * 100)}% Used
              </span>
              <div className="w-24 h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    pdfRemaining <= 0 ? 'bg-rose-500' : pdfRemaining <= 5 ? 'bg-amber-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((pdfUsed / Math.max(1, pdfLimit)) * 100))}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => setCurrentView('billing')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                pdfRemaining <= 0
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs'
                  : pdfRemaining <= 5
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <span>{pdfRemaining <= 0 ? 'Upgrade Plan' : 'Manage Quota'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
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
