'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Layers,
  Users,
  Package,
  Building2,
  Plus,
  Briefcase,
  LogOut,
  Sparkles,
  CreditCard,
  ShieldAlert,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useTrialCountdown } from './TrialCountdownBanner';

export default function Sidebar() {
  const {
    currentView,
    setCurrentView,
    startNewQuotation,
    startNewInvoice,
    business,
    quotations,
    invoices,
    customers,
    catalog,
    logout,
    subscription,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useApp();

  const handleNavigate = (view: any) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  const handleStartQuotation = () => {
    startNewQuotation();
    setMobileMenuOpen(false);
  };

  const handleStartInvoice = () => {
    startNewInvoice();
    setMobileMenuOpen(false);
  };

  interface NavItem {
    id: 'dashboard' | 'quotations' | 'invoices' | 'templates' | 'customers' | 'catalog' | 'profile' | 'billing';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    color?: string;
  }

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'quotations', label: 'Quotations', icon: FileText, badge: quotations.length, color: 'text-blue-400' },
    { id: 'invoices', label: 'Invoices', icon: Receipt, badge: invoices.length, color: 'text-emerald-400' },
    { id: 'templates', label: 'Templates', icon: Layers, badge: 6, color: 'text-purple-400' },
    { id: 'customers', label: 'Customers', icon: Users, badge: customers.length },
    { id: 'catalog', label: 'Items & Rates', icon: Package, badge: catalog.length },
    { id: 'profile', label: 'Business Profile', icon: Building2 },
    { id: 'billing', label: 'Billing & Plan', icon: CreditCard, color: 'text-amber-400' },
  ];

  const { displayText: trialCountText, isExpired: trialIsExpired } = useTrialCountdown(
    subscription?.trialEndsAt
  );

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop static + Mobile slide-over drawer) */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-68 bg-[#121417] text-zinc-300 flex flex-col h-full border-r border-zinc-800 shrink-0 select-none transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
                <span className="text-base tracking-tighter">EW</span>
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                  Easyworks
                  <span className="text-[9px] uppercase font-semibold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {subscription?.status === 'ACTIVE' ? 'PRO' : 'SAAS'}
                  </span>
                </h1>
                <p className="text-[11px] text-zinc-400 truncate max-w-[140px]">
                  {business.businessName || 'Billing & Quotations'}
                </p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Close Navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Subscription Status Pill */}
          <div className="mt-3">
            {subscription?.status === 'ACTIVE' ? (
              <button
                onClick={() => handleNavigate('billing')}
                className="w-full px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold flex items-center justify-between hover:bg-emerald-950/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Pro Active</span>
                </div>
                <span className="text-[10px] text-emerald-500">Manage</span>
              </button>
            ) : subscription?.status === 'TRIALING' && !trialIsExpired ? (
              <button
                onClick={() => handleNavigate('billing')}
                className="w-full px-2.5 py-1 rounded-lg bg-blue-950/40 border border-blue-500/30 text-blue-400 text-[11px] font-semibold flex items-center justify-between hover:bg-blue-950/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 truncate mr-1">
                  <Clock className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="truncate font-mono text-[10px]">{trialCountText}</span>
                </div>
                <span className="text-[10px] text-blue-300 underline font-medium shrink-0">Upgrade</span>
              </button>
            ) : (
              <button
                onClick={() => handleNavigate('billing')}
                className="w-full px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-400 text-[11px] font-semibold flex items-center justify-between hover:bg-amber-950/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Trial Expired</span>
                </div>
                <span className="text-[10px] text-amber-300 underline font-medium">Subscribe</span>
              </button>
            )}
          </div>
        </div>

        {/* Two Quick Action Buttons */}
        <div className="p-3 space-y-2 border-b border-zinc-800/60">
          <button
            onClick={handleStartQuotation}
            className="w-full h-10 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 rounded-xl transition-all duration-150 shadow-sm shadow-blue-600/20 active:scale-[0.98] text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Quotation</span>
          </button>

          <button
            onClick={handleStartInvoice}
            className="w-full h-10 flex items-center justify-center space-x-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/30 font-semibold px-3 rounded-xl transition-all duration-150 active:scale-[0.98] text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Create Invoice</span>
          </button>
        </div>

        {/* Main Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Main Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentView === item.id ||
              (item.id === 'quotations' && currentView === 'quotation_editor') ||
              (item.id === 'invoices' && currentView === 'invoice_editor');

            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs md:text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-zinc-800 text-white font-semibold shadow-2xs'
                  : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon
                  className={`w-4 h-4 ${isActive ? item.color || 'text-blue-400' : 'text-zinc-400'}`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    isActive
                      ? 'bg-zinc-700 text-zinc-200'
                      : 'bg-zinc-800/80 text-zinc-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Business Currency & User Profile Bar */}
      <div className="p-3.5 border-t border-zinc-800/80 bg-zinc-950/70 text-xs text-zinc-400 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300 font-bold text-[10px] font-mono shrink-0">
            {business.currency}
          </div>
          <div className="min-w-0 truncate">
            <p className="text-zinc-200 font-semibold truncate text-[11px]">
              {business.ownerName || 'User Workspace'}
            </p>
            <p className="text-[10px] text-zinc-500 truncate">{business.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleNavigate('profile')}
            title="Edit Business Profile"
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <Briefcase className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              logout();
              setMobileMenuOpen(false);
            }}
            title="Sign Out to Public Website"
            className="p-1.5 hover:bg-zinc-800 hover:text-red-400 rounded-lg text-zinc-400 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  </>
);
}
