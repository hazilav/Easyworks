import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.resolve('data/easyworks.db');
const backupPath = path.resolve('data/easyworks.db.bak');

console.log(`[Reset] Database path: ${dbPath}`);

// 1. Create a backup of easyworks.db
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log(`[Reset] Created backup at: ${backupPath}`);
} catch (err) {
  console.warn('[Reset] Could not create backup file:', err.message);
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = OFF;'); // temporarily disable during bulk clear

const adminEmail = 'muhammedhazilav@gmail.com';
const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);

if (!existingAdmin) {
  console.error(`[Reset] FATAL: Super Admin ${adminEmail} not found!`);
  process.exit(1);
}

const adminId = existingAdmin.id;
console.log(`[Reset] Preserving Super Admin: ${adminEmail} (ID: ${adminId})`);

// 2. Clear customer/demo data tables
const tablesToPurge = [
  'pdf_usage_logs',
  'activity_logs',
  'manual_payment_requests',
  'payments',
  'payment_events',
  'custom_plan_requests',
  'quotations',
  'invoices',
  'trial_identities',
  'verification_codes',
  'rate_limits',
  'device_sessions',
];

for (const tbl of tablesToPurge) {
  const info = db.prepare(`DELETE FROM "${tbl}"`).run();
  console.log(`[Reset] Cleared table ${tbl} (${info.changes} rows deleted)`);
}

// 3. Clear subscriptions except for Super Admin
const subInfo = db.prepare('DELETE FROM subscriptions WHERE user_id != ?').run(adminId);
console.log(`[Reset] Cleared customer subscriptions (${subInfo.changes} rows deleted)`);

// 4. Clear businesses except for Super Admin
const bizInfo = db.prepare('DELETE FROM businesses WHERE user_id != ?').run(adminId);
console.log(`[Reset] Cleared customer businesses (${bizInfo.changes} rows deleted)`);

// 5. Clear users except for Super Admin
const userInfo = db.prepare('DELETE FROM users WHERE email != ?').run(adminEmail);
console.log(`[Reset] Cleared customer users (${userInfo.changes} rows deleted)`);

// 6. Standardize Super Admin account
const now = new Date().toISOString();
const oneYearLater = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();

db.prepare(`
  UPDATE users
  SET name = 'Muhammed Hazil',
      business_name = 'Easyworks HQ',
      role = 'SUPER_ADMIN',
      phone = '9539933265',
      status = 'ACTIVE'
  WHERE id = ?
`).run(adminId);

db.prepare(`
  INSERT INTO businesses (id, user_id, business_name, owner_name, currency, logo_url, logo_enabled, phone, email, created_at)
  VALUES (?, ?, 'Easyworks HQ', 'Muhammed Hazil', 'INR', NULL, 1, '9539933265', ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    business_name = 'Easyworks HQ',
    owner_name = 'Muhammed Hazil',
    currency = 'INR',
    logo_url = NULL,
    logo_enabled = 1,
    tagline = NULL,
    phone = '9539933265',
    email = ?
`).run('biz_' + adminId, adminId, adminEmail, now, adminEmail);

db.prepare(`
  INSERT INTO subscriptions (
    id, user_id, plan_id, status, trial_started_at, trial_ends_at,
    subscription_started_at, subscription_ends_at, pdf_download_limit,
    pdf_downloads_used, trial_pdf_downloads, created_at, updated_at
  ) VALUES (?, ?, 'plan_6m', 'ACTIVE', ?, ?, ?, ?, 9999, 0, 0, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    plan_id = 'plan_6m',
    status = 'ACTIVE',
    subscription_started_at = ?,
    subscription_ends_at = ?,
    pdf_download_limit = 9999,
    pdf_downloads_used = 0,
    trial_pdf_downloads = 0,
    updated_at = ?
`).run(
  'sub_' + adminId,
  adminId,
  now,
  oneYearLater,
  now,
  oneYearLater,
  now,
  now,
  now,
  oneYearLater,
  now
);

// 7. Insert clean system initialization activity log
db.prepare(`
  INSERT INTO activity_logs (id, user_id, action, details, actor, created_at)
  VALUES (?, ?, 'SYSTEM_RESET', 'Fresh production database initialized (zero customer/demo data)', 'SYSTEM', ?)
`).run('act_fresh_init', adminId, now);

// 8. Re-enable foreign keys and verify integrity
db.exec('PRAGMA foreign_keys = ON;');
const fkCheck = db.prepare('PRAGMA foreign_key_check;').all();
console.log('[Reset] Foreign key check:', fkCheck.length === 0 ? 'PASS (0 issues)' : fkCheck);

const integrityCheck = db.prepare('PRAGMA integrity_check;').all();
console.log('[Reset] Integrity check:', integrityCheck);

// 9. Report final table counts
console.log('\n=== FINAL PRODUCTION DATABASE STATE ===');
const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
for (const t of allTables) {
  const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get().c;
  console.log(` * ${t.name}: ${count}`);
}
console.log('========================================\n');
