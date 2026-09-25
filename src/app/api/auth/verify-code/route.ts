import { NextRequest, NextResponse } from 'next/server';
import {
  verifyVerificationCode,
  checkRateLimit,
  createOrUpdateTrialIdentity,
  evaluateTrialEligibility,
  getTrialIdentityByUserId,
} from '@/lib/db/database';
import { normalizeEmail, normalizePhone } from '@/lib/abuse/normalizers';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export async function POST(req: NextRequest) {
  let userId: string | undefined;
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const body = parsed.body || {};
    userId = body.userId;
    const { target, code, channel } = body;

    if (!target || !code || !channel || !userId) {
      return apiError('Target, verification code, channel, and userId are required.', 400);
    }

    const normalizedTarget = channel === 'EMAIL' ? normalizeEmail(target) : normalizePhone(target);

    // 1. Sliding window rate limit: Max 6 verification attempts per target per 10 minutes
    const rateCheck = checkRateLimit(`otp_verify_${normalizedTarget}`, 6, 600);
    if (!rateCheck.allowed) {
      return apiError(
        `Too many failed attempts. Please wait ${rateCheck.resetInSeconds} seconds before trying again.`,
        429,
        'RATE_LIMITED',
        { resetInSeconds: rateCheck.resetInSeconds }
      );
    }

    // 2. Verify code
    const result = verifyVerificationCode(normalizedTarget, code);
    if (!result.success) {
      return apiError(result.error || 'Invalid verification code.', 400);
    }

    // 3. Mark identity as verified
    let identity: any;
    if (channel === 'EMAIL') {
      identity = createOrUpdateTrialIdentity({
        userId,
        email: target,
        emailVerified: true,
      });
    } else if (channel === 'SMS') {
      identity = createOrUpdateTrialIdentity({
        userId,
        email: target,
        phone: target,
        phoneVerified: true,
      });
    }

    // 4. If both email and phone are now verified, run eligibility engine
    let eligibilityResult = null;
    const current = getTrialIdentityByUserId(userId);
    if (current && current.emailVerified && current.phoneVerified) {
      const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
      const deviceId = req.headers.get('x-device-id') || req.cookies.get('easyworks_device_id')?.value;
      eligibilityResult = evaluateTrialEligibility(userId, { deviceId, ipAddress });
    }

    return apiSuccess({
      message: `${channel === 'EMAIL' ? 'Email' : 'Phone'} verified successfully.`,
      identity: current,
      eligibility: eligibilityResult,
    });
  } catch (error: any) {
    return apiError(error, 500, 'INTERNAL_SERVER_ERROR', {
      apiRoute: '/api/auth/verify-code',
      method: 'POST',
      userId,
    });
  }
}
