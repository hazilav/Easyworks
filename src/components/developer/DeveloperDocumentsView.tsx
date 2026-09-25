'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  Receipt,
  Eye,
  Building2,
  Calendar,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { safeFetchJson } from '@/lib/api/client';

export default function DeveloperDocumentsView() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'quotations' | 'invoices'>('all');

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ew_developer_token') || '';
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (search.trim()) params.set('search', search.trim());

      const { data } = await safeFetchJson<{ success?: boolean; documents?: any[] }>(
        `/api/developer/documents?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (data?.success) {
        setDocuments(data.documents || []);
      }
    } catch (e) {
      console.error('Error fetching documents:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDocuments();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19] text-zinc-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Document Ledger
              </span>
              <span className="text-xs text-zinc-400">• Commercial Quotes & Invoices</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Commercial Documents</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Inspect all quotations and invoices generated across all client workspaces.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchDocuments}
              className="h-9 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by doc number, client, or business..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 bg-[#121724] border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </form>

          <div className="flex items-center gap-2">
            {(['all', 'quotations', 'invoices'] as const).map((filterVal) => (
              <button
                key={filterVal}
                onClick={() => setTypeFilter(filterVal)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer capitalize ${
                  typeFilter === filterVal
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-[#121724] text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {filterVal}
              </button>
            ))}
          </div>
        </div>

        {/* Documents Table */}
        <div className="rounded-2xl border border-zinc-800 bg-[#121724] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0e131f] text-zinc-400 uppercase font-semibold border-b border-zinc-800 tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Document Details</th>
                  <th className="px-5 py-3.5">Tenant / Creator</th>
                  <th className="px-5 py-3.5">Recipient Customer</th>
                  <th className="px-5 py-3.5">Grand Total</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span>Loading documents...</span>
                      </div>
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-500">
                      No documents found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => {
                    const isQuote = doc.type === 'quotation';
                    return (
                      <tr key={doc.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                isQuote
                                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                  : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {isQuote ? <FileText className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-white text-xs font-mono">{doc.document_number}</div>
                              <div className="text-[11px] text-zinc-400 truncate max-w-[200px] mt-0.5">
                                {doc.title || (isQuote ? 'Quotation' : 'Invoice')}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-zinc-300">
                          <div className="font-semibold text-white text-xs">{doc.business_name || 'Individual'}</div>
                          <div className="text-[10px] text-zinc-500">{doc.creator_name}</div>
                        </td>

                        <td className="px-5 py-4 text-zinc-300">
                          <div className="font-medium text-white text-xs">{doc.customer_name || 'Direct Client'}</div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-bold text-emerald-400 font-mono text-xs">
                            ₹{Number(doc.grand_total || 0).toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] text-zinc-500">{doc.currency || 'INR'}</div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              doc.status === 'paid' || doc.status === 'accepted'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : doc.status === 'sent'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {doc.status || 'draft'}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-zinc-400 text-[11px] font-mono">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
