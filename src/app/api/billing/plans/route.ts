import { NextRequest, NextResponse } from 'next/server';
import { getAllPlans, updatePlan } from '@/lib/db/database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('all') === 'true';
    const plans = getAllPlans(includeInactive);
    return NextResponse.json({ success: true, plans });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, priceINR, name, description, features, isActive, isPopular } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Plan ID is required' }, { status: 400 });
    }

    const updated = updatePlan(id, {
      priceINR: priceINR !== undefined ? Number(priceINR) : undefined,
      name,
      description,
      features,
      isActive,
      isPopular,
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, plan: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
