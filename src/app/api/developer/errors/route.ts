import { NextRequest } from 'next/server';
import {
  getErrorLogs,
  resolveErrorLog,
  acknowledgeErrorLog,
  getErrorStats,
  verifyDeveloperSessionToken,
} from '@/lib/db/database';
import { apiSuccess, apiError, safeReadBody, withApiRouteHandler } from '@/lib/api/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiRouteHandler('GET /api/developer/errors', async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!token || !verifyDeveloperSessionToken(token)) {
      return apiError('Unauthorized developer access', 401);
    }

    const category = searchParams.get('category') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const recoveryStatus = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = getErrorLogs({
      category,
      severity,
      recoveryStatus,
      search,
      limit,
      offset,
    });

    const stats = getErrorStats();

    return apiSuccess({
      logs: result.logs,
      total: result.total,
      stats,
    });
  } catch (err: any) {
    return apiError(err?.message || 'Failed to fetch error logs', 500);
  }
});

export const POST = withApiRouteHandler('POST /api/developer/errors', async (req: NextRequest) => {
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }

    const { id, action, adminName, token: bodyToken } = parsed.body || {};
    const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const token = bodyToken || authHeader;

    if (!token || !verifyDeveloperSessionToken(token)) {
      return apiError('Unauthorized developer access', 401);
    }

    if (!id || !action) {
      return apiError('Error ID and action (RESOLVE or ACKNOWLEDGE) are required', 400);
    }

    if (action === 'RESOLVE') {
      const ok = resolveErrorLog(id, adminName || 'Developer');
      return apiSuccess({ success: ok, message: 'Error log marked as resolved' });
    } else if (action === 'ACKNOWLEDGE') {
      const ok = acknowledgeErrorLog(id, adminName || 'Developer');
      return apiSuccess({ success: ok, message: 'Error log acknowledged' });
    } else {
      return apiError('Invalid action. Must be RESOLVE or ACKNOWLEDGE.', 400);
    }
  } catch (err: any) {
    return apiError(err?.message || 'Failed to update error log', 500);
  }
});
