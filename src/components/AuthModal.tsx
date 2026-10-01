'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  X,
  Sparkles,
  Lock,
  Mail,
  Building2,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { isDisposableEmail } from '@/lib/abuse/disposableEmails';
import { safeFetchJson } from '@/lib/api/client';

type SignupStep = 'details' | 'verify_email' | 'success';

function getFriendlyErrorMessage(
  data: any,
  fallbackError?: string,
  defaultMsg: string = 'An error occurred while creating your account.'
): string {
  const errCode = data?.error || data?.code;
  if (errCode === 'EMAIL_CONFIG_MISSING') {
    return 'Email service is temporarily unavailable. Please contact support or try again later.';
  }
  if (errCode === 'EMAIL_SEND_FAILED') {
    return 'Failed to send verification code. Please check your email address and try again.';
  }
  if (errCode === 'RATE_LIMITED') {
    return data?.message || 'Please wait before requesting another verification code.';
  }
  if (errCode === 'EMAIL_ALREADY_REGISTERED') {
    return 'An account with this email already exists. Please log in.';
  }
  return data?.message || data?.error || fallbackError || defaultMsg;
}

export default function AuthModal() {
  const { authModalOpen, setAuthModalOpen, authMode, setAuthMode, login } = useApp();

  // Basic Account Credentials
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Multi-step signup state
  const [signupStep, setSignupStep] = useState<SignupStep>('details');
  const [emailOtp, setEmailOtp] = useState('');
  const [signupSessionId, setSignupSessionId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  if (!authModalOpen) return null;

  const startResendCountdown = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // -------------------------------------------------------------
  // Regular Sign In
  // -------------------------------------------------------------
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);
    setTimeout(() => {
      login(email, name, businessName);
      setLoading(false);
      setAuthModalOpen(false);
    }, 400);
  };

  // -------------------------------------------------------------
  // Demo 1-Click Login
  // -------------------------------------------------------------
  const handleDemoSignIn = (role: 'interior' | 'tech') => {
    if (role === 'interior') {
      login('interior.pro@easyworks.com', 'Sameer Khan', 'Apex Interior Studio');
    } else {
      login('agency.leads@easyworks.com', 'Priya Menon', 'NextGen Digital Solutions');
    }
    setAuthModalOpen(false);
  };

  // -------------------------------------------------------------
  // Signup Step 1: Submit Details & Send Email OTP
  // -------------------------------------------------------------
  const handleSignupStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter a valid email address.');
      return;
    }

    if (isDisposableEmail(cleanEmail)) {
      setError('Disposable email addresses are not permitted. Please use a work or personal email.');
      return;
    }

    setLoading(true);

    try {
      const { ok, data, error } = await safeFetchJson<{
        success?: boolean;
        error?: string;
        message?: string;
        code?: string;
        signupSessionId?: string;
      }>('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: cleanEmail, channel: 'EMAIL' }),
      });

      if (!ok) {
        throw new Error(getFriendlyErrorMessage(data, error, 'Failed to send email verification code.'));
      }

      if (data?.signupSessionId) {
        setSignupSessionId(data.signupSessionId);
      }

      setSignupStep('verify_email');
      startResendCountdown();
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating your account.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Signup Step 2: Verify Email OTP
  // -------------------------------------------------------------
  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!emailOtp.trim() || emailOtp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const { ok, data, error } = await safeFetchJson<{
        success?: boolean;
        error?: string;
        code?: string;
        user?: any;
        subscription?: any;
      }>('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: email.trim(),
          code: emailOtp.trim(),
          channel: 'EMAIL',
          signupSessionId,
          name: name.trim(),
          businessName: businessName.trim(),
        }),
      });

      if (!ok) {
        throw new Error(data?.error || error || 'Invalid verification code.');
      }

      setSignupStep('success');

      // Immediately activate workspace in Customer Panel
      const resolvedUserId = data?.user?.id;
      setTimeout(() => {
        login(email.trim(), name.trim(), businessName.trim(), resolvedUserId);
      }, 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Resend code handler (Email only)
  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError(null);
    setLoading(true);
    try {
      const { ok, data, error } = await safeFetchJson<{ success?: boolean; error?: string; message?: string; signupSessionId?: string }>('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: email.trim(), channel: 'EMAIL', signupSessionId }),
      });
      if (!ok) {
        throw new Error(getFriendlyErrorMessage(data, error, 'Failed to resend code'));
      }
      if (data?.signupSessionId) setSignupSessionId(data.signupSessionId);
      startResendCountdown();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 md:p-8 overflow-hidden font-sans">
        {/* Close Button */}
        <button
          onClick={() => {
            setAuthModalOpen(false);
            setSignupStep('details');
            setError(null);
          }}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo & Headline */}
        <div className="text-center mb-6">
          <div className="w-10 h-10 mx-auto rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20 mb-3">
            <Sparkles className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {authMode === 'login' ? 'Sign in to Easyworks' : 'Start Your 7-Day Free Trial'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            {authMode === 'login'
              ? 'Access your private workspace and document pipeline'
              : 'Create quotations, invoices & download up to 2 PDFs. 100% free, no credit card required.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Sign In Mode */}
        {/* ------------------------------------------------------------------ */}
        {authMode === 'login' && (
          <form onSubmit={handleSignIn} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full h-10 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 pl-10 pr-3.5 rounded-xl text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 pl-10 pr-3.5 rounded-xl text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 mt-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <span>{loading ? 'Entering Workspace...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Signup Mode: Step 1 Details */}
        {/* ------------------------------------------------------------------ */}
        {authMode === 'signup' && signupStep === 'details' && (
          <form onSubmit={handleSignupStep1} className="space-y-3 text-xs">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Your Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sameer Khan"
                  className="w-full h-10 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 pl-10 pr-3.5 rounded-xl text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Business / Company Name
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Modern Craft Woodworks"
                  className="w-full h-10 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 pl-10 pr-3.5 rounded-xl text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full h-10 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 pl-10 pr-3.5 rounded-xl text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Disposable/temporary emails are automatically blocked.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">Create Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 pl-10 pr-3.5 rounded-xl text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 mt-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <span>{loading ? 'Verifying Email...' : 'Continue to Email Verification'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Signup Mode: Step 2 Email OTP */}
        {/* ------------------------------------------------------------------ */}
        {authMode === 'signup' && signupStep === 'verify_email' && (
          <form onSubmit={handleVerifyEmailOtp} className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-slate-600 dark:text-blue-200 text-xs">
              <p className="font-semibold text-blue-900 dark:text-blue-100 mb-0.5">Check your inbox</p>
              We sent a 6-digit verification code to <span className="font-medium text-blue-600">{email}</span>.
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                6-Digit Email Verification Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full h-11 text-center tracking-widest text-base font-bold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 pl-10 pr-3.5 rounded-xl focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{loading ? 'Verifying Code...' : 'Verify Email & Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex justify-between items-center text-[11px] pt-1">
              <button
                type="button"
                onClick={() => setSignupStep('details')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
              >
                Change Email
              </button>
              <button
                type="button"
                disabled={resendTimer > 0}
                onClick={handleResend}
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline disabled:text-slate-400 cursor-pointer"
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Signup Mode: Step 3 Success & Instant Free Trial Activation */}
        {/* ------------------------------------------------------------------ */}
        {authMode === 'signup' && signupStep === 'success' && (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 mb-3 animate-in zoom-in-50 duration-200">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">7-Day Free Trial Activated!</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 px-4">
              Welcome to Easyworks. You have full access to templates, quotations, invoices, and 2 free PDF downloads.
            </p>
            <div className="mt-5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
              Launching your workspace...
            </div>
          </div>
        )}

        {/* Demo Fast Login Buttons */}
        {authMode === 'login' && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800 text-center">
            <p className="text-[11px] text-slate-400 font-medium mb-2.5">Quick 1-click Demo Accounts:</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDemoSignIn('interior')}
                className="flex-1 h-8 px-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                Interior Design Co
              </button>
              <button
                onClick={() => handleDemoSignIn('tech')}
                className="flex-1 h-8 px-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                Digital Agency
              </button>
            </div>
          </div>
        )}

        {/* Switch Mode */}
        {signupStep === 'details' && (
          <div className="mt-4 text-center text-xs text-slate-500 dark:text-zinc-400">
            {authMode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button
                  onClick={() => {
                    setAuthMode('signup');
                    setSignupStep('details');
                    setError(null);
                  }}
                  className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                >
                  Sign up free
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setSignupStep('details');
                    setError(null);
                  }}
                  className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
