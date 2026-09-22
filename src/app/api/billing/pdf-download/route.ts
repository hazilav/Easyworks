import { NextRequest, NextResponse } from 'next/server';
import { verifyAndConsumeTrialPdfDownload } from '@/lib/db/database';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, documentType, documentId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required for verification.' },
        { status: 400 }
      );
    }

    const result = verifyAndConsumeTrialPdfDownload(userId);

    if (!result.allowed) {
      return NextResponse.json(
        {
          allowed: false,
          reason: result.reason,
          message:
            result.message ||
            "You've used your 2 free PDF downloads. Upgrade to Easyworks to unlock unlimited PDF downloads.",
          trialPdfDownloads: result.trialPdfDownloads,
          maxTrialDownloads: result.maxTrialDownloads,
          isSubscribed: false,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      allowed: true,
      trialPdfDownloads: result.trialPdfDownloads,
      maxTrialDownloads: result.maxTrialDownloads,
      isSubscribed: result.isSubscribed,
    });
  } catch (err: any) {
    console.error('PDF download verification error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error during verification' },
      { status: 500 }
    );
  }
}
