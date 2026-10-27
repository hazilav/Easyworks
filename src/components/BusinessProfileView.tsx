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
  Sparkles,
  Wand2,
  RotateCcw,
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
  const [loadingProfile, setLoadingProfile] = useState(!business.logoUrl && Boolean(currentUser?.id));

  // Load saved profile & logo directly on mount to guarantee fresh persistence after refresh
  useEffect(() => {
    if (!currentUser?.id) return;
    let isMounted = true;

    fetch(`/api/business/profile?userId=${encodeURIComponent(currentUser.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data && data.success && data.profile) {
          const p = data.profile;
          updateBusiness(p);
          setFormData((prev) => ({
            ...prev,
            ...p,
            logoUrl: p.logoUrl && p.logoUrl.trim().length > 0 ? p.logoUrl : prev.logoUrl,
            logoOriginalUrl: p.logoOriginalUrl && p.logoOriginalUrl.trim().length > 0 ? p.logoOriginalUrl : (prev.logoOriginalUrl || prev.logoUrl),
            logoProcessedUrl: p.logoProcessedUrl && p.logoProcessedUrl.trim().length > 0 ? p.logoProcessedUrl : (prev.logoProcessedUrl || prev.logoUrl),
            logoBackgroundMode: p.logoBackgroundMode || prev.logoBackgroundMode || 'transparent',
            logoEnabled: p.logoEnabled !== undefined ? p.logoEnabled : prev.logoEnabled,
            logoEnabledQuotations: p.logoEnabledQuotations !== undefined ? p.logoEnabledQuotations : (p.logoEnabled ?? prev.logoEnabledQuotations),
            logoEnabledInvoices: p.logoEnabledInvoices !== undefined ? p.logoEnabledInvoices : (p.logoEnabled ?? prev.logoEnabledInvoices),
          }));
        }
      })
      .catch((err) => console.error('[BusinessProfileView] Error loading profile:', err))
      .finally(() => {
        if (isMounted) setLoadingProfile(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    updateBusiness(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);

    if (currentUser?.id) {
      try {
        await fetch('/api/business/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            ...formData,
          }),
        });
      } catch (err) {
        console.error('Failed to save business profile to server:', err);
      }
    }
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
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('userId', currentUser?.id || '');
      uploadData.append('logoEnabled', String(formData.logoEnabled ?? true));
      uploadData.append('logoEnabledQuotations', String(formData.logoEnabledQuotations ?? true));
      uploadData.append('logoEnabledInvoices', String(formData.logoEnabledInvoices ?? true));

      const res = await fetch('/api/business/logo', {
        method: 'POST',
        body: uploadData,
      });

      const resData = await res.json();
      if (!resData.success) {
        setLogoError(resData.error || 'Failed to process logo.');
        setLogoUploading(false);
        return;
      }

      const quotesEnabled = formData.logoEnabledQuotations ?? formData.logoEnabled ?? true;
      const invoicesEnabled = formData.logoEnabledInvoices ?? formData.logoEnabled ?? true;

      const updated = {
        ...formData,
        logoUrl: resData.logoUrl,
        logoOriginalUrl: resData.logoOriginalUrl,
        logoProcessedUrl: resData.logoProcessedUrl,
        logoBackgroundMode: resData.logoBackgroundMode || 'transparent',
        logoEnabled: true,
        logoEnabledQuotations: quotesEnabled,
        logoEnabledInvoices: invoicesEnabled,
      };

      setFormData(updated);
      updateBusiness(updated);

      if (resData.processedDimensions) {
        setLogoDimensions(resData.processedDimensions);
      }

      setLogoUploading(false);
    } catch (err: any) {
      console.error('Error uploading logo:', err);
      setLogoError(err?.message || 'Error processing image.');
      setLogoUploading(false);
    }
  };

  const handleSelectBackgroundMode = async (mode: 'transparent' | 'original') => {
    const targetUrl = mode === 'original'
      ? (formData.logoOriginalUrl || formData.logoUrl)
      : (formData.logoProcessedUrl || formData.logoUrl);

    const updated = {
      ...formData,
      logoUrl: targetUrl,
      logoBackgroundMode: mode,
    };
    setFormData(updated);
    updateBusiness(updated);

    if (currentUser?.id) {
      try {
        await fetch('/api/business/logo', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            mode,
          }),
        });
      } catch (err) {
        console.error('Failed to change logo background mode:', err);
      }
    }
  };

  const handleResetToOriginal = async () => {
    if (!formData.logoOriginalUrl) return;
    const updated = {
      ...formData,
      logoUrl: formData.logoOriginalUrl,
      logoBackgroundMode: 'original' as const,
    };
    setFormData(updated);
    updateBusiness(updated);

    if (currentUser?.id) {
      try {
        await fetch('/api/business/logo', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            resetToOriginal: true,
          }),
        });
      } catch (err) {
        console.error('Failed to reset logo:', err);
      }
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

  const handleToggleQuotationsLogo = async () => {
    const currentVal = formData.logoEnabledQuotations ?? formData.logoEnabled ?? true;
    const newEnabled = !currentVal;
    const updated = { ...formData, logoEnabledQuotations: newEnabled };
    setFormData(updated);
    updateBusiness(updated);

    if (currentUser?.id) {
      try {
        await fetch('/api/business/logo', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            target: 'quotations',
            enabled: newEnabled,
          }),
        });
      } catch (err) {
        console.error('Failed to update quotations logo visibility on server:', err);
      }
    }
  };

  const handleToggleInvoicesLogo = async () => {
    const currentVal = formData.logoEnabledInvoices ?? formData.logoEnabled ?? true;
    const newEnabled = !currentVal;
    const updated = { ...formData, logoEnabledInvoices: newEnabled };
    setFormData(updated);
    updateBusiness(updated);

    if (currentUser?.id) {
      try {
        await fetch('/api/business/logo', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            target: 'invoices',
            enabled: newEnabled,
          }),
        });
      } catch (err) {
        console.error('Failed to update invoices logo visibility on server:', err);
      }
    }
  };

  const handleConfirmRemoveLogo = async () => {
    setShowRemoveModal(false);
    setLogoDimensions(null);
    setLogoError(null);

    const updated = {
      ...formData,
      logoUrl: '',
      logoOriginalUrl: '',
      logoProcessedUrl: '',
      logoEnabled: false,
    };
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
  const isQuotesLogoEnabled = formData.logoEnabledQuotations ?? formData.logoEnabled ?? true;
  const isInvoicesLogoEnabled = formData.logoEnabledInvoices ?? formData.logoEnabled ?? true;

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
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                    isQuotesLogoEnabled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                  }`}
                >
                  Quotes: {isQuotesLogoEnabled ? 'ON' : 'OFF'}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                    isInvoicesLogoEnabled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                  }`}
                >
                  Invoices: {isInvoicesLogoEnabled ? 'ON' : 'OFF'}
                </span>
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

          {loadingProfile && !hasLogo ? (
            <div className="h-44 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 flex flex-col items-center justify-center p-6 bg-slate-50/50 dark:bg-zinc-950/30">
              <RefreshCw className="w-6 h-6 text-purple-600 animate-spin mb-2" />
              <p className="text-xs text-slate-500 dark:text-zinc-400">Loading saved business logo...</p>
            </div>
          ) : hasLogo ? (
            /* Logo Uploaded State: Preview & Controls */
            <div className="space-y-5">
              {/* Sizing & Background Optimization Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-purple-50/60 dark:bg-purple-950/20 p-3 rounded-xl border border-purple-100 dark:border-purple-900/40">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span className="text-xs font-semibold text-purple-950 dark:text-purple-200">
                    Automatic Background Removal & Best-Fit Sizing
                  </span>
                </div>
                <span className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                  Optimized for 150 × 65 px header space
                </span>
              </div>

              {/* Side-by-Side Before / After Previews */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Processed Transparent Logo */}
                <div
                  onClick={() => handleSelectBackgroundMode('transparent')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                    (formData.logoBackgroundMode ?? 'transparent') === 'transparent'
                      ? 'bg-white dark:bg-zinc-900 border-purple-500 shadow-sm ring-2 ring-purple-500/20'
                      : 'bg-slate-50/70 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-700/60 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-purple-500" />
                      <span>Transparent (Background Removed)</span>
                    </span>
                    {(formData.logoBackgroundMode ?? 'transparent') === 'transparent' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                        Active in Docs
                      </span>
                    )}
                  </div>

                  {/* Frame with checkerboard transparency grid */}
                  <div className="h-28 rounded-lg bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 flex items-center justify-center p-3 relative overflow-hidden bg-[radial-gradient(#cbd5e1_1.5px,transparent_1.5px)] [background-size:12px_12px] dark:bg-[radial-gradient(#3f3f46_1.5px,transparent_1.5px)]">
                    <img
                      src={formData.logoProcessedUrl || formData.logoUrl}
                      alt="Transparent Processed Logo"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                    <span>Edges smoothed & padding trimmed</span>
                    <button
                      type="button"
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                        (formData.logoBackgroundMode ?? 'transparent') === 'transparent'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-600'
                      }`}
                    >
                      {(formData.logoBackgroundMode ?? 'transparent') === 'transparent' ? 'Selected' : 'Use Transparent'}
                    </button>
                  </div>
                </div>

                {/* 2. Original Upload */}
                <div
                  onClick={() => handleSelectBackgroundMode('original')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                    formData.logoBackgroundMode === 'original'
                      ? 'bg-white dark:bg-zinc-900 border-purple-500 shadow-sm ring-2 ring-purple-500/20'
                      : 'bg-slate-50/70 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-700/60 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                      <span>Original Upload (Keeps Background)</span>
                    </span>
                    {formData.logoBackgroundMode === 'original' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                        Active in Docs
                      </span>
                    )}
                  </div>

                  {/* Frame showing original */}
                  <div className="h-28 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 flex items-center justify-center p-3 overflow-hidden shadow-2xs">
                    <img
                      src={formData.logoOriginalUrl || formData.logoUrl}
                      alt="Original Logo Upload"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                    <span>Unmodified source file</span>
                    <button
                      type="button"
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                        formData.logoBackgroundMode === 'original'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-600'
                      }`}
                    >
                      {formData.logoBackgroundMode === 'original' ? 'Selected' : 'Use Original'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/60">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    Active Logo:
                  </span>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                    {(formData.logoBackgroundMode ?? 'transparent') === 'transparent'
                      ? 'Transparent PNG'
                      : 'Original Background'}
                  </span>
                  {logoDimensions && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300">
                      {logoDimensions.width} × {logoDimensions.height} px
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={logoUploading}
                    className="h-8 px-3 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {logoUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>Replace Logo</span>
                  </button>

                  {formData.logoOriginalUrl && formData.logoBackgroundMode !== 'original' && (
                    <button
                      type="button"
                      onClick={handleResetToOriginal}
                      className="h-8 px-3 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Reset to original upload with background"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset to Original</span>
                    </button>
                  )}

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

              {/* Independent Document Controls */}
              <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-zinc-800/30 border border-slate-200 dark:border-zinc-700/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/60 dark:border-zinc-700/60 pb-2.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                    Document Visibility Controls
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Control logo appearance separately for each document type
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Quotations Control */}
                  <div className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                    isQuotesLogoEnabled
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-white dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-700/60'
                  }`}>
                    <div className="space-y-0.5 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">Quotations</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                          isQuotesLogoEnabled
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400'
                        }`}>
                          {isQuotesLogoEnabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Show logo on quotation drafts, previews & PDFs
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleQuotationsLogo}
                      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${
                        isQuotesLogoEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-700'
                      }`}
                      aria-label="Toggle logo on quotations"
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                          isQuotesLogoEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Invoices Control */}
                  <div className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                    isInvoicesLogoEnabled
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-white dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-700/60'
                  }`}>
                    <div className="space-y-0.5 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">Invoices</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                          isInvoicesLogoEnabled
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400'
                        }`}>
                          {isInvoicesLogoEnabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Show logo on invoice drafts, previews & PDFs
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleInvoicesLogo}
                      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${
                        isInvoicesLogoEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-700'
                      }`}
                      aria-label="Toggle logo on invoices"
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                          isInvoicesLogoEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
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
