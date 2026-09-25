import { NextRequest, NextResponse } from 'next/server';
import {
  getPlanById,
  getUserSubscription,
  activateSubscription,
  recordPayment,
} from '@/lib/db/database';
import { verifyPaymentSignature } from '@/lib/billing/razorpay';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export async function POST(req: NextRequest) {
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const {
      userId,
      planId,
      orderId,
      paymentId,
      signature,
      paymentMethod,
    } = parsed.body || {};

    if (!userId || !planId || !orderId || !paymentId || !signature) {
      return apiError('Missing payment verification credentials', 400);
    }

    const plan = getPlanById(planId);
    if (!plan) {
      return apiError('Plan not found', 404);
    }

    const sub = getUserSubscription(userId);
    if (!sub) {
      return apiError('Subscription not found', 404);
    }

    // 1. Authoritative Server-Side Signature Verification
    const isValid = verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
    });

    if (!isValid) {
      // Record failed transaction attempt
      recordPayment({
        userId,
        subscriptionId: sub.id,
        planId: plan.id,
        planName: plan.name,
        amountINR: plan.priceINR,
        status: 'FAILED',
        gatewayPaymentId: paymentId,
        gatewayOrderId: orderId,
        paymentMethod: paymentMethod || 'Online Gateway',
      });

      return apiError('Payment signature verification failed', 400);
    }

    // 2. Activate Paid Subscription in Database (with calendar-accurate dates)
    const updatedSub = activateSubscription({
      userId,
      planId: plan.id,
      gatewaySubscriptionId: orderId,
    });

    // 3. Record Immutable Successful Payment
    const payment = recordPayment({
      userId,
      subscriptionId: updatedSub.id,
      planId: plan.id,
      planName: plan.name,
      amountINR: plan.priceINR,
      status: 'SUCCESS',
      gatewayPaymentId: paymentId,
      gatewayOrderId: orderId,
      paymentMethod: paymentMethod || 'UPI / Cards / Netbanking',
    });

    return apiSuccess({
      message: 'Payment verified and subscription activated successfully',
      subscription: updatedSub,
      payment,
    });
  } catch (error: any) {
    console.error('[POST /api/billing/verify-payment] Error:', error);
    return apiError(error.message || 'Payment verification failed', 500);
  }
}
