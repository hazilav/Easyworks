'use client';

import React from 'react';
import { AppProvider, useApp } from '@/context/AppContext';
import Sidebar from '@/components/Sidebar';
import DashboardView from '@/components/DashboardView';
import QuotationsListView from '@/components/QuotationsListView';
import InvoicesListView from '@/components/InvoicesListView';
import DocumentEditor from '@/components/DocumentEditor';
import TemplatesView from '@/components/TemplatesView';
import CustomersView from '@/components/CustomersView';
import CatalogView from '@/components/CatalogView';
import BusinessProfileView from '@/components/BusinessProfileView';
import BillingView from '@/components/BillingView';
import PricingView from '@/components/PricingView';
import TrialCountdownBanner from '@/components/TrialCountdownBanner';
import TrialExpiredModal from '@/components/TrialExpiredModal';
import DownloadLimitModal from '@/components/DownloadLimitModal';
import PublicLanding from '@/components/PublicLanding';
import AuthModal from '@/components/AuthModal';

import { Menu, Plus, ShieldAlert, MessageCircle, LogOut } from 'lucide-react';

function EasyworksApp() {
  const {
    currentUser,
    isWorkspaceReady,
    isSuspended,
    logout,
    currentView,
    trialExpiredModalOpen,
    setTrialExpiredModalOpen,
    downloadLimitModalOpen,
    setDownloadLimitModalOpen,
    setMobileMenuOpen,
    startNewQuotation,
    startNewInvoice,
  } = useApp();

  // If not logged in, render Public Website immediately (zero loading screen delay for mobile/desktop)
  if (!currentUser) {
    return (
      <>
        <PublicLanding />
        <AuthModal />
      </>
    );
  }

  // If suspended by administrator, show lockout screen
  if (isSuspended) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0b0f19] text-white flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-[#121724] border border-rose-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
              Access Suspended
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Account Suspended
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Your Easyworks account (<span className="text-zinc-200 font-medium">{currentUser.email}</span>) has been restricted by the administrator. All document creation and PDF downloads have been disabled.
            </p>
          </div>

          <div className="p-3.5 bg-[#0e131f] border border-zinc-800 rounded-xl text-left space-y-1">
            <div className="text-[11px] font-medium text-zinc-400">Account Owner</div>
            <div className="text-xs font-semibold text-white">{currentUser.name || 'Account Holder'}</div>
            <div className="text-[11px] text-zinc-500 font-mono">{currentUser.businessName || 'Business Profile'}</div>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href={`https://wa.me/9539933265?text=${encodeURIComponent(`Hello Easyworks Support, my account (${currentUser.email}) has been suspended. Please help reactivate it.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 h-11 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-emerald-600/25"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Contact Support on WhatsApp</span>
            </a>

            <button
              onClick={() => logout()}
              className="w-full flex items-center justify-center gap-2 h-10 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-medium transition-colors cursor-pointer border border-zinc-700/60"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out of Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Workspace Experience
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-black font-sans flex-col md:flex-row">
      {/* Mobile Top Header (only visible on small screens < md) */}
      <header className="md:hidden flex items-center justify-between px-3.5 py-2.5 bg-[#121417] text-white border-b border-zinc-800 shrink-0 z-30">
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 -ml-1 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              EW
            </div>
            <span className="text-sm font-bold tracking-tight">Easyworks</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => startNewQuotation()}
            className="h-8 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Quote</span>
          </button>
          <button
            onClick={() => startNewInvoice()}
            className="h-8 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Invoice</span>
          </button>
        </div>
      </header>

      {/* Sidebar (Desktop static + Mobile slide-over drawer) */}
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <TrialCountdownBanner />
        <div className="flex-1 flex overflow-hidden relative">
          {currentView === 'dashboard' && <DashboardView />}
          {currentView === 'quotations' && <QuotationsListView />}
          {currentView === 'invoices' && <InvoicesListView />}
          {currentView === 'quotation_editor' && <DocumentEditor documentType="quotation" />}
          {currentView === 'invoice_editor' && <DocumentEditor documentType="invoice" />}
          {currentView === 'templates' && <TemplatesView />}
          {currentView === 'customers' && <CustomersView />}
          {currentView === 'catalog' && <CatalogView />}
          {currentView === 'profile' && <BusinessProfileView />}
          {currentView === 'billing' && <BillingView />}
          {currentView === 'pricing' && <PricingView />}
        </div>
      </main>

      <TrialExpiredModal
        isOpen={trialExpiredModalOpen}
        onClose={() => setTrialExpiredModalOpen(false)}
      />
      <DownloadLimitModal
        isOpen={downloadLimitModalOpen}
        onClose={() => setDownloadLimitModalOpen(false)}
      />
      <AuthModal />
    </div>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <EasyworksApp />
    </AppProvider>
  );
}
