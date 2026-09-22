'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  Package,
  Search,
  Plus,
  Trash2,
  Tag,
  Layers,
  MessageSquare
} from 'lucide-react';
import { formatCurrency } from '@/lib/calculator';
import { CatalogItem } from '@/types';

export default function CatalogView() {
  const {
    catalog,
    addCatalogItem,
    deleteCatalogItem,
    startNewQuotation,
    business,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Materials',
    unit: 'sq ft',
    defaultRate: 0,
    taxPercentage: 18,
    description: '',
  });

  const filteredCatalog = catalog.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    addCatalogItem(formData);
    setFormData({
      name: '',
      category: 'Materials',
      unit: 'sq ft',
      defaultRate: 0,
      taxPercentage: 18,
      description: '',
    });
    setIsAdding(false);
  };

  const handleInsertIntoQuotation = (item: CatalogItem) => {
    startNewQuotation('modern');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-[#0d1117] text-slate-900 dark:text-slate-100 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full p-4 sm:p-6 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Items & Service Rates
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Saved business rates, materials, and services for fast quotation & invoice generation.
            </p>
          </div>

          <button
            onClick={() => setIsAdding(true)}
            className="h-10 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 rounded-xl shadow-sm shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item / Service</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search materials, services, or units..."
            className="w-full h-10 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 pl-10 pr-3.5 rounded-xl text-xs placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 transition-colors shadow-2xs"
          />
        </div>

        {/* Table of items */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="p-3.5">Name & Description</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5 text-center">Unit</th>
                <th className="p-3.5 text-right">Default Rate</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredCatalog.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="p-3.5">
                    <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                    {item.description && (
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1">
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td className="p-3.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                      {item.category || 'General'}
                    </span>
                  </td>
                  <td className="p-3.5 text-center font-mono text-slate-600 dark:text-zinc-400">
                    {item.unit}
                  </td>
                  <td className="p-3.5 text-right font-bold text-slate-900 dark:text-white">
                    {formatCurrency(item.defaultRate, business.currency)}
                  </td>
                  <td className="p-3.5 text-right space-x-2">
                    <button
                      onClick={() => handleInsertIntoQuotation(item)}
                      title="Add to current quotation draft"
                      className="inline-flex items-center gap-1 h-8 px-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Use in Quote</span>
                    </button>
                    <button
                      onClick={() => deleteCatalogItem(item.id)}
                      className="text-slate-400 hover:text-red-500 p-1.5 transition-colors cursor-pointer"
                      title="Delete item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal for Add Item */}
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-2xs">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Add Item / Material / Service</h2>
              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-zinc-400 text-xs font-medium mb-1">
                    Item / Service Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Marine Plywood or Installation"
                    className="w-full h-10 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3.5 rounded-xl text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 text-xs font-medium mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="Materials, Labor, etc."
                      className="w-full h-10 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3.5 rounded-xl text-xs focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 text-xs font-medium mb-1">
                      Billing Unit
                    </label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="sq ft, feet, nos, job, etc."
                      className="w-full h-10 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3.5 rounded-xl text-xs focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-zinc-400 text-xs font-medium mb-1">
                    Default Rate ({business.currency}) *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.defaultRate}
                    onChange={(e) => setFormData({ ...formData, defaultRate: parseFloat(e.target.value) || 0 })}
                    placeholder="2200"
                    className="w-full h-10 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3.5 rounded-xl text-xs focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-zinc-400 text-xs font-medium mb-1">
                    Description & Specifications
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Grade, thickness, warranty details..."
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3 rounded-xl text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="h-10 px-4 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-600 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="h-10 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Save Item
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
