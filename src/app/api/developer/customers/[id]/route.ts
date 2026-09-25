import { NextRequest, NextResponse } from 'next/server';
import { getCustomerFullDetails, verifyDeveloperSessionToken } from '@/lib/db/database';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return apiUnauthorized('Unauthorized. Developer session required.', 'UNAUTHORIZED');
    }

    const { id } = await params;
    const details = getCustomerFullDetails(id);

    if (!details) {
      return apiError('Customer not found.', 404, 'NOT_FOUND');
    }

    return apiSuccess({ details });
  } catch (error: any) {
    console.error('[GET /api/developer/customers/[id]] Error:', error);
    return apiError(error.message || 'Failed to fetch customer details.', 500);
  }
}
