import { Quotation, QuotationItem, ExtractedQuotationAction, CatalogItem, BusinessProfile } from '@/types';
import { calculateLineAmount, calculateQuotationTotals } from './calculator';

export function parseQuotationIntent(
  userMessage: string,
  currentQuotation: Quotation,
  catalog: CatalogItem[] = [],
  business: BusinessProfile
): ExtractedQuotationAction {
  const text = userMessage.trim();
  const lower = text.toLowerCase();

  // 1. Check for Confirmation intent
  const confirmKeywords = ['confirm', 'confirm quotation', 'approve', 'looks good', 'proceed', 'finalize', 'okay confirm', 'ok confirm', 'yes confirm', 'sariyaayi', 'correct aanu'];
  const isConfirm = confirmKeywords.some(k => lower === k || lower.startsWith(k + ' ') || lower.endsWith(' ' + k) || lower === 'confirm') && !lower.includes('not confirm');
  if (isConfirm && currentQuotation.items.length > 0) {
    return {
      isConfirmation: true,
      assistantReply: 'Quotation verified and approved! Official quotation generated and ready for download.',
    };
  }

  // 2. Check for Customer Name update
  let customerName: string | undefined;
  const custChangeMatch = text.match(/(?:change|update|set)\s+(?:the\s+)?customer(?:\s+name)?\s+(?:to|as)\s+([A-Za-z0-9\s&.]+?)(?=[,.;]|$)/i);
  if (custChangeMatch) {
    customerName = custChangeMatch[1].trim();
  } else {
    const forMatch = text.match(/(?:quotation|quote)\s+(?:for|to)\s+([A-Za-z0-9\s&]+?)(?=[,.;\n]|\s+(?:kitchen|website|hardware|installation|cabinet|at|with|feet|sq\s*ft)|\s*$)/i);
    if (forMatch) {
      const candidate = forMatch[1].trim();
      if (!['a', 'the', 'my', 'me', 'our', 'new'].includes(candidate.toLowerCase())) {
        customerName = candidate;
      }
    }
  }

  // 3. Check for GST / Tax update
  let taxPercentage: number | undefined;
  if (/\b(?:remove|no)\s+(?:gst|tax|vat)\b/i.test(lower)) {
    taxPercentage = 0;
  } else {
    const taxMatch = text.match(/(?:gst|tax|vat)\s*(?:@|at|to|is|of|:)?\s*(\d+(?:\.\d+)?)\s*%/i) ||
                     text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:gst|tax|vat)/i) ||
                     text.match(/(?:add|apply|include|make)\s+(?:gst|tax|vat)\s*(\d+(?:\.\d+)?)\s*%/i);
    if (taxMatch) {
      taxPercentage = parseFloat(taxMatch[1]);
    }
  }

  // 4. Check for Discount update
  let discountPercentage: number | undefined;
  let discountAmount: number | undefined;
  if (/\b(?:remove|no)\s+discount\b/i.test(lower)) {
    discountPercentage = 0;
    discountAmount = 0;
  } else {
    const discPercentMatch = text.match(/(?:discount|disc)\s*(?:of|is|at|to)?\s*(\d+(?:\.\d+)?)\s*%/i) ||
                             text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:discount|disc)/i) ||
                             text.match(/(?:give|add|apply)\s+(\d+(?:\.\d+)?)\s*%\s*discount/i);
    if (discPercentMatch) {
      discountPercentage = parseFloat(discPercentMatch[1]);
    } else {
      const discAmtMatch = text.match(/(?:discount|disc)\s*(?:of|is|at|to|rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
      if (discAmtMatch && !text.includes('%')) {
        discountAmount = parseFloat(discAmtMatch[1].replace(/,/g, ''));
      }
    }
  }

  // 5. Check for Payment terms / Delivery
  let paymentTerms: string | undefined;
  let deliveryTerms: string | undefined;
  const paymentMatch = text.match(/(?:payment\s+terms?|terms?)\s*(?:to|is|as|:)?\s*([^.,\n]+)/i);
  if (paymentMatch && (lower.includes('advance') || lower.includes('payment') || lower.includes('upfront'))) {
    paymentTerms = paymentMatch[1].trim();
  }
  const deliveryMatch = text.match(/(?:delivery|completion)\s+(?:terms?|within|time)\s*(?:is|to|:)?\s*([^.,\n]+)/i);
  if (deliveryMatch) {
    deliveryTerms = deliveryMatch[0].trim();
  }

  // 6. Check for Item Removal
  const itemsToRemove: string[] = [];
  const removeMatches = Array.from(text.matchAll(/(?:remove|delete|exclude|drop|venda|ozhivakku)\s+([A-Za-z0-9\s]+?)(?=[,.;\n]|$)/gi));
  for (const match of removeMatches) {
    const itemKeyword = match[1].trim();
    if (itemKeyword && !['the', 'a', 'tax', 'discount', 'gst'].includes(itemKeyword.toLowerCase())) {
      itemsToRemove.push(itemKeyword.toLowerCase());
    }
  }

  // 7. Check for Item Rate/Quantity Updates
  const itemsToUpdate: Array<{ itemIndexOrKeyword: string; rate?: number; quantity?: number; unit?: string }> = [];
  const rateUpdateMatch = text.match(/(?:change|update|make|set)\s+([A-Za-z\s]+?)\s+(?:rate|price|cost)\s+(?:to|as|is|at)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
  if (rateUpdateMatch) {
    itemsToUpdate.push({
      itemIndexOrKeyword: rateUpdateMatch[1].trim(),
      rate: parseFloat(rateUpdateMatch[2].replace(/,/g, '')),
    });
  }
  const qtyUpdateMatch = text.match(/(?:change|update|make|set)\s+(?:quantity|qty)\s+(?:of\s+([A-Za-z\s]+)\s+)?(?:to|as|is)?\s*(\d+)/i);
  if (qtyUpdateMatch) {
    itemsToUpdate.push({
      itemIndexOrKeyword: qtyUpdateMatch[1] ? qtyUpdateMatch[1].trim() : 'last',
      quantity: parseInt(qtyUpdateMatch[2], 10),
    });
  }

  // 8. Extraction of New Items / Multi-item statements
  const itemsToAdd: Array<{ description: string; quantity: number; unit: string; rate: number }> = [];
  const combinedCabinetMatch = text.match(/(?:kitchen\s+(?:cabinet|cupboard)|cupboard|cabinet|wardrobe)\s*(\d+(?:\.\d+)?)\s*(?:feet|ft)[\s\S]*?(?:plywood|marine\s*plywood|ply)?\s*(?:at|@)?\s*(\d+)\s*(?:per|\/)?\s*(?:sq\s*ft|feet|ft)?/i);
  let handledCombined = false;
  if (combinedCabinetMatch) {
    itemsToAdd.push({
      description: 'Kitchen cabinet',
      quantity: parseFloat(combinedCabinetMatch[1]),
      unit: 'sq ft',
      rate: parseFloat(combinedCabinetMatch[2]),
    });
    handledCombined = true;
  }

  const cleanText = text.replace(/(?:create|prepare|make|need|want|generate)\s+(?:a\s+)?quotation(?:\s+for\s+[A-Za-z0-9\s&]+)?/i, '');
  const clauses = cleanText.split(/[\n,;]|\s+and\s+(?=[a-z])/i).map(c => c.trim()).filter(c => c.length > 2);

  for (const clause of clauses) {
    const cLower = clause.toLowerCase();
    if (cLower.includes('gst') || cLower.includes('tax') || cLower.includes('discount') || cLower.startsWith('customer') || cLower.startsWith('remove') || cLower.startsWith('delete') || cLower.startsWith('change')) continue;
    if (handledCombined && (cLower.includes('kitchen') || cLower.includes('plywood'))) continue;

    const descQtyRateMatch = clause.match(/^([A-Za-z\s&'-]+?)\s+(\d+(?:\.\d+)?)\s+([a-zA-Z\s]+?)\s*(?:at|@|for|rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)$/i);
    if (descQtyRateMatch) {
      itemsToAdd.push({
        description: descQtyRateMatch[1].trim(),
        quantity: parseFloat(descQtyRateMatch[2]),
        unit: descQtyRateMatch[3].trim(),
        rate: parseFloat(descQtyRateMatch[4].replace(/,/g, '')),
      });
      continue;
    }
    const descQtyNumMatch = clause.match(/^([A-Za-z\s&'-]+?)\s+(\d+)\s+(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)$/i);
    if (descQtyNumMatch) {
      itemsToAdd.push({
        description: descQtyNumMatch[1].trim(),
        quantity: parseInt(descQtyNumMatch[2], 10),
        unit: 'units',
        rate: parseFloat(descQtyNumMatch[3].replace(/,/g, '')),
      });
      continue;
    }
    const simpleDescRateMatch = clause.match(/^([A-Za-z\s&'-]+?)\s*(?:at|@|for|cost|charges|is|:|rs\.?|₹)\s*(\d+(?:,\d+)*(?:\.\d+)?)(?:\s*(?:per|\/)\s*([a-zA-Z\s]+))?$/i) ||
                                clause.match(/^([A-Za-z\s&'-]+?)\s+(\d+(?:,\d+)*(?:\.\d+)?)$/i);
    if (simpleDescRateMatch) {
      const desc = simpleDescRateMatch[1].replace(/^(add|include|also)\s+/i, '').trim();
      const rate = parseFloat(simpleDescRateMatch[2].replace(/,/g, ''));
      const unit = simpleDescRateMatch[3] ? simpleDescRateMatch[3].trim() : (desc.toLowerCase().includes('installation') ? 'job' : (desc.toLowerCase().includes('hardware') ? 'set' : 'unit'));
      if (!desc.toLowerCase().startsWith('for ') && desc.length > 2) {
        itemsToAdd.push({
          description: desc.charAt(0).toUpperCase() + desc.slice(1),
          quantity: 1,
          unit: unit,
          rate: rate,
        });
        continue;
      }
    }
  }

  let missingInformationPrompt: string | undefined;
  let assistantReply = '';
  if (itemsToAdd.length > 0 || itemsToUpdate.length > 0 || itemsToRemove.length > 0 || taxPercentage !== undefined || discountPercentage !== undefined || customerName) {
    const changes: string[] = [];
    if (customerName) changes.push('Customer: ' + customerName);
    if (itemsToAdd.length > 0) changes.push('Added ' + itemsToAdd.map(i => i.description + ' (' + i.quantity + ' ' + i.unit + ' @ ₹' + i.rate.toLocaleString('en-IN') + ')').join(', '));
    if (itemsToUpdate.length > 0) changes.push('Updated items');
    if (itemsToRemove.length > 0) changes.push('Removed ' + itemsToRemove.join(', '));
    if (taxPercentage !== undefined) changes.push('Applied ' + taxPercentage + '% GST');
    if (discountPercentage !== undefined) changes.push('Applied ' + discountPercentage + '% discount');
    assistantReply = 'Updated quotation draft: ' + changes.join(' | ') + '.';
    const currentCustomer = customerName || currentQuotation.customer.name;
    if (!currentCustomer) {
      missingInformationPrompt = 'Who is this quotation for? Please provide the customer name.';
      assistantReply += '\n\nWho is this quotation for? Please provide the customer name.';
    }
  } else {
    if (lower.includes('website') && !lower.match(/\d{3,}/)) {
      assistantReply = 'Sure! I can prepare that website quotation. What is the website development price, and are there any domain or hosting charges?';
    } else {
      assistantReply = 'I understand. Please tell me the items, quantities, and rates for your quotation.';
    }
  }

  return { customerName, itemsToAdd, itemsToUpdate, itemsToRemove, taxPercentage, discountPercentage, discountAmount, paymentTerms, deliveryTerms, assistantReply, missingInformationPrompt };
}

export function applyQuotationAction(current: Quotation, action: ExtractedQuotationAction, business: BusinessProfile): Quotation {
  const updatedCustomer = { ...current.customer };
  if (action.customerName) updatedCustomer.name = action.customerName;
  if (action.customerPhone) updatedCustomer.phone = action.customerPhone;
  if (action.customerEmail) updatedCustomer.email = action.customerEmail;
  if (action.customerAddress) updatedCustomer.address = action.customerAddress;

  let updatedItems = [...current.items];
  if (action.itemsToRemove && action.itemsToRemove.length > 0) {
    updatedItems = updatedItems.filter(item => {
      const desc = (item.description || item.name || '').toLowerCase();
      return !action.itemsToRemove!.some(kw => desc.includes(kw));
    });
  }
  if (action.itemsToUpdate && action.itemsToUpdate.length > 0) {
    for (const update of action.itemsToUpdate) {
      const kw = update.itemIndexOrKeyword.toLowerCase();
      let matched = false;
      updatedItems = updatedItems.map(item => {
        const desc = (item.description || item.name || '').toLowerCase();
        if (!matched && (desc.includes(kw) || kw === 'last' || (kw === 'plywood' && desc.includes('plywood')) || (kw === 'plywood' && desc.includes('cabinet')))) {
          matched = true;
          const newRate = update.rate !== undefined ? update.rate : item.rate;
          const newQty = update.quantity !== undefined ? update.quantity : item.quantity;
          const newUnit = update.unit !== undefined ? update.unit : item.unit;
          return { ...item, rate: newRate, quantity: newQty, unit: newUnit, amount: calculateLineAmount(newQty, newRate) };
        }
        return item;
      });
    }
  }
  if (action.itemsToAdd && action.itemsToAdd.length > 0) {
    for (const newItem of action.itemsToAdd) {
      updatedItems.push({
        id: 'item_' + Math.random().toString(36).substring(2, 9),
        name: newItem.description,
        description: newItem.description,
        quantity: newItem.quantity,
        unit: newItem.unit,
        rate: newItem.rate,
        amount: calculateLineAmount(newItem.quantity, newItem.rate),
      });
    }
  }
  const finalTaxPercentage = action.taxPercentage !== undefined ? action.taxPercentage : current.totals.taxPercentage;
  const finalDiscountPercentage = action.discountPercentage !== undefined
    ? action.discountPercentage
    : (current.totals.globalDiscountType === 'percentage' ? current.totals.globalDiscountValue : 0);
  const finalDiscountAmount = action.discountAmount !== undefined
    ? action.discountAmount
    : (current.totals.globalDiscountType === 'fixed' ? current.totals.globalDiscountValue : 0);
  let finalPaymentTerms = current.paymentTerms;
  if (action.paymentTerms) finalPaymentTerms = action.paymentTerms;
  if (action.deliveryTerms) finalPaymentTerms = finalPaymentTerms ? (finalPaymentTerms + ' | Delivery: ' + action.deliveryTerms) : ('Delivery: ' + action.deliveryTerms);
  const totals = calculateQuotationTotals(updatedItems, finalDiscountPercentage, finalTaxPercentage, finalDiscountAmount);
  return { ...current, customer: updatedCustomer, items: updatedItems, totals, paymentTerms: finalPaymentTerms, updatedAt: new Date().toISOString() };
}
