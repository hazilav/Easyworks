'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Mail,
  Phone,
  MapPin,
  FileText,
} from 'lucide-react';
import { Customer } from '@/types';

export default function CustomersView() {
  const {
    customers,
    addCustomer,
    deleteCustomer,
    startNewQuotation,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
    notes: '',
  });

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.phone && c.phone.includes(searchTerm))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    addCustomer(formData);
    setFormData({
      name: '',
      company: '',
      phone: '',
      email: '',
      address: '',
      taxNumber: '',
      notes: '',
    });
    setIsAdding(false);
  };

  const handleStartQuoteForCustomer = (cust: Customer) => {
    startNewQuotation('modern', cust);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Users className="w-6 h-6 text-blue-500" />
              Customer Directory
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-zinc-400 font-normal mt-1">
              Saved client contacts for instant quotation attribution and invoice generation.
            </p>
          </div>

          <button
            onClick={() => setIsAdding(true)}
            className="h-10 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customers by name, company, or phone..."
              className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-3.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Customer Cards Grid / Empty State */}
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No customers found</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              {searchTerm
                ? 'No clients match your search filter.'
                : 'Your customer directory is empty. Add your first customer to quickly start creating quotations and invoices.'}
            </p>
            <button
              onClick={() => setIsAdding(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add your first customer</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCustomers.map((cust) => (
              <div
                key={cust.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 space-y-4 shadow-2xs hover:border-slate-300 dark:hover:border-zinc-700 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">{cust.name}</h3>
                      {cust.company && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                          {cust.company}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteCustomer(cust.id)}
                      className="h-8 w-8 inline-flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                      title="Delete customer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-3.5 space-y-2 text-xs text-slate-600 dark:text-zinc-400">
                    {cust.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-normal">{cust.phone}</span>
                      </div>
                    )}
                    {cust.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate font-normal">{cust.email}</span>
                      </div>
                    )}
                    {cust.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate font-normal">{cust.address}</span>
                      </div>
                    )}
                    {cust.taxNumber && (
                      <div className="text-[11px] text-slate-400 font-mono mt-1">
                        Tax/GST: {cust.taxNumber}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-normal">
                    Added {new Date(cust.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleStartQuoteForCustomer(cust)}
                    className="h-8 px-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Start Quote</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal for Add Customer */}
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Add New Customer</h2>
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3.5 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="e.g. Apex Global Solutions"
                    className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3.5 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765..."
                      className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3.5 rounded-xl text-xs text-slate-900 dark:text-white"
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
                      placeholder="client@gmail.com"
                      className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3.5 rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    Billing / Site Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="e.g. Kakkanad, Kochi, Kerala"
                    className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3.5 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="h-10 px-4 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-600 dark:text-zinc-300 font-medium text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="h-10 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-xs shadow-xs cursor-pointer active:scale-98"
                  >
                    Save Customer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
