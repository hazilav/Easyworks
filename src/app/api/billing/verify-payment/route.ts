import { NextRequest, NextResponse } from 'next/server';
import {
  getPlanById,
  getUserSubscription,
  activateSubscription,
  recordPayment,
} from '@/lib/db/database';
import { verifyPaymentSignature } from '@/lib/billing/razorpay';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      planId,
      orderId,
      paymentId,
      signature,
      paymentMethod,
    } = body;

    if (!userId || !planId || !orderId || !paymentId || !signature) {
      return NextResponse.json(
        { success: false, error: 'Missing payment verification credentials' },
        { status: 400 }
      );
    }

    const plan = getPlanById(planId);
    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    const sub = getUserSubscription(userId);
    if (!sub) {
      return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 });
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

      return NextResponse.json(
        { success: false, error: 'Payment signature verification failed' },
        { status: 400 }
      );
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

    return NextResponse.json({
      success: true,
      subscription: updatedSub,
      payment,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
