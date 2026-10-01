export interface UserAccount {
  id: string;
  name: string;
  email: string;
  businessName: string;
  role?: 'user' | 'admin' | 'SUPER_ADMIN';
  status?: 'ACTIVE' | 'SUSPENDED';
  phone?: string;
  createdAt: string;
}

export interface BusinessProfile {
  id: string;
  userId?: string;
  businessName: string;
  tagline?: string;
  ownerName: string;
  phone: string;
  email: string;
  website?: string;
  address: string;
  taxNumber?: string; // GST/VAT/Tax ID
  currency: string; // e.g. 'INR', 'USD', 'AED', 'EUR', 'GBP'
  defaultTaxPercentage: number;
  defaultPaymentTerms: string;
  defaultValidityDays: number;
  termsAndConditions: string;
  bankDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    ifscOrRouting: string;
    upiId?: string;
    swiftCode?: string;
    paymentInstructions?: string;
  };
  logoUrl?: string;
  logoEnabled?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  category?: string;
  unit: string;
  defaultRate: number;
  taxPercentage?: number;
  description?: string;
}

export interface LineItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  rate: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  taxPercentage?: number;
  amount: number;
  notes?: string;
}

// Backward-compatibility alias
export type QuotationItem = LineItem;

export type DocumentStatus = 'draft' | 'confirmed' | 'sent' | 'paid' | 'partially_paid' | 'accepted' | 'rejected' | 'overdue' | 'cancelled';
export type QuotationStatus = 'draft' | 'confirmed' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface DocumentTotals {
  subtotal: number;
  itemDiscountsTotal: number;
  globalDiscountType: 'percentage' | 'fixed';
  globalDiscountValue: number;
  globalDiscountAmount: number;
  taxableAmount: number;
  taxPercentage: number;
  taxAmount: number;
  grandTotal: number;
  amountPaid?: number;
  balanceDue?: number;
}

export type QuotationTotals = DocumentTotals;

export type TemplateStyle = 'modern' | 'classic' | 'minimalist';

export interface Quotation {
  id: string;
  quotationNumber: string;
  title: string;
  status: QuotationStatus;
  date: string;
  validUntil: string;
  template: TemplateStyle;
  business: {
    businessName: string;
    ownerName?: string;
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
    taxNumber?: string;
    logoUrl?: string;
    logoEnabled?: boolean;
  };
  customer: {
    id?: string;
    name: string;
    company?: string;
    phone?: string;
    email?: string;
    address?: string;
    taxNumber?: string;
  };
  items: LineItem[];
  currency: string;
  totals: DocumentTotals;
  paymentTerms: string;
  termsAndConditions: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. INV-2026-0001
  title: string;
  status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
  date: string;
  dueDate: string;
  template: TemplateStyle;
  business: {
    businessName: string;
    ownerName?: string;
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
    taxNumber?: string;
    logoUrl?: string;
    logoEnabled?: boolean;
  };
  customer: {
    id?: string;
    name: string;
    company?: string;
    phone?: string;
    email?: string;
    address?: string;
    taxNumber?: string;
  };
  items: LineItem[];
  currency: string;
  totals: DocumentTotals;
  paymentTerms: string;
  paymentSection: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    ifscOrRouting: string;
    swiftCode?: string;
    upiId?: string;
    paymentInstructions?: string;
  };
  termsAndConditions: string;
  notes?: string;
  quotationId?: string; // If converted from a quotation
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedQuotationAction {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  itemsToAdd?: Array<{
    description: string;
    quantity: number;
    unit: string;
    rate: number;
  }>;
  itemsToUpdate?: Array<{
    itemIndexOrKeyword: string;
    rate?: number;
    quantity?: number;
    unit?: string;
    description?: string;
  }>;
  itemsToRemove?: string[]; // keywords or item description to match and remove
  discountPercentage?: number;
  discountAmount?: number;
  taxPercentage?: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  validityDays?: number;
  notes?: string;
  currency?: string;
  isConfirmation?: boolean;
  isReset?: boolean;
  assistantReply: string;
  missingInformationPrompt?: string;
}

// SaaS Billing & Subscription Types
export type SubscriptionStatus =
  | 'TRIAL'
  | 'TRIALING'
  | 'PAYMENT_PENDING'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'PAYMENT_REJECTED'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'PAYMENT_FAILED';

export interface SubscriptionPlan {
  id: string;
  name: string;
  durationMonths: number;
  priceINR: number;
  pdfDownloadLimit: number;
  description: string;
  features: string[];
  isActive: boolean;
  isPopular?: boolean;
  isCustom?: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  subscriptionStartedAt: string | null;
  subscriptionEndsAt: string | null;
  gatewaySubscriptionId?: string | null;
  createdAt: string;
  updatedAt: string;
  plan?: SubscriptionPlan;
  trialDaysRemaining?: number;
  hasAccess?: boolean;
  pdfDownloadLimit: number;
  pdfDownloadsUsed: number;
  pdfDownloadsRemaining: number;
  trialPdfDownloads?: number;
  maxTrialPdfDownloads?: number;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  subscriptionId: string;
  planId: string;
  planName: string;
  amountINR: number;
  currency: string;
  status: 'SUCCESS' | 'FAILED' | 'REFUNDED';
  gateway: string;
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  paymentMethod?: string;
  receiptNumber: string;
  createdAt: string;
}

export interface CustomPlanRequest {
  id: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  duration: string;
  requirements: string;
  status: 'PENDING' | 'CONTACTED' | 'ARRANGED';
  createdAt: string;
}

export interface PaymentSettings {
  id: string;
  upiId: string;
  qrCodeUrl: string;
  bankAccountName: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBranch: string;
  whatsappNumber: string;
  updatedAt: string;
}

export interface ManualPaymentRequest {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  businessName?: string;
  planId: string;
  planName: string;
  amountINR: number;
  utrNumber: string;
  screenshotUrl?: string;
  notes?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type TrialEligibilityStatus =
  | 'ELIGIBLE'
  | 'REQUIRES_VERIFICATION'
  | 'REVIEW_REQUIRED'
  | 'NOT_ELIGIBLE';

export interface TrialIdentity {
  id: string;
  userId: string;
  businessId?: string;
  email: string;
  normalizedEmail: string;
  phone?: string;
  normalizedPhone?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  businessName?: string;
  normalizedBusinessName?: string;
  businessDomain?: string;
  gstin?: string;
  deviceId?: string;
  ipAddress?: string;
  eligibilityStatus: TrialEligibilityStatus;
  abuseRiskScore: number;
  flagReason?: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationCode {
  id: string;
  target: string;
  channel: 'EMAIL' | 'SMS';
  code: string;
  expiresAt: string;
  attempts: number;
  verifiedAt?: string;
  createdAt: string;
}

export interface TrialEligibilityCheckResult {
  status: TrialEligibilityStatus;
  isEligible: boolean;
  requiresEmailVerification: boolean;
  requiresPhoneVerification: boolean;
  riskScore: number;
  message: string;
  flagReason?: string;
  trialIdentity?: TrialIdentity;
}

export interface ActivityLog {
  id: string;
  userId?: string;
  action: string;
  details: string;
  actor: string; // 'SYSTEM' | 'USER' | 'SUPER_ADMIN'
  createdAt: string;
}

export interface PdfUsageLog {
  id: string;
  userId: string;
  userName?: string;
  businessName?: string;
  documentId?: string;
  documentType: 'QUOTATION' | 'INVOICE' | 'OTHER';
  documentNumber?: string;
  subscriptionId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface DeveloperStats {
  totalCustomers: number;
  activeSubscriptions: number;
  trialCustomers: number;
  expiredCustomers: number;
  paymentPending: number;
  paymentVerified: number;
  totalRevenueINR: number;
  pdfsGenerated: number;
  pdfsGeneratedToday: number;
  pdfsGeneratedThisMonth: number;
  customersAtLimit: number;
  customersNearLimit: number;
  trialPdfsUsed: number;
  activeToday: number;
  newCustomers: number;
  recentPayments: ManualPaymentRequest[];
  recentActivity: ActivityLog[];
}

export interface DeveloperCustomerSummary {
  id: string;
  email: string;
  name: string;
  businessName: string;
  phone?: string;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  subscription?: {
    id: string;
    planId: string;
    planName: string;
    status: SubscriptionStatus;
    trialStartedAt: string;
    trialEndsAt: string;
    subscriptionStartedAt: string | null;
    subscriptionEndsAt: string | null;
    pdfDownloadLimit: number;
    pdfDownloadsUsed: number;
    pdfDownloadsRemaining: number;
    trialPdfDownloads: number;
  };
  quotationsCount: number;
  invoicesCount: number;
  totalPaymentsINR: number;
  abuseRiskScore: number;
  eligibilityStatus?: TrialEligibilityStatus;
}

