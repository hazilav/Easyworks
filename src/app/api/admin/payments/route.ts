import { NextRequest, NextResponse } from 'next/server';
import {
  getAllManualPaymentRequests,
  approveManualPayment,
  rejectManualPayment,
} from '@/lib/db/database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    const requests = getAllManualPaymentRequests(status);
    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requestId, action, reason, adminName } = body;

    if (!requestId || !action) {
      return NextResponse.json(
        { success: false, error: 'Request ID and action (APPROVE or REJECT) are required' },
        { status: 400 }
      );
    }

    if (action === 'APPROVE') {
      const result = approveManualPayment(requestId, adminName || 'Admin');
      return NextResponse.json({
        success: true,
        message: 'Payment approved and subscription activated successfully.',
        subscription: result.subscription,
      });
    } else if (action === 'REJECT') {
      const rejectionReason = reason || 'Payment reference / UTR could not be verified.';
      const result = rejectManualPayment(requestId, rejectionReason, adminName || 'Admin');
      return NextResponse.json({
        success: true,
        message: 'Payment request marked as rejected.',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be APPROVE or REJECT.' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
