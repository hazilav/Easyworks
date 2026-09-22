import { LineItem, DocumentTotals } from '@/types';

/**
 * Authoritative deterministic calculation engine for Easyworks.
 * Supports line item calculation (qty * rate - item discount + item tax)
 * and global quotation/invoice calculations.
 */
export function calculateLineItemAmount(item: Partial<LineItem>): number {
  const q = isNaN(Number(item.quantity)) || Number(item.quantity) < 0 ? 0 : Number(item.quantity);
  const r = isNaN(Number(item.rate)) || Number(item.rate) < 0 ? 0 : Number(item.rate);
  let baseAmount = q * r;

  // Item-level discount
  if (item.discountValue && item.discountValue > 0) {
    if (item.discountType === 'fixed') {
      baseAmount = Math.max(0, baseAmount - item.discountValue);
    } else {
      // Percentage
      const disc = (baseAmount * item.discountValue) / 100;
      baseAmount = Math.max(0, baseAmount - disc);
    }
  }

  // Item-level tax (if item has its own tax rate)
  if (item.taxPercentage && item.taxPercentage > 0) {
    const itemTax = (baseAmount * item.taxPercentage) / 100;
    baseAmount += itemTax;
  }

  return Math.round(baseAmount * 100) / 100;
}

export function calculateLineAmount(quantity: number, rate: number): number {
  const q = isNaN(quantity) || quantity < 0 ? 0 : quantity;
  const r = isNaN(rate) || rate < 0 ? 0 : rate;
  return Math.round((q * r) * 100) / 100;
}

export function calculateDocumentTotals(
  items: LineItem[],
  globalDiscountType: 'percentage' | 'fixed' = 'percentage',
  globalDiscountValue: number = 0,
  taxPercentage: number = 0,
  amountPaid: number = 0
): DocumentTotals {
  let subtotal = 0;
  let itemDiscountsTotal = 0;

  items.forEach((item) => {
    const rawLine = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
    subtotal += rawLine;

    if (item.discountValue && item.discountValue > 0) {
      if (item.discountType === 'fixed') {
        itemDiscountsTotal += Math.min(rawLine, item.discountValue);
      } else {
        itemDiscountsTotal += (rawLine * item.discountValue) / 100;
      }
    }
  });

  subtotal = Math.round(subtotal * 100) / 100;
  itemDiscountsTotal = Math.round(itemDiscountsTotal * 100) / 100;

  // Amount after line item discounts
  const afterItemDiscounts = Math.max(0, subtotal - itemDiscountsTotal);

  // Global document discount
  let globalDiscountAmount = 0;
  if (globalDiscountValue > 0) {
    if (globalDiscountType === 'fixed') {
      globalDiscountAmount = Math.min(afterItemDiscounts, globalDiscountValue);
    } else {
      globalDiscountAmount = (afterItemDiscounts * globalDiscountValue) / 100;
    }
  }
  globalDiscountAmount = Math.round(globalDiscountAmount * 100) / 100;

  const taxableAmount = Math.max(0, afterItemDiscounts - globalDiscountAmount);

  // Document Tax
  let taxAmount = 0;
  if (taxPercentage > 0) {
    taxAmount = (taxableAmount * taxPercentage) / 100;
  }
  taxAmount = Math.round(taxAmount * 100) / 100;

  const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;
  const safeAmountPaid = Math.max(0, Number(amountPaid) || 0);
  const balanceDue = Math.max(0, Math.round((grandTotal - safeAmountPaid) * 100) / 100);

  return {
    subtotal,
    itemDiscountsTotal,
    globalDiscountType,
    globalDiscountValue,
    globalDiscountAmount,
    taxableAmount,
    taxPercentage,
    taxAmount,
    grandTotal,
    amountPaid: safeAmountPaid,
    balanceDue,
  };
}

// Backward compatibility alias
export function calculateQuotationTotals(
  items: LineItem[],
  discountPercentage: number = 0,
  taxPercentage: number = 0,
  manualDiscountAmount: number = 0
): DocumentTotals {
  const discountType = manualDiscountAmount > 0 ? 'fixed' : 'percentage';
  const discountValue = manualDiscountAmount > 0 ? manualDiscountAmount : discountPercentage;
  return calculateDocumentTotals(items, discountType, discountValue, taxPercentage, 0);
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  AED: 'AED ',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'AU$',
  SGD: 'SG$',
  SAR: 'SAR ',
  QAR: 'QAR ',
};

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  const symbol = CURRENCY_SYMBOLS[currency] || (currency + ' ');
  const safeAmount = isNaN(amount) ? 0 : amount;

  if (currency === 'INR') {
    const formatted = safeAmount.toLocaleString('en-IN', {
      minimumFractionDigits: safeAmount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return `${symbol}${formatted}`;
  }

  const formatted = safeAmount.toLocaleString('en-US', {
    minimumFractionDigits: safeAmount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

export function generateQuotationNumber(sequence: number): string {
  const year = new Date().getFullYear();
  const seqStr = String(sequence).padStart(4, '0');
  return `QT-${year}-${seqStr}`;
}

export function generateInvoiceNumber(sequence: number): string {
  const year = new Date().getFullYear();
  const seqStr = String(sequence).padStart(4, '0');
  return `INV-${year}-${seqStr}`;
}
