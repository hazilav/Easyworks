import { NextRequest, NextResponse } from 'next/server';
import {
  createVerificationCode,
  checkRateLimit,
  isEmailRegistered,
} from '@/lib/db/database';
import { isDisposableEmail } from '@/lib/abuse/disposableEmails';
import { normalizeEmail, normalizePhone } from '@/lib/abuse/normalizers';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export async function POST(req: NextRequest) {
  let targetEmailOrPhone: string | undefined;
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const body = parsed.body || {};
    const { target, channel, signupSessionId } = body;
    targetEmailOrPhone = target;

    if (!target || !channel || !['EMAIL', 'SMS'].includes(channel)) {
      return apiError('Valid target (email or phone) and channel (EMAIL or SMS) are required.', 400, 'BAD_REQUEST');
    }

    // 1. Check duplicate email and disposable email domain
    if (channel === 'EMAIL') {
      const cleanEmail = target.trim().toLowerCase();
      if (isEmailRegistered(cleanEmail)) {
        return apiError(
          'An account with this email already exists',
          400,
          'EMAIL_ALREADY_REGISTERED'
        );
      }

      if (isDisposableEmail(cleanEmail)) {
        return apiError(
          'Disposable / temporary email addresses are not permitted. Please use a valid work or personal email.',
          400,
          'DISPOSABLE_EMAIL',
          { isDisposable: true }
        );
      }
    }

    const normalizedTarget = channel === 'EMAIL' ? normalizeEmail(target) : normalizePhone(target);

    // 2. Sliding window rate limit: Max 3 OTP requests per target per 10 minutes (600s)
    const rateCheck = checkRateLimit(`otp_req_${normalizedTarget}`, 3, 600);
    if (!rateCheck.allowed) {
      return apiError(
        'Please wait before requesting another verification code',
        429,
        'RATE_LIMITED',
        { resetInSeconds: rateCheck.resetInSeconds }
      );
    }

    // 3. Generate verification OTP & session record (temporary, no user created yet)
    const { code, expiresAt, signupSessionId: sessionId } = createVerificationCode(
      normalizedTarget,
      channel,
      signupSessionId
    );

    // 4. Return success response. NEVER expose debugCode in production!
    return apiSuccess({
      message: `Verification code sent to ${normalizedTarget}.`,
      signupSessionId: sessionId,
      expiresAt,
      // Debug code provided ONLY during local development and testing environments
      ...(process.env.NODE_ENV !== 'production' ? { debugCode: code } : {}),
    });
  } catch (error: any) {
    return apiError(error, 500, 'INTERNAL_SERVER_ERROR', {
      apiRoute: '/api/auth/send-verification',
      method: 'POST',
      target: targetEmailOrPhone,
    });
  }
}
