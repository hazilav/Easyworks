'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import PricingView from '@/components/PricingView';
import {
  FileText,
  Receipt,
  Layers,
  ArrowRight,
  CheckCircle2,
  Download,
  Building2,
  Shield,
  Sparkles,
  Calculator,
  Check,
  Menu,
  X,
  CreditCard,
} from 'lucide-react';

export default function PublicLanding() {
  const { setAuthModalOpen, setAuthMode } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleOpenSignup = () => {
    setAuthMode('signup');
    setAuthModalOpen(true);
    setMobileMenuOpen(false);
  };

  const handleOpenLogin = () => {
    setAuthMode('login');
    setAuthModalOpen(true);
    setMobileMenuOpen(false);
  };

  const handleNavClick = (sectionId: string) => {
    setMobileMenuOpen(false);
    const elem = document.getElementById(sectionId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const industries = [
    'Contractors & Builders',
    'Interior Designers',
    'Fabricators & Carpentry',
    'Web & Digital Agencies',
    'Event Management',
    'Plumbing & Electrical',
    'Repair & AC Services',
    'Consultants & Freelancers',
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#090a0c] text-slate-900 dark:text-slate-100 flex flex-col selection:bg-blue-100 selection:text-blue-900 font-sans">
      {/* Top Public Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => handleNavClick('home')}
              className="flex items-center space-x-2.5 cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
                <span className="text-sm font-black">EW</span>
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Easyworks
              </span>
            </button>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8 text-xs font-semibold text-slate-600 dark:text-zinc-400">
            <button
              onClick={() => handleNavClick('home')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Home
            </button>
            <button
              onClick={() => handleNavClick('features')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => handleNavClick('templates')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Templates
            </button>
            <button
              onClick={() => handleNavClick('pricing')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-blue-600 dark:text-blue-400 font-bold"
            >
              Pricing
            </button>
          </nav>

          {/* Right Desktop Actions & Mobile Menu Button */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleOpenLogin}
              className="hidden sm:inline-flex h-10 px-4 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white rounded-xl transition-colors cursor-pointer items-center justify-center"
            >
              Login
            </button>
            <button
              onClick={handleOpenSignup}
              className="h-10 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 transition-all cursor-pointer active:scale-98 flex items-center justify-center"
            >
              Get Started
            </button>

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Toggle Public Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer / Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 py-4 space-y-3 shadow-xl animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col space-y-1">
              <button
                onClick={() => handleNavClick('home')}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-800 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Home
              </button>
              <button
                onClick={() => handleNavClick('features')}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-800 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => handleNavClick('templates')}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-800 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Templates
              </button>
              <button
                onClick={() => handleNavClick('pricing')}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center justify-between"
              >
                <span>Pricing Plans</span>
                <span className="text-[10px] uppercase font-bold bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-md">
                  From ₹249
                </span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex flex-col gap-2">
              <button
                onClick={handleOpenLogin}
                className="w-full py-2.5 text-center text-xs font-semibold text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Login to Existing Account
              </button>
              <button
                onClick={handleOpenSignup}
                className="w-full py-2.5 text-center text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs transition-colors"
              >
                Get Started Free (7-Day Trial)
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section id="home" className="pt-20 pb-16 md:pt-28 md:pb-20 px-4 md:px-8 text-center max-w-5xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 text-xs font-medium">
          <FileText className="w-3.5 h-3.5" />
          <span>Professional Quotation & Invoice Platform</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-950 dark:text-white leading-[1.12]">
          Create Commercial Quotations & Invoices in Minutes.
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
          Easyworks delivers clean structured document editors, automatic deterministic tax & discount calculations, multiple curated template designs, and instant client-ready PDF downloads.
        </p>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleOpenSignup}
            className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Create Free Document</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <a
            href="#templates"
            className="w-full sm:w-auto px-6 py-3.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/80 text-slate-800 dark:text-zinc-200 font-semibold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center"
          >
            Explore Design Templates
          </a>
        </div>

        <div className="pt-4 flex items-center justify-center gap-6 text-xs text-slate-500 dark:text-zinc-500">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            No credit card needed
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Instant PDF & Print
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            GST / VAT Compliant
          </span>
        </div>
      </section>

      {/* Feature Pillars */}
      <section id="features" className="py-20 bg-white dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 md:px-8 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              Everything Needed for Seamless Business Billing
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-xl mx-auto">
              Purpose-built for contractors, agencies, freelancers, and businesses of every trade.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#fafafa] dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Structured Quotations</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Add items, quantities, custom units, line discounts, and scope descriptions. Convert accepted quotations directly into official tax invoices with 1 click.
              </p>
            </div>

            <div className="bg-[#fafafa] dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Tax Invoices & Payments</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Track payments received and balance due. Provide your bank name, account number, IFSC, and UPI ID for swift settlement.
              </p>
            </div>

            <div className="bg-[#fafafa] dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Multiple Design Templates</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Choose between Modern Executive, Corporate Classic, and Clean Minimalist styles for both quotations and invoices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Templates Showcase Section */}
      <section id="templates" className="py-20 bg-slate-50 dark:bg-zinc-900/40 border-t border-slate-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 md:px-8 space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              Curated Document Templates
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Tailored visual identities reflecting your brand and business maturity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3 shadow-2xs">
              <div className="h-32 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 p-3.5 flex flex-col justify-between">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-blue-600">MODERN</span>
                  <span className="text-[10px] text-slate-400">#2563EB</span>
                </div>
                <div className="space-y-1">
                  <div className="h-2 w-3/4 bg-blue-200 dark:bg-blue-800 rounded"></div>
                  <div className="h-2 w-1/2 bg-blue-100 dark:bg-blue-900 rounded"></div>
                </div>
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Modern Executive</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Bold accent header bars and crisp high-contrast layout for tech, creative agencies, and modern contractors.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3 shadow-2xs">
              <div className="h-32 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3.5 flex flex-col justify-between font-serif">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">CLASSIC</span>
                  <span className="text-[10px] text-slate-400">CORPORATE</span>
                </div>
                <div className="space-y-1">
                  <div className="h-2 w-3/4 bg-slate-300 dark:bg-zinc-600 rounded"></div>
                  <div className="h-2 w-1/2 bg-slate-200 dark:bg-zinc-700 rounded"></div>
                </div>
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Corporate Classic</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Formal boxed grids, serif typography, and prominent corporate seal and signatory areas for traditional industries.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3 shadow-2xs">
              <div className="h-32 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3.5 flex flex-col justify-between">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-600 dark:text-zinc-400">MINIMALIST</span>
                  <span className="text-[10px] text-slate-400">HAIRLINE</span>
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 w-3/4 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
                  <div className="h-1.5 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                </div>
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Clean Minimalist</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Lightweight borders, maximized whitespace, and refined typography for consultants, architects, and designers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 border-t border-slate-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/30">
        <PricingView embedded={false} />
      </section>

      {/* Target Industries Grid */}
      <section id="industries" className="py-20 border-t border-slate-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 md:px-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              Built for Any Business
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Contractors, fabricators, agencies, consultants, service providers and trades.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {industries.map((ind, i) => (
              <div
                key={i}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl text-center text-xs font-semibold text-slate-800 dark:text-zinc-200 hover:border-blue-300 dark:hover:border-blue-700 transition-colors shadow-2xs"
              >
                {ind}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-slate-900 dark:bg-zinc-900 text-white border-t border-slate-800 text-center px-4">
        <div className="max-w-3xl mx-auto space-y-5">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            Ready to create professional quotations and invoices?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
            Start drafting, saving, and downloading your documents now in seconds.
          </p>
          <div className="pt-2">
            <button
              onClick={handleOpenSignup}
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-500/25 active:scale-98 transition-all cursor-pointer"
            >
              Start Free Workspace
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-slate-950 text-slate-500 text-xs border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
              EW
            </div>
            <span className="font-semibold text-slate-300">Easyworks</span>
            <span>• Quotation & Invoice Platform</span>
          </div>
          <div>© {new Date().getFullYear()} Easyworks. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
