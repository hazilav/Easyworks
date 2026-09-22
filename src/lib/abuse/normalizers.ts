/**
 * Identity Normalization Utilities for Free-Trial Abuse Prevention.
 * Standardizes emails, phone numbers, and business names to detect aliases and duplicates.
 */

/**
 * Normalizes an email address.
 * - Converts to lowercase and trims whitespace.
 * - For Gmail/Googlemail: removes dots in local part and strips +tag suffixes.
 * - For other providers: strips +tag suffixes.
 */
export function normalizeEmail(email: string): string {
  if (!email || !email.includes('@')) return (email || '').trim().toLowerCase();

  const [rawLocal, rawDomain] = email.trim().toLowerCase().split('@');
  let domain = rawDomain;
  let local = rawLocal;

  // Standardize googlemail -> gmail
  if (domain === 'googlemail.com') {
    domain = 'gmail.com';
  }

  // Remove +tag subaddressing (e.g., user+trial@domain.com -> user@domain.com)
  const plusIndex = local.indexOf('+');
  if (plusIndex !== -1) {
    local = local.substring(0, plusIndex);
  }

  // Google ignores dots in username (e.g., john.doe@gmail.com -> johndoe@gmail.com)
  if (domain === 'gmail.com') {
    local = local.replace(/\./g, '');
  }

  return `${local}@${domain}`;
}

/**
 * Normalizes a phone number into strict E.164 international format.
 * Defaults to India (+91) if 10 digits provided without international prefix.
 */
export function normalizePhone(rawPhone: string, defaultCountry = '+91'): string {
  if (!rawPhone) return '';

  let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');

  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    // e.g. 09539933265 -> +919539933265
    cleaned = defaultCountry + cleaned.substring(1);
  }

  if (!cleaned.startsWith('+')) {
    // If 10 digits, assume default country
    if (cleaned.length === 10) {
      cleaned = defaultCountry + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }

  return cleaned;
}

/**
 * Normalizes a business name by removing corporate designations, special characters,
 * and normalizing spacing to detect identical entities under slight variations.
 */
export function normalizeBusinessName(name: string): string {
  if (!name) return '';

  let normalized = name.toLowerCase();

  // Strip punctuation and special chars
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');

  // Strip common corporate suffixes and words
  const stopWords = [
    'pvt',
    'private',
    'ltd',
    'limited',
    'llp',
    'llc',
    'inc',
    'incorporated',
    'corp',
    'corporation',
    'co',
    'company',
    'enterprises',
    'enterprise',
    'services',
    'service',
    'solutions',
    'agency',
    'studio',
    'associates',
    'group',
    'consulting',
  ];

  const words = normalized.split(/\s+/).filter(Boolean);
  const filtered = words.filter((w) => !stopWords.includes(w));

  return (filtered.length > 0 ? filtered : words).join('');
}

/**
 * Extracts the domain from an email address or website URL.
 */
export function extractDomain(input: string): string {
  if (!input) return '';

  let str = input.trim().toLowerCase();

  if (str.includes('@')) {
    return str.split('@')[1] || '';
  }

  // Handle URL
  str = str.replace(/^https?:\/\//, '').replace(/^www\./, '');
  const slashIndex = str.indexOf('/');
  if (slashIndex !== -1) {
    str = str.substring(0, slashIndex);
  }

  return str;
}
