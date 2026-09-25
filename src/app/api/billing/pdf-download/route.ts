import { NextRequest, NextResponse } from 'next/server';
import { verifyAndConsumeTrialPdfDownload, getUserSubscription } from '@/lib/db/database';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return apiError('User ID is required for verification.', 400);
    }

    const sub = getUserSubscription(userId);
    const pdfLimit = sub?.pdfDownloadLimit ?? 2;
    const pdfUsed = sub?.pdfDownloadsUsed ?? sub?.trialPdfDownloads ?? 0;
    const pdfRemaining = Math.max(0, pdfLimit - pdfUsed);

    return apiSuccess({
      allowed: pdfRemaining > 0 && sub?.status !== 'SUSPENDED',
      pdfLimit,
      pdfUsed,
      pdfRemaining,
      pdfDownloadLimit: pdfLimit,
      pdfDownloadsUsed: pdfUsed,
      pdfDownloadsRemaining: pdfRemaining,
      isSubscribed: sub?.status === 'ACTIVE',
      status: sub?.status || 'TRIALING',
    });
  } catch (err: any) {
    console.error('[GET /api/billing/pdf-download] Error:', err);
    return apiError(err.message || 'Failed to check PDF limit', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const { userId, documentType, documentId, documentNumber } = parsed.body || {};

    if (!userId) {
      return apiError('User ID is required for verification.', 400);
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
      if (result.reason === 'NOT_FOUND') {
        return apiError(result.message || 'User account or subscription record not found.', 404, 'USER_NOT_FOUND');
      }
      return NextResponse.json(
        {
          success: false,
          allowed: false,
          reason: result.reason,
          message:
            result.message ||
            (result.isSubscribed
              ? 'PDF download limit reached. Upgrade or renew your plan to continue.'
              : "You've used all 2 trial PDF downloads. Subscribe to continue downloading PDFs."),
          error:
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
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return apiSuccess({
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
    console.error('[POST /api/billing/pdf-download] Error:', err);
    return apiError(err.message || 'Internal server error during verification', 500);
  }
}
