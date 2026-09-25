import { NextRequest, NextResponse } from 'next/server';
import {
  getAllPlans,
  createPlan,
  updatePlan,
  verifyDeveloperSessionToken,
  getDatabase,
} from '@/lib/db/database';
import { apiSuccess, apiError, apiUnauthorized, safeReadBody } from '@/lib/api/server';

export async function GET(req: NextRequest) {
  try {
    const plans = getAllPlans(true);
    const db = getDatabase();

    // Attach subscriber count to each plan
    const plansWithCount = plans.map((p) => {
      const row = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE plan_id = ? AND status = 'ACTIVE'").get(p.id) as any;
      const pdfLimit = p.pdfDownloadLimit ?? (p.id === 'plan_1m' ? 30 : p.id === 'plan_3m' ? 90 : p.id === 'plan_6m' ? 180 : 30);
      return {
        ...p,
        pdfLimit,
        pdfDownloadLimit: pdfLimit,
        price: p.priceINR,
        active: p.isActive,
        activeSubscribers: row ? row.count : 0,
      };
    });

    return apiSuccess({ plans: plansWithCount });
  } catch (error: any) {
    console.error('[GET /api/developer/plans] Error:', error);
    return apiError(error.message || 'Failed to fetch plans.', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return apiUnauthorized('Unauthorized. Developer session required.', 'UNAUTHORIZED');
    }

    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const { action, planId, planData } = parsed.body || {};

    if (action === 'CREATE') {
      const newPlan = createPlan(planData);
      return apiSuccess({ plan: newPlan });
    } else if (action === 'UPDATE') {
      if (!planId) {
        return apiError('Plan ID required.', 400);
      }
      const updated = updatePlan(planId, planData);
      return apiSuccess({ plan: updated });
    } else {
      return apiError('Invalid action.', 400);
    }
  } catch (error: any) {
    console.error('[POST /api/developer/plans] Error in plan operation:', error);
    return apiError(error.message || 'Failed to update plan.', 500);
  }
}
