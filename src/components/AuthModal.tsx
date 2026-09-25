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
  ShieldCheck,
  Phone,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { isDisposableEmail } from '@/lib/abuse/disposableEmails';

type SignupStep = 'details' | 'verify_email' | 'phone_entry' | 'verify_phone' | 'eligibility_result';

export default function AuthModal() {
  const { authModalOpen, setAuthModalOpen, authMode, setAuthMode, login, setCurrentView } = useApp();

  // Basic Account Credentials
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Multi-step signup state
  const [signupStep, setSignupStep] = useState<SignupStep>('details');
  const [emailOtp, setEmailOtp] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [tempUserId, setTempUserId] = useState('');

  // Eligibility evaluation state
  const [eligibilityResult, setEligibilityResult] = useState<{
    status: 'ELIGIBLE' | 'REQUIRES_VERIFICATION' | 'REVIEW_REQUIRED' | 'NOT_ELIGIBLE';
    message: string;
    flagReason?: string;
  } | null>(null);

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
    const uId = 'usr_' + Date.now();
    setTempUserId(uId);

    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: cleanEmail, channel: 'EMAIL', userId: uId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send email verification code.');
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
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: email.trim(),
          code: emailOtp.trim(),
          channel: 'EMAIL',
          userId: tempUserId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid verification code.');
      }

      setSignupStep('phone_entry');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Signup Step 3: Send Phone OTP
  // -------------------------------------------------------------
  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.replace(/[^\d]/g, '').length < 10) {
      setError('Please enter a valid 10-digit mobile number with country code (e.g. +91 95399 33265).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: cleanPhone, channel: 'SMS', userId: tempUserId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send SMS code.');
      }

      setSignupStep('verify_phone');
      startResendCountdown();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Signup Step 4: Verify Phone OTP & Trigger Eligibility Check
  // -------------------------------------------------------------
  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phoneOtp.trim() || phoneOtp.trim().length !== 6) {
      setError('Please enter the 6-digit phone code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: phone.trim(),
          code: phoneOtp.trim(),
          channel: 'SMS',
          userId: tempUserId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid SMS code.');
      }

      // Check eligibility result
      if (data.eligibility) {
        setEligibilityResult(data.eligibility);
        setSignupStep('eligibility_result');

        if (data.eligibility.status === 'ELIGIBLE') {
          // Immediately log in
          setTimeout(() => {
            login(email.trim(), name.trim(), businessName.trim());
          }, 1500);
        }
      } else {
        // Fallback check
        const checkRes = await fetch(`/api/auth/trial-eligibility?userId=${tempUserId}`);
        const checkData = await checkRes.json();
        setEligibilityResult(checkData);
        setSignupStep('eligibility_result');

        if (checkData.status === 'ELIGIBLE') {
          setTimeout(() => {
            login(email.trim(), name.trim(), businessName.trim());
          }, 1500);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Resend code handler
  const handleResend = async (channel: 'EMAIL' | 'SMS') => {
    if (resendTimer > 0) return;
    setError(null);
    setLoading(true);
    try {
      const target = channel === 'EMAIL' ? email.trim() : phone.trim();
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, channel, userId: tempUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
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
                onClick={() => handleResend('EMAIL')}
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline disabled:text-slate-400 cursor-pointer"
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Signup Mode: Step 3 Phone Entry */}
        {/* ------------------------------------------------------------------ */}
        {authMode === 'signup' && signupStep === 'phone_entry' && (
          <form onSubmit={handleSendPhoneOtp} className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 text-slate-600 dark:text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Email verified successfully! Now verify your mobile number.</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Mobile Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 95399 33265"
                  className="w-full h-10 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 pl-10 pr-3.5 rounded-xl text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Exactly one 7-day free trial is permitted per verified phone number.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{loading ? 'Sending SMS...' : 'Send SMS Verification Code'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Signup Mode: Step 4 Phone OTP */}
        {/* ------------------------------------------------------------------ */}
        {authMode === 'signup' && signupStep === 'verify_phone' && (
          <form onSubmit={handleVerifyPhoneOtp} className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-slate-600 dark:text-blue-200 text-xs">
              <p className="font-semibold text-blue-900 dark:text-blue-100 mb-0.5">Enter SMS Code</p>
              We sent a 6-digit SMS verification code to <span className="font-medium text-blue-600">{phone}</span>.
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                6-Digit SMS Verification Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
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
              <span>{loading ? 'Activating Free Trial...' : 'Verify & Activate 7-Day Free Trial'}</span>
              <ShieldCheck className="w-4 h-4" />
            </button>

            <div className="flex justify-between items-center text-[11px] pt-1">
              <button
                type="button"
                onClick={() => setSignupStep('phone_entry')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
              >
                Change Phone
              </button>
              <button
                type="button"
                disabled={resendTimer > 0}
                onClick={() => handleResend('SMS')}
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline disabled:text-slate-400 cursor-pointer"
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Signup Mode: Step 5 Eligibility Result Display */}
        {/* ------------------------------------------------------------------ */}
        {authMode === 'signup' && signupStep === 'eligibility_result' && eligibilityResult && (
          <div className="space-y-4 text-center">
            {eligibilityResult.status === 'ELIGIBLE' && (
              <div className="py-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">7-Day Free Trial Activated!</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 px-4">
                  Welcome to Easyworks. You have full access to templates, quotations, invoices, and 2 free PDF
                  downloads.
                </p>
                <div className="mt-5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                  Launching your workspace...
                </div>
              </div>
            )}

            {eligibilityResult.status === 'REVIEW_REQUIRED' && (
              <div className="py-2 text-left">
                <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 mb-3">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-center text-slate-900 dark:text-white">
                  Trial Pending Verification Review
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 text-center mt-1 mb-4">
                  Our automated security system flagged this registration for standard review before trial activation.
                </p>

                {eligibilityResult.flagReason && (
                  <div className="p-3 mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs">
                    <p className="font-semibold mb-1">Reason for review:</p>
                    <p className="text-[11px] opacity-90">{eligibilityResult.flagReason}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setAuthModalOpen(false);
                      setCurrentView('pricing');
                    }}
                    className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Subscribe Now (₹249/mo) for Instant Unlimited Access
                  </button>

                  <button
                    onClick={() => {
                      login(email.trim(), name.trim(), businessName.trim());
                      setAuthModalOpen(false);
                    }}
                    className="w-full h-9 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-medium rounded-xl hover:bg-slate-200 cursor-pointer"
                  >
                    Continue to Dashboard (Read-Only)
                  </button>
                </div>
              </div>
            )}

            {eligibilityResult.status === 'NOT_ELIGIBLE' && (
              <div className="py-2 text-left">
                <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 mb-3">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-center text-slate-900 dark:text-white">
                  Free Trial Already Claimed
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 text-center mt-1 mb-4">
                  This phone number has already been used to claim a 7-day free trial on Easyworks. Free trials are limited to one per customer/business.
                </p>

                <div className="p-3 mb-4 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-700 dark:text-zinc-300">
                  <p className="font-semibold text-slate-900 dark:text-white mb-1">Upgrade to Continue</p>
                  Get unlimited quotations, invoices, templates, and up to 120 PDF downloads starting at just ₹249.
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setAuthModalOpen(false);
                      setCurrentView('pricing');
                    }}
                    className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    Select Plan (Starting at ₹249)
                  </button>

                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setSignupStep('details');
                    }}
                    className="w-full h-9 text-blue-600 dark:text-blue-400 text-xs font-medium hover:underline cursor-pointer text-center"
                  >
                    Sign in with your existing account
                  </button>
                </div>
              </div>
            )}
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
