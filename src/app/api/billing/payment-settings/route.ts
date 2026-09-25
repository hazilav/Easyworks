import { NextRequest, NextResponse } from 'next/server';
import { getPaymentSettings, updatePaymentSettings } from '@/lib/db/database';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export async function GET() {
  try {
    const settings = getPaymentSettings();
    return apiSuccess({ settings });
  } catch (error: any) {
    console.error('[GET /api/billing/payment-settings] Error:', error);
    return apiError(error.message || 'Failed to fetch payment settings', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const updated = updatePaymentSettings(parsed.body || {});
    return apiSuccess({ settings: updated });
  } catch (error: any) {
    console.error('[POST /api/billing/payment-settings] Error:', error);
    return apiError(error.message || 'Failed to update payment settings', 500);
  }
}
