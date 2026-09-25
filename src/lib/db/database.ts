import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  SubscriptionPlan,
  Subscription,
  PaymentRecord,
  CustomPlanRequest,
  SubscriptionStatus,
  PaymentSettings,
  ManualPaymentRequest,
  TrialEligibilityStatus,
  TrialIdentity,
  VerificationCode,
  TrialEligibilityCheckResult,
  DeveloperStats,
  DeveloperCustomerSummary,
  ActivityLog,
} from '@/types';
import { addCalendarMonths, evaluateSubscriptionStatus } from '../billing/dateUtils';
import { normalizeEmail, normalizePhone, normalizeBusinessName, extractDomain } from '../abuse/normalizers';
import { isDisposableEmail } from '../abuse/disposableEmails';

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'easyworks.db');

// Singleton database instance
let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    // Enable foreign keys & WAL mode for performance
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    initDatabase(dbInstance);
  }
  return dbInstance;
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(password, s, 64).toString('hex');
  return { hash: h, salt: s };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const h = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

function initDatabase(db: DatabaseSync) {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      duration_months INTEGER NOT NULL,
      price_inr INTEGER NOT NULL,
      pdf_download_limit INTEGER NOT NULL DEFAULT 20,
      description TEXT NOT NULL,
      features_json TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_popular INTEGER NOT NULL DEFAULT 0,
      is_custom INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      business_name TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      business_name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL,
      trial_started_at TEXT NOT NULL,
      trial_ends_at TEXT NOT NULL,
      subscription_started_at TEXT,
      subscription_ends_at TEXT,
      gateway_subscription_id TEXT,
      pdf_download_limit INTEGER NOT NULL DEFAULT 2,
      pdf_downloads_used INTEGER NOT NULL DEFAULT 0,
      trial_pdf_downloads INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subscription_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      amount_inr INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL,
      gateway TEXT NOT NULL DEFAULT 'razorpay',
      gateway_payment_id TEXT,
      gateway_order_id TEXT,
      payment_method TEXT,
      receipt_number TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
    );

    CREATE TABLE IF NOT EXISTS payment_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      processed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custom_plan_requests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      business_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      duration TEXT NOT NULL,
      requirements TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_settings (
      id TEXT PRIMARY KEY,
      upi_id TEXT NOT NULL,
      qr_code_url TEXT NOT NULL,
      bank_account_name TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      bank_account_number TEXT NOT NULL,
      bank_ifsc TEXT NOT NULL,
      bank_branch TEXT NOT NULL,
      whatsapp_number TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS manual_payment_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      amount_inr INTEGER NOT NULL,
      utr_number TEXT NOT NULL,
      screenshot_url TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      rejection_reason TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

    CREATE INDEX IF NOT EXISTS idx_subs_user_id ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
    CREATE INDEX IF NOT EXISTS idx_mpr_user_id ON manual_payment_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_mpr_status ON manual_payment_requests(status);

    CREATE TABLE IF NOT EXISTS trial_identities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      business_id TEXT,
      email TEXT NOT NULL,
      normalized_email TEXT NOT NULL,
      phone TEXT,
      normalized_phone TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      phone_verified INTEGER NOT NULL DEFAULT 0,
      business_name TEXT,
      normalized_business_name TEXT,
      business_domain TEXT,
      gstin TEXT,
      device_id TEXT,
      ip_address TEXT,
      eligibility_status TEXT NOT NULL DEFAULT 'REQUIRES_VERIFICATION',
      abuse_risk_score INTEGER NOT NULL DEFAULT 0,
      flag_reason TEXT,
      trial_started_at TEXT,
      trial_ends_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS verification_codes (
      id TEXT PRIMARY KEY,
      target TEXT NOT NULL,
      channel TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      verified_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 1,
      window_start INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_sessions (
      device_id TEXT PRIMARY KEY,
      ip_address TEXT,
      user_id TEXT,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      trials_associated INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_trial_norm_email ON trial_identities(normalized_email);
    CREATE INDEX IF NOT EXISTS idx_trial_norm_phone ON trial_identities(normalized_phone);
    CREATE INDEX IF NOT EXISTS idx_trial_norm_biz ON trial_identities(normalized_business_name);
    CREATE INDEX IF NOT EXISTS idx_trial_gstin ON trial_identities(gstin);
    CREATE INDEX IF NOT EXISTS idx_trial_device ON trial_identities(device_id);
    CREATE INDEX IF NOT EXISTS idx_trial_ip ON trial_identities(ip_address);
    CREATE INDEX IF NOT EXISTS idx_trial_status ON trial_identities(eligibility_status);
    CREATE INDEX IF NOT EXISTS idx_vc_target ON verification_codes(target);
    CREATE INDEX IF NOT EXISTS idx_vc_target_code ON verification_codes(target, code);

    CREATE TABLE IF NOT EXISTS quotations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      quotation_number TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      customer_name TEXT,
      grand_total REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'INR',
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      customer_name TEXT,
      grand_total REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'INR',
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      actor TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pdf_usage_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      business_name TEXT,
      document_id TEXT,
      document_type TEXT NOT NULL,
      document_number TEXT,
      subscription_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotations(user_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_pdf_logs_user ON pdf_usage_logs(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_pdf_logs_created ON pdf_usage_logs(created_at);
  `);

  // Safe migration for existing subscriptions and users tables
  try {
    db.exec('ALTER TABLE subscriptions ADD COLUMN trial_pdf_downloads INTEGER NOT NULL DEFAULT 0;');
  } catch {
    // Column already exists
  }

  try { db.exec('ALTER TABLE users ADD COLUMN phone TEXT;'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT;'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN password_salt TEXT;'); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE';"); } catch {}
  try { db.exec('ALTER TABLE plans ADD COLUMN pdf_download_limit INTEGER NOT NULL DEFAULT 30;'); } catch {}
  try { db.exec('ALTER TABLE subscriptions ADD COLUMN pdf_download_limit INTEGER NOT NULL DEFAULT 2;'); } catch {}
  try { db.exec('ALTER TABLE subscriptions ADD COLUMN pdf_downloads_used INTEGER NOT NULL DEFAULT 0;'); } catch {}

  // Update plan prices, names, and PDF download limits: Basic=299 (30), Standard=849 (90), Premium=1699 (180)
  try {
    db.prepare("UPDATE plans SET name = 'Basic', price_inr = 299, pdf_download_limit = 30 WHERE id = 'plan_1m'").run();
    db.prepare("UPDATE plans SET name = 'Standard', price_inr = 849, pdf_download_limit = 90 WHERE id = 'plan_3m'").run();
    db.prepare("UPDATE plans SET name = 'Premium', price_inr = 1699, pdf_download_limit = 180 WHERE id = 'plan_6m'").run();
  } catch {
    // ignore
  }

  // Seed default plans if empty
  const planCountStmt = db.prepare('SELECT COUNT(*) as count FROM plans');
  const countRes = planCountStmt.get() as { count: number };

  if (countRes.count === 0) {
    const now = new Date().toISOString();
    const insertPlan = db.prepare(`
      INSERT INTO plans (id, name, duration_months, price_inr, pdf_download_limit, description, features_json, is_active, is_popular, is_custom, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPlan.run(
      'plan_1m',
      'Basic',
      1,
      299,
      30,
      'Flexible monthly billing for growing businesses.',
      JSON.stringify([
        '30 Total PDF Downloads',
        'Unlimited Quotations & Invoices',
        'All Curated Design Templates',
        'Customer Directory Management',
        'Automated GST & Tax Calculations',
        'Standard Email Support',
      ]),
      1,
      0,
      0,
      now,
      now
    );

    insertPlan.run(
      'plan_3m',
      'Standard',
      3,
      849,
      90,
      'Quarterly subscription with significant savings.',
      JSON.stringify([
        '90 Total PDF Downloads',
        'Everything in Basic Plan',
        'Save vs Monthly Subscription',
        'Custom Logo & Business Branding',
        'Item & Service Rate Catalog',
        'Priority Support via Email & Chat',
      ]),
      1,
      1,
      0,
      now,
      now
    );

    insertPlan.run(
      'plan_6m',
      'Premium',
      6,
      1699,
      180,
      'Best value for established contractors and agencies.',
      JSON.stringify([
        '180 Total PDF Downloads',
        'Everything in Standard Plan',
        'Highest Overall Cost Savings',
        'All Premium Current & Future Templates',
        'Direct UPI & Bank QR Display',
        'VIP Account & Billing Assistance',
      ]),
      1,
      0,
      0,
      now,
      now
    );

    insertPlan.run(
      'plan_custom',
      'Custom Plan',
      0,
      0,
      0,
      'Tailored duration, multi-seat, and custom billing arrangement.',
      JSON.stringify([
        'Configurable PDF Downloads',
        'Custom Duration & Contract Terms',
        'Tailored High-Volume Pricing',
        'Multiple Business Workspaces',
        'Custom Template Design Integration',
        'Dedicated Account Manager',
      ]),
      1,
      0,
      1,
      now,
      now
    );
  }

  // Seed default payment settings if empty
  try {
    const psCount = (db.prepare('SELECT COUNT(*) as count FROM payment_settings').get() as any).count;
    if (psCount === 0) {
      db.prepare(`
        INSERT INTO payment_settings (
          id, upi_id, qr_code_url, bank_account_name, bank_name,
          bank_account_number, bank_ifsc, bank_branch, whatsapp_number, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'default',
        '9539933265@naviaxis',
        '',
        'Easyworks Solutions Private Limited',
        'HDFC Bank',
        '50200088991122',
        'HDFC0001234',
        'Indiranagar Branch, Bengaluru',
        '9539933265',
        new Date().toISOString()
      );
    } else {
      // Update existing default UPI ID and WhatsApp number
      db.prepare("UPDATE payment_settings SET upi_id = '9539933265@naviaxis' WHERE upi_id = 'easyworks@upi'").run();
      db.prepare("UPDATE payment_settings SET whatsapp_number = '9539933265' WHERE whatsapp_number = '919876543210'").run();
    }
  } catch {
    // ignore
  }

  // Ensure Super Admin Muhammed Hazil (muhammedhazilav@gmail.com)
  try {
    const adminEmail = 'muhammedhazilav@gmail.com';
    const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail) as any;
    const initialPass = process.env.DEVELOPER_PASSWORD || 'easyworks@lnz321';
    const { hash, salt } = hashPassword(initialPass);

    if (existingAdmin) {
      db.prepare(`
        UPDATE users
        SET role = 'SUPER_ADMIN',
            phone = '9539933265',
            name = COALESCE(NULLIF(name, ''), 'Muhammed Hazil'),
            status = 'ACTIVE',
            password_hash = COALESCE(password_hash, ?),
            password_salt = COALESCE(password_salt, ?)
        WHERE email = ?
      `).run(hash, salt, adminEmail);
    } else {
      const now = new Date().toISOString();
      const adminId = 'usr_super_admin_hazil';
      db.prepare(`
        INSERT INTO users (id, email, name, business_name, role, phone, status, password_hash, password_salt, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        adminId,
        adminEmail,
        'Muhammed Hazil',
        'Easyworks HQ',
        'SUPER_ADMIN',
        '9539933265',
        'ACTIVE',
        hash,
        salt,
        now
      );

      db.prepare(`
        INSERT OR IGNORE INTO businesses (id, user_id, business_name, owner_name, currency, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('biz_' + adminId, adminId, 'Easyworks HQ', 'Muhammed Hazil', 'INR', now);

      db.prepare(`
        INSERT OR IGNORE INTO subscriptions (
          id, user_id, plan_id, status, trial_started_at, trial_ends_at,
          subscription_started_at, subscription_ends_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'sub_' + adminId,
        adminId,
        'plan_6m',
        'ACTIVE',
        now,
        new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
        now,
        new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
        now,
        now
      );
    }
  } catch (e) {
    console.error('Error ensuring super admin account:', e);
  }
}


// ------------------------------------------------------------------
// Plans API Helpers
// ------------------------------------------------------------------

export function getAllPlans(includeInactive = false): SubscriptionPlan[] {
  const db = getDatabase();
  const sql = includeInactive
    ? 'SELECT * FROM plans ORDER BY is_custom ASC, duration_months ASC'
    : 'SELECT * FROM plans WHERE is_active = 1 ORDER BY is_custom ASC, duration_months ASC';

  const rows = db.prepare(sql).all() as any[];
  const safeParseFeatures = (str: any) => {
    try {
      return str ? JSON.parse(str) : [];
    } catch {
      return [];
    }
  };
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    durationMonths: r.duration_months,
    priceINR: r.price_inr,
    pdfDownloadLimit: Number(r.pdf_download_limit ?? (r.id === 'plan_1m' ? 30 : r.id === 'plan_3m' ? 90 : r.id === 'plan_6m' ? 180 : 30)),
    description: r.description,
    features: safeParseFeatures(r.features_json),
    isActive: Boolean(r.is_active),
    isPopular: Boolean(r.is_popular),
    isCustom: Boolean(r.is_custom),
  }));
}

export function getPlanById(id: string): SubscriptionPlan | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as any;
  if (!row) return null;
  const safeParseFeatures = (str: any) => {
    try {
      return str ? JSON.parse(str) : [];
    } catch {
      return [];
    }
  };
  return {
    id: row.id,
    name: row.name,
    durationMonths: row.duration_months,
    priceINR: row.price_inr,
    pdfDownloadLimit: Number(row.pdf_download_limit ?? (row.id === 'plan_1m' ? 30 : row.id === 'plan_3m' ? 90 : row.id === 'plan_6m' ? 180 : 30)),
    description: row.description,
    features: safeParseFeatures(row.features_json),
    isActive: Boolean(row.is_active),
    isPopular: Boolean(row.is_popular),
    isCustom: Boolean(row.is_custom),
  };
}

export function updatePlan(
  id: string,
  data: Partial<Omit<SubscriptionPlan, 'id'>>
): SubscriptionPlan | null {
  const db = getDatabase();
  const existing = getPlanById(id);
  if (!existing) return null;

  const name = data.name ?? existing.name;
  const durationMonths = data.durationMonths ?? existing.durationMonths;
  const priceINR = data.priceINR ?? existing.priceINR;
  const pdfDownloadLimit = data.pdfDownloadLimit !== undefined ? data.pdfDownloadLimit : existing.pdfDownloadLimit;
  const description = data.description ?? existing.description;
  const featuresJson = JSON.stringify(data.features ?? existing.features);
  const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : existing.isActive ? 1 : 0;
  const isPopular = data.isPopular !== undefined ? (data.isPopular ? 1 : 0) : existing.isPopular ? 1 : 0;
  const updatedAt = new Date().toISOString();

  db.prepare(`
    UPDATE plans
    SET name = ?, duration_months = ?, price_inr = ?, pdf_download_limit = ?, description = ?, features_json = ?, is_active = ?, is_popular = ?, updated_at = ?
    WHERE id = ?
  `).run(name, durationMonths, priceINR, pdfDownloadLimit, description, featuresJson, isActive, isPopular, updatedAt, id);

  return getPlanById(id);
}

// ------------------------------------------------------------------
// Users & Subscriptions API Helpers
// ------------------------------------------------------------------

export function ensureUserAndTrial(
  userId: string,
  email: string,
  name: string,
  businessName?: string
): { user: any; subscription: Subscription } {
  const db = getDatabase();
  const now = new Date();
  const nowISO = now.toISOString();

  // 1. Ensure user
  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    const isFirstUser = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c === 0;
    const role = isFirstUser ? 'admin' : 'user';

    db.prepare(`
      INSERT INTO users (id, email, name, business_name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email.toLowerCase(), name, businessName || `${name}'s Business`, role, nowISO);

    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    // Business record
    db.prepare(`
      INSERT INTO businesses (id, user_id, business_name, owner_name, currency, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('biz_' + userId, userId, businessName || `${name}'s Business`, name, 'INR', nowISO);
  }

  // 2. Ensure subscription (7-day trial for new accounts)
  let subRow = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) as any;
  if (!subRow) {
    const trialStart = now;
    const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const subId = 'sub_' + userId;

    db.prepare(`
      INSERT INTO subscriptions (
        id, user_id, plan_id, status, trial_started_at, trial_ends_at,
        subscription_started_at, subscription_ends_at, pdf_download_limit, pdf_downloads_used,
        trial_pdf_downloads, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      subId,
      userId,
      'plan_1m', // default initial plan association
      'TRIALING',
      trialStart.toISOString(),
      trialEnd.toISOString(),
      null,
      null,
      2, // 2 free trial PDF downloads limit
      0, // 0 used
      0,
      nowISO,
      nowISO
    );

    subRow = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId);
  }

  // 3. Ensure trial_identities record
  let identityRow = db.prepare('SELECT * FROM trial_identities WHERE user_id = ?').get(userId) as any;
  if (!identityRow) {
    const isDemo = email.endsWith('@easyworks.com') || email === 'admin@easyworks.com';
    const normEmail = normalizeEmail(email);
    const normBiz = businessName ? normalizeBusinessName(businessName) : undefined;
    const demoPhone = isDemo ? (userId === 'usr_interior' ? '+919876543210' : '+919876543211') : undefined;

    db.prepare(`
      INSERT INTO trial_identities (
        id, user_id, business_id, email, normalized_email, phone, normalized_phone,
        email_verified, phone_verified, business_name, normalized_business_name,
        business_domain, gstin, eligibility_status, abuse_risk_score,
        trial_started_at, trial_ends_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'tid_' + userId,
      userId,
      'biz_' + userId,
      email,
      normEmail,
      demoPhone || null,
      demoPhone || null,
      isDemo ? 1 : 0,
      isDemo ? 1 : 0,
      businessName || null,
      normBiz || null,
      extractDomain(email),
      null,
      isDemo ? 'ELIGIBLE' : 'REQUIRES_VERIFICATION',
      0,
      isDemo ? nowISO : null,
      isDemo ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
      nowISO,
      nowISO
    );
  }

  const plan = getPlanById(subRow.plan_id) || (getAllPlans()[0] as SubscriptionPlan);
  const isSuspended = user?.status === 'SUSPENDED' || subRow.status === 'SUSPENDED';
  const evaluated = evaluateSubscriptionStatus({
    status: isSuspended ? 'SUSPENDED' : subRow.status,
    trialEndsAt: subRow.trial_ends_at,
    subscriptionEndsAt: subRow.subscription_ends_at,
  });

  const isSubscribed = !isSuspended && evaluated.effectiveStatus === 'ACTIVE';
  const planDefaultLimit = isSubscribed
    ? (plan?.pdfDownloadLimit || (subRow.plan_id === 'plan_1m' ? 20 : subRow.plan_id === 'plan_3m' ? 60 : subRow.plan_id === 'plan_6m' ? 120 : 20))
    : 2;
  const pdfLimit = Number(subRow.pdf_download_limit ?? planDefaultLimit);
  const pdfUsed = Number(subRow.pdf_downloads_used ?? subRow.trial_pdf_downloads ?? 0);
  const pdfRemaining = Math.max(0, pdfLimit - pdfUsed);

  const subscription: Subscription = {
    id: subRow.id,
    userId: subRow.user_id,
    planId: subRow.plan_id,
    status: isSuspended ? 'SUSPENDED' : (evaluated.effectiveStatus as SubscriptionStatus),
    trialStartedAt: subRow.trial_started_at,
    trialEndsAt: subRow.trial_ends_at,
    subscriptionStartedAt: subRow.subscription_started_at,
    subscriptionEndsAt: subRow.subscription_ends_at,
    gatewaySubscriptionId: subRow.gateway_subscription_id,
    createdAt: subRow.created_at,
    updatedAt: subRow.updated_at,
    plan,
    trialDaysRemaining: isSuspended ? 0 : evaluated.daysRemaining,
    hasAccess: isSuspended ? false : evaluated.hasAccess,
    pdfDownloadLimit: pdfLimit,
    pdfDownloadsUsed: pdfUsed,
    pdfDownloadsRemaining: pdfRemaining,
    trialPdfDownloads: pdfUsed,
    maxTrialPdfDownloads: pdfLimit,
  };

  return { user, subscription };
}

export function getUserSubscription(userId: string): Subscription | null {
  const db = getDatabase();
  const user = db.prepare('SELECT status FROM users WHERE id = ?').get(userId) as any;
  const subRow = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) as any;
  if (!subRow) return null;

  const plan = getPlanById(subRow.plan_id) || (getAllPlans()[0] as SubscriptionPlan);
  const isSuspended = user?.status === 'SUSPENDED' || subRow.status === 'SUSPENDED';
  const evaluated = evaluateSubscriptionStatus({
    status: isSuspended ? 'SUSPENDED' : subRow.status,
    trialEndsAt: subRow.trial_ends_at,
    subscriptionEndsAt: subRow.subscription_ends_at,
  });

  const isSubscribed = !isSuspended && evaluated.effectiveStatus === 'ACTIVE';
  const planDefaultLimit = isSubscribed
    ? (plan?.pdfDownloadLimit || (subRow.plan_id === 'plan_1m' ? 20 : subRow.plan_id === 'plan_3m' ? 60 : subRow.plan_id === 'plan_6m' ? 120 : 20))
    : 2;
  const pdfLimit = Number(subRow.pdf_download_limit ?? planDefaultLimit);
  const pdfUsed = Number(subRow.pdf_downloads_used ?? subRow.trial_pdf_downloads ?? 0);
  const pdfRemaining = Math.max(0, pdfLimit - pdfUsed);

  return {
    id: subRow.id,
    userId: subRow.user_id,
    planId: subRow.plan_id,
    status: isSuspended ? 'SUSPENDED' : (evaluated.effectiveStatus as SubscriptionStatus),
    trialStartedAt: subRow.trial_started_at,
    trialEndsAt: subRow.trial_ends_at,
    subscriptionStartedAt: subRow.subscription_started_at,
    subscriptionEndsAt: subRow.subscription_ends_at,
    gatewaySubscriptionId: subRow.gateway_subscription_id,
    createdAt: subRow.created_at,
    updatedAt: subRow.updated_at,
    plan,
    trialDaysRemaining: isSuspended ? 0 : evaluated.daysRemaining,
    hasAccess: isSuspended ? false : evaluated.hasAccess,
    pdfDownloadLimit: pdfLimit,
    pdfDownloadsUsed: pdfUsed,
    pdfDownloadsRemaining: pdfRemaining,
    trialPdfDownloads: pdfUsed,
    maxTrialPdfDownloads: pdfLimit,
  };
}

export interface VerifyPdfDownloadResult {
  allowed: boolean;
  reason?: 'LIMIT_REACHED' | 'EXPIRED' | 'NOT_FOUND';
  pdfDownloadLimit?: number;
  pdfDownloadsUsed?: number;
  pdfDownloadsRemaining?: number;
  trialPdfDownloads: number;
  maxTrialDownloads: number;
  isSubscribed: boolean;
  message?: string;
}

export interface VerifyPdfDownloadOptions {
  docId?: string;
  documentType?: 'QUOTATION' | 'INVOICE' | 'OTHER';
  documentNumber?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Authoritatively verifies and consumes exactly 1 PDF credit based on the customer's current subscription plan.
 * Controlled strictly server-side with atomic transaction locks.
 */
export function verifyAndConsumeTrialPdfDownload(
  userId: string,
  options?: string | VerifyPdfDownloadOptions
): VerifyPdfDownloadResult {
  const db = getDatabase();
  const userRow = db.prepare('SELECT status, business_name FROM users WHERE id = ?').get(userId) as any;
  const subRow = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) as any;

  const opts: VerifyPdfDownloadOptions =
    typeof options === 'string' ? { docId: options } : options || {};
  const docId = opts.docId;
  const documentType = opts.documentType || 'QUOTATION';
  const documentNumber = opts.documentNumber;
  const ipAddress = opts.ipAddress;
  const userAgent = opts.userAgent;

  if (!subRow) {
    return {
      allowed: false,
      reason: 'NOT_FOUND',
      pdfDownloadLimit: 2,
      pdfDownloadsUsed: 0,
      pdfDownloadsRemaining: 0,
      trialPdfDownloads: 0,
      maxTrialDownloads: 2,
      isSubscribed: false,
      message: 'No subscription or trial record found.',
    };
  }

  // If user account or subscription is suspended, immediately block PDF download
  if (userRow?.status === 'SUSPENDED' || subRow.status === 'SUSPENDED') {
    const limit = Number(subRow.pdf_download_limit ?? 2);
    const used = Number(subRow.pdf_downloads_used ?? subRow.trial_pdf_downloads ?? 0);
    return {
      allowed: false,
      reason: 'EXPIRED',
      pdfDownloadLimit: limit,
      pdfDownloadsUsed: used,
      pdfDownloadsRemaining: 0,
      trialPdfDownloads: used,
      maxTrialDownloads: limit,
      isSubscribed: false,
      message: 'Your account has been suspended by the administrator. Contact WhatsApp: 9539933265',
    };
  }

  const evaluated = evaluateSubscriptionStatus({
    status: subRow.status,
    trialEndsAt: subRow.trial_ends_at,
    subscriptionEndsAt: subRow.subscription_ends_at,
  });

  const isSubscribed = evaluated.effectiveStatus === 'ACTIVE';
  const plan = getPlanById(subRow.plan_id);
  const planDefaultLimit = isSubscribed
    ? (plan?.pdfDownloadLimit || (subRow.plan_id === 'plan_1m' ? 30 : subRow.plan_id === 'plan_3m' ? 90 : subRow.plan_id === 'plan_6m' ? 180 : 30))
    : 2;

  const pdfDownloadLimit = Number(subRow.pdf_download_limit ?? planDefaultLimit);
  const pdfDownloadsUsed = Number(subRow.pdf_downloads_used ?? subRow.trial_pdf_downloads ?? 0);

  // 1. Check if user has reached their plan's PDF download limit
  if (pdfDownloadsUsed >= pdfDownloadLimit) {
    return {
      allowed: false,
      reason: 'LIMIT_REACHED',
      pdfDownloadLimit,
      pdfDownloadsUsed,
      pdfDownloadsRemaining: 0,
      trialPdfDownloads: Number(subRow.trial_pdf_downloads) || 0,
      maxTrialDownloads: pdfDownloadLimit,
      isSubscribed,
      message: isSubscribed
        ? 'PDF download limit reached. Upgrade or renew your plan to continue.'
        : "You've used all 2 trial PDF downloads. Subscribe to continue downloading PDFs.",
    };
  }

  // 2. For trial accounts: cross-check identity cluster by normalized phone
  if (!isSubscribed) {
    const identityRow = db.prepare('SELECT * FROM trial_identities WHERE user_id = ?').get(userId) as any;
    if (identityRow && identityRow.normalized_phone) {
      const clusterDownloads = db.prepare(`
        SELECT COALESCE(SUM(COALESCE(s.pdf_downloads_used, s.trial_pdf_downloads, 0)), 0) as total
        FROM subscriptions s
        JOIN trial_identities t ON s.user_id = t.user_id
        WHERE t.normalized_phone = ?
      `).get(identityRow.normalized_phone) as { total: number };

      if (clusterDownloads && clusterDownloads.total >= 2) {
        return {
          allowed: false,
          reason: 'LIMIT_REACHED',
          pdfDownloadLimit: 2,
          pdfDownloadsUsed: clusterDownloads.total,
          pdfDownloadsRemaining: 0,
          trialPdfDownloads: clusterDownloads.total,
          maxTrialDownloads: 2,
          isSubscribed: false,
          message: "You've used all 2 trial PDF downloads. Subscribe to continue downloading PDFs.",
        };
      }
    }
  }

  // 3. Retry debounce protection (Requirement 20: Do not allow same PDF export to consume multiple credits on retry)
  if (docId) {
    const thirtySecsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const recentDownload = db.prepare(`
      SELECT * FROM pdf_usage_logs
      WHERE user_id = ? AND document_id = ? AND created_at >= ?
      ORDER BY created_at DESC LIMIT 1
    `).get(userId, docId, thirtySecsAgo) as any;

    if (recentDownload) {
      return {
        allowed: true,
        pdfDownloadLimit,
        pdfDownloadsUsed,
        pdfDownloadsRemaining: Math.max(0, pdfDownloadLimit - pdfDownloadsUsed),
        trialPdfDownloads: Number(subRow.trial_pdf_downloads) || 0,
        maxTrialDownloads: pdfDownloadLimit,
        isSubscribed,
      };
    }
  }

  // 4. ATOMIC PDF CREDIT CONSUMPTION (Requirement 16):
  // Atomically increment ONLY if pdf_downloads_used < pdf_download_limit.
  // This guarantees race-condition immunity under concurrent requests.
  const nowISO = new Date().toISOString();
  let updatedUsed = pdfDownloadsUsed;

  const updateResult = db.prepare(`
    UPDATE subscriptions
    SET pdf_downloads_used = pdf_downloads_used + 1,
        trial_pdf_downloads = CASE WHEN status = 'TRIALING' THEN trial_pdf_downloads + 1 ELSE trial_pdf_downloads END,
        updated_at = ?
    WHERE user_id = ? AND pdf_downloads_used < pdf_download_limit
  `).run(nowISO, userId);

  if (updateResult.changes === 0) {
    return {
      allowed: false,
      reason: 'LIMIT_REACHED',
      pdfDownloadLimit,
      pdfDownloadsUsed,
      pdfDownloadsRemaining: 0,
      trialPdfDownloads: Number(subRow.trial_pdf_downloads) || 0,
      maxTrialDownloads: pdfDownloadLimit,
      isSubscribed,
      message: isSubscribed
        ? 'PDF download limit reached. Upgrade or renew your plan to continue.'
        : "You've used all 2 trial PDF downloads. Subscribe to continue downloading PDFs.",
    };
  }

  // Re-read updated counter
  const freshSub = db.prepare('SELECT pdf_downloads_used, trial_pdf_downloads FROM subscriptions WHERE user_id = ?').get(userId) as any;
  updatedUsed = freshSub ? Number(freshSub.pdf_downloads_used) : pdfDownloadsUsed + 1;
  const updatedRemaining = Math.max(0, pdfDownloadLimit - updatedUsed);

  // 5. Record in PDF Usage History (Requirement 15)
  const logId = 'pdf_log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  try {
    db.prepare(`
      INSERT INTO pdf_usage_logs (
        id, user_id, business_name, document_id, document_type, document_number, subscription_id, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      userId,
      userRow?.business_name || null,
      docId || null,
      documentType,
      documentNumber || null,
      subRow.id,
      ipAddress || null,
      userAgent || null,
      nowISO
    );
  } catch (e) {
    console.error('Error logging PDF usage history:', e);
  }

  logActivity(
    userId,
    'PDF_DOWNLOAD_CONSUMED',
    `PDF credit consumed (${updatedUsed}/${pdfDownloadLimit}) for ${documentType} ${documentNumber ? '#' + documentNumber : ''}`,
    'USER'
  );

  return {
    allowed: true,
    pdfDownloadLimit,
    pdfDownloadsUsed: updatedUsed,
    pdfDownloadsRemaining: updatedRemaining,
    trialPdfDownloads: Number(freshSub?.trial_pdf_downloads) || updatedUsed,
    maxTrialDownloads: pdfDownloadLimit,
    isSubscribed,
  };
}

export const verifyAndConsumePdfDownload = verifyAndConsumeTrialPdfDownload;

/**
 * Executes a callback within a SQLite immediate transaction.
 * Supports nesting safely.
 */
export function runInTransaction<T>(fn: () => T): T {
  const db = getDatabase();
  let inTx = false;
  try {
    db.exec('BEGIN IMMEDIATE TRANSACTION;');
    inTx = true;
  } catch {
    // Nested transaction or already active
    inTx = false;
  }

  try {
    const result = fn();
    if (inTx) db.exec('COMMIT;');
    return result;
  } catch (err) {
    if (inTx) {
      try { db.exec('ROLLBACK;'); } catch {}
    }
    throw err;
  }
}

/**
 * Activates a paid subscription for a user after successful payment verification.
 * Calculates calendar-accurate duration (+1, +3, +6 months).
 * Sets package-based PDF download limit and resets/preserves usage accordingly.
 */
export function activateSubscription({
  userId,
  planId,
  gatewaySubscriptionId,
}: {
  userId: string;
  planId: string;
  gatewaySubscriptionId?: string;
}): Subscription {
  const db = getDatabase();
  const plan = getPlanById(planId);
  if (!plan) throw new Error('Plan not found: ' + planId);

  const existing = getUserSubscription(userId);
  const now = new Date();
  let newStart = now;
  let newEnd: Date;

  // Check if this is an active renewal of the same plan
  const isSamePlanRenewal = existing && existing.status === 'ACTIVE' && existing.planId === plan.id;

  // If already active and not expired, extend from existing expiry date
  if (existing && existing.status === 'ACTIVE' && existing.subscriptionEndsAt) {
    const curEnd = new Date(existing.subscriptionEndsAt);
    if (curEnd.getTime() > now.getTime()) {
      newStart = new Date(existing.subscriptionStartedAt || now.toISOString());
      newEnd = addCalendarMonths(curEnd, plan.durationMonths);
    } else {
      newEnd = addCalendarMonths(now, plan.durationMonths);
    }
  } else {
    newEnd = addCalendarMonths(now, plan.durationMonths);
  }

  const nowISO = now.toISOString();
  const startISO = newStart.toISOString();
  const endISO = newEnd.toISOString();

  const planPdfLimit = plan.pdfDownloadLimit || (plan.id === 'plan_1m' ? 30 : plan.id === 'plan_3m' ? 90 : plan.id === 'plan_6m' ? 180 : 30);
  // When a subscription is renewed or upgraded, create/reset the PDF allowance for the new period (Requirement 12 & 13)
  const newPdfLimit = planPdfLimit;
  const newPdfUsed = 0;

  runInTransaction(() => {
    db.prepare(`
      UPDATE subscriptions
      SET plan_id = ?, status = 'ACTIVE', subscription_started_at = ?, subscription_ends_at = ?,
          gateway_subscription_id = ?, pdf_download_limit = ?, pdf_downloads_used = ?, trial_pdf_downloads = ?, updated_at = ?
      WHERE user_id = ?
    `).run(plan.id, startISO, endISO, gatewaySubscriptionId || null, newPdfLimit, newPdfUsed, newPdfUsed, nowISO, userId);
  });

  logActivity(userId, 'SUBSCRIPTION_ACTIVATED', `Activated ${plan.name} (${planPdfLimit} PDFs) until ${endISO.split('T')[0]}`, 'SYSTEM');

  return getUserSubscription(userId)!;
}

// ------------------------------------------------------------------
// Payments & Receipts API Helpers
// ------------------------------------------------------------------

export function recordPayment({
  userId,
  subscriptionId,
  planId,
  planName,
  amountINR,
  currency = 'INR',
  status,
  gateway = 'razorpay',
  gatewayPaymentId,
  gatewayOrderId,
  paymentMethod,
}: {
  userId: string;
  subscriptionId: string;
  planId: string;
  planName: string;
  amountINR: number;
  currency?: string;
  status: 'SUCCESS' | 'FAILED' | 'REFUNDED';
  gateway?: string;
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  paymentMethod?: string;
}): PaymentRecord {
  const db = getDatabase();
  const now = new Date();
  const id = 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const receiptNumber = `RCP-${now.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  db.prepare(`
    INSERT INTO payments (
      id, user_id, subscription_id, plan_id, plan_name, amount_inr,
      currency, status, gateway, gateway_payment_id, gateway_order_id,
      payment_method, receipt_number, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    subscriptionId,
    planId,
    planName,
    amountINR,
    currency,
    status,
    gateway,
    gatewayPaymentId || null,
    gatewayOrderId || null,
    paymentMethod || 'UPI/Card/Netbanking',
    receiptNumber,
    now.toISOString()
  );

  return {
    id,
    userId,
    subscriptionId,
    planId,
    planName,
    amountINR,
    currency,
    status,
    gateway,
    gatewayPaymentId,
    gatewayOrderId,
    paymentMethod: paymentMethod || 'UPI/Card/Netbanking',
    receiptNumber,
    createdAt: now.toISOString(),
  };
}

export function getUserPayments(userId: string): PaymentRecord[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId) as any[];

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    subscriptionId: r.subscription_id,
    planId: r.plan_id,
    planName: r.plan_name,
    amountINR: r.amount_inr,
    currency: r.currency,
    status: r.status,
    gateway: r.gateway,
    gatewayPaymentId: r.gateway_payment_id,
    gatewayOrderId: r.gateway_order_id,
    paymentMethod: r.payment_method,
    receiptNumber: r.receipt_number,
    createdAt: r.created_at,
  }));
}

export function getPaymentById(paymentId: string): PaymentRecord | null {
  const db = getDatabase();
  const r = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as any;
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id,
    subscriptionId: r.subscription_id,
    planId: r.plan_id,
    planName: r.plan_name,
    amountINR: r.amount_inr,
    currency: r.currency,
    status: r.status,
    gateway: r.gateway,
    gatewayPaymentId: r.gateway_payment_id,
    gatewayOrderId: r.gateway_order_id,
    paymentMethod: r.payment_method,
    receiptNumber: r.receipt_number,
    createdAt: r.created_at,
  };
}

// ------------------------------------------------------------------
// Webhook Idempotency
// ------------------------------------------------------------------

export function isWebhookEventProcessed(eventId: string): boolean {
  const db = getDatabase();
  const row = db.prepare('SELECT id FROM payment_events WHERE id = ?').get(eventId);
  return Boolean(row);
}

export function recordWebhookEvent(eventId: string, eventType: string, payload: any) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO payment_events (id, event_type, payload_json, processed_at)
    VALUES (?, ?, ?, ?)
  `).run(eventId, eventType, JSON.stringify(payload), new Date().toISOString());
}

// ------------------------------------------------------------------
// Custom Plan Requests
// ------------------------------------------------------------------

export function createCustomPlanRequest(data: Omit<CustomPlanRequest, 'id' | 'status' | 'createdAt'>): CustomPlanRequest {
  const db = getDatabase();
  const id = 'req_' + Date.now();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO custom_plan_requests (id, name, business_name, email, phone, duration, requirements, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
  `).run(id, data.name, data.businessName, data.email, data.phone, data.duration, data.requirements, now);

  return {
    id,
    name: data.name,
    businessName: data.businessName,
    email: data.email,
    phone: data.phone,
    duration: data.duration,
    requirements: data.requirements,
    status: 'PENDING',
    createdAt: now,
  };
}

export function getAllCustomPlanRequests(): CustomPlanRequest[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM custom_plan_requests ORDER BY created_at DESC').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    businessName: r.business_name,
    email: r.email,
    phone: r.phone,
    duration: r.duration,
    requirements: r.requirements,
    status: r.status,
    createdAt: r.created_at,
  }));
}

// ------------------------------------------------------------------
// Admin Management API Helpers
// ------------------------------------------------------------------

export function getAllSubscribers(): any[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT 
      u.id as user_id,
      u.email,
      u.name as user_name,
      u.business_name,
      u.role,
      s.id as subscription_id,
      s.plan_id,
      s.status,
      s.trial_started_at,
      s.trial_ends_at,
      s.subscription_started_at,
      s.subscription_ends_at,
      s.trial_pdf_downloads,
      p.name as plan_name,
      p.price_inr
    FROM users u
    LEFT JOIN subscriptions s ON u.id = s.user_id
    LEFT JOIN plans p ON s.plan_id = p.id
    ORDER BY u.created_at DESC
  `).all() as any[];

  return rows.map((r) => {
    const evaluated = evaluateSubscriptionStatus({
      status: r.status || 'TRIALING',
      trialEndsAt: r.trial_ends_at || new Date().toISOString(),
      subscriptionEndsAt: r.subscription_ends_at,
    });
    return {
      ...r,
      effectiveStatus: evaluated.effectiveStatus,
      hasAccess: evaluated.hasAccess,
      daysRemaining: evaluated.daysRemaining,
      trialPdfDownloads: Number(r.trial_pdf_downloads ?? 0),
      maxTrialPdfDownloads: 2,
    };
  });
}

export function adminOverrideSubscription(
  userId: string,
  action: 'ACTIVATE' | 'CANCEL' | 'EXTEND_TRIAL' | 'EXPIRE',
  planId?: string
) {
  const db = getDatabase();
  const now = new Date();
  const nowISO = now.toISOString();

  if (action === 'ACTIVATE') {
    const targetPlan = planId ? getPlanById(planId) : getAllPlans()[0];
    const months = targetPlan ? targetPlan.durationMonths || 1 : 1;
    const end = addCalendarMonths(now, months).toISOString();

    db.prepare(`
      UPDATE subscriptions
      SET status = 'ACTIVE', plan_id = ?, subscription_started_at = ?, subscription_ends_at = ?, updated_at = ?
      WHERE user_id = ?
    `).run(targetPlan ? targetPlan.id : 'plan_1m', nowISO, end, nowISO, userId);
  } else if (action === 'CANCEL') {
    db.prepare(`
      UPDATE subscriptions
      SET status = 'CANCELLED', updated_at = ?
      WHERE user_id = ?
    `).run(nowISO, userId);
  } else if (action === 'EXPIRE') {
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      UPDATE subscriptions
      SET status = 'EXPIRED', trial_ends_at = ?, subscription_ends_at = ?, updated_at = ?
      WHERE user_id = ?
    `).run(pastDate, pastDate, nowISO, userId);
  } else if (action === 'EXTEND_TRIAL') {
    const newTrialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      UPDATE subscriptions
      SET status = 'TRIALING', trial_ends_at = ?, updated_at = ?
      WHERE user_id = ?
    `).run(newTrialEnd, nowISO, userId);
  }

  return getUserSubscription(userId);
}

// ------------------------------------------------------------------
// Manual Payment Settings & Requests API Helpers
// ------------------------------------------------------------------

export function getPaymentSettings(): PaymentSettings {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM payment_settings LIMIT 1').get() as any;
  if (!row) {
    return {
      id: 'default',
      upiId: '9539933265@naviaxis',
      qrCodeUrl: '',
      bankAccountName: 'Easyworks Solutions Private Limited',
      bankName: 'HDFC Bank',
      bankAccountNumber: '50200088991122',
      bankIfsc: 'HDFC0001234',
      bankBranch: 'Indiranagar Branch, Bengaluru',
      whatsappNumber: '919876543210',
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    id: row.id,
    upiId: row.upi_id,
    qrCodeUrl: row.qr_code_url,
    bankAccountName: row.bank_account_name,
    bankName: row.bank_name,
    bankAccountNumber: row.bank_account_number,
    bankIfsc: row.bank_ifsc,
    bankBranch: row.bank_branch,
    whatsappNumber: row.whatsapp_number,
    updatedAt: row.updated_at,
  };
}

export function updatePaymentSettings(settings: Partial<PaymentSettings>): PaymentSettings {
  const db = getDatabase();
  const current = getPaymentSettings();
  const updated: PaymentSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO payment_settings (
      id, upi_id, qr_code_url, bank_account_name, bank_name,
      bank_account_number, bank_ifsc, bank_branch, whatsapp_number, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      upi_id = excluded.upi_id,
      qr_code_url = excluded.qr_code_url,
      bank_account_name = excluded.bank_account_name,
      bank_name = excluded.bank_name,
      bank_account_number = excluded.bank_account_number,
      bank_ifsc = excluded.bank_ifsc,
      bank_branch = excluded.bank_branch,
      whatsapp_number = excluded.whatsapp_number,
      updated_at = excluded.updated_at
  `).run(
    updated.id || 'default',
    updated.upiId,
    updated.qrCodeUrl,
    updated.bankAccountName,
    updated.bankName,
    updated.bankAccountNumber,
    updated.bankIfsc,
    updated.bankBranch,
    updated.whatsappNumber,
    updated.updatedAt
  );

  return getPaymentSettings();
}

export function createManualPaymentRequest({
  userId,
  planId,
  utrNumber,
  screenshotUrl,
  notes,
}: {
  userId: string;
  planId: string;
  utrNumber: string;
  screenshotUrl?: string;
  notes?: string;
}): ManualPaymentRequest {
  const db = getDatabase();
  const plan = getPlanById(planId);
  if (!plan) throw new Error('Plan not found: ' + planId);

  const id = 'mpr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const nowISO = new Date().toISOString();

  // Insert manual payment request
  db.prepare(`
    INSERT INTO manual_payment_requests (
      id, user_id, plan_id, plan_name, amount_inr,
      utr_number, screenshot_url, notes, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
  `).run(
    id,
    userId,
    plan.id,
    plan.name,
    plan.priceINR,
    utrNumber.trim(),
    screenshotUrl || null,
    notes || null,
    nowISO,
    nowISO
  );

  // Set subscription to PAYMENT_PENDING with plan association
  db.prepare(`
    UPDATE subscriptions
    SET status = 'PAYMENT_PENDING', plan_id = ?, updated_at = ?
    WHERE user_id = ?
  `).run(plan.id, nowISO, userId);

  return {
    id,
    userId,
    planId: plan.id,
    planName: plan.name,
    amountINR: plan.priceINR,
    utrNumber: utrNumber.trim(),
    screenshotUrl,
    notes,
    status: 'PENDING',
    createdAt: nowISO,
    updatedAt: nowISO,
  };
}

export function getUserManualPayments(userId: string): ManualPaymentRequest[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM manual_payment_requests WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId) as any[];

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    planId: r.plan_id,
    planName: r.plan_name,
    amountINR: r.amount_inr,
    utrNumber: r.utr_number,
    screenshotUrl: r.screenshot_url || undefined,
    notes: r.notes || undefined,
    status: r.status,
    rejectionReason: r.rejection_reason || undefined,
    reviewedBy: r.reviewed_by || undefined,
    reviewedAt: r.reviewed_at || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function getAllManualPaymentRequests(filterStatus?: string): ManualPaymentRequest[] {
  const db = getDatabase();
  let query = `
    SELECT 
      m.*,
      u.name as user_name,
      u.email as user_email,
      u.business_name as user_business_name
    FROM manual_payment_requests m
    LEFT JOIN users u ON m.user_id = u.id
  `;
  const params: any[] = [];
  if (filterStatus && filterStatus !== 'ALL') {
    query += ' WHERE m.status = ?';
    params.push(filterStatus);
  }
  query += ' ORDER BY m.created_at DESC';

  const rows = db.prepare(query).all(...params) as any[];

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name || undefined,
    userEmail: r.user_email || undefined,
    businessName: r.user_business_name || undefined,
    planId: r.plan_id,
    planName: r.plan_name,
    amountINR: r.amount_inr,
    utrNumber: r.utr_number,
    screenshotUrl: r.screenshot_url || undefined,
    notes: r.notes || undefined,
    status: r.status,
    rejectionReason: r.rejection_reason || undefined,
    reviewedBy: r.reviewed_by || undefined,
    reviewedAt: r.reviewed_at || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function approveManualPayment(
  requestId: string,
  adminName: string = 'Admin'
): { success: boolean; subscription: Subscription; payment?: PaymentRecord } {
  const db = getDatabase();
  const req = db.prepare('SELECT * FROM manual_payment_requests WHERE id = ?').get(requestId) as any;
  if (!req) throw new Error('Payment request not found');
  if (req.status === 'APPROVED') {
    const existingPayment = db.prepare('SELECT * FROM payments WHERE gateway_payment_id = ?').get(req.utr_number) as any;
    return {
      success: true,
      subscription: getUserSubscription(req.user_id)!,
      payment: existingPayment || undefined,
    };
  }

  const nowISO = new Date().toISOString();

  return runInTransaction(() => {
    // 1. Activate subscription (sets status ACTIVE, assigns plan PDF download limits)
    const subscription = activateSubscription({
      userId: req.user_id,
      planId: req.plan_id,
      gatewaySubscriptionId: 'MANUAL_' + req.utr_number,
    });

    // 2. Record formal payment entry
    const payment = recordPayment({
      userId: req.user_id,
      subscriptionId: subscription.id,
      planId: req.plan_id,
      planName: req.plan_name,
      amountINR: req.amount_inr,
      currency: 'INR',
      status: 'SUCCESS',
      gateway: 'manual',
      gatewayPaymentId: req.utr_number,
      paymentMethod: 'UPI/Manual Bank Transfer',
    });

    // 3. Mark request APPROVED
    db.prepare(`
      UPDATE manual_payment_requests
      SET status = 'APPROVED', reviewed_by = ?, reviewed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(adminName, nowISO, nowISO, requestId);

    return { success: true, subscription, payment };
  });
}

export function rejectManualPayment(
  requestId: string,
  reason: string,
  adminName: string = 'Admin'
): { success: boolean } {
  const db = getDatabase();
  const req = db.prepare('SELECT * FROM manual_payment_requests WHERE id = ?').get(requestId) as any;
  if (!req) throw new Error('Payment request not found');

  const nowISO = new Date().toISOString();

  // Update request status
  db.prepare(`
    UPDATE manual_payment_requests
    SET status = 'REJECTED', rejection_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(reason, adminName, nowISO, nowISO, requestId);

  // Update subscription to PAYMENT_REJECTED
  db.prepare(`
    UPDATE subscriptions
    SET status = 'PAYMENT_REJECTED', updated_at = ?
    WHERE user_id = ?
  `).run(nowISO, req.user_id);

  return { success: true };
}

// ------------------------------------------------------------------
// Trial Identity, Abuse Prevention & Eligibility System
// ------------------------------------------------------------------

function mapTrialIdentityRow(row: any): TrialIdentity {
  return {
    id: row.id,
    userId: row.user_id,
    businessId: row.business_id ?? undefined,
    email: row.email,
    normalizedEmail: row.normalized_email,
    phone: row.phone ?? undefined,
    normalizedPhone: row.normalized_phone ?? undefined,
    emailVerified: Boolean(row.email_verified),
    phoneVerified: Boolean(row.phone_verified),
    businessName: row.business_name ?? undefined,
    normalizedBusinessName: row.normalized_business_name ?? undefined,
    businessDomain: row.business_domain ?? undefined,
    gstin: row.gstin ?? undefined,
    deviceId: row.device_id ?? undefined,
    ipAddress: row.ip_address ?? undefined,
    eligibilityStatus: row.eligibility_status as TrialEligibilityStatus,
    abuseRiskScore: Number(row.abuse_risk_score ?? 0),
    flagReason: row.flag_reason ?? undefined,
    trialStartedAt: row.trial_started_at ?? undefined,
    trialEndsAt: row.trial_ends_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getTrialIdentityByUserId(userId: string): TrialIdentity | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM trial_identities WHERE user_id = ?').get(userId);
  if (!row) return null;
  return mapTrialIdentityRow(row);
}

export function getTrialIdentityByEmail(email: string): TrialIdentity | null {
  const db = getDatabase();
  const normalized = normalizeEmail(email);
  const row = db.prepare('SELECT * FROM trial_identities WHERE normalized_email = ?').get(normalized);
  if (!row) return null;
  return mapTrialIdentityRow(row);
}

export function createOrUpdateTrialIdentity(data: {
  userId: string;
  email: string;
  businessId?: string;
  name?: string;
  businessName?: string;
  phone?: string;
  gstin?: string;
  deviceId?: string;
  ipAddress?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
}): TrialIdentity {
  const db = getDatabase();
  const nowISO = new Date().toISOString();

  const normalizedEmail = normalizeEmail(data.email);
  const normalizedPhone = data.phone ? normalizePhone(data.phone) : undefined;
  const normalizedBiz = data.businessName ? normalizeBusinessName(data.businessName) : undefined;
  const bizDomain = extractDomain(data.email);

  const existing = db.prepare('SELECT * FROM trial_identities WHERE user_id = ?').get(data.userId) as any;

  if (existing) {
    const emailVerified = data.emailVerified !== undefined ? (data.emailVerified ? 1 : 0) : existing.email_verified;
    const phoneVerified = data.phoneVerified !== undefined ? (data.phoneVerified ? 1 : 0) : existing.phone_verified;
    const phone = data.phone !== undefined ? data.phone : existing.phone;
    const normPhone = normalizedPhone !== undefined ? normalizedPhone : existing.normalized_phone;
    const bizName = data.businessName !== undefined ? data.businessName : existing.business_name;
    const normBiz = normalizedBiz !== undefined ? normalizedBiz : existing.normalized_business_name;
    const gstin = data.gstin !== undefined ? data.gstin : existing.gstin;
    const deviceId = data.deviceId !== undefined ? data.deviceId : existing.device_id;
    const ipAddress = data.ipAddress !== undefined ? data.ipAddress : existing.ip_address;

    db.prepare(`
      UPDATE trial_identities
      SET email = ?, normalized_email = ?, phone = ?, normalized_phone = ?,
          email_verified = ?, phone_verified = ?, business_name = ?,
          normalized_business_name = ?, business_domain = ?, gstin = ?,
          device_id = ?, ip_address = ?, updated_at = ?
      WHERE user_id = ?
    `).run(
      data.email,
      normalizedEmail,
      phone,
      normPhone,
      emailVerified,
      phoneVerified,
      bizName,
      normBiz,
      bizDomain,
      gstin,
      deviceId,
      ipAddress,
      nowISO,
      data.userId
    );
  } else {
    const id = 'tid_' + data.userId;
    const emailVerified = data.emailVerified ? 1 : 0;
    const phoneVerified = data.phoneVerified ? 1 : 0;

    db.prepare(`
      INSERT INTO trial_identities (
        id, user_id, business_id, email, normalized_email, phone, normalized_phone,
        email_verified, phone_verified, business_name, normalized_business_name,
        business_domain, gstin, device_id, ip_address, eligibility_status,
        abuse_risk_score, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUIRES_VERIFICATION', 0, ?, ?)
    `).run(
      id,
      data.userId,
      data.businessId || 'biz_' + data.userId,
      data.email,
      normalizedEmail,
      data.phone || null,
      normalizedPhone || null,
      emailVerified,
      phoneVerified,
      data.businessName || null,
      normalizedBiz || null,
      bizDomain || null,
      data.gstin || null,
      data.deviceId || null,
      data.ipAddress || null,
      nowISO,
      nowISO
    );
  }

  return getTrialIdentityByUserId(data.userId)!;
}

/**
 * Creates a secure 6-digit numeric verification code (10-minute expiry).
 */
export function createVerificationCode(
  target: string,
  channel: 'EMAIL' | 'SMS'
): { id: string; code: string; expiresAt: string } {
  const db = getDatabase();
  const normalizedTarget = channel === 'EMAIL' ? normalizeEmail(target) : normalizePhone(target);

  // Generate 6-digit numeric code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const id = 'vc_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const nowISO = now.toISOString();

  // Invalidate any older unverified codes for this target
  db.prepare(`
    DELETE FROM verification_codes WHERE target = ? AND verified_at IS NULL
  `).run(normalizedTarget);

  db.prepare(`
    INSERT INTO verification_codes (id, target, channel, code, expires_at, attempts, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(id, normalizedTarget, channel, code, expiresAt, nowISO);

  // Development/demo log
  console.log(`[Easyworks Auth] Verification OTP for ${normalizedTarget} (${channel}): ${code}`);

  return { id, code, expiresAt };
}

/**
 * Authoritatively verifies a 6-digit code against target.
 */
export function verifyVerificationCode(
  target: string,
  code: string
): { success: boolean; error?: string } {
  const db = getDatabase();
  const normalizedEmailTarget = normalizeEmail(target);
  const normalizedPhoneTarget = normalizePhone(target);

  const row = db.prepare(`
    SELECT * FROM verification_codes
    WHERE (target = ? OR target = ?) AND verified_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).get(normalizedEmailTarget, normalizedPhoneTarget) as any;

  if (!row) {
    return { success: false, error: 'No active verification code found. Please request a new code.' };
  }

  const now = new Date();
  if (new Date(row.expires_at).getTime() < now.getTime()) {
    return { success: false, error: 'Verification code has expired. Please request a new code.' };
  }

  if (row.attempts >= 5) {
    return { success: false, error: 'Too many incorrect attempts. Please request a new code.' };
  }

  if (row.code.trim() !== code.trim()) {
    db.prepare(`UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
    return { success: false, error: 'Invalid verification code. Please check and try again.' };
  }

  // Success
  db.prepare(`UPDATE verification_codes SET verified_at = ? WHERE id = ?`).run(now.toISOString(), row.id);
  return { success: true };
}

/**
 * Sliding window rate limiter for security-sensitive actions.
 */
export function checkRateLimit(
  key: string,
  maxCount: number,
  windowSeconds: number
): { allowed: boolean; remaining: number; resetInSeconds: number } {
  const db = getDatabase();
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const row = db.prepare('SELECT * FROM rate_limits WHERE key = ?').get(key) as any;

  if (row && now < row.window_start + windowMs) {
    if (row.count >= maxCount) {
      const resetInSeconds = Math.ceil((row.window_start + windowMs - now) / 1000);
      return { allowed: false, remaining: 0, resetInSeconds };
    } else {
      const newCount = row.count + 1;
      db.prepare('UPDATE rate_limits SET count = ? WHERE key = ?').run(newCount, key);
      const resetInSeconds = Math.ceil((row.window_start + windowMs - now) / 1000);
      return { allowed: true, remaining: maxCount - newCount, resetInSeconds };
    }
  } else {
    db.prepare(`
      INSERT INTO rate_limits (key, count, window_start)
      VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start
    `).run(key, now);
    return { allowed: true, remaining: maxCount - 1, resetInSeconds: windowSeconds };
  }
}

/**
 * Records device sessions for fraud analysis.
 */
export function recordDeviceSession(deviceId: string, ipAddress?: string, userId?: string): void {
  if (!deviceId) return;
  const db = getDatabase();
  const nowISO = new Date().toISOString();

  const existing = db.prepare('SELECT * FROM device_sessions WHERE device_id = ?').get(deviceId) as any;
  if (existing) {
    db.prepare(`
      UPDATE device_sessions
      SET ip_address = COALESCE(?, ip_address),
          user_id = COALESCE(?, user_id),
          last_seen = ?
      WHERE device_id = ?
    `).run(ipAddress || null, userId || null, nowISO, deviceId);
  } else {
    db.prepare(`
      INSERT INTO device_sessions (device_id, ip_address, user_id, first_seen, last_seen, trials_associated)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(deviceId, ipAddress || null, userId || null, nowISO, nowISO);
  }
}

/**
 * Authoritative Server-Side Trial Eligibility Engine.
 * Evaluates ELIGIBLE, REQUIRES_VERIFICATION, REVIEW_REQUIRED, NOT_ELIGIBLE.
 */
export function evaluateTrialEligibility(
  userId: string,
  context?: { deviceId?: string; ipAddress?: string }
): TrialEligibilityCheckResult {
  const db = getDatabase();
  const now = new Date();
  const nowISO = now.toISOString();

  // Load user
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    return {
      status: 'NOT_ELIGIBLE',
      isEligible: false,
      requiresEmailVerification: false,
      requiresPhoneVerification: false,
      riskScore: 100,
      message: 'User account not found.',
    };
  }

  // Load or create trial identity
  let identity = getTrialIdentityByUserId(userId);
  if (!identity) {
    identity = createOrUpdateTrialIdentity({
      userId,
      email: user.email,
      name: user.name,
      businessName: user.business_name,
      deviceId: context?.deviceId,
      ipAddress: context?.ipAddress,
    });
  } else if (context?.deviceId || context?.ipAddress) {
    identity = createOrUpdateTrialIdentity({
      userId,
      email: identity.email,
      deviceId: context?.deviceId || identity.deviceId,
      ipAddress: context?.ipAddress || identity.ipAddress,
    });
  }

  // If already marked NOT_ELIGIBLE (permanent block)
  if (identity.eligibilityStatus === 'NOT_ELIGIBLE') {
    return {
      status: 'NOT_ELIGIBLE',
      isEligible: false,
      requiresEmailVerification: false,
      requiresPhoneVerification: false,
      riskScore: identity.abuseRiskScore,
      message: identity.flagReason || 'This account or phone number is not eligible for a free trial.',
      flagReason: identity.flagReason,
      trialIdentity: identity,
    };
  }

  // If already ELIGIBLE and trial is currently active
  if (identity.eligibilityStatus === 'ELIGIBLE' && identity.trialEndsAt) {
    return {
      status: 'ELIGIBLE',
      isEligible: true,
      requiresEmailVerification: false,
      requiresPhoneVerification: false,
      riskScore: 0,
      message: '7-day free trial active.',
      trialIdentity: identity,
    };
  }

  // 1. Check Disposable Email
  if (isDisposableEmail(identity.email)) {
    db.prepare(`
      UPDATE trial_identities
      SET eligibility_status = 'NOT_ELIGIBLE', abuse_risk_score = 90,
          flag_reason = 'Disposable email addresses are not permitted', updated_at = ?
      WHERE user_id = ?
    `).run(nowISO, userId);

    return {
      status: 'NOT_ELIGIBLE',
      isEligible: false,
      requiresEmailVerification: true,
      requiresPhoneVerification: false,
      riskScore: 90,
      message: 'Disposable email addresses are not permitted for free trials. Please signup with a valid business or personal email.',
      flagReason: 'Disposable email domain detected',
    };
  }

  // 2. Check Email Verification
  if (!identity.emailVerified) {
    return {
      status: 'REQUIRES_VERIFICATION',
      isEligible: false,
      requiresEmailVerification: true,
      requiresPhoneVerification: !identity.phoneVerified,
      riskScore: 0,
      message: 'Please verify your work email address to proceed.',
      trialIdentity: identity,
    };
  }

  // 3. Check Phone Verification
  if (!identity.phoneVerified || !identity.normalizedPhone) {
    return {
      status: 'REQUIRES_VERIFICATION',
      isEligible: false,
      requiresEmailVerification: false,
      requiresPhoneVerification: true,
      riskScore: 0,
      message: 'Please verify your mobile phone number to activate your 7-day free trial.',
      trialIdentity: identity,
    };
  }

  // 4. Strict Duplicate Phone Check: Exactly ONE trial per phone number
  const existingPhoneTrial = db.prepare(`
    SELECT t.*, u.email as user_email FROM trial_identities t
    JOIN users u ON t.user_id = u.id
    WHERE t.normalized_phone = ? AND t.user_id != ?
      AND (t.trial_started_at IS NOT NULL OR t.eligibility_status IN ('ELIGIBLE', 'REVIEW_REQUIRED'))
  `).get(identity.normalizedPhone, userId) as any;

  if (existingPhoneTrial) {
    const flagReason = `Phone number ${identity.normalizedPhone} was already used for a free trial under account (${existingPhoneTrial.user_email}).`;

    db.prepare(`
      UPDATE trial_identities
      SET eligibility_status = 'NOT_ELIGIBLE', abuse_risk_score = 100,
          flag_reason = ?, updated_at = ?
      WHERE user_id = ?
    `).run(flagReason, nowISO, userId);

    db.prepare(`
      UPDATE subscriptions
      SET status = 'EXPIRED', updated_at = ?
      WHERE user_id = ?
    `).run(nowISO, userId);

    return {
      status: 'NOT_ELIGIBLE',
      isEligible: false,
      requiresEmailVerification: false,
      requiresPhoneVerification: false,
      riskScore: 100,
      message: 'This phone number has already been used to claim a 7-day free trial. Please select a subscription plan to continue.',
      flagReason,
      trialIdentity: getTrialIdentityByUserId(userId)!,
    };
  }

  // Calculate Risk Signals
  let riskScore = 0;
  const reasons: string[] = [];

  // 5. Business Name & Domain Cross-Checks
  if (identity.normalizedBusinessName && identity.normalizedBusinessName.length >= 4) {
    const existingBiz = db.prepare(`
      SELECT t.* FROM trial_identities t
      WHERE t.normalized_business_name = ? AND t.user_id != ?
        AND t.trial_started_at IS NOT NULL
    `).get(identity.normalizedBusinessName, userId) as any;

    if (existingBiz) {
      riskScore += 40;
      reasons.push(`Business name closely matches an existing registered trial (${existingBiz.business_name})`);
    }
  }

  // 6. GSTIN Cross-Check
  if (identity.gstin && identity.gstin.trim()) {
    const existingGstin = db.prepare(`
      SELECT t.* FROM trial_identities t
      WHERE t.gstin = ? AND t.user_id != ?
        AND t.trial_started_at IS NOT NULL
    `).get(identity.gstin.trim().toUpperCase(), userId) as any;

    if (existingGstin) {
      riskScore += 50;
      reasons.push(`GSTIN tax identifier already registered on another trial`);
    }
  }

  // 7. Device Abuse Signal
  if (context?.deviceId) {
    recordDeviceSession(context.deviceId, context.ipAddress, userId);
    const deviceTrials = db.prepare(`
      SELECT COUNT(*) as count FROM trial_identities
      WHERE device_id = ? AND user_id != ? AND trial_started_at IS NOT NULL
    `).get(context.deviceId, userId) as { count: number };

    if (deviceTrials && deviceTrials.count >= 2) {
      riskScore += 30;
      reasons.push(`Multiple trial accounts detected from this browser/device`);
    }
  }

  // 8. IP Burst Rate Signal (Never blocks on IP alone, but contributes to review flag)
  if (context?.ipAddress && context.ipAddress !== '127.0.0.1' && context.ipAddress !== '::1') {
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const ipBursts = db.prepare(`
      SELECT COUNT(*) as count FROM trial_identities
      WHERE ip_address = ? AND user_id != ? AND created_at > ?
    `).get(context.ipAddress, userId, sixHoursAgo) as { count: number };

    if (ipBursts && ipBursts.count >= 3) {
      riskScore += 25;
      reasons.push(`High registration velocity from IP address cluster in last 6 hours`);
    }
  }

  // Decision Threshold: >= 50 requires Admin Review
  if (riskScore >= 50) {
    const flagReason = reasons.join('; ');
    db.prepare(`
      UPDATE trial_identities
      SET eligibility_status = 'REVIEW_REQUIRED', abuse_risk_score = ?,
          flag_reason = ?, updated_at = ?
      WHERE user_id = ?
    `).run(riskScore, flagReason, nowISO, userId);

    return {
      status: 'REVIEW_REQUIRED',
      isEligible: false,
      requiresEmailVerification: false,
      requiresPhoneVerification: false,
      riskScore,
      message: 'Your registration is under security review. Our team will verify and activate your trial shortly.',
      flagReason,
      trialIdentity: getTrialIdentityByUserId(userId)!,
    };
  }

  // Fully ELIGIBLE -> Activate 7-Day Free Trial
  const trialStart = nowISO;
  const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    UPDATE trial_identities
    SET eligibility_status = 'ELIGIBLE', abuse_risk_score = ?, flag_reason = NULL,
        trial_started_at = ?, trial_ends_at = ?, updated_at = ?
    WHERE user_id = ?
  `).run(riskScore, trialStart, trialEnd, nowISO, userId);

  db.prepare(`
    UPDATE subscriptions
    SET status = 'TRIALING', trial_started_at = ?, trial_ends_at = ?,
        trial_pdf_downloads = 0, updated_at = ?
    WHERE user_id = ?
  `).run(trialStart, trialEnd, nowISO, userId);

  return {
    status: 'ELIGIBLE',
    isEligible: true,
    requiresEmailVerification: false,
    requiresPhoneVerification: false,
    riskScore: 0,
    message: '7-day free trial activated successfully! You have 2 PDF downloads included.',
    trialIdentity: getTrialIdentityByUserId(userId)!,
  };
}

/**
 * Admin override: Approves a flagged trial and activates 7-day trial.
 */
export function adminApproveTrial(
  userId: string,
  adminNotes: string = 'Approved by administrator'
): { success: boolean; subscription: Subscription } {
  const db = getDatabase();
  const now = new Date();
  const nowISO = now.toISOString();
  const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    UPDATE trial_identities
    SET eligibility_status = 'ELIGIBLE', abuse_risk_score = 0,
        flag_reason = ?, trial_started_at = ?, trial_ends_at = ?, updated_at = ?
    WHERE user_id = ?
  `).run(`Admin Override: ${adminNotes}`, nowISO, trialEnd, nowISO, userId);

  db.prepare(`
    UPDATE subscriptions
    SET status = 'TRIALING', trial_started_at = ?, trial_ends_at = ?,
        trial_pdf_downloads = 0, updated_at = ?
    WHERE user_id = ?
  `).run(nowISO, trialEnd, nowISO, userId);

  return { success: true, subscription: getUserSubscription(userId)! };
}

/**
 * Admin override: Rejects an abusive trial attempt.
 */
export function adminRejectTrial(
  userId: string,
  reason: string = 'Rejected by administrator for free-trial abuse'
): { success: boolean } {
  const db = getDatabase();
  const nowISO = new Date().toISOString();

  db.prepare(`
    UPDATE trial_identities
    SET eligibility_status = 'NOT_ELIGIBLE',
        flag_reason = ?, updated_at = ?
    WHERE user_id = ?
  `).run(`Admin Rejection: ${reason}`, nowISO, userId);

  db.prepare(`
    UPDATE subscriptions
    SET status = 'EXPIRED', updated_at = ?
    WHERE user_id = ?
  `).run(nowISO, userId);

  return { success: true };
}

/**
 * Admin: List all trial identities with status and risk flags.
 */
export function getAllTrialIdentities(): any[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT t.*, u.name as user_name, u.role as user_role,
           COALESCE(s.trial_pdf_downloads, 0) as trial_pdf_downloads
    FROM trial_identities t
    JOIN users u ON t.user_id = u.id
    LEFT JOIN subscriptions s ON t.user_id = s.user_id
    ORDER BY t.created_at DESC
  `).all();
}

// ------------------------------------------------------------------
// Developer & Super Admin SaaS Management Helpers
// ------------------------------------------------------------------

export function logActivity(
  userId: string | undefined,
  action: string,
  details: string,
  actor: 'SYSTEM' | 'USER' | 'SUPER_ADMIN' = 'SYSTEM'
) {
  try {
    const db = getDatabase();
    const id = 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    db.prepare(`
      INSERT INTO activity_logs (id, user_id, action, details, actor, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId || null, action, details, actor, new Date().toISOString());
  } catch (e) {
    console.error('Error logging activity:', e);
  }
}

export function getActivityLogs(limit = 30): ActivityLog[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?
  `).all(limit) as any[];

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id || undefined,
    action: r.action,
    details: r.details,
    actor: r.actor,
    createdAt: r.created_at,
  }));
}

export function verifyDeveloperCredentials(email: string, password: string): {
  success: boolean;
  error?: string;
  user?: { id: string; email: string; name: string; role: string; phone?: string };
  token?: string;
} {
  const db = getDatabase();
  const cleanEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as any;

  if (!user) {
    return { success: false, error: 'Invalid developer credentials.' };
  }

  if (user.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized. Developer / Super Admin access only.' };
  }

  if (user.status === 'SUSPENDED') {
    return { success: false, error: 'Account is suspended. Contact system administrator.' };
  }

  if (!user.password_hash || !user.password_salt) {
    return { success: false, error: 'Password not configured for this account.' };
  }

  const isValid = verifyPassword(password, user.password_hash, user.password_salt);
  if (!isValid) {
    return { success: false, error: 'Invalid developer credentials.' };
  }

  // Create signed session token
  const timestamp = Date.now();
  const secret = process.env.DEVELOPER_SESSION_SECRET || 'easyworks_super_admin_sec_2026';
  const sig = crypto.createHmac('sha256', secret).update(`${user.id}:${user.email}:${timestamp}`).digest('hex');
  const token = Buffer.from(`${user.id}:${user.email}:${timestamp}:${sig}`).toString('base64');

  logActivity(user.id, 'DEVELOPER_LOGIN', 'Super Admin logged into Developer Panel', 'SUPER_ADMIN');

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
    },
    token,
  };
}

export function verifyDeveloperSessionToken(token: string): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId, email, timestampStr, sig] = decoded.split(':');
    const timestamp = parseInt(timestampStr, 10);
    // Token valid for 7 days
    if (Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) return false;

    const secret = process.env.DEVELOPER_SESSION_SECRET || 'easyworks_super_admin_sec_2026';
    const expectedSig = crypto.createHmac('sha256', secret).update(`${userId}:${email}:${timestamp}`).digest('hex');
    if (sig !== expectedSig) return false;

    const db = getDatabase();
    const user = db.prepare('SELECT role, status FROM users WHERE id = ?').get(userId) as any;
    return user && user.role === 'SUPER_ADMIN' && user.status === 'ACTIVE';
  } catch {
    return false;
  }
}

export function updateDeveloperPassword(newPassword: string): boolean {
  const db = getDatabase();
  const adminEmail = 'muhammedhazilav@gmail.com';
  const { hash, salt } = hashPassword(newPassword);
  db.prepare(`
    UPDATE users SET password_hash = ?, password_salt = ? WHERE email = ?
  `).run(hash, salt, adminEmail);
  logActivity('usr_super_admin_hazil', 'PASSWORD_CHANGED', 'Super Admin updated password', 'SUPER_ADMIN');
  return true;
}

export function getDeveloperStats(): DeveloperStats {
  const db = getDatabase();
  const now = new Date();
  const nowISO = now.toISOString();

  // Total customers (exclude super admin)
  const totalCustRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role != 'SUPER_ADMIN'").get() as any;
  const totalCustomers = totalCustRow ? totalCustRow.count : 0;

  // Subscriptions breakdown
  const subs = db.prepare(`
    SELECT s.*, u.role FROM subscriptions s
    JOIN users u ON s.user_id = u.id
    WHERE u.role != 'SUPER_ADMIN'
  `).all() as any[];

  let activeSubscriptions = 0;
  let trialCustomers = 0;
  let expiredCustomers = 0;
  let totalPdfs = 0;
  let customersAtLimit = 0;
  let customersNearLimit = 0;
  let trialPdfsUsed = 0;

  subs.forEach((s) => {
    const used = Number(s.pdf_downloads_used ?? s.trial_pdf_downloads ?? 0);
    const limit = Number(s.pdf_download_limit ?? 2);
    totalPdfs += used;
    trialPdfsUsed += (s.trial_pdf_downloads || 0);

    if (limit > 0) {
      if (used >= limit) {
        customersAtLimit++;
      } else if (used / limit >= 0.8) {
        customersNearLimit++;
      }
    }

    const evaluated = evaluateSubscriptionStatus({
      status: s.status,
      trialEndsAt: s.trial_ends_at,
      subscriptionEndsAt: s.subscription_ends_at,
    });
    if (evaluated.effectiveStatus === 'ACTIVE') activeSubscriptions++;
    else if (evaluated.effectiveStatus === 'TRIALING') trialCustomers++;
    else if (evaluated.effectiveStatus === 'EXPIRED') expiredCustomers++;
  });

  // PDF usage from pdf_usage_logs table
  const todayPrefix = nowISO.split('T')[0];
  const monthPrefix = todayPrefix.substring(0, 7);

  const pdfCountRow = db.prepare('SELECT COUNT(*) as count FROM pdf_usage_logs').get() as any;
  const pdfTodayRow = db.prepare('SELECT COUNT(*) as count FROM pdf_usage_logs WHERE created_at LIKE ?').get(`${todayPrefix}%`) as any;
  const pdfMonthRow = db.prepare('SELECT COUNT(*) as count FROM pdf_usage_logs WHERE created_at LIKE ?').get(`${monthPrefix}%`) as any;

  const pdfsGenerated = Math.max(pdfCountRow?.count || 0, totalPdfs);
  const pdfsGeneratedToday = pdfTodayRow?.count || 0;
  const pdfsGeneratedThisMonth = pdfMonthRow?.count || 0;

  // Manual payment requests
  const pendingMprRow = db.prepare("SELECT COUNT(*) as count FROM manual_payment_requests WHERE status = 'PENDING'").get() as any;
  const paymentPending = pendingMprRow ? pendingMprRow.count : 0;

  const verifiedMprRow = db.prepare("SELECT COUNT(*) as count FROM manual_payment_requests WHERE status = 'APPROVED'").get() as any;
  const paymentVerified = verifiedMprRow ? verifiedMprRow.count : 0;

  // Total Revenue from payments
  const revenueRow = db.prepare("SELECT SUM(amount_inr) as sum FROM payments WHERE status = 'SUCCESS'").get() as any;
  const totalRevenueINR = revenueRow && revenueRow.sum ? Number(revenueRow.sum) : 0;

  // Active today (users created or with activity today)
  const activeTodayRow = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as count FROM activity_logs WHERE created_at LIKE ?
  `).get(`${todayPrefix}%`) as any;
  const activeToday = Math.max(activeTodayRow ? activeTodayRow.count : 0, 1);

  // New customers in last 7 days
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const newCustRow = db.prepare(`
    SELECT COUNT(*) as count FROM users WHERE role != 'SUPER_ADMIN' AND created_at >= ?
  `).get(sevenDaysAgo) as any;
  const newCustomers = newCustRow ? newCustRow.count : 0;

  // Recent payments
  const recentPayments = getAllManualPaymentRequests().slice(0, 10);

  // Recent activity
  const recentActivity = getActivityLogs(15);

  return {
    totalCustomers,
    activeSubscriptions,
    trialCustomers,
    expiredCustomers,
    paymentPending,
    paymentVerified,
    totalRevenueINR,
    pdfsGenerated,
    pdfsGeneratedToday,
    pdfsGeneratedThisMonth,
    customersAtLimit,
    customersNearLimit,
    trialPdfsUsed,
    activeToday,
    newCustomers,
    recentPayments,
    recentActivity,
  };
}

export function getAllCustomersWithDetails(filter?: string, search?: string): DeveloperCustomerSummary[] {
  const db = getDatabase();

  let query = `
    SELECT u.id, u.email, u.name, u.business_name, u.phone, u.role,
           COALESCE(u.status, 'ACTIVE') as status, u.created_at,
           s.id as sub_id, s.plan_id, s.status as sub_status,
           s.trial_started_at, s.trial_ends_at, s.subscription_started_at, s.subscription_ends_at,
           s.pdf_download_limit,
           COALESCE(s.pdf_downloads_used, s.trial_pdf_downloads, 0) as pdf_downloads_used,
           COALESCE(s.trial_pdf_downloads, 0) as trial_pdf_downloads,
           p.name as plan_name, p.pdf_download_limit as plan_pdf_download_limit,
           t.abuse_risk_score, t.eligibility_status,
           (SELECT COUNT(*) FROM quotations q WHERE q.user_id = u.id) as quotes_count,
           (SELECT COUNT(*) FROM invoices i WHERE i.user_id = u.id) as invoices_count,
           (SELECT COALESCE(SUM(pm.amount_inr), 0) FROM payments pm WHERE pm.user_id = u.id AND pm.status = 'SUCCESS') as total_paid
    FROM users u
    LEFT JOIN subscriptions s ON u.id = s.user_id
    LEFT JOIN plans p ON s.plan_id = p.id
    LEFT JOIN trial_identities t ON u.id = t.user_id
    WHERE u.role != 'SUPER_ADMIN'
    ORDER BY u.created_at DESC
  `;

  const rows = db.prepare(query).all() as any[];

  let result: DeveloperCustomerSummary[] = rows.map((r) => {
    const isSuspended = r.status === 'SUSPENDED' || r.sub_status === 'SUSPENDED';
    const evaluated = r.sub_status ? evaluateSubscriptionStatus({
      status: isSuspended ? 'SUSPENDED' : r.sub_status,
      trialEndsAt: r.trial_ends_at,
      subscriptionEndsAt: r.subscription_ends_at,
    }) : { effectiveStatus: 'EXPIRED' as SubscriptionStatus };

    const effectiveSubStatus = isSuspended ? 'SUSPENDED' : evaluated.effectiveStatus;
    const isSubscribed = effectiveSubStatus === 'ACTIVE';
    const planLimit = isSubscribed
      ? (r.plan_pdf_download_limit || (r.plan_id === 'plan_1m' ? 30 : r.plan_id === 'plan_3m' ? 90 : r.plan_id === 'plan_6m' ? 180 : 30))
      : 2;
    const pdfDownloadLimit = Number(r.pdf_download_limit ?? planLimit);
    const pdfDownloadsUsed = Number(r.pdf_downloads_used ?? r.trial_pdf_downloads ?? 0);
    const pdfDownloadsRemaining = Math.max(0, pdfDownloadLimit - pdfDownloadsUsed);

    return {
      id: r.id,
      email: r.email,
      name: r.name,
      businessName: r.business_name || '',
      phone: r.phone || undefined,
      role: r.role,
      status: isSuspended ? 'SUSPENDED' : 'ACTIVE',
      createdAt: r.created_at,
      subscription: r.sub_id ? {
        id: r.sub_id,
        planId: r.plan_id || 'plan_1m',
        planName: r.plan_name || 'Standard Plan',
        status: effectiveSubStatus,
        trialStartedAt: r.trial_started_at,
        trialEndsAt: r.trial_ends_at,
        subscriptionStartedAt: r.subscription_started_at,
        subscriptionEndsAt: r.subscription_ends_at,
        pdfDownloadLimit,
        pdfDownloadsUsed,
        pdfDownloadsRemaining,
        trialPdfDownloads: pdfDownloadsUsed,
      } : undefined,
      quotationsCount: r.quotes_count || 0,
      invoicesCount: r.invoices_count || 0,
      totalPaymentsINR: r.total_paid || 0,
      abuseRiskScore: r.abuse_risk_score || 0,
      eligibilityStatus: r.eligibility_status,
    };
  });

  // Apply search filter
  if (search && search.trim()) {
    const s = search.toLowerCase().trim();
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        c.businessName.toLowerCase().includes(s) ||
        (c.phone && c.phone.includes(s))
    );
  }

  // Apply status filter
  if (filter && filter !== 'all') {
    if (filter === 'active') {
      result = result.filter((c) => c.subscription?.status === 'ACTIVE' && c.status === 'ACTIVE');
    } else if (filter === 'trialing' || filter === 'trial') {
      result = result.filter((c) => c.subscription?.status === 'TRIALING' && c.status === 'ACTIVE');
    } else if (filter === 'expired') {
      result = result.filter((c) => c.subscription?.status === 'EXPIRED');
    } else if (filter === 'suspended') {
      result = result.filter((c) => c.status === 'SUSPENDED');
    } else if (filter === 'near_limit') {
      result = result.filter((c) =>
        Boolean(
          c.subscription &&
          c.subscription.pdfDownloadLimit > 0 &&
          c.subscription.pdfDownloadsRemaining > 0 &&
          (c.subscription.pdfDownloadsUsed / c.subscription.pdfDownloadLimit) >= 0.8
        )
      );
    } else if (filter === 'limit_reached') {
      result = result.filter((c) =>
        Boolean(
          c.subscription &&
          c.subscription.pdfDownloadLimit > 0 &&
          c.subscription.pdfDownloadsUsed >= c.subscription.pdfDownloadLimit
        )
      );
    } else if (filter === 'payment_pending') {
      const pendingUserIds = new Set(
        (db.prepare("SELECT user_id FROM manual_payment_requests WHERE status = 'PENDING'").all() as any[]).map(
          (m) => m.user_id
        )
      );
      result = result.filter((c) => pendingUserIds.has(c.id));
    }
  }

  return result;
}

export function getCustomerFullDetails(userId: string): any {
  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) return null;

  const business = db.prepare('SELECT * FROM businesses WHERE user_id = ?').get(userId);
  const subscription = getUserSubscription(userId);
  const quotations = db.prepare('SELECT * FROM quotations WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  const invoices = db.prepare('SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  const payments = db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  const manualPayments = db.prepare('SELECT * FROM manual_payment_requests WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  const trialIdentity = db.prepare('SELECT * FROM trial_identities WHERE user_id = ?').get(userId);
  const activity = db.prepare('SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(userId);
  const pdfUsageHistory = getCustomerPdfUsageHistory(userId);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      businessName: user.business_name,
      phone: user.phone,
      role: user.role,
      status: user.status || 'ACTIVE',
      createdAt: user.created_at,
    },
    business,
    subscription,
    quotations,
    invoices,
    payments,
    manualPayments,
    trialIdentity,
    activity,
    pdfUsageHistory,
  };
}

export function updateCustomerStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED', reason?: string): boolean {
  const db = getDatabase();
  const nowISO = new Date().toISOString();
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId);

  if (status === 'SUSPENDED') {
    db.prepare("UPDATE subscriptions SET status = 'SUSPENDED', updated_at = ? WHERE user_id = ?").run(nowISO, userId);
    db.prepare("UPDATE trial_identities SET eligibility_status = 'NOT_ELIGIBLE', flag_reason = ?, updated_at = ? WHERE user_id = ?").run(
      reason ? `Account suspended: ${reason}` : 'Account suspended by administrator',
      nowISO,
      userId
    );
  } else {
    // Reactivate: compute whether subscription or trial is active
    const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) as any;
    let newStatus = 'EXPIRED';
    const now = Date.now();
    if (sub?.subscription_ends_at && new Date(sub.subscription_ends_at).getTime() > now) {
      newStatus = 'ACTIVE';
    } else if (sub?.trial_ends_at && new Date(sub.trial_ends_at).getTime() > now) {
      newStatus = 'TRIALING';
    }
    db.prepare('UPDATE subscriptions SET status = ?, updated_at = ? WHERE user_id = ?').run(newStatus, nowISO, userId);
    db.prepare("UPDATE trial_identities SET eligibility_status = 'ELIGIBLE', flag_reason = NULL, updated_at = ? WHERE user_id = ?").run(nowISO, userId);
  }

  logActivity(
    userId,
    status === 'SUSPENDED' ? 'CUSTOMER_SUSPENDED' : 'CUSTOMER_REACTIVATED',
    `Customer status changed to ${status}. ${reason ? 'Reason: ' + reason : ''}`,
    'SUPER_ADMIN'
  );
  return true;
}

export function extendCustomerSubscription(userId: string, daysOrDate: number | string): Subscription | null {
  const db = getDatabase();
  const currentSub = getUserSubscription(userId);
  if (!currentSub) return null;

  let newEnd: Date;
  if (typeof daysOrDate === 'number') {
    const baseDate = currentSub.subscriptionEndsAt
      ? new Date(Math.max(new Date(currentSub.subscriptionEndsAt).getTime(), Date.now()))
      : new Date();
    newEnd = new Date(baseDate.getTime() + daysOrDate * 24 * 60 * 60 * 1000);
  } else {
    newEnd = new Date(daysOrDate);
  }

  const newEndISO = newEnd.toISOString();
  const nowISO = new Date().toISOString();

  db.prepare(`
    UPDATE subscriptions
    SET status = 'ACTIVE',
        subscription_started_at = COALESCE(subscription_started_at, ?),
        subscription_ends_at = ?,
        updated_at = ?
    WHERE user_id = ?
  `).run(nowISO, newEndISO, nowISO, userId);

  logActivity(
    userId,
    'SUBSCRIPTION_EXTENDED',
    `Subscription extended until ${newEndISO.split('T')[0]} by Super Admin`,
    'SUPER_ADMIN'
  );

  return getUserSubscription(userId);
}

export function changeCustomerPlan(userId: string, newPlanId: string): Subscription | null {
  const db = getDatabase();
  const plan = getPlanById(newPlanId);
  if (!plan) return null;

  const nowISO = new Date().toISOString();
  const planPdfLimit = plan.pdfDownloadLimit || (plan.id === 'plan_1m' ? 20 : plan.id === 'plan_3m' ? 60 : plan.id === 'plan_6m' ? 120 : 20);

  runInTransaction(() => {
    db.prepare(`
      UPDATE subscriptions
      SET plan_id = ?, pdf_download_limit = ?, pdf_downloads_used = 0, trial_pdf_downloads = 0, updated_at = ?
      WHERE user_id = ?
    `).run(newPlanId, planPdfLimit, nowISO, userId);
  });

  logActivity(userId, 'PLAN_CHANGED', `Plan changed to ${plan.name} (${planPdfLimit} PDF limit granted) by Super Admin`, 'SUPER_ADMIN');
  return getUserSubscription(userId);
}

export function cancelCustomerSubscription(userId: string, reason?: string): Subscription | null {
  const db = getDatabase();
  const nowISO = new Date().toISOString();
  db.prepare(`
    UPDATE subscriptions SET status = 'CANCELLED', updated_at = ? WHERE user_id = ?
  `).run(nowISO, userId);

  logActivity(
    userId,
    'SUBSCRIPTION_CANCELLED',
    `Subscription cancelled by Super Admin. ${reason ? 'Reason: ' + reason : ''}`,
    'SUPER_ADMIN'
  );

  return getUserSubscription(userId);
}

export function manuallyActivateSubscription(
  userId: string,
  planId: string,
  durationMonths?: number
): Subscription | null {
  const db = getDatabase();
  const plan = getPlanById(planId) || getAllPlans()[0];
  const months = durationMonths ?? (plan?.durationMonths || 1);

  const now = new Date();
  const nowISO = now.toISOString();
  const end = addCalendarMonths(now, months);
  const endISO = end.toISOString();
  const planPdfLimit = plan.pdfDownloadLimit || (plan.id === 'plan_1m' ? 20 : plan.id === 'plan_3m' ? 60 : plan.id === 'plan_6m' ? 120 : 20);

  // Record a payment entry
  const paymentId = 'pay_manual_' + Date.now();
  const receiptNum = 'REC-MANUAL-' + Date.now().toString().slice(-6);

  runInTransaction(() => {
    db.prepare(`
      UPDATE subscriptions
      SET plan_id = ?,
          status = 'ACTIVE',
          subscription_started_at = ?,
          subscription_ends_at = ?,
          pdf_download_limit = ?,
          pdf_downloads_used = 0,
          trial_pdf_downloads = 0,
          updated_at = ?
      WHERE user_id = ?
    `).run(plan.id, nowISO, endISO, planPdfLimit, nowISO, userId);

    db.prepare(`
      INSERT INTO payments (
        id, user_id, subscription_id, plan_id, plan_name,
        amount_inr, currency, status, gateway, payment_method, receipt_number, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      paymentId,
      userId,
      'sub_' + userId,
      plan.id,
      plan.name,
      plan.priceINR,
      'INR',
      'SUCCESS',
      'manual',
      'Admin Direct Activation',
      receiptNum,
      nowISO
    );
  });

  logActivity(
    userId,
    'SUBSCRIPTION_MANUALLY_ACTIVATED',
    `Activated ${plan.name} (${months} months, ${planPdfLimit} PDFs) directly by Super Admin. Receipt: ${receiptNum}`,
    'SUPER_ADMIN'
  );

  return getUserSubscription(userId);
}

export function adjustCustomerPdfLimit(userId: string, newLimit: number): Subscription | null {
  const db = getDatabase();
  const currentSub = getUserSubscription(userId);
  if (!currentSub) return null;

  const limitNum = Math.max(0, Number(newLimit) || 0);
  const nowISO = new Date().toISOString();

  runInTransaction(() => {
    db.prepare(`
      UPDATE subscriptions
      SET pdf_download_limit = ?, updated_at = ?
      WHERE user_id = ?
    `).run(limitNum, nowISO, userId);
  });

  logActivity(
    userId,
    'PDF_LIMIT_ADJUSTED',
    `PDF download limit adjusted to ${limitNum} (previous: ${currentSub.pdfDownloadLimit}) by Super Admin`,
    'SUPER_ADMIN'
  );

  return getUserSubscription(userId);
}

export function addBonusPdfDownloads(userId: string, bonus: number): Subscription | null {
  const db = getDatabase();
  const currentSub = getUserSubscription(userId);
  if (!currentSub) return null;

  const bonusNum = Math.max(1, Number(bonus) || 1);
  const newLimit = (currentSub.pdfDownloadLimit || 0) + bonusNum;
  const nowISO = new Date().toISOString();

  runInTransaction(() => {
    db.prepare(`
      UPDATE subscriptions
      SET pdf_download_limit = ?, updated_at = ?
      WHERE user_id = ?
    `).run(newLimit, nowISO, userId);
  });

  logActivity(
    userId,
    'BONUS_PDFS_ADDED',
    `Added +${bonusNum} bonus PDF downloads (new limit: ${newLimit}) by Super Admin`,
    'SUPER_ADMIN'
  );

  return getUserSubscription(userId);
}

export function resetCustomerPdfUsage(userId: string): Subscription | null {
  const db = getDatabase();
  const currentSub = getUserSubscription(userId);
  if (!currentSub) return null;

  const nowISO = new Date().toISOString();

  runInTransaction(() => {
    db.prepare(`
      UPDATE subscriptions
      SET pdf_downloads_used = 0, trial_pdf_downloads = 0, updated_at = ?
      WHERE user_id = ?
    `).run(nowISO, userId);
  });

  logActivity(
    userId,
    'PDF_USAGE_RESET',
    `Reset PDF downloads used counter from ${currentSub.pdfDownloadsUsed} to 0 by Super Admin`,
    'SUPER_ADMIN'
  );

  return getUserSubscription(userId);
}

export function removeCustomerPdfCredits(userId: string, amount: number): Subscription | null {
  const db = getDatabase();
  const currentSub = getUserSubscription(userId);
  if (!currentSub) return null;

  const removeNum = Math.max(1, Number(amount) || 1);
  const newLimit = Math.max(currentSub.pdfDownloadsUsed, (currentSub.pdfDownloadLimit || 0) - removeNum);
  const actualRemoved = (currentSub.pdfDownloadLimit || 0) - newLimit;
  const nowISO = new Date().toISOString();

  runInTransaction(() => {
    db.prepare(`
      UPDATE subscriptions
      SET pdf_download_limit = ?, updated_at = ?
      WHERE user_id = ?
    `).run(newLimit, nowISO, userId);
  });

  logActivity(
    userId,
    'PDF_CREDITS_REMOVED',
    `Developer removed ${actualRemoved} PDF credits (new limit: ${newLimit}, used: ${currentSub.pdfDownloadsUsed})`,
    'SUPER_ADMIN'
  );

  return getUserSubscription(userId);
}

export function getCustomerPdfUsageHistory(userId: string): any[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM pdf_usage_logs
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId) as any[];

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    user_id: r.user_id,
    businessName: r.business_name,
    business_name: r.business_name,
    documentId: r.document_id,
    document_id: r.document_id,
    documentType: r.document_type,
    document_type: r.document_type,
    documentNumber: r.document_number,
    document_number: r.document_number,
    subscriptionId: r.subscription_id,
    subscription_id: r.subscription_id,
    ipAddress: r.ip_address,
    ip_address: r.ip_address,
    userAgent: r.user_agent,
    user_agent: r.user_agent,
    createdAt: r.created_at,
    created_at: r.created_at,
  }));
}

export function getAllPdfUsageHistory(limit = 100): any[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM pdf_usage_logs
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as any[];

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    user_id: r.user_id,
    businessName: r.business_name,
    business_name: r.business_name,
    documentId: r.document_id,
    document_id: r.document_id,
    documentType: r.document_type,
    document_type: r.document_type,
    documentNumber: r.document_number,
    document_number: r.document_number,
    subscriptionId: r.subscription_id,
    subscription_id: r.subscription_id,
    ipAddress: r.ip_address,
    ip_address: r.ip_address,
    userAgent: r.user_agent,
    user_agent: r.user_agent,
    createdAt: r.created_at,
    created_at: r.created_at,
  }));
}

export function resetCustomerAccess(userId: string): { success: boolean; message: string } {
  const db = getDatabase();
  // Clear any rate limits and verification code locks
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as any;
  if (user) {
    db.prepare('DELETE FROM verification_codes WHERE target = ?').run(user.email);
    db.prepare('DELETE FROM rate_limits WHERE key LIKE ?').run(`%${user.email}%`);
  }
  logActivity(userId, 'ACCESS_RESET', 'Customer verification codes & rate limits reset by Super Admin', 'SUPER_ADMIN');
  return { success: true, message: 'Customer access credentials & verification limits have been reset.' };
}

// ------------------------------------------------------------------
// Documents Sync & Storage Helpers
// ------------------------------------------------------------------

export function saveCustomerDocument(
  userId: string,
  type: 'quotation' | 'invoice',
  doc: any
): boolean {
  const db = getDatabase();
  const nowISO = new Date().toISOString();
  const customerName = doc.customer?.name || doc.customerName || 'Direct Client';
  const grandTotal = doc.totals?.grandTotal || 0;
  const currency = doc.currency || 'INR';
  const dataJson = JSON.stringify(doc);

  if (type === 'quotation') {
    db.prepare(`
      INSERT OR REPLACE INTO quotations (
        id, user_id, quotation_number, title, status, customer_name, grand_total, currency, data_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      doc.id,
      userId,
      doc.quotationNumber || 'QT-000',
      doc.title || 'Quotation',
      doc.status || 'draft',
      customerName,
      grandTotal,
      currency,
      dataJson,
      doc.createdAt || nowISO,
      nowISO
    );
  } else {
    db.prepare(`
      INSERT OR REPLACE INTO invoices (
        id, user_id, invoice_number, title, status, customer_name, grand_total, currency, data_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      doc.id,
      userId,
      doc.invoiceNumber || 'INV-000',
      doc.title || 'Invoice',
      doc.status || 'draft',
      customerName,
      grandTotal,
      currency,
      dataJson,
      doc.createdAt || nowISO,
      nowISO
    );
  }

  logActivity(userId, `${type.toUpperCase()}_SAVED`, `Saved ${type} #${type === 'quotation' ? doc.quotationNumber : doc.invoiceNumber}`, 'USER');
  return true;
}

export function getCustomerDocuments(userId: string): { quotations: any[]; invoices: any[] } {
  const db = getDatabase();
  const qRows = db.prepare('SELECT data_json FROM quotations WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];
  const iRows = db.prepare('SELECT data_json FROM invoices WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];

  const safeParse = (str: string) => {
    if (!str || typeof str !== 'string' || !str.trim()) return null;
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  };

  return {
    quotations: qRows.map((r) => safeParse(r.data_json)).filter(Boolean),
    invoices: iRows.map((r) => safeParse(r.data_json)).filter(Boolean),
  };
}

export function createPlan(plan: Omit<SubscriptionPlan, 'id'>): SubscriptionPlan {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = 'plan_' + Date.now();
  const pdfLimit = plan.pdfDownloadLimit ?? 20;

  db.prepare(`
    INSERT INTO plans (id, name, duration_months, price_inr, pdf_download_limit, description, features_json, is_active, is_popular, is_custom, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    plan.name,
    plan.durationMonths,
    plan.priceINR,
    pdfLimit,
    plan.description,
    JSON.stringify(plan.features || []),
    plan.isActive ? 1 : 0,
    plan.isPopular ? 1 : 0,
    plan.isCustom ? 1 : 0,
    now,
    now
  );
  logActivity(undefined, 'PLAN_CREATED', `New plan created: ${plan.name} (₹${plan.priceINR}, ${pdfLimit} PDFs)`, 'SUPER_ADMIN');
  return getPlanById(id)!;
}

