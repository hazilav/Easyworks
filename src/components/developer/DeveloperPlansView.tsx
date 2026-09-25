'use client';

import React, { useState } from 'react';
import {
  Layers,
  Check,
  Plus,
  Edit2,
  Trash2,
  Users,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Save,
  X,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { SubscriptionPlan } from '@/types';
import { safeFetchJson } from '@/lib/api/client';

interface DeveloperPlansViewProps {
  plans: (SubscriptionPlan & { activeSubscribers?: number })[];
  onRefreshPlans: () => void;
}

export default function DeveloperPlansView({ plans, onRefreshPlans }: DeveloperPlansViewProps) {
  const [editingPlan, setEditingPlan] = useState<(SubscriptionPlan & { activeSubscribers?: number }) | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newFeatureText, setNewFeatureText] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleEditClick = (plan: SubscriptionPlan & { activeSubscribers?: number }) => {
    setEditingPlan({ ...plan, features: [...plan.features] });
    setIsCreatingNew(false);
  };

  const handleCreateClick = () => {
    setEditingPlan({
      id: '',
      name: '',
      durationMonths: 1,
      priceINR: 299,
      pdfDownloadLimit: 30,
      description: '',
      features: ['30 Total PDF Downloads', 'Unlimited Quotations & Invoices', 'All Curated Design Templates'],
      isActive: true,
      isPopular: false,
      isCustom: false,
    });
    setIsCreatingNew(true);
  };

  const handleAddFeature = () => {
    if (!newFeatureText.trim() || !editingPlan) return;
    setEditingPlan({
      ...editingPlan,
      features: [...editingPlan.features, newFeatureText.trim()],
    });
    setNewFeatureText('');
  };

  const handleRemoveFeature = (index: number) => {
    if (!editingPlan) return;
    const updated = [...editingPlan.features];
    updated.splice(index, 1);
    setEditingPlan({ ...editingPlan, features: updated });
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setLoading(true);
    setStatusMsg(null);

    try {
      const token = localStorage.getItem('ew_developer_token') || '';
      const body = {
        action: isCreatingNew ? 'CREATE' : 'UPDATE',
        planId: editingPlan.id,
        planData: {
          name: editingPlan.name,
          durationMonths: editingPlan.durationMonths,
          priceINR: editingPlan.priceINR,
          pdfDownloadLimit: editingPlan.pdfDownloadLimit ?? 20,
          description: editingPlan.description,
          features: editingPlan.features,
          isActive: editingPlan.isActive,
          isPopular: editingPlan.isPopular,
          isCustom: editingPlan.isCustom,
        },
      };

      const { ok, data, error } = await safeFetchJson<{ success?: boolean; error?: string }>(
        '/api/developer/plans',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!ok || !data?.success) {
        throw new Error(data?.error || error || 'Failed to save plan');
      }

      setStatusMsg('Plan updated and live in database.');
      onRefreshPlans();
      setTimeout(() => {
        setEditingPlan(null);
        setStatusMsg(null);
      }, 1000);
    } catch (err: any) {
      setStatusMsg(err.message || 'Error saving plan');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    try {
      const token = localStorage.getItem('ew_developer_token') || '';
      await safeFetchJson('/api/developer/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'UPDATE',
          planId: plan.id,
          planData: { isActive: !plan.isActive },
        }),
      });
      onRefreshPlans();
    } catch (e) {
      console.error('Failed to toggle plan status:', e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19] text-zinc-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                SaaS Monetization
              </span>
              <span className="text-xs text-zinc-400">• Database-Backed Pricing</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Subscription Plans</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Configure plans, duration terms, pricing in INR, feature sets, and active visibility.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onRefreshPlans}
              className="h-9 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleCreateClick}
              className="h-9 px-3.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-blue-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Plan</span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between transition-all bg-[#121724] ${
                plan.isActive
                  ? 'border-zinc-800 shadow-xl'
                  : 'border-zinc-800/40 opacity-60 bg-[#0e131f]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                      plan.isPopular
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {plan.isCustom ? 'ENTERPRISE' : `${plan.durationMonths} MONTH${plan.durationMonths > 1 ? 'S' : ''}`}
                  </span>

                  <button
                    onClick={() => handleToggleActive(plan)}
                    title={plan.isActive ? 'Deactivate Plan' : 'Activate Plan'}
                    className="cursor-pointer"
                  >
                    {plan.isActive ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                        LIVE
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-700 text-zinc-400">
                        INACTIVE
                      </span>
                    )}
                  </button>
                </div>

                <h3 className="text-lg font-bold text-white tracking-tight">{plan.name}</h3>
                <p className="text-xs text-zinc-400 mt-1 min-h-[32px]">{plan.description}</p>

                <div className="my-4 pt-3 border-t border-zinc-800/80">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white">
                      {plan.isCustom ? 'Custom' : `₹${plan.priceINR.toLocaleString('en-IN')}`}
                    </span>
                    {!plan.isCustom && (
                      <span className="text-xs text-zinc-400">/ {plan.durationMonths}m</span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      <span>
                        <strong className="text-white">{plan.activeSubscribers ?? 0}</strong> subscribers
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono font-bold">
                      {plan.pdfDownloadLimit} PDFs
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    Included Features:
                  </span>
                  <ul className="space-y-1.5 text-xs text-zinc-300">
                    {plan.features.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{f}</span>
                      </li>
                    ))}
                    {plan.features.length > 4 && (
                      <li className="text-[11px] text-zinc-500 font-mono">
                        +{plan.features.length - 4} more features
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center gap-2">
                <button
                  onClick={() => handleEditClick(plan)}
                  className="flex-1 h-8 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Plan</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Edit / Create Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#121724] border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  {isCreatingNew ? 'Create New Subscription Plan' : `Edit Plan: ${editingPlan.name}`}
                </h3>
                <p className="text-xs text-zinc-400">Database-level changes reflect across all customer pricing cards.</p>
              </div>
              <button
                onClick={() => setEditingPlan(null)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {statusMsg && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold">
                {statusMsg}
              </div>
            )}

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Plan Name *</label>
                  <input
                    type="text"
                    required
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    placeholder="e.g. 1 Month, 3 Months, Annual Pro"
                    className="w-full h-10 px-3.5 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Duration (Months) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editingPlan.durationMonths}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, durationMonths: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full h-10 px-3.5 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Price in INR (₹) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editingPlan.priceINR}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, priceINR: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full h-10 px-3.5 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    PDF Download Limit *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editingPlan.pdfDownloadLimit ?? 20}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, pdfDownloadLimit: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full h-10 px-3.5 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Badge / Style</label>
                  <div className="flex items-center gap-3 h-10">
                    <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingPlan.isPopular}
                        onChange={(e) => setEditingPlan({ ...editingPlan, isPopular: e.target.checked })}
                        className="rounded accent-blue-600"
                      />
                      <span>Popular</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingPlan.isActive}
                        onChange={(e) => setEditingPlan({ ...editingPlan, isActive: e.target.checked })}
                        className="rounded accent-emerald-600"
                      />
                      <span>Active</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Plan Description *
                </label>
                <input
                  type="text"
                  required
                  value={editingPlan.description}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  placeholder="Short summary displayed on pricing card"
                  className="w-full h-10 px-3.5 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>

              {/* Features List */}
              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                <label className="block text-xs font-medium text-zinc-300">
                  Included Features ({editingPlan.features.length})
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newFeatureText}
                    onChange={(e) => setNewFeatureText(e.target.value)}
                    placeholder="Add a new feature bullet..."
                    className="flex-1 h-9 px-3 bg-[#0e131f] border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddFeature}
                    className="h-9 px-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 mt-2">
                  {editingPlan.features.map((feat, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#0e131f] border border-zinc-800 text-xs"
                    >
                      <span className="text-zinc-200">{feat}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(index)}
                        className="text-zinc-500 hover:text-rose-400 cursor-pointer p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{loading ? 'Saving...' : 'Save Plan to Database'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
