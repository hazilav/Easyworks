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
            "You've used all PDF downloads included in your plan. Please upgrade or renew to unlock more PDF downloads.",
          pdfDownloadLimit: result.pdfDownloadLimit,
          pdfDownloadsUsed: result.pdfDownloadsUsed,
          pdfDownloadsRemaining: result.pdfDownloadsRemaining,
          trialPdfDownloads: result.trialPdfDownloads,
          maxTrialDownloads: result.maxTrialDownloads,
          isSubscribed: result.isSubscribed,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      allowed: true,
      pdfDownloadLimit: result.pdfDownloadLimit,
      pdfDownloadsUsed: result.pdfDownloadsUsed,
      pdfDownloadsRemaining: result.pdfDownloadsRemaining,
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
