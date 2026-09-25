'use client';

import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export function useTrialCountdown(trialEndsAt?: string | null) {
  const [displayText, setDisplayText] = useState<string>('7 days remaining');
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [isFinalHour, setIsFinalHour] = useState<boolean>(false);
  const [isUnder24Hours, setIsUnder24Hours] = useState<boolean>(false);

  useEffect(() => {
    if (!trialEndsAt) {
      setDisplayText('7 days remaining');
      setIsExpired(false);
      return;
    }

    const calculateTime = () => {
      const target = new Date(trialEndsAt).getTime();
      const now = Date.now();
      const diffMs = target - now;

      if (diffMs <= 0) {
        setDisplayText('Trial expired');
        setIsExpired(true);
        setIsFinalHour(false);
        setIsUnder24Hours(false);
        return;
      }

      setIsExpired(false);
      const totalSeconds = Math.floor(diffMs / 1000);
      const days = Math.floor(totalSeconds / (3600 * 24));
      const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      if (diffMs > 24 * 3600 * 1000) {
        // More than 24 hours: "X days X hours remaining"
        setDisplayText(`${days} day${days > 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''} remaining`);
        setIsUnder24Hours(false);
        setIsFinalHour(false);
      } else {
        // Under 24 hours: "HH:MM:SS"
        setIsUnder24Hours(true);
        const hh = String(hours).padStart(2, '0');
        const mm = String(minutes).padStart(2, '0');
        const ss = String(seconds).padStart(2, '0');
        setDisplayText(`${hh}:${mm}:${ss}`);

        if (diffMs <= 3600 * 1000) {
          setIsFinalHour(true);
        } else {
          setIsFinalHour(false);
        }
      }
    };

    calculateTime();
    // Recompute every second for smooth ticking
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [trialEndsAt]);

  return { displayText, isExpired, isFinalHour, isUnder24Hours };
}

export default function TrialCountdownBanner() {
  const { subscription, setCurrentView } = useApp();

  if (!subscription || subscription.status === 'ACTIVE') {
    return null;
  }

  const { displayText, isExpired, isFinalHour, isUnder24Hours } = useTrialCountdown(
    subscription.trialEndsAt
  );

  const pdfCount = subscription.trialPdfDownloads ?? 0;
  const maxPdfs = subscription.maxTrialPdfDownloads ?? 2;

  if (isExpired || subscription.status === 'EXPIRED') {
    return (
      <div className="w-full bg-amber-500/10 border-b border-amber-500/30 px-3.5 py-2 flex items-center justify-between text-xs text-amber-300">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Free Trial Expired.</strong> You can view and edit existing documents. Subscribe to unlock full PDF downloads.
          </span>
        </div>
        <button
          onClick={() => setCurrentView('billing')}
          className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
        >
          Subscribe Now
        </button>
      </div>
    );
  }

  return (
    <div
      className={`w-full px-3.5 py-2 flex items-center justify-between text-xs border-b transition-colors ${
        isFinalHour
          ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 animate-pulse'
          : isUnder24Hours
          ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <Clock className={`w-3.5 h-3.5 shrink-0 ${isFinalHour ? 'text-rose-400' : 'text-blue-400'}`} />
        <span>
          Trial countdown:{' '}
          <strong className="font-mono font-bold text-white">{displayText}</strong>
          {' • '}
          PDFs: <strong className="font-mono text-white">{pdfCount}/{maxPdfs}</strong> used
        </span>
      </div>

      <button
        onClick={() => setCurrentView('billing')}
        className="text-[11px] font-semibold text-blue-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
      >
        <span>Upgrade Plan</span>
        <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
