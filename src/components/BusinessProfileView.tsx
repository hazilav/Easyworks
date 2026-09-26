'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import {
  Building2,
  Save,
  CheckCircle2,
  Percent,
  Check,
  Upload,
  Image as ImageIcon,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
  X,
  RefreshCw,
} from 'lucide-react';
import { CURRENCY_SYMBOLS } from '@/lib/calculator';

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export default function BusinessProfileView() {
  const { business, updateBusiness, currentUser } = useApp();
  const [formData, setFormData] = useState(business);
  const [isSaved, setIsSaved] = useState(false);

  // Logo state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [logoDimensions, setLogoDimensions] = useState<{ width: number; height: number } | null>(null);

  // Keep formData in sync if business context updates
  useEffect(() => {
    setFormData(business);
    if (business.logoUrl) {
      const img = new Image();
      img.onload = () => {
        setLogoDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = business.logoUrl;
    } else {
      setLogoDimensions(null);
    }
  }, [business]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateBusiness(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleFileProcess = async (file: File) => {
    setLogoError(null);

    // Size validation
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setLogoError('Logo image exceeds 5 MB limit. Please select a smaller image.');
      return;
    }

    // Type validation
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setLogoError('Unsupported format. Please upload PNG, JPG/JPEG, WebP, or SVG.');
      return;
    }

    setLogoUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) {
          setLogoError('Failed to read image file.');
          setLogoUploading(false);
          return;
        }

        // Measure natural dimensions
        const img = new Image();
        img.onload = async () => {
          setLogoDimensions({ width: img.naturalWidth, height: img.naturalHeight });

          // Update local form state immediately
          const updated = {
            ...formData,
            logoUrl: dataUrl,
            logoEnabled: formData.logoEnabled ?? true,
          };
          setFormData(updated);
          updateBusiness(updated);

          // If user is logged in, sync with server-side database
          if (currentUser?.id) {
            try {
              const res = await fetch('/api/business/logo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: currentUser.id,
                  logoUrl: dataUrl,
                  logoEnabled: formData.logoEnabled ?? true,
                }),
              });
              const resData = await res.json();
              if (!resData.success) {
                console.warn('Server logo sync response:', resData);
              }
            } catch (apiErr) {
              console.error('Failed to sync logo to backend:', apiErr);
            }
          }

          setLogoUploading(false);
        };
        img.onerror = () => {
          setLogoError('Failed to decode image.');
          setLogoUploading(false);
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        setLogoError('Failed to read file.');
        setLogoUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setLogoError(err?.message || 'Error processing image.');
      setLogoUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
    // Reset file input value so selecting the same file triggers change
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleToggleLogoVisibility = async () => {
    const newEnabled = !(formData.logoEnabled ?? true);
    const updated = { ...formData, logoEnabled: newEnabled };
    setFormData(updated);
    updateBusiness(updated);

    if (currentUser?.id) {
      try {
        await fetch('/api/business/logo', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            logoEnabled: newEnabled,
          }),
        });
      } catch (err) {
        console.error('Failed to update logo visibility on server:', err);
      }
    }
  };

  const handleConfirmRemoveLogo = async () => {
    setShowRemoveModal(false);
    setLogoDimensions(null);
    setLogoError(null);

    const updated = { ...formData, logoUrl: '' };
    setFormData(updated);
    updateBusiness(updated);

    if (currentUser?.id) {
      try {
        await fetch(`/api/business/logo?userId=${encodeURIComponent(currentUser.id)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Failed to remove logo on server:', err);
      }
    }
  };

  const hasLogo = Boolean(formData.logoUrl && formData.logoUrl.trim().length > 0);
  const isLogoEnabled = formData.logoEnabled ?? true;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 overflow-y-auto p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-purple-500" />
              Business Profile & Settings
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-zinc-400 font-normal mt-1">
              These details automatically populate in your quotations, invoices, and exported PDFs.
            </p>
          </div>

          <button
            onClick={handleSubmit}
            className="h-10 px-5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{isSaved ? 'Settings Saved' : 'Save Profile'}</span>
          </button>
        </div>

        {isSaved && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Business settings saved successfully!</span>
          </div>
        )}

        {/* Business Logo Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-500" />
                <span>Business Logo</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                  Optional
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Upload your company emblem or brand mark. It automatically appears on your quotations and invoices.
              </p>
            </div>

            {hasLogo && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleToggleLogoVisibility}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                    isLogoEnabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  }`}
                  title="Toggle whether logo appears on quotations and invoices"
                >
                  {isLogoEnabled ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Logo Visible</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Logo Hidden</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {logoError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{logoError}</span>
            </div>
          )}

          {hasLogo ? (
            /* Logo Uploaded State: Preview & Controls */
            <div className="flex flex-col md:flex-row items-center gap-6 p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/60">
              {/* Logo Preview Frame */}
              <div className="w-48 h-24 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 flex items-center justify-center p-2.5 overflow-hidden shadow-2xs">
                <img
                  src={formData.logoUrl}
                  alt={formData.businessName || 'Business Logo'}
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              {/* Logo Info & Actions */}
              <div className="flex-1 space-y-2 text-center md:text-left">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    Uploaded Logo
                  </span>
                  {logoDimensions && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300">
                      {logoDimensions.width} × {logoDimensions.height} px
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isLogoEnabled
                        ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                        : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                    }`}
                  >
                    {isLogoEnabled ? 'Active on documents' : 'Hidden on documents'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Scaled proportionally up to 160×70 px on document headers with aspect-ratio preserved.
                </p>

                {/* Action Buttons */}
                <div className="flex items-center justify-center md:justify-start gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={logoUploading}
                    className="h-8 px-3 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {logoUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>Replace Logo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRemoveModal(true)}
                    className="h-8 px-3 bg-white dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-zinc-600 hover:border-rose-200 dark:hover:border-rose-800 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State: Upload Dropzone */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20'
                  : 'border-slate-200 dark:border-zinc-700/80 hover:border-purple-400 dark:hover:border-purple-600 bg-slate-50/50 dark:bg-zinc-800/30'
              }`}
            >
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  {logoUploading ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-purple-600 dark:text-purple-400 hover:underline">
                    Click to upload logo
                  </span>{' '}
                  <span className="text-slate-500 dark:text-zinc-400">or drag and drop</span>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                  PNG, JPG/JPEG, WebP, or SVG (max. 5 MB)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Remove Logo Confirmation Modal */}
        {showRemoveModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <button
                  onClick={() => setShowRemoveModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Remove Business Logo?
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                  Are you sure you want to remove your business logo? This will remove the logo from your future quotations and invoices.
                  Previously saved documents will keep their existing snapshotted logo.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRemoveModal(false)}
                  className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRemoveLogo}
                  className="h-9 px-4 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20 transition-all cursor-pointer"
                >
                  Remove Logo
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Information Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 space-y-4 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span>Company Information</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Business / Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Tagline or Subtitle
                </label>
                <input
                  type="text"
                  value={formData.tagline || ''}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Contact / Owner Name
                </label>
                <input
                  type="text"
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  GST / VAT / Tax ID
                </label>
                <input
                  type="text"
                  value={formData.taxNumber || ''}
                  onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                  placeholder="32AABCE1234F1Z5"
                  className="h-10 w-full font-mono bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Office / Workshop Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Quotation Defaults Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 space-y-4 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <Percent className="w-4 h-4 text-blue-500" />
              <span>Document Defaults & Currency</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Default Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 text-xs font-semibold"
                >
                  {Object.keys(CURRENCY_SYMBOLS).map((c) => (
                    <option key={c} value={c}>
                      {c} ({CURRENCY_SYMBOLS[c]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Default Tax (GST / VAT %)
                </label>
                <input
                  type="number"
                  value={formData.defaultTaxPercentage}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultTaxPercentage: parseFloat(e.target.value) || 0 })
                  }
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Validity Period (Days)
                </label>
                <input
                  type="number"
                  value={formData.defaultValidityDays}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultValidityDays: parseInt(e.target.value, 10) || 15 })
                  }
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Default Payment Terms
                </label>
                <input
                  type="text"
                  value={formData.defaultPaymentTerms}
                  onChange={(e) => setFormData({ ...formData, defaultPaymentTerms: e.target.value })}
                  className="h-10 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  Terms & Conditions (Footer of PDF)
                </label>
                <textarea
                  rows={3}
                  value={formData.termsAndConditions}
                  onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
