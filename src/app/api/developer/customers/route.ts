import { NextRequest, NextResponse } from 'next/server';
import {
  getAllCustomersWithDetails,
  updateCustomerStatus,
  extendCustomerSubscription,
  changeCustomerPlan,
  cancelCustomerSubscription,
  manuallyActivateSubscription,
  resetCustomerAccess,
  verifyDeveloperSessionToken,
} from '@/lib/db/database';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Developer session required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || undefined;
    const search = searchParams.get('search') || undefined;

    const customers = getAllCustomersWithDetails(filter, search);
    return NextResponse.json({ success: true, customers });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch customers.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Developer session required.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { action, userId, planId, days, reason, durationMonths } = body;

    if (!action || !userId) {
      return NextResponse.json(
        { success: false, error: 'Action and userId are required.' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'SUSPEND': {
        updateCustomerStatus(userId, 'SUSPENDED', reason);
        return NextResponse.json({ success: true, message: 'Customer account suspended.' });
      }

      case 'REACTIVATE': {
        updateCustomerStatus(userId, 'ACTIVE');
        return NextResponse.json({ success: true, message: 'Customer account reactivated.' });
      }

      case 'EXTEND_SUB': {
        const daysNum = parseInt(days, 10) || 30;
        const updatedSub = extendCustomerSubscription(userId, daysNum);
        return NextResponse.json({
          success: true,
          message: `Subscription extended by ${daysNum} days.`,
          subscription: updatedSub,
        });
      }

      case 'CHANGE_PLAN': {
        if (!planId) {
          return NextResponse.json({ success: false, error: 'Plan ID required.' }, { status: 400 });
        }
        const updatedSub = changeCustomerPlan(userId, planId);
        return NextResponse.json({
          success: true,
          message: 'Subscription plan updated.',
          subscription: updatedSub,
        });
      }

      case 'CANCEL_SUB': {
        const updatedSub = cancelCustomerSubscription(userId, reason);
        return NextResponse.json({
          success: true,
          message: 'Subscription cancelled.',
          subscription: updatedSub,
        });
      }

      case 'MANUAL_ACTIVATE': {
        if (!planId) {
          return NextResponse.json({ success: false, error: 'Plan ID required.' }, { status: 400 });
        }
        const updatedSub = manuallyActivateSubscription(userId, planId, durationMonths);
        return NextResponse.json({
          success: true,
          message: 'Subscription manually activated.',
          subscription: updatedSub,
        });
      }

      case 'RESET_ACCESS': {
        const result = resetCustomerAccess(userId);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unsupported action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error in customer action:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Operation failed.' },
      { status: 500 }
    );
  }
}
