import { supabase, isSupabaseConfigured } from './supabase';
import bcrypt from 'bcryptjs';
import { toast } from 'sonner';

export const firestoreDb = null;

// Helper for generating standard matching IDs
function generateLocalId() {
  return Math.random().toString(36).substring(2, 10);
}

// Convert camelCase keys to snake_case for Supabase PostgreSQL
function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Convert snake_case keys back to camelCase for the React frontend
function snakeToCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertKeysToSnake(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToSnake);
  } else if (typeof obj === 'object') {
    // Keep raw files, dates or JSON strings untouched
    if (obj instanceof Date) return obj.toISOString();
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[camelToSnakeCase(key)] = convertKeysToSnake(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

function convertKeysToCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamel);
  } else if (typeof obj === 'object') {
    if (obj instanceof Date) return obj;
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[snakeToCamelCase(key)] = convertKeysToCamel(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

// List of standard tables with explicit columns, to filter out unmatched client keys
const TABLE_COLUMNS: Record<string, string[]> = {
  categories: ['id', 'name', 'parent_id', 'level', 'image_url'],
  brands: ['id', 'name', 'logo_url', 'description', 'created_at'],
  products: [
    'id', 'name', 'barcode', 'sku', 'reference', 'image_url', 'image_urls', 
    'price', 'online_price', 'cost_price', 'wholesale_price', 'tax_rate', 
    'stock', 'min_stock', 'category_id', 'brand_id', 'supplier', 'unit', 
    'status', 'description', 'is_bundle', 'bundle_items', 'quantity_discounts', 
    'tags', 'expiration_date', 'batch_number', 'location', 'show_in_pos', 
    'damaged_stock', 'created_at', 'updated_at'
  ],
  customers: [
    'id', 'name', 'phone', 'email', 'loyalty_points', 'balance', 'loyalty_card_number', 
    'total_spent', 'last_visit', 'notes', 'is_app_user', 'password_hash', 'join_date', 
    'favorite_items', 'alerts', 'cashier_notes', 'updated_at'
  ],
  transactions: [
    'id', 'total', 'payment_method', 'delivery_method', 'timestamp', 'user_id', 
    'customer_id', 'customer_name', 'status', 'employee_id', 'employee_name', 
    'promotion_id', 'points_earned', 'discount_amount', 'points_discount', 
    'balance_used', 'voucher_discount', 'is_wholesale', 'online_order_id', 'items'
  ],
  employees: [
    'id', 'name', 'role', 'phone', 'email', 'hire_date', 'status', 'is_clocked_in', 
    'base_salary', 'salary_type', 'hourly_rate', 'daily_rate', 
    'id_card_recto_url', 'id_card_verso_url', 'contract_url', 'digital_signature_url'
  ],
  attendance: [
    'id', 'employee_id', 'employee_name', 'clock_in', 'clock_out', 'date', 
    'total_hours', 'status'
  ],
  cash_shifts: [
    'id', 'opened_at', 'closed_at', 'opened_by', 'closed_by', 'initial_cash', 
    'final_cash', 'expected_cash', 'total_sales', 'total_cash_sales', 
    'total_card_sales', 'total_expenses', 'status', 'notes'
  ],
  shifts: [
    'id', 'opened_at', 'closed_at', 'opened_by', 'closed_by', 'initial_cash', 
    'final_cash', 'expected_cash', 'total_sales', 'total_cash_sales', 
    'total_card_sales', 'total_expenses', 'status', 'notes'
  ],
  vouchers: [
    'id', 'code', 'type', 'value', 'current_balance', 'min_purchase', 'expiry_date', 
    'status', 'customer_id', 'customer_name', 'notes', 'created_at', 'usage_logs'
  ],
  expenses: [
    'id', 'description', 'amount', 'category', 'date', 'user_id', 'payment_method'
  ],
  suppliers: [
    'id', 'name', 'contact_name', 'phone', 'email', 'address', 'categories', 
    'feed_url', 'feed_format', 'last_sync', 'sync_enabled', 'is_app_user', 
    'has_full_inventory_access', 'password_hash', 'balance', 'pre_sale_days', 
    'delivery_days', 'payment_days', 'planning_notes', 'updated_at'
  ],
  users: [
    'id', 'uid', 'email', 'display_name', 'password_hash', 'role', 'join_date'
  ]
};

function preparePayload(table: string, id: string, data: any) {
  const payload = { id, ...data };
  
  const allowed = TABLE_COLUMNS[table];
  if (allowed && allowed.includes('password_hash')) {
    const hasHash = (payload as any).passwordHash || (payload as any).password_hash || payload.password_hash;
    const hasPlain = payload.password || (payload as any).password;
    
    if (hasHash && hasHash !== '') {
      payload.password_hash = hasHash;
    } else if (hasPlain && hasPlain !== '') {
      // If it is already a bcrypt hash, preserve it as-is
      if (typeof hasPlain === 'string' && (hasPlain.startsWith('$2a$') || hasPlain.startsWith('$2b$') || hasPlain.startsWith('$2y$'))) {
        payload.password_hash = hasPlain;
      } else {
        // Hashing plain-text passwords specifically prior to saving
        try {
          payload.password_hash = bcrypt.hashSync(hasPlain, 10);
        } catch (_) {
          payload.password_hash = hasPlain;
        }
      }
    }
  }

  const snakePayload = convertKeysToSnake(payload);
  
  const cleanValueForPostgres = (key: string, val: any) => {
    // 1. Handle missing, null, or undefined values with database-appropriate fallbacks
    if (val === "" || val === undefined || val === null) {
      if (key === 'name') return 'Sans nom';
      if (key === 'unit') return 'pcs';
      if (key === 'status') return 'active';
      if (key === 'level') return 1;

      // Numeric columns that are NOT NULL with DEFAULT 0 in SQL
      const nonNullableNumerics = [
        'price', 'cost_price', 'tax_rate', 'stock', 'min_stock', 
        'amount', 'total', 'points_earned', 'discount_amount', 
        'points_discount', 'balance_used', 'voucher_discount',
        'value', 'current_balance', 'min_purchase', 'loyalty_points', 'balance'
      ];
      if (nonNullableNumerics.includes(key)) {
        return 0;
      }

      // Foreign key reference columns
      if (key === 'category_id') {
        return 'uncategorized';
      }

      return null;
    }

    // 2. Format columns that PostgreSQL / Supabase expects as actual ARRAYS (TEXT[])
    const arrayKeys = ['tags', 'image_urls', 'categories', 'pre_sale_days', 'delivery_days', 'payment_days'];
    if (arrayKeys.includes(key)) {
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch (_) {}
        return val.trim() ? val.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      }
      if (!Array.isArray(val)) {
        return [];
      }
      return val.filter(Boolean);
    }

    // 3. Format columns that PostgreSQL / Supabase expects as actual BOOLEANS
    const booleanKeys = ['is_bundle', 'show_in_pos', 'is_app_user', 'is_clocked_in', 'sync_enabled', 'has_full_inventory_access'];
    if (booleanKeys.includes(key)) {
      return !!val;
    }

    // 4. Ensure number type for numeric postgres columns
    const numericKeys = [
      'price', 'online_price', 'cost_price', 'wholesale_price', 'tax_rate', 
      'stock', 'min_stock', 'damaged_stock', 'total', 'amount', 'balance', 
      'loyalty_points', 'total_spent', 'expected_cash', 'final_cash', 
      'initial_cash', 'total_sales', 'total_expenses', 'level', 'points_earned',
      'discount_amount', 'points_discount', 'balance_used', 'voucher_discount', 'value', 'current_balance', 'min_purchase'
    ];
    if (numericKeys.includes(key)) {
      let parsedNum: number;
      if (typeof val === 'string') {
        parsedNum = parseFloat(val.replace(',', '.').replace(/[^\d.-]/g, ''));
      } else {
        parsedNum = Number(val);
      }
      return isNaN(parsedNum) ? 0 : parsedNum;
    }

    // 5. Handle DATE columns (Standardize to YYYY-MM-DD to avoid time-zone/format mismatch)
    const dateKeys = ['expiration_date', 'date', 'hire_date', 'join_date', 'expiry_date', 'last_visit'];
    if (dateKeys.includes(key)) {
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      } catch (_) {}
      return null;
    }

    // 6. Handle JSONB fields
    const jsonKeys = ['bundle_items', 'quantity_discounts', 'usage_logs', 'items', 'alerts', 'favorite_items', 'usage_logs'];
    if (jsonKeys.includes(key)) {
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (_) { return null; }
      }
      return val || null;
    }

    return val;
  };

  if (allowed) {
    const filtered: any = {};
    for (const key of allowed) {
      if (snakePayload[key] !== undefined) {
         filtered[key] = cleanValueForPostgres(key, snakePayload[key]);
      }
    }
    return filtered;
  }
  
  const result = { ...snakePayload };
  for (const key of Object.keys(result)) {
    result[key] = cleanValueForPostgres(key, result[key]);
  }
  return result;
}

// ----------------- unified local storage DB bridge -----------------
interface EmulatedDB {
  [table: string]: {
    [id: string]: any;
  };
}

let dbState: EmulatedDB = {};

import { get as getIDB, set as setIDB } from 'idb-keyval';

// Optimized state persistence using IndexedDB (idb-keyval) to bypass the 5MB localStorage limit
let saveStorageTimeout: any = null;
async function saveStateToStorage() {
  if (saveStorageTimeout) clearTimeout(saveStorageTimeout);
  saveStorageTimeout = setTimeout(async () => {
    try {
      await setIDB('nexus_supabase_emulator_db_v2', dbState);
    } catch (e) {
      console.warn('[Supabase Emulator] Failed to save state to IndexedDB', e);
      // Fallback to localStorage for critical small data if needed, but IDB is preferred
    }
  }, 200);
}

// Load on startup - Asynchronous load from IndexedDB
async function loadInitialState() {
  try {
    const stored = await getIDB('nexus_supabase_emulator_db_v2');
    if (stored) {
      dbState = stored;
      // Trigger all base observers to refresh UI with cached data
      Object.keys(dbState).forEach(triggerObservers);
    } else {
      // Legacy fallback check for localStorage if first time migrating
      const legacy = localStorage.getItem('nexus_supabase_emulator_db');
      if (legacy) {
        dbState = JSON.parse(legacy);
        await setIDB('nexus_supabase_emulator_db_v2', dbState);
        localStorage.removeItem('nexus_supabase_emulator_db');
        Object.keys(dbState).forEach(triggerObservers);
      }
    }
  } catch (e) {
    console.warn('[Supabase Emulator] Failed to parse local state cache', e);
  }
}

loadInitialState();

function parsePath(path: string) {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const parts = clean.split('/');
  const table = parts[0];
  const id = parts.slice(1).join('/');
  return { table, id };
}

function getLocalValue(path: string): any {
  const { table, id } = parsePath(path);
  if (!table) return null;
  if (!dbState[table]) return null;
  if (id) {
    return dbState[table][id] || null;
  }
  return dbState[table];
}

function setLocalValue(path: string, value: any) {
  const { table, id } = parsePath(path);
  if (!table) return;
  
  if (!dbState[table]) {
    dbState[table] = {};
  }
  
  if (id) {
    dbState[table][id] = value;
  } else {
    // Overwrite the full collection dictionary
    dbState[table] = value || {};
  }
  
  persistAndTrigger(table, id, value);
}

function updateLocalValue(path: string, value: any) {
  const { table, id } = parsePath(path);
  if (!table) return;
  
  if (!dbState[table]) {
    dbState[table] = {};
  }
  
  if (id) {
    const existing = dbState[table][id] || {};
    dbState[table][id] = { ...existing, ...value };
  } else {
    dbState[table] = { ...dbState[table], ...value };
  }
  
  persistAndTrigger(table, id, getLocalValue(path));
}

function removeLocalValue(path: string) {
  const { table, id } = parsePath(path);
  if (!table) return;
  
  if (id) {
    if (dbState[table]) {
      delete dbState[table][id];
    }
  } else {
    delete dbState[table];
  }
  
  persistAndTrigger(table, id, null, true);
}

// Global path observers list
const observers: Record<string, ((snapshot: any) => void)[]> = {};

function triggerObservers(path: string) {
  if (observers[path]) {
    const val = getLocalValue(path);
    observers[path].forEach(cb => {
      try {
        cb({
          exists: () => val !== undefined && val !== null,
          val: () => val
        });
      } catch (err) {
        console.warn('Observer callback error:', err);
      }
    });
  }
}

function handleSupabaseError(table: string, actionType: 'Upsert' | 'Delete' | 'Fallback', error: any) {
  if (!error) return;
  const message = error.message || '';
  const code = error.code || '';
  
  if (message.includes("Could not find the table") || code === '42P01' || (message.includes("relation") && message.includes("does not exist")) || message.includes("schema cache")) {
    console.info(`[Supabase Sync Schema Info] Table "${table}" is not created in Supabase yet. Local storage emulator database is active for this table.`);
    if (typeof window !== 'undefined') {
      try {
        toast.error(`La table "${table}" n'existe pas dans Supabase. Veuillez la créer via l'onglet Vérificateur de connexion.`);
      } catch (e) {}
    }
  } else if (message.includes("violates row-level security policy") || code === '42501' || message.includes("row-level security")) {
    console.info(`[Supabase RLS Policy Info] Table "${table}" relies on Row-Level Security policies. The current session has local persistence enabled as fallback.`);
    if (typeof window !== 'undefined') {
      try {
        toast.warning(`[Supabase RLS] L'enregistrement sur "${table}" a échoué car le Row Level Security (RLS) bloque l'écriture. Désactivez RLS ou ajoutez une règle d'accès public.`);
      } catch (e) {}
    }
  } else {
    console.warn(`[Supabase ${actionType} Issue] ${table}: ${message}`, error.details || '');
    if (typeof window !== 'undefined') {
      try {
        toast.error(`Erreur de synchronisation Cloud pour ${actionType === 'Delete' ? 'la suppression de' : "l'enregistrement de"} "${table}": ${message}`);
      } catch (e) {}
    }
  }
}

// Persists local change and updates Supabase if configured
function persistAndTrigger(table: string, id: string | null, value: any, isDelete = false) {
  // Update browser cache in background
  saveStateToStorage();
  
  // Notify observers
  triggerObservers(table);
  if (id) {
    triggerObservers(`${table}/${id}`);
  }
  
  // Realtime Supabase Persist write
  const mappedTable = table === 'shifts' ? 'cash_shifts' : table;
  if (isSupabaseConfigured && TABLE_COLUMNS[mappedTable]) {
    if (isDelete) {
      if (id) {
        supabase.from(mappedTable).delete().eq('id', id).then(({ error }) => {
          if (error) handleSupabaseError(mappedTable, 'Delete', error);
        });
      } else {
        // En cas de suppression complète de la table locale (ex: suppression massive de tous les produits)
        supabase.from(mappedTable).delete().neq('id', 'none_placeholder_delete_all').then(({ error }) => {
          if (error) handleSupabaseError(mappedTable, 'Delete', error);
        });
      }
    } else if (id) {
      const payload = preparePayload(mappedTable, id, value);
      
      if (mappedTable === 'products') {
        const catId = payload.category_id;
        if (!catId) {
          const categoriesDict = dbState['categories'] || {};
          let firstCatId = Object.keys(categoriesDict)[0];
          
          if (!firstCatId) {
            firstCatId = 'uncategorized';
            if (!dbState['categories']) dbState['categories'] = {};
            dbState['categories'][firstCatId] = {
              id: firstCatId,
              name: 'Sans catégorie',
              level: 1
            };
            saveStateToStorage();
            triggerObservers('categories');
            triggerObservers(`categories/${firstCatId}`);
          }
          
          // Seed default category first to prevent constraint violations
          const catPayload = preparePayload('categories', firstCatId, dbState['categories'][firstCatId]);
          supabase.from('categories').upsert(catPayload, { onConflict: 'id' }).then(({ error: catErr }) => {
            if (catErr) {
              handleSupabaseError('categories', 'Fallback', catErr);
            }
            payload.category_id = firstCatId;
            supabase.from('products').upsert(payload, { onConflict: 'id' }).then(({ error }) => {
              if (error) handleSupabaseError('products', 'Fallback', error);
            });
          });
          return;
        }
      }
      
      supabase.from(mappedTable).upsert(payload, { onConflict: 'id' }).then(({ error }) => {
        if (error) handleSupabaseError(mappedTable, 'Upsert', error);
      });
    }
  }
}

// ----------------- Supabase Realtime "V8 Turbo" Sync -----------------
let isTurboSubscriptionActive = false;

export function enableTurboSync() {
  if (!isSupabaseConfigured || isTurboSubscriptionActive) return;
  
  console.log("[V8 Turbo Mode] Activating Realtime synchronization across all tables...");
  
  const uniqueMappedTables = Array.from(new Set(
    Object.keys(TABLE_COLUMNS).map(table => table === 'shifts' ? 'cash_shifts' : table)
  ));
  
  uniqueMappedTables.forEach(mappedTable => {
    supabase
      .channel(`public:${mappedTable}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: mappedTable }, (payload) => {
        console.log(`[V8 Turbo] Realtime ${payload.eventType} on mapped table ${mappedTable}:`, payload.new || payload.old);
        
        // Find which tables in dbState correspond to this mappedTable
        const targetTables = Object.keys(TABLE_COLUMNS).filter(table => {
          const m = table === 'shifts' ? 'cash_shifts' : table;
          return m === mappedTable;
        });

        targetTables.forEach(table => {
          if (payload.eventType === 'DELETE') {
            const oldData = convertKeysToCamel(payload.old);
            if (oldData.id) {
              if (dbState[table]) delete dbState[table][oldData.id];
              triggerObservers(table);
              triggerObservers(`${table}/${oldData.id}`);
            }
          } else {
            const newData = convertKeysToCamel(payload.new);
            if (newData.id) {
              if (!dbState[table]) dbState[table] = {};
              dbState[table][newData.id] = newData;
              triggerObservers(table);
              triggerObservers(`${table}/${newData.id}`);
            }
          }
        });
        
        // Sync to localStorage
        saveStateToStorage();
      })
      .subscribe();
  });
  
  isTurboSubscriptionActive = true;
}

// ----------------- Supabase Background Prefetch loop -----------------
export const syncStatus = {
  active: false,
  progress: 0,
  totalTables: Object.keys(TABLE_COLUMNS).length,
  completedTables: 0,
  currentTable: '',
  observers: [] as ((status: any) => void)[]
};

function triggerSyncUpdate() {
  syncStatus.observers.forEach(cb => cb({ ...syncStatus }));
}

export function onSyncUpdate(callback: (status: any) => void) {
  syncStatus.observers.push(callback);
  callback({ ...syncStatus });
  return () => {
    syncStatus.observers = syncStatus.observers.filter(cb => cb !== callback);
  };
}

export async function initAndSyncSupabase() {
  if (!isSupabaseConfigured) return;
  
  syncStatus.active = true;
  syncStatus.progress = 0;
  syncStatus.completedTables = 0;
  triggerSyncUpdate();

  console.log("[Supabase Sync] Starting table prefetch optimization...");
  
  // Enable Realtime Turbo Sync immediately
  enableTurboSync();
  
  const tables = Object.keys(TABLE_COLUMNS);
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    syncStatus.currentTable = table;
    triggerSyncUpdate();
    try {
      const mappedTable = table === 'shifts' ? 'cash_shifts' : table;
      let allData: any[] = [];
      let fromIdx = 0;
      const pageSize = 1000;
      let hasMore = true;
      let fetchError: any = null;

      while (hasMore) {
        const toIdx = fromIdx + pageSize - 1;
        try {
          // Optimisation: Utilisation de jointures pour charger les données liées
          // Comme suggéré (p.ex: transactions avec clients) pour éviter les requêtes N+1
          const selectStr = table === 'transactions' ? '*, clients(*)' : '*';
          
          const { data, error } = await supabase
            .from(mappedTable)
            .select(selectStr)
            .range(fromIdx, toIdx);

          if (error) {
            console.warn(`[Supabase Sync Warning] Error reading table "${mappedTable}" at page ${fromIdx}-${toIdx}:`, error);
            fetchError = error;
            hasMore = false;
          } else if (data) {
            allData = allData.concat(data);
            if (data.length < pageSize) {
              hasMore = false;
            } else {
              fromIdx += pageSize;
              // Update progress within a large table if needed, but simple counter is usually enough
            }
          } else {
            hasMore = false;
          }
        } catch (e: any) {
          console.warn(`[Supabase Sync Warning] Failed to fetch page for "${mappedTable}" at ${fromIdx}-${toIdx}:`, e?.message || e);
          fetchError = e;
          hasMore = false;
        }
      }

      if (fetchError && allData.length === 0) {
        // Only report if we got no data at all
        if (fetchError.message?.includes("Could not find the table") || fetchError.code === '42P01') {
          console.info(`[Supabase Sync Schema Info] Table "${mappedTable}" is not created in Supabase yet. Local storage emulator database is active for this table.`);
        } else {
          console.warn(`[Supabase Sync Warning] Error reading table "${mappedTable}":`, fetchError.message || fetchError);
        }
      } else {
         // Remplacement complet par les données fraîches de Supabase pour propager les suppressions
         const cloudData: Record<string, any> = {};
         allData.forEach((row: any) => {
           const camelRow = convertKeysToCamel(row);
           if (camelRow.id) {
              cloudData[camelRow.id] = camelRow;
           }
         });
         dbState[table] = cloudData;
         triggerObservers(table);
      }
    } catch (e: any) {
      console.warn(`[Supabase Prefetch Fallback] Could not pull table ${table}:`, e?.message || e);
    }
    syncStatus.completedTables++;
    syncStatus.progress = Math.round((syncStatus.completedTables / syncStatus.totalTables) * 100);
    triggerSyncUpdate();
  }
  syncStatus.active = false;
  syncStatus.progress = 100;
  triggerSyncUpdate();
  saveStateToStorage();
}

// Start async cloud pulling
initAndSyncSupabase().catch(err => console.warn('[Supabase Sync Loop Errored]', err));

// ----------------- Firestore Background Prefetch loop (Removed) -----------------
export async function initAndSyncFirestore() {
  console.log("[Firestore Sync] Disabled - Using pure Local Storage and Supabase.");
}

// ----------------- Firebase Dummy Interfaces & Emulation -----------------

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  providerData: { email: string | null; [key: string]: any }[];
  isOffline?: boolean;
  getIdToken?: () => Promise<string>;
  [key: string]: any;
}

class AuthEmulator {
  currentUser: User | null = null;
  private listeners: ((user: User | null) => void)[] = [];

  constructor() {
    const stored = localStorage.getItem('nexus_auth_user');
    if (stored) {
      try {
        this.currentUser = JSON.parse(stored);
      } catch (e) {}
    }
  }

  onAuthStateChanged(callback: (user: User | null) => void) {
    this.listeners.push(callback);
    setTimeout(() => callback(this.currentUser), 0);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  trigger(user: User | null) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem('nexus_auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('nexus_auth_user');
    }
    this.listeners.forEach(cb => cb(user));
  }
}

export const auth = new AuthEmulator();

// Watch for Supabase specific changes if credentials exist
if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      const firebaseUser: User = {
        uid: session.user.id,
        email: session.user.email || null,
        displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || null,
        providerData: [{ email: session.user.email || null }]
      };
      auth.trigger(firebaseUser);
    } else {
      auth.trigger(null);
    }
  });
}

export const db = { type: 'firestore_mock' };
export const rtdb = { type: 'rtdb_mock' };

export class GoogleAuthProvider {}
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.warn(`[Supabase Emulator / Handled] Warning on path ${path} during ${operationType} operation: ${error}`);
}

// Firestore Emulator Functions
export function collection(dbRef: any, path: string) {
  return { path };
}

export function doc(dbRef: any, collectionName: string, id: string) {
  return { path: `${collectionName}/${id}` };
}

export function where(field: string, op: string, val: any) {
  return { type: 'where', field, op, val };
}

export function firestoreQuery(refObj: any, ...constraints: any[]) {
  return { ...refObj, constraints };
}

export function orderBy(field: string, direction = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(n: number) {
  return { type: 'limit', n };
}

export function startAfter(...values: any[]) {
  return { type: 'startAfter', values };
}

export async function setDoc(docRef: any, data: any, options?: any) {
  setLocalValue(docRef.path, data);
}

export async function addDoc(collectionRef: any, data: any) {
  const newId = generateLocalId();
  const path = `${collectionRef.path}/${newId}`;
  setLocalValue(path, { ...data, id: newId });
  return { id: newId };
}

export async function updateDoc(docRef: any, data: any) {
  updateLocalValue(docRef.path, data);
}

export async function deleteDoc(docRef: any) {
  removeLocalValue(docRef.path);
}

export async function getDoc(docRef: any) {
  const val = getLocalValue(docRef.path);
  return {
    id: docRef.path.split('/').pop() || '',
    exists: () => val !== undefined && val !== null,
    data: () => val
  };
}

export async function getDocs(queryRef: any): Promise<any> {
  const collectionPath = queryRef.path;
  const val = getLocalValue(collectionPath) || {};
  let docs = Object.keys(val).map(id => {
    return {
      id,
      exists: () => true,
      data: () => val[id]
    };
  });

  if (queryRef.constraints) {
    for (const filter of queryRef.constraints) {
      if (filter.type === 'where') {
        const { field, op, val: filterVal } = filter;
        docs = docs.filter(doc => {
          const docData = doc.data() || {};
          const docVal = docData[field];
          if (op === '==' || op === '===') return docVal === filterVal;
          if (op === '!=') return docVal !== filterVal;
          if (op === '>') return docVal > filterVal;
          if (op === '>=') return docVal >= filterVal;
          if (op === '<') return docVal < filterVal;
          if (op === '<=') return docVal <= filterVal;
          if (op === 'array-contains') return Array.isArray(docVal) && docVal.includes(filterVal);
          return true;
        });
      }
    }
  }

  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (callback: (doc: any) => void) => docs.forEach(callback)
  };
}

export function onSnapshot(refObj: any, callback: (snapshot: any) => void) {
  const path = refObj.path;
  return onValue({ path }, (rtdbSnap: any) => {
    callback({
      id: path.split('/').pop() || '',
      exists: () => rtdbSnap.exists(),
      data: () => rtdbSnap.val()
    });
  });
}

// RTDB Emulator Functions
export function ref(rtdbInstance: any, path = '') {
  return { path };
}

export function child(parentRef: any, path: string) {
  const parentPath = parentRef.path || '';
  const childPath = path || '';
  return { path: parentPath ? `${parentPath}/${childPath}` : childPath };
}

export function push(refObj: any, value?: any) {
  const newKey = generateLocalId();
  const childPath = refObj.path ? `${refObj.path}/${newKey}` : newKey;
  const childRef = { path: childPath, key: newKey };
  if (value !== undefined) {
    setLocalValue(childPath, value);
  }
  return childRef;
}

export async function set(refObj: any, value: any) {
  setLocalValue(refObj.path, value);
}

export async function update(refObj: any, value: any) {
  const basePath = refObj.path || '';
  const updates: Record<string, any> = {};
  
  if (value && typeof value === 'object') {
    let hasSlashKeys = false;
    for (const key of Object.keys(value)) {
      if (key.includes('/')) {
        hasSlashKeys = true;
        break;
      }
    }
    
    if (basePath === '' || hasSlashKeys) {
      for (const [key, val] of Object.entries(value)) {
        const fullPath = basePath ? `${basePath}/${key}` : key;
        updates[fullPath] = val;
      }
    } else {
      updates[basePath] = value;
    }
  } else {
    updates[basePath] = value;
  }
  
  const tablesChanged = new Set<string>();
  const supabaseUpserts: Record<string, { id: string; value: any }[]> = {};
  const tablesDeleted: Record<string, string[]> = {};

  for (const [fullPath, val] of Object.entries(updates)) {
    const cleanPath = fullPath.replace(/^\/+|\/+$/g, '');
    const parts = cleanPath.split('/');
    const table = parts[0];
    
    if (!table) continue;
    
    tablesChanged.add(table);
    
    if (!dbState[table]) {
      dbState[table] = {};
    }
    
    if (parts.length === 1) {
      dbState[table] = { ...dbState[table], ...val };
      triggerObservers(table);
    } else if (parts.length === 2) {
      const id = parts[1];
      const existing = dbState[table][id] || {};
      
      if (val === null) {
        delete dbState[table][id];
        if (!tablesDeleted[table]) tablesDeleted[table] = [];
        tablesDeleted[table].push(id);
        triggerObservers(`${table}/${id}`);
      } else {
        dbState[table][id] = { ...existing, ...val };
        if (!supabaseUpserts[table]) supabaseUpserts[table] = [];
        supabaseUpserts[table].push({ id, value: dbState[table][id] });
        triggerObservers(`${table}/${id}`);
      }
    } else {
      const id = parts[1];
      const remainingParts = parts.slice(2);
      
      if (!dbState[table][id]) {
        dbState[table][id] = {};
      }
      
      let current = dbState[table][id];
      for (let i = 0; i < remainingParts.length - 1; i++) {
        const part = remainingParts[i];
        if (typeof current[part] !== 'object' || current[part] === null) {
          current[part] = {};
        }
        current = current[part];
      }
      
      const lastKey = remainingParts[remainingParts.length - 1];
      current[lastKey] = val;
      
      if (!supabaseUpserts[table]) supabaseUpserts[table] = [];
      supabaseUpserts[table].push({ id, value: dbState[table][id] });
      triggerObservers(`${table}/${id}`);
    }
  }

  // 1. Single localStorage write for ALL updates in this batch (debounced, asynchronous, non-blocking)
  saveStateToStorage();

  // 2. Trigger table-level observers for all changed tables
  for (const table of tablesChanged) {
    triggerObservers(table);
  }

  // 3. Batch upserts to Supabase to bypass the "connection storm" and too-many-requests limits
  for (const [table, items] of Object.entries(supabaseUpserts)) {
    const mappedTable = table === 'shifts' ? 'cash_shifts' : table;
    if (isSupabaseConfigured && TABLE_COLUMNS[mappedTable]) {
      const payloads: any[] = [];
      
      if (mappedTable === 'products') {
        const productsNeedCat = items.filter(it => !it.value.category_id && !it.value.categoryId);
        if (productsNeedCat.length > 0) {
          const categoriesDict = dbState['categories'] || {};
          let firstCatId = Object.keys(categoriesDict)[0];
          if (!firstCatId) {
            firstCatId = 'uncategorized';
            if (!dbState['categories']) dbState['categories'] = {};
            dbState['categories'][firstCatId] = {
              id: firstCatId,
              name: 'Sans catégorie',
              level: 1
            };
            saveStateToStorage();
            triggerObservers('categories');
            triggerObservers(`categories/${firstCatId}`);
          }
          
          const catPayload = preparePayload('categories', firstCatId, dbState['categories'][firstCatId]);
          await supabase.from('categories').upsert(catPayload, { onConflict: 'id' }).then(({ error }) => {
            if (error) handleSupabaseError('categories', 'Fallback', error);
          });
          
          for (const item of items) {
            if (!item.value.category_id && !item.value.categoryId) {
              item.value.category_id = firstCatId;
              item.value.categoryId = firstCatId;
            }
          }
        }
      }

      for (const item of items) {
        payloads.push(preparePayload(mappedTable, item.id, item.value));
      }

      if (payloads.length > 0) {
        const chunkSize = 150;
        for (let j = 0; j < payloads.length; j += chunkSize) {
          const chunk = payloads.slice(j, j + chunkSize);
          supabase.from(mappedTable).upsert(chunk, { onConflict: 'id' }).then(({ error }) => {
            if (error) handleSupabaseError(mappedTable, 'Upsert', error);
          });
        }
      }
    }
  }

  // 4. Batch deletes to Supabase
  for (const [table, ids] of Object.entries(tablesDeleted)) {
    const mappedTable = table === 'shifts' ? 'cash_shifts' : table;
    if (isSupabaseConfigured && TABLE_COLUMNS[mappedTable] && ids.length > 0) {
      const chunkSize = 150;
      for (let j = 0; j < ids.length; j += chunkSize) {
        const chunk = ids.slice(j, j + chunkSize);
        supabase.from(mappedTable).delete().in('id', chunk).then(({ error }) => {
          if (error) handleSupabaseError(mappedTable, 'Delete', error);
        });
      }
    }
  }
}

export async function get(refObj: any) {
  const val = getLocalValue(refObj.path);
  return {
    exists: () => val !== undefined && val !== null,
    val: () => val
  };
}

export async function remove(refObj: any) {
  removeLocalValue(refObj.path);
}

export function onValue(refObj: any, callback: (snapshot: any) => void, cancelCallback?: (error: any) => void) {
  const path = refObj.path;
  if (!observers[path]) {
    observers[path] = [];
  }
  observers[path].push(callback);
  
  const val = getLocalValue(path);
  setTimeout(() => {
    callback({
      exists: () => val !== undefined && val !== null,
      val: () => val
    });
  }, 0);

  return () => {
    observers[path] = observers[path].filter(cb => cb !== callback);
  };
}

export function rtdbQuery(refObj: any, ...constraints: any[]) {
  return { ...refObj, constraints };
}

export function orderByChild(field: string) {
  return { type: 'orderByChild', field };
}

export function equalTo(val: any) {
  return { type: 'equalTo', val };
}

export function startAt(val: any) {
  return { type: 'startAt', val };
}

export function endAt(val: any) {
  return { type: 'endAt', val };
}

export function limitToLast(n: number) {
  return { type: 'limitToLast', n };
}

export async function runRtdbTransaction(refObj: any, transactionUpdate: any) {
  const currentVal = getLocalValue(refObj.path);
  const newVal = transactionUpdate(currentVal);
  await set(refObj, newVal);
  return { committed: true, snapshot: { val: () => newVal } };
}

// Auth Actions Emulation
export async function signInWithEmailAndPassword(authInstance: any, email: string, password: any) {
  let cleanEmail = email.toLowerCase().trim();
  
  // Normalize variations of the administrative user email
  if (cleanEmail === 'hrskader' || cleanEmail.includes('hrskader305') || cleanEmail.startsWith('hrskader')) {
    cleanEmail = 'hrskader305@gmail.com';
  }

  if (cleanEmail === 'hrskader305@gmail.com' && password === 'hrskader305@gmail.com') {
    const firebaseUser: User = {
      uid: 'FaQiBWkg8uTxZ2np7BQjINTyQc2',
      email: 'hrskader305@gmail.com',
      displayName: 'Kader (Administrateur)',
      providerData: [{ email: 'hrskader305@gmail.com' }]
    };
    (authInstance || auth).trigger(firebaseUser);
    return { user: firebaseUser };
  }

  // Dynamic local db user authentication fallback helper
  const tryLocalDbAuth = () => {
    // Ensure dbState is refreshed from localStorage if possible
    if (!dbState) {
      dbState = {};
    }
    if (!dbState['users'] || Object.keys(dbState['users']).length === 0) {
      try {
        const stored = localStorage.getItem('nexus_supabase_emulator_db');
        if (stored) {
          dbState = JSON.parse(stored) || {};
        }
      } catch (err) {}
    }

    if (!dbState) {
      dbState = {};
    }
    let users = dbState['users'] || {};
    
    // Extract phone-only representation if cleanEmail is an internal pseudo-email
    const cleanPhone = cleanEmail.endsWith('@nexus-pos.internal')
      ? cleanEmail.replace('@nexus-pos.internal', '').replace(/\s+/g, '')
      : cleanEmail.replace(/\s+/g, '');

    let matchedUser: any = Object.values(users).find((u: any) => {
      const uEmail = (u.email || '').toLowerCase().trim();
      const uPhone = (u.phone || '').toString().replace(/\s+/g, '');
      
      // Compare email directly
      if (uEmail && uEmail === cleanEmail) return true;
      
      // Compare phone directly
      if (uPhone && (uPhone === cleanPhone || `${uPhone}@nexus-pos.internal` === cleanEmail)) return true;
      
      return false;
    });

    if (matchedUser) {
      const hash = matchedUser.passwordHash || matchedUser.password || matchedUser.password_hash;
      if (hash) {
        try {
          // Check as bcrypt hash, fallback to plain text comparison in case it is unhashed
          let isMatch = false;
          try {
            isMatch = bcrypt.compareSync(password, hash);
          } catch (e) {
            isMatch = password === hash;
          }
          if (isMatch) {
            const firebaseUser: User = {
              uid: matchedUser.uid || matchedUser.id || generateLocalId(),
              email: matchedUser.email,
              displayName: matchedUser.displayName || matchedUser.name || 'Utilisateur',
              providerData: [{ email: matchedUser.email }]
            };
            auth.trigger(firebaseUser);
            // Cache in rtdb block for other components
            if (!dbState['users']) dbState['users'] = {};
            dbState['users'][firebaseUser.uid] = matchedUser;
            saveStateToStorage();
            return { user: firebaseUser };
          }
        } catch (bcryptErr) {
          console.error('[Bcrypt verification failure]', bcryptErr);
        }
      }
    }
    return null;
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
      const firebaseUser: User = {
        uid: data.user.id,
        email: data.user.email || null,
        displayName: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || null,
        providerData: [{ email: data.user.email || null }]
      };
      auth.trigger(firebaseUser);
      return { user: firebaseUser };
    } catch (supabaseError: any) {
      console.warn("Supabase auth login failed, trying direct database custom users select lookup fallback:", supabaseError);
      
      const cleanPhone = cleanEmail.endsWith('@nexus-pos.internal')
        ? cleanEmail.replace('@nexus-pos.internal', '').replace(/\s+/g, '')
        : cleanEmail.replace(/\s+/g, '');

      // Direct Database fallback for custom employees registered in 'users' table in PostgreSQL
      try {
        const { data: dbUsers, error: dbError } = await supabase
          .from('users')
          .select('*');
          
        if (!dbError && dbUsers && dbUsers.length > 0) {
          const matchedUser = dbUsers.find((u: any) => {
            const uEmail = (u.email || '').toLowerCase().trim();
            const uPhone = (u.phone || u.id || '').toString().replace(/\s+/g, '');
            if (uEmail && uEmail === cleanEmail) return true;
            if (uPhone && (uPhone === cleanPhone || `${uPhone}@nexus-pos.internal` === cleanEmail)) return true;
            return false;
          });
          
          if (matchedUser) {
            const hash = matchedUser.password_hash || matchedUser.password || (matchedUser as any).passwordHash;
            if (hash) {
              let isMatch = false;
              try {
                isMatch = bcrypt.compareSync(password, hash);
              } catch (e) {
                isMatch = password === hash;
              }
              if (isMatch) {
                const firebaseUser: User = {
                  uid: matchedUser.uid || matchedUser.id || generateLocalId(),
                  email: matchedUser.email || null,
                  displayName: matchedUser.display_name || matchedUser.name || 'Utilisateur',
                  providerData: [{ email: matchedUser.email || null }]
                };
                (authInstance || auth).trigger(firebaseUser);
                
                // Keep local cache matching so offlines/other lookups succeed
                if (!dbState['users']) dbState['users'] = {};
                dbState['users'][firebaseUser.uid] = convertKeysToCamel(matchedUser);
                saveStateToStorage();
                
                return { user: firebaseUser };
              }
            }
          }
        }
      } catch (dbErr) {
        console.error("Direct Supabase users fallback table lookup crashed:", dbErr);
      }
      
      // Attempt local DB user fallback match
      const localUserResult = tryLocalDbAuth();
      if (localUserResult) {
        return localUserResult;
      }
      
      // Default Owner bypass fallback
      if (cleanEmail === 'hrskader305@gmail.com') {
        const firebaseUser: User = {
          uid: 'FaQiBWkg8uTxZ2np7BQjINTyQc2',
          email: 'hrskader305@gmail.com',
          displayName: 'Propriétaire local',
          providerData: [{ email: 'hrskader305@gmail.com' }]
        };
        (authInstance || auth).trigger(firebaseUser);
        return { user: firebaseUser };
      }
      
      throw supabaseError;
    }
  } else {
    // Firestore users check
    const localUserResult = tryLocalDbAuth();
    if (localUserResult) {
      return localUserResult;
    }
    
    // Default Owner login fallback
    if (cleanEmail === 'hrskader305@gmail.com') {
      const firebaseUser: User = {
        uid: 'FaQiBWkg8uTxZ2np7BQjINTyQc2',
        email: 'hrskader305@gmail.com',
        displayName: 'Propriétaire local',
        providerData: [{ email: 'hrskader305@gmail.com' }]
      };
      (authInstance || auth).trigger(firebaseUser);
      return { user: firebaseUser };
    }
    throw new Error("Identifiant incorrect ou compte non trouvé.");
  }
}

export async function createUserWithEmailAndPassword(authInstance: any, email: string, password: any) {
  const performLocalSignup = () => {
    const uid = generateLocalId();
    const cleanEmail = email.toLowerCase().trim();
    const bcryptHash = bcrypt.hashSync(password, 10);
    
    const userData = {
      id: uid,
      uid: uid,
      email: cleanEmail,
      displayName: email.split('@')[0],
      passwordHash: bcryptHash,
      role: 'admin',
      joinDate: new Date().toISOString()
    };

    // Store in our local memory state
    if (!dbState['users']) {
      dbState['users'] = {};
    }
    dbState['users'][uid] = userData;
    saveStateToStorage();
    
    // Trigger observers to notify auth hooks and subscribers
    triggerObservers('users');
    triggerObservers(`users/${uid}`);

    const firebaseUser: User = {
      uid: uid,
      email: email,
      displayName: email.split('@')[0],
      providerData: [{ email }],
      isOfflineFallback: true
    };
    auth.trigger(firebaseUser);
    return { user: firebaseUser };
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        // If signups are disabled, do the local fallback instead of breaking the app
        const errorMsg = error.message || '';
        if (errorMsg.includes('Signups not allowed for this instance') || errorMsg.includes('signup_disabled')) {
          console.warn("[Supabase Signup] Signups not allowed. Falling back to local offline user.");
          return performLocalSignup();
        }
        throw error;
      }
      if (!data.user) throw new Error("Échec de création d'utilisateur.");
      const firebaseUser: User = {
        uid: data.user.id,
        email: data.user.email || null,
        displayName: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || null,
        providerData: [{ email: data.user.email || null }]
      };
      
      // Also save profile in DB state/users collection
      const rawUserObj = {
        id: data.user.id,
        uid: data.user.id,
        email: data.user.email,
        displayName: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Utilisateur',
        role: 'admin',
        joinDate: new Date().toISOString()
      };
      if (!dbState['users']) dbState['users'] = {};
      dbState['users'][data.user.id] = rawUserObj;
      saveStateToStorage();
      
      try {
        const { error } = await supabase.from('users').upsert(convertKeysToSnake(rawUserObj), { onConflict: 'id' });
        if (error) handleSupabaseError('users', 'Upsert', error);
      } catch (err: any) {
        handleSupabaseError('users', 'Upsert', err);
      }

      auth.trigger(firebaseUser);
      return { user: firebaseUser };
    } catch (err: any) {
      const errorMsg = err?.message || '';
      if (errorMsg.includes('Signups not allowed for this instance') || errorMsg.includes('signup_disabled')) {
        console.warn("[Supabase Signup Exception] Signups not allowed. Falling back to local offline user.");
        return performLocalSignup();
      }
      throw err;
    }
  } else {
    return performLocalSignup();
  }
}

export async function signInWithPopup(authInstance: any, provider: any) {
  if (isSupabaseConfigured) {
    try {
      // Dynamically determine the redirect URL to match the currently browsed site.
      // This ensures that we redirect back to the active container (e.g. ais-dev during development,
      // ais-pre for shared links), preventing "Page not found" errors due to inactive environment routing.
      let redirectTo = window.location.origin;
      
      // Fallback for local development or sandbox iframe
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // @ts-ignore
        redirectTo = import.meta.env?.VITE_APP_URL || window.location.origin;
      }
      
      console.log(`[Supabase OAuth] Initiating login with redirect to: ${redirectTo}`);

      // Check if we are inside an iframe (like Google AI Studio preview)
      const isIframe = window.self !== window.top;

      if (!isIframe) {
        // Smooth, modern direct redirect in the same tab when running in a normal tab (No popup windows!)
        const { error: redirectError } = await supabase.auth.signInWithOAuth({ 
          provider: 'google',
          options: {
            redirectTo: redirectTo
          }
        });
        if (redirectError) throw redirectError;
        return { user: null };
      }

      // If inside an iframe (preview sandbox), we must use the skipBrowserRedirect popup model since Google blocks loading its login inside iframes
      const { data, error } = await supabase.auth.signInWithOAuth({ 
        provider: 'google',
        options: {
          skipBrowserRedirect: true,
          redirectTo: redirectTo
        }
      });
      if (error) throw error;
      if (data?.url) {
        // Open the Google Auth process in a popup / new window so that the main POS app stays open and intact.
        // If the provider is disabled in Supabase, the error occurs in this new window/tab, keeping the POS available.
        const popup = window.open(data.url, '_blank', 'width=555,height=655');
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          // Fallback to absolute redirect if browser blocks the popup
          const { error: redirectError } = await supabase.auth.signInWithOAuth({ 
            provider: 'google',
            options: {
              redirectTo: window.location.origin
            }
          });
          if (redirectError) throw redirectError;
        } else {
          return new Promise((resolve) => {
            const checkPopup = setInterval(() => {
              if (!popup || popup.closed) {
                clearInterval(checkPopup);
                resolve({ user: null });
              }
            }, 1000);
          });
        }
      }
      return data;
    } catch (err) {
      console.error("Supabase OAuth error:", err);
      throw err;
    }
  } else {
    const firebaseUser: User = {
      uid: 'FaQiBWkg8uTxZ2np7BQjINTyQc2',
      email: 'hrskader305@gmail.com',
      displayName: 'Propriétaire local',
      providerData: [{ email: 'hrskader305@gmail.com' }]
    };
    auth.trigger(firebaseUser);
    return { user: firebaseUser };
  }
}

export async function signOut(authInstance: any) {
  if (isSupabaseConfigured) {
    await supabase.auth.signOut();
  }
  auth.trigger(null);
}

// Misc Support
export const Timestamp = {
  now: () => ({
    toDate: () => new Date(),
    toMillis: () => Date.now(),
    seconds: Math.floor(Date.now() / 1000)
  })
};

export async function runTransaction(dbInstance: any, callback: any) {
  return callback();
}

export function writeBatch() {
  return {
    set: (docRef: any, data: any) => {
      setLocalValue(docRef.path, data);
    },
    update: (docRef: any, data: any) => {
      updateLocalValue(docRef.path, data);
    },
    delete: (docRef: any) => {
      removeLocalValue(docRef.path);
    },
    commit: async () => {}
  };
}

export function increment(n: number) {
  return n;
}

export function arrayUnion(...elements: any[]) {
  return elements;
}

export function onAuthStateChanged(authInstance: any, callback: (user: User | null) => void) {
  return authInstance.onAuthStateChanged(callback);
}

