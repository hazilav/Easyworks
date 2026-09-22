import { NextRequest, NextResponse } from 'next/server';
import {
  getAllPlans,
  createPlan,
  updatePlan,
  verifyDeveloperSessionToken,
  getDatabase,
} from '@/lib/db/database';

export async function GET(req: NextRequest) {
  try {
    const plans = getAllPlans(true);
    const db = getDatabase();

    // Attach subscriber count to each plan
    const plansWithCount = plans.map((p) => {
      const row = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE plan_id = ? AND status = 'ACTIVE'").get(p.id) as any;
      return {
        ...p,
        activeSubscribers: row ? row.count : 0,
      };
    });

    return NextResponse.json({ success: true, plans: plansWithCount });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch plans.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Developer session required.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { action, planId, planData } = body;

    if (action === 'CREATE') {
      const newPlan = createPlan(planData);
      return NextResponse.json({ success: true, plan: newPlan });
    } else if (action === 'UPDATE') {
      if (!planId) {
        return NextResponse.json({ success: false, error: 'Plan ID required.' }, { status: 400 });
      }
      const updated = updatePlan(planId, planData);
      return NextResponse.json({ success: true, plan: updated });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action.' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in plan operation:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update plan.' },
      { status: 500 }
    );
  }
}
