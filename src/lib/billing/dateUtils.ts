/**
 * Calendar-accurate date handling for subscriptions and trials.
 * Uses authoritative server-side dates.
 */

/**
 * Adds exact calendar months to a date without month-end drift.
 * e.g., Jan 31 + 1 month = Feb 28 (or 29 in leap year).
 */
export function addCalendarMonths(startDate: Date, months: number): Date {
  const result = new Date(startDate.getTime());
  const currentDay = result.getDate();
  
  result.setMonth(result.getMonth() + months);
  
  // Check if month rolled over beyond intended month (e.g. Feb 31 -> March 3)
  if (result.getDate() < currentDay) {
    result.setDate(0); // Set to last day of previous month
  }
  
  return result;
}

/**
 * Calculates remaining trial days relative to server time.
 */
export function getTrialRemainingDays(trialEndsAt: string | Date): number {
  const now = Date.now();
  const end = new Date(trialEndsAt).getTime();
  const diffMs = end - now;
  
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Formats ISO date to readable string (e.g. "19 Dec 2026").
 */
export function formatBillingDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Computes authoritative subscription status based on server timestamps.
 */
import { SubscriptionStatus } from '@/types';

export function evaluateSubscriptionStatus(sub: {
  status: string;
  trialEndsAt: string;
  subscriptionEndsAt: string | null;
}): {
  effectiveStatus: SubscriptionStatus;
  hasAccess: boolean;
  daysRemaining: number;
} {
  const now = new Date();
  const nowTime = now.getTime();

  // If explicitly suspended by admin
  if (sub.status === 'SUSPENDED') {
    return {
      effectiveStatus: 'SUSPENDED',
      hasAccess: false,
      daysRemaining: 0,
    };
  }

  // If already active paid subscription
  if (sub.status === 'ACTIVE' && sub.subscriptionEndsAt) {
    const paidEnd = new Date(sub.subscriptionEndsAt).getTime();
    if (nowTime <= paidEnd) {
      const days = Math.ceil((paidEnd - nowTime) / (1000 * 60 * 60 * 24));
      return {
        effectiveStatus: 'ACTIVE',
        hasAccess: true,
        daysRemaining: days,
      };
    } else {
      return {
        effectiveStatus: 'EXPIRED',
        hasAccess: false,
        daysRemaining: 0,
      };
    }
  }

  // If manual payment is pending verification
  if (sub.status === 'PAYMENT_PENDING') {
    const paidEnd = sub.subscriptionEndsAt ? new Date(sub.subscriptionEndsAt).getTime() : 0;
    const trialEnd = sub.trialEndsAt ? new Date(sub.trialEndsAt).getTime() : 0;
    const hasPaidAccess = paidEnd > nowTime;
    const hasTrialAccess = trialEnd > nowTime;
    const days = hasPaidAccess
      ? Math.ceil((paidEnd - nowTime) / (1000 * 60 * 60 * 24))
      : hasTrialAccess
      ? Math.ceil((trialEnd - nowTime) / (1000 * 60 * 60 * 24))
      : 0;
    return {
      effectiveStatus: 'PAYMENT_PENDING',
      hasAccess: hasPaidAccess || hasTrialAccess,
      daysRemaining: days,
    };
  }

  // If manual payment was rejected
  if (sub.status === 'PAYMENT_REJECTED') {
    const trialEnd = new Date(sub.trialEndsAt).getTime();
    const trialValid = nowTime <= trialEnd;
    const days = trialValid ? Math.ceil((trialEnd - nowTime) / (1000 * 60 * 60 * 24)) : 0;
    return {
      effectiveStatus: 'PAYMENT_REJECTED',
      hasAccess: trialValid,
      daysRemaining: days,
    };
  }

  // If in trial mode
  if (sub.status === 'TRIALING' || sub.status === 'TRIAL') {
    const trialEnd = new Date(sub.trialEndsAt).getTime();
    if (nowTime <= trialEnd) {
      const days = Math.ceil((trialEnd - nowTime) / (1000 * 60 * 60 * 24));
      return {
        effectiveStatus: 'TRIALING',
        hasAccess: true,
        daysRemaining: days,
      };
    } else {
      return {
        effectiveStatus: 'EXPIRED',
        hasAccess: false,
        daysRemaining: 0,
      };
    }
  }

  // Cancelled or payment failed or past due
  if (sub.status === 'CANCELLED' || sub.status === 'PAST_DUE' || sub.status === 'PAYMENT_FAILED') {
    return {
      effectiveStatus: sub.status as any,
      hasAccess: false,
      daysRemaining: 0,
    };
  }

  return {
    effectiveStatus: 'EXPIRED',
    hasAccess: false,
    daysRemaining: 0,
  };
}

