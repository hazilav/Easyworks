import { NextRequest, NextResponse } from 'next/server';
import {
  getAllTrialIdentities,
  adminApproveTrial,
  adminRejectTrial,
} from '@/lib/db/database';

export async function GET() {
  try {
    const trials = getAllTrialIdentities();
    return NextResponse.json({ trials });
  } catch (error: any) {
    console.error('Error fetching admin trial identities:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch trial identities' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, userId, notes, reason } = body;

    if (!action || !userId) {
      return NextResponse.json({ error: 'Action and userId are required.' }, { status: 400 });
    }

    if (action === 'approve') {
      const result = adminApproveTrial(userId, notes || 'Approved by admin');
      return NextResponse.json(result);
    } else if (action === 'reject') {
      const result = adminRejectTrial(userId, reason || 'Suspicious activity or duplicate trial request');
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ error: 'Invalid action. Supported: approve, reject' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in admin trial action:', error);
    return NextResponse.json({ error: error.message || 'Failed to perform admin trial action' }, { status: 500 });
  }
}
