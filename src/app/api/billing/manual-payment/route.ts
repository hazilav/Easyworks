import { NextRequest } from 'next/server';
import {
  createManualPaymentRequest,
  getUserManualPayments,
  getUserSubscription,
} from '@/lib/db/database';
import { apiSuccess, apiError, safeReadBody, withApiRouteHandler } from '@/lib/api/server';

export const GET = withApiRouteHandler('GET /api/billing/manual-payment', async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return apiError('User ID is required', 400);
    }

    const requests = getUserManualPayments(userId) || [];
    const subscription = getUserSubscription(userId) || null;

    return apiSuccess({
      requests,
      subscription,
    });
  } catch (error: any) {
    console.error('[GET /api/billing/manual-payment] Error:', error);
    return apiError(error.message || 'Failed to fetch manual payments', 500);
  }
});

export const POST = withApiRouteHandler('POST /api/billing/manual-payment', async (req: NextRequest) => {
  let userId: string | undefined;
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const body = parsed.body || {};
    userId = body.userId;
    const { planId, utrNumber, screenshotUrl, notes } = body;

    if (!userId || !planId || !utrNumber) {
      return apiError('User ID, Plan ID, and Transaction ID / UTR number are required.', 400);
    }

    if (utrNumber.trim().length < 4) {
      return apiError('Please enter a valid Transaction ID / UTR number (at least 4 characters).', 400);
    }

    const paymentRequest = createManualPaymentRequest({
      userId,
      planId,
      utrNumber: utrNumber.trim(),
      screenshotUrl,
      notes,
    });

    const updatedSubscription = getUserSubscription(userId);

    return apiSuccess({
      message: 'Payment confirmation submitted successfully. Awaiting admin verification.',
      paymentRequest,
      subscription: updatedSubscription,
    });
  } catch (error: any) {
    if (error?.message && error.message.includes('User not found')) {
      return apiError('User account not found.', 404, 'USER_NOT_FOUND');
    }
    return apiError(error, 500, 'INTERNAL_SERVER_ERROR', {
      apiRoute: '/api/billing/manual-payment',
      method: 'POST',
      userId,
    });
  }
});

