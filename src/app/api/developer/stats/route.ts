import { NextRequest } from 'next/server';
import { getDeveloperStats, verifyDeveloperSessionToken } from '@/lib/db/database';
import { apiSuccess, apiError, apiUnauthorized, withApiRouteHandler } from '@/lib/api/server';

export const GET = withApiRouteHandler('GET /api/developer/stats', async (req: NextRequest) => {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return apiUnauthorized('Unauthorized. Developer session expired or invalid.', 'UNAUTHORIZED');
    }

    const stats = getDeveloperStats();
    return apiSuccess({ stats });
  } catch (error: any) {
    console.error('[GET /api/developer/stats] Error:', error);
    return apiError(error.message || 'Failed to fetch dashboard metrics.', 500);
  }
});

