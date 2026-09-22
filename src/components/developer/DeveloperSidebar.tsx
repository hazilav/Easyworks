'use client';

import React from 'react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Layers,
  ShieldAlert,
  Clock,
  Settings,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Activity,
  X,
} from 'lucide-react';

export type DeveloperTab =
  | 'dashboard'
  | 'customers'
  | 'plans'
  | 'payments'
  | 'security'
  | 'audit'
  | 'settings';

interface DeveloperSidebarProps {
  currentTab: DeveloperTab;
  onSelectTab: (tab: DeveloperTab) => void;
  developerUser: any;
  onLogout: () => void;
  pendingPaymentsCount?: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function DeveloperSidebar({
  currentTab,
  onSelectTab,
  developerUser,
  onLogout,
  pendingPaymentsCount = 0,
  mobileOpen = false,
  onCloseMobile,
}: DeveloperSidebarProps) {
  const navItems = [
    { id: 'dashboard' as DeveloperTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers' as DeveloperTab, label: 'Customers', icon: Users },
    { id: 'plans' as DeveloperTab, label: 'Subscription Plans', icon: Layers },
    {
      id: 'payments' as DeveloperTab,
      label: 'Manual Payments',
      icon: CreditCard,
      badge: pendingPaymentsCount > 0 ? pendingPaymentsCount : undefined,
      badgeColor: 'bg-amber-500 text-black',
    },
    { id: 'security' as DeveloperTab, label: 'Trial & Abuse Security', icon: ShieldAlert },
    { id: 'audit' as DeveloperTab, label: 'Activity & Audit Log', icon: Activity },
    { id: 'settings' as DeveloperTab, label: 'Payment & App Settings', icon: Settings },
  ];

  const handleSelect = (tab: DeveloperTab) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-68 bg-[#0e131f] text-zinc-300 flex flex-col h-full border-r border-zinc-800/80 shrink-0 select-none transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-600/30">
                <span className="text-xs tracking-tighter">DEV</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-bold text-white tracking-tight">Easyworks</h1>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    SUPER_ADMIN
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate max-w-[140px]">
                  Developer Console
                </p>
              </div>
            </div>

            {/* Mobile Close X */}
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer"
              aria-label="Close Developer Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Super Admin Badge Card */}
          <div className="mt-3 p-2.5 rounded-xl bg-blue-950/30 border border-blue-800/30 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {developerUser?.name || 'Muhammed Hazil'}
              </p>
              <p className="text-[10px] text-zinc-400 truncate font-mono">
                {developerUser?.email || 'muhammedhazilav@gmail.com'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
            Management
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      item.badgeColor || 'bg-blue-500 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

        <div className="pt-4 px-3 pb-2 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
          Portals
        </div>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center space-x-2.5">
            <ExternalLink className="w-4 h-4 text-emerald-400" />
            <span>Customer Workspace</span>
          </div>
          <span className="text-[10px] text-zinc-500">Live</span>
        </a>
      </nav>

      {/* Footer / Logout */}
      <div className="p-3 border-t border-zinc-800/80 space-y-2">
        <div className="px-3 py-1 flex items-center justify-between text-[11px] text-zinc-500">
          <span>WhatsApp Hotline</span>
          <span className="text-zinc-400 font-mono">9539933265</span>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-800/30 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit Developer Console</span>
        </button>
      </div>
    </aside>
    </>
  );
}
