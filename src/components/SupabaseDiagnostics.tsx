import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { initAndSyncSupabase } from '../database';
import { del as idbDel } from 'idb-keyval';
import { Button, Card } from './ui';
import { 
  Database, CheckCircle, AlertTriangle, XCircle, RefreshCw, 
  Sparkles, Code, Play, ShieldAlert, Lock, HelpCircle, 
  ChevronDown, ChevronUp, Copy, BookOpen, Layers
} from 'lucide-react';
import { toast } from 'sonner';

interface TableStatus {
  name: string;
  mappedName: string;
  pushed: boolean;
  count: number | null;
  error: string | null;
  loading: boolean;
}

export const SupabaseDiagnostics: React.FC = () => {
  const [tables, setTables] = useState<TableStatus[]>([
    { name: 'Catégories', mappedName: 'categories', pushed: false, count: null, error: null, loading: false },
    { name: 'Marques', mappedName: 'brands', pushed: false, count: null, error: null, loading: false },
    { name: 'Produits', mappedName: 'products', pushed: false, count: null, error: null, loading: false },
    { name: 'Clients', mappedName: 'customers', pushed: false, count: null, error: null, loading: false },
    { name: 'Transactions', mappedName: 'transactions', pushed: false, count: null, error: null, loading: false },
    { name: 'Employés', mappedName: 'employees', pushed: false, count: null, error: null, loading: false },
    { name: 'Sessions de Caisse', mappedName: 'cash_shifts', pushed: false, count: null, error: null, loading: false },
    { name: 'Dépenses', mappedName: 'expenses', pushed: false, count: null, error: null, loading: false }
  ]);

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInsertingDemo, setIsInsertingDemo] = useState(false);
  const [diagnosticRunCount, setDiagnosticRunCount] = useState(0);
  const [isCleaning, setIsCleaning] = useState(false);

  const handleCleanupAIStudioFiles = async () => {
    setIsCleaning(true);
    let cleanedSettingsCount = 0;
    let cleanedProductsCount = 0;
    let cleanedCategoriesCount = 0;
    let cleanedBrandsCount = 0;

    const isBadUrl = (url: any) => {
      if (typeof url !== 'string') return false;
      const u = url.toLowerCase();
      return u.includes('aistudio.google.com') ||
             u.includes('/_/') ||
             u.includes('/upload/') ||
             u.includes('a07b672') ||
             u.includes('eb137f4a-fb23-4b8c-aec9-844aecbc242a');
    };

    try {
      // 1. Clean Local Emulated DB and Settings
      const settingsRaw = localStorage.getItem('nexus_supabase_emulator_db');
      if (settingsRaw) {
        let dbStateLocal = JSON.parse(settingsRaw);
        
        // Clean Settings (RTDB settings/company)
        if (dbStateLocal.settings?.company) {
          const comp = dbStateLocal.settings.company;
          if (isBadUrl(comp.logoUrl)) {
            comp.logoUrl = '';
            cleanedSettingsCount++;
          }
        }
        
        // Clean Products (RTDB products / emulator)
        if (dbStateLocal.products) {
          Object.keys(dbStateLocal.products).forEach(id => {
            const p = dbStateLocal.products[id];
            if (isBadUrl(p.imageUrl)) {
              p.imageUrl = '';
              cleanedProductsCount++;
            }
            if (isBadUrl(p.image)) {
              p.image = '';
              cleanedProductsCount++;
            }
          });
        }

        // Clean Categories (RTDB categories / emulator)
        if (dbStateLocal.categories) {
          Object.keys(dbStateLocal.categories).forEach(id => {
            const c = dbStateLocal.categories[id];
            if (isBadUrl(c.imageUrl)) {
              c.imageUrl = '';
              cleanedCategoriesCount++;
            }
            if (isBadUrl(c.image_url)) {
              c.image_url = '';
              cleanedCategoriesCount++;
            }
          });
        }

        // Clean Brands (RTDB brands / emulator)
        if (dbStateLocal.brands) {
          Object.keys(dbStateLocal.brands).forEach(id => {
            const b = dbStateLocal.brands[id];
            if (isBadUrl(b.logoUrl)) {
              b.logoUrl = '';
              cleanedBrandsCount++;
            }
            if (isBadUrl(b.logo_url)) {
              b.logo_url = '';
              cleanedBrandsCount++;
            }
          });
        }

        localStorage.setItem('nexus_supabase_emulator_db', JSON.stringify(dbStateLocal));
      }

      // Also clean in Supabase Cloud if configured
      if (isSupabaseConfigured) {
        // Fetch and update products
        const { data: prods } = await supabase.from('products').select('*');
        if (prods && prods.length > 0) {
          for (const bp of prods) {
            if (isBadUrl(bp.image_url) || isBadUrl(bp.imageUrl)) {
              await supabase.from('products').update({ image_url: '' }).eq('id', bp.id);
              cleanedProductsCount++;
            }
          }
        }

        // Fetch and update categories
        const { data: cats } = await supabase.from('categories').select('*');
        if (cats && cats.length > 0) {
          for (const bc of cats) {
            if (isBadUrl(bc.image_url) || isBadUrl(bc.imageUrl)) {
              await supabase.from('categories').update({ image_url: '' }).eq('id', bc.id);
              cleanedCategoriesCount++;
            }
          }
        }

        // Fetch and update brands
        const { data: brs } = await supabase.from('brands').select('*');
        if (brs && brs.length > 0) {
          for (const bb of brs) {
            if (isBadUrl(bb.logo_url) || isBadUrl(bb.logoUrl)) {
              await supabase.from('brands').update({ logo_url: '' }).eq('id', bb.id);
              cleanedBrandsCount++;
            }
          }
        }
      }

      // Clear IndexedDB Caches
      try {
        await idbDel('nexus_products_cache');
        await idbDel('nexus_categories_cache');
        await idbDel('nexus_brands_cache');
      } catch (err) {
        console.warn('Could not clear IndexedDB caches', err);
      }

      toast.success(
        `Nettoyage complété avec succès ! \n` +
        `• Logo entreprise nettoyé : ${cleanedSettingsCount}\n` +
        `• Images de produits nettoyées : ${cleanedProductsCount}\n` +
        `• Images de catégories nettoyées : ${cleanedCategoriesCount}\n` +
        `• Logos de marques nettoyés : ${cleanedBrandsCount}\n\n` +
        `L'application va se recharger automatiquement.`
      );
      
      setTimeout(() => {
        window.location.reload();
      }, 3500);

    } catch (e: any) {
      toast.error(`Erreur de nettoyage : ${e.message}`);
    } finally {
      setIsCleaning(false);
    }
  };

  // Run database ping tests
  const runDiagnostics = async () => {
    if (!isSupabaseConfigured) return;
    
    setTables(prev => prev.map(t => ({ ...t, loading: true, error: null })));
    
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      try {
        const { data, count, error } = await supabase
          .from(t.mappedName)
          .select('*', { count: 'exact', head: true });
        
        setTables(prev => prev.map(item => {
          if (item.mappedName === t.mappedName) {
            return {
              ...item,
              loading: false,
              count: count !== undefined ? count : (data ? data.length : 0),
              error: error ? error.message : null
            };
          }
          return item;
        }));
      } catch (err: any) {
        setTables(prev => prev.map(item => {
          if (item.mappedName === t.mappedName) {
            return {
              ...item,
              loading: false,
              error: err?.message || 'Erreur inconnue'
            };
          }
          return item;
        }));
      }
    }
    setDiagnosticRunCount(prev => prev + 1);
  };

  useEffect(() => {
    if (isSupabaseConfigured) {
      runDiagnostics();
    }
  }, []);

  const handleCopy = (text: string, title: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${title} copié dans le presse-papiers !`);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await initAndSyncSupabase();
      await runDiagnostics();
      toast.success("Synchronisation forcée effectuée ! Les données Supabase ont été chargées en mémoire.");
    } catch (e: any) {
      toast.error(`Erreur de synchronisation : ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const insertDemoData = async () => {
    if (!isSupabaseConfigured) {
      toast.error("Veuillez d'abord configurer Supabase dans vos réglages globaux.");
      return;
    }

    setIsInsertingDemo(true);
    try {
      // 1. Insert Categories
      const demoCategories = [
        { id: 'cat_boissons', name: 'Boissons', level: 1 },
        { id: 'cat_laitiers', name: 'Produits Laitiers', level: 1 },
        { id: 'cat_epicerie', name: 'Épicerie Fine', level: 1 }
      ];

      const { error: catErr } = await supabase.from('categories').upsert(demoCategories, { onConflict: 'id' });
      if (catErr) throw new Error(`Erreur Catégories : ${catErr.message}`);

      // 2. Insert Brands
      const demoBrands = [
        { id: 'brand_cocacola', name: 'Coca-Cola Company', description: 'Gamme de boissons gazeuses rafraîchissantes' },
        { id: 'brand_central', name: 'Centrale Danone', description: 'Produits laitiers et dérivés' },
        { id: 'brand_sidiali', name: 'Sidi Ali', description: 'Eau minérale naturelle marocaine' }
      ];

      const { error: brandErr } = await supabase.from('brands').upsert(demoBrands, { onConflict: 'id' });
      if (brandErr) throw new Error(`Erreur Marques : ${brandErr.message}`);

      // 3. Insert Demo Products
      const demoProducts = [
        {
          id: 'prod_coca_33',
          name: 'Coca-Cola Canette 33cl',
          barcode: '5449000000996',
          sku: 'COCA-33CL-CAN',
          price: 6.00,
          cost_price: 4.20,
          wholesale_price: 5.50,
          tax_rate: 20.00,
          stock: 120.0,
          min_stock: 20.0,
          category_id: 'cat_boissons',
          brand_id: 'brand_cocacola',
          unit: 'pcs',
          status: 'active',
          description: 'Boisson rafraîchissante aux extraits végétaux.',
          show_in_pos: true
        },
        {
          id: 'prod_eau_15',
          name: 'Sidi Ali Eau Minérale 1.5L',
          barcode: '6111242100021',
          sku: 'SIDI-ALI-1.5L',
          price: 6.50,
          cost_price: 4.80,
          wholesale_price: 6.00,
          tax_rate: 0.00,
          stock: 200.0,
          min_stock: 50.0,
          category_id: 'cat_boissons',
          brand_id: 'brand_sidiali',
          unit: 'pcs',
          status: 'active',
          description: 'Eau minérale plate naturelle de table.',
          show_in_pos: true
        },
        {
          id: 'prod_yaourt_nat',
          name: 'Centrale Yaourt Naturel 110g',
          barcode: '6111003001855',
          sku: 'YRT-NAT-110G',
          price: 2.50,
          cost_price: 1.90,
          wholesale_price: 2.30,
          tax_rate: 7.00,
          stock: 85.0,
          min_stock: 15.0,
          category_id: 'cat_laitiers',
          brand_id: 'brand_central',
          unit: 'pcs',
          status: 'active',
          description: 'Yaourt crémeux nature sans sucre ajouté.',
          show_in_pos: true
        }
      ];

      const { error: prodErr } = await supabase.from('products').upsert(demoProducts, { onConflict: 'id' });
      if (prodErr) throw new Error(`Erreur Produits : ${prodErr.message}`);

      toast.success("Catégories, Marques et Produits de démonstration créés avec SUCCÈS sur votre base Supabase !");
      await handleSyncNow();
    } catch (e: any) {
      toast.error(
        <div className="flex flex-col gap-1">
          <p className="font-bold">Échec de création des données de démo</p>
          <p className="text-[11px] leading-snug">{e.message}</p>
          <p className="text-[10px] text-amber-400 mt-1">💡 Cela indique que vos tables ne sont pas encore créées sur Supabase or que le RLS bloque les modifications.</p>
        </div>,
        { duration: 10000 }
      );
    } finally {
      setIsInsertingDemo(false);
    }
  };

  // SQL code snippets for user help
  const sqlCreateTables = `-- 1. CRÉATION DES TABLES DE BASE
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    level INTEGER DEFAULT 1,
    image_url TEXT
);

CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    barcode TEXT,
    sku TEXT,
    reference TEXT,
    image_url TEXT,
    image_urls TEXT[],
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    online_price NUMERIC(12, 2),
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    wholesale_price NUMERIC(12, 2),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    min_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
    supplier TEXT,
    unit TEXT NOT NULL DEFAULT 'pcs',
    status TEXT NOT NULL DEFAULT 'active',
    description TEXT,
    is_bundle BOOLEAN DEFAULT FALSE,
    bundle_items JSONB,
    quantity_discounts JSONB,
    tags TEXT[],
    expiration_date DATE,
    batch_number TEXT,
    location TEXT,
    show_in_pos BOOLEAN DEFAULT TRUE,
    damaged_stock NUMERIC(12, 3) DEFAULT 0.000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    loyalty_points INTEGER DEFAULT 0,
    balance NUMERIC(12, 2) DEFAULT 0.00,
    loyalty_card_number TEXT,
    total_spent NUMERIC(12, 2) DEFAULT 0.00,
    last_visit DATE,
    notes TEXT,
    is_app_user BOOLEAN DEFAULT FALSE,
    password_hash TEXT,
    join_date DATE DEFAULT CURRENT_DATE,
    favorite_items JSONB,
    alerts JSONB,
    cashier_notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    uid TEXT UNIQUE,
    email TEXT UNIQUE,
    display_name TEXT,
    password_hash TEXT,
    role TEXT DEFAULT 'staff',
    join_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    phone TEXT,
    email TEXT,
    hire_date DATE,
    status TEXT DEFAULT 'active',
    is_clocked_in BOOLEAN DEFAULT FALSE,
    base_salary NUMERIC(12, 2),
    salary_type TEXT,
    hourly_rate NUMERIC(12, 2),
    daily_rate NUMERIC(12, 2),
    id_card_recto_url TEXT,
    id_card_verso_url TEXT,
    contract_url TEXT,
    digital_signature_url TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT,
    delivery_method TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id TEXT REFERENCES users(id),
    customer_id TEXT REFERENCES customers(id),
    customer_name TEXT,
    status TEXT DEFAULT 'completed',
    employee_id TEXT REFERENCES employees(id),
    employee_name TEXT,
    promotion_id TEXT,
    points_earned INTEGER DEFAULT 0,
    discount_amount NUMERIC(12, 2) DEFAULT 0.00,
    points_discount NUMERIC(12, 2) DEFAULT 0.00,
    balance_used NUMERIC(12, 2) DEFAULT 0.00,
    voucher_discount NUMERIC(12, 2) DEFAULT 0.00,
    is_wholesale BOOLEAN DEFAULT FALSE,
    online_order_id TEXT,
    items JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS cash_shifts (
    id TEXT PRIMARY KEY,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opened_by TEXT,
    closed_by TEXT,
    initial_cash NUMERIC(12, 2) DEFAULT 0.00,
    final_cash NUMERIC(12, 2),
    expected_cash NUMERIC(12, 2),
    total_sales NUMERIC(12, 2) DEFAULT 0.00,
    total_cash_sales NUMERIC(12, 2) DEFAULT 0.00,
    total_card_sales NUMERIC(12, 2) DEFAULT 0.00,
    total_expenses NUMERIC(12, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'open',
    notes TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    category TEXT,
    date DATE DEFAULT CURRENT_DATE,
    user_id TEXT,
    payment_method TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    categories TEXT[],
    feed_url TEXT,
    feed_format TEXT,
    last_sync TIMESTAMPTZ,
    sync_enabled BOOLEAN DEFAULT FALSE,
    is_app_user BOOLEAN DEFAULT FALSE,
    has_full_inventory_access BOOLEAN DEFAULT FALSE,
    password_hash TEXT,
    balance NUMERIC(12, 2) DEFAULT 0.00,
    pre_sale_days INTEGER,
    delivery_days INTEGER,
    payment_days INTEGER,
    planning_notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    type TEXT DEFAULT 'percentage',
    value NUMERIC(12, 2) NOT NULL,
    current_balance NUMERIC(12, 2),
    min_purchase NUMERIC(12, 2) DEFAULT 0.00,
    expiry_date DATE,
    status TEXT DEFAULT 'active',
    customer_id TEXT REFERENCES customers(id),
    customer_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    usage_logs JSONB
);

CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES employees(id),
    employee_name TEXT,
    clock_in TIMESTAMPTZ,
    clock_out TIMESTAMPTZ,
    date DATE DEFAULT CURRENT_DATE,
    total_hours NUMERIC(5, 2),
    status TEXT
);`;

  const sqlDisableRLS = `-- SQL POUR DÉSACTIVER TEMPÉRAIREMENT RLS (Facilite les tests initiaux)
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE brands DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;`;

  const sqlEnableRLSPublic = `-- SQL POUR ACTIVER RLS ET AJOUTER DES POLICES DE GESTION TOTALE (Facilite le développement)
-- Ce script active RLS sur toutes les tables et autorise TOUTES les opérations (Lecture/Écriture)
-- Note : En production réelle, vous devriez restreindre l'écriture aux utilisateurs authentifiés.

DO $$
DECLARE
    t text;
    tables text[] := ARRAY['products', 'categories', 'brands', 'customers', 'transactions', 'employees', 'cash_shifts', 'expenses', 'users', 'suppliers', 'vouchers', 'attendance'];
BEGIN
    FOR t IN SELECT unnest(tables) LOOP
        -- Activer RLS
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        
        -- Supprimer les anciennes polices si elles existent pour éviter les doublons
        EXECUTE format('DROP POLICY IF EXISTS "public_access_all" ON %I', t);
        
        -- Créer une police permissive pour TOUT (Anonyme + Authentifié)
        -- On utilise USING(true) pour SELECT/UPDATE/DELETE et WITH CHECK(true) pour INSERT/UPDATE
        EXECUTE format('CREATE POLICY "public_access_all" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;`;

  const sqlMigrationTables = `-- SCRIPT DE MIGRATION : AJOUTER LES COLONNES MANQUANTES ET SUPPRIMER LES CONTRAINTES DE CONFLIT
-- (Très utile si vous avez des erreurs de type "400 Bad Request", "409 Conflict" ou "500" lors d'un enregistrement / d'une synchronisation)

-- [RÉSOLUTION FAILLE 409 CONFLICT] Supprime les contraintes Strictes Unique sur Code-barres et SKU
-- pour éviter les blocages de synchronisation (les doublons ou cases vides sont tolérés par la base de données)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;

-- 1. Mise à jour de la table PRODUCTS (Produits)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_items JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity_discounts JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiration_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS show_in_pos BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS damaged_stock NUMERIC(12, 3) DEFAULT 0.000;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Mise à jour de la table CUSTOMERS (Clients)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_app_user BOOLEAN DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS join_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS favorite_items JSONB;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS alerts JSONB;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cashier_notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Mise à jour de la table SUPPLIERS (Fournisseurs)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS categories TEXT[];
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS feed_url TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS feed_format TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_sync TIMESTAMPTZ;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_app_user BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS has_full_inventory_access BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS balance NUMERIC(12, 2) DEFAULT 0.00;

-- Ensure array types for day selections
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS pre_sale_days TEXT[];
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS delivery_days TEXT[];
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_days TEXT[];

-- Migrate existing columns if they were erroneously created as integer or text instead of TEXT[]
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='pre_sale_days' AND data_type='integer') THEN
    ALTER TABLE suppliers ALTER COLUMN pre_sale_days TYPE TEXT[] USING ARRAY[pre_sale_days::text];
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='delivery_days' AND data_type='integer') THEN
    ALTER TABLE suppliers ALTER COLUMN delivery_days TYPE TEXT[] USING ARRAY[delivery_days::text];
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='payment_days' AND data_type='integer') THEN
    ALTER TABLE suppliers ALTER COLUMN payment_days TYPE TEXT[] USING ARRAY[payment_days::text];
  END IF;
END $$;

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS planning_notes TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Mise à jour de la table TRANSACTIONS (Ventes)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS points_discount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_used NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS voucher_discount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_wholesale BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS online_order_id TEXT;
`;

  const sqlDropTables = `-- SCRIPT DE NETTOYAGE RADICAL (⚠️ PRUDENCE : EFFACE TOUTES LES DONNÉES)
-- Exécutez ce script pour réinitialiser complètement la base avant de recréer les tables neuves de zéro :

DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS vouchers CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS cash_shifts CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS brands CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
`;

  // Get active connection visual properties
  const isOk = isSupabaseConfigured && tables.every(t => !t.error);
  const anyError = tables.some(t => t.error !== null);
  const missingTables = tables.filter(t => t.error?.includes('42P01') || t.error?.includes('relation') || t.error?.includes('does not exist')).map(t => t.mappedName);

  useEffect(() => {
    if (anyError && activeSection === null) {
      setActiveSection('tables');
    }
  }, [anyError]);

  return (
    <div className="space-y-6">
      {/* 0. Critical Setup Warning */}
      {isSupabaseConfigured && missingTables.length > 0 && (
        <Card className="p-5 border-rose-500/30 bg-rose-950/20 border-l-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
              <ShieldAlert size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-black text-white uppercase tracking-tight">Tables Manquantes sur Supabase !</h3>
              <p className="text-[11px] text-rose-200/80 leading-relaxed font-medium">
                Votre base de données cloud est connectée mais les tables suivantes sont introuvables : 
                <span className="text-white bg-rose-500/20 px-2 py-0.5 rounded ml-1 font-mono">{missingTables.join(', ')}</span>.
              </p>
              <div className="p-2 mt-1 bg-black/30 rounded border border-rose-500/10">
                <p className="text-[9px] text-rose-300 leading-tight">
                  <b>Où coller ?</b> Connectez-vous à app.supabase.com → Choisissez votre projet → Cliquez sur l'icône <b>SQL Editor</b> (menu de gauche) → Cliquez sur <b>+ New query</b> → Collez et cliquez sur <b>RUN</b>.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button 
                  onClick={() => handleCopy(sqlCreateTables, 'Script de création de table')}
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider py-1.5 px-3 rounded shadow-md group"
                >
                  <Copy size={12} className="mr-1.5 group-hover:scale-110 transition-transform" />
                  Copier le Script SQL de Création
                </Button>
                <div className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                <p className="text-[9px] text-rose-300 font-bold uppercase tracking-widest">Collez-le dans le SQL Editor de Supabase</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 1. Header Overview */}
      <Card className="p-6 border-indigo-500/20 bg-indigo-950/20 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl ${isSupabaseConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <Database size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Console de Diagnostic Supabase</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                  isSupabaseConfigured ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                }`}>
                  {isSupabaseConfigured ? 'Actif' : 'Non Configuré'}
                </span>
              </div>
              <p className="text-xs text-white/50 font-medium mt-1">
                Vérification en temps réel de votre connexion cloud, de la structure des schémas SQL PostgreSQL et des verrous de sécurité RLS.
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={runDiagnostics} 
              disabled={!isSupabaseConfigured}
              variant="outline"
              className="border-white/10 hover:bg-white/5 text-xs text-white uppercase font-black tracking-widest gap-2 py-2"
            >
              <RefreshCw size={14} className={tables.some(t => t.loading) ? 'animate-spin' : ''} />
              Re-Tester
            </Button>
            <Button 
              onClick={handleSyncNow}
              disabled={!isSupabaseConfigured || isSyncing}
              className="industrial-button-primary uppercase font-black text-[10px] tracking-widest gap-2 py-2 px-4 shadow-lg shadow-indigo-500/20"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              Forcer Synchro
            </Button>
          </div>
        </div>

        {/* Credentials Status alert if unconfigured */}
        {!isSupabaseConfigured && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} />
              <p className="font-bold text-xs">Clés de Securité d'Environnement Manquantes</p>
            </div>
            <p className="text-[11px] leading-relaxed">
              L'application tourne actuellement en mode <b>Émulateur hors-ligne local (Local Storage)</b>. Vos données ne sont pas sauvegardées sur le Cloud de Supabase.
            </p>
            <div className="pt-1 text-[11px] space-y-1">
              <p>👉 Pour lier l'application à votre compte Supabase :</p>
              <ol className="list-decimal pl-5 space-y-0.5">
                <li>Allez dans le menu <b>Settings</b> d'AI Studio (icône d'engrenage en haut à droite).</li>
                <li>Ajoutez deux clés secrètes d'environnement :
                  <ul className="list-disc pl-4 mt-0.5 font-mono text-white/70">
                    <li><code className="text-indigo-300">VITE_SUPABASE_URL</code> : URL de votre projet Supabase.</li>
                    <li><code className="text-indigo-300">VITE_SUPABASE_ANON_KEY</code> : Clé d'API publique ("anon").</li>
                  </ul>
                </li>
                <li>Cliquez sur <b>Restart Dev Server</b> si nécessaire pour appliquer.</li>
              </ol>
            </div>
          </div>
        )}
      </Card>

      {/* 2. Interactive action boxes for database sync and demo creation */}
      {isSupabaseConfigured && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5 border-white/5 bg-slate-900/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-indigo-400">
                <Sparkles size={18} />
                <h4 className="font-black text-sm uppercase tracking-wider text-white">Insérer les Produits de Démo</h4>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed mt-2 font-medium">
                Vous venez de créer vos tables mais elles sont entièrement vides ? Cliquez pour injecter instantanément des produits modèles (Coca-Cola, Sidi Ali, Yaourt) avec des prix, codes-barres et catégories pour valider que l'interface de caisse fonctionne !
              </p>
            </div>
            <div className="mt-4">
              <Button 
                onClick={insertDemoData} 
                disabled={isInsertingDemo}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white uppercase text-[10px] tracking-widest font-black py-3 rounded-lg flex items-center justify-center gap-2"
              >
                {isInsertingDemo ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                Générer Produits Modèles
              </Button>
            </div>
          </Card>

          <Card className="p-5 border-white/5 bg-slate-900/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-400">
                <Layers size={18} />
                <h4 className="font-black text-sm uppercase tracking-wider text-white">Pourquoi la base est vide d'origine ?</h4>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed mt-2 font-medium">
                Lorsque vous connectez un tout nouveau projet Supabase, il ne contient aucune donnée. 
                 Si vous avez déjà des produits dans votre historique local, vous pouvez aussi forcer la synchronisation manuelle.
                 Vous êtes connecté en tant qu'<b>Administrateur</b> car vous utilisez l'email d'administration configuré.
              </p>
            </div>
            <div className="mt-4">
              <Button 
                onClick={handleSyncNow} 
                disabled={isSyncing}
                variant="outline"
                className="w-full border-white/10 hover:bg-white/5 text-white uppercase text-[10px] tracking-widest font-black py-3 rounded-lg flex items-center justify-center gap-2"
              >
                {isSyncing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                Forcer Rafraîchissement Web
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Outils de réparation / nettoyage de cache et images */}
      <Card className="p-5 border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30 transition-all duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle size={18} />
              <h4 className="font-black text-sm uppercase tracking-wider text-white">Nettoyer les images AI Studio expirées (Erreurs 401/404)</h4>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed max-w-2xl font-medium">
              Si vous observez des erreurs de chargement d'image (<code className="text-amber-300 font-mono">401 Unauthorized</code> ou <code className="text-rose-300 font-mono">404 Not Found</code>) dans la console de votre navigateur, cela provient d'anciennes illustrations temporaires d'AI Studio qui ont expiré. Cliquez sur ce bouton pour les détecter et supprimer l'URL cassée de vos données (locales et Cloud).
            </p>
          </div>
          <Button
            onClick={handleCleanupAIStudioFiles}
            disabled={isCleaning}
            className="w-full sm:w-auto shrink-0 bg-amber-600 hover:bg-amber-700 text-white uppercase text-[10px] tracking-widest font-black py-3 px-6 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-amber-600/15"
          >
            {isCleaning ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            {isCleaning ? "Nettoyage..." : "DÉTECTER & NETTOYER"}
          </Button>
        </div>
      </Card>

      {/* 3. Table Inspection List */}
      {isSupabaseConfigured && (
        <Card className="p-6 border-white/5 bg-slate-900/40">
          <h4 className="text-xs font-black text-white/40 uppercase tracking-widest mb-4">Inspection des Tables Cloud (Supabase)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {tables.map(t => (
              <div 
                key={t.mappedName} 
                className={`p-3 rounded-xl border flex flex-col justify-between h-24 transition-all duration-300 ${
                  t.loading 
                    ? 'border-white/5 bg-slate-900/10 animate-pulse'
                    : t.error
                      ? 'border-rose-500/20 bg-rose-500/5'
                      : t.count !== null && t.count > 0
                        ? 'border-emerald-500/20 bg-emerald-500/5'
                        : 'border-white/5 bg-slate-900/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-black text-white leading-tight">{t.name}</p>
                    <p className="text-[9px] font-mono text-white/40 mt-0.5">{t.mappedName}</p>
                  </div>
                  {t.loading ? (
                    <RefreshCw size={12} className="animate-spin text-indigo-400 mt-1" />
                  ) : t.error ? (
                    <XCircle size={14} className="text-rose-400 mt-1" />
                  ) : t.count !== null && t.count > 0 ? (
                    <CheckCircle size={14} className="text-emerald-400 mt-1" />
                  ) : (
                    <HelpCircle size={14} className="text-amber-400/50 mt-1" />
                  )}
                </div>

                <div className="mt-2">
                  {t.loading ? (
                    <span className="text-[10px] text-white/30 font-medium">Chargement...</span>
                  ) : t.error ? (
                    <div className="group relative">
                      <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded truncate cursor-help block max-w-full">
                        Erreur Table ❌
                      </span>
                      <div className="absolute bottom-6 left-0 right-0 z-50 p-2 bg-slate-950 text-white text-[8px] rounded-lg border border-rose-500/20 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-normal leading-normal max-h-24 overflow-y-auto no-scrollbar">
                        {t.error}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className={`text-base font-black font-mono leading-none ${t.count !== null && t.count > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {t.count}
                      </span>
                      <span className="text-[9px] text-white/30 font-bold uppercase tracking-wide">Ligne(s)</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {anyError && (
            <div className="mt-4 p-4 rounded-xl bg-rose-500/15 border border-rose-500/20 text-rose-300">
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-bold text-xs uppercase tracking-tight">Problème d'Accés Détecté !</p>
                  <p className="text-[11px] leading-relaxed text-rose-300/80">
                    Une ou plusieurs tables rapportent une erreur. Cela signifie généralement deux choses :
                  </p>
                  <ul className="text-[10px] list-disc pl-4 mt-1 leading-relaxed text-rose-400 font-bold space-y-0.5">
                    <li>La table n'a pas encore été créée dans votre console Supabase SQL Editor.</li>
                    <li>Le Row Level Security (RLS) est activé, mais aucune politique d'accès n'existe pour autoriser l'API publique à y accéder.</li>
                  </ul>
                  <p className="text-[11px] mt-2 font-medium">👇 Déroulez la section d'aide ci-dessous pour résoudre l'erreur instantanément avec l'éditeur SQL de Supabase.</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 4. Troubleshooting expandable console */}
      <Card className="p-6 border-white/5 bg-slate-900/20">
        <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4">
          <BookOpen size={16} className="text-indigo-400" />
          Guides de Configuration & Scripts SQL Supabase
        </h4>

        <div className="space-y-2">
          {/* Item 1: Create Tables */}
          <div className="border border-white/[0.03] rounded-xl overflow-hidden bg-slate-950/40">
            <button 
              onClick={() => setActiveSection(activeSection === 'tables' ? null : 'tables')}
              className="w-full flex items-center justify-between p-4 text-left font-bold text-xs uppercase tracking-wider text-white hover:bg-white/[0.03]"
            >
              <span className="flex items-center gap-2">
                <Code size={14} className="text-cyan-400" />
                1. Créer les Tables SQL de Base (Nouvelle configuration)
              </span>
              {activeSection === 'tables' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {activeSection === 'tables' && (
              <div className="p-4 border-t border-white/[0.03] space-y-3 bg-slate-950/80">
                <p className="text-[11px] text-white/60 leading-relaxed font-medium">
                  Copiez ce script SQL, ouvrez le <b>SQL Editor</b> dans votre tableau de bord Supabase, cliquez sur <b>New Query</b>, collez-le et cliquez sur <b>Run</b> :
                </p>
                <div className="relative">
                  <pre className="text-[10px] font-mono text-cyan-300 bg-black/60 p-4 rounded-xl overflow-x-auto max-h-60 border border-white/5 whitespace-pre">
                    {sqlCreateTables}
                  </pre>
                  <Button 
                    onClick={() => handleCopy(sqlCreateTables, 'Script de création de table')}
                    className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-[9px] font-black uppercase tracking-widest gap-1 flex items-center h-auto"
                  >
                    <Copy size={10} /> Copier
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Item 2: Migration (Add missing columns to existing tables) */}
          <div className="border border-indigo-500/20 rounded-xl overflow-hidden bg-indigo-950/20">
            <button 
              onClick={() => setActiveSection(activeSection === 'migration' ? null : 'migration')}
              className="w-full flex items-center justify-between p-4 text-left font-bold text-xs uppercase tracking-wider text-indigo-300 hover:bg-indigo-950/40"
            >
              <span className="flex items-center gap-2">
                <Layers size={14} className="text-indigo-400" />
                2. SCRIPT DE MIGRATION : Ajouter les colonnes manquantes (Résout les erreurs 400 et 500)
              </span>
              {activeSection === 'migration' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {activeSection === 'migration' && (
              <div className="p-4 border-t border-indigo-500/10 space-y-3 bg-slate-950/80">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300 text-[11px] leading-relaxed">
                  💡 <b>Pourquoi cette étape est incontournable ?</b> Si vous obtenez des erreurs <b>400 Bad Request</b>, <b>409 Conflict</b> ou <b>500 Internal Server Error</b> lors de la synchronisation, cela signifie que vos tables réelles n'ont pas encore les bonnes colonnes ou que les index de conflit (ID) sont bloqués. Copiez et exécutez ce script pour mettre à jour la structure sans perdre de données.
                </div>
                <div className="relative">
                  <pre className="text-[10px] font-mono text-indigo-300 bg-black/60 p-4 rounded-xl overflow-x-auto max-h-60 border border-white/5 whitespace-pre">
                    {sqlMigrationTables}
                  </pre>
                  <Button 
                    onClick={() => handleCopy(sqlMigrationTables, 'Script de migration de table')}
                    className="absolute top-2 right-2 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[9px] font-black uppercase tracking-widest gap-1 flex items-center h-auto"
                  >
                    <Copy size={10} /> Copier
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Item 3: Disable RLS for testing */}
          <div className="border border-white/[0.03] rounded-xl overflow-hidden bg-slate-950/40">
            <button 
              onClick={() => setActiveSection(activeSection === 'rls_disable' ? null : 'rls_disable')}
              className="w-full flex items-center justify-between p-4 text-left font-bold text-xs uppercase tracking-wider text-white hover:bg-white/[0.03]"
            >
              <span className="flex items-center gap-2">
                <Lock size={14} className="text-amber-400" />
                3. Désactiver le RLS (Recommandé pour tester)
              </span>
              {activeSection === 'rls_disable' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {activeSection === 'rls_disable' && (
              <div className="p-4 border-t border-white/[0.03] space-y-3 bg-slate-950/80">
                <p className="text-[11px] text-white/60 leading-relaxed font-medium">
                  Par défaut, Supabase bloque toutes les requêtes si le RLS est activé mais qu'aucune règle de droit n'est définie. 
                  Désactivez temporairement la sécurité (RLS) sur vos tables pour vérifier si les erreurs d'accès proviennent de là :
                </p>
                <div className="relative">
                  <pre className="text-[10px] font-mono text-amber-300 bg-black/60 p-4 rounded-xl overflow-x-auto border border-white/5">
                    {sqlDisableRLS}
                  </pre>
                  <Button 
                    onClick={() => handleCopy(sqlDisableRLS, 'Script de désactivation RLS')}
                    className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-[9px] font-black uppercase tracking-widest gap-1 flex items-center h-auto"
                  >
                    <Copy size={10} /> Copier
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Item 4: Enable RLS and add public SELECT */}
          <div className="border border-white/[0.03] rounded-xl overflow-hidden bg-slate-950/40">
            <button 
              onClick={() => setActiveSection(activeSection === 'rls_public' ? null : 'rls_public')}
              className="w-full flex items-center justify-between p-4 text-left font-bold text-xs uppercase tracking-wider text-white hover:bg-white/[0.03]"
            >
              <span className="flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-400" />
                4. Activer RLS avec accès Lecture Publique (Sécurité Production)
              </span>
              {activeSection === 'rls_public' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {activeSection === 'rls_public' && (
              <div className="p-4 border-t border-white/[0.03] space-y-3 bg-slate-950/80">
                <p className="text-[11px] text-white/60 leading-relaxed font-medium">
                  Pour sécuriser votre application tout en restant capable de lire et ECRIRE (Update/Upsert) sans blocage, activez les règles RLS permissives. 
                  Cela résout généralement l'erreur <b>409 Conflict</b> qui survient lors de l'écrasement (Upsert) de données existantes si la police UPDATE est manquante.
                </p>
                <div className="relative">
                  <pre className="text-[10px] font-mono text-emerald-300 bg-black/60 p-4 rounded-xl overflow-x-auto border border-white/5 select-all">
                    {sqlEnableRLSPublic}
                  </pre>
                  <Button 
                    onClick={() => handleCopy(sqlEnableRLSPublic, 'Script RLS public')}
                    className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-[9px] font-black uppercase tracking-widest gap-1 flex items-center h-auto"
                  >
                    <Copy size={10} /> Copier
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Item 5: Drop and Recreate cleanly */}
          <div className="border border-rose-500/20 rounded-xl overflow-hidden bg-rose-950/10">
            <button 
              onClick={() => setActiveSection(activeSection === 'cleanup' ? null : 'cleanup')}
              className="w-full flex items-center justify-between p-4 text-left font-bold text-xs uppercase tracking-wider text-rose-400 hover:bg-rose-950/20"
            >
              <span className="flex items-center gap-2">
                <XCircle size={14} className="text-rose-500" />
                5. RÉINITIALISATION COMPLÈTE : Vider et supprimer toutes les tables (⚠️ Destructif)
              </span>
              {activeSection === 'cleanup' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {activeSection === 'cleanup' && (
              <div className="p-4 border-t border-rose-500/10 space-y-3 bg-slate-950/80">
                <p className="text-[11px] text-rose-300/80 leading-relaxed font-bold">
                  ⚠️ ATTENTION : Cela détruira définitivement toutes les données de votre base Supabase cloud pour ces tables. Copiez, collez dans le SQL editor et exécutez ce script pour tout supprimer, puis vous pourrez ré-exécuter le script "1. Créer les Tables" pour repartir sur de bonnes bases.
                </p>
                <div className="relative">
                  <pre className="text-[10px] font-mono text-rose-400 bg-black/60 p-4 rounded-xl overflow-x-auto border border-white/5">
                    {sqlDropTables}
                  </pre>
                  <Button 
                    onClick={() => handleCopy(sqlDropTables, 'Script DROP TABLES')}
                    className="absolute top-2 right-2 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-black uppercase tracking-widest gap-1 flex items-center h-auto"
                  >
                    <Copy size={10} /> Copier
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

interface Loader2Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

const Loader2: React.FC<Loader2Props> = ({ size = 16, className, ...props }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={`animate-spin ${className}`}
    {...props}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
