import { NextRequest, NextResponse } from 'next/server';
import { ensureUserAndTrial, getUserSubscription, getUserPayments, getTrialIdentityByUserId } from '@/lib/db/database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const subscription = getUserSubscription(userId);
    if (!subscription) {
      return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 });
    }

    const payments = getUserPayments(userId);
    const trialIdentity = getTrialIdentityByUserId(userId);

    return NextResponse.json({
      success: true,
      subscription,
      payments,
      trialIdentity,
      isSuspended: subscription.status === 'SUSPENDED',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, email, name, businessName } = body;

    if (!userId || !email) {
      return NextResponse.json(
        { success: false, error: 'User ID and email are required' },
        { status: 400 }
      );
    }

    const { user, subscription } = ensureUserAndTrial(userId, email, name || 'User', businessName);
    const payments = getUserPayments(userId);

    return NextResponse.json({
      success: true,
      user,
      subscription,
      payments,
      isSuspended: subscription.status === 'SUSPENDED' || user?.status === 'SUSPENDED',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
