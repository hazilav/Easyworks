import { NextRequest, NextResponse } from 'next/server';
import { createCustomPlanRequest } from '@/lib/db/database';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, businessName, email, phone, duration, requirements } = body;

    if (!name || !businessName || !email || !phone) {
      return NextResponse.json(
        { success: false, error: 'Name, business name, email, and phone are required' },
        { status: 400 }
      );
    }

    const request = createCustomPlanRequest({
      name,
      businessName,
      email,
      phone,
      duration: duration || 'Custom Duration',
      requirements: requirements || 'No special requirements noted',
    });

    return NextResponse.json({ success: true, request });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
