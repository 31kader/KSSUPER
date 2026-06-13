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

export function convertKeysToSnake(obj: any): any {
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

export function convertKeysToCamel(obj: any): any {
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
    'damaged_stock', 'created_at', 'updated_at',
    'use_multi_expiry', 'batches', 'auto_unpack', 'units_per_parent', 'parent_id'
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
    'balance_used', 'voucher_discount', 'is_wholesale', 'online_order_id', 'items',
    'audit_status', 'audit_note'
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
    'id', 'uid', 'email', 'display_name', 'password_hash', 'role', 'join_date', 'updated_at'
  ],
  settings: [
    'id', 'name', 'logo_url', 'address', 'phone', 'email', 'tax_number', 'receipt_template', 'label_template', 
    'currency', 'tax_rate', 'loyalty_points_per_currency_unit', 'loyalty_point_value', 'footer_text', 
    'accounting_format', 'site_locations', 'role_kpis', 'notifications', 'operational_costs', 'locking_period_days', 
    'delivery_zones', 'paper_format', 'silent_printing', 'global_stock_alert_threshold', 'api_keys', 
    'available_taxes', 'display_price_ht', 'loyalty_tiers', 'enable_time_clock', 'session_timeout_minutes', 
    'audit_log_retention_days', 'brand_color', 'fast_mode_enabled', 'default_lead_time_days', 'loyalty_points_per_unit'
  ],
  promotions: [
    'id', 'name', 'type', 'value', 'start_date', 'end_date', 'is_active', 'applicable_categories', 'code', 'buy_quantity', 'get_quantity', 'applicable_products', 'updated_at'
  ],
  returns: [
    'id', 'transaction_id', 'product_id', 'quantity', 'reason', 'condition', 'refund_amount', 'date', 'status', 'notes'
  ],
  online_orders: [
    'id', 'customer_id', 'external_order_id',
    'items', 'total', 'status', 'shipping_address', 'payment_status', 'payment_method', 
    'source', 'delivery_method', 'pickup_time', 'synced_to_pos', 
    'assigned_employee_id', 'assigned_employee_name', 'assigned_picker_id', 'assigned_picker_name',
    'status_history', 'timestamp'
  ],
  purchases: [
    'id', 'supplier_id', 'items', 'total_amount', 'status', 'date', 'documents'
  ],
  purchase_orders: [
    'id', 'supplier_id', 'order_number', 'items', 'total_amount', 'total', 'status', 'expected_date', 'notes', 'created_at'
  ],
  stock_adjustments: [
    'id', 'product_id', 'old_quantity', 'new_quantity', 'adjustment', 'reason', 'timestamp', 'user_id', 'user_name', 'is_loss'
  ],
  supplier_payments: [
    'id', 'supplier_id', 'amount', 'method', 'date', 'reference', 'notes'
  ],
  audits: [
    'id', 'date', 'auditor_id', 'status', 'discrepancies', 'notes', 'completed_at'
  ],
  audit_logs: [
    'id', 'timestamp', 'user_id', 'user_name', 'action', 'module', 'details', 'severity', 'is_cancelled', 'cancelled_at', 'updated_at'
  ],
  supplier_syncs: [
    'id', 'supplier_id', 'last_sync', 'status', 'items_updated', 'errors'
  ],
  damaged_items: [
    'id', 'product_id', 'quantity', 'date', 'reported_by', 'user_id', 'user_name', 'reason', 'cost_price', 'claim_status', 'status'
  ],
  advances: [
    'id', 'employee_id', 'amount', 'date', 'reason', 'status', 'approved_by', 'repayment_date'
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
    const booleanKeys = [
      'is_bundle', 'show_in_pos', 'is_app_user', 'is_clocked_in', 'sync_enabled', 
      'has_full_inventory_access', 'use_multi_expiry', 'auto_unpack', 'synced_to_pos',
      'active', 'is_wholesale', 'pushed', 'is_cancelled'
    ];
    if (booleanKeys.includes(key)) {
      return !!val;
    }

    // 4. Ensure number type for numeric postgres columns
    const numericKeys = [
      'price', 'online_price', 'cost_price', 'wholesale_price', 'tax_rate', 
      'stock', 'min_stock', 'damaged_stock', 'total', 'amount', 'balance', 
      'loyalty_points', 'total_spent', 'expected_cash', 'final_cash', 
      'initial_cash', 'total_sales', 'total_expenses', 'level', 'points_earned',
      'discount_amount', 'points_discount', 'balance_used', 'voucher_discount', 'value', 'current_balance', 'min_purchase',
      'units_per_parent'
    ];
    if (numericKeys.includes(key)) {
      let parsedNum: number;
      if (typeof val === 'string') {
        parsedNum = parseFloat(val.replace(',', '.').replace(/[^\d.-]/g, ''));
      } else {
        parsedNum = Number(val);
      }
      return isNaN(parsedNum) ? (key === 'units_per_parent' ? 1 : 0) : parsedNum;
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
    const jsonKeys = [
      'bundle_items', 'quantity_discounts', 'usage_logs', 'items', 'alerts', 
      'favorite_items', 'usage_logs', 'batches', 'status_history', 'conditions',
      'documents', 'discrepancies', 'notifications', 'role_kpis', 'details'
    ];
    if (jsonKeys.includes(key)) {
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (_) { return []; }
      }
      return val || [];
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

// ----------------- Asynchronous Sync Queue (Batching & Deferred Offline-First) -----------------
let pendingUpserts: Record<string, Record<string, any>> = {}; // table -> recordId -> value
let pendingDeletes: Record<string, string[]> = {}; // table -> array of recordIds
let syncQueueTimeout: any = null;
let isSyncingQueue = false;

// Load queued changes on startup
async function loadPendingSyncQueue() {
  try {
    const upserts = await getIDB('nexus_pending_sync_upserts');
    const deletes = await getIDB('nexus_pending_sync_deletes');
    if (upserts) pendingUpserts = upserts;
    if (deletes) pendingDeletes = deletes;
    
    if (hasPendingChanges()) {
      scheduleQueueProcessing(2000);
    }
  } catch (e) {
    console.warn('[Queue Sync] Failed to load pending sync queue', e);
  }
}

function hasPendingChanges() {
  const hasUpserts = Object.values(pendingUpserts).some(records => Object.keys(records).length > 0);
  const hasDeletes = Object.values(pendingDeletes).some(ids => ids.length > 0);
  return hasUpserts || hasDeletes;
}

async function savePendingSyncQueue() {
  try {
    await setIDB('nexus_pending_sync_upserts', pendingUpserts);
    await setIDB('nexus_pending_sync_deletes', pendingDeletes);
  } catch (e) {
    console.warn('[Queue Sync] Failed to save pending sync queue', e);
  }
}

function enqueueSync(table: string, id: string | null, value: any, isDelete = false) {
  // Use normalizePath to get the correct table name for Supabase
  const normalizedPath = normalizePath(table);
  const mappedTable = normalizedPath === 'shifts' ? 'cash_shifts' : normalizedPath;
  
  if (!isSupabaseConfigured || !TABLE_COLUMNS[mappedTable]) return;

  if (isDelete) {
    if (id) {
      if (pendingUpserts[mappedTable]) {
        delete pendingUpserts[mappedTable][id];
      }
      if (!pendingDeletes[mappedTable]) {
        pendingDeletes[mappedTable] = [];
      }
      if (!pendingDeletes[mappedTable].includes(id)) {
        pendingDeletes[mappedTable].push(id);
      }
    } else {
      pendingUpserts[mappedTable] = {};
      pendingDeletes[mappedTable] = ['none_placeholder_delete_all'];
    }
  } else if (id) {
    if (pendingDeletes[mappedTable]) {
      pendingDeletes[mappedTable] = pendingDeletes[mappedTable].filter(x => x !== id);
    }
    if (!pendingUpserts[mappedTable]) {
      pendingUpserts[mappedTable] = {};
    }
    pendingUpserts[mappedTable][id] = value;
  }

  savePendingSyncQueue();
  scheduleQueueProcessing(1500);
}

function scheduleQueueProcessing(delayMs = 1500) {
  if (syncQueueTimeout) clearTimeout(syncQueueTimeout);
  syncQueueTimeout = setTimeout(processSyncQueue, delayMs);
}

let _isSyncActive = false;
export function isBackgroundSyncActive() {
  return _isSyncActive;
}

const syncStatusListeners = new Set<(active: boolean, pendingCount: number) => void>();
export function onBackgroundSyncStatus(callback: (active: boolean, pendingCount: number) => void) {
  syncStatusListeners.add(callback);
  callback(_isSyncActive, getPendingCount());
  return () => {
    syncStatusListeners.delete(callback);
  };
}

function getPendingCount() {
  let count = 0;
  for (const records of Object.values(pendingUpserts)) {
    count += Object.keys(records).length;
  }
  for (const ids of Object.values(pendingDeletes)) {
    count += ids.length;
  }
  return count;
}

function notifySyncStatus() {
  const active = _isSyncActive;
  const count = getPendingCount();
  syncStatusListeners.forEach(cb => cb(active, count));
}

const TABLE_PROCESS_ORDER = ['categories', 'brands', 'products'];

async function processSyncQueue() {
  if (!isSupabaseConfigured || isSyncingQueue) return;
  if (!hasPendingChanges()) return;

  isSyncingQueue = true;
  _isSyncActive = true;
  notifySyncStatus();

  console.log("[Queue Sync] Beginning asynchronous batch synchronization to Supabase...");

  try {
    const upsertsToProcess = { ...pendingUpserts };
    const deletesToProcess = { ...pendingDeletes };

    pendingUpserts = {};
    pendingDeletes = {};
    await savePendingSyncQueue();

    // 1. Process deletes
    for (const [mappedTable, ids] of Object.entries(deletesToProcess)) {
      if (ids.length === 0 || missingTables.has(mappedTable)) continue;
      try {
        if (ids.includes('none_placeholder_delete_all')) {
          const { error } = await supabase.from(mappedTable).delete().neq('id', 'none_placeholder_delete_all');
          if (error) {
            handleSupabaseError(mappedTable, 'Delete', error);
            if (isRetryableError(error)) {
              requeueDeletes(mappedTable, ids);
            }
          }
        } else {
          const chunkSize = 100;
          for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const { error } = await supabase.from(mappedTable).delete().in('id', chunk);
            if (error) {
              handleSupabaseError(mappedTable, 'Delete', error);
              if (isRetryableError(error)) {
                requeueDeletes(mappedTable, chunk);
              }
              if (!isRetryableError(error)) break; // Skip remaining chunks for this table
            }
          }
        }
      } catch (err) {
        console.error(`[Queue Sync] Error running bulk deletes on ${mappedTable}:`, err);
        requeueDeletes(mappedTable, ids);
      }
    }

    // 2. Process upserts in specific order
    const allTables = new Set(Object.keys(upsertsToProcess));
    const orderedTables = [...TABLE_PROCESS_ORDER.filter(t => allTables.has(t)), ...Array.from(allTables).filter(t => !TABLE_PROCESS_ORDER.includes(t))];

    for (const mappedTable of orderedTables) {
      if (missingTables.has(mappedTable)) continue;
      const records = upsertsToProcess[mappedTable];
      if (!records || Object.keys(records).length === 0) continue;

      try {
        const payloads: any[] = [];
        
        if (mappedTable === 'products') {
          const categoriesDict = dbState['categories'] || {};
          let firstCatId = Object.keys(categoriesDict)[0] || 'uncategorized';
          
          for (const [id, value] of Object.entries(records)) {
            let catId = value.category_id || value.categoryId;
            if (!catId) {
              value.category_id = firstCatId;
              value.categoryId = firstCatId;
              catId = firstCatId;
            }
            
            const catObj = dbState['categories'] ? dbState['categories'][catId] : null;
            if (catObj) {
              const catPayload = preparePayload('categories', catId, catObj);
              try {
                const { error: catErr } = await supabase.from('categories').upsert(catPayload, { onConflict: 'id' });
                if (catErr) throw catErr;
              } catch (err) {
                console.warn("[Queue Sync] Auto-upsert product category error:", err);
              }
            }

            const brandId = value.brand_id || value.brandId;
            if (brandId) {
              const brandObj = dbState['brands'] ? dbState['brands'][brandId] : null;
              if (brandObj) {
                const brandPayload = preparePayload('brands', brandId, brandObj);
                try {
                  const { error: brandErr } = await supabase.from('brands').upsert(brandPayload, { onConflict: 'id' });
                  if (brandErr) throw brandErr;
                } catch (err) {
                  console.warn("[Queue Sync] Auto-upsert product brand error:", err);
                }

                value.brand_id = null;
                value.brandId = null;
              }
            }
            
            payloads.push(preparePayload('products', id, value));
          }
        } else {
          for (const [id, value] of Object.entries(records)) {
            payloads.push(preparePayload(mappedTable, id, value));
          }
        }

        if (payloads.length > 0) {
          const chunkSize = 150;
          for (let i = 0; i < payloads.length; i += chunkSize) {
            const chunk = payloads.slice(i, i + chunkSize);
            const { error } = await supabase.from(mappedTable).upsert(chunk, { onConflict: 'id' });
            if (error) {
              handleSupabaseError(mappedTable, 'Upsert', error);
              if (isRetryableError(error)) {
                const failedIds = chunk.map(p => p.id);
                const failedRecords: Record<string, any> = {};
                for (const id of failedIds) {
                  if (records[id]) failedRecords[id] = records[id];
                }
                requeueUpserts(mappedTable, failedRecords);
              }
              if (!isRetryableError(error)) break; // Skip remaining chunks for this table
            }
          }
        }
      } catch (err: any) {
        console.error(`[Queue Sync] Error writing bulk upserts for ${mappedTable}:`, err);
        requeueUpserts(mappedTable, records);
      }
    }

    console.log("[Queue Sync] Batch sync cycle completed.");
  } catch (err) {
    console.error("[Queue Sync] Error in background sync:", err);
  } finally {
    isSyncingQueue = false;
    _isSyncActive = false;
    notifySyncStatus();
    await savePendingSyncQueue();
    
    if (hasPendingChanges()) {
      scheduleQueueProcessing(3000);
    }
  }
}

function requeueDeletes(table: string, ids: string[]) {
  if (!pendingDeletes[table]) pendingDeletes[table] = [];
  for (const id of ids) {
    if (!pendingDeletes[table].includes(id)) {
      pendingDeletes[table].push(id);
    }
  }
}

function requeueUpserts(table: string, records: Record<string, any>) {
  if (!pendingUpserts[table]) pendingUpserts[table] = {};
  for (const [id, val] of Object.entries(records)) {
    pendingUpserts[table][id] = val;
  }
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
    // Also load any offline queued events
    await loadPendingSyncQueue();
  } catch (e) {
    console.warn('[Supabase Emulator] Failed to parse local state cache', e);
  }
}

loadInitialState();

function normalizePath(path: string): string {
  if (!path) return '';
  const clean = path.replace(/^\/+|\/+$/g, '');
  const parts = clean.split('/');
  let table = parts[0];
  
  if (table === 'onlineOrders' || table === 'online_orders') table = 'online_orders';
  else if (table === 'stockAdjustments' || table === 'stock_adjustments') table = 'stock_adjustments';
  else if (table === 'supplierPayments' || table === 'supplier_payments') table = 'supplier_payments';
  else if (table === 'supplierSyncs' || table === 'supplier_syncs') table = 'supplier_syncs';
  else if (table === 'damagedItems' || table === 'damaged_items') table = 'damaged_items';
  else if (table === 'auditLogs' || table === 'audit_logs') table = 'audit_logs';
  else if (table === 'invoicePatterns' || table === 'invoice_patterns') table = 'invoice_patterns';
  else if (table === 'purchaseOrders' || table === 'purchase_orders') table = 'purchase_orders';
  else if (table === 'promotions') table = 'promotions';
  else if (table === 'settings') table = 'settings';
  else if (table === 'users') table = 'users';
  else if (table === 'employees') table = 'employees';
  else if (table === 'customers') table = 'customers';
  else if (table === 'shifts' || table === 'cash_shifts') table = 'cash_shifts';
  
  parts[0] = table;
  return parts.join('/');
}

function parsePath(path: string) {
  const clean = normalizePath(path);
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
  const normPath = normalizePath(path);
  if (observers[normPath]) {
    const val = getLocalValue(normPath);
    observers[normPath].forEach(cb => {
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

// List of tables known to be missing in Supabase to avoid redundant fatal error retries
const missingTables = new Set<string>();
const lastErrorToasts: Record<string, number> = {};

function handleSupabaseError(table: string, actionType: 'Upsert' | 'Delete' | 'Fallback', error: any) {
  if (!error) return;
  const message = error.message || '';
  const code = error.code || '';
  const isMissingTable = message.includes("Could not find the table") || 
                         code === '42P01' || 
                         (message.includes("relation") && message.includes("does not exist")) || 
                         message.includes("schema cache");
  
  if (isMissingTable) {
    missingTables.add(table);
    console.info(`[Supabase Sync Schema Info] Table "${table}" is not created in Supabase yet. Local storage emulator database is active for this table.`);
    
    // Throttle toasts for the same table to once every 30 seconds
    const now = Date.now();
    if (!lastErrorToasts[table] || now - lastErrorToasts[table] > 30000) {
      lastErrorToasts[table] = now;
      if (typeof window !== 'undefined') {
        try {
          toast.error(`La table "${table}" n'existe pas dans Supabase. Veuillez la créer via l'onglet Vérificateur de connexion.`);
        } catch (e) {}
      }
    }
  } else if (message.includes("violates row-level security policy") || code === '42501' || message.includes("row-level security")) {
    console.info(`[Supabase RLS Policy Info] Table "${table}" relies on Row-Level Security policies. The current session has local persistence enabled as fallback.`);
    const now = Date.now();
    if (!lastErrorToasts[table + '_rls'] || now - lastErrorToasts[table + '_rls'] > 30000) {
      lastErrorToasts[table + '_rls'] = now;
      if (typeof window !== 'undefined') {
        try {
          toast.warning(`[Supabase RLS] L'enregistrement sur "${table}" a échoué car le Row Level Security (RLS) bloque l'écriture. Désactivez RLS ou ajoutez une règle d'accès public.`);
        } catch (e) {}
      }
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

function isRetryableError(error: any): boolean {
  if (!error) return false;
  const code = error.code || '';
  const message = error.message || '';
  
  // 42P01: undefined_table
  // 42501: insufficient_privilege (RLS)
  if (code === '42P01' || code === '42501' || message.includes("Could not find the table") || message.includes("row-level security")) {
    return false;
  }
  
  return true;
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
  
  // Realtime Supabase Persist write (queued asynchronously & batched)
  enqueueSync(table, id, value, isDelete);
}

// ----------------- Supabase Realtime Sync Engine -----------------
let isTurboSubscriptionActive = false;

export function enableTurboSync() {
  if (!isSupabaseConfigured || isTurboSubscriptionActive) return;
  
  console.log("[Supabase Realtime] Activating synchronization across all tables...");
  
  const uniqueMappedTables = Array.from(new Set(
    Object.keys(TABLE_COLUMNS).map(table => table === 'shifts' ? 'cash_shifts' : table)
  ));
  
  uniqueMappedTables.forEach(mappedTable => {
    supabase
      .channel(`public:${mappedTable}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: mappedTable }, (payload) => {
        console.log(`[Supabase Realtime] Event ${payload.eventType} on table ${mappedTable}:`, payload.new || payload.old);
        
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
            const row = payload.new;
            // Parse known JSON fields if they are strings
            const jsonFields = ['items', 'status_history', 'metadata', 'details', 'documents', 'bundle_items', 'quantity_discounts', 'usage_logs', 'batches', 'alerts', 'favorite_items', 'conditions', 'discrepancies', 'notifications', 'role_kpis'];
            jsonFields.forEach(field => {
              if (row[field] && typeof row[field] === 'string') {
                try { row[field] = JSON.parse(row[field]); } catch (e) {}
              }
            });

            const newData = convertKeysToCamel(row);
            if (newData.id) {
              const id = String(newData.id);
              newData.id = id;
              
              // Fallback for online orders
              if (table === 'online_orders' || table === 'onlineOrders') {
                if (!newData.timestamp) newData.timestamp = (row.created_at || new Date().toISOString());
                if (!newData.externalOrderId) newData.externalOrderId = (row.external_order_id || id.slice(0, 8));
              }

              if (!dbState[table]) dbState[table] = {};
              dbState[table][id] = newData;
              triggerObservers(table);
              triggerObservers(`${table}/${id}`);
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
  const CHUNK_SIZE = 5; // Fetch 5 tables at a time to avoid rate limits while being fast
  
  for (let i = 0; i < tables.length; i += CHUNK_SIZE) {
    const chunk = tables.slice(i, i + CHUNK_SIZE);
    
    await Promise.all(chunk.map(async (table) => {
      syncStatus.currentTable = table;
      triggerSyncUpdate();
      
      try {
        const mappedTable = table === 'shifts' ? 'cash_shifts' : table;
        
        if (missingTables.has(mappedTable)) {
          syncStatus.completedTables++;
          return;
        }

        let allData: any[] = [];
        let fromIdx = 0;
        const pageSize = 200; // Smaller page size to avoid statement timeouts on large tables
        let hasMore = true;
        let fetchError: any = null;

        while (hasMore) {
          const toIdx = fromIdx + pageSize - 1;
          try {
            // Optimisation: only fetch necessary columns as defined in TABLE_COLUMNS
            let selectStr = table === 'transactions' ? '*, clients(*)' : (TABLE_COLUMNS[table] ? TABLE_COLUMNS[table].join(',') : '*');
            
            let response = await supabase
              .from(mappedTable)
              .select(selectStr)
              .range(fromIdx, toIdx);

            if (response.error && table === 'transactions' && (response.error.code === 'PGRST200' || response.error.message?.includes('relationship'))) {
              selectStr = '*';
              response = await supabase
                .from(mappedTable)
                .select(selectStr)
                .range(fromIdx, toIdx);
            }

            const { data, error } = response;

            if (error) {
              fetchError = error;
              hasMore = false;
            } else if (data) {
              allData = allData.concat(data);
              if (data.length < pageSize) {
                hasMore = false;
              } else {
                fromIdx += pageSize;
              }
            } else {
              hasMore = false;
            }
          } catch (e: any) {
            fetchError = e;
            hasMore = false;
          }
        }

        if (fetchError && allData.length === 0) {
          if (fetchError.message?.includes("Could not find the table") || fetchError.code === '42P01') {
            missingTables.add(mappedTable);
          } else {
            console.warn(`[Supabase Sync Warning] Error reading table "${mappedTable}":`, fetchError.message || fetchError);
          }
        } else {
           if (!dbState[table]) dbState[table] = {};
           
           allData.forEach((row: any) => {
             const jsonFields = ['items', 'status_history', 'metadata', 'details', 'documents', 'bundle_items', 'quantity_discounts', 'usage_logs', 'batches', 'alerts', 'favorite_items', 'conditions', 'discrepancies', 'notifications', 'role_kpis'];
             jsonFields.forEach(field => {
               if (row[field] && typeof row[field] === 'string') {
                 try { row[field] = JSON.parse(row[field]); } catch (e) {}
               }
             });

             const camelRow = convertKeysToCamel(row);
             if (camelRow.id) {
                const id = String(camelRow.id);
                camelRow.id = id;

                if (table === 'online_orders' || table === 'onlineOrders') {
                  if (!camelRow.timestamp) camelRow.timestamp = (row.created_at || new Date().toISOString());
                  if (!camelRow.externalOrderId) camelRow.externalOrderId = (row.external_order_id || id.slice(0, 8));
                }

                dbState[table][id] = {
                  ...(dbState[table][id] || {}),
                  ...camelRow
                };
             }
           });
           
           triggerObservers(table);
        }
      } catch (e: any) {
        console.warn(`[Supabase Prefetch Fallback] Could not pull table ${table}:`, e?.message || e);
      }
      
      syncStatus.completedTables++;
      syncStatus.progress = Math.round((syncStatus.completedTables / syncStatus.totalTables) * 100);
      triggerSyncUpdate();
    }));
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
  const rawPath = refObj.path || '';
  const basePath = normalizePath(rawPath);
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

  // 3. Queue all updates into the async background sync queue
  for (const [table, items] of Object.entries(supabaseUpserts)) {
    for (const item of items) {
      enqueueSync(table, item.id, item.value, false);
    }
  }

  // 4. Queue all deletes into the async background sync queue
  for (const [table, ids] of Object.entries(tablesDeleted)) {
    for (const id of ids) {
      enqueueSync(table, id, null, true);
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
  const rawPath = refObj.path || '';
  const path = normalizePath(rawPath);
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

