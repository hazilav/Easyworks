import { NextRequest } from 'next/server';
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
import { apiSuccess, apiError, safeReadBody, withApiRouteHandler } from '@/lib/api/server';

export const POST = withApiRouteHandler('POST /api/auth/verify-code', async (req: NextRequest) => {
  let verifiedUserId: string | undefined;
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const body = parsed.body || {};
    const { target, code, signupSessionId, name, businessName } = body;
    const channel = (body.channel || 'EMAIL').toUpperCase();
    let userId = body.userId;

    if (!target || !code) {
      return apiError('Target email and verification code are required.', 400, 'BAD_REQUEST');
    }

    if (channel !== 'EMAIL') {
      return apiError('Only EMAIL verification is supported. Mobile number verification has been removed.', 400, 'BAD_REQUEST');
    }

    const normalizedTarget = normalizeEmail(target);

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
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '127.0.0.1';
    const deviceId = req.headers.get('x-device-id') || (req as any).cookies?.get?.('easyworks_device_id')?.value;

    const signup = completeVerifiedSignup({
      email: target,
      name,
      businessName,
      deviceId,
      ipAddress,
    });
    const userResult = signup.user;
    const subscriptionResult = signup.subscription;
    userId = signup.user.id;
    verifiedUserId = userId;

    // 4. Run trial abuse & eligibility evaluation for the verified identity
    let eligibilityResult = null;
    const currentIdentity = userId ? getTrialIdentityByUserId(userId) : null;
    if (userId && currentIdentity?.emailVerified) {
      eligibilityResult = evaluateTrialEligibility(userId, { deviceId, ipAddress });
    }

    return apiSuccess({
      message: 'Email verified successfully.',
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
});

