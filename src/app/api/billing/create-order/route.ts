import { NextRequest, NextResponse } from 'next/server';
import { getPlanById, getUserSubscription } from '@/lib/db/database';
import { createGatewayOrder } from '@/lib/billing/razorpay';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export async function POST(req: NextRequest) {
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const { userId, planId } = parsed.body || {};

    if (!userId || !planId) {
      return apiError('User ID and Plan ID are required', 400);
    }

    // Authoritative check on plan from database
    const plan = getPlanById(planId);
    if (!plan || !plan.isActive) {
      return apiError('Plan is not available or inactive', 400);
    }

    if (plan.isCustom) {
      return apiError('Custom plans require contacting sales via request form', 400);
    }

    const sub = getUserSubscription(userId);
    if (!sub) {
      return apiError('User subscription record not found', 404);
    }

    const receipt = `rcpt_${userId.slice(0, 6)}_${Date.now()}`;
    const order = await createGatewayOrder({
      amountINR: plan.priceINR,
      receipt,
      notes: {
        userId,
        planId: plan.id,
        planName: plan.name,
      },
    });

    return apiSuccess({
      order: {
        orderId: order.orderId,
        amountPaise: order.amountPaise,
        amountINR: order.amountINR,
        currency: order.currency,
        keyId: order.keyId,
        isSimulation: order.isSimulation,
        planId: plan.id,
        planName: plan.name,
        durationMonths: plan.durationMonths,
      },
    });
  } catch (error: any) {
    console.error('[POST /api/billing/create-order] Error:', error);
    return apiError(error.message || 'Failed to create payment order', 500);
  }
}
