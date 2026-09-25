import { NextRequest, NextResponse } from 'next/server';
import {
  evaluateTrialEligibility,
  getTrialIdentityByUserId,
  createOrUpdateTrialIdentity,
} from '@/lib/db/database';
import crypto from 'node:crypto';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return apiError('userId is required', 400);
    }

    const identity = getTrialIdentityByUserId(userId);
    if (!identity) {
      return apiSuccess({
        status: 'REQUIRES_VERIFICATION',
        isEligible: false,
        requiresEmailVerification: true,
        requiresPhoneVerification: true,
        riskScore: 0,
        message: 'No trial identity recorded yet.',
      });
    }

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    let deviceId = req.headers.get('x-device-id') || req.cookies.get('easyworks_device_id')?.value;

    const evaluation = evaluateTrialEligibility(userId, { deviceId, ipAddress });

    const response = apiSuccess(evaluation);

    // Set persistent device ID cookie if missing
    if (!deviceId) {
      deviceId = 'dev_' + crypto.randomBytes(12).toString('hex');
      response.cookies.set('easyworks_device_id', deviceId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

    return response;
  } catch (error: any) {
    console.error('[GET /api/auth/trial-eligibility] Error:', error);
    return apiError(error.message || 'Failed to check trial eligibility', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const { userId, email, phone, businessName, gstin } = parsed.body || {};

    if (!userId) {
      return apiError('userId is required', 400);
    }

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    let deviceId = req.headers.get('x-device-id') || req.cookies.get('easyworks_device_id')?.value;

    if (!deviceId) {
      deviceId = 'dev_' + crypto.randomBytes(12).toString('hex');
    }

    // Update metadata if provided
    if (email || phone || businessName || gstin) {
      createOrUpdateTrialIdentity({
        userId,
        email: email || '',
        phone,
        businessName,
        gstin,
        deviceId,
        ipAddress,
      });
    }

    const result = evaluateTrialEligibility(userId, { deviceId, ipAddress });

    const response = apiSuccess(result);
    response.cookies.set('easyworks_device_id', deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch (error: any) {
    console.error('[POST /api/auth/trial-eligibility] Error:', error);
    return apiError(error.message || 'Failed to evaluate trial eligibility', 500);
  }
}
