import { NextRequest, NextResponse } from 'next/server';
import { getCustomerFullDetails, verifyDeveloperSessionToken } from '@/lib/db/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Developer session required.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const details = getCustomerFullDetails(id);

    if (!details) {
      return NextResponse.json({ success: false, error: 'Customer not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, details });
  } catch (error: any) {
    console.error('Error fetching customer full details:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch customer details.' },
      { status: 500 }
    );
  }
}
