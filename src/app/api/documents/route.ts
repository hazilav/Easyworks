import { NextRequest, NextResponse } from 'next/server';
import { saveCustomerDocument, getCustomerDocuments } from '@/lib/db/database';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export async function POST(req: NextRequest) {
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const { userId, type, document } = parsed.body || {};

    if (!userId || !type || !document) {
      return apiError('userId, type, and document are required.', 400);
    }

    if (type !== 'quotation' && type !== 'invoice') {
      return apiError('Type must be quotation or invoice.', 400);
    }

    saveCustomerDocument(userId, type, document);
    return apiSuccess({ message: 'Document saved successfully.' });
  } catch (error: any) {
    console.error('[POST /api/documents] Error saving document:', error);
    return apiError(error.message || 'Failed to save document.', 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return apiSuccess({ quotations: [], invoices: [] });
    }

    const docs = getCustomerDocuments(userId);
    return apiSuccess({
      quotations: docs.quotations || [],
      invoices: docs.invoices || [],
    });
  } catch (error: any) {
    console.error('[GET /api/documents] Error:', error);
    return apiError(error.message || 'Failed to fetch documents.', 500);
  }
}
