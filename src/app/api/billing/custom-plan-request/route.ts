import { NextRequest, NextResponse } from 'next/server';
import { createCustomPlanRequest } from '@/lib/db/database';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export async function POST(req: NextRequest) {
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const { name, businessName, email, phone, duration, requirements } = parsed.body || {};

    if (!name || !businessName || !email || !phone) {
      return apiError('Name, business name, email, and phone are required', 400);
    }

    const request = createCustomPlanRequest({
      name,
      businessName,
      email,
      phone,
      duration: duration || 'Custom Duration',
      requirements: requirements || 'No special requirements noted',
    });

    return apiSuccess({ request });
  } catch (error: any) {
    console.error('[POST /api/billing/custom-plan-request] Error:', error);
    return apiError(error.message || 'Failed to submit custom plan request', 500);
  }
}
