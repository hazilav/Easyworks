import { NextRequest, NextResponse } from 'next/server';
import {
  getAllSubscribers,
  getAllCustomPlanRequests,
  getAllPlans,
  adminOverrideSubscription,
  getPaymentSettings,
  getAllManualPaymentRequests,
} from '@/lib/db/database';
import { getPublicGatewayConfig } from '@/lib/billing/razorpay';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export async function GET(req: NextRequest) {
  try {
    const subscribers = getAllSubscribers();
    const customRequests = getAllCustomPlanRequests();
    const plans = getAllPlans(true);
    const gatewayConfig = getPublicGatewayConfig();
    const paymentSettings = getPaymentSettings();
    const manualPayments = getAllManualPaymentRequests();

    return apiSuccess({
      subscribers,
      customRequests,
      plans,
      gatewayConfig,
      paymentSettings,
      manualPayments,
    });
  } catch (error: any) {
    console.error('[GET /api/admin/billing] Error:', error);
    return apiError(error.message || 'Failed to fetch billing data', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const { userId, action, planId } = parsed.body || {};

    if (!userId || !action) {
      return apiError('User ID and action are required', 400);
    }

    const updatedSub = adminOverrideSubscription(userId, action, planId);
    return apiSuccess({ subscription: updatedSub });
  } catch (error: any) {
    console.error('[POST /api/admin/billing] Error:', error);
    return apiError(error.message || 'Failed to override subscription', 500);
  }
}
