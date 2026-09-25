'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  BusinessProfile,
  Customer,
  CatalogItem,
  Quotation,
  Invoice,
  QuotationStatus,
  UserAccount,
  TemplateStyle,
  Subscription,
  SubscriptionPlan,
} from '@/types';
import {
  DEFAULT_BUSINESS_PROFILE,
  INITIAL_CATALOG_ITEMS,
  INITIAL_CUSTOMERS,
  createBlankQuotation,
  createBlankInvoice,
} from '@/lib/initialData';
import { generateQuotationNumber, generateInvoiceNumber } from '@/lib/calculator';

export type AppView =
  | 'dashboard'
  | 'quotations'
  | 'invoices'
  | 'quotation_editor'
  | 'invoice_editor'
  | 'templates'
  | 'customers'
  | 'catalog'
  | 'profile'
  | 'billing'
  | 'pricing';

interface AppContextType {
  // Authentication & Public mode
  currentUser: UserAccount | null;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authMode: 'login' | 'signup';
  setAuthMode: (mode: 'login' | 'signup') => void;
  login: (email: string, name?: string, businessName?: string) => void;
  logout: () => void;
  isWorkspaceReady: boolean;

  // Navigation & View
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;

  // Subscription & Billing
  subscription: Subscription | null;
  isSuspended: boolean;
  plans: SubscriptionPlan[];
  isLoadingBilling: boolean;
  trialExpiredModalOpen: boolean;
  setTrialExpiredModalOpen: (open: boolean) => void;
  downloadLimitModalOpen: boolean;
  setDownloadLimitModalOpen: (open: boolean) => void;
  requestPdfDownload: (docType: 'quotation' | 'invoice', docId?: string) => Promise<boolean>;
  refreshSubscription: (userToFetch?: UserAccount | null) => Promise<void>;
  refreshPlans: () => Promise<void>;

  // Business Profile
  business: BusinessProfile;
  updateBusiness: (profile: Partial<BusinessProfile>) => void;

  // Customers & Catalog
  customers: Customer[];
  addCustomer: (cust: Omit<Customer, 'id' | 'createdAt'>) => Customer;
  updateCustomer: (id: string, cust: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  catalog: CatalogItem[];
  addCatalogItem: (item: Omit<CatalogItem, 'id'>) => CatalogItem;
  updateCatalogItem: (id: string, item: Partial<CatalogItem>) => void;
  deleteCatalogItem: (id: string) => void;

  // Quotation Management
  quotations: Quotation[];
  activeQuotation: Quotation | null;
  startNewQuotation: (template?: TemplateStyle, initialCustomer?: Customer) => void;
  editQuotation: (quotation: Quotation) => void;
  saveQuotation: (quotation: Quotation) => void;
  deleteQuotation: (id: string) => void;
  updateQuotationStatus: (id: string, status: QuotationStatus) => void;

  // Invoice Management
  invoices: Invoice[];
  activeInvoice: Invoice | null;
  startNewInvoice: (template?: TemplateStyle, fromQuotation?: Quotation, initialCustomer?: Customer) => void;
  editInvoice: (invoice: Invoice) => void;
  saveInvoice: (invoice: Invoice) => void;
  deleteInvoice: (id: string) => void;
  updateInvoiceStatus: (id: string, status: Invoice['status']) => void;
  convertQuotationToInvoice: (quotation: Quotation) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Auth & Session
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);

  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [business, setBusiness] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [catalog, setCatalog] = useState<CatalogItem[]>(INITIAL_CATALOG_ITEMS);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Active documents being edited
  const [activeQuotation, setActiveQuotation] = useState<Quotation | null>(null);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);

  // Billing & Subscriptions
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [trialExpiredModalOpen, setTrialExpiredModalOpen] = useState(false);
  const [downloadLimitModalOpen, setDownloadLimitModalOpen] = useState(false);

  const isSuspended =
    subscription?.status === 'SUSPENDED' || (currentUser as any)?.status === 'SUSPENDED';

  const requestPdfDownload = async (docType: 'quotation' | 'invoice', docId?: string): Promise<boolean> => {
    if (!currentUser) return true;
    if (isSuspended) {
      return false;
    }

    try {
      const res = await fetch('/api/billing/pdf-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          documentType: docType,
          documentId: docId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.allowed) {
        if (subscription) {
          setSubscription((prev) =>
            prev
              ? {
                  ...prev,
                  pdfDownloadLimit: data.pdfDownloadLimit ?? prev.pdfDownloadLimit,
                  pdfDownloadsUsed: data.pdfDownloadsUsed ?? ((prev.pdfDownloadsUsed || 0) + 1),
                  pdfDownloadsRemaining:
                    data.pdfDownloadsRemaining ??
                    Math.max(0, (prev.pdfDownloadLimit || 0) - ((prev.pdfDownloadsUsed || 0) + 1)),
                  trialPdfDownloads: data.trialPdfDownloads ?? data.pdfDownloadsUsed ?? prev.trialPdfDownloads,
                }
              : prev
          );
        }
        return true;
      } else {
        if (data.message && data.message.includes('suspended')) {
          refreshSubscription();
          return false;
        }
        if (subscription && data.pdfDownloadLimit !== undefined) {
          setSubscription((prev) =>
            prev
              ? {
                  ...prev,
                  pdfDownloadLimit: data.pdfDownloadLimit,
                  pdfDownloadsUsed: data.pdfDownloadsUsed,
                  pdfDownloadsRemaining: data.pdfDownloadsRemaining,
                  trialPdfDownloads: data.trialPdfDownloads,
                }
              : prev
          );
        }
        setDownloadLimitModalOpen(true);
        return false;
      }
    } catch (err) {
      console.error('Failed to verify PDF download limit:', err);
      return true;
    }
  };

  const refreshSubscription = async (userToFetch = currentUser) => {
    if (!userToFetch) {
      setSubscription(null);
      return;
    }
    try {
      setIsLoadingBilling(true);
      const res = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userToFetch.id,
          email: userToFetch.email,
          name: userToFetch.name,
          businessName: userToFetch.businessName,
        }),
      });
      const data = await res.json();
      if (data.subscription) {
        setSubscription(data.subscription);
      }
      if (data.isSuspended && currentUser) {
        setCurrentUser((prev) => (prev ? { ...prev, status: 'SUSPENDED' as any } : prev));
      }
    } catch (e) {
      console.error('Failed to sync subscription:', e);
    } finally {
      setIsLoadingBilling(false);
    }
  };

  const refreshPlans = async () => {
    try {
      const res = await fetch('/api/billing/plans');
      const data = await res.json();
      if (data.plans) setPlans(data.plans);
    } catch (e) {
      console.error('Failed to load plans:', e);
    }
  };

  useEffect(() => {
    refreshPlans();
  }, []);

  // Check existing session
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const sessionUser = localStorage.getItem('ew_session_user');
        if (sessionUser) {
          const parsed = JSON.parse(sessionUser);
          setCurrentUser(parsed);
          loadUserData(parsed.id, parsed.businessName);
          refreshSubscription(parsed);
        }
      }
    } catch (e) {
      console.error('Session load error:', e);
    } finally {
      setIsWorkspaceReady(true);
    }

    // Safety timeout ensuring workspace is ready within 300ms
    const timer = setTimeout(() => {
      setIsWorkspaceReady(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const loadUserData = (userId: string, defaultBizName?: string) => {
    try {
      const savedBiz = localStorage.getItem(`ew_biz_${userId}`);
      if (savedBiz) {
        setBusiness(JSON.parse(savedBiz));
      } else if (defaultBizName) {
        setBusiness({ ...DEFAULT_BUSINESS_PROFILE, businessName: defaultBizName, ownerName: currentUser?.name || 'Owner' });
      }

      const savedCust = localStorage.getItem(`ew_cust_${userId}`);
      if (savedCust) setCustomers(JSON.parse(savedCust));
      else setCustomers(INITIAL_CUSTOMERS);

      const savedCat = localStorage.getItem(`ew_cat_${userId}`);
      if (savedCat) setCatalog(JSON.parse(savedCat));
      else setCatalog(INITIAL_CATALOG_ITEMS);

      const savedQuotes = localStorage.getItem(`ew_quotes_${userId}`);
      if (savedQuotes) setQuotations(JSON.parse(savedQuotes));
      else setQuotations([]);

      const savedInvoices = localStorage.getItem(`ew_invoices_${userId}`);
      if (savedInvoices) setInvoices(JSON.parse(savedInvoices));
      else setInvoices([]);

      // Sync cloud documents
      fetch(`/api/documents?userId=${userId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            if (data.quotations && data.quotations.length > 0) {
              setQuotations(prev => (prev.length === 0 ? data.quotations : prev));
            }
            if (data.invoices && data.invoices.length > 0) {
              setInvoices(prev => (prev.length === 0 ? data.invoices : prev));
            }
          }
        })
        .catch(() => {});
    } catch (e) {
      console.error(e);
    }
  };

  // Save isolated user data whenever state updates
  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.id;
    try {
      localStorage.setItem(`ew_biz_${uid}`, JSON.stringify(business));
      localStorage.setItem(`ew_cust_${uid}`, JSON.stringify(customers));
      localStorage.setItem(`ew_cat_${uid}`, JSON.stringify(catalog));
      localStorage.setItem(`ew_quotes_${uid}`, JSON.stringify(quotations));
      localStorage.setItem(`ew_invoices_${uid}`, JSON.stringify(invoices));
    } catch (e) {
      // ignore
    }
  }, [currentUser, business, customers, catalog, quotations, invoices]);

  const login = (email: string, name?: string, businessName?: string) => {
    const user: UserAccount = {
      id: 'usr_' + btoa(email.toLowerCase()).replace(/=/g, '').slice(0, 10),
      email: email.trim(),
      name: name?.trim() || email.split('@')[0],
      businessName: businessName?.trim() || `${name || email.split('@')[0]}'s Business`,
      createdAt: new Date().toISOString(),
    };

    setCurrentUser(user);
    localStorage.setItem('ew_session_user', JSON.stringify(user));
    loadUserData(user.id, user.businessName);
    refreshSubscription(user);
    setAuthModalOpen(false);
    setCurrentView('dashboard');
  };

  const logout = () => {
    setCurrentUser(null);
    setSubscription(null);
    localStorage.removeItem('ew_session_user');
    setCurrentView('dashboard');
  };

  const updateBusiness = (profile: Partial<BusinessProfile>) => {
    setBusiness(prev => ({ ...prev, ...profile }));
  };

  // Customers
  const addCustomer = (cust: Omit<Customer, 'id' | 'createdAt'>): Customer => {
    const newCustomer: Customer = {
      ...cust,
      id: 'cust_' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    setCustomers(prev => [newCustomer, ...prev]);
    return newCustomer;
  };

  const updateCustomer = (id: string, cust: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...cust } : c));
  };

  const deleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  // Catalog
  const addCatalogItem = (item: Omit<CatalogItem, 'id'>): CatalogItem => {
    const newItem: CatalogItem = {
      ...item,
      id: 'item_' + Date.now(),
    };
    setCatalog(prev => [newItem, ...prev]);
    return newItem;
  };

  const updateCatalogItem = (id: string, item: Partial<CatalogItem>) => {
    setCatalog(prev => prev.map(i => i.id === id ? { ...i, ...item } : i));
  };

  const deleteCatalogItem = (id: string) => {
    setCatalog(prev => prev.filter(i => i.id !== id));
  };

  // Quotations
  const startNewQuotation = (template: TemplateStyle = 'modern', initialCustomer?: Customer) => {
    const newDraft = createBlankQuotation(business, template);
    newDraft.quotationNumber = generateQuotationNumber(quotations.length + 1);
    if (initialCustomer) {
      newDraft.customer = {
        id: initialCustomer.id,
        name: initialCustomer.name,
        company: initialCustomer.company || '',
        phone: initialCustomer.phone || '',
        email: initialCustomer.email || '',
        address: initialCustomer.address || '',
        taxNumber: initialCustomer.taxNumber || '',
      };
    }
    setActiveQuotation(newDraft);
    setCurrentView('quotation_editor');
  };

  const editQuotation = (quotation: Quotation) => {
    setActiveQuotation({ ...quotation });
    setCurrentView('quotation_editor');
  };

  const saveQuotation = (quotation: Quotation) => {
    // Auto-save customer if new name provided
    if (quotation.customer.name.trim()) {
      const exists = customers.some(
        c => c.name.toLowerCase() === quotation.customer.name.trim().toLowerCase()
      );
      if (!exists) {
        addCustomer({
          name: quotation.customer.name.trim(),
          company: quotation.customer.company?.trim(),
          phone: quotation.customer.phone?.trim(),
          email: quotation.customer.email?.trim(),
          address: quotation.customer.address?.trim(),
          taxNumber: quotation.customer.taxNumber?.trim(),
        });
      }
    }

    setQuotations(prev => {
      const exists = prev.some(q => q.id === quotation.id);
      if (exists) {
        return prev.map(q => (q.id === quotation.id ? quotation : q));
      }
      return [quotation, ...prev];
    });

    setActiveQuotation(quotation);

    if (currentUser?.id) {
      fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          type: 'quotation',
          document: quotation,
        }),
      }).catch(err => console.error('Document sync failed:', err));
    }
  };

  const deleteQuotation = (id: string) => {
    setQuotations(prev => prev.filter(q => q.id !== id));
    if (activeQuotation?.id === id) {
      setActiveQuotation(null);
    }
  };

  const updateQuotationStatus = (id: string, status: QuotationStatus) => {
    setQuotations(prev =>
      prev.map(q => (q.id === id ? { ...q, status, updatedAt: new Date().toISOString() } : q))
    );
  };

  // Invoices
  const startNewInvoice = (template: TemplateStyle = 'modern', fromQuotation?: Quotation, initialCustomer?: Customer) => {
    const newDraft = createBlankInvoice(business, template, fromQuotation);
    newDraft.invoiceNumber = generateInvoiceNumber(invoices.length + 1);
    if (initialCustomer) {
      newDraft.customer = {
        id: initialCustomer.id,
        name: initialCustomer.name,
        company: initialCustomer.company || '',
        phone: initialCustomer.phone || '',
        email: initialCustomer.email || '',
        address: initialCustomer.address || '',
        taxNumber: initialCustomer.taxNumber || '',
      };
    }
    setActiveInvoice(newDraft);
    setCurrentView('invoice_editor');
  };

  const editInvoice = (invoice: Invoice) => {
    setActiveInvoice({ ...invoice });
    setCurrentView('invoice_editor');
  };

  const saveInvoice = (invoice: Invoice) => {
    // Auto-save customer if new name provided
    if (invoice.customer.name.trim()) {
      const exists = customers.some(
        c => c.name.toLowerCase() === invoice.customer.name.trim().toLowerCase()
      );
      if (!exists) {
        addCustomer({
          name: invoice.customer.name.trim(),
          company: invoice.customer.company?.trim(),
          phone: invoice.customer.phone?.trim(),
          email: invoice.customer.email?.trim(),
          address: invoice.customer.address?.trim(),
          taxNumber: invoice.customer.taxNumber?.trim(),
        });
      }
    }

    setInvoices(prev => {
      const exists = prev.some(inv => inv.id === invoice.id);
      if (exists) {
        return prev.map(inv => (inv.id === invoice.id ? invoice : inv));
      }
      return [invoice, ...prev];
    });

    setActiveInvoice(invoice);

    if (currentUser?.id) {
      fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          type: 'invoice',
          document: invoice,
        }),
      }).catch(err => console.error('Document sync failed:', err));
    }
  };

  const deleteInvoice = (id: string) => {
    setInvoices(prev => prev.filter(inv => inv.id !== id));
    if (activeInvoice?.id === id) {
      setActiveInvoice(null);
    }
  };

  const updateInvoiceStatus = (id: string, status: Invoice['status']) => {
    setInvoices(prev =>
      prev.map(inv => (inv.id === id ? { ...inv, status, updatedAt: new Date().toISOString() } : inv))
    );
  };

  const convertQuotationToInvoice = (quotation: Quotation) => {
    startNewInvoice(quotation.template, quotation);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        authModalOpen,
        setAuthModalOpen,
        authMode,
        setAuthMode,
        login,
        logout,
        isWorkspaceReady,
        currentView,
        setCurrentView,
        mobileMenuOpen,
        setMobileMenuOpen,
        subscription,
        isSuspended,
        plans,
        isLoadingBilling,
        trialExpiredModalOpen,
        setTrialExpiredModalOpen,
        downloadLimitModalOpen,
        setDownloadLimitModalOpen,
        requestPdfDownload,
        refreshSubscription,
        refreshPlans,
        business,
        updateBusiness,
        customers,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        catalog,
        addCatalogItem,
        updateCatalogItem,
        deleteCatalogItem,
        quotations,
        activeQuotation,
        startNewQuotation,
        editQuotation,
        saveQuotation,
        deleteQuotation,
        updateQuotationStatus,
        invoices,
        activeInvoice,
        startNewInvoice,
        editInvoice,
        saveInvoice,
        deleteInvoice,
        updateInvoiceStatus,
        convertQuotationToInvoice,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
