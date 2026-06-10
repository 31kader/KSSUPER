import { useState, useEffect, useRef } from 'react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { rtdb, ref, get, child, rtdbQuery, orderByChild, startAt, auth, onValue } from '../database';
import { supabase, isSupabaseConfigured } from '../supabase';
import { 
  CompanySettings, Product, Category, Brand, Transaction, Promotion, Customer, Supplier, Employee,
  UserProfile, ProductReturn, PurchaseOrder, OnlineOrder, Purchase, InvoicePattern,
  StockAdjustment, Expense, InventoryAudit, SupplierSync, CashShift, AttendanceRecord,
  AdvanceRecord, SupplierPayment, AuditLog, DamagedRecord
} from '../types';

const parseFirestoreDate = (val: any): string => {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return new Date(val).toISOString();
  if (val && val.toDate && typeof val.toDate === 'function') {
    try { return val.toDate().toISOString(); } catch(e) { return new Date().toISOString(); }
  }
  if (val && val.seconds) {
    try { return new Date(val.seconds * 1000).toISOString(); } catch(e) { return new Date().toISOString(); }
  }
  return new Date().toISOString();
};

export const mapDoc = <T,>(d: any): T => {
  const data = d.data();
  const dateFields = ["timestamp", "createdAt", "updatedAt", "date", "openedAt", "closedAt", "checkIn", "checkOut", "lastVisit", "lastSync", "startDate", "endDate"];
  for (const field of dateFields) {
    if (data[field]) {
      data[field] = parseFirestoreDate(data[field]);
    }
  }
  return { id: d.id, ...data } as T;
};

export function useDataFetching(
  user: any,
  profile: any,
  appMode: string,
  currentSupplier: Supplier | null,
  currentCustomer: Customer | null,
  loading: boolean,
  playNotificationSound: () => void
) {
  const [settings, setSettings] = useState<CompanySettings>({
    name: 'NEXUS POS PRO',
    footerText: 'Merci de votre visite !',
    receiptTemplate: 'classic',
    labelTemplate: 'standard',
    labelOrientation: 'landscape',
    labelRotation: '0',
    labelWidthCustom: 60,
    labelHeightCustom: 40,
    currency: '€',
    taxRate: 20,
    loyaltyPointsPerCurrencyUnit: 1, 
    loyaltyPointValue: 0.01, 
    accountingFormat: 'csv',
    allowNegativeStock: true,
    closeGridOnSelect: false,
    enableVoiceGuidance: false,
    paperFormat: '80mm',
    silentPrinting: false,
    siteLocations: [],
    roleKPIs: {}
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [transactions, rawSetTransactions] = useState<Transaction[]>([]);
  const setTransactions = (txs: Transaction[] | ((prev: Transaction[]) => Transaction[])) => {
    rawSetTransactions(prev => {
      let incoming: Transaction[];
      if (typeof txs === 'function') {
        incoming = txs(prev);
      } else {
        incoming = txs;
      }

      let offlineTxs: Transaction[] = [];
      try {
        offlineTxs = JSON.parse(localStorage.getItem('nexus_offline_transactions') || '[]');
      } catch (err) {
        console.warn('Failed parsing local offline transactions', err);
      }

      const merged = [...offlineTxs, ...incoming];
      const uniqueMap = new Map<string, Transaction>();
      merged.forEach(t => {
        if (t && t.id) {
          uniqueMap.set(t.id, t);
        }
      });
      const unique = Array.from(uniqueMap.values());

      unique.sort((a, b) => {
        const d1 = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const d2 = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return d2 - d1;
      });

      return unique;
    });
  };
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [returns, setReturns] = useState<ProductReturn[]>([]);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [patterns, setPatterns] = useState<InvoicePattern[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [audits, setAudits] = useState<InventoryAudit[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [supplierSyncs, setSupplierSyncs] = useState<SupplierSync[]>([]);
  const [damagedItems, setDamagedItems] = useState<DamagedRecord[]>([]);

  const [shifts, setShifts] = useState<CashShift[]>([]);
  const [activeShift, setActiveShift] = useState<CashShift | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);

  const [isDataLoading, setIsDataLoading] = useState(true);

  const isFirstOrdersLoad = useRef(true);

  const fetchList = async (path: string) => {
    try {
      const snapshot = await get(child(ref(rtdb), path));
      if (!snapshot.exists()) return [];
      const data = snapshot.val();
      return Object.keys(data).map(id => ({ id, ...data[id] }));
    } catch (err: any) {
      if (err?.message?.includes('Quota') || err?.message?.includes('PERMISSION_DENIED') || err?.message?.includes('resource-exhausted')) {
        console.warn(`[Quota/Permission] Fetch fallback for ${path}`);
      } else {
        console.error(`Fetch failed for ${path}:`, err);
      }
      return [];
    }
  };

  // 1. Core Real-time Subscriptions and Offline Caching Listener
  useEffect(() => {
    if (loading) return;
    if (appMode !== 'price_checker' && !user) return;

    let isSubscribed = true;
    const unsubscribes: (() => void)[] = [];
    setIsDataLoading(true);

    const handleProductCacheUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Product>;
      if (customEvent.detail && customEvent.detail.id) {
        const updatedProduct = customEvent.detail;
        setProducts(prev => {
          const index = prev.findIndex(p => p.id === updatedProduct.id);
          let newProducts;
          if (index > -1) {
            newProducts = [...prev];
            newProducts[index] = { ...newProducts[index], ...updatedProduct };
          } else {
            newProducts = [updatedProduct, ...prev];
          }
          idbSet('nexus_products_cache', newProducts).catch(err => console.warn('[IDB Error]', err));
          return newProducts;
        });
      }
    };

    const handleProductCacheDelete = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>;
      if (customEvent.detail && customEvent.detail.id) {
        const idToDelete = customEvent.detail.id;
        setProducts(prev => {
          const newProducts = prev.filter(p => p.id !== idToDelete);
          idbSet('nexus_products_cache', newProducts).catch(err => console.warn('[IDB Error]', err));
          return newProducts;
        });
      }
    };

    const handleProductsBatchDelete = (e: Event) => {
      const customEvent = e as CustomEvent<{ ids: string[] }>;
      if (customEvent.detail && customEvent.detail.ids) {
        const idsToDelete = customEvent.detail.ids;
        setProducts(prev => {
          const newProducts = prev.filter(p => !idsToDelete.includes(p.id));
          idbSet('nexus_products_cache', newProducts).catch(err => console.warn('[IDB Error]', err));
          return newProducts;
        });
      }
    };

    window.addEventListener('product-cache-update', handleProductCacheUpdate);
    window.addEventListener('product-cache-delete', handleProductCacheDelete);
    window.addEventListener('products-batch-delete', handleProductsBatchDelete);

    try {
      const offlineTxs = JSON.parse(localStorage.getItem('nexus_offline_transactions') || '[]');
      if (offlineTxs.length > 0) {
        setTransactions(offlineTxs);
      }
    } catch (e) {
      console.warn("Failed to load local offline transactions", e);
    }

    const handleOfflineTxCreated = (e: Event) => {
      const customEvent = e as CustomEvent<Transaction>;
      if (customEvent.detail && isSubscribed) {
        setTransactions(prev => {
          const merged = [customEvent.detail, ...prev];
          const unique = Array.from(new Map(merged.map(t => [t.id, t])).values());
          return unique;
        });
      }
    };
    window.addEventListener('offline-transaction-created', handleOfflineTxCreated);

        const syncProducts = async () => {
          if (!isSubscribed) return;
          try {
            const cachedProducts = await idbGet<Product[]>('nexus_products_cache');
            if (cachedProducts && cachedProducts.length > 0 && isSubscribed) {
              setProducts(cachedProducts);
              setIsDataLoading(false);
            }
    
            // Removed redundant Supabase fetch loop here.
            // background sync in firebase.ts now handles initial product pulling
            // and triggers rtdb onValue updates which this hook listens to.
    
            const unsub = onValue(ref(rtdb, 'products'), (snapshot) => {
          if (isSubscribed) {
            if (snapshot.exists()) {
              const productsData = snapshot.val();
              if (productsData) {
                const updatedDocs = Object.keys(productsData).map(id => ({ id, ...productsData[id] } as Product));
                setProducts(updatedDocs);
                idbSet('nexus_products_cache', updatedDocs).catch(err => console.warn('[IDB Error]', err));
              } else {
                setProducts([]);
                idbSet('nexus_products_cache', []).catch(err => console.warn('[IDB Error]', err));
              }
            } else {
              setProducts([]);
              idbSet('nexus_products_cache', []).catch(err => console.warn('[IDB Error]', err));
            }
            setIsDataLoading(false);
          }
        });
        unsubscribes.push(unsub);
      } catch (err) {
        console.warn("Product sync failed:", err);
        if (isSubscribed) setIsDataLoading(false);
      }
    };

    syncProducts();

        const fetchAndCache = async <T,>(
          cacheKey: string,
          collectionName: string,
          setState: (data: T[]) => void
        ) => {
          try {
            const cached = await idbGet<T[]>(cacheKey);
            if (cached && cached.length > 0 && isSubscribed) {
              setState(cached);
            }
    
            // Redundant Supabase fetch logic removed here.
            // background sync handles the initial state pulling.
            
            const unsub = onValue(ref(rtdb, collectionName), (snapshot) => {
          if (isSubscribed) {
            if (snapshot.exists()) {
              const data = snapshot.val();
              if (data) {
                const docs = Object.keys(data).map(id => ({ id, ...data[id] } as T));
                setState(docs);
                idbSet(cacheKey, docs).catch(err => console.warn('[IDB Error]', err));
              } else {
                setState([]);
                idbSet(cacheKey, []).catch(err => console.warn('[IDB Error]', err));
              }
            } else {
              setState([]);
              idbSet(cacheKey, []).catch(err => console.warn('[IDB Error]', err));
            }
          }
        });
        unsubscribes.push(unsub);
      } catch (err: any) {
        const errMessage = err?.message || String(err);
        if (errMessage.includes('Quota') || errMessage.includes('PERMISSION_DENIED') || errMessage.includes('resource-exhausted')) {
          console.warn(`[Quota/Permission] Fetch fallback for ${collectionName}`);
        } else {
          console.error(`Fetch failed for ${collectionName}:`, err);
        }
      }
    };

    fetchAndCache<Promotion>('nexus_promotions', 'promotions', setPromotions);
    fetchAndCache<Customer>('nexus_customers', 'customers', setCustomers);
    fetchAndCache<Supplier>('nexus_suppliers', 'suppliers', setSuppliers);
    fetchAndCache<Category>('nexus_categories', 'categories', setCategories);
    fetchAndCache<Brand>('nexus_brands', 'brands', setBrands);
    fetchAndCache<UserProfile>('nexus_users', 'users', setUsers);

    if (appMode !== 'customer') {
      fetchAndCache<Transaction>('nexus_transactions_cache', 'transactions', setTransactions);
      fetchAndCache<Expense>('nexus_expenses_cache', 'expenses', setExpenses);
      fetchAndCache<StockAdjustment>('nexus_stock_adjustments_cache', 'stockAdjustments', setStockAdjustments);
      fetchAndCache<Purchase>('nexus_purchases_cache', 'purchases', setPurchases);
      fetchAndCache<any>('nexus_returns_cache', 'returns', setReturns);
      fetchAndCache<SupplierPayment>('nexus_supplier_payments_cache', 'supplierPayments', setSupplierPayments);
      fetchAndCache<DamagedRecord>('nexus_damaged_items_cache', 'damaged_items', setDamagedItems);
      fetchAndCache<AuditLog>('nexus_audit_logs_cache', 'audit_logs', setAuditLogs);
    }

    return () => {
      isSubscribed = false;
      unsubscribes.forEach(unsub => {
        try { unsub(); } catch(e) {}
      });
      window.removeEventListener('product-cache-update', handleProductCacheUpdate);
      window.removeEventListener('product-cache-delete', handleProductCacheDelete);
      window.removeEventListener('products-batch-delete', handleProductsBatchDelete);
      window.removeEventListener('offline-transaction-created', handleOfflineTxCreated);
    };
  }, [loading, appMode, user?.uid]);

  // 2. Fetch Static Admin Data (Settings, Employees, Patterns, Syncs)
  useEffect(() => {
    if (loading) return;
    if (appMode !== 'price_checker' && !user) return;

    let isSubscribed = true;

    const fetchStaticData = async () => {
      try {
        const [cachedEmployees] = await Promise.all([
          idbGet<Employee[]>('nexus_employees_cache')
        ]);

        if (cachedEmployees && isSubscribed) setEmployees(cachedEmployees);

        const [
          employeesSnap, patternsSnap, syncsSnap, settingsSnap
        ] = await Promise.all([
          get(child(ref(rtdb), 'employees')),
          profile?.role === 'admin' ? get(child(ref(rtdb), 'invoicePatterns')) : Promise.resolve({ exists: () => false } as any),
          profile?.role === 'admin' ? get(child(ref(rtdb), 'supplierSyncs')) : Promise.resolve({ exists: () => false } as any),
          get(child(ref(rtdb), 'settings/company'))
        ]);

        if (!isSubscribed) return;

        if (settingsSnap.exists()) setSettings(settingsSnap.val() as CompanySettings);

        const employeesData = employeesSnap.val();
        const employeesDocs = employeesData ? Object.keys(employeesData).map(id => ({ id, ...employeesData[id] } as Employee)) : [];
        setEmployees(employeesDocs);
        idbSet('nexus_employees_cache', employeesDocs);

        if (patternsSnap.exists()) {
             const patternsData = patternsSnap.val();
             setPatterns(Object.keys(patternsData).map(id => ({ id, ...patternsData[id] } as InvoicePattern)));
        }
        if (syncsSnap.exists()) {
             const syncsData = syncsSnap.val();
             setSupplierSyncs(Object.keys(syncsData).map(id => ({ id, ...syncsData[id] } as SupplierSync)));
        }
      } catch (err) {
        console.warn("Static data fetch failed:", err);
      }
    };

    fetchStaticData();

    return () => {
      isSubscribed = false;
    };
  }, [loading, appMode, user?.uid, profile?.role]);

  // 3. Consolidated Real-time Listeners for fast-changing data
  useEffect(() => {
    if (loading || !user) return;
    
    let isSubscribed = true;
    const listeners: (() => void)[] = [];

    const subscribe = (path: string, setter: (data: any) => void, extraAction?: (data: any) => void) => {
      const unsub = onValue(ref(rtdb, path), (snapshot) => {
        if (!isSubscribed) return;
        if (snapshot.exists()) {
          const val = snapshot.val();
          const docs = Object.keys(val).map(id => ({ id, ...val[id] }));
          setter(docs);
          if (extraAction) extraAction(docs);
        } else {
          setter([]);
          if (extraAction) extraAction([]);
        }
      }, (err) => {
        console.warn(`[RTDB Listen Error] ${path}:`, err);
      });
      listeners.push(unsub);
    };

    // Online Orders
    subscribe('onlineOrders', setOnlineOrders);

    // Shifts
    subscribe('shifts', (data) => {
      const docs = data as CashShift[];
      docs.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
      setShifts(docs);
      setActiveShift(docs.find(s => s.status === 'open') || null);
    });

    return () => {
      isSubscribed = false;
      listeners.forEach(unsub => { try { unsub(); } catch(e) {} });
    };
  }, [loading, user?.uid]);

  // 4. Fetch Purchase Orders for active supplier
  useEffect(() => {
    if (loading || !currentSupplier) return;

    let isSubscribed = true;
    let unsubPos: (() => void) | undefined;

    unsubPos = onValue(ref(rtdb, 'purchaseOrders'), (snapshot) => {
        if (isSubscribed) {
          if (snapshot.exists()) {
             const data = snapshot.val();
             const pos = Object.keys(data).map(id => ({ id, ...data[id] } as PurchaseOrder));
             setPurchaseOrders(pos.filter(po => po.supplierId === currentSupplier.id));
          } else {
             setPurchaseOrders([]);
          }
        }
    });

    return () => {
      isSubscribed = false;
      if (unsubPos) unsubPos();
    };
  }, [loading, currentSupplier?.id]);

  useEffect(() => {
    if (appMode !== 'customer' || !currentCustomer) return;
    
    let isSubscribed = true;
    let unsubTxs: (() => void) | undefined;
    
    unsubTxs = onValue(ref(rtdb, 'transactions'), (snapshot) => {
        if (isSubscribed) {
          if (snapshot.exists()) {
             const data = snapshot.val();
             const txs = Object.keys(data).map(id => ({ id, ...data[id] } as Transaction));
             setTransactions(txs.filter(t => t.customerId === currentCustomer.id));
          } else {
             setTransactions([]);
          }
        }
    });
        
    get(child(ref(rtdb), 'settings/company'))
        .then(snap => { if (snap.exists() && isSubscribed) setSettings(snap.val() as CompanySettings); })
        .catch((err: any) => {
            const msg = String(err?.message || err);
            if (msg.includes('Quota') || msg.includes('PERMISSION_DENIED') || msg.includes('resource-exhausted')) {
                console.warn("[Quota/Permission] Fetch fallback for company settings");
            } else {
                console.error("Error fetching settings", err);
            }
        });

    return () => {
        isSubscribed = false;
        if (unsubTxs) unsubTxs();
    };
  }, [appMode, currentCustomer]);

  return {
    settings, setSettings,
    products, setProducts,
    categories, setCategories,
    brands, setBrands,
    transactions, setTransactions,
    promotions, setPromotions,
    customers, setCustomers,
    suppliers, setSuppliers,
    employees, setEmployees,
    users, setUsers,
    purchaseOrders, setPurchaseOrders,
    returns, setReturns,
    onlineOrders, setOnlineOrders,
    purchases, setPurchases,
    patterns, setPatterns,
    stockAdjustments, setStockAdjustments,
    expenses, setExpenses,
    supplierPayments, setSupplierPayments,
    audits, setAudits,
    auditLogs, setAuditLogs,
    supplierSyncs, setSupplierSyncs,
    damagedItems, setDamagedItems,
    shifts, setShifts,
    activeShift, setActiveShift,
    attendance, setAttendance,
    advances, setAdvances,
    isDataLoading
  };
}
