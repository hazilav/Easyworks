import { NextRequest, NextResponse } from 'next/server';
import {
  getAllCustomersWithDetails,
  updateCustomerStatus,
  extendCustomerSubscription,
  changeCustomerPlan,
  cancelCustomerSubscription,
  manuallyActivateSubscription,
  resetCustomerAccess,
  adjustCustomerPdfLimit,
  addBonusPdfDownloads,
  removeCustomerPdfCredits,
  resetCustomerPdfUsage,
  getCustomerPdfUsageHistory,
  verifyDeveloperSessionToken,
} from '@/lib/db/database';
import { apiSuccess, apiError, apiUnauthorized, safeReadBody } from '@/lib/api/server';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return apiUnauthorized('Unauthorized. Developer session required.', 'UNAUTHORIZED');
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || undefined;
    const search = searchParams.get('search') || undefined;

    const customers = getAllCustomersWithDetails(filter, search);
    return apiSuccess({ customers });
  } catch (error: any) {
    console.error('[GET /api/developer/customers] Error:', error);
    return apiError(error.message || 'Failed to fetch customers.', 500);
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
    const { action, userId, planId, days, reason, durationMonths, limit, bonus, amount } = parsed.body || {};

    if (!action || !userId) {
      return apiError('Action and userId are required.', 400);
    }

    switch (action) {
      case 'SUSPEND': {
        updateCustomerStatus(userId, 'SUSPENDED', reason);
        return apiSuccess({ message: 'Customer account suspended.' });
      }

      case 'REACTIVATE': {
        updateCustomerStatus(userId, 'ACTIVE');
        return apiSuccess({ message: 'Customer account reactivated.' });
      }

      case 'EXTEND_SUB': {
        const daysNum = parseInt(days, 10) || 30;
        const updatedSub = extendCustomerSubscription(userId, daysNum);
        return apiSuccess({
          message: `Subscription extended by ${daysNum} days.`,
          subscription: updatedSub,
        });
      }

      case 'CHANGE_PLAN': {
        if (!planId) {
          return apiError('Plan ID required.', 400);
        }
        const updatedSub = changeCustomerPlan(userId, planId);
        return apiSuccess({
          message: 'Subscription plan updated.',
          subscription: updatedSub,
        });
      }

      case 'CANCEL_SUB': {
        const updatedSub = cancelCustomerSubscription(userId, reason);
        return apiSuccess({
          message: 'Subscription cancelled.',
          subscription: updatedSub,
        });
      }

      case 'MANUAL_ACTIVATE': {
        if (!planId) {
          return apiError('Plan ID required.', 400);
        }
        const updatedSub = manuallyActivateSubscription(userId, planId, durationMonths);
        return apiSuccess({
          message: 'Subscription manually activated.',
          subscription: updatedSub,
        });
      }

      case 'RESET_ACCESS': {
        const result = resetCustomerAccess(userId);
        return apiSuccess(result);
      }

      case 'ADJUST_PDF_LIMIT': {
        const limitNum = parseInt(limit, 10);
        if (isNaN(limitNum) || limitNum < 0) {
          return apiError('Valid PDF download limit is required.', 400);
        }
        const updatedSub = adjustCustomerPdfLimit(userId, limitNum);
        return apiSuccess({
          message: `PDF download limit updated to ${limitNum}.`,
          subscription: updatedSub,
        });
      }

      case 'ADD_BONUS_PDF': {
        const bonusNum = parseInt(bonus || amount, 10);
        if (isNaN(bonusNum) || bonusNum <= 0) {
          return apiError('Valid bonus amount is required.', 400);
        }
        const updatedSub = addBonusPdfDownloads(userId, bonusNum);
        return apiSuccess({
          message: `Added +${bonusNum} bonus PDF downloads.`,
          subscription: updatedSub,
        });
      }

      case 'REMOVE_PDF_CREDITS': {
        const amountNum = parseInt(amount || bonus, 10);
        if (isNaN(amountNum) || amountNum <= 0) {
          return apiError('Valid amount to remove is required.', 400);
        }
        const updatedSub = removeCustomerPdfCredits(userId, amountNum);
        return apiSuccess({
          message: `Removed ${amountNum} PDF credits.`,
          subscription: updatedSub,
        });
      }

      case 'RESET_PDF_USAGE': {
        const updatedSub = resetCustomerPdfUsage(userId);
        return apiSuccess({
          message: 'PDF downloads usage counter reset to 0.',
          subscription: updatedSub,
        });
      }

      case 'GET_PDF_USAGE_HISTORY': {
        const history = getCustomerPdfUsageHistory(userId);
        return apiSuccess({ history });
      }

      default:
        return apiError(`Unsupported action: ${action}`, 400);
    }
  } catch (error: any) {
    console.error('[POST /api/developer/customers] Error in customer action:', error);
    return apiError(error.message || 'Operation failed.', 500);
  }
}
