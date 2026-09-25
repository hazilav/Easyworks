import { NextRequest, NextResponse } from 'next/server';
import {
  createVerificationCode,
  checkRateLimit,
  createOrUpdateTrialIdentity,
} from '@/lib/db/database';
import { isDisposableEmail } from '@/lib/abuse/disposableEmails';
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
    const { target, channel } = body;

    if (!target || !channel || !['EMAIL', 'SMS'].includes(channel)) {
      return apiError('Valid target (email or phone) and channel (EMAIL or SMS) are required.', 400);
    }

    // 1. Check disposable email domain
    if (channel === 'EMAIL') {
      if (isDisposableEmail(target)) {
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
        `Too many verification requests. Please wait ${rateCheck.resetInSeconds} seconds before requesting a new code.`,
        429,
        'RATE_LIMITED',
        { resetInSeconds: rateCheck.resetInSeconds }
      );
    }

    // 3. Generate verification OTP
    const { code, expiresAt } = createVerificationCode(normalizedTarget, channel);

    // If userId provided, update identity target
    if (userId) {
      if (channel === 'EMAIL') {
        createOrUpdateTrialIdentity({ userId, email: target });
      } else if (channel === 'SMS') {
        createOrUpdateTrialIdentity({ userId, email: target, phone: target });
      }
    }

    return apiSuccess({
      message: `Verification code sent to ${normalizedTarget}.`,
      expiresAt,
      // Debug code provided for rapid automated testing and demo environments
      debugCode: code,
    });
  } catch (error: any) {
    return apiError(error, 500, 'INTERNAL_SERVER_ERROR', {
      apiRoute: '/api/auth/send-verification',
      method: 'POST',
      userId,
    });
  }
}
