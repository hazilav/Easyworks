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

export async function GET(req: NextRequest) {
  try {
    const subscribers = getAllSubscribers();
    const customRequests = getAllCustomPlanRequests();
    const plans = getAllPlans(true);
    const gatewayConfig = getPublicGatewayConfig();
    const paymentSettings = getPaymentSettings();
    const manualPayments = getAllManualPaymentRequests();

    return NextResponse.json({
      success: true,
      subscribers,
      customRequests,
      plans,
      gatewayConfig,
      paymentSettings,
      manualPayments,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, action, planId } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { success: false, error: 'User ID and action are required' },
        { status: 400 }
      );
    }

    const updatedSub = adminOverrideSubscription(userId, action, planId);
    return NextResponse.json({ success: true, subscription: updatedSub });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
