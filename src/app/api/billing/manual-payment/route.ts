import { NextRequest, NextResponse } from 'next/server';
import {
  createManualPaymentRequest,
  getUserManualPayments,
  getUserSubscription,
} from '@/lib/db/database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const requests = getUserManualPayments(userId);
    const subscription = getUserSubscription(userId);

    return NextResponse.json({
      success: true,
      requests,
      subscription,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, planId, utrNumber, screenshotUrl, notes } = body;

    if (!userId || !planId || !utrNumber) {
      return NextResponse.json(
        {
          success: false,
          error: 'User ID, Plan ID, and Transaction ID / UTR number are required.',
        },
        { status: 400 }
      );
    }

    if (utrNumber.trim().length < 4) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please enter a valid Transaction ID / UTR number (at least 4 characters).',
        },
        { status: 400 }
      );
    }

    const paymentRequest = createManualPaymentRequest({
      userId,
      planId,
      utrNumber: utrNumber.trim(),
      screenshotUrl,
      notes,
    });

    const updatedSubscription = getUserSubscription(userId);

    return NextResponse.json({
      success: true,
      message: 'Payment confirmation submitted successfully. Awaiting admin verification.',
      paymentRequest,
      subscription: updatedSubscription,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
