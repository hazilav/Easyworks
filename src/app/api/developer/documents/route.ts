import { NextRequest, NextResponse } from 'next/server';
import { getAllDocumentsOverview, verifyDeveloperSessionToken } from '@/lib/db/database';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/server';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return apiUnauthorized('Unauthorized. Developer session required.', 'UNAUTHORIZED');
    }

    const { searchParams } = new URL(req.url);
    const type = (searchParams.get('type') || 'all') as 'all' | 'quotations' | 'invoices';
    const search = searchParams.get('search') || undefined;

    const documents = getAllDocumentsOverview(type, search);
    return apiSuccess({ documents });
  } catch (error: any) {
    console.error('[GET /api/developer/documents] Error:', error);
    return apiError(error.message || 'Failed to fetch documents.', 500);
  }
}
