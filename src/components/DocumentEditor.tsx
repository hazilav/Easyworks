'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import {
  Quotation,
  Invoice,
  LineItem,
  TemplateStyle,
  QuotationStatus,
} from '@/types';
import {
  formatCurrency,
  calculateDocumentTotals,
  calculateLineItemAmount,
  CURRENCY_SYMBOLS,
  generateQuotationNumber,
  generateInvoiceNumber,
} from '@/lib/calculator';
import { generateQuotationPDF, generateInvoicePDF } from '@/lib/pdfGenerator';
import {
  ArrowLeft,
  Save,
  Download,
  Printer,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Building2,
  User,
  Calendar,
  FileText,
  CreditCard,
  CheckCircle2,
  Sparkles,
  Layers,
  Eye,
  Sliders,
  Package,
  RotateCcw,
  ArrowRightCircle,
  Clock,
  Check,
  ChevronRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DocumentEditorProps {
  documentType: 'quotation' | 'invoice';
}

export default function DocumentEditor({ documentType }: DocumentEditorProps) {
  const {
    business,
    customers,
    catalog,
    activeQuotation,
    activeInvoice,
    saveQuotation,
    saveInvoice,
    setCurrentView,
    convertQuotationToInvoice,
    quotations,
    invoices,
    requestPdfDownload,
    subscription,
    setDownloadLimitModalOpen,
  } = useApp();

  const isQuotation = documentType === 'quotation';

  // State initialization
  const [docData, setDocData] = useState<any>(() => {
    if (isQuotation && activeQuotation) return { ...activeQuotation };
    if (!isQuotation && activeInvoice) return { ...activeInvoice };

    return {
      id: (isQuotation ? 'qt_' : 'inv_') + Date.now(),
      [isQuotation ? 'quotationNumber' : 'invoiceNumber']: isQuotation
        ? generateQuotationNumber(quotations.length + 1)
        : generateInvoiceNumber(invoices.length + 1),
      title: isQuotation ? 'Quotation Draft' : 'New Invoice',
      status: 'draft',
      date: new Date().toISOString().split('T')[0],
      [isQuotation ? 'validUntil' : 'dueDate']: new Date(Date.now() + 15 * 86400000)
        .toISOString()
        .split('T')[0],
      template: 'modern' as TemplateStyle,
      business: { ...business },
      customer: { name: '', company: '', phone: '', email: '', address: '', taxNumber: '' },
      items: [] as LineItem[],
      currency: business.currency || 'INR',
      totals: calculateDocumentTotals([], 'percentage', 0, business.defaultTaxPercentage || 0, 0),
      paymentTerms: business.defaultPaymentTerms || '',
      paymentSection: {
        bankName: business.bankDetails?.bankName || '',
        accountName: business.bankDetails?.accountName || '',
        accountNumber: business.bankDetails?.accountNumber || '',
        ifscOrRouting: business.bankDetails?.ifscOrRouting || '',
        swiftCode: business.bankDetails?.swiftCode || '',
        upiId: business.bankDetails?.upiId || '',
        paymentInstructions: business.bankDetails?.paymentInstructions || '',
      },
      termsAndConditions: business.termsAndConditions || '',
      notes: '',
    };
  });

  useEffect(() => {
    if (isQuotation && activeQuotation) {
      setDocData({ ...activeQuotation });
    } else if (!isQuotation && activeInvoice) {
      setDocData({ ...activeInvoice });
    }
  }, [activeQuotation, activeInvoice, isQuotation]);

  const [viewMode, setViewMode] = useState<'split' | 'form' | 'preview'>('split');
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [isSaved, setIsSaved] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showBizDetails, setShowBizDetails] = useState(false);

  const recompute = (
    items: LineItem[],
    discType = docData.totals.globalDiscountType,
    discVal = docData.totals.globalDiscountValue,
    taxPct = docData.totals.taxPercentage,
    paid = docData.totals.amountPaid || 0
  ) => {
    return calculateDocumentTotals(items, discType, discVal, taxPct, paid);
  };

  const updateField = (path: string, val: any) => {
    setDocData((prev: any) => {
      const keys = path.split('.');
      if (keys.length === 1) {
        return { ...prev, [keys[0]]: val };
      }
      if (keys.length === 2) {
        return {
          ...prev,
          [keys[0]]: { ...prev[keys[0]], [keys[1]]: val },
        };
      }
      return prev;
    });
    setIsSaved(false);
  };

  // Line Item Handlers
  const handleItemChange = (index: number, field: keyof LineItem, value: any) => {
    setDocData((prev: any) => {
      const updatedItems = [...prev.items];
      const item = { ...updatedItems[index], [field]: value };
      item.amount = calculateLineItemAmount(item);
      updatedItems[index] = item;

      const newTotals = recompute(
        updatedItems,
        prev.totals.globalDiscountType,
        prev.totals.globalDiscountValue,
        prev.totals.taxPercentage,
        prev.totals.amountPaid
      );

      return {
        ...prev,
        items: updatedItems,
        totals: newTotals,
      };
    });
    setIsSaved(false);
  };

  const addItem = () => {
    const newItem: LineItem = {
      id: 'li_' + Date.now(),
      name: '',
      description: '',
      quantity: 1,
      unit: 'pcs',
      rate: 0,
      discountType: 'percentage',
      discountValue: 0,
      taxPercentage: 0,
      amount: 0,
    };
    setDocData((prev: any) => {
      const updatedItems = [...prev.items, newItem];
      const newTotals = recompute(
        updatedItems,
        prev.totals.globalDiscountType,
        prev.totals.globalDiscountValue,
        prev.totals.taxPercentage,
        prev.totals.amountPaid
      );
      return { ...prev, items: updatedItems, totals: newTotals };
    });
    setIsSaved(false);
  };

  const addFromCatalog = (catItem: any) => {
    const newItem: LineItem = {
      id: 'li_' + Date.now(),
      name: catItem.name,
      description: catItem.description || '',
      quantity: 1,
      unit: catItem.unit || 'pcs',
      rate: catItem.defaultRate || 0,
      discountType: 'percentage',
      discountValue: 0,
      taxPercentage: catItem.taxPercentage || 0,
      amount: calculateLineItemAmount({
        quantity: 1,
        rate: catItem.defaultRate || 0,
        taxPercentage: catItem.taxPercentage || 0,
      }),
    };
    setDocData((prev: any) => {
      const updatedItems = [...prev.items, newItem];
      const newTotals = recompute(
        updatedItems,
        prev.totals.globalDiscountType,
        prev.totals.globalDiscountValue,
        prev.totals.taxPercentage,
        prev.totals.amountPaid
      );
      return { ...prev, items: updatedItems, totals: newTotals };
    });
    setShowCatalogModal(false);
    setIsSaved(false);
  };

  const removeItem = (index: number) => {
    setDocData((prev: any) => {
      const updatedItems = prev.items.filter((_: any, idx: number) => idx !== index);
      const newTotals = recompute(
        updatedItems,
        prev.totals.globalDiscountType,
        prev.totals.globalDiscountValue,
        prev.totals.taxPercentage,
        prev.totals.amountPaid
      );
      return { ...prev, items: updatedItems, totals: newTotals };
    });
    setIsSaved(false);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    setDocData((prev: any) => {
      const items = [...prev.items];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= items.length) return prev;
      const temp = items[index];
      items[index] = items[targetIndex];
      items[targetIndex] = temp;
      return { ...prev, items };
    });
    setIsSaved(false);
  };

  const handleGlobalDiscountChange = (type: 'percentage' | 'fixed', val: number) => {
    setDocData((prev: any) => {
      const safeVal = Math.max(0, val || 0);
      const newTotals = calculateDocumentTotals(
        prev.items,
        type,
        safeVal,
        prev.totals.taxPercentage,
        prev.totals.amountPaid
      );
      return { ...prev, totals: newTotals };
    });
    setIsSaved(false);
  };

  const handleTaxChange = (pct: number) => {
    setDocData((prev: any) => {
      const safePct = Math.max(0, pct || 0);
      const newTotals = calculateDocumentTotals(
        prev.items,
        prev.totals.globalDiscountType,
        prev.totals.globalDiscountValue,
        safePct,
        prev.totals.amountPaid
      );
      return { ...prev, totals: newTotals };
    });
    setIsSaved(false);
  };

  const handleAmountPaidChange = (paid: number) => {
    setDocData((prev: any) => {
      const safePaid = Math.max(0, paid || 0);
      const newTotals = calculateDocumentTotals(
        prev.items,
        prev.totals.globalDiscountType,
        prev.totals.globalDiscountValue,
        prev.totals.taxPercentage,
        safePaid
      );
      return { ...prev, totals: newTotals };
    });
    setIsSaved(false);
  };

  const handleSelectCustomer = (cust: any) => {
    setDocData((prev: any) => ({
      ...prev,
      customer: {
        id: cust.id,
        name: cust.name,
        company: cust.company || '',
        phone: cust.phone || '',
        email: cust.email || '',
        address: cust.address || '',
        taxNumber: cust.taxNumber || '',
      },
    }));
    setIsSaved(false);
  };

  const handleSave = () => {
    if (isQuotation) {
      saveQuotation(docData as Quotation);
    } else {
      saveInvoice(docData as Invoice);
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleDownloadPDF = async () => {
    try {
      handleSave();
      const docNumber = isQuotation
        ? (docData as Quotation).quotationNumber
        : (docData as Invoice).invoiceNumber;

      const allowed = await requestPdfDownload(
        isQuotation ? 'quotation' : 'invoice',
        docData.id,
        docNumber
      );
      if (!allowed) return;

      if (isQuotation) {
        const doc = generateQuotationPDF(docData as Quotation, business);
        doc.save(`${docData.quotationNumber || 'Quotation'}.pdf`);
      } else {
        const doc = generateInvoicePDF(docData as Invoice, business);
        doc.save(`${docData.invoiceNumber || 'Invoice'}.pdf`);
      }
      confetti({ particleCount: 75, spread: 60, origin: { y: 0.8 } });
    } catch (e) {
      console.error(e);
      alert('Error generating PDF.');
    }
  };

  const handlePrint = async () => {
    try {
      // Browser print does NOT consume PDF credit (Requirement 7)
      const doc = isQuotation
        ? generateQuotationPDF(docData as Quotation, business)
        : generateInvoicePDF(docData as Invoice, business);
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } catch (e) {
      console.error(e);
      alert('Error printing document.');
    }
  };

  const handleConvertToInvoice = () => {
    handleSave();
    convertQuotationToInvoice(docData as Quotation);
  };

  const templatesList: Array<{ id: TemplateStyle; name: string }> = [
    { id: 'modern', name: 'Modern' },
    { id: 'classic', name: 'Classic' },
    { id: 'minimalist', name: 'Minimalist' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation & Action Header */}
      <header className="h-16 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-3 sm:px-4 md:px-6 flex items-center justify-between shrink-0 shadow-2xs gap-2">
        {/* Left Title & Status */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 min-w-0">
          <button
            onClick={() => setCurrentView(isQuotation ? 'quotations' : 'invoices')}
            className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 flex items-center justify-center rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
            title="Back to List"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <h1 className="font-bold text-sm sm:text-base md:text-lg text-slate-900 dark:text-white tracking-tight truncate max-w-[130px] sm:max-w-none">
              {isQuotation ? 'Quotation Editor' : 'Invoice Editor'}
            </h1>
            <span
              className={`text-[9px] sm:text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                docData.status === 'confirmed' || docData.status === 'paid'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              {docData.status}
            </span>
            <span className="text-xs font-mono font-medium text-slate-400 dark:text-zinc-500 hidden sm:inline shrink-0">
              {isQuotation ? docData.quotationNumber : docData.invoiceNumber}
            </span>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Compact Template Selector for Desktop */}
          <div className="hidden md:flex items-center gap-1.5 h-10 bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/60 rounded-xl px-2.5 shrink-0 text-xs">
            <span className="text-slate-400 font-medium text-[11px]">Template:</span>
            <select
              value={docData.template}
              onChange={(e) => updateField('template', e.target.value as TemplateStyle)}
              className="bg-transparent font-semibold text-slate-900 dark:text-white focus:outline-hidden cursor-pointer capitalize pr-1 text-xs"
            >
              <option value="modern" className="dark:bg-zinc-900">Modern</option>
              <option value="classic" className="dark:bg-zinc-900">Classic</option>
              <option value="minimalist" className="dark:bg-zinc-900">Minimalist</option>
            </select>
          </div>

          {/* Desktop View Toggle */}
          <div className="hidden lg:flex items-center h-10 bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/60 rounded-xl p-1 text-xs shrink-0">
            <button
              onClick={() => setViewMode('split')}
              className={`h-8 px-2.5 rounded-lg font-semibold transition-all cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
              }`}
            >
              Split
            </button>
            <button
              onClick={() => setViewMode('form')}
              className={`h-8 px-2.5 rounded-lg font-semibold transition-all cursor-pointer ${
                viewMode === 'form'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
              }`}
            >
              Form
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`h-8 px-2.5 rounded-lg font-semibold transition-all cursor-pointer ${
                viewMode === 'preview'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
              }`}
            >
              Preview
            </button>
          </div>

          {/* Convert Quotation to Invoice Button */}
          {isQuotation && (
            <button
              onClick={handleConvertToInvoice}
              title="Convert this quotation to an official tax invoice"
              className="hidden xl:flex items-center space-x-1.5 h-10 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
            >
              <ArrowRightCircle className="w-4 h-4" />
              <span>To Invoice</span>
            </button>
          )}

          {/* Print Button */}
          <button
            onClick={handlePrint}
            title="Print Document"
            className="h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Download PDF Button */}
          {(() => {
            const isLimitReached = (subscription?.pdfDownloadsRemaining ?? 1) <= 0;
            return (
              <button
                onClick={() => {
                  if (isLimitReached) {
                    setDownloadLimitModalOpen(true);
                  } else {
                    handleDownloadPDF();
                  }
                }}
                title={
                  isLimitReached
                    ? "You've reached your PDF download limit for this subscription. Upgrade or renew your plan to continue."
                    : "Download PDF"
                }
                className={`flex items-center space-x-1 sm:space-x-1.5 h-9 px-2.5 sm:h-10 sm:px-3.5 text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer active:scale-98 shrink-0 ${
                  isLimitReached
                    ? 'bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                    : 'bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-zinc-900'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>{isLimitReached ? 'PDF Limit Reached' : 'Download PDF'}</span>
              </button>
            );
          })()}

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="flex items-center space-x-1 sm:space-x-1.5 h-9 px-3 sm:h-10 sm:px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 active:scale-98 transition-all cursor-pointer shrink-0"
          >
            {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </header>

      {/* Mobile Sub-Header: Segmented View Switcher & Quick Template */}
      <div className="lg:hidden flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shrink-0 gap-2">
        <div className="flex bg-slate-200/90 dark:bg-zinc-800 p-0.5 rounded-xl flex-1 max-w-xs">
          <button
            onClick={() => setMobileTab('form')}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
              mobileTab === 'form'
                ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
            }`}
          >
            ✏️ Edit Form
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
              mobileTab === 'preview'
                ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
            }`}
          >
            📄 Live Preview
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">Style:</span>
          <select
            value={docData.template}
            onChange={(e) => updateField('template', e.target.value as TemplateStyle)}
            className="h-8 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 text-xs font-semibold text-slate-800 dark:text-white capitalize cursor-pointer"
          >
            <option value="modern">Modern</option>
            <option value="classic">Classic</option>
            <option value="minimalist">Minimalist</option>
          </select>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* LEFT COLUMN: Structured Form */}
        <div
          className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 ${
            mobileTab === 'form' ? 'block' : 'hidden'
          } ${
            viewMode === 'preview' ? 'lg:hidden' : 'lg:block'
          } ${
            viewMode === 'split' ? 'lg:max-w-[55%] xl:max-w-[56%]' : 'max-w-4xl mx-auto w-full'
          }`}
        >

            {/* Document Metadata Card */}
            <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isQuotation ? 'Quotation Details' : 'Invoice Details'}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 font-medium">Status:</label>
                  <select
                    value={docData.status}
                    onChange={(e) => updateField('status', e.target.value)}
                    className="h-8 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 cursor-pointer"
                  >
                    {isQuotation ? (
                      <>
                        <option value="draft">Draft</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="sent">Sent</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                      </>
                    ) : (
                      <>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="paid">Paid</option>
                        <option value="partially_paid">Partially Paid</option>
                        <option value="overdue">Overdue</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    {isQuotation ? 'Quotation Number' : 'Invoice Number'}
                  </label>
                  <input
                    type="text"
                    value={isQuotation ? docData.quotationNumber : docData.invoiceNumber}
                    onChange={(e) =>
                      updateField(isQuotation ? 'quotationNumber' : 'invoiceNumber', e.target.value)
                    }
                    className="h-10 w-full font-mono font-bold bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    {isQuotation ? 'Issue Date' : 'Invoice Date'}
                  </label>
                  <input
                    type="date"
                    value={docData.date}
                    onChange={(e) => updateField('date', e.target.value)}
                    className="h-10 w-full bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    {isQuotation ? 'Valid Until' : 'Due Date'}
                  </label>
                  <input
                    type="date"
                    value={isQuotation ? docData.validUntil : docData.dueDate}
                    onChange={(e) =>
                      updateField(isQuotation ? 'validUntil' : 'dueDate', e.target.value)
                    }
                    className="h-10 w-full bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    Currency
                  </label>
                  <select
                    value={docData.currency}
                    onChange={(e) => updateField('currency', e.target.value)}
                    className="h-10 w-full bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                  >
                    {Object.keys(CURRENCY_SYMBOLS).map((curr) => (
                      <option key={curr} value={curr}>
                        {curr} ({CURRENCY_SYMBOLS[curr]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Customer Details Card */}
            <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Customer / Client Information
                  </h3>
                </div>

                {customers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Autofill:</span>
                    <select
                      onChange={(e) => {
                        const cust = customers.find((c) => c.id === e.target.value);
                        if (cust) handleSelectCustomer(cust);
                      }}
                      defaultValue=""
                      className="h-8 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 max-w-[180px] truncate"
                    >
                      <option value="" disabled>
                        Choose Customer...
                      </option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.company ? `(${c.company})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={docData.customer.name}
                    onChange={(e) => updateField('customer.name', e.target.value)}
                    placeholder="e.g. Ahmed Khan"
                    className="h-10 w-full bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={docData.customer.company || ''}
                    onChange={(e) => updateField('customer.company', e.target.value)}
                    placeholder="e.g. Acme Enterprises"
                    className="h-10 w-full bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={docData.customer.phone || ''}
                    onChange={(e) => updateField('customer.phone', e.target.value)}
                    placeholder="+91 98765 43210"
                    className="h-10 w-full bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={docData.customer.email || ''}
                    onChange={(e) => updateField('customer.email', e.target.value)}
                    placeholder="client@example.com"
                    className="h-10 w-full bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    GST / VAT / Tax ID
                  </label>
                  <input
                    type="text"
                    value={docData.customer.taxNumber || ''}
                    onChange={(e) => updateField('customer.taxNumber', e.target.value)}
                    placeholder="32AABCE1234F1Z5"
                    className="h-10 w-full font-mono bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    Billing / Site Address
                  </label>
                  <input
                    type="text"
                    value={docData.customer.address || ''}
                    onChange={(e) => updateField('customer.address', e.target.value)}
                    placeholder="Street, City, State"
                    className="h-10 w-full bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Business Details (Collapsible Card) */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setShowBizDetails(!showBizDetails)}
                className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Sender / Business Information
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      {docData.business.businessName || business.businessName} • {docData.business.address}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                  {showBizDetails ? 'Hide' : 'Customize for this document'}
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showBizDetails ? 'rotate-90' : ''}`} />
                </span>
              </button>

              {showBizDetails && (
                <div className="p-5 md:p-6 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50/50 dark:bg-zinc-900/30">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={docData.business.businessName}
                      onChange={(e) => updateField('business.businessName', e.target.value)}
                      className="h-10 w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={docData.business.phone || ''}
                      onChange={(e) => updateField('business.phone', e.target.value)}
                      className="h-10 w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={docData.business.email || ''}
                      onChange={(e) => updateField('business.email', e.target.value)}
                      className="h-10 w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                      GST / Tax Number
                    </label>
                    <input
                      type="text"
                      value={docData.business.taxNumber || ''}
                      onChange={(e) => updateField('business.taxNumber', e.target.value)}
                      className="h-10 w-full font-mono bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                      Business Address
                    </label>
                    <input
                      type="text"
                      value={docData.business.address || ''}
                      onChange={(e) => updateField('business.address', e.target.value)}
                      className="h-10 w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Line Items & Services Table */}
            <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Line Items & Services
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">({docData.items.length} items)</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowCatalogModal(true)}
                    className="h-9 flex items-center space-x-1.5 px-3 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Package className="w-3.5 h-3.5 text-blue-500" />
                    <span>Catalog</span>
                  </button>

                  <button
                    onClick={addItem}
                    className="h-9 flex items-center space-x-1.5 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer active:scale-98"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>
              </div>

              {/* Items List */}
              {docData.items.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                      No items added yet
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Add items manually or select from your pre-configured catalog.
                    </p>
                  </div>
                  <div className="pt-2 flex justify-center gap-2.5">
                    <button
                      onClick={addItem}
                      className="h-10 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm cursor-pointer"
                    >
                      + Add Item
                    </button>
                    <button
                      onClick={() => setShowCatalogModal(true)}
                      className="h-10 px-4 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      Browse Catalog
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {docData.items.map((item: LineItem, index: number) => (
                    <div
                      key={item.id || index}
                      className="bg-slate-50/80 dark:bg-zinc-800/40 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800/80 space-y-3 transition-all"
                    >
                      {/* Top Row: Reorder, Name, Description, Delete */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center space-x-0.5 text-slate-400 shrink-0">
                          <button
                            onClick={() => moveItem(index, 'up')}
                            disabled={index === 0}
                            className="p-1 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move Up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveItem(index, 'down')}
                            disabled={index === docData.items.length - 1}
                            className="p-1 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move Down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <span className="text-xs font-bold text-slate-500 w-5 text-center">
                            {index + 1}.
                          </span>
                        </div>

                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            value={item.name || item.description}
                            onChange={(e) => {
                              handleItemChange(index, 'name', e.target.value);
                              if (!item.description) {
                                handleItemChange(index, 'description', e.target.value);
                              }
                            }}
                            placeholder="Item / Service Name *"
                            className="h-10 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs font-semibold text-slate-900 dark:text-white"
                          />
                          <input
                            type="text"
                            value={item.description || ''}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                            placeholder="Description / Specs (optional)"
                            className="h-10 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-600 dark:text-zinc-300"
                          />
                        </div>

                        <button
                          onClick={() => removeItem(index)}
                          className="h-10 w-10 shrink-0 flex items-center justify-center text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Calculations Row: Qty, Unit, Rate, Discount, Tax, Total */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-zinc-800">
                        <div className="min-w-0">
                          <label className="block text-[11px] text-slate-400 font-medium mb-1 truncate">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)
                            }
                            className="h-9 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 text-center text-xs font-semibold text-slate-900 dark:text-white font-mono"
                          />
                        </div>

                        <div className="min-w-0">
                          <label className="block text-[11px] text-slate-400 font-medium mb-1 truncate">
                            Unit
                          </label>
                          <input
                            type="text"
                            value={item.unit || 'pcs'}
                            onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                            placeholder="pcs"
                            className="h-9 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 text-center text-xs text-slate-900 dark:text-white"
                          />
                        </div>

                        <div className="min-w-0">
                          <label className="block text-[11px] text-slate-400 font-medium mb-1 truncate">
                            Unit Rate ({docData.currency})
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.rate}
                            onChange={(e) =>
                              handleItemChange(index, 'rate', parseFloat(e.target.value) || 0)
                            }
                            className="h-9 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 text-right text-xs font-semibold text-slate-900 dark:text-white font-mono"
                          />
                        </div>

                        <div className="min-w-0">
                          <label className="block text-[11px] text-slate-400 font-medium mb-1 truncate">
                            Item Disc ({item.discountType === 'fixed' ? docData.currency : '%'})
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.discountValue || 0}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                'discountValue',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-9 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 text-right text-xs text-slate-900 dark:text-white font-mono"
                          />
                        </div>

                        <div className="min-w-0">
                          <label className="block text-[11px] text-slate-400 font-medium mb-1 truncate">
                            Item Tax (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.taxPercentage || 0}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                'taxPercentage',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-9 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 text-right text-xs text-slate-900 dark:text-white font-mono"
                          />
                        </div>

                        <div className="min-w-0">
                          <label className="block text-[11px] text-slate-400 font-medium mb-1 text-right truncate">
                            Total Amount
                          </label>
                          <div className="h-9 w-full flex items-center justify-end font-bold text-xs text-slate-900 dark:text-white font-mono">
                            {formatCurrency(item.amount, docData.currency)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals Breakdown Card */}
            <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3">
                Calculations & Adjustments
              </h3>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                {/* Global Controls */}
                <div className="space-y-4 min-w-0">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                      Global Document Discount
                    </label>
                    <div className="flex gap-2 min-w-0">
                      <select
                        value={docData.totals.globalDiscountType}
                        onChange={(e) =>
                          handleGlobalDiscountChange(
                            e.target.value as any,
                            docData.totals.globalDiscountValue
                          )
                        }
                        className="h-10 w-36 shrink-0 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 text-xs font-medium text-slate-900 dark:text-white cursor-pointer focus:outline-hidden focus:border-blue-500"
                      >
                        <option value="percentage">Percent (%)</option>
                        <option value="fixed">Fixed ({docData.currency})</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={docData.totals.globalDiscountValue || 0}
                        onChange={(e) =>
                          handleGlobalDiscountChange(
                            docData.totals.globalDiscountType,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="h-10 flex-1 min-w-0 w-0 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs font-semibold text-right text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                      Document Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={docData.totals.taxPercentage || 0}
                      onChange={(e) => handleTaxChange(parseFloat(e.target.value) || 0)}
                      className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs font-semibold text-right text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500 font-mono"
                    />
                  </div>

                  {!isQuotation && (
                    <div>
                      <label className="block text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1.5">
                        Amount Paid ({docData.currency})
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={docData.totals.amountPaid || 0}
                        onChange={(e) => handleAmountPaidChange(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="h-10 w-full bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 text-right focus:outline-hidden focus:border-emerald-500 font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* Calculation Summary Box */}
                <div className="bg-slate-50 dark:bg-zinc-800/50 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 text-xs space-y-2.5 min-w-0">
                  <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                    <span className="font-medium">Subtotal</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(docData.totals.subtotal, docData.currency)}
                    </span>
                  </div>

                  {docData.totals.itemDiscountsTotal > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span className="font-medium">Line Discounts</span>
                      <span>-{formatCurrency(docData.totals.itemDiscountsTotal, docData.currency)}</span>
                    </div>
                  )}

                  {docData.totals.globalDiscountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span className="font-medium">Document Discount</span>
                      <span>-{formatCurrency(docData.totals.globalDiscountAmount, docData.currency)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                    <span className="font-medium">Taxable Amount</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(docData.totals.taxableAmount, docData.currency)}
                    </span>
                  </div>

                  {docData.totals.taxAmount > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                      <span className="font-medium">Tax ({docData.totals.taxPercentage}%)</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        +{formatCurrency(docData.totals.taxAmount, docData.currency)}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-slate-200 dark:border-zinc-700 pt-3 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Grand Total
                    </span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(docData.totals.grandTotal, docData.currency)}
                    </span>
                  </div>

                  {!isQuotation && (
                    <>
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 pt-1">
                        <span className="font-medium">Amount Paid</span>
                        <span className="font-semibold">
                          {formatCurrency(docData.totals.amountPaid || 0, docData.currency)}
                        </span>
                      </div>
                      <div className="border-t border-slate-200 dark:border-zinc-700 pt-2 flex justify-between items-baseline">
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">
                          Balance Due
                        </span>
                        <span className="text-base font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(
                            docData.totals.balanceDue ?? docData.totals.grandTotal,
                            docData.currency
                          )}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Details (Invoices) */}
            {!isQuotation && (
              <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
                  <CreditCard className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Bank Coordinates & Payment Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={docData.paymentSection?.bankName || ''}
                      onChange={(e) => updateField('paymentSection.bankName', e.target.value)}
                      placeholder="e.g. HDFC Bank"
                      className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={docData.paymentSection?.accountName || ''}
                      onChange={(e) => updateField('paymentSection.accountName', e.target.value)}
                      placeholder="Account holder"
                      className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={docData.paymentSection?.accountNumber || ''}
                      onChange={(e) => updateField('paymentSection.accountNumber', e.target.value)}
                      placeholder="50200012345678"
                      className="h-10 w-full font-mono bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                      IFSC / Routing Code
                    </label>
                    <input
                      type="text"
                      value={docData.paymentSection?.ifscOrRouting || ''}
                      onChange={(e) => updateField('paymentSection.ifscOrRouting', e.target.value)}
                      placeholder="HDFC0001234"
                      className="h-10 w-full font-mono bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                      UPI ID
                    </label>
                    <input
                      type="text"
                      value={docData.paymentSection?.upiId || ''}
                      onChange={(e) => updateField('paymentSection.upiId', e.target.value)}
                      placeholder="yourbusiness@bank"
                      className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                      SWIFT / BIC Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={docData.paymentSection?.swiftCode || ''}
                      onChange={(e) => updateField('paymentSection.swiftCode', e.target.value)}
                      placeholder="HDFCINBB"
                      className="h-10 w-full font-mono bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    Payment Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={docData.paymentSection?.paymentInstructions || ''}
                    onChange={(e) =>
                      updateField('paymentSection.paymentInstructions', e.target.value)
                    }
                    placeholder="e.g. Please share payment receipt screenshot to accounts@yourcompany.com"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* Terms & Notes Card */}
            <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3">
                Terms & Conditions and Notes
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    Payment Terms
                  </label>
                  <textarea
                    rows={3}
                    value={docData.paymentTerms || ''}
                    onChange={(e) => updateField('paymentTerms', e.target.value)}
                    placeholder="e.g. 50% advance on confirmation, 50% on handover."
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    Client Notes
                  </label>
                  <textarea
                    rows={3}
                    value={docData.notes || ''}
                    onChange={(e) => updateField('notes', e.target.value)}
                    placeholder="Special instructions or thank you message..."
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    Terms & Conditions
                  </label>
                  <textarea
                    rows={3}
                    value={docData.termsAndConditions || ''}
                    onChange={(e) => updateField('termsAndConditions', e.target.value)}
                    placeholder="Standard terms and conditions..."
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Document Preview Sheet */}
        <div
          className={`flex-1 bg-slate-100 dark:bg-zinc-950 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-zinc-800 overflow-y-auto p-3 sm:p-6 md:p-8 flex flex-col items-center ${
            mobileTab === 'preview' ? 'flex' : 'hidden'
          } ${
            viewMode === 'form' ? 'lg:hidden' : 'lg:flex'
          }`}
        >
          {/* Crisp Simulated A4 Sheet */}
          <div
            className={`w-full max-w-[580px] bg-white text-slate-900 shadow-xl rounded-2xl p-4 sm:p-8 space-y-5 sm:space-y-6 transition-all border ${
              docData.template === 'classic'
                ? 'border-2 border-slate-300'
                : docData.template === 'minimalist'
                ? 'border-zinc-200'
                : 'border-slate-200'
            }`}
          >
              {/* Modern Header */}
              {docData.template === 'modern' && (
                <div className="flex justify-between items-start border-b border-slate-200 pb-4 gap-4">
                  <div className="flex items-start gap-4">
                    {docData.business?.logoUrl && docData.business.logoUrl.trim().length > 0 && docData.business.logoEnabled !== false && (
                      <img
                        src={docData.business.logoUrl}
                        alt={docData.business.businessName || 'Business Logo'}
                        className="max-h-[70px] max-w-[160px] object-contain shrink-0 rounded"
                      />
                    )}
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                        {docData.business.businessName || 'Business Name'}
                      </h2>
                      <p className="text-xs text-slate-500 font-normal mt-1">{docData.business.address}</p>
                      <p className="text-xs text-slate-500 font-normal">
                        {docData.business.phone} • {docData.business.email}
                      </p>
                      {docData.business.taxNumber && (
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          GST/Tax: {docData.business.taxNumber}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-bold uppercase px-3 py-1 rounded-full whitespace-nowrap ${
                        isQuotation
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      {isQuotation ? 'QUOTATION' : 'INVOICE'}
                    </span>
                    <p className="text-xs font-mono font-bold text-slate-900 mt-2">
                      {isQuotation ? docData.quotationNumber : docData.invoiceNumber}
                    </p>
                    <p className="text-xs text-slate-500 font-normal">Date: {docData.date}</p>
                    <p className="text-xs text-slate-500 font-normal">
                      {isQuotation ? 'Valid: ' + docData.validUntil : 'Due: ' + docData.dueDate}
                    </p>
                  </div>
                </div>
              )}

              {/* Classic Corporate Header */}
              {docData.template === 'classic' && (
                <div className="space-y-3">
                  {docData.business?.logoUrl && docData.business.logoUrl.trim().length > 0 && docData.business.logoEnabled !== false && (
                    <div className="flex items-center justify-between pb-1">
                      <img
                        src={docData.business.logoUrl}
                        alt={docData.business.businessName || 'Business Logo'}
                        className="max-h-[60px] max-w-[160px] object-contain"
                      />
                    </div>
                  )}
                  <div className="bg-slate-900 text-white p-3.5 flex justify-between items-center rounded-xl">
                    <span className="font-bold text-sm tracking-wider uppercase">
                      {docData.business.businessName || 'BUSINESS NAME'}
                    </span>
                    <span className="text-xs tracking-widest uppercase font-semibold">
                      {isQuotation ? 'COMMERCIAL QUOTATION' : 'INVOICE'}
                    </span>
                  </div>
                  <div className="flex justify-between items-start text-xs border-b border-slate-300 pb-3">
                    <div>
                      <p className="font-semibold text-slate-900">{docData.business.address}</p>
                      <p className="text-slate-600">Phone: {docData.business.phone}</p>
                      <p className="text-slate-600">Email: {docData.business.email}</p>
                      {docData.business.taxNumber && <p className="text-slate-500 font-mono">Tax ID: {docData.business.taxNumber}</p>}
                    </div>
                    <div className="text-right font-mono">
                      <p className="font-bold text-slate-900 text-xs">
                        {isQuotation ? docData.quotationNumber : docData.invoiceNumber}
                      </p>
                      <p className="text-slate-600">Date: {docData.date}</p>
                      <p className="text-slate-600">{isQuotation ? `Valid: ${docData.validUntil}` : `Due: ${docData.dueDate}`}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Minimalist Header */}
              {docData.template === 'minimalist' && (
                <div className="flex justify-between items-start border-b border-zinc-200 pb-3 gap-4">
                  <div className="flex items-center gap-3.5">
                    {docData.business?.logoUrl && docData.business.logoUrl.trim().length > 0 && docData.business.logoEnabled !== false && (
                      <img
                        src={docData.business.logoUrl}
                        alt={docData.business.businessName || 'Business Logo'}
                        className="max-h-[50px] max-w-[140px] object-contain shrink-0"
                      />
                    )}
                    <div>
                      <h2 className="text-lg font-bold text-zinc-900 tracking-tight">
                        {docData.business.businessName || 'Business Name'}
                      </h2>
                      <p className="text-xs text-zinc-500 font-normal">{docData.business.email}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-zinc-400 tracking-wider">
                      {isQuotation ? 'ESTIMATE / QUOTE' : 'INVOICE'}
                    </span>
                    <p className="text-xs font-mono font-bold text-zinc-800">
                      {isQuotation ? docData.quotationNumber : docData.invoiceNumber}
                    </p>
                  </div>
                </div>
              )}

              {/* Customer Box Preview */}
              <div
                className={`p-4 rounded-xl text-xs space-y-1 ${
                  docData.template === 'classic'
                    ? 'border border-slate-300 bg-slate-50/50'
                    : docData.template === 'minimalist'
                    ? 'bg-zinc-50 border border-zinc-200'
                    : 'bg-blue-50/30 border border-blue-100'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {isQuotation ? 'Quotation Issued To' : 'Billed To'}
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {docData.customer.name || <span className="text-slate-300 italic font-normal">Customer Name</span>}
                </p>
                {docData.customer.company && (
                  <p className="text-slate-600 font-medium">{docData.customer.company}</p>
                )}
                {docData.customer.phone && <p className="text-slate-500 font-normal">{docData.customer.phone}</p>}
                {docData.customer.email && <p className="text-slate-500 font-normal">{docData.customer.email}</p>}
                {docData.customer.address && <p className="text-slate-500 font-normal">{docData.customer.address}</p>}
                {docData.customer.taxNumber && (
                  <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                    Tax ID: {docData.customer.taxNumber}
                  </p>
                )}
              </div>

              {/* Items Table Preview */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr
                      className={`border-b ${
                        docData.template === 'classic'
                          ? 'bg-slate-900 text-white font-semibold'
                          : docData.template === 'minimalist'
                          ? 'border-zinc-300 text-zinc-500 uppercase text-[10px] font-bold'
                          : 'bg-slate-100 text-slate-700 font-semibold'
                      }`}
                    >
                      <th className="p-2.5 w-7 text-center">#</th>
                      <th className="p-2.5">Item & Description</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Unit Rate</th>
                      <th className="p-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {docData.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-300 italic font-normal">
                          No items added yet
                        </td>
                      </tr>
                    ) : (
                      docData.items.map((it: LineItem, i: number) => (
                        <tr key={it.id || i} className="hover:bg-slate-50/50">
                          <td className="p-2.5 text-center text-slate-400 font-medium">{i + 1}</td>
                          <td className="p-2.5">
                            <span className="font-semibold text-slate-900">
                              {it.name || it.description}
                            </span>
                            {it.name && it.description && it.name !== it.description && (
                              <p className="text-[11px] text-slate-500 font-normal mt-0.5">{it.description}</p>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-normal">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="p-2.5 text-right font-normal">
                            {formatCurrency(it.rate, docData.currency)}
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-900">
                            {formatCurrency(it.amount, docData.currency)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals Preview */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span className="font-medium">Subtotal:</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(docData.totals.subtotal, docData.currency)}
                    </span>
                  </div>

                  {docData.totals.itemDiscountsTotal > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Item Discounts:</span>
                      <span>-{formatCurrency(docData.totals.itemDiscountsTotal, docData.currency)}</span>
                    </div>
                  )}

                  {docData.totals.globalDiscountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount:</span>
                      <span>-{formatCurrency(docData.totals.globalDiscountAmount, docData.currency)}</span>
                    </div>
                  )}

                  {docData.totals.taxAmount > 0 && (
                    <div className="flex justify-between font-medium">
                      <span>Tax ({docData.totals.taxPercentage}%):</span>
                      <span className="font-semibold text-slate-900">
                        +{formatCurrency(docData.totals.taxAmount, docData.currency)}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-bold text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-blue-600">
                      {formatCurrency(docData.totals.grandTotal, docData.currency)}
                    </span>
                  </div>

                  {!isQuotation && (
                    <>
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>Amount Paid:</span>
                        <span>{formatCurrency(docData.totals.amountPaid || 0, docData.currency)}</span>
                      </div>
                      <div className="border-t border-slate-200 pt-1.5 flex justify-between text-xs font-bold text-red-600">
                        <span>Balance Due:</span>
                        <span>
                          {formatCurrency(
                            docData.totals.balanceDue ?? docData.totals.grandTotal,
                            docData.currency
                          )}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Payment Coordinates Preview */}
              {!isQuotation && docData.paymentSection?.bankName && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1">
                  <p className="font-bold text-slate-800 uppercase text-[10px]">Payment Coordinates</p>
                  <p className="text-slate-600">
                    Bank: <span className="font-semibold text-slate-900">{docData.paymentSection.bankName}</span> • A/C: <span className="font-semibold text-slate-900">{docData.paymentSection.accountNumber}</span>
                  </p>
                  <p className="text-slate-600">
                    IFSC: {docData.paymentSection.ifscOrRouting} {docData.paymentSection.upiId ? `• UPI: ${docData.paymentSection.upiId}` : ''}
                  </p>
                </div>
              )}

              {/* Terms Preview */}
              {docData.paymentTerms && (
                <div className="text-xs text-slate-500 font-normal border-t border-slate-100 pt-3">
                  <span className="font-semibold text-slate-800">Payment Terms: </span>
                  {docData.paymentTerms}
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Catalog Modal */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" />
                Select Item from Catalog
              </h3>
              <button
                onClick={() => setShowCatalogModal(false)}
                className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Search catalog items..."
              className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs"
            />

            <div className="max-h-64 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-zinc-800">
              {catalog
                .filter(
                  (item) =>
                    item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                    (item.category && item.category.toLowerCase().includes(catalogSearch.toLowerCase()))
                )
                .map((catItem) => (
                  <button
                    key={catItem.id}
                    onClick={() => addFromCatalog(catItem)}
                    className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{catItem.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal">
                        {catItem.category ? `${catItem.category} • ` : ''}per {catItem.unit}
                      </p>
                    </div>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(catItem.defaultRate, docData.currency)}
                    </span>
                  </button>
                ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setShowCatalogModal(false)}
                className="h-9 px-4 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
