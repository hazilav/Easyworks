import { NextRequest, NextResponse } from 'next/server';
import { getBusinessProfileByUserId, getUserById, getDatabase, logActivity } from '@/lib/db/database';
import { apiSuccess, apiError, apiBadRequest, apiNotFound } from '@/lib/api/server';
import crypto from 'node:crypto';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return apiBadRequest('User ID is required.');
    }

    const profile = getBusinessProfileByUserId(userId);
    return apiSuccess({ profile });
  } catch (error: any) {
    console.error('[GET /api/business/profile] Error:', error);
    return apiError(error.message || 'Failed to fetch business profile.', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, ...profileData } = body;

    if (!userId) {
      return apiBadRequest('User ID is required.');
    }

    const user = getUserById(userId);
    if (!user) {
      return apiNotFound('User not found.');
    }

    const db = getDatabase();
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT id FROM businesses WHERE user_id = ?').get(userId) as any;

    if (existing) {
      db.prepare(`
        UPDATE businesses SET
          business_name = ?,
          owner_name = ?,
          tagline = ?,
          phone = ?,
          email = ?,
          website = ?,
          address = ?,
          tax_number = ?,
          currency = ?,
          default_tax_percentage = ?,
          default_payment_terms = ?,
          default_validity_days = ?,
          terms_and_conditions = ?,
          bank_details_json = ?,
          updated_at = ?
        WHERE user_id = ?
      `).run(
        profileData.businessName || user.business_name || 'My Business',
        profileData.ownerName || user.name || 'Owner',
        profileData.tagline || '',
        profileData.phone || '',
        profileData.email || '',
        profileData.website || '',
        profileData.address || '',
        profileData.taxNumber || '',
        profileData.currency || 'INR',
        profileData.defaultTaxPercentage ?? 18,
        profileData.defaultPaymentTerms || '',
        profileData.defaultValidityDays ?? 15,
        profileData.termsAndConditions || '',
        profileData.bankDetails ? JSON.stringify(profileData.bankDetails) : null,
        now,
        userId
      );
    } else {
      const bizId = 'biz_' + crypto.randomUUID().slice(0, 8);
      db.prepare(`
        INSERT INTO businesses (
          id, user_id, business_name, owner_name, tagline, phone, email, website, address,
          tax_number, currency, default_tax_percentage, default_payment_terms,
          default_validity_days, terms_and_conditions, bank_details_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        bizId,
        userId,
        profileData.businessName || user.business_name || 'My Business',
        profileData.ownerName || user.name || 'Owner',
        profileData.tagline || '',
        profileData.phone || '',
        profileData.email || '',
        profileData.website || '',
        profileData.address || '',
        profileData.taxNumber || '',
        profileData.currency || 'INR',
        profileData.defaultTaxPercentage ?? 18,
        profileData.defaultPaymentTerms || '',
        profileData.defaultValidityDays ?? 15,
        profileData.termsAndConditions || '',
        profileData.bankDetails ? JSON.stringify(profileData.bankDetails) : null,
        now,
        now
      );
    }

    logActivity(userId, 'BUSINESS_PROFILE_UPDATED', 'Business profile updated', 'USER');
    const updatedProfile = getBusinessProfileByUserId(userId);
    return apiSuccess({ profile: updatedProfile });
  } catch (error: any) {
    console.error('[POST /api/business/profile] Error:', error);
    return apiError(error.message || 'Failed to save business profile.', 500);
  }
}
