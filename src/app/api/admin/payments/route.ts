import { NextRequest } from 'next/server';
import {
  getAllManualPaymentRequests,
  approveManualPayment,
  rejectManualPayment,
} from '@/lib/db/database';
import { apiSuccess, apiError, safeReadBody, withApiRouteHandler } from '@/lib/api/server';
import { broadcastAdminEvent, broadcastCustomerEvent } from '@/lib/realtime/eventBus';

export const GET = withApiRouteHandler('GET /api/admin/payments', async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    const requests = getAllManualPaymentRequests(status);
    return apiSuccess({ requests });
  } catch (error: any) {
    console.error('[GET /api/admin/payments] Error:', error);
    return apiError(error.message || 'Failed to fetch payments', 500);
  }
});

export const POST = withApiRouteHandler('POST /api/admin/payments', async (req: NextRequest) => {
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
      const targetUserId = result.subscription?.userId;
      try {
        broadcastAdminEvent('PAYMENT_APPROVED', {
          requestId,
          userId: targetUserId,
          planId: result.subscription?.planId,
          payment: result.payment,
        });
        if (targetUserId) {
          broadcastCustomerEvent(targetUserId, 'PAYMENT_STATUS_CHANGED', {
            status: 'APPROVED',
            requestId,
            subscription: result.subscription,
            payment: result.payment,
          });
          broadcastCustomerEvent(targetUserId, 'SUBSCRIPTION_UPDATED', {
            subscription: result.subscription,
          });
        }
      } catch (e) {
        console.warn('[admin/payments] Realtime broadcast error:', e);
      }

      return apiSuccess({
        message: 'Payment approved and subscription activated',
        payment: result.payment || {},
        subscription: result.subscription || {},
      });
    } else if (action === 'REJECT') {
      const rejectionReason = reason || 'Payment reference / UTR could not be verified.';
      const res = rejectManualPayment(requestId, rejectionReason, adminName || 'Admin');
      const targetUserId = res?.userId;

      try {
        broadcastAdminEvent('PAYMENT_REJECTED', {
          requestId,
          userId: targetUserId,
          reason: rejectionReason,
        });
        if (targetUserId) {
          broadcastCustomerEvent(targetUserId, 'PAYMENT_STATUS_CHANGED', {
            status: 'REJECTED',
            requestId,
            reason: rejectionReason,
          });
        }
      } catch (e) {
        console.warn('[admin/payments] Realtime broadcast error:', e);
      }

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
});

