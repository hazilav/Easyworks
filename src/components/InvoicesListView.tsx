'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Invoice } from '@/types';
import { formatCurrency } from '@/lib/calculator';
import { generateInvoicePDF } from '@/lib/pdfGenerator';
import {
  Receipt,
  Plus,
  Search,
  Download,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
} from 'lucide-react';

export default function InvoicesListView() {
  const {
    invoices,
    startNewInvoice,
    editInvoice,
    deleteInvoice,
    updateInvoiceStatus,
    business,
    requestPdfDownload,
    subscription,
    setDownloadLimitModalOpen,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.customer.company && inv.customer.company.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isLimitReached = (subscription?.pdfDownloadsRemaining ?? 1) <= 0;

  const handleDownload = async (inv: Invoice) => {
    if (isLimitReached) {
      setDownloadLimitModalOpen(true);
      return;
    }
    const allowed = await requestPdfDownload('invoice', inv.id, inv.invoiceNumber);
    if (!allowed) return;
    const doc = generateInvoicePDF(inv, business);
    doc.save(`${inv.invoiceNumber}.pdf`);
  };

  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> Paid
          </span>
        );
      case 'partially_paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
            <CreditCard className="w-3 h-3" /> Partially Paid
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
            Sent
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300">
            <AlertCircle className="w-3 h-3" /> Overdue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
            <Clock className="w-3 h-3" /> Draft
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Receipt className="w-6 h-6 text-emerald-500" />
              Invoices
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-zinc-400 font-normal mt-1">
              Create, track, and manage all your commercial invoices.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => startNewInvoice()}
              className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-emerald-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Invoice</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoices or clients..."
              className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-3.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs">
            {['all', 'draft', 'sent', 'paid', 'partially_paid', 'overdue'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`h-9 px-3.5 rounded-xl font-medium capitalize whitespace-nowrap transition-colors cursor-pointer flex items-center justify-center ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-900 font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
          {filteredInvoices.length === 0 ? (
            <div className="p-14 text-center text-xs text-slate-400 space-y-3">
              <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-zinc-700 opacity-60" />
              <div>
                <p className="font-semibold text-sm text-slate-700 dark:text-zinc-300">
                  {invoices.length === 0 ? 'No invoices created yet' : 'No matching invoices found'}
                </p>
                <p className="mt-1 font-normal">
                  {invoices.length === 0
                    ? 'Create an invoice or convert an approved quotation to get started.'
                    : 'Try clearing your search query or status filter.'}
                </p>
              </div>
              {invoices.length === 0 && (
                <button
                  onClick={() => startNewInvoice()}
                  className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs transition-all shadow-sm cursor-pointer inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Invoice</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Customer / Company</th>
                    <th className="p-4">Date & Due</th>
                    <th className="p-4 text-right">Grand Total</th>
                    <th className="p-4 text-right">Balance Due</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="p-4">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {inv.invoiceNumber}
                        </span>
                        <p className="text-[11px] text-slate-400 capitalize mt-0.5">
                          {inv.template} Style
                        </p>
                      </td>

                      <td className="p-4">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {inv.customer.name || 'Customer'}
                        </p>
                        {inv.customer.company && (
                          <p className="text-[11px] font-normal text-slate-500 mt-0.5">{inv.customer.company}</p>
                        )}
                      </td>

                      <td className="p-4 text-slate-500 dark:text-zinc-400">
                        <p className="font-medium text-slate-700 dark:text-zinc-300">{inv.date}</p>
                        <p className="text-[11px] font-normal text-slate-400 mt-0.5">Due: {inv.dueDate}</p>
                      </td>

                      <td className="p-4 text-right font-bold text-slate-900 dark:text-white">
                        {formatCurrency(inv.totals.grandTotal, inv.currency)}
                      </td>

                      <td className="p-4 text-right font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(
                          inv.totals.balanceDue ?? inv.totals.grandTotal,
                          inv.currency
                        )}
                      </td>

                      <td className="p-4 text-center">{getStatusBadge(inv.status)}</td>

                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => editInvoice(inv)}
                          className="h-8 px-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg text-slate-700 dark:text-zinc-200 font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          title="Edit Invoice"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => handleDownload(inv)}
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

                        {inv.status !== 'paid' && (
                          <button
                            onClick={() => updateInvoiceStatus(inv.id, 'paid')}
                            className="h-8 px-2.5 bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                            title="Mark as Paid"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Paid</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (confirm(`Delete invoice ${inv.invoiceNumber}?`)) {
                              deleteInvoice(inv.id);
                            }
                          }}
                          className="h-8 w-8 inline-flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                          title="Delete Invoice"
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
