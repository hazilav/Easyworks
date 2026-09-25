'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  FileText,
  Search,
  Download,
  Trash2,
  Plus,
  Edit3,
  CheckCircle,
  Clock,
  Printer,
  ArrowRightCircle,
  Receipt,
} from 'lucide-react';
import { formatCurrency } from '@/lib/calculator';
import { generateQuotationPDF } from '@/lib/pdfGenerator';
import { Quotation, QuotationStatus } from '@/types';

export default function QuotationsListView() {
  const {
    quotations,
    deleteQuotation,
    updateQuotationStatus,
    startNewQuotation,
    editQuotation,
    convertQuotationToInvoice,
    business,
    requestPdfDownload,
    subscription,
    setDownloadLimitModalOpen,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredQuotations = quotations.filter((q) => {
    const matchesSearch =
      q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.customer.name && q.customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (q.customer.company && q.customer.company.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isLimitReached = (subscription?.pdfDownloadsRemaining ?? 1) <= 0;

  const handleDownload = async (quote: Quotation) => {
    if (isLimitReached) {
      setDownloadLimitModalOpen(true);
      return;
    }
    const allowed = await requestPdfDownload('quotation', quote.id, quote.quotationNumber);
    if (!allowed) return;
    const doc = generateQuotationPDF(quote, business);
    doc.save(`${quote.quotationNumber}.pdf`);
  };

  const handlePrint = async (quote: Quotation) => {
    // Browser print does NOT consume PDF credit (Requirement 7)
    const doc = generateQuotationPDF(quote, business);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-blue-500" />
              Commercial Quotations
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-zinc-400 font-normal mt-1">
              Draft, edit, convert, and download official business quotations.
            </p>
          </div>

          <button
            onClick={() => startNewQuotation()}
            className="h-10 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Quotation</span>
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by quote # or customer..."
              className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-3.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs">
            {['all', 'draft', 'confirmed', 'sent', 'accepted', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`h-9 px-3.5 rounded-xl font-medium capitalize whitespace-nowrap transition-colors cursor-pointer flex items-center justify-center ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Quotations Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
          {filteredQuotations.length === 0 ? (
            <div className="p-14 text-center text-xs text-slate-400 space-y-3">
              <FileText className="w-10 h-10 mx-auto text-slate-300 dark:text-zinc-700 opacity-60" />
              <div>
                <p className="font-semibold text-sm text-slate-700 dark:text-zinc-300">
                  {quotations.length === 0 ? 'No quotations created yet' : 'No matching quotations found'}
                </p>
                <p className="mt-1 font-normal">
                  {quotations.length === 0
                    ? 'Click "Create Quotation" to draft your first structured business quotation.'
                    : 'Try clearing your search query or status filter.'}
                </p>
              </div>
              {quotations.length === 0 && (
                <button
                  onClick={() => startNewQuotation()}
                  className="h-10 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-xs transition-all shadow-sm cursor-pointer inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Quotation</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="p-4">Quotation #</th>
                    <th className="p-4">Customer / Company</th>
                    <th className="p-4">Date & Validity</th>
                    <th className="p-4">Items</th>
                    <th className="p-4 text-right">Grand Total</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredQuotations.map((q) => (
                    <tr
                      key={q.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="p-4">
                        <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                          {q.quotationNumber}
                        </span>
                        <p className="text-[11px] text-slate-400 capitalize mt-0.5">
                          {q.template} Style
                        </p>
                      </td>

                      <td className="p-4">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {q.customer.name || 'Valued Customer'}
                        </p>
                        {q.customer.company && (
                          <p className="text-[11px] font-normal text-slate-500 mt-0.5">{q.customer.company}</p>
                        )}
                      </td>

                      <td className="p-4 text-slate-500 dark:text-zinc-400">
                        <p className="font-medium text-slate-700 dark:text-zinc-300">{q.date}</p>
                        <p className="text-[11px] font-normal text-slate-400 mt-0.5">Valid: {q.validUntil}</p>
                      </td>

                      <td className="p-4 text-slate-600 dark:text-zinc-400 font-medium">
                        {q.items.length} items
                      </td>

                      <td className="p-4 text-right font-bold text-slate-900 dark:text-white">
                        {formatCurrency(q.totals.grandTotal, q.currency)}
                      </td>

                      <td className="p-4 text-center">
                        <select
                          value={q.status}
                          onChange={(e) => updateQuotationStatus(q.id, e.target.value as QuotationStatus)}
                          className="h-7 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[10px] font-semibold uppercase px-2.5 rounded-lg border border-slate-200 dark:border-zinc-700 cursor-pointer"
                        >
                          <option value="draft">Draft</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="sent">Sent</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>

                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => editQuotation(q)}
                          className="h-8 px-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg text-slate-700 dark:text-zinc-200 font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          title="Edit Quotation"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => handleDownload(q)}
                          className={`h-8 px-2.5 rounded-lg font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                            isLimitReached
                              ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60'
                              : 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200'
                          }`}
                          title={
                            isLimitReached
                              ? "You've reached your PDF download limit for this subscription. Upgrade or renew your plan to continue."
                              : "Download PDF"
                          }
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isLimitReached ? 'Limit' : 'PDF'}</span>
                        </button>

                        <button
                          onClick={() => convertQuotationToInvoice(q)}
                          className="h-8 px-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          title="Convert to Tax Invoice"
                        >
                          <ArrowRightCircle className="w-3.5 h-3.5" />
                          <span>To Invoice</span>
                        </button>

                        <button
                          onClick={() => {
                            if (confirm('Delete this quotation permanently?')) {
                              deleteQuotation(q.id);
                            }
                          }}
                          className="h-8 w-8 inline-flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                          title="Delete Quotation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
