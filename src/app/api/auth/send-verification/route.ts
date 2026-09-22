import { NextRequest, NextResponse } from 'next/server';
import {
  createVerificationCode,
  checkRateLimit,
  createOrUpdateTrialIdentity,
} from '@/lib/db/database';
import { isDisposableEmail } from '@/lib/abuse/disposableEmails';
import { normalizeEmail, normalizePhone } from '@/lib/abuse/normalizers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { target, channel, userId } = body;

    if (!target || !channel || !['EMAIL', 'SMS'].includes(channel)) {
      return NextResponse.json(
        { error: 'Valid target (email or phone) and channel (EMAIL or SMS) are required.' },
        { status: 400 }
      );
    }

    // 1. Check disposable email domain
    if (channel === 'EMAIL') {
      if (isDisposableEmail(target)) {
        return NextResponse.json(
          {
            error:
              'Disposable / temporary email addresses are not permitted. Please use a valid work or personal email.',
            isDisposable: true,
          },
          { status: 400 }
        );
      }
    }

    const normalizedTarget = channel === 'EMAIL' ? normalizeEmail(target) : normalizePhone(target);

    // 2. Sliding window rate limit: Max 3 OTP requests per target per 10 minutes (600s)
    const rateCheck = checkRateLimit(`otp_req_${normalizedTarget}`, 3, 600);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many verification requests. Please wait ${rateCheck.resetInSeconds} seconds before requesting a new code.`,
          resetInSeconds: rateCheck.resetInSeconds,
        },
        { status: 429 }
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

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${normalizedTarget}.`,
      expiresAt,
      // Debug code provided for rapid automated testing and demo environments
      debugCode: code,
    });
  } catch (error: any) {
    console.error('Error sending verification code:', error);
    return NextResponse.json({ error: error.message || 'Failed to send verification code.' }, { status: 500 });
  }
}
