'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Search,
  RefreshCw,
  Users,
  FileText,
  CreditCard,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { safeFetchJson } from '@/lib/api/client';

export default function DeveloperBusinessesView() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ew_developer_token') || '';
      const { data } = await safeFetchJson<{ success?: boolean; businesses?: any[] }>(
        '/api/developer/businesses',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (data?.success) {
        setBusinesses(data.businesses || []);
      }
    } catch (e) {
      console.error('Error fetching businesses:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const filteredBusinesses = businesses.filter((b) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (b.businessName && b.businessName.toLowerCase().includes(s)) ||
      (b.ownerName && b.ownerName.toLowerCase().includes(s)) ||
      (b.email && b.email.toLowerCase().includes(s)) ||
      (b.phone && b.phone.toLowerCase().includes(s))
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19] text-zinc-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Multi-Tenant Overview
              </span>
              <span className="text-xs text-zinc-400">• All Workspaces</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Registered Businesses</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Inspect tenant company profiles, document volumes, owner contact information, and subscription states.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchBusinesses}
              className="h-9 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by company name, owner, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 bg-[#121724] border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="text-xs text-zinc-400 font-medium">
            Showing <strong className="text-white">{filteredBusinesses.length}</strong> businesses
          </div>
        </div>

        {/* Businesses Table */}
        <div className="rounded-2xl border border-zinc-800 bg-[#121724] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0e131f] text-zinc-400 uppercase font-semibold border-b border-zinc-800 tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Business Name & Owner</th>
                  <th className="px-5 py-3.5">Contact Details</th>
                  <th className="px-5 py-3.5">Subscription Plan</th>
                  <th className="px-5 py-3.5">Documents</th>
                  <th className="px-5 py-3.5">PDF Usage</th>
                  <th className="px-5 py-3.5">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span>Loading businesses...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredBusinesses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-500">
                      No businesses found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredBusinesses.map((biz) => {
                    const isSubscribed = biz.subscriptionStatus === 'ACTIVE';
                    const isTrial = biz.subscriptionStatus === 'TRIALING' || biz.subscriptionStatus === 'TRIAL';
                    return (
                      <tr key={biz.userId} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-white text-xs truncate">{biz.businessName}</div>
                              <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                                <span>{biz.ownerName}</span>
                                <span className="font-mono text-[10px] text-zinc-500">({biz.currency})</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-zinc-300">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-[11px] text-zinc-300">
                              <Mail className="w-3 h-3 text-zinc-500" />
                              <span className="truncate max-w-[180px]">{biz.email}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                              <Phone className="w-3 h-3 text-zinc-500" />
                              <span>{biz.phone}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isSubscribed
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : isTrial
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {isSubscribed ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            <span>{biz.planName}</span>
                          </span>
                        </td>

                        <td className="px-5 py-4 text-zinc-300 font-mono text-[11px]">
                          <div>
                            <strong className="text-white">{biz.totalDocuments}</strong> docs
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {biz.quotationsCount} quotes · {biz.invoicesCount} invoices
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-mono text-[11px] text-zinc-300">
                            <strong className="text-white">{biz.pdfUsed}</strong> / {biz.pdfLimit} PDFs
                          </div>
                          <div className="w-24 h-1.5 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{
                                width: `${Math.min(100, Math.round((biz.pdfUsed / Math.max(1, biz.pdfLimit)) * 100))}%`,
                              }}
                            />
                          </div>
                        </td>

                        <td className="px-5 py-4 text-zinc-400 text-[11px] font-mono">
                          {biz.createdAt ? new Date(biz.createdAt).toLocaleDateString() : '—'}
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
