import { NextRequest, NextResponse } from 'next/server';
import {
  verifyVerificationCode,
  checkRateLimit,
  completeVerifiedSignup,
  createOrUpdateTrialIdentity,
  evaluateTrialEligibility,
  getTrialIdentityByUserId,
  getUserById,
} from '@/lib/db/database';
import { normalizeEmail, normalizePhone } from '@/lib/abuse/normalizers';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export async function POST(req: NextRequest) {
  let verifiedUserId: string | undefined;
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const body = parsed.body || {};
    const { target, code, channel, signupSessionId, name, businessName } = body;
    let userId = body.userId;

    if (!target || !code || !channel) {
      return apiError('Target, verification code, and channel are required.', 400, 'BAD_REQUEST');
    }

    const normalizedTarget = channel === 'EMAIL' ? normalizeEmail(target) : normalizePhone(target);

    // 1. Sliding window rate limit: Max 5 verification attempts per target per 10 minutes
    const rateCheck = checkRateLimit(`otp_verify_${normalizedTarget}`, 5, 600);
    if (!rateCheck.allowed) {
      return apiError(
        'Too many failed attempts. Please wait before trying again.',
        429,
        'RATE_LIMITED',
        { resetInSeconds: rateCheck.resetInSeconds }
      );
    }

    // 2. Authoritatively verify code (hashed comparison, attempt limit, single-use invalidation)
    const result = verifyVerificationCode(normalizedTarget, code, signupSessionId);
    if (!result.success) {
      return apiError(result.error || 'Invalid verification code.', 400, result.code || 'INVALID_CODE');
    }

    // 3. Complete user lifecycle upon verified email:
    // Create/activate user -> Create business -> Create 7-day trial with 2 PDF limit -> Create trial identity
    let userResult: any = null;
    let subscriptionResult: any = null;

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '127.0.0.1';
    const deviceId = req.headers.get('x-device-id') || req.cookies.get('easyworks_device_id')?.value;

    if (channel === 'EMAIL') {
      const signup = completeVerifiedSignup({
        email: target,
        name,
        businessName,
        deviceId,
        ipAddress,
      });
      userResult = signup.user;
      subscriptionResult = signup.subscription;
      userId = signup.user.id;
      verifiedUserId = userId;
    } else if (channel === 'SMS') {
      if (userId) {
        const existingUser = getUserById(userId);
        if (existingUser) {
          createOrUpdateTrialIdentity({
            userId,
            email: existingUser.email,
            phone: target,
            phoneVerified: true,
            deviceId,
            ipAddress,
          });
          userResult = existingUser;
          verifiedUserId = userId;
        }
      }
    }

    // 4. Run trial abuse & eligibility evaluation for the verified identity
    let eligibilityResult = null;
    const currentIdentity = userId ? getTrialIdentityByUserId(userId) : null;
    if (userId && currentIdentity?.emailVerified) {
      eligibilityResult = evaluateTrialEligibility(userId, { deviceId, ipAddress });
    }

    return apiSuccess({
      message: `${channel === 'EMAIL' ? 'Email' : 'Phone'} verified successfully.`,
      user: userResult,
      subscription: subscriptionResult,
      identity: currentIdentity,
      eligibility: eligibilityResult,
    });
  } catch (error: any) {
    return apiError(error, 500, 'INTERNAL_SERVER_ERROR', {
      apiRoute: '/api/auth/verify-code',
      method: 'POST',
      userId: verifiedUserId,
    });
  }
}
