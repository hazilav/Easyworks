'use client';

import React, { useState, useEffect } from 'react';
import {
  Mail,
  Server,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Send,
  Lock,
  CreditCard,
  Save,
  Check,
} from 'lucide-react';
import { safeFetchJson } from '@/lib/api/client';
import { PaymentSettings } from '@/types';

interface EmailSettingsState {
  provider: 'smtp' | 'resend' | 'sendgrid';
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  senderEmail: string;
  senderName: string;
  isActive: boolean;
}

interface TestEmailResult {
  connection: 'Connected' | 'Failed';
  send: 'Accepted' | 'Failed' | 'Not Attempted';
  error?: string | null;
  messageId?: string | null;
  recipient?: string;
  timestamp?: string;
}

export default function DeveloperSettingsView() {
  const [activeSubTab, setActiveSubTab] = useState<'email' | 'payments' | 'security'>('email');

  // Email Configuration State
  const [emailSettings, setEmailSettings] = useState<EmailSettingsState>({
    provider: 'smtp',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpSecure: false,
    senderEmail: '',
    senderName: 'Easyworks',
    isActive: true,
  });
  const [emailSource, setEmailSource] = useState<'database' | 'environment' | 'none'>('none');
  const [isConfigured, setIsConfigured] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState('');

  // Email Test State
  const [testRecipient, setTestRecipient] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testResult, setTestResult] = useState<TestEmailResult | null>(null);

  // Payment Settings State
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    id: 'default',
    upiId: '',
    qrCodeUrl: '',
    bankAccountName: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBranch: '',
    whatsappNumber: '',
    updatedAt: '',
  });
  const [savingPayments, setSavingPayments] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState('');

  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchEmailSettings();
    fetchPaymentSettings();
  }, []);

  const getAuthToken = () => {
    return typeof window !== 'undefined' ? localStorage.getItem('ew_developer_token') || '' : '';
  };

  const fetchEmailSettings = async () => {
    try {
      setLoadingEmail(true);
      const token = getAuthToken();
      const { data } = await safeFetchJson<{
        success?: boolean;
        settings?: any;
        activeConfig?: any;
      }>('/api/developer/email/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data?.success && data.settings) {
        setEmailSettings({
          provider: data.settings.provider || 'smtp',
          smtpHost: data.settings.smtpHost || '',
          smtpPort: data.settings.smtpPort || 587,
          smtpUser: data.settings.smtpUser || '',
          smtpPass: data.settings.smtpPass || '',
          smtpSecure: Boolean(data.settings.smtpSecure),
          senderEmail: data.settings.senderEmail || '',
          senderName: data.settings.senderName || 'Easyworks',
          isActive: data.settings.isActive ?? true,
        });
      }

      if (data?.activeConfig) {
        setEmailSource(data.activeConfig.source || 'none');
        setIsConfigured(Boolean(data.activeConfig.isConfigured));
      }
    } catch (err) {
      console.error('Failed to load email settings:', err);
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleSaveEmailSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingEmail(true);
      setEmailSuccessMsg('');
      const token = getAuthToken();

      const { ok, data, error } = await safeFetchJson<{ success?: boolean; message?: string; error?: string }>(
        '/api/developer/email/settings',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(emailSettings),
        }
      );

      if (ok && data?.success) {
        setEmailSuccessMsg('Email configuration saved successfully.');
        fetchEmailSettings();
        setTimeout(() => setEmailSuccessMsg(''), 4000);
      } else {
        alert(data?.error || error || 'Failed to save email settings');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving email settings');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      setTestResult(null);
      const token = getAuthToken();

      const { data } = await safeFetchJson<{
        success?: boolean;
        connection: 'Connected' | 'Failed';
        send: 'Not Attempted';
        error?: string | null;
      }>('/api/developer/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'test_connection' }),
      });

      setTestResult({
        connection: data?.connection || 'Failed',
        send: 'Not Attempted',
        error: data?.error,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setTestResult({
        connection: 'Failed',
        send: 'Not Attempted',
        error: err.message || 'Failed to test SMTP connection',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient || !testRecipient.includes('@')) {
      alert('Please enter a valid destination email address for the test.');
      return;
    }

    try {
      setSendingTestEmail(true);
      setTestResult(null);
      const token = getAuthToken();

      const { data } = await safeFetchJson<{
        success?: boolean;
        connection: 'Connected' | 'Failed';
        send: 'Accepted' | 'Failed';
        error?: string | null;
        messageId?: string | null;
        recipient?: string;
      }>('/api/developer/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'send', testEmail: testRecipient }),
      });

      setTestResult({
        connection: data?.connection || 'Failed',
        send: data?.send || 'Failed',
        error: data?.error,
        messageId: data?.messageId,
        recipient: testRecipient,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setTestResult({
        connection: 'Connected',
        send: 'Failed',
        error: err.message || 'Error dispatching test email',
        recipient: testRecipient,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const fetchPaymentSettings = async () => {
    try {
      const token = getAuthToken();
      const { data } = await safeFetchJson<{ success?: boolean; paymentSettings?: PaymentSettings }>(
        '/api/developer/settings',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data?.success && data.paymentSettings) {
        setPaymentSettings(data.paymentSettings);
      }
    } catch (err) {
      console.error('Failed to load payment settings:', err);
    }
  };

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingPayments(true);
      setPaymentSuccessMsg('');
      const token = getAuthToken();

      const { ok, data, error } = await safeFetchJson<{ success?: boolean; message?: string; error?: string }>(
        '/api/developer/settings',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ type: 'PAYMENT_SETTINGS', paymentSettings }),
        }
      );

      if (ok && data?.success) {
        setPaymentSuccessMsg('Payment settings updated.');
        setTimeout(() => setPaymentSuccessMsg(''), 4000);
      } else {
        alert(data?.error || error || 'Failed to update payment settings');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating payment settings');
    } finally {
      setSavingPayments(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    try {
      setSavingPassword(true);
      setPasswordMsg(null);
      const token = getAuthToken();

      const { ok, data, error } = await safeFetchJson<{ success?: boolean; message?: string; error?: string }>(
        '/api/developer/settings',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ type: 'CHANGE_PASSWORD', newPassword }),
        }
      );

      if (ok && data?.success) {
        setPasswordMsg({ type: 'success', text: 'Super Admin password updated successfully.' });
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMsg({ type: 'error', text: data?.error || error || 'Failed to update password' });
      }
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Error updating password' });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19] overflow-y-auto">
      {/* Header */}
      <div className="p-6 md:p-8 border-b border-zinc-800/80 bg-[#0e131f]/60 backdrop-blur-sm shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Server className="w-6 h-6 text-blue-500" />
              <span>System & Gateway Settings</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Production email infrastructure, direct UPI/Bank settings, and Super Admin security.
            </p>
          </div>

          {/* Sub-tab navigation */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-xl self-start md:self-auto">
            <button
              onClick={() => setActiveSubTab('email')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'email'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email & OTP</span>
            </button>
            <button
              onClick={() => setActiveSubTab('payments')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'payments'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Payment Details</span>
            </button>
            <button
              onClick={() => setActiveSubTab('security')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'security'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Security</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 md:p-8 space-y-8 max-w-5xl">
        {/* ============================================================= */}
        {/* SUBTAB 1: EMAIL & OTP SYSTEM (Requirement 2 & 9) */}
        {/* ============================================================= */}
        {activeSubTab === 'email' && (
          <div className="space-y-6">
            {/* Status Card */}
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isConfigured
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Email Provider Configuration</h3>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        isConfigured
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {isConfigured ? 'CONFIGURED' : 'CREDENTIALS MISSING'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Source:{' '}
                    <span className="font-semibold text-zinc-300">
                      {emailSource === 'database'
                        ? 'Database Settings'
                        : emailSource === 'environment'
                        ? 'Environment Variables (.env)'
                        : 'None (Configure below)'}
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="px-3.5 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl border border-zinc-700 transition-colors flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                <span>{testingConnection ? 'Testing Connection...' : 'Test Connection'}</span>
              </button>
            </div>

            {/* Diagnostic Results Box (Requirement 9) */}
            {testResult && (
              <div className="p-5 rounded-2xl bg-[#0e131f] border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    <span>Email Diagnostic Results</span>
                  </h4>
                  <span className="text-[11px] text-zinc-500 font-mono">{testResult.timestamp}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                    <span className="text-[11px] text-zinc-400 block font-medium">Email provider connection:</span>
                    <span
                      className={`text-sm font-bold flex items-center gap-1.5 mt-1 ${
                        testResult.connection === 'Connected' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {testResult.connection === 'Connected' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      <span>{testResult.connection}</span>
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                    <span className="text-[11px] text-zinc-400 block font-medium">Email send:</span>
                    <span
                      className={`text-sm font-bold flex items-center gap-1.5 mt-1 ${
                        testResult.send === 'Accepted'
                          ? 'text-emerald-400'
                          : testResult.send === 'Failed'
                          ? 'text-red-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {testResult.send === 'Accepted' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : testResult.send === 'Failed' ? (
                        <XCircle className="w-4 h-4" />
                      ) : null}
                      <span>{testResult.send}</span>
                    </span>
                  </div>
                </div>

                {testResult.error && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-xs text-red-300">
                    <span className="font-bold">Error message:</span> {testResult.error}
                  </div>
                )}

                {testResult.messageId && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/30 text-[11px] font-mono text-emerald-300">
                    Message accepted by provider. ID: {testResult.messageId}
                  </div>
                )}
              </div>
            )}

            {/* Send Test Email Card (Requirement 9) */}
            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-4">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Developer Email Test</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Dispatch an outbound test email to verify that your mail provider accepts and successfully delivers messages.
                Credentials and security tokens are strictly kept confidential.
              </p>

              <form onSubmit={handleSendTestEmail} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="Enter recipient email (e.g. test@yourdomain.com)"
                  className="flex-1 h-11 px-4 rounded-xl bg-[#0b0f19] border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={sendingTestEmail}
                  className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${sendingTestEmail ? 'animate-spin' : ''}`} />
                  <span>{sendingTestEmail ? 'Sending Test Email...' : 'Send Test Email'}</span>
                </button>
              </form>
            </div>

            {/* SMTP Settings Form */}
            <form onSubmit={handleSaveEmailSettings} className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">SMTP & Provider Credentials</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Configure Gmail, SendGrid, Resend, Amazon SES, or custom SMTP server details.
                  </p>
                </div>
                {emailSuccessMsg && (
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1 rounded-lg">
                    <Check className="w-3.5 h-3.5" />
                    <span>{emailSuccessMsg}</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    SMTP Host *
                  </label>
                  <input
                    type="text"
                    required
                    value={emailSettings.smtpHost}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
                    placeholder="e.g. smtp.gmail.com or smtp.resend.com"
                    className="w-full h-10 px-3.5 rounded-xl bg-[#0b0f19] border border-zinc-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    SMTP Port *
                  </label>
                  <input
                    type="number"
                    required
                    value={emailSettings.smtpPort}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: parseInt(e.target.value, 10) || 587 })}
                    placeholder="587 (TLS) or 465 (SSL)"
                    className="w-full h-10 px-3.5 rounded-xl bg-[#0b0f19] border border-zinc-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    SMTP Username / Email *
                  </label>
                  <input
                    type="text"
                    required
                    value={emailSettings.smtpUser}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
                    placeholder="e.g. your-email@gmail.com"
                    className="w-full h-10 px-3.5 rounded-xl bg-[#0b0f19] border border-zinc-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    SMTP Password / App Key *
                  </label>
                  <input
                    type="password"
                    value={emailSettings.smtpPass}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpPass: e.target.value })}
                    placeholder="Leave unchanged or enter new app password"
                    className="w-full h-10 px-3.5 rounded-xl bg-[#0b0f19] border border-zinc-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Sender Email Address
                  </label>
                  <input
                    type="email"
                    value={emailSettings.senderEmail}
                    onChange={(e) => setEmailSettings({ ...emailSettings, senderEmail: e.target.value })}
                    placeholder="e.g. no-reply@easyworks.com"
                    className="w-full h-10 px-3.5 rounded-xl bg-[#0b0f19] border border-zinc-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Sender Display Name
                  </label>
                  <input
                    type="text"
                    value={emailSettings.senderName}
                    onChange={(e) => setEmailSettings({ ...emailSettings, senderName: e.target.value })}
                    placeholder="Easyworks"
                    className="w-full h-10 px-3.5 rounded-xl bg-[#0b0f19] border border-zinc-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={emailSettings.smtpSecure}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpSecure: e.target.checked })}
                    className="rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-0"
                  />
                  <span>Use SSL/TLS (Enable for port 465, disable for STARTTLS port 587)</span>
                </label>

                <button
                  type="submit"
                  disabled={savingEmail}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingEmail ? 'Saving...' : 'Save Configuration'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================= */}
        {/* SUBTAB 2: PAYMENT SETTINGS */}
        {/* ============================================================= */}
        {activeSubTab === 'payments' && (
          <form onSubmit={handleSavePaymentSettings} className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Manual Payment Details (Indiranagar HDFC / UPI)</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Displayed to clients during subscription checkout when paying via UPI or Direct IMPS/NEFT.
                </p>
              </div>
              {paymentSuccessMsg && (
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1 rounded-lg">
                  <Check className="w-3.5 h-3.5" />
                  <span>{paymentSuccessMsg}</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Official UPI ID</label>
                <input
                  type="text"
                  value={paymentSettings.upiId}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, upiId: e.target.value })}
                  placeholder="e.g. 9539933265@naviaxis"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#0b0f19] border border-zinc-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Bank Name</label>
                <input
                  type="text"
                  value={paymentSettings.bankName}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, bankName: e.target.value })}
                  placeholder="HDFC Bank"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#0b0f19] border border-zinc-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Bank Account Name</label>
                <input
                  type="text"
                  value={paymentSettings.bankAccountName}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, bankAccountName: e.target.value })}
                  placeholder="Easyworks Solutions Private Limited"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#0b0f19] border border-zinc-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Bank Account Number</label>
                <input
                  type="text"
                  value={paymentSettings.bankAccountNumber}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, bankAccountNumber: e.target.value })}
                  placeholder="50200088991122"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#0b0f19] border border-zinc-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Bank IFSC Code</label>
                <input
                  type="text"
                  value={paymentSettings.bankIfsc}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, bankIfsc: e.target.value })}
                  placeholder="HDFC0001234"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#0b0f19] border border-zinc-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Bank Branch</label>
                <input
                  type="text"
                  value={paymentSettings.bankBranch}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, bankBranch: e.target.value })}
                  placeholder="Indiranagar Branch, Bengaluru"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#0b0f19] border border-zinc-700 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <button
                type="submit"
                disabled={savingPayments}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingPayments ? 'Saving...' : 'Save Payment Details'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ============================================================= */}
        {/* SUBTAB 3: SUPER ADMIN PASSWORD */}
        {/* ============================================================= */}
        {activeSubTab === 'security' && (
          <form onSubmit={handleChangePassword} className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-6 max-w-lg">
            <div>
              <h3 className="text-sm font-bold text-white">Change Super Admin Password</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Update the master clearance credentials for Developer Panel access.
              </p>
            </div>

            {passwordMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  passwordMsg.type === 'success'
                    ? 'bg-emerald-950/40 border border-emerald-800/40 text-emerald-300'
                    : 'bg-red-950/40 border border-red-800/40 text-red-300'
                }`}
              >
                {passwordMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">New Password *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#0b0f19] border border-zinc-700 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#0b0f19] border border-zinc-700 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <button
                type="submit"
                disabled={savingPassword}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{savingPassword ? 'Updating...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
