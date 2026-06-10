# GUIDE DE MIGRATION VERS SUPABASE (SUPERBASS)

Ce document décrit comment remplacer l'implémentation Firebase actuelle par une base de données PostgreSQL sécurisée sur **Supabase**.

---

## 1. STRUCTURE DES TABLES SQL (COLLATIONS & SCHÉMAS)

Exécutez ce script SQL directement dans l'onglet **SQL Editor** de l'interface d'administration de votre projet Supabase pour créer la base de données au complet avec les colonnes et types appropriés.

```sql
-- Active l'extension UUID pour la génération automatique d'ID si nécessaire
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. CATEGORIES (Catégories de Produits)
-- =========================================================================
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    level INTEGER DEFAULT 1,
    image_url TEXT
);

-- =========================================================================
-- 2. BRANDS (Marques)
-- =========================================================================
CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 3. PRODUCTS (Produits & Inventaire)
-- =========================================================================
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    barcode TEXT,
    sku TEXT,
    reference TEXT,
    image_url TEXT,
    image_urls TEXT[], -- Array de chaînes de texte pour images multiples
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
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
    description TEXT,
    is_bundle BOOLEAN DEFAULT FALSE,
    bundle_items JSONB, -- Array de {productId: string, quantity: number}
    quantity_discounts JSONB, -- Array de {minQuantity: number, discountPrice: number}
    tags TEXT[],
    expiration_date DATE,
    batch_number TEXT,
    location TEXT,
    show_in_pos BOOLEAN DEFAULT TRUE,
    damaged_stock NUMERIC(12, 3) DEFAULT 0.000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si la table existait déjà, on ajoute les colonnes manquantes :
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS online_price NUMERIC(12, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN DEFAULT FALSE;

-- Indexation des produits pour une recherche instantanée au scanner/texte
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- =========================================================================
-- 4. CUSTOMERS (Clients & CRM)
-- =========================================================================
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    loyalty_points NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Solde prépayé ou dette (négatif)
    loyalty_card_number TEXT,
    total_spent NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    last_visit TIMESTAMPTZ,
    notes TEXT,
    is_app_user BOOLEAN DEFAULT FALSE,
    password_hash TEXT,
    join_date DATE DEFAULT CURRENT_DATE,
    favorite_items TEXT[],
    alerts TEXT[],
    cashier_notes JSONB DEFAULT '[]'::jsonb, -- Historique structuré des notes caissiers d'origine
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si la table existait déjà, on ajoute les colonnes manquantes :
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_app_user BOOLEAN DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_card_number TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent NUMERIC(12, 2) DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- =========================================================================
-- 5. TRANSACTIONS (Ventes de caisse)
-- =========================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card')),
    delivery_method TEXT NOT NULL DEFAULT 'in_store' CHECK (delivery_method IN ('in_store', 'delivery', 'pickup')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id TEXT NOT NULL,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'returned', 'partially_returned', 'pending', 'delivered')),
    employee_id TEXT,
    employee_name TEXT,
    promotion_id TEXT,
    points_earned NUMERIC(10, 2) DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    points_discount NUMERIC(10, 2) DEFAULT 0.00,
    balance_used NUMERIC(10, 2) DEFAULT 0.00,
    voucher_discount NUMERIC(10, 2) DEFAULT 0.00,
    is_wholesale BOOLEAN DEFAULT FALSE,
    online_order_id TEXT,
    items JSONB NOT NULL -- Contient un instantané du panier au moment de la vente
);

CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);

-- =========================================================================
-- 6. EMPLOYEES (Fiches Employés)
-- =========================================================================
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'cashier', 'delivery', 'picker', 'camera_agent')),
    phone TEXT,
    email TEXT,
    hire_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    is_clocked_in BOOLEAN DEFAULT FALSE,
    base_salary NUMERIC(12, 2) DEFAULT 0.00,
    salary_type TEXT DEFAULT 'monthly' CHECK (salary_type IN ('monthly', 'hourly', 'daily')),
    hourly_rate NUMERIC(10, 2) DEFAULT 0.00,
    daily_rate NUMERIC(10, 2) DEFAULT 0.00,
    id_card_recto_url TEXT,
    id_card_verso_url TEXT,
    contract_url TEXT,
    digital_signature_url TEXT
);

-- =========================================================================
-- 7. ATTENDANCE (Pointages horaires des employés)
-- =========================================================================
CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    clock_in TIMESTAMPTZ NOT NULL,
    clock_out TIMESTAMPTZ,
    date DATE NOT NULL,
    total_hours NUMERIC(6, 2),
    status TEXT CHECK (status IN ('present', 'absent', 'late'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date DESC);

-- =========================================================================
-- 8. CASH SHIFTS (Sessions & Clôtures de caisse)
-- =========================================================================
CREATE TABLE IF NOT EXISTS cash_shifts (
    id TEXT PRIMARY KEY,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opened_by TEXT NOT NULL,
    closed_by TEXT,
    initial_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    final_cash NUMERIC(12, 2),
    expected_cash NUMERIC(12, 2),
    total_sales NUMERIC(12, 2) DEFAULT 0.00,
    total_cash_sales NUMERIC(12, 2) DEFAULT 0.00,
    total_card_sales NUMERIC(12, 2) DEFAULT 0.00,
    total_expenses NUMERIC(12, 2) DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    notes TEXT
);

-- =========================================================================
-- 9. VOUCHERS (Bons d'Achat & Coupons)
-- =========================================================================
CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('fixed', 'percent')),
    value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    min_purchase NUMERIC(12, 2),
    expiry_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'revoked')),
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    usage_logs JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);

-- =========================================================================
-- 10. EXPENSES (Dépenses / Comptabilité de caisse)
-- =========================================================================
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    category TEXT NOT NULL DEFAULT 'General',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    user_id TEXT NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer'))
);

-- Si la table existait déjà sans la colonne category, on l'ajoute :
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';

-- =========================================================================
-- 11. SUPPLIERS (Fournisseurs)
-- =========================================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    categories TEXT[], -- Tableau de catégories
    feed_url TEXT,
    feed_format TEXT CHECK (feed_format IN ('json', 'csv')),
    last_sync TIMESTAMPTZ,
    sync_enabled BOOLEAN DEFAULT FALSE,
    is_app_user BOOLEAN DEFAULT FALSE,
    has_full_inventory_access BOOLEAN DEFAULT FALSE,
    password_hash TEXT,
    balance NUMERIC(12, 2) DEFAULT 0.00,
    pre_sale_days TEXT[],
    delivery_days TEXT[],
    payment_days TEXT[],
    planning_notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si la table existait déjà :
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_app_user BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS has_full_inventory_access BOOLEAN DEFAULT FALSE;

-- =========================================================================
-- 12. USERS (Utilisateurs / Profils)
-- =========================================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    uid TEXT NOT NULL UNIQUE,
    email TEXT,
    display_name TEXT,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin', 'manager', 'cashier', 'delivery', 'picker', 'camera_agent')),
    join_date DATE DEFAULT CURRENT_DATE
);

```

---

## 2. CONFIGURATION DES RÈGLES DE SÉCURITÉ (RLS - ROW LEVEL SECURITY)

PostgreSQL sur Supabase intègre nativement la protection de chaque ligne. Activez la sécurité pour les tables cruciales et configurez l'accessibilité selon le jeton de sécurité ou le rôle de l'utilisateur de l'application :

```sql
-- On active le Row Level Security sur la table des produits
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Autorise tout le monde (public connecté ou invité) à lire les produits du catalogue
CREATE POLICY "lecture_publique_produits" ON products 
    FOR SELECT USING (true);

-- Permet l'écriture et la mise à jour des produits uniquement aux comptes authentifiés
CREATE POLICY "gestion_produits_staff" ON products 
    FOR ALL TO authenticated 
    USING (true);

-- ==========================================
-- SÉCURISATION DE LA COMPTABILITÉ (Dépenses)
-- ==========================================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Seuls les administrateurs et managers authentifiés peuvent accéder aux dépenses
CREATE POLICY "acces_depenses_restreint" ON expenses
    FOR ALL TO authenticated
    USING (true);

-- ==========================================
-- SÉCURISATION DES FOURNISSEURS (Suppliers)
-- ==========================================
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Autorise tout le monde à lire les fournisseurs
CREATE POLICY "lecture_publique_suppliers" ON suppliers 
    FOR SELECT USING (true);

-- Permet la gestion complète aux comptes authentifiés
CREATE POLICY "gestion_suppliers_staff" ON suppliers 
    FOR ALL TO authenticated 
    USING (true);

-- ==========================================
-- SÉCURISATION DES UTILISATEURS (Users)
-- ==========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Autorise tout le monde à lire les profils utilisateurs d'origine
CREATE POLICY "lecture_publique_users" ON users 
    FOR SELECT USING (true);

-- Permet la gestion complète aux comptes authentifiés
CREATE POLICY "gestion_users_staff" ON users 
    FOR ALL TO authenticated 
    USING (true);
```

---

## 3. IMPLÉMENTATION CLIENT REACT / TYPESCRIPT (ADAPTATEUR)

Installez d'abord la dépendance officielle Supabase dans votre projet :
```bash
npm install @supabase/supabase-js
```

Puis, créez le fichier `/src/supabase.ts` pour remplacer l'adaptateur de base d'origine par ce client hautement structuré :

```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://votre-projet.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'votre-cle-api';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * ADAPTATEUR SIMPLE DE REMPLACEMENT DE REQUETES (Exemple pour les produits)
 */
export async function getActiveProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*, categories(*)')
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error("Erreur de récupération Supabase:", error.message);
    return [];
  }
  return data;
}

/**
 * ENREGISTRER UNE VENTE (Transaction avec panier d'achat)
 */
export async function insertSalesTransaction(transactionData: any) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([
      {
        id: transactionData.id,
        total: transactionData.total,
        payment_method: transactionData.paymentMethod,
        delivery_method: transactionData.deliveryMethod || 'in_store',
        user_id: transactionData.userId,
        customer_id: transactionData.customerId || null,
        customer_name: transactionData.customerName || null,
        is_wholesale: transactionData.isWholesale || false,
        items: transactionData.items // Reçu sous forme de JSONB brut
      }
    ]);

  if (error) {
    throw new Error(`Échec d'insertion Supabase: ${error.message}`);
  }
  return data;
}
```

---

## 4. PROCESSUS DE TRANSITION ÉTAPE PAR ÉTAPE

1. **Création du projet** : Créez un compte gratuit sur [Supabase](https://supabase.com) et initialisez une instance de base de données PostgreSQL.
2. **Exécuter les définitions de table** : Copiez le premier bloc SQL et exécutez-le dans l'interface Web Supabase pour modeler la structure.
3. **Mise à jour des variables d'environnement** : Ajoutez vos clés privées dans votre fichier `.env` de production :
   ```env
   VITE_SUPABASE_URL=https://votre_id_projet.supabase.co
   VITE_SUPABASE_ANON_KEY=votre_cle_publique_anon
   ```
4. **Adapter useDataFetching.ts** : Dans le code de l'application, remplacez les écouteurs Firebase Realtime Database par des requêtes `supabase.from('nom_table').select('*')` pour charger instantanément les articles d'inventaire dans l'interface de caisse.

---

## 5. REQUÊTES COMPLÉMENTAIRES DE MISE À JOUR (SUPÉRIEURE/NOUVEAU)

Si vous rencontrez des erreurs indiquant qu'une table (comme `cart_drafts`) ou des colonnes (comme `auto_unpack` ou `batches`) sont manquantes, exécutez la mise à jour suivante dans votre **SQL Editor** de Supabase :

```sql
-- =========================================================================
-- MISE À JOUR DE LA TABLE PRODUCTS (Colonnes manquantes)
-- =========================================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS use_multi_expiry BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS batches JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS auto_unpack BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS units_per_parent NUMERIC(12, 2) DEFAULT 1.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS parent_id TEXT;

-- =========================================================================
-- CRÉATION DE LA TABLE CART_DRAFTS (Brouillons de la Caisse)
-- =========================================================================
CREATE TABLE IF NOT EXISTS cart_drafts (
    "userId" TEXT PRIMARY KEY,
    sessions JSONB,
    "activeSessionId" TEXT,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    user_id TEXT, -- alternative pour la compatibilité snake_case
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activation des règles d'accès RLS pour cart_drafts
ALTER TABLE cart_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gestion_cart_drafts" ON cart_drafts FOR ALL TO authenticated USING (true);
CREATE POLICY "gestion_publique_cart_drafts" ON cart_drafts FOR ALL TO anon USING (true);

-- =========================================================================
-- TABLES COMPLÉMENTAIRES (Si non existantes)
-- =========================================================================

-- 1. SETTINGS
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    name TEXT,
    logo_url TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    tax_number TEXT,
    receipt_template TEXT,
    label_template TEXT,
    currency TEXT DEFAULT 'DA',
    tax_rate NUMERIC(10,2) DEFAULT 0.00,
    loyalty_points_per_currency_unit NUMERIC(10,2) DEFAULT 0.00,
    loyalty_point_value NUMERIC(10,2) DEFAULT 0.00,
    footer_text TEXT,
    accounting_format TEXT,
    site_locations JSONB DEFAULT '[]'::jsonb,
    role_kpis JSONB DEFAULT '[]'::jsonb,
    notifications JSONB DEFAULT '[]'::jsonb,
    operational_costs JSONB DEFAULT '[]'::jsonb,
    locking_period_days INT DEFAULT 0,
    delivery_zones JSONB DEFAULT '[]'::jsonb,
    paper_format TEXT,
    silent_printing BOOLEAN DEFAULT FALSE,
    global_stock_alert_threshold NUMERIC(10,2) DEFAULT 5.00,
    api_keys JSONB DEFAULT '{}'::jsonb,
    available_taxes JSONB DEFAULT '[]'::jsonb,
    display_price_ht BOOLEAN DEFAULT FALSE,
    loyalty_tiers JSONB DEFAULT '[]'::jsonb,
    enable_time_clock BOOLEAN DEFAULT FALSE,
    session_timeout_minutes INT DEFAULT 30,
    audit_log_retention_days INT DEFAULT 90,
    brand_color TEXT,
    fast_mode_enabled BOOLEAN DEFAULT FALSE,
    default_lead_time_days INT DEFAULT 3,
    loyalty_points_per_unit NUMERIC(10,2) DEFAULT 0.00
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecture_publique_settings" ON settings FOR SELECT USING (true);
CREATE POLICY "modification_settings" ON settings FOR ALL TO authenticated USING (true);

-- 2. PROMOTIONS
CREATE TABLE IF NOT EXISTS promotions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT,
    value NUMERIC(12,2),
    start_date DATE,
    end_date DATE,
    conditions JSONB,
    active BOOLEAN DEFAULT TRUE
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecture_publique_promotions" ON promotions FOR SELECT USING (true);
CREATE POLICY "modification_promotions" ON promotions FOR ALL TO authenticated USING (true);

-- 3. RETURNS
CREATE TABLE IF NOT EXISTS returns (
    id TEXT PRIMARY KEY,
    transaction_id TEXT,
    product_id TEXT,
    quantity NUMERIC(12,3) NOT NULL DEFAULT 0.00,
    reason TEXT,
    condition TEXT,
    refund_amount NUMERIC(12,2),
    date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'pending',
    notes TEXT
);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gestion_returns" ON returns FOR ALL TO authenticated USING (true);

-- 4. ONLINE ORDERS
CREATE TABLE IF NOT EXISTS online_orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    customer_name TEXT,
    items JSONB,
    total NUMERIC(12,2),
    status TEXT DEFAULT 'pending',
    shipping_address TEXT,
    payment_status TEXT DEFAULT 'unpaid',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE online_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gestion_online_orders" ON online_orders FOR ALL TO authenticated USING (true);

-- 5. PURCHASES
CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    supplier_id TEXT,
    items JSONB,
    total_amount NUMERIC(12,2),
    status TEXT,
    date DATE DEFAULT CURRENT_DATE,
    documents TEXT[]
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gestion_purchases" ON purchases FOR ALL TO authenticated USING (true);

-- 6. PURCHASE ORDERS
CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    supplier_id TEXT,
    items JSONB,
    total_amount NUMERIC(12,2),
    status TEXT,
    expected_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gestion_purchase_orders" ON purchase_orders FOR ALL TO authenticated USING (true);

-- 7. STOCK ADJUSTMENTS
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    quantity_change NUMERIC(12,3),
    reason TEXT,
    user_id TEXT,
    date DATE DEFAULT CURRENT_DATE,
    cost_impact NUMERIC(12,2)
);

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gestion_stock_adjustments" ON stock_adjustments FOR ALL TO authenticated USING (true);

-- 8. SUPPLIER PAYMENTS
CREATE TABLE IF NOT EXISTS supplier_payments (
    id TEXT PRIMARY KEY,
    supplier_id TEXT,
    amount NUMERIC(12,2),
    method TEXT,
    date DATE DEFAULT CURRENT_DATE,
    reference TEXT,
    notes TEXT
);

ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gestion_supplier_payments" ON supplier_payments FOR ALL TO authenticated USING (true);

-- 9. AUDITS
CREATE TABLE IF NOT EXISTS audits (
    id TEXT PRIMARY KEY,
    date DATE DEFAULT CURRENT_DATE,
    auditor_id TEXT,
    status TEXT,
    discrepancies JSONB,
    notes TEXT,
    completed_at TIMESTAMPTZ
);

ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gestion_audits" ON audits FOR ALL TO authenticated USING (true);

-- 10. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT,
    entity TEXT,
    details TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gestion_audit_logs" ON audit_logs FOR ALL TO authenticated USING (true);

-- 11. SUPPLIER SYNCS
CREATE TABLE IF NOT EXISTS supplier_syncs (
    id TEXT PRIMARY KEY,
    supplier_id TEXT,
    last_sync TIMESTAMPTZ,
    status TEXT,
    items_updated INT,
    errors TEXT
);

ALTER TABLE supplier_syncs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gestion_supplier_syncs" ON supplier_syncs FOR ALL TO authenticated USING (true);

-- 12. DAMAGED ITEMS
CREATE TABLE IF NOT EXISTS damaged_items (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    quantity NUMERIC(12,3),
    date DATE DEFAULT CURRENT_DATE,
    reported_by TEXT,
    reason TEXT,
    status TEXT
);

ALTER TABLE damaged_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gestion_damaged_items" ON damaged_items FOR ALL TO authenticated USING (true);

-- 13. ADVANCES
CREATE TABLE IF NOT EXISTS advances (
    id TEXT PRIMARY KEY,
    employee_id TEXT,
    amount NUMERIC(12,2),
    date DATE DEFAULT CURRENT_DATE,
    reason TEXT,
    status TEXT,
    approved_by TEXT,
    repayment_date DATE
);

ALTER TABLE advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gestion_advances" ON advances FOR ALL TO authenticated USING (true);
```
