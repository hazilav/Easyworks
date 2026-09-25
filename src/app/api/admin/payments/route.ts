import { NextRequest, NextResponse } from 'next/server';
import {
  getAllManualPaymentRequests,
  approveManualPayment,
  rejectManualPayment,
} from '@/lib/db/database';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    const requests = getAllManualPaymentRequests(status);
    return apiSuccess({ requests });
  } catch (error: any) {
    console.error('[GET /api/admin/payments] Error:', error);
    return apiError(error.message || 'Failed to fetch payments', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const { requestId, action, reason, adminName } = parsed.body || {};

    if (!requestId || !action) {
      return apiError('Request ID and action (APPROVE or REJECT) are required', 400);
    }

    if (action === 'APPROVE') {
      const result = approveManualPayment(requestId, adminName || 'Admin');
      return apiSuccess({
        message: 'Payment approved and subscription activated',
        payment: result.payment || {},
        subscription: result.subscription || {},
      });
    } else if (action === 'REJECT') {
      const rejectionReason = reason || 'Payment reference / UTR could not be verified.';
      rejectManualPayment(requestId, rejectionReason, adminName || 'Admin');
      return apiSuccess({
        message: 'Payment request marked as rejected.',
      });
    } else {
      return apiError('Invalid action. Must be APPROVE or REJECT.', 400);
    }
  } catch (error: any) {
    console.error('[POST /api/admin/payments] Error:', error);
    return apiError(error.message || 'Payment approval failed', 500);
  }
}
