
export interface AdvanceRecord { 
  id: string; 
  employeeId: string; 
  amount: number; 
  date: string; 
  reason: string; 
  status: 'pending' | 'approved' | 'paid'; 
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  level?: number;
  imageUrl?: string;
}

export interface PriceHistoryEntry {
  price: number;
  costPrice: number;
  timestamp: string;
  reason?: string;
}

export interface Brand {
  id: string;
  name: string;
  logoUrl?: string;
  description?: string;
  createdAt?: string;
}

export interface ProductBatch {
  id: string;
  batchNumber: string;
  expirationDate: string; // ISO date string
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  image?: string;
  price: number;
  onlinePrice?: number;
  costPrice: number;
  taxRate: number;
  stock: number;
  minStock: number;
  categoryId: string;
  brandId?: string;
  supplier: string;
  unit: string;
  sku: string;
  status: 'active' | 'inactive' | 'discontinued';
  imageUrl?: string;
  imageUrls?: string[];
  description?: string;
  isBundle?: boolean;
  bundleItems?: { productId: string; quantity: number }[];
  quantityDiscounts?: { minQuantity: number; discountPrice: number }[];
  wholesalePrice?: number;
  tags?: string[];
  expirationDate?: string;
  batchNumber?: string;
  batches?: ProductBatch[];
  useMultiExpiry?: boolean;
  location?: string;
  reference?: string;
  parentId?: string;
  unitsPerParent?: number;
  autoUnpack?: boolean;
  showInPos?: boolean;
  createdAt?: string;
  updatedAt: string;
  operationalCosts?: { packaging?: number; shipping?: number; other?: number };
  priceHistory?: PriceHistoryEntry[];
  damagedStock?: number;
  originalPrice?: number;
}

export interface OnlineOrder {
  id: string;
  externalOrderId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerId?: string | null;
  items: {
    lineId: string;
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  timestamp: string;
  paymentStatus: 'paid' | 'unpaid';
  paymentMethod?: 'cash' | 'card' | string;
  source: string;
  deliveryMethod?: 'delivery' | 'pickup';
  pickupTime?: string;
  shippingAddress?: string;
  syncedToPos?: boolean;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  assignedPickerId?: string;
  assignedPickerName?: string;
  statusHistory?: {
    status: string;
    changedBy: string;
    timestamp: string;
  }[];
}

export interface CartItem extends Product {
  quantity: number;
  cartItemId: string; 
  productName?: string;
  overriddenPrice?: number;
  lineDiscount?: {
    type: 'percentage' | 'fixed';
    value: number;
  };
}

export interface RolePermissions {
  canAccessInventory: boolean;
  canAccessSales: boolean;
  canAccessCustomers: boolean;
  canAccessEmployees: boolean;
  canAccessSuppliers: boolean;
  canAccessSettings: boolean;
  canAccessOnlineOrders: boolean;
  canAccessExpenses: boolean;
  canAccessReturns: boolean;
  canAccessPurchases: boolean;
  canAccessPromotions: boolean;
  canAccessVouchers: boolean;
  canAccessAnalytics: boolean;
  canAccessShifts: boolean;
  canAccessAuditLogs: boolean;
  canModifyPrices: boolean;
  canApplyDiscount: boolean;
  canVoidTransaction: boolean;
  canManageUsers: boolean;
}

export interface Transaction {
  id: string;
  items: CartItem[];
  total: number;
  paymentMethod: 'cash' | 'card';
  deliveryMethod?: 'in_store' | 'delivery' | 'pickup';
  timestamp: string;
  userId: string;
  customerId?: string | null;
  customerName?: string | null;
  status?: 'completed' | 'returned' | 'partially_returned' | 'pending' | 'delivered';
  employeeId?: string;
  employeeName?: string;
  promotionId?: string;
  pointsEarned?: number;
  discountAmount?: number;
  pointsDiscount?: number;
  balanceUsed?: number;
  voucherDiscount?: number;
  isWholesale?: boolean;
  onlineOrderId?: string;
  auditStatus?: 'verified' | 'suspicious' | 'pending';
  auditedBy?: string;
  auditedAt?: string;
  auditNote?: string;
  auditDuration?: number;
}

export interface ProductReturn {
  id: string;
  transactionId: string;
  items: {
    lineId: string;
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  totalRefund: number;
  reason: string;
  timestamp: string;
  userId: string;
  customerId?: string | null;
  type: 'refund' | 'credit_note';
}

export interface UserProfile {
  id?: string;
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  password?: string;
  role: 'admin' | 'manager' | 'cashier' | 'delivery' | 'picker' | 'camera_agent';
  employeeId?: string;
  lastLogin?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  details: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
}

export interface CashShift {
  id: string;
  openedAt: string;
  closedAt?: string;
  openedBy: string;
  closedBy?: string;
  initialCash: number;
  finalCash?: number;
  expectedCash?: number;
  totalSales?: number;
  totalCashSales?: number;
  totalCardSales?: number;
  totalExpenses?: number;
  status: 'open' | 'closed';
  notes?: string;
}

export interface Promotion {
  id: string;
  name: string;
  type: 'percentage' | 'fixed' | 'buy_x_get_y';
  value: number;
  minPurchase?: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  applicableCategories?: string[];
  code?: string;
  buyQuantity?: number;
  getQuantity?: number;
  applicableProducts?: string[];
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  loyaltyPoints: number;
  balance: number;
  loyaltyCardNumber?: string;
  totalSpent: number;
  lastVisit?: string;
  notes?: string;
  isAppUser?: boolean;
  password?: string;
  updatedAt?: string;
  joinDate?: string;
  favoriteItems?: string[];
  alerts?: string[];
  cashierNotes?: { note: string; timestamp: string; author: string }[];
}

export interface SupplierReminder {
  id: string;
  date: string;
  title: string;
  notes?: string;
  isCompleted: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  categories?: string[];
  feedUrl?: string;
  feedFormat?: 'json' | 'csv';
  lastSync?: string;
  syncEnabled?: boolean;
  isAppUser?: boolean;
  hasFullInventoryAccess?: boolean;
  password?: string;
  balance?: number;
  preSaleDays?: string[];
  deliveryDays?: string[];
  paymentDays?: string[];
  planningNotes?: string;
  reminders?: SupplierReminder[];
  ratingQuality?: number;
  ratingDelivery?: number;
  ratingPrice?: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  orderNumber: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }[];
  total: number;
  status: 'pending' | 'validated' | 'received';
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier' | 'delivery' | 'picker' | 'camera_agent';
  phone?: string;
  email?: string;
  hireDate?: string;
  status: 'active' | 'inactive';
  isClockedIn?: boolean;
  baseSalary?: number;
  salaryType?: 'monthly' | 'hourly' | 'daily';
  hourlyRate?: number;
  dailyRate?: number;
  idCardRectoUrl?: string;
  idCardVersoUrl?: string;
  contractUrl?: string;
  digitalSignatureUrl?: string;
}

export interface AttendanceRecord {
  id: string;
  userId?: string;
  employeeId: string;
  employeeName: string;
  clockIn: string;
  clockOut?: string;
  date: string;
  totalHours?: number;
  status?: 'present' | 'absent' | 'late';
}

export interface SupplierSync {
  id: string;
  name?: string;
  supplierId: string;
  url: string;
  format: 'json' | 'csv';
  interval?: number;
  active?: boolean;
  mapping: {
    sku: string;
    name?: string;
    category?: string;
    description?: string;
    stock: string;
    price?: string;
    costPrice?: string;
  };
  lastSync?: string;
  isActive: boolean;
}

export interface Purchase {
  id: string;
  supplierId: string;
  supplierName: string;
  items: {
    productId: string;
    name: string;
    quantity: number;
    receivedQuantity?: number;
    costPrice: number;
    discount?: number;
    taxRate?: number;
  }[];
  total: number;
  invoiceNumber?: string;
  date: string;
  status: 'draft' | 'ordered' | 'received' | 'partially_received' | 'completed';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paidAmount: number;
  globalDiscount?: number;
  globalTax?: number;
  notes?: string;
  updatedAt?: string;
}

export interface DamagedRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  date: string;
  userId: string;
  userName: string;
  claimStatus?: 'to_claim' | 'claimed' | 'refunded' | 'replaced' | 'rejected';
  claimNotes?: string;
  costPrice?: number;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  date: string;
  method: 'cash' | 'card' | 'transfer' | 'check';
  note?: string;
  purchaseId?: string;
}

export interface InvoicePattern {
  id: string;
  supplierName: string;
  systemSupplierId: string;
  itemMappings: {
    [invoiceItemName: string]: string;
  };
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  oldQuantity: number;
  newQuantity: number;
  adjustment: number;
  reason: string;
  timestamp: string;
  userId: string;
  userName?: string;
  isLoss?: boolean;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  userId: string;
  paymentMethod: 'cash' | 'card' | 'transfer';
}

export interface InventoryAudit {
  id: string;
  startDate: string;
  endDate?: string;
  status: 'in_progress' | 'completed';
  auditorId: string;
  items: {
    lineId: string;
    productId: string;
    productName: string;
    expectedStock: number;
    actualStock: number;
    discrepancy: number;
    notes?: string;
  }[];
  totalDiscrepancyValue?: number;
}

export interface POSSession {
  id: string;
  name: string;
  cart: CartItem[];
  selectedCustomer: Customer | null;
}

export interface VoucherLog {
  transactionId: string;
  amountUsed: number;
  remainingBalance: number;
  date: string;
  userName: string;
}

export interface Voucher {
  id: string;
  code: string;
  type: 'fixed' | 'percent';
  value: number;
  currentBalance: number;
  minPurchase?: number;
  expiryDate: string;
  status: 'active' | 'used' | 'expired' | 'revoked';
  customerId?: string;
  customerName?: string;
  notes?: string;
  createdAt: any;
  usageLogs?: VoucherLog[];
}

export interface PurchaseCartItem {
  lineId: string;
  productId: string;
  productName: string;
  quantity: number;
  costPrice: number;
  discount: number;
  taxRate: number;
  imageUrl?: string;
}

export interface CompanySettings {
  id?: string;
  name: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  footerText?: string;
  taxNumber?: string;
  receiptTemplate: 'classic' | 'modern' | 'minimal' | 'standard';
  labelTemplate: 'standard' | 'price-only' | 'barcode-only' | 'shelf-standard' | 'shelf-large' | 'shelf-promo';
  labelOrientation?: 'landscape' | 'portrait';
  labelRotation?: '0' | '90' | '180' | '270';
  labelWidthCustom?: number;
  labelHeightCustom?: number;
  currency: string;
  taxRate: number;
  allowNegativeStock?: boolean;
  closeGridOnSelect?: boolean;
  enableVoiceGuidance?: boolean;
  rolePermissions?: Record<'admin' | 'manager' | 'cashier' | 'delivery' | 'picker' | 'camera_agent', RolePermissions>;
  loyaltyPointsPerCurrencyUnit: number;
  loyaltyPointValue: number;
  accountingFormat?: 'csv' | 'json' | 'pdf';
  siteLocations?: { id: string; name: string; address: string; type: 'warehouse' | 'store' }[];
  roleKPIs?: Record<string, { dailyOrderGoal: number; bonusPerOrder: number; bonusType: 'fixed' | 'percent' }>;
  notifications?: {
    whatsapp: { enabled: boolean; onConfirmation: boolean; onShipped: boolean; onDelivered: boolean };
    email: { enabled: boolean; onConfirmation: boolean; onShipped: boolean; onDelivered: boolean };
  };
  operationalCosts?: { basePackaging: number; baseShipping: number };
  lockingPeriodDays?: number;
  deliveryZones?: { name: string; cost: number }[];
  paperFormat?: '80mm' | '60mm' | 'A4';
  silentPrinting?: boolean;
  globalStockAlertThreshold?: number;
  availableTaxes?: { name: string; rate: number }[];
  displayPriceHT?: boolean;
  loyaltyTiers?: { name: string; multiplier: number }[];
  enableTimeClock?: boolean;
  sessionTimeoutMinutes?: number;
  auditLogRetentionDays?: number;
  brandColor?: string;
  fastModeEnabled?: boolean;
  defaultLeadTimeDays?: number;
  loyaltyPointsPerUnit?: number;
  enableCameraPortal?: boolean;
  apiKeys?: {
    twilioSid?: string;
    twilioToken?: string;
    twilioNumber?: string;
    googleMapsKey?: string;
  };
}
