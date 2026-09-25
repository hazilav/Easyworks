import { NextRequest, NextResponse } from 'next/server';
import {
  getPaymentSettings,
  updatePaymentSettings,
  updateDeveloperPassword,
  verifyDeveloperSessionToken,
  getDatabase,
} from '@/lib/db/database';
import { apiSuccess, apiError, apiUnauthorized, safeReadBody } from '@/lib/api/server';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return apiUnauthorized('Unauthorized. Developer session required.', 'UNAUTHORIZED');
    }

    const settings = getPaymentSettings();
    const db = getDatabase();
    const admin = db.prepare("SELECT email, name, role, phone, created_at FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1").get();

    return apiSuccess({
      paymentSettings: settings,
      developer: admin,
    });
  } catch (error: any) {
    console.error('[GET /api/developer/settings] Error:', error);
    return apiError(error.message || 'Failed to fetch settings.', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return apiUnauthorized('Unauthorized. Developer session required.', 'UNAUTHORIZED');
    }

    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const { type, paymentSettings, newPassword } = parsed.body || {};

    if (type === 'PAYMENT_SETTINGS') {
      const updated = updatePaymentSettings(paymentSettings);
      return apiSuccess({
        message: 'Payment settings updated successfully.',
        settings: updated,
      });
    } else if (type === 'CHANGE_PASSWORD') {
      if (!newPassword || newPassword.length < 8) {
        return apiError('New password must be at least 8 characters long.', 400);
      }
      updateDeveloperPassword(newPassword);
      return apiSuccess({
        message: 'Developer password changed successfully.',
      });
    } else {
      return apiError('Invalid setting type.', 400);
    }
  } catch (error: any) {
    console.error('[POST /api/developer/settings] Error updating settings:', error);
    return apiError(error.message || 'Failed to update settings.', 500);
  }
}
