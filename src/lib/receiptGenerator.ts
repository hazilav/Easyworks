import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PaymentRecord, Subscription } from '@/types';
import { registerMontserrat } from './pdfGenerator';
import { formatBillingDate } from './billing/dateUtils';
import { formatCurrency } from './calculator';

/**
 * Generates an official payment receipt PDF with Montserrat typography.
 */
export function generatePaymentReceiptPDF({
  payment,
  subscription,
  user,
}: {
  payment: PaymentRecord;
  subscription?: Subscription | null;
  user?: { name: string; email: string; businessName?: string } | null;
}): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const fontName = registerMontserrat(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  let currentY = 20;

  // 1. Header & Brand
  doc.setFont(fontName, 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('EASYWORKS', margin, currentY);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('AI-Powered Commercial Billing Platform', margin, currentY + 5);

  // Document Badge
  doc.setFont(fontName, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text('PAYMENT RECEIPT', pageWidth - margin, currentY, { align: 'right' });

  doc.setFont(fontName, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(payment.receiptNumber, pageWidth - margin, currentY + 6, { align: 'right' });

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Payment Date: ${formatBillingDate(payment.createdAt)}`, pageWidth - margin, currentY + 11, { align: 'right' });

  // Divider line
  currentY += 18;
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // 2. Customer & Billing Details
  currentY += 10;
  doc.setFont(fontName, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('ISSUED TO / SUBSCRIBER', margin, currentY);
  doc.text('TRANSACTION SUMMARY', pageWidth / 2 + 10, currentY);

  currentY += 6;
  doc.setFont(fontName, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(user?.name || 'Authorized Account Owner', margin, currentY);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  if (user?.businessName) {
    currentY += 5;
    doc.text(user.businessName, margin, currentY);
  }
  currentY += 5;
  doc.text(user?.email || 'Registered Easyworks User', margin, currentY);

  // Transaction details column
  let transY = currentY - (user?.businessName ? 11 : 6);
  doc.setFont(fontName, 'normal');
  doc.setFontSize(9);
  doc.text(`Payment ID: ${payment.gatewayPaymentId || payment.id}`, pageWidth / 2 + 10, transY);
  transY += 5;
  doc.text(`Payment Method: ${payment.paymentMethod || 'Online Gateway'}`, pageWidth / 2 + 10, transY);
  transY += 5;
  doc.text(`Gateway Order ID: ${payment.gatewayOrderId || 'N/A'}`, pageWidth / 2 + 10, transY);
  transY += 5;
  doc.setFont(fontName, 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`Status: COMPLETED`, pageWidth / 2 + 10, transY);

  currentY = Math.max(currentY, transY) + 14;

  // 3. Receipt Table
  const tableData = [
    [
      `Easyworks Pro Subscription — ${payment.planName}`,
      subscription?.subscriptionStartedAt && subscription?.subscriptionEndsAt
        ? `${formatBillingDate(subscription.subscriptionStartedAt)} to ${formatBillingDate(subscription.subscriptionEndsAt)}`
        : 'Active SaaS Subscription Period',
      formatCurrency(payment.amountINR, payment.currency),
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Description', 'Subscription Coverage', 'Amount Paid']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [30, 41, 59],
      font: fontName,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 3.5,
    },
    bodyStyles: {
      textColor: [51, 65, 85],
      font: fontName,
      fontSize: 9,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
    },
  });

  // 4. Totals Block
  const finalY = (doc as any).lastAutoTable.finalY + 8;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(pageWidth - margin - 75, finalY, 75, 24, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(pageWidth - margin - 75, finalY, 75, 24, 3, 3, 'D');

  doc.setFont(fontName, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Total Paid:', pageWidth - margin - 70, finalY + 8);
  doc.text('Tax Included:', pageWidth - margin - 70, finalY + 14);

  doc.setFont(fontName, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(payment.amountINR, payment.currency), pageWidth - margin - 5, finalY + 8, { align: 'right' });
  doc.setFontSize(9);
  doc.setTextColor(16, 185, 129);
  doc.text('Paid in Full', pageWidth - margin - 5, finalY + 14, { align: 'right' });

  // 5. Footer & Tax Compliance Note
  const footerY = 265;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'This is a computer-generated receipt for your Easyworks subscription and does not require a physical signature.',
    margin,
    footerY + 6
  );
  doc.text(
    'For billing inquiries or tax invoice copy, please contact billing@easyworks.com',
    margin,
    footerY + 11
  );

  return doc;
}
