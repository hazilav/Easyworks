import { NextRequest, NextResponse } from 'next/server';
import { getAllBusinessesOverview, verifyDeveloperSessionToken } from '@/lib/db/database';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/server';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return apiUnauthorized('Unauthorized. Developer session required.', 'UNAUTHORIZED');
    }

    const businesses = getAllBusinessesOverview();
    return apiSuccess({ businesses });
  } catch (error: any) {
    console.error('[GET /api/developer/businesses] Error:', error);
    return apiError(error.message || 'Failed to fetch businesses.', 500);
  }
}
