import { NextRequest, NextResponse } from 'next/server';
import {
  getAllTrialIdentities,
  adminApproveTrial,
  adminRejectTrial,
} from '@/lib/db/database';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export async function GET() {
  try {
    const trials = getAllTrialIdentities();
    return apiSuccess({ trials });
  } catch (error: any) {
    console.error('[GET /api/admin/trials] Error:', error);
    return apiError(error.message || 'Failed to fetch trial identities', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const { action, userId, notes, reason } = parsed.body || {};

    if (!action || !userId) {
      return apiError('Action and userId are required.', 400);
    }

    if (action === 'approve') {
      const result = adminApproveTrial(userId, notes || 'Approved by admin');
      return apiSuccess({ message: 'Trial approved successfully.', ...result });
    } else if (action === 'reject') {
      const result = adminRejectTrial(userId, reason || 'Suspicious activity or duplicate trial request');
      return apiSuccess({ message: 'Trial rejected.', ...result });
    } else {
      return apiError('Invalid action. Supported: approve, reject', 400);
    }
  } catch (error: any) {
    console.error('[POST /api/admin/trials] Error in admin trial action:', error);
    return apiError(error.message || 'Failed to perform admin trial action', 500);
  }
}
