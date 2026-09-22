import { NextRequest, NextResponse } from 'next/server';
import { saveCustomerDocument, getCustomerDocuments } from '@/lib/db/database';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, type, document } = body;

    if (!userId || !type || !document) {
      return NextResponse.json(
        { success: false, error: 'userId, type, and document are required.' },
        { status: 400 }
      );
    }

    if (type !== 'quotation' && type !== 'invoice') {
      return NextResponse.json(
        { success: false, error: 'Type must be quotation or invoice.' },
        { status: 400 }
      );
    }

    saveCustomerDocument(userId, type, document);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving document:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save document.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required.' },
        { status: 400 }
      );
    }

    const docs = getCustomerDocuments(userId);
    return NextResponse.json({ success: true, ...docs });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch documents.' },
      { status: 500 }
    );
  }
}
