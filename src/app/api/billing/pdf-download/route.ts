import { NextRequest, NextResponse } from 'next/server';
import { verifyAndConsumeTrialPdfDownload } from '@/lib/db/database';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, documentType, documentId, documentNumber } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required for verification.' },
        { status: 400 }
      );
    }

    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    const result = verifyAndConsumeTrialPdfDownload(userId, {
      docId: documentId,
      documentType: (documentType || 'QUOTATION').toUpperCase() as any,
      documentNumber,
      ipAddress,
      userAgent,
    });

    if (!result.allowed) {
      return NextResponse.json(
        {
          allowed: false,
          reason: result.reason,
          message:
            result.message ||
            (result.isSubscribed
              ? 'PDF download limit reached. Upgrade or renew your plan to continue.'
              : "You've used all 2 trial PDF downloads. Subscribe to continue downloading PDFs."),
          pdfLimit: result.pdfDownloadLimit,
          pdfUsed: result.pdfDownloadsUsed,
          pdfRemaining: result.pdfDownloadsRemaining,
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
      pdfLimit: result.pdfDownloadLimit,
      pdfUsed: result.pdfDownloadsUsed,
      pdfRemaining: result.pdfDownloadsRemaining,
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
