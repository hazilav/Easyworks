import { NextRequest, NextResponse } from 'next/server';
import { getAllPlans, updatePlan } from '@/lib/db/database';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('all') === 'true';
    const plans = getAllPlans(includeInactive);

    // Requirement 11: Format plans with all aliases safely
    const formattedPlans = plans.map((p) => {
      const pdfLimit = p.pdfDownloadLimit ?? (p.id === 'plan_1m' ? 30 : p.id === 'plan_3m' ? 90 : p.id === 'plan_6m' ? 180 : 30);
      return {
        ...p,
        pdfLimit,
        pdfDownloadLimit: pdfLimit,
        price: p.priceINR,
        priceINR: p.priceINR,
        active: p.isActive,
        isActive: p.isActive,
      };
    });

    return apiSuccess({ plans: formattedPlans });
  } catch (error: any) {
    console.error('[GET /api/billing/plans] Error:', error);
    return apiError(error.message || 'Failed to fetch plans', 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const { id, priceINR, name, description, features, isActive, isPopular, pdfDownloadLimit, pdfLimit } = parsed.body || {};

    if (!id) {
      return apiError('Plan ID is required', 400);
    }

    const updated = updatePlan(id, {
      priceINR: priceINR !== undefined ? Number(priceINR) : undefined,
      pdfDownloadLimit: pdfDownloadLimit !== undefined ? Number(pdfDownloadLimit) : (pdfLimit !== undefined ? Number(pdfLimit) : undefined),
      name,
      description,
      features,
      isActive,
      isPopular,
    });

    if (!updated) {
      return apiError('Plan not found', 404);
    }

    const safePdfLimit = updated.pdfDownloadLimit ?? 30;

    return apiSuccess({
      plan: {
        ...updated,
        pdfLimit: safePdfLimit,
        pdfDownloadLimit: safePdfLimit,
        price: updated.priceINR,
        active: updated.isActive,
      },
    });
  } catch (error: any) {
    console.error('[PATCH /api/billing/plans] Error:', error);
    return apiError(error.message || 'Failed to update plan', 500);
  }
}
