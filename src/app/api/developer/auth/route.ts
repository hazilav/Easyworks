import { NextRequest } from 'next/server';
import {
  verifyDeveloperCredentials,
  verifyDeveloperSessionToken,
  getDatabase,
} from '@/lib/db/database';
import { apiSuccess, apiError, apiUnauthorized, safeReadBody, withApiRouteHandler } from '@/lib/api/server';

export const POST = withApiRouteHandler('POST /api/developer/auth', async (req: NextRequest) => {
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const { email, password } = parsed.body || {};

    if (!email || !password) {
      return apiError('Email and password are required.', 400);
    }

    const result = verifyDeveloperCredentials(email, password);
    if (!result.success) {
      return apiError(result.error || 'Authentication failed.', 401, 'INVALID_CREDENTIALS');
    }

    return apiSuccess({
      user: result.user,
      token: result.token,
    });
  } catch (error: any) {
    console.error('[POST /api/developer/auth] Error:', error);
    return apiError(error.message || 'Internal server error.', 500);
  }
});

export const GET = withApiRouteHandler('GET /api/developer/auth', async (req: NextRequest) => {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return apiUnauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const db = getDatabase();
    const admin = db.prepare("SELECT id, email, name, role, phone FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1").get() as any;

    return apiSuccess({
      authenticated: true,
      user: admin,
    });
  } catch (error: any) {
    console.error('[GET /api/developer/auth] Error:', error);
    return apiError(error.message || 'Authentication check failed', 500);
  }
});

