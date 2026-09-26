import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quotation, Invoice, BusinessProfile, TemplateStyle } from '@/types';
import { formatCurrency } from './calculator';
import { MONTSERRAT_REGULAR_BASE64, MONTSERRAT_BOLD_BASE64 } from './montserratFont';

// Color Palettes for Template Styles
const THEMES = {
  modern: {
    primary: [37, 99, 235], // #2563eb Vibrant Blue
    primaryText: [255, 255, 255],
    dark: [15, 23, 42], // Slate 900
    accentBg: [239, 246, 255], // Blue 50
    borderColor: [226, 232, 240], // Slate 200
    textMuted: [100, 116, 139], // Slate 500
    tableHeadBg: [241, 245, 249],
    tableHeadText: [15, 23, 42],
  },
  classic: {
    primary: [30, 41, 59], // #1e293b Deep Navy Charcoal
    primaryText: [255, 255, 255],
    dark: [30, 41, 59],
    accentBg: [248, 250, 252], // Slate 50
    borderColor: [203, 213, 225], // Slate 300
    textMuted: [100, 116, 139],
    tableHeadBg: [30, 41, 59],
    tableHeadText: [255, 255, 255],
  },
  minimalist: {
    primary: [24, 24, 27], // #18181b Pitch Black
    primaryText: [255, 255, 255],
    dark: [24, 24, 27],
    accentBg: [250, 250, 250],
    borderColor: [228, 228, 231], // Zinc 200
    textMuted: [113, 113, 122], // Zinc 500
    tableHeadBg: [250, 250, 250],
    tableHeadText: [24, 24, 27],
  },
};

/**
 * Embeds and registers Montserrat font in the jsPDF document.
 */
export function registerMontserrat(doc: jsPDF): string {
  try {
    doc.addFileToVFS('Montserrat-Regular.ttf', MONTSERRAT_REGULAR_BASE64);
    doc.addFont('Montserrat-Regular.ttf', 'Montserrat', 'normal');

    doc.addFileToVFS('Montserrat-Bold.ttf', MONTSERRAT_BOLD_BASE64);
    doc.addFont('Montserrat-Bold.ttf', 'Montserrat', 'bold');

    doc.setFont('Montserrat', 'normal');
    return 'Montserrat';
  } catch (e) {
    console.warn('Montserrat registration notice:', e);
    return 'helvetica';
  }
}

/**
 * Safely renders the business logo if provided and enabled.
 * Preserves aspect ratio with max bounds: maxWidthMm (default 36mm) and maxHeightMm (default 16mm).
 */
export function renderBusinessLogo(
  doc: jsPDF,
  logoUrl?: string,
  logoEnabled?: boolean,
  x = 14,
  y = 14,
  maxWidthMm = 36,
  maxHeightMm = 16
): { rendered: boolean; width: number; height: number } {
  if (!logoUrl || !logoUrl.trim() || logoEnabled === false) {
    return { rendered: false, width: 0, height: 0 };
  }
  try {
    let width = maxWidthMm;
    let height = maxHeightMm;

    try {
      const props = doc.getImageProperties(logoUrl);
      if (props && props.width && props.height) {
        const aspect = props.width / props.height;
        if (aspect > maxWidthMm / maxHeightMm) {
          width = maxWidthMm;
          height = maxWidthMm / aspect;
        } else {
          height = maxHeightMm;
          width = maxHeightMm * aspect;
        }
      }
    } catch {
      // Fallback if image dimensions cannot be parsed directly
    }

    doc.addImage(logoUrl, x, y, width, height);
    return { rendered: true, width, height };
  } catch (err) {
    console.warn('[pdfGenerator] Failed to render business logo:', err);
    return { rendered: false, width: 0, height: 0 };
  }
}

export function generateQuotationPDF(quotation: Quotation, businessOverride?: BusinessProfile): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const fontName = registerMontserrat(doc);

  const business = quotation.business || businessOverride || {
    businessName: 'Business Name',
    address: '',
    phone: '',
    email: '',
    taxNumber: '',
  };

  const style: TemplateStyle = quotation.template || 'modern';
  const theme = THEMES[style] || THEMES.modern;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;

  // Header
  if (style === 'modern') {
    const logo = renderBusinessLogo(doc, business.logoUrl, business.logoEnabled, margin, currentY, 35, 16);
    const titleX = logo.rendered ? margin + logo.width + 4 : margin;

    // Business Branding
    doc.setFont(fontName, 'bold');
    doc.setFontSize(20);
    doc.setTextColor(theme.dark[0], theme.dark[1], theme.dark[2]);
    doc.text(business.businessName || 'EASYWORKS', titleX, currentY + 5);

    // Document Badge
    doc.setFont(fontName, 'bold');
    doc.setFontSize(16);
    doc.setTextColor(theme.primary[0], theme.primary[1], theme.primary[2]);
    doc.text('QUOTATION', pageWidth - margin, currentY + 4, { align: 'right' });

    doc.setFont(fontName, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(theme.dark[0], theme.dark[1], theme.dark[2]);
    doc.text(quotation.quotationNumber, pageWidth - margin, currentY + 10, { align: 'right' });

    doc.setFont(fontName, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
    doc.text(`Issue Date: ${quotation.date}`, pageWidth - margin, currentY + 15, { align: 'right' });
    doc.text(`Valid Until: ${quotation.validUntil}`, pageWidth - margin, currentY + 19, { align: 'right' });

    if (logo.rendered) {
      currentY = Math.max(currentY + 15, currentY + logo.height + 2);
    } else {
      currentY += 15;
    }

  } else if (style === 'classic') {
    const logo = renderBusinessLogo(doc, business.logoUrl, business.logoEnabled, margin, currentY, 35, 14);
    if (logo.rendered) {
      currentY += logo.height + 3;
    }

    doc.setFillColor(theme.primary[0], theme.primary[1], theme.primary[2]);
    doc.rect(margin, currentY, pageWidth - (margin * 2), 14, 'F');

    doc.setFont(fontName, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text((business.businessName || 'EASYWORKS').toUpperCase(), margin + 5, currentY + 9);
    doc.text('COMMERCIAL QUOTATION', pageWidth - margin - 5, currentY + 9, { align: 'right' });

    currentY += 19;

    doc.setFont(fontName, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(theme.dark[0], theme.dark[1], theme.dark[2]);
    doc.text(`Ref: ${quotation.quotationNumber}`, pageWidth - margin, currentY, { align: 'right' });

    doc.setFont(fontName, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
    doc.text(`Date: ${quotation.date} | Valid Until: ${quotation.validUntil}`, pageWidth - margin, currentY + 5, { align: 'right' });

  } else {
    // Minimalist
    const logo = renderBusinessLogo(doc, business.logoUrl, business.logoEnabled, margin, currentY, 28, 12);
    const titleX = logo.rendered ? margin + logo.width + 4 : margin;

    doc.setFont(fontName, 'bold');
    doc.setFontSize(16);
    doc.setTextColor(theme.dark[0], theme.dark[1], theme.dark[2]);
    doc.text(business.businessName || 'EASYWORKS', titleX, currentY + 4);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
    doc.text('ESTIMATE / QUOTE', pageWidth - margin, currentY + 2, { align: 'right' });

    doc.setFont(fontName, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(theme.dark[0], theme.dark[1], theme.dark[2]);
    doc.text(quotation.quotationNumber, pageWidth - margin, currentY + 7, { align: 'right' });

    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
    doc.text(`${quotation.date} · valid till ${quotation.validUntil}`, pageWidth - margin, currentY + 12, { align: 'right' });

    if (logo.rendered) {
      currentY = Math.max(currentY + 15, currentY + logo.height + 2);
    } else {
      currentY += 15;
    }
  }

  // Company Details Block
  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const companyInfo = [
    business.address,
    business.phone ? `Phone: ${business.phone}` : '',
    business.email ? `Email: ${business.email}` : '',
    business.taxNumber ? `GST / Tax ID: ${business.taxNumber}` : '',
  ].filter((x): x is string => Boolean(x));

  companyInfo.forEach((line, index) => {
    doc.text(line, margin, currentY + (index * 4.2));
  });

  currentY += companyInfo.length * 4.2 + 6;

  // Separator Line
  doc.setDrawColor(theme.borderColor[0], theme.borderColor[1], theme.borderColor[2]);
  doc.setLineWidth(style === 'classic' ? 0.8 : 0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // Customer Block
  if (style === 'classic') {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(theme.borderColor[0], theme.borderColor[1], theme.borderColor[2]);
    doc.rect(margin, currentY, pageWidth - (margin * 2), 22, 'S');
  } else {
    doc.setFillColor(theme.accentBg[0], theme.accentBg[1], theme.accentBg[2]);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 22, 2, 2, 'F');
  }

  doc.setFont(fontName, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
  doc.text('QUOTATION ISSUED TO:', margin + 4, currentY + 5);

  doc.setFont(fontName, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(theme.dark[0], theme.dark[1], theme.dark[2]);
  doc.text(quotation.customer.name || 'Valued Customer', margin + 4, currentY + 11);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const custSub = [
    quotation.customer.company,
    quotation.customer.phone,
    quotation.customer.email,
    quotation.customer.address,
    quotation.customer.taxNumber ? `Tax ID: ${quotation.customer.taxNumber}` : '',
  ].filter((x): x is string => Boolean(x)).join(' • ');

  if (custSub) {
    doc.text(custSub, margin + 4, currentY + 16.5);
  }

  currentY += 27;

  // Items Table
  const tableData = quotation.items.map((item, index) => [
    (index + 1).toString(),
    item.name ? `${item.name}${item.description ? `\n${item.description}` : ''}` : item.description || '',
    `${item.quantity} ${item.unit || ''}`.trim(),
    formatCurrency(item.rate, quotation.currency),
    item.discountValue ? `${item.discountValue}${item.discountType === 'fixed' ? ' ' + quotation.currency : '%'}` : '-',
    item.taxPercentage ? `${item.taxPercentage}%` : '-',
    formatCurrency(item.amount, quotation.currency),
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['#', 'Item & Description', 'Qty', 'Unit Rate', 'Disc', 'Tax', 'Amount']],
    body: tableData,
    theme: style === 'minimalist' ? 'plain' : style === 'classic' ? 'grid' : 'striped',
    headStyles: {
      font: fontName,
      fillColor: [theme.tableHeadBg[0], theme.tableHeadBg[1], theme.tableHeadBg[2]],
      textColor: [theme.tableHeadText[0], theme.tableHeadText[1], theme.tableHeadText[2]],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 3,
    },
    bodyStyles: {
      font: fontName,
      fontSize: 8,
      textColor: [51, 65, 85],
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    styles: {
      font: fontName,
      overflow: 'linebreak',
      lineColor: [theme.borderColor[0], theme.borderColor[1], theme.borderColor[2]],
      lineWidth: 0.2,
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  currentY = finalY;

  // Financial Totals Summary Box
  const totalsBoxWidth = 85;
  const totalsX = pageWidth - margin - totalsBoxWidth;

  doc.setFillColor(250, 250, 250);
  doc.rect(totalsX, currentY, totalsBoxWidth, 38, 'F');
  doc.setDrawColor(theme.borderColor[0], theme.borderColor[1], theme.borderColor[2]);
  doc.rect(totalsX, currentY, totalsBoxWidth, 38, 'S');

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  let ty = currentY + 6;
  doc.text('Subtotal:', totalsX + 4, ty);
  doc.text(formatCurrency(quotation.totals.subtotal, quotation.currency), totalsX + totalsBoxWidth - 4, ty, { align: 'right' });

  if (quotation.totals.globalDiscountAmount > 0 || quotation.totals.itemDiscountsTotal > 0) {
    const totalDisc = (quotation.totals.globalDiscountAmount || 0) + (quotation.totals.itemDiscountsTotal || 0);
    ty += 6;
    doc.text('Total Discount:', totalsX + 4, ty);
    doc.text(`-${formatCurrency(totalDisc, quotation.currency)}`, totalsX + totalsBoxWidth - 4, ty, { align: 'right' });
  }

  if (quotation.totals.taxAmount > 0) {
    ty += 6;
    doc.text(`Tax / GST (${quotation.totals.taxPercentage}%):`, totalsX + 4, ty);
    doc.text(formatCurrency(quotation.totals.taxAmount, quotation.currency), totalsX + totalsBoxWidth - 4, ty, { align: 'right' });
  }

  // Grand Total Line
  ty += 8;
  doc.setFillColor(theme.accentBg[0], theme.accentBg[1], theme.accentBg[2]);
  doc.rect(totalsX, ty - 4, totalsBoxWidth, 10, 'F');

  doc.setFont(fontName, 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(theme.dark[0], theme.dark[1], theme.dark[2]);
  doc.text('Grand Total:', totalsX + 4, ty + 2.5);
  doc.setTextColor(theme.primary[0], theme.primary[1], theme.primary[2]);
  doc.text(formatCurrency(quotation.totals.grandTotal, quotation.currency), totalsX + totalsBoxWidth - 4, ty + 2.5, { align: 'right' });

  // Payment Terms & Notes
  const termsX = margin;
  const termsWidth = totalsX - margin - 8;
  let termsY = currentY;

  if (quotation.paymentTerms) {
    doc.setFont(fontName, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
    doc.text('PAYMENT TERMS', termsX, termsY + 4);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const splitPayment = doc.splitTextToSize(quotation.paymentTerms, termsWidth);
    doc.text(splitPayment, termsX, termsY + 8);
    termsY += splitPayment.length * 3.5 + 6;
  }

  if (quotation.notes) {
    doc.setFont(fontName, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
    doc.text('NOTES', termsX, termsY + 4);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const splitNotes = doc.splitTextToSize(quotation.notes, termsWidth);
    doc.text(splitNotes, termsX, termsY + 8);
    termsY += splitNotes.length * 3.5 + 6;
  }

  // Terms & Conditions Block
  currentY = Math.max(ty + 14, termsY + 6);
  if (quotation.termsAndConditions) {
    const splitTerms = doc.splitTextToSize(quotation.termsAndConditions, pageWidth - (margin * 2));
    const requiredHeight = splitTerms.length * 3.5 + 20;

    if (currentY + requiredHeight > pageHeight - 20) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont(fontName, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
    doc.text('TERMS & CONDITIONS', margin, currentY);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(splitTerms, margin, currentY + 4);
  }

  // Footer & Signatory
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 12;
    doc.setDrawColor(theme.borderColor[0], theme.borderColor[1], theme.borderColor[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Easyworks Quotation ${quotation.quotationNumber} • Page ${i} of ${totalPages}`,
      margin,
      footerY - 1.5
    );

    doc.setFont(fontName, 'bold');
    doc.text('Authorized Signatory', pageWidth - margin, footerY - 1.5, { align: 'right' });
  }

  return doc;
}

export function generateInvoicePDF(invoice: Invoice, businessOverride?: BusinessProfile): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const fontName = registerMontserrat(doc);

  const business = invoice.business || businessOverride || {
    businessName: 'Business Name',
    address: '',
    phone: '',
    email: '',
    taxNumber: '',
  };

  const style: TemplateStyle = invoice.template || 'modern';
  const theme = THEMES[style] || THEMES.modern;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;

  // Render Header
  if (style === 'modern') {
    const logo = renderBusinessLogo(doc, business.logoUrl, business.logoEnabled, margin, currentY, 35, 16);
    const titleX = logo.rendered ? margin + logo.width + 4 : margin;

    doc.setFont(fontName, 'bold');
    doc.setFontSize(20);
    doc.setTextColor(theme.dark[0], theme.dark[1], theme.dark[2]);
    doc.text(business.businessName || 'EASYWORKS', titleX, currentY + 5);

    doc.setFont(fontName, 'bold');
    doc.setFontSize(16);
    doc.setTextColor(16, 185, 129);
    doc.text('INVOICE', pageWidth - margin, currentY + 4, { align: 'right' });

    doc.setFont(fontName, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(theme.dark[0], theme.dark[1], theme.dark[2]);
    doc.text(invoice.invoiceNumber, pageWidth - margin, currentY + 10, { align: 'right' });

    doc.setFont(fontName, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
    doc.text(`Invoice Date: ${invoice.date}`, pageWidth - margin, currentY + 15, { align: 'right' });
    doc.text(`Due Date: ${invoice.dueDate}`, pageWidth - margin, currentY + 19, { align: 'right' });

    if (logo.rendered) {
      currentY = Math.max(currentY + 15, currentY + logo.height + 2);
    } else {
      currentY += 15;
    }

  } else if (style === 'classic') {
    const logo = renderBusinessLogo(doc, business.logoUrl, business.logoEnabled, margin, currentY, 35, 14);
    if (logo.rendered) {
      currentY += logo.height + 3;
    }

    doc.setFillColor(theme.primary[0], theme.primary[1], theme.primary[2]);
    doc.rect(margin, currentY, pageWidth - (margin * 2), 14, 'F');

    doc.setFont(fontName, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text((business.businessName || 'EASYWORKS').toUpperCase(), margin + 5, currentY + 9);
    doc.text('INVOICE', pageWidth - margin - 5, currentY + 9, { align: 'right' });

    currentY += 19;

    doc.setFont(fontName, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(theme.dark[0], theme.dark[1], theme.dark[2]);
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, pageWidth - margin, currentY, { align: 'right' });

    doc.setFont(fontName, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
    doc.text(`Date: ${invoice.date} | Due: ${invoice.dueDate}`, pageWidth - margin, currentY + 5, { align: 'right' });

  } else {
    // Minimalist
    const logo = renderBusinessLogo(doc, business.logoUrl, business.logoEnabled, margin, currentY, 28, 12);
    const titleX = logo.rendered ? margin + logo.width + 4 : margin;

    doc.setFont(fontName, 'bold');
    doc.setFontSize(16);
    doc.setTextColor(theme.dark[0], theme.dark[1], theme.dark[2]);
    doc.text(business.businessName || 'EASYWORKS', titleX, currentY + 4);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
    doc.text('INVOICE', pageWidth - margin, currentY + 2, { align: 'right' });

    doc.setFont(fontName, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(theme.dark[0], theme.dark[1], theme.dark[2]);
    doc.text(invoice.invoiceNumber, pageWidth - margin, currentY + 7, { align: 'right' });

    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
    doc.text(`${invoice.date} · due ${invoice.dueDate}`, pageWidth - margin, currentY + 12, { align: 'right' });

    if (logo.rendered) {
      currentY = Math.max(currentY + 15, currentY + logo.height + 2);
    } else {
      currentY += 15;
    }
  }

  // Company Details Block
  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const companyInfo = [
    business.address,
    business.phone ? `Phone: ${business.phone}` : '',
    business.email ? `Email: ${business.email}` : '',
    business.taxNumber ? `GST / Tax ID: ${business.taxNumber}` : '',
  ].filter((x): x is string => Boolean(x));

  companyInfo.forEach((line, index) => {
    doc.text(line, margin, currentY + (index * 4.2));
  });

  currentY += companyInfo.length * 4.2 + 6;

  // Separator Line
  doc.setDrawColor(theme.borderColor[0], theme.borderColor[1], theme.borderColor[2]);
  doc.setLineWidth(style === 'classic' ? 0.8 : 0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // Billed To (Customer)
  if (style === 'classic') {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(theme.borderColor[0], theme.borderColor[1], theme.borderColor[2]);
    doc.rect(margin, currentY, pageWidth - (margin * 2), 22, 'S');
  } else {
    doc.setFillColor(theme.accentBg[0], theme.accentBg[1], theme.accentBg[2]);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 22, 2, 2, 'F');
  }

  doc.setFont(fontName, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
  doc.text('BILLED TO:', margin + 4, currentY + 5);

  doc.setFont(fontName, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(theme.dark[0], theme.dark[1], theme.dark[2]);
  doc.text(invoice.customer.name || 'Valued Customer', margin + 4, currentY + 11);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const custSub = [
    invoice.customer.company,
    invoice.customer.phone,
    invoice.customer.email,
    invoice.customer.address,
    invoice.customer.taxNumber ? `Tax ID: ${invoice.customer.taxNumber}` : '',
  ].filter((x): x is string => Boolean(x)).join(' • ');

  if (custSub) {
    doc.text(custSub, margin + 4, currentY + 16.5);
  }

  currentY += 27;

  // Items Table
  const tableData = invoice.items.map((item, index) => [
    (index + 1).toString(),
    item.name ? `${item.name}${item.description ? `\n${item.description}` : ''}` : item.description || '',
    `${item.quantity} ${item.unit || ''}`.trim(),
    formatCurrency(item.rate, invoice.currency),
    item.discountValue ? `${item.discountValue}${item.discountType === 'fixed' ? ' ' + invoice.currency : '%'}` : '-',
    item.taxPercentage ? `${item.taxPercentage}%` : '-',
    formatCurrency(item.amount, invoice.currency),
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['#', 'Item & Description', 'Qty', 'Unit Rate', 'Disc', 'Tax', 'Amount']],
    body: tableData,
    theme: style === 'minimalist' ? 'plain' : style === 'classic' ? 'grid' : 'striped',
    headStyles: {
      font: fontName,
      fillColor: [theme.tableHeadBg[0], theme.tableHeadBg[1], theme.tableHeadBg[2]],
      textColor: [theme.tableHeadText[0], theme.tableHeadText[1], theme.tableHeadText[2]],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 3,
    },
    bodyStyles: {
      font: fontName,
      fontSize: 8,
      textColor: [51, 65, 85],
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    styles: {
      font: fontName,
      overflow: 'linebreak',
      lineColor: [theme.borderColor[0], theme.borderColor[1], theme.borderColor[2]],
      lineWidth: 0.2,
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  currentY = finalY;

  // Financial Totals Summary Box
  const totalsBoxWidth = 85;
  const totalsX = pageWidth - margin - totalsBoxWidth;

  doc.setFillColor(250, 250, 250);
  doc.rect(totalsX, currentY, totalsBoxWidth, 48, 'F');
  doc.setDrawColor(theme.borderColor[0], theme.borderColor[1], theme.borderColor[2]);
  doc.rect(totalsX, currentY, totalsBoxWidth, 48, 'S');

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  let ty = currentY + 6;
  doc.text('Subtotal:', totalsX + 4, ty);
  doc.text(formatCurrency(invoice.totals.subtotal, invoice.currency), totalsX + totalsBoxWidth - 4, ty, { align: 'right' });

  if (invoice.totals.globalDiscountAmount > 0 || invoice.totals.itemDiscountsTotal > 0) {
    const totalDisc = (invoice.totals.globalDiscountAmount || 0) + (invoice.totals.itemDiscountsTotal || 0);
    ty += 5.5;
    doc.text('Total Discount:', totalsX + 4, ty);
    doc.text(`-${formatCurrency(totalDisc, invoice.currency)}`, totalsX + totalsBoxWidth - 4, ty, { align: 'right' });
  }

  if (invoice.totals.taxAmount > 0) {
    ty += 5.5;
    doc.text(`Tax / GST (${invoice.totals.taxPercentage}%):`, totalsX + 4, ty);
    doc.text(formatCurrency(invoice.totals.taxAmount, invoice.currency), totalsX + totalsBoxWidth - 4, ty, { align: 'right' });
  }

  // Grand Total Line
  ty += 6;
  doc.setFont(fontName, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(theme.dark[0], theme.dark[1], theme.dark[2]);
  doc.text('Grand Total:', totalsX + 4, ty);
  doc.text(formatCurrency(invoice.totals.grandTotal, invoice.currency), totalsX + totalsBoxWidth - 4, ty, { align: 'right' });

  // Amount Paid
  ty += 5.5;
  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(16, 185, 129); // emerald
  doc.text('Amount Paid:', totalsX + 4, ty);
  doc.text(formatCurrency(invoice.totals.amountPaid || 0, invoice.currency), totalsX + totalsBoxWidth - 4, ty, { align: 'right' });

  // Balance Due Highlight
  ty += 6.5;
  doc.setFillColor(254, 242, 242); // Red 50
  doc.rect(totalsX, ty - 4, totalsBoxWidth, 9, 'F');

  doc.setFont(fontName, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38); // Red 600
  doc.text('Balance Due:', totalsX + 4, ty + 2.5);
  doc.text(formatCurrency(invoice.totals.balanceDue ?? invoice.totals.grandTotal, invoice.currency), totalsX + totalsBoxWidth - 4, ty + 2.5, { align: 'right' });

  // Payment Section & Bank Details
  const pSec = invoice.paymentSection;
  const termsX = margin;
  const termsWidth = totalsX - margin - 8;
  let termsY = currentY;

  if (pSec?.bankName || pSec?.accountNumber || pSec?.upiId) {
    doc.setFont(fontName, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
    doc.text('PAYMENT & BANK DETAILS', termsX, termsY + 4);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    let by = termsY + 9;
    if (pSec.bankName) {
      doc.text(`Bank: ${pSec.bankName}`, termsX, by);
      by += 4;
    }
    if (pSec.accountName) {
      doc.text(`Account Name: ${pSec.accountName}`, termsX, by);
      by += 4;
    }
    if (pSec.accountNumber) {
      doc.text(`Account No: ${pSec.accountNumber}`, termsX, by);
      by += 4;
    }
    if (pSec.ifscOrRouting) {
      doc.text(`IFSC / Routing: ${pSec.ifscOrRouting}`, termsX, by);
      by += 4;
    }
    if (pSec.upiId) {
      doc.text(`UPI ID: ${pSec.upiId}`, termsX, by);
      by += 4;
    }
    if (pSec.paymentInstructions) {
      const splitInst = doc.splitTextToSize(pSec.paymentInstructions, termsWidth);
      doc.text(splitInst, termsX, by);
      by += splitInst.length * 3.5;
    }
    termsY = by + 2;
  }

  // Terms & Conditions Block
  currentY = Math.max(ty + 14, termsY + 6);
  if (invoice.termsAndConditions) {
    const splitTerms = doc.splitTextToSize(invoice.termsAndConditions, pageWidth - (margin * 2));
    const requiredHeight = splitTerms.length * 3.5 + 20;

    if (currentY + requiredHeight > pageHeight - 20) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont(fontName, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
    doc.text('TERMS & CONDITIONS', margin, currentY);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(splitTerms, margin, currentY + 4);
  }

  // Footer & Signatory
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 12;
    doc.setDrawColor(theme.borderColor[0], theme.borderColor[1], theme.borderColor[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Easyworks Tax Invoice ${invoice.invoiceNumber} • Page ${i} of ${totalPages}`,
      margin,
      footerY - 1.5
    );

    doc.setFont(fontName, 'bold');
    doc.text('Authorized Signatory', pageWidth - margin, footerY - 1.5, { align: 'right' });
  }

  return doc;
}
