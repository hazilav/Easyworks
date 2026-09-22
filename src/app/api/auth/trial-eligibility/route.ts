import { NextRequest, NextResponse } from 'next/server';
import {
  evaluateTrialEligibility,
  getTrialIdentityByUserId,
  createOrUpdateTrialIdentity,
} from '@/lib/db/database';
import crypto from 'node:crypto';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const identity = getTrialIdentityByUserId(userId);
    if (!identity) {
      return NextResponse.json({
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

    const response = NextResponse.json(evaluation);

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
    console.error('Error getting trial eligibility:', error);
    return NextResponse.json({ error: error.message || 'Failed to check trial eligibility' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, email, phone, businessName, gstin } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
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

    const response = NextResponse.json(result);
    response.cookies.set('easyworks_device_id', deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch (error: any) {
    console.error('Error evaluating trial eligibility:', error);
    return NextResponse.json({ error: error.message || 'Failed to evaluate trial eligibility' }, { status: 500 });
  }
}
