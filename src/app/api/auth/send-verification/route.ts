import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {
  createVerificationCode,
  checkRateLimit,
  isEmailRegistered,
} from '@/lib/db/database';
import { isDisposableEmail } from '@/lib/abuse/disposableEmails';
import { normalizeEmail, normalizePhone } from '@/lib/abuse/normalizers';
import { safeReadBody, withApiRouteHandler } from '@/lib/api/server';
import { sendOtpEmail, logOtpAudit } from '@/lib/email/emailService';

export const POST = withApiRouteHandler('POST /api/auth/send-verification', async (req: NextRequest) => {
  const requestId = 'req_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
  let cleanTarget = '';

  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const body = parsed.body || {};
    const { target, channel, signupSessionId } = body;
    cleanTarget = String(target || '').trim();

    if (!cleanTarget || !channel || !['EMAIL', 'SMS'].includes(channel)) {
      logOtpAudit({
        requestId,
        stage: 'VALIDATE_REQUEST',
        status: 'FAILURE',
        error: 'Missing valid target or channel',
      });
      return NextResponse.json(
        {
          success: false,
          error: 'BAD_REQUEST',
          message: 'Valid target (email or phone) and channel (EMAIL or SMS) are required.',
          requestId,
        },
        { status: 400 }
      );
    }

    // 1. Email format, duplication, and disposable checks
    if (channel === 'EMAIL') {
      const cleanEmail = cleanTarget.toLowerCase();
      const domain = cleanEmail.split('@')[1];

      // Format validation
      if (!cleanEmail.includes('@') || !domain || !domain.includes('.')) {
        return NextResponse.json(
          {
            success: false,
            error: 'INVALID_EMAIL_FORMAT',
            message: 'Please provide a valid email address.',
            requestId,
          },
          { status: 400 }
        );
      }

      if (isEmailRegistered(cleanEmail)) {
        logOtpAudit({
          requestId,
          emailDomain: domain,
          stage: 'CHECK_EXISTING_USER',
          status: 'FAILURE',
          details: 'Email already registered',
        });
        return NextResponse.json(
          {
            success: false,
            code: 'EMAIL_ALREADY_REGISTERED',
            error: 'EMAIL_ALREADY_REGISTERED',
            message: 'An account with this email already exists.',
            requestId,
          },
          { status: 400 }
        );
      }

      if (isDisposableEmail(cleanEmail)) {
        logOtpAudit({
          requestId,
          emailDomain: domain,
          stage: 'CHECK_DISPOSABLE',
          status: 'FAILURE',
          details: 'Disposable email rejected',
        });
        return NextResponse.json(
          {
            success: false,
            code: 'DISPOSABLE_EMAIL',
            error: 'DISPOSABLE_EMAIL',
            message: 'Disposable / temporary email addresses are not permitted. Please use a valid work or personal email.',
            requestId,
          },
          { status: 400 }
        );
      }
    }

    const normalizedTarget = channel === 'EMAIL' ? normalizeEmail(cleanTarget) : normalizePhone(cleanTarget);
    const domain = channel === 'EMAIL' ? normalizedTarget.split('@')[1] : undefined;

    // 2. Sliding window cooldown: 60-second cooldown between consecutive OTP requests for same target
    const cooldownCheck = checkRateLimit(`otp_cd_${normalizedTarget}`, 1, 60);
    if (!cooldownCheck.allowed) {
      logOtpAudit({
        requestId,
        emailDomain: domain,
        stage: 'COOLDOWN_CHECK',
        status: 'FAILURE',
        details: `Cooldown active: ${cooldownCheck.resetInSeconds}s remaining`,
      });
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMITED',
          error: 'RATE_LIMITED',
          message: `Please wait ${cooldownCheck.resetInSeconds || 60} seconds before requesting another verification code.`,
          resetInSeconds: cooldownCheck.resetInSeconds,
          requestId,
        },
        { status: 429 }
      );
    }

    // 3. Sliding window rate limit: Max 3 OTP requests per target per 10 minutes (600s)
    const rateCheck = checkRateLimit(`otp_req_${normalizedTarget}`, 3, 600);
    if (!rateCheck.allowed) {
      logOtpAudit({
        requestId,
        emailDomain: domain,
        stage: 'RATE_LIMIT_CHECK',
        status: 'FAILURE',
        details: 'Exceeded 3 requests in 10 minutes',
      });
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMITED',
          error: 'RATE_LIMITED',
          message: 'Maximum verification code requests exceeded for this email. Please try again after 10 minutes.',
          resetInSeconds: rateCheck.resetInSeconds,
          requestId,
        },
        { status: 429 }
      );
    }

    // 4. Generate verification OTP & store SHA-256 hash in database
    const { code, expiresAt, signupSessionId: sessionId } = createVerificationCode(
      normalizedTarget,
      channel,
      signupSessionId
    );

    logOtpAudit({
      requestId,
      emailDomain: domain,
      stage: 'GENERATE_AND_STORE_OTP',
      status: 'SUCCESS',
      details: 'Hashed OTP stored with 10-minute expiry',
    });

    // 5. Dispatch OTP through email provider (Only return success after provider accepts)
    if (channel === 'EMAIL') {
      try {
        await sendOtpEmail(normalizedTarget, code, requestId);
      } catch (sendError: any) {
        logOtpAudit({
          requestId,
          emailDomain: domain,
          stage: 'EMAIL_SEND',
          status: 'FAILURE',
          error: sendError.message || 'Email provider failed to send message',
        });

        return NextResponse.json(
          {
            success: false,
            code: 'EMAIL_SEND_FAILED',
            error: 'EMAIL_SEND_FAILED',
            message: sendError.code === 'EMAIL_CONFIG_MISSING'
              ? 'Email service is not configured. Please configure SMTP credentials in Developer Settings or environment variables.'
              : (sendError.message || 'Email provider failed to deliver verification code.'),
            requestId,
          },
          { status: 502 }
        );
      }
    }

    // 6. Return standard success response
    return NextResponse.json(
      {
        success: true,
        message: `Verification code sent to ${normalizedTarget}.`,
        signupSessionId: sessionId,
        expiresAt,
        requestId,
        // debugCode provided ONLY in non-production environments for automated testing
        ...(process.env.NODE_ENV !== 'production' ? { debugCode: code } : {}),
      },
      { status: 200 }
    );
  } catch (error: any) {
    const errorMsg = error?.message || 'Internal server error processing verification request.';
    logOtpAudit({
      requestId,
      stage: 'UNEXPECTED_EXCEPTION',
      status: 'FAILURE',
      error: errorMsg,
    });

    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        error: 'INTERNAL_SERVER_ERROR',
        message: errorMsg,
        requestId,
      },
      { status: 500 }
    );
  }
});
