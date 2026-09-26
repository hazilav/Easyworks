'use client';

import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, Phone, Sparkles } from 'lucide-react';
import { safeFetchJson } from '@/lib/api/client';

interface DeveloperLoginViewProps {
  onLoginSuccess: (user: any, token: string) => void;
}

export default function DeveloperLoginView({ onLoginSuccess }: DeveloperLoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { ok, data, error } = await safeFetchJson<{ success?: boolean; token?: string; user?: any; error?: string }>(
        '/api/developer/auth',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        }
      );

      if (!ok || !data?.success || !data.token) {
        throw new Error(data?.error || error || 'Authentication failed. Please verify your credentials.');
      }

      // Store developer session
      localStorage.setItem('ew_developer_token', data.token);
      localStorage.setItem('ew_developer_user', JSON.stringify(data.user));
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Unable to authenticate as Super Admin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0b0f19] text-zinc-100 flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header Badge */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-4">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Developer & Super Admin Portal</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Easyworks</span>
            <span className="text-xs uppercase px-2 py-0.5 rounded bg-blue-600 text-white font-mono">
              Control Plane
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-2">
            Authoritative SaaS Management, Customers, Subscriptions & System Billing
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#121724] border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Developer Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter administrative email"
                  autoComplete="username"
                  className="w-full h-10 pl-10 pr-3.5 bg-[#0e131f] border border-zinc-700/60 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Master Password
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">256-bit Scrypt</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter master password"
                  autoComplete="current-password"
                  className="w-full h-10 pl-10 pr-3.5 bg-[#0e131f] border border-zinc-700/60 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 mt-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Authenticate & Enter Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Info */}
          <div className="mt-6 pt-5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Restricted Access</span>
            </span>
            <a
              href="/"
              className="text-blue-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Customer App</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-[11px] text-center text-zinc-500 mt-6">
          Restricted access. All login attempts and administrative actions are cryptographically signed and logged.
        </p>
      </div>
    </div>
  );
}
