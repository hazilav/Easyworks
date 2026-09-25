import { NextRequest, NextResponse } from 'next/server';
import {
  isWebhookEventProcessed,
  recordWebhookEvent,
  activateSubscription,
  recordPayment,
  getUserSubscription,
} from '@/lib/db/database';
import { verifyWebhookSignature } from '@/lib/billing/razorpay';
import { apiSuccess, apiError } from '@/lib/api/server';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || '';

    // 1. Signature Verification
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return apiError('Invalid webhook signature', 400);
    }

    let event: any;
    try {
      event = rawBody && rawBody.trim() ? JSON.parse(rawBody) : {};
    } catch (parseErr) {
      return apiError('Malformed webhook JSON payload', 400);
    }

    const eventId = event.event_id || event.id || `evt_${Date.now()}`;
    const eventType = event.event || 'unknown';

    // 2. Idempotency Check
    if (isWebhookEventProcessed(eventId)) {
      return apiSuccess({
        message: 'Event already processed (idempotent)',
        eventId,
      });
    }

    // 3. Process Event
    const payload = event.payload || {};

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = payload.payment?.entity || {};
      const notes = paymentEntity.notes || {};
      const userId = notes.userId;
      const planId = notes.planId;

      if (userId && planId) {
        const sub = getUserSubscription(userId);
        if (sub) {
          activateSubscription({
            userId,
            planId,
            gatewaySubscriptionId: paymentEntity.order_id,
          });

          recordPayment({
            userId,
            subscriptionId: sub.id,
            planId,
            planName: notes.planName || 'Pro Plan',
            amountINR: Math.round((paymentEntity.amount || 0) / 100),
            currency: paymentEntity.currency || 'INR',
            status: 'SUCCESS',
            gatewayPaymentId: paymentEntity.id,
            gatewayOrderId: paymentEntity.order_id,
            paymentMethod: paymentEntity.method,
          });
        }
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = payload.payment?.entity || {};
      const notes = paymentEntity.notes || {};
      const userId = notes.userId;
      const planId = notes.planId;

      if (userId && planId) {
        const sub = getUserSubscription(userId);
        if (sub) {
          recordPayment({
            userId,
            subscriptionId: sub.id,
            planId,
            planName: notes.planName || 'Pro Plan',
            amountINR: Math.round((paymentEntity.amount || 0) / 100),
            currency: paymentEntity.currency || 'INR',
            status: 'FAILED',
            gatewayPaymentId: paymentEntity.id,
            gatewayOrderId: paymentEntity.order_id,
            paymentMethod: paymentEntity.method,
          });
        }
      }
    }

    // 4. Record event for idempotency
    recordWebhookEvent(eventId, eventType, event);

    return apiSuccess({ processed: true, eventId });
  } catch (error: any) {
    console.error('[POST /api/billing/webhooks] Webhook error:', error);
    return apiError(error.message || 'Webhook processing failed', 500);
  }
}
