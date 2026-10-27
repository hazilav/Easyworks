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
    const existing = db.prepare('SELECT id, logo_url, logo_original_url, logo_processed_url, logo_background_mode, logo_enabled, logo_enabled_quotations, logo_enabled_invoices FROM businesses WHERE user_id = ?').get(userId) as any;

    // Do not overwrite an existing logo with an empty string unless explicitly removing it
    let logoUrl = existing?.logo_url ?? '';
    if (profileData.removeLogo) {
      logoUrl = '';
    } else if (profileData.logoUrl && typeof profileData.logoUrl === 'string' && profileData.logoUrl.trim().length > 0) {
      logoUrl = profileData.logoUrl;
    }

    let logoOriginalUrl = existing?.logo_original_url ?? logoUrl;
    if (profileData.removeLogo) {
      logoOriginalUrl = '';
    } else if (profileData.logoOriginalUrl && typeof profileData.logoOriginalUrl === 'string' && profileData.logoOriginalUrl.trim().length > 0) {
      logoOriginalUrl = profileData.logoOriginalUrl;
    }

    let logoProcessedUrl = existing?.logo_processed_url ?? logoUrl;
    if (profileData.removeLogo) {
      logoProcessedUrl = '';
    } else if (profileData.logoProcessedUrl && typeof profileData.logoProcessedUrl === 'string' && profileData.logoProcessedUrl.trim().length > 0) {
      logoProcessedUrl = profileData.logoProcessedUrl;
    }

    const logoBackgroundMode = profileData.logoBackgroundMode || (existing?.logo_background_mode ?? 'transparent');
    const logoEnabled = profileData.logoEnabled !== undefined ? (profileData.logoEnabled ? 1 : 0) : (existing?.logo_enabled ?? 1);
    const logoEnabledQuotations = profileData.logoEnabledQuotations !== undefined ? (profileData.logoEnabledQuotations ? 1 : 0) : (existing?.logo_enabled_quotations ?? logoEnabled);
    const logoEnabledInvoices = profileData.logoEnabledInvoices !== undefined ? (profileData.logoEnabledInvoices ? 1 : 0) : (existing?.logo_enabled_invoices ?? logoEnabled);

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
          logo_url = ?,
          logo_original_url = ?,
          logo_processed_url = ?,
          logo_background_mode = ?,
          logo_enabled = ?,
          logo_enabled_quotations = ?,
          logo_enabled_invoices = ?,
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
        logoUrl,
        logoOriginalUrl,
        logoProcessedUrl,
        logoBackgroundMode,
        logoEnabled,
        logoEnabledQuotations,
        logoEnabledInvoices,
        now,
        userId
      );
    } else {
      const bizId = 'biz_' + crypto.randomUUID().slice(0, 8);
      db.prepare(`
        INSERT INTO businesses (
          id, user_id, business_name, owner_name, tagline, phone, email, website, address,
          tax_number, currency, default_tax_percentage, default_payment_terms,
          default_validity_days, terms_and_conditions, bank_details_json,
          logo_url, logo_original_url, logo_processed_url, logo_background_mode,
          logo_enabled, logo_enabled_quotations, logo_enabled_invoices,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        logoUrl,
        logoOriginalUrl,
        logoProcessedUrl,
        logoBackgroundMode,
        logoEnabled,
        logoEnabledQuotations,
        logoEnabledInvoices,
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
