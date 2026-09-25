import { NextRequest, NextResponse } from 'next/server';
import {
  ensureUserAndTrial,
  getUserSubscription,
  getUserPayments,
  getTrialIdentityByUserId,
} from '@/lib/db/database';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return apiError('User ID is required', 400);
    }

    const subscription = getUserSubscription(userId);
    const payments = getUserPayments(userId) || [];
    const trialIdentity = getTrialIdentityByUserId(userId) || null;

    // Requirement 12: Return safe data even when customer has no active subscription
    return apiSuccess({
      subscription: subscription || null,
      payments,
      trialIdentity,
      isSuspended: subscription ? subscription.status === 'SUSPENDED' : false,
      hasActiveSubscription: Boolean(subscription && subscription.status === 'ACTIVE'),
    });
  } catch (error: any) {
    console.error('[GET /api/billing/subscription] Error:', error);
    return apiError(error.message || 'Unable to load subscription data', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const { userId, email, name, businessName } = parsed.body || {};

    if (!userId || !email) {
      return apiError('User ID and email are required', 400);
    }

    const { user, subscription } = ensureUserAndTrial(userId, email, name || 'User', businessName);
    const payments = getUserPayments(userId) || [];

    return apiSuccess({
      user,
      subscription: subscription || null,
      payments,
      isSuspended: subscription?.status === 'SUSPENDED' || user?.status === 'SUSPENDED',
      hasActiveSubscription: Boolean(subscription && subscription.status === 'ACTIVE'),
    });
  } catch (error: any) {
    console.error('[POST /api/billing/subscription] Error:', error);
    return apiError(error.message || 'Failed to sync subscription data', 500);
  }
}
