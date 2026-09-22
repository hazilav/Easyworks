import { NextRequest, NextResponse } from 'next/server';
import { getPlanById, getUserSubscription } from '@/lib/db/database';
import { createGatewayOrder, getPublicGatewayConfig } from '@/lib/billing/razorpay';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, planId } = body;

    if (!userId || !planId) {
      return NextResponse.json(
        { success: false, error: 'User ID and Plan ID are required' },
        { status: 400 }
      );
    }

    // Authoritative check on plan from database
    const plan = getPlanById(planId);
    if (!plan || !plan.isActive) {
      return NextResponse.json(
        { success: false, error: 'Plan is not available or inactive' },
        { status: 400 }
      );
    }

    if (plan.isCustom) {
      return NextResponse.json(
        { success: false, error: 'Custom plans require contacting sales via request form' },
        { status: 400 }
      );
    }

    const sub = getUserSubscription(userId);
    if (!sub) {
      return NextResponse.json({ success: false, error: 'User subscription record not found' }, { status: 404 });
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

    return NextResponse.json({
      success: true,
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
