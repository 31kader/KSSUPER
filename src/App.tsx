import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useMemo, memo, useRef, useDeferredValue, useCallback, Suspense, lazy } from 'react';

// Static imports replacing lazy load to solve cookie-less dynamic import CORS blocks in AI Studio frame
import { InventoryAudit as InventoryAuditComponent } from './components/InventoryAudit';
import { InventorySettings } from './components/InventorySettings';
const MarketingPosters = null;
import { AIAssistant } from './components/AIAssistant';
import { ArchiveManager } from './components/ArchiveManager';
import { ManualQRCodeGenerator } from './components/ManualQRCodeGenerator';
import { ProductFormModal } from './components/ProductFormModal';
import { ImportModal } from './components/ImportModal';
import { VoucherManager } from './components/VoucherManager';
import { GRNManager } from './components/GRNManager';
import { PriceCheckerModal } from './components/PriceCheckerModal';
import { Categories } from './components/Categories';
import { Brands } from './components/Brands';
import { EditTransactionModal } from './components/EditTransactionModal';
import { ReturnModal } from './components/ReturnModal';
import { Expenses } from './components/Expenses';
import { StockHistory } from './components/StockHistory';
import { PriceChecker } from './components/PriceChecker';
import { ExpiryManager } from './components/ExpiryManager';
import { DetailedReports } from './components/DetailedReports';
import { SupplierDashboard } from './components/SupplierDashboard';
import { CustomerDashboard } from './components/CustomerDashboard';
import { DeliveryDashboard } from './components/DeliveryDashboard';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { Orders } from './components/Orders';
import { Customers } from './components/Customers';
import { Returns } from './components/Returns';
import { Suppliers } from './components/Suppliers';
import { Employees, TeamManagement } from './components/Employees';
import { Promotions } from './components/Promotions';
import { Inventory } from './components/Inventory';
import { CameraPortal } from './components/CameraPortal';
import { CameraLogin } from './components/CameraLogin';
import { TransactionHistory } from './components/TransactionHistory';
import { Checkout } from './components/Checkout';

import { Toaster, toast } from 'sonner';
import { useDataFetching } from './hooks/useDataFetching';
import { useAuthUser } from './hooks/useAuthUser';
import { useCategoryBrand } from './hooks/useCategoryBrand';
import { useStaffManagement } from './hooks/useStaffManagement';
import { usePOSSessions } from './hooks/usePOSSessions';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  AdvanceRecord, Category, PriceHistoryEntry, Brand, Product, OnlineOrder, 
  CartItem, RolePermissions, Transaction, ProductReturn, UserProfile, AuditLog, 
  CashShift, Promotion, Customer, Supplier, PurchaseOrder, Employee, 
  AttendanceRecord, SupplierSync, Purchase, DamagedRecord, SupplierPayment, 
  InvoicePattern, StockAdjustment, Expense, InventoryAudit, CompanySettings, Voucher,
  POSSession, VoucherLog
} from './types';

import { 
  cn, generateUniqueId, formatProductStock, calculateItemPrice, 
  exportToExcel, exportToCSV, isLocked, safeDate, formatSafe, 
  getHierarchicalCategories, getCategoryPath, logAction, playScanSound, announcePrice
} from './lib/utils';
import { 
  DashboardSkeleton, InventorySkeleton, CheckoutSkeleton 
} from './components/Skeletons';
import { Skeleton } from './components/ui/Skeleton';

import { 
  printReceipt, printLabel, printPurchaseOrder, 
  printPurchaseVoucher, printHistory
} from './services/printService';

import { DEFAULT_PERMISSIONS } from './constants';

import { Button, Card, BlurCard, Modal, ConfirmDialog, SortableHeader } from './components/ui';

import { 
  LayoutDashboard, 
  LayoutGrid,
  ShoppingCart, 
  Package, 
  History, 
  Users, 
  LogOut, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  AlertCircle,
  X,
  CheckCircle2,
  Menu,
  Sun,
  Moon,
  Tag,
  Package2,
  Truck,
  UserCog,
  UserPlus,
  MessageCircle,
  MessageSquare,
  AlertTriangle,
  Navigation,
  Phone,
  Mail,
  Map as MapIcon,
  MapPin,
  Calendar,
  Award,
  RotateCcw,
  Scan,
  Eye,
  Check,
  Copy,
  RefreshCw,
  FileText,
  Upload,
  Download,
  Brain,
  XCircle,
  Printer,
  Edit,
  Shield,
  ShieldAlert,
  XCircle as XCircleIcon,
  Filter,
  Wallet,
  Shuffle,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowLeft,
  ArrowRight,
  Clock,
  LogIn,
  Lock,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Gift,
  BarChart3,
  Barcode as BarcodeIcon,
  Keyboard,
  CreditCard as CardIcon,
  Settings as SettingsIcon,
  Merge,
  Zap,
  CheckCircle,
  FolderTree,
  Edit2,
  Smartphone,
  Store,
  LayoutList,
  Layers,
  HelpCircle,
  Activity,
  ExternalLink,
  Info,
  BookOpen,
  ShieldCheck,
  Database,
  FileSpreadsheet,
  FileJson,
  Sparkles,
  Palette,
  Languages,
  Globe,
  AlignLeft,
  Link2,
  Star,
  Percent,
  PackageOpen,
  CalendarClock,
  Camera,
  CameraOff,
  Contact,
  Quote,
  User as UserIcon,
  Download as DownloadIcon,
  HandCoins,
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import { QRCodeSVG } from 'qrcode.react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { 
  auth, 
  handleFirestoreError,
  OperationType,
  rtdb, ref, get, set, remove, child, update, push, rtdbQuery, equalTo, orderByChild,
  signInWithEmailAndPassword, signOut, signInWithPopup, onAuthStateChanged,
  createUserWithEmailAndPassword,
  onSyncUpdate
} from './database';
import { isSupabaseConfigured } from './supabase';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { format, isToday, isWithinInterval, subDays, subMonths, startOfDay, endOfDay, parseISO, isThisWeek, isThisMonth, isThisYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import Barcode from 'react-barcode';
import bcrypt from 'bcryptjs';

// Removed module-level AI initialization


import { ar } from 'date-fns/locale';
import { useTranslation } from './translations';

// --- Components ---


import { CategoryModal } from './components/CategoryModal';
import { BrandModal } from './components/BrandModal';
import { SmartPurchase } from './components/SmartPurchase';
import { CashManagement } from './components/CashManagement';
import { LowStockModal } from './components/LowStockModal';
import { ExpirationModal } from './components/ExpirationModal';
import { LabelPrinter } from './components/LabelPrinter';
import { UpdatePricesView } from './components/UpdatePricesView';
import { AuditLogs } from './components/AuditLogs';
import { Help } from './components/Help';
import { POSCustomerModal } from './components/POSCustomerModal';
import { AddStaffModal } from './components/AddStaffModal';
import { SupplierLogin } from './components/SupplierLogin';
import { CustomerLogin } from './components/CustomerLogin';
// DateScanner removed
import { QuickAddProductModal } from './components/QuickAddProductModal';
import { StockAdjustmentModal } from './components/StockAdjustmentModal';
import { DuplicateSKUModal } from './components/DuplicateSKUModal';
import { SupplierSyncManager } from './components/SupplierSyncManager';


// --- Utility Functions ---

const playNotificationSound = () => {
  try {
    const NotificationCls = (window as any).Notification;
    if (typeof NotificationCls === 'function' && NotificationCls.permission === 'granted') {
      try {
        // Safely attempt to use Notification constructor
        const canUseNew = NotificationCls.prototype && typeof NotificationCls.prototype === 'object';
        if (canUseNew) {
          new NotificationCls('🚨 Nouvelle commande en ligne !', {
            body: 'Une nouvelle commande vient d\'arriver pour vos livreurs.',
          });
        } else {
          throw new Error('Not a constructor');
        }
      } catch (e) {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            if (registration && registration.showNotification) {
              registration.showNotification('🚨 Nouvelle commande en ligne !', {
                body: 'Une nouvelle commande vient d\'arriver pour vos livreurs.',
              });
            }
          }).catch(() => {});
        }
      }
    }

    const AudioContextCls = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (typeof AudioContextCls === 'function') {
      try {
        // Safely check if it's a constructor before using 'new'
        const canUseNew = AudioContextCls.prototype && typeof AudioContextCls.prototype === 'object';
        const ctx = canUseNew ? new AudioContextCls() : (typeof AudioContextCls === 'function' ? AudioContextCls() : null);
        if (!ctx) return;
        
        const playBeep = (freq: number, startTime: number) => {
          try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
            gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
            gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + 0.3);
            osc.start(ctx.currentTime + startTime);
            osc.stop(ctx.currentTime + startTime + 0.3);
          } catch (e) {}
        };

        playBeep(880, 0);       // A5
        playBeep(1046.50, 0.15); // C6
      } catch (audioErr) {
        console.warn('AudioContext failed:', audioErr);
      }
    }
  } catch (e) {
    console.error('Notification logic failed:', e);
  }
};

// --- Main App ---



















// --- Main App ---

const LoginClock = () => {
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="font-mono text-indigo-400 font-bold tracking-widest text-xs">
      {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
};

export default function App() {
  const { language, setLanguage, t, isRtl } = useTranslation();
  const [hasQuotaError, setHasQuotaError] = useState(false);

  useEffect(() => {
    const handleQuotaError = (e: any) => {
      // Ignore quota errors from blocking the whole app since they are expected in free tier with local cache fallback
    };
    window.addEventListener('firestore-error', handleQuotaError);
    return () => window.removeEventListener('firestore-error', handleQuotaError);
  }, []);

  const [isMobile, setIsMobile] = useState(false);
  const [isMobileOverlayOpen, setIsMobileOverlayOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isWholesale, setIsWholesale] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<'in_store' | 'delivery' | 'pickup'>('in_store');
  const [appMode, setAppMode] = useState<'pos' | 'customer' | 'supplier' | 'price_checker' | 'delivery' | 'camera'>('pos');
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [currentSupplier, setCurrentSupplier] = useState<Supplier | null>(null);
  const [currentCameraAgent, setCurrentCameraAgent] = useState<UserProfile | null>(null);

  const mainSuspenseFallback = (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-nardo gap-4">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin shadow-neon-indigo"></div>
      <p className="text-indigo-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">Vision System Loading...</p>
    </div>
  );

  // Initialize appMode from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'customer') {
      setAppMode('customer');
    } else if (mode === 'supplier') {
      setAppMode('supplier');
    } else if (mode === 'price_checker') {
      setAppMode('price_checker');
    } else if (mode === 'camera') {
      setAppMode('camera');
    }

    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if running as PWA
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isNavigatorStandalone = (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMedia || isNavigatorStandalone);
    };
    checkStandalone();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const [loading, setLoading] = useState(true);

  const {
    user, setUser, profile, setProfile, authError, setAuthError, isLoggingIn, setIsLoggingIn, isUnauthorized, setIsUnauthorized, handleLogin, handleAuthError
  } = useAuthUser(appMode, setLoading);

  useEffect(() => {
    if (profile && (profile.role === 'admin' || profile.role === 'manager' || profile.email === 'hrskader305@gmail.com')) {
      localStorage.setItem('nexus_admin_exists', 'true');
    }
  }, [profile]);

  const {
    settings, products, categories, brands, transactions, promotions, customers, suppliers, employees, users, purchaseOrders, returns, onlineOrders, purchases, patterns, stockAdjustments, expenses, supplierPayments, audits, auditLogs, supplierSyncs, damagedItems, shifts, activeShift, attendance, advances, isDataLoading,
    setSettings, setProducts, setCategories, setBrands, setTransactions, setPromotions, setCustomers, setSuppliers, setEmployees, setUsers, setPurchaseOrders, setReturns, setOnlineOrders, setPurchases, setPatterns, setStockAdjustments, setExpenses, setSupplierPayments, setAudits, setAuditLogs, setSupplierSyncs, setDamagedItems, setShifts, setActiveShift, setAttendance, setAdvances
  } = useDataFetching(user, profile, appMode, currentSupplier, currentCustomer, loading, playNotificationSound);

  const {
    isCategoryModalOpen, setIsCategoryModalOpen,
    isBrandModalOpen, setIsBrandModalOpen,
    editingCategory, setEditingCategory,
    editingBrand, setEditingBrand,
    newCategoryName, setNewCategoryName,
    parentCategoryId, setParentCategoryId,
    categoryImageUrl, setCategoryImageUrl,
    newBrandName, setNewBrandName,
    newBrandLogo, setNewBrandLogo,
    newBrandDesc, setNewBrandDesc,
    openCategoryModal, openBrandModal,
    handleSaveCategory, handleDeleteCategory,
    handleSaveBrand, handleDeleteBrand
  } = useCategoryBrand(categories, products);

  const {
    isAddUserModalOpen, setIsAddUserModalOpen,
    activeStaffId, setActiveStaffId,
    handleAddStaffManual
  } = useStaffManagement();

  const isFirstOrdersLoad = useRef(true);
  
  const getInitialTab = useCallback(() => {
    if (profile?.role === 'camera_agent') return 'camera';
    const hash = window.location.hash.replace('#', '');
    if (!hash || hash.includes('=') || hash.includes('&')) {
      return 'checkout';
    }
    return hash;
  }, [profile]);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab());
  const [syncInfo, setSyncInfo] = useState<any>({ active: false, progress: 0, currentTable: '' });

  useEffect(() => {
    const unsub = onSyncUpdate((status) => {
      setSyncInfo(status);
    });
    return () => unsub();
  }, []);
  const [theme, setTheme] = useState<'dark' | 'light' | 'emerald' | 'gold' | 'nardo'>(() => {
    return (localStorage.getItem('nexus-pos-theme') as 'dark' | 'light' | 'emerald' | 'gold' | 'nardo') || 'dark';
  });
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('nexus-pos-theme', theme);
    document.documentElement.classList.remove('light', 'emerald', 'gold', 'nardo-grey-racing');
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else if (theme === 'emerald') {
      document.documentElement.classList.add('emerald');
    } else if (theme === 'gold') {
      document.documentElement.classList.add('gold');
    } else if (theme === 'nardo') {
      document.documentElement.classList.add('nardo-grey-racing');
    }
  }, [theme]);

  const setActiveTab = useCallback((tab: string) => {
    window.location.hash = tab;
    setActiveTabState(tab);
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash !== activeTab && !hash.includes('=') && !hash.includes('&')) {
        setActiveTabState(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeTab]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === 'c') {
        setActiveTab('checkout');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const {
    posSessions, setPosSessions,
    activeSessionId, setActiveSessionId,
    activeSession,
    cart, setCart,
    selectedCustomer, setSelectedCustomer,
    loadTransactionToCart
  } = usePOSSessions(customers, setActiveTab, setIsWholesale, setDeliveryMethod);

  const handleCreatePurchaseOrder = async (order: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const orderRef = push(ref(rtdb, 'purchaseOrders'));
      await set(orderRef, {
        ...order,
        id: orderRef.key,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      alert('Bon de commande créé avec succès.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'purchaseOrders');
    }
  };

  
  const [viewingPurchaseVoucher, setViewingPurchaseVoucher] = useState<Purchase | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'c') {
        e.preventDefault();
        setActiveTab('checkout');
      }
      if (e.key === 'F3') {
        e.preventDefault();
        const searchInput = (document.querySelector('input[placeholder*="Rechercher"]') || 
                             document.querySelector('input[placeholder*="NOM, SKU"]')) as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
      if (e.key === 'F4') {
        e.preventDefault();
        // Global handled if needed, but POS has its own
      }
      if (e.key === 'Escape') {
        // Modals usually handle this, but we can ensure it
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const canAccess = (permission: keyof RolePermissions) => {
    if (isOwner) return true;
    if (!profile || !profile.role) return false;
    const role = profile.role;
    if (role === 'admin') return true;
    const permissions = settings.rolePermissions?.[role] || DEFAULT_PERMISSIONS[role as keyof typeof DEFAULT_PERMISSIONS] || DEFAULT_PERMISSIONS.cashier;
    return !!permissions[permission];
  };

  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'manager';
  const isCashier = profile?.role === 'cashier';
  const isCameraAgent = profile?.role === 'camera_agent';
  const isDelivery = profile?.role === 'delivery';
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isEditTransactionModalOpen, setIsEditTransactionModalOpen] = useState(false);
  const [selectedTransactionForReturn, setSelectedTransactionForReturn] = useState<Transaction | null>(null);
  const [selectedTransactionForEdit, setSelectedTransactionForEdit] = useState<Transaction | null>(null);
  const [autoSyncOrders, setAutoSyncOrders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('autoSyncOrders') || 'true');
    } catch (e) {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('autoSyncOrders', JSON.stringify(autoSyncOrders));
    } catch (e) {}
  }, [autoSyncOrders]);
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);
  const [isExpirationModalOpen, setIsExpirationModalOpen] = useState(false);
  const [isStockAdjustmentModalOpen, setIsStockAdjustmentModalOpen] = useState(false);
  const [isPriceCheckerModalOpen, setIsPriceCheckerModalOpen] = useState(false);
  const [isPOSCustomerModalOpen, setIsPOSCustomerModalOpen] = useState(false);

  const handlePOSCustomerCreated = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsPOSCustomerModalOpen(false);
  };
  
  const expiringProducts = useMemo(() => {
    const list: any[] = [];
    products.forEach(p => {
      if (p.useMultiExpiry && p.batches && p.batches.length > 0) {
        p.batches.forEach(b => {
          if (b.stock <= 0 || !b.expirationDate) return;
          const expDate = new Date(b.expirationDate);
          const now = new Date();
          const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 30) {
            list.push({
              ...p,
              id: `${p.id}-batch-${b.id}`,
              name: `${p.name} (Lot: ${b.batchNumber})`,
              expirationDate: b.expirationDate,
              stock: b.stock
            });
          }
        });
      } else {
        if (!p.expirationDate || p.stock <= 0) return;
        const expDate = new Date(p.expirationDate);
        const now = new Date();
        const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) {
          list.push(p);
        }
      }
    });
    return list;
  }, [products]);

  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  const currentEmployee = employees.find(e => e.email === user?.email);
  const isClockedIn = currentEmployee?.isClockedIn;

  const handleClockInOut = async () => {
    if (!currentEmployee) return;
    
    try {
      const now = new Date().toISOString();
      const today = format(new Date(), 'yyyy-MM-dd');
      const updates: any = {};
      
      if (isClockedIn) {
        // Find active record
        const activeRecord = attendance.find(r => (r.employeeId === currentEmployee.id || r.userId === user?.uid) && !r.clockOut);
        if (activeRecord) {
          const clockInTime = new Date(activeRecord.clockIn);
          const clockOutTime = new Date(now);
          const hours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
          
          updates[`attendance/${activeRecord.id}/clockOut`] = now;
          updates[`attendance/${activeRecord.id}/totalHours`] = hours;
        }
        updates[`employees/${currentEmployee.id}/isClockedIn`] = false;
      } else {
        // Clock in
        const recordId = push(child(ref(rtdb), 'attendance')).key || generateUniqueId();
        const newRecord = {
          id: recordId,
          userId: user?.uid,
          employeeId: currentEmployee.id,
          employeeName: currentEmployee.name,
          clockIn: now,
          date: today
        };
        updates[`attendance/${recordId}`] = newRecord;
        updates[`employees/${currentEmployee.id}/isClockedIn`] = true;
      }
      
      if (Object.keys(updates).length > 0) {
        await update(ref(rtdb), updates);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'attendance');
    }
  };

  const syncOrder = async (order: OnlineOrder) => {
    if (order.syncedToPos) return;
    
    try {
      // Find customer ID if null but we have their phone or name
      let finalCustomerId = order.customerId;
      if (!finalCustomerId) {
        const found = customers.find(c => 
          (order.customerPhone && c.phone && c.phone.replace(/\D/g, '') === order.customerPhone.replace(/\D/g, '')) || 
          (c.name && order.customerName && c.name.toLowerCase() === order.customerName.toLowerCase())
        );
        if (found) {
          finalCustomerId = found.id;
        }
      }

      const transactionItems: CartItem[] = order.items.map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
          ...product,
          cartItemId: generateUniqueId(),
          id: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          costPrice: product?.costPrice || 0,
          taxRate: product?.taxRate || settings.taxRate,
          stock: product?.stock || 0,
          minStock: product?.minStock || 5,
          categoryId: product?.categoryId || 'Online',
          supplier: product?.supplier || '',
          unit: product?.unit || 'unité',
          sku: product?.sku || '',
          status: product?.status || 'active',
          updatedAt: new Date().toISOString()
        } as CartItem;
      });

      const transactionId = push(child(ref(rtdb), 'transactions')).key || generateUniqueId();
      const transaction: Transaction = {
        id: transactionId,
        items: transactionItems,
        total: order.total,
        paymentMethod: 'card', // Assume card for online orders
        deliveryMethod: order.deliveryMethod || 'in_store',
        timestamp: new Date().toISOString(),
        userId: user?.uid || 'system',
        customerId: finalCustomerId || null,
        customerName: order.customerName || null,
        status: 'completed',
        onlineOrderId: order.id,
        pointsEarned: finalCustomerId ? Math.floor(order.total * (settings.loyaltyPointsPerCurrencyUnit || 1)) : 0
      };

      const updates: any = {};
      
      // 1. Create transaction
      updates[`transactions/${transactionId}`] = transaction;

      // 2. Update stock
      for (const item of transactionItems) {
        if (!item.id || item.id === 'undefined') continue;
        const currentProduct = products.find(p => p.id === item.id);
        if (currentProduct && currentProduct.id) {
          if (currentProduct.isBundle && currentProduct.bundleItems) {
            for (const bundleItem of currentProduct.bundleItems) {
              const componentProduct = products.find((p: Product) => p.id === bundleItem.productId);
              if (componentProduct && componentProduct.id) {
                updates[`products/${componentProduct.id}/stock`] = (componentProduct.stock || 0) - (bundleItem.quantity * item.quantity);
                updates[`products/${componentProduct.id}/updatedAt`] = new Date().toISOString();
              }
            }
          } else {
            let newStock = (currentProduct.stock || 0) - item.quantity;
            if (newStock < 0 && currentProduct.autoUnpack && currentProduct.parentId && currentProduct.unitsPerParent) {
              const parentProduct = products.find((p: Product) => p.id === currentProduct.parentId);
              if (parentProduct && parentProduct.id) {
                const shortfall = -newStock;
                const parentsNeeded = Math.ceil(shortfall / currentProduct.unitsPerParent);
                updates[`products/${parentProduct.id}/stock`] = (parentProduct.stock || 0) - parentsNeeded;
                updates[`products/${parentProduct.id}/updatedAt`] = new Date().toISOString();
                newStock = (parentsNeeded * currentProduct.unitsPerParent) + newStock;
              }
            }
            updates[`products/${currentProduct.id}/stock`] = newStock;
            updates[`products/${currentProduct.id}/updatedAt`] = new Date().toISOString();
          }
        }
      }

      // 3. Mark order as synced
      updates[`onlineOrders/${order.id}/syncedToPos`] = true;
      if (finalCustomerId) {
        updates[`onlineOrders/${order.id}/customerId`] = finalCustomerId;
      }

      // 4. Update customer's loyalty points if already delivered
      if (order.status === 'delivered' && finalCustomerId) {
        const customer = customers.find(c => c.id === finalCustomerId);
        if (customer) {
          const pointsEarned = Math.floor(order.total * (settings.loyaltyPointsPerCurrencyUnit || 1));
          updates[`customers/${finalCustomerId}/loyaltyPoints`] = (customer.loyaltyPoints || 0) + pointsEarned;
          updates[`customers/${finalCustomerId}/totalSpent`] = (customer.totalSpent || 0) + order.total;
          updates[`customers/${finalCustomerId}/lastVisit`] = new Date().toISOString();
        }
      }
      
      if (Object.keys(updates).length > 0) {
        await update(ref(rtdb), updates);
      }
      
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sync_order');
    }
  };

  // Auto-sync logic
  useEffect(() => {
    if (autoSyncOrders && onlineOrders.length > 0) {
      const unsynced = onlineOrders.filter(o => !o.syncedToPos && ['confirmed', 'shipped', 'delivered'].includes(o.status));
      unsynced.forEach(o => syncOrder(o));
    }
  }, [onlineOrders, autoSyncOrders]);

  const handleQuickDemoLogin = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const session = {
      uid: "FaQiBWkg8uTxZ2np7BQjDINTyQc2",
      displayName: "Kader (Administrateur)",
      email: "hrskader305@gmail.com",
      role: "admin",
      employeeId: "admin_quick"
    };
    localStorage.setItem('nexus_active_offline_session', JSON.stringify(session));
    setUser({
      uid: session.uid,
      email: session.email,
      displayName: session.displayName,
      isOffline: true
    } as any);
    setProfile({
      uid: session.uid,
      displayName: session.displayName,
      email: session.email,
      role: "admin",
      employeeId: session.employeeId
    });
    setIsUnauthorized(false);
    toast.success("Connexion Rapide Administrateur réussie !");
  };

  const handleIdentifierLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    if (!loginIdentifier || !loginPassword) {
      setAuthError(t("Veuillez entrer un identifiant et un mot de passe."));
      return;
    }
    setAuthError(null);
    setIsLoggingIn(true);
    
    const inputIdentifier = loginIdentifier.trim();
    const cleanPassword = loginPassword;

    if (isSignUp) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, inputIdentifier, cleanPassword);
        if (userCredential?.user) {
          localStorage.setItem('nexus_admin_exists', 'true');
          if ((userCredential.user as any).isOfflineFallback) {
            toast.warning(t("Compte créé localement (Inscriptions bloquées dans les paramètres Supabase Cloud)."), {
              duration: 10000,
              description: t("Pour activer la base cloud, cochez \"Allow new users to sign up\" sous Authentification → Providers → Email du tableau de bord Supabase.")
            });
          } else {
            toast.success(t("Compte Administrateur créé avec succès !"));
          }
          setIsSignUp(false);
        }
      } catch (error: any) {
        const errorMsgString = error?.message || '';
        if (errorMsgString.includes('already registered') || errorMsgString.includes('already exists') || errorMsgString.includes('user_already_exists')) {
          toast.info(t("Cet e-mail est déjà inscrit. Tentative de connexion..."));
          try {
            const userCredentialObj = await signInWithEmailAndPassword(auth, inputIdentifier, cleanPassword);
            if (userCredentialObj?.user) {
              toast.success(t("Connexion réussie !"));
              setIsSignUp(false);
              return;
            }
          } catch (loginErr: any) {
            console.error("Auto login failed:", loginErr);
            setAuthError(
              <>
                <div className="font-bold mb-1 text-amber-200">{t("Cet utilisateur est déjà enregistré.")}</div>
                <div className="text-[10px] opacity-90 leading-tight">
                  {t("Veuillez utiliser l'onglet de connexion classique ou utiliser le bon mot de passe associé à cet e-mail.")}
                </div>
              </>
            );
            return;
          }
        } else {
          console.error("Sign up failed:", error);
          handleAuthError(error);
        }
      } finally {
        setIsLoggingIn(false);
      }
      return;
    }
    
    const tryOfflineLogin = () => {
      try {
        const offlineCreds = JSON.parse(localStorage.getItem('nexus_offline_credentials') || '{}');
        const phoneKey = inputIdentifier.replace(/\s+/g, '');
        const matchedRecord = offlineCreds[inputIdentifier.toLowerCase()] || offlineCreds[phoneKey];
        
        if (matchedRecord && matchedRecord.hash) {
          const isMatch = bcrypt.compareSync(cleanPassword, matchedRecord.hash);
          if (isMatch) {
            const session = {
              uid: "offline_" + (matchedRecord.employeeId || 'admin_' + Date.now()),
              displayName: matchedRecord.displayName,
              email: matchedRecord.email,
              phone: matchedRecord.phone,
              role: matchedRecord.role,
              employeeId: matchedRecord.employeeId
            };
            localStorage.setItem('nexus_active_offline_session', JSON.stringify(session));
            setUser({
              uid: session.uid,
              email: session.email,
              displayName: session.displayName,
              isOffline: true
            } as any);
            setProfile({
              uid: session.uid,
              displayName: session.displayName,
              email: session.email,
              role: session.role as any,
              employeeId: session.employeeId
            });
            setIsUnauthorized(false);
            toast.success(t("Connexion réussie en mode hors ligne."));
            return true;
          }
        }
      } catch (offlineErr) {
        console.error("Local offline auth check failed:", offlineErr);
      }
      return false;
    };

    if (!navigator.onLine) {
      const success = tryOfflineLogin();
      setIsLoggingIn(false);
      if (!success) {
        setAuthError(t("Connexion hors ligne échouée : Identifiant ou mot de passe incorrect pour le mode hors ligne."));
      }
      return;
    }

    try {
      let email = inputIdentifier;
      if (!email.includes('@')) {
        // Use phone as identifier
        email = `${email.replace(/\s+/g, '')}@nexus-pos.internal`;
      }
      const userCredential = await signInWithEmailAndPassword(auth, email, cleanPassword);
      
      if (userCredential.user) {
        // Successful online login -> cache credentials for future offline use!
        try {
          // Calculate bcrypt hash
          const bcryptHash = bcrypt.hashSync(cleanPassword, 10);
          
          // Fetch additional profile data
          const userSnap = await get(child(ref(rtdb), `users/${userCredential.user.uid}`));
          const userData = userSnap.exists() ? userSnap.val() : null;
          const role = userData ? (userData.role || 'cashier') : 'cashier';
          const displayName = userCredential.user.displayName || userData?.displayName || 'Utilisateur';
          const empId = userData ? (userData.employeeId || null) : null;
          const phone = userData ? (userData.phone || '') : '';

          const offlineCreds = JSON.parse(localStorage.getItem('nexus_offline_credentials') || '{}');
          const credRecord = {
            displayName,
            email: email,
            phone: phone,
            hash: bcryptHash,
            role,
            employeeId: empId
          };
          offlineCreds[email.toLowerCase()] = credRecord;
          if (phone) offlineCreds[phone] = credRecord;
          localStorage.setItem('nexus_offline_credentials', JSON.stringify(offlineCreds));
        } catch (cacheErr) {
          console.warn("Failed to cache offline credentials", cacheErr);
        }
      }
    } catch (error: any) {
      console.error("Online login failed:", error);
      
      // If offline error or block error, try fallback to cached local credentials if available!
      if (error.code === 'auth/network-request-failed' || error.code === 'auth/internal-error' || error.code === 'auth/quota-exceeded') {
        const success = tryOfflineLogin();
        if (success) {
          setIsLoggingIn(false);
          return;
        }
      }

      if (error.code === 'auth/network-request-failed') {
        handleAuthError(error);
      } else if (error.code === 'auth/invalid-credential' || (error.message && error.message.toLowerCase().includes('invalid login credentials')) || error.code === 'invalid_credentials') {
        // Help employee check if they can match offline first in case their online Sync Auth hasn't updated
        const success = tryOfflineLogin();
        if (success) {
          setIsLoggingIn(false);
          return;
        }
        setAuthError("L'identifiant ou le mot de passe est incorrect. Si vous êtes l'administrateur, veuillez utiliser le bouton 'Connexion avec Google'. Les employés doivent avoir un compte créé par le manager.");
      } else {
        handleAuthError(error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('nexus_active_offline_session');
    if (user && !(user as any).isOffline) {
      try {
        await logAction(user.uid, user.displayName || 'Utilisateur', 'Déconnexion', 'Auth', 'Utilisateur déconnecté');
      } catch (e) {}
    }
    try {
      signOut(auth);
    } catch (e) {}
    setUser(null);
    setProfile(null);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-nardo">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-[2rem] animate-spin-slow shadow-neon-indigo"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg animate-pulse"></div>
            </div>
          </div>
          <div className="text-center">
             <p className="text-white font-black uppercase tracking-[0.3em] text-lg mb-1">Nexus OS</p>
             <p className="text-indigo-400/60 font-black uppercase tracking-[0.5em] text-[10px]">Initializing Modules</p>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = (user?.email?.toLowerCase().trim() === 'hrskader305@gmail.com') || 
                 (profile?.email?.toLowerCase().trim() === 'hrskader305@gmail.com') ||
                 (user?.uid === 'FaQiBWkg8uTxZ2np7BQjDINTyQc2');

  const effectiveUnauthorized = isUnauthorized && !isOwner;

  if (effectiveUnauthorized) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full p-8 text-center flex flex-col items-center gap-6">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Accès Refusé</h1>
            <div className="text-slate-500 mt-2 space-y-2">
              <p>Votre compte <span className="font-bold text-indigo-600">{user?.email || profile?.email || 'N/A'}</span> n'est pas autorisé à accéder à cette application.</p>
              {isOwner && <p className="text-amber-600 font-bold">ATTENTION: Vous êtes identifié comme propriétaire mais l'accès est encore restreint. Raffraichissez la page.</p>}
              <p className="text-sm">
                L'administrateur doit vous ajouter dans la section <b>"Personnel & Accès"</b> avec cette adresse email exacte pour vous donner accès.
              </p>
              <p className="text-[10px] text-slate-400 mt-4 font-mono">UID: {user?.uid || 'none'}</p>
            </div>
          </div>
          <div className="w-full flex gap-2">
            <Button onClick={handleLogout} variant="outline" className="flex-1 py-4 text-sm font-bold hover:bg-slate-50 border-2">
              Déconnexion
            </Button>
            <Button onClick={() => window.location.reload()} className="flex-1 py-4 text-sm font-bold shadow-lg shadow-indigo-100">
              Rafraîchir
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!user && appMode === 'pos') {
    return (
      <div className="h-screen w-full flex flex-col lg:flex-row bg-[#080B10] text-slate-100 overflow-hidden relative font-sans">
        {/* Decorative Ambient Aura Glows */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />
        
        {/* Left Side: Editorial Branding / Diagnostic Bento Grid */}
        <div className="hidden lg:flex lg:w-[45%] bg-slate-950/40 border-r border-slate-900/60 flex-col justify-between p-12 relative overflow-hidden backdrop-blur-md">
          <div className="absolute inset-0 bg-grid-white/[0.02] [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] pointer-events-none" />
          
          {/* Top Section: Brand Identity */}
          <div className="flex items-center gap-3.5 z-10">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 relative">
              <div className="absolute inset-0 rounded-2xl bg-indigo-400 animate-ping opacity-10" />
              <ShoppingCart size={22} className="text-white relative" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase italic leading-none">Nexus <span className="text-indigo-500">POS Pro</span></h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Integrated Retail OS</p>
            </div>
          </div>
          
          {/* Middle Section: Clean Brand Headline */}
          <div className="space-y-8 z-10 my-auto">
            <div className="space-y-4">
              <h1 className="text-5xl font-black text-white tracking-tighter leading-none uppercase italic">
                LE FUTUR DE LA <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-rose-400">GESTION EN CAISSE</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium max-w-sm leading-relaxed">
                Connectez-vous à votre terminal de vente sécurisé et profitez d'une vélocité absolue, en ligne comme hors ligne.
              </p>
            </div>
          </div>
          
          {/* Bottom Footer Section */}
          <div className="z-10 text-[10px] text-slate-500 font-medium">
            <p>© 2026 Nexus Group. Tous droits réservés.</p>
            <p className="mt-1 text-slate-600">Sécurité de secours locale intégrée avec chiffrement Bcrypt.</p>
          </div>
        </div>
        
        {/* Right Side: High-Polished Form Canvas */}
        <div className="flex-1 flex items-center justify-center p-6 relative overflow-y-auto">
          {/* Elegant Card Body */}
          <div className="w-full max-w-md bg-slate-900/10 border border-white/5 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl backdrop-blur-xl relative overflow-hidden flex flex-col gap-8">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[40px] pointer-events-none rounded-full" />
            
            {/* Header / Logo Mobile indicator */}
            <div className="text-center space-y-2 mt-2">
              <div className="lg:hidden mx-auto w-12 h-12 rounded-2xl bg-indigo-600/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 mb-4">
                <ShoppingCart size={22} />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight uppercase italic leading-none">
                {isSignUp ? "Inscription POS" : "Connexion POS"}
              </h1>
              <p className="text-slate-400 text-slate-300 text-xs sm:text-sm leading-relaxed max-w-xs mx-auto">
                {isSignUp 
                  ? "Créez votre compte administrateur principal de secours pour votre cloud Supabase." 
                  : "Saisissez vos identifiants de caisse pour déverrouiller le terminal de vente."}
              </p>
            </div>


            
            <form onSubmit={handleIdentifierLogin} className="space-y-4">
              {/* Username Input */}
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  {isSignUp ? "Adresse E-mail Admin" : "Identifiant (Email ou Téléphone)"}
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                    <Smartphone size={18} />
                  </div>
                  <input 
                    required
                    placeholder={isSignUp ? "Ex: admin@example.com" : "Ex: admin@example.com ou 0622110033"}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all text-sm font-medium text-white placeholder-slate-500/50"
                    value={loginIdentifier}
                    onChange={e => setLoginIdentifier(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Mot de passe
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                    <Lock size={18} />
                  </div>
                  <input 
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all text-sm font-medium text-white placeholder-slate-500/50"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                  />
                  <button 
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setShowPassword(true); }}
                    onMouseUp={() => setShowPassword(false)}
                    onMouseLeave={() => setShowPassword(false)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Error messages */}
              {authError && (
                <div className="w-full p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-left">
                  <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={18} />
                  <div className="text-xs text-rose-200 font-medium leading-relaxed">
                    {authError}
                    {typeof authError === 'string' && authError.includes('Identity Toolkit') && (
                      <a 
                        href={`https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=247663396085`}
                        target="_blank"
                        rel="noreferrer"
                        className="block mt-2 font-black underline text-indigo-400 hover:text-indigo-300"
                      >
                        Cliquez ici pour activer l'API En Ligne
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 pt-2">
                <Button 
                  type="submit"
                  className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white transition-all duration-300 shadow-lg shadow-indigo-600/10"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <LogIn size={15} />
                      {isSignUp ? "Créer mon Compte" : "Déverrouiller la Caisse"}
                    </>
                  )}
                </Button>

                {!isSignUp && (
                  <>
                    {/* Styled separator */}
                    <div className="relative py-1.5 flex items-center">
                      <div className="flex-grow border-t border-white/5"></div>
                      <span className="flex-shrink mx-3 bg-transparent text-[8px] text-slate-500 font-black tracking-widest uppercase">
                        OU ADMIN VIA
                      </span>
                      <div className="flex-grow border-t border-white/5"></div>
                    </div>

                    {/* Google Logins */}
                    <div className="space-y-1.5 w-full">
                      <button 
                        type="button"
                        onClick={handleLogin} 
                        className="w-full py-3 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-indigo-900/40 via-white/5 to-white/5 hover:from-indigo-900/60 hover:via-white/10 hover:to-white/10 border border-white/10 hover:border-indigo-500/30 rounded-2xl flex items-center justify-center gap-3 transition-all text-slate-200 hover:text-white font-black uppercase text-[10px] tracking-widest disabled:opacity-50"
                        disabled={isLoggingIn}
                      >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
                        Google Administrateur
                      </button>
                      <p className="text-[9px] text-slate-500 font-medium text-center leading-normal max-w-xs mx-auto px-1">
                        💡 <strong>Astuce :</strong> En ouvrant l'application dans un <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-400 text-indigo-400/90 font-bold">nouvel onglet</a>, la connexion s'effectue directement sur le même écran (sans aucune fenêtre pop-up séparée).
                      </p>
                    </div>
                  </>
                )}
              </div>
            </form>

            {isSupabaseConfigured && (isSignUp || localStorage.getItem('nexus_admin_exists') !== 'true') && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setAuthError(null);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 text-xs font-bold transition-colors underline"
                >
                  {isSignUp 
                    ? "Déjà un compte ? Se connecter" 
                    : "Pas encore de compte ? S’inscrire (Nouveau Compte)"}
                </button>
              </div>
            )}

            {/* Micro role access paths navigation */}
            <div className="pt-4 border-t border-white/5 w-full flex flex-col gap-2.5">
              <p className="text-[8px] text-slate-500 font-black tracking-widest uppercase text-center mb-0.5">
                Portails de Vente Nexus
              </p>
              <div className="grid grid-cols-2 gap-2 text-center text-[9px] font-black tracking-wider uppercase">
                <button 
                  onClick={() => setAppMode('customer')}
                  className="py-2 px-3 bg-white/[0.02] hover:bg-indigo-500/10 border border-white/5 rounded-xl text-slate-400 hover:text-indigo-400 transition-all"
                >
                  Portail Client
                </button>
                <button 
                  onClick={() => setAppMode('supplier')}
                  className="py-2 px-3 bg-white/[0.02] hover:bg-indigo-500/10 border border-white/5 rounded-xl text-slate-400 hover:text-indigo-400 transition-all"
                >
                  Portail Fournisseur
                </button>
                <button 
                  onClick={() => setAppMode('price_checker')}
                  className="py-2 px-3 bg-white/[0.02] hover:bg-indigo-500/10 border border-white/5 rounded-xl text-slate-400 hover:text-indigo-400 transition-all"
                >
                  Vérificateur Prix
                </button>
                <button 
                  onClick={() => setAppMode('camera')}
                  className="py-2 px-3 bg-white/[0.02] hover:bg-indigo-500/10 border border-white/5 rounded-xl text-slate-400 hover:text-indigo-400 transition-all"
                >
                  Audit Caméra
                </button>
              </div>
              <div className="text-center mt-2">
                <span className="text-[8px] font-black text-white/10 uppercase tracking-[0.3em]">Nexus Engine Platform v1.2.6-stable</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (appMode === 'price_checker') {
    return (
      <div className="relative">
        <button 
          onClick={() => setAppMode('pos')}
          className="absolute top-4 left-4 z-50 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-md hover:bg-white transition-colors"
          title="Retour au POS"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <PriceChecker products={products} settings={settings} categories={categories} />
      </div>
    );
  }

  if (appMode === 'customer') {
    if (!currentCustomer) {
      return (
        <Suspense fallback={mainSuspenseFallback}>
          <CustomerLogin onLogin={(customer) => setCurrentCustomer(customer)} />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={mainSuspenseFallback}>
        <CustomerDashboard 
          customer={currentCustomer} 
          transactions={transactions} 
          settings={settings}
          onLogout={() => setCurrentCustomer(null)}
        />
      </Suspense>
    );
  }

  if (appMode === 'supplier') {
    if (!currentSupplier) {
      return (
        <Suspense fallback={mainSuspenseFallback}>
          <SupplierLogin onLogin={(supplier) => setCurrentSupplier(supplier)} />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={mainSuspenseFallback}>
        <SupplierDashboard 
          supplier={currentSupplier} 
          onLogout={() => setCurrentSupplier(null)}
          products={products}
          categories={categories}
          brands={brands}
          settings={settings}
          handleCreatePurchaseOrder={handleCreatePurchaseOrder}
          purchaseOrders={purchaseOrders}
          user={user}
          setIsProductModalOpen={setIsProductModalOpen}
          setEditingProduct={setEditingProduct}
          editingProduct={editingProduct}
          isProductModalOpen={isProductModalOpen}
          setActiveTab={setActiveTab}
        />
      </Suspense>
    );
  }

  if (appMode === 'camera') {
    if (!currentCameraAgent) {
      return (
        <Suspense fallback={mainSuspenseFallback}>
          <CameraLogin onLogin={(agent) => setCurrentCameraAgent(agent)} />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={mainSuspenseFallback}>
        <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
          <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 relative">
             <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500"></div>
             <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                   <Camera size={18} />
                </div>
                <h2 className="text-sm font-black text-white italic tracking-tighter uppercase">Nexus Guard <span className="text-slate-500 font-bold ml-1">Live Feed</span></h2>
             </div>
             <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Agent Actif</p>
                   <p className="text-xs font-black text-white uppercase italic">{currentCameraAgent.displayName}</p>
                </div>
                <div className="w-px h-6 bg-slate-800 mx-2"></div>
                <button 
                  onClick={() => setCurrentCameraAgent(null)}
                  className="flex items-center gap-2 px-4 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest border border-rose-500/20"
                >
                  <LogOut size={14} /> Déconnexion
                </button>
             </div>
          </header>
          <div className="flex-1 overflow-hidden">
            <CameraPortal settings={settings} user={currentCameraAgent} />
          </div>
        </div>
      </Suspense>
    );
  }

  if (appMode === 'delivery') {
    return (
      <Suspense fallback={mainSuspenseFallback}>
        <DeliveryDashboard 
          user={user}
          profile={profile}
          onLogout={handleLogout}
          settings={settings}
          onlineOrders={onlineOrders}
          customers={customers}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={mainSuspenseFallback}>
      <Toaster position="top-right" richColors closeButton theme={theme === 'light' ? 'light' : 'dark'} />
      <div className={cn("h-screen flex overflow-hidden bg-nardo text-slate-200 relative", theme)}>
      {/* Sidebar - Responsive Overlay */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isMobile ? (isMobileOverlayOpen ? '100%' : 0) : (isSidebarOpen ? 260 : 80),
          x: isMobile && !isMobileOverlayOpen ? -300 : 0
        }}
        className={cn(
          "border-r flex flex-col h-full z-40 bg-workspace border-slate-800/40",
          isMobile ? "fixed inset-y-0 left-0" : "relative"
        )}
      >
        {isMobile && isMobileOverlayOpen && (
          <button 
            onClick={() => setIsMobileOverlayOpen(false)}
            className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400 z-50"
          >
            <X size={20} />
          </button>
        )}
        <div className="p-6 flex items-center gap-3 border-b border-slate-800/40">
          <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
            <ShoppingCart size={20} />
          </div>
          {(isSidebarOpen || isMobile) && <span className="font-black text-xl truncate text-white tracking-tighter">Nexus POS</span>}
        </div>

        <nav className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar text-left rtl:text-right">
          {/* Ventes */}
          <div className="space-y-1">
            {(isSidebarOpen || isMobile) && <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest px-2 mb-2">{t("Ventes")}</h3>}
            <NavItem href="#checkout" icon={<ShoppingCart size={20} />} label={t("Caisse")} active={activeTab === 'checkout'} onClick={() => { setActiveTab('checkout'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />
            {canAccess('canAccessOnlineOrders') && <NavItem href="#orders" icon={<ShoppingBag size={20} />} label={t("Commandes")} active={activeTab === 'orders'} onClick={() => { setActiveTab('orders'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessCustomers') && <NavItem href="#customers" icon={<Users size={20} />} label={t("Clients")} active={activeTab === 'customers'} onClick={() => { setActiveTab('customers'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessSales') && <NavItem href="#transactions" icon={<History size={20} />} label={t("Transactions")} active={activeTab === 'transactions'} onClick={() => { setActiveTab('transactions'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessReturns') && <NavItem href="#returns" icon={<RotateCcw size={20} />} label={t("Retours")} active={activeTab === 'returns'} onClick={() => { setActiveTab('returns'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessPromotions') && <NavItem href="#promotions" icon={<Tag size={20} />} label={t("Promotions")} active={activeTab === 'promotions'} onClick={() => { setActiveTab('promotions'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            <NavItem icon={<Eye size={20} />} label={t("Vérificateur")} active={false} onClick={() => { setIsPriceCheckerModalOpen(true); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />
          </div>

          {/* Gestion */}
          <div className="space-y-1">
            {(isSidebarOpen || isMobile) && <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest px-2 mb-2">{t("Gestion")}</h3>}
            {canAccess('canAccessInventory') && <NavItem href="#inventory" icon={<Package size={20} />} label={t("Inventaire")} active={activeTab === 'inventory'} onClick={() => { setActiveTab('inventory'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessInventory') && <NavItem href="#expiry" icon={<CalendarClock size={20} />} label={t("Suivi Péremption")} active={activeTab === 'expiry'} onClick={() => { setActiveTab('expiry'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessInventory') && <NavItem href="#inventory_settings" icon={<FolderTree size={20} />} label={t("Classifications")} active={activeTab === 'inventory_settings'} onClick={() => { setActiveTab('inventory_settings'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessVouchers') && <NavItem href="#vouchers" icon={<Tag size={20} />} label={t("Cartes Cadeaux & Bons")} active={activeTab === 'vouchers'} onClick={() => { setActiveTab('vouchers'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessSuppliers') && <NavItem href="#suppliers" icon={<Truck size={20} />} label={t("Fournisseurs")} active={activeTab === 'suppliers'} onClick={() => { setActiveTab('suppliers'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessPurchases') && <NavItem href="#purchases" icon={<ShoppingBag size={20} />} label={t("Achats")} active={activeTab === 'purchases'} onClick={() => { setActiveTab('purchases'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessExpenses') && <NavItem href="#expenses" icon={<TrendingDown size={20} />} label={t("Dépenses")} active={activeTab === 'expenses'} onClick={() => { setActiveTab('expenses'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
          </div>

          {/* Administration */}
          <div className="space-y-1">
            {(isSidebarOpen || isMobile) && <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest px-2 mb-2">{t("Administration")}</h3>}
            {canAccess('canAccessAnalytics') && <NavItem href="#dashboard" icon={<LayoutDashboard size={20} />} label={t("Tableau de bord")} active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessAnalytics') && <NavItem href="#ai_assistant" icon={<Brain size={20} />} label={t("Assistant IA")} active={activeTab === 'ai_assistant'} onClick={() => { setActiveTab('ai_assistant'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessAnalytics') && <NavItem href="#reports" icon={<FileText size={20} />} label={t("Rapports")} active={activeTab === 'reports'} onClick={() => { setActiveTab('reports'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessShifts') && <NavItem href="#shifts" icon={<Wallet size={20} />} label={t("Clôture")} active={activeTab === 'shifts'} onClick={() => { setActiveTab('shifts'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessEmployees') && <NavItem href="#employees" icon={<UserCog size={20} />} label={t("Personnel & Accès")} active={activeTab === 'employees'} onClick={() => { setActiveTab('employees'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessAuditLogs') && <NavItem href="#audit_logs" icon={<ShieldCheck size={20} />} label={t("Audit")} active={activeTab === 'audit_logs'} onClick={() => { setActiveTab('audit_logs'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {(isCameraAgent || isAdmin || isManager) && settings.enableCameraPortal !== false && <NavItem href="#camera" icon={<Camera size={20} />} label={t("Audit Caméra")} active={activeTab === 'camera'} onClick={() => { setActiveTab('camera'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessSettings') && <NavItem href="#settings" icon={<SettingsIcon size={20} />} label={t("Paramètres")} active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            {canAccess('canAccessSettings') && <NavItem href="#archives" icon={<Database size={20} />} label={t("Clôture de Mois")} active={activeTab === 'archives'} onClick={() => { setActiveTab('archives'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />}
            <NavItem href="#help" icon={<HelpCircle size={20} />} label={t("Aide")} active={activeTab === 'help'} onClick={() => { setActiveTab('help'); setIsMobileOverlayOpen(false); }} collapsed={!isSidebarOpen && !isMobile} />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800/40 space-y-2">
          {deferredPrompt && (
            <button 
              onClick={handleInstallApp}
              className="w-full p-2.5 rounded-xl flex items-center justify-center gap-3 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 transition-all font-black text-[10px] uppercase tracking-widest ring-1 ring-indigo-400/20"
            >
              <Download size={18} />
              {(isSidebarOpen || isMobile) && "Installer l'App"}
            </button>
          )}
          {!isMobile && (
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-full p-2 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-800/40 text-slate-500"
            >
              <Menu size={20} />
            </button>
          )}
          <div className="mt-4 flex items-center gap-3 p-2">
            {user.photoURL ? (
              <img src={user.photoURL} className="w-8 h-8 rounded-full border border-slate-800" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 bg-slate-800 text-slate-400 border border-slate-700/50 rounded-full flex items-center justify-center font-black text-[10px]">
                {user.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            {(isSidebarOpen || isMobile) && (
              <div className="flex-1 truncate">
                <p className="text-sm font-black truncate text-white uppercase tracking-tight">{user.displayName}</p>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-industrial-500 truncate uppercase font-black tracking-widest">{profile?.role}</p>
                  <span className="text-[8px] px-1 bg-industrial-800 text-indigo-400 rounded font-bold border border-industrial-700">v1.2.6</span>
                </div>
              </div>
            )}
            {(isSidebarOpen || isMobile) && (
              <button onClick={handleLogout} className="p-2 text-industrial-500 hover:text-rose-500 transition-colors">
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 flex flex-col overflow-hidden relative bg-industrial-950",
        isMobile && "pb-20" // Padding for bottom bar
      )}>
        {/* Vision Cloud Sync & Offline Status Indicator */}
        <div className="fixed bottom-24 right-6 sm:bottom-8 sm:right-8 z-[100] pointer-events-none">
          <AnimatePresence>
            {(syncInfo.active || !isOnline) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className={cn(
                  "p-3 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 pointer-events-auto min-w-[200px]",
                  !isOnline 
                    ? "bg-rose-500/20 border-rose-500/30 text-rose-400" 
                    : "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center relative shadow-lg",
                  !isOnline ? "bg-rose-500/20" : "bg-indigo-500/20"
                )}>
                  {!isOnline ? (
                    <div className="relative">
                      <Database size={20} className=" opacity-30" />
                      <XCircle size={12} className="absolute -top-1 -right-1 text-rose-500" />
                    </div>
                  ) : (
                    <RefreshCw size={20} className="animate-spin" />
                  )}
                </div>
                <div className="min-w-0 pr-2">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Vision System</p>
                  <p className="text-xs font-black truncate uppercase tracking-tighter">
                    {!isOnline ? t("Mode Hors-ligne Actif") : `${t("Synchronisation")} ${syncInfo.progress}%`}
                  </p>
                  {syncInfo.active && isOnline && (
                    <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${syncInfo.progress}%` }}
                        className="h-full bg-indigo-500"
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <header className="h-16 border-b px-4 sm:px-8 flex items-center justify-between flex-shrink-0 bg-industrial-900/60 backdrop-blur-md border-industrial-800 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            {isMobile && (
              <button 
                onClick={() => setIsMobileOverlayOpen(true)}
                className="p-2 bg-industrial-800 rounded-lg text-industrial-400 hover:bg-industrial-700"
              >
                <Menu size={20} />
              </button>
            )}
            <h2 className="text-lg font-black uppercase tracking-tight text-white">
              {activeTab === 'checkout' ? (isMobile ? 'POS' : 'Point de Vente') : activeTab === 'dashboard' ? 'Tableau de Bord' : activeTab.toUpperCase()}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {lowStockProducts.length > 0 && (
              <button 
                onClick={() => setIsLowStockModalOpen(true)}
                className="relative p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                title="Alertes de stock bas"
              >
                <div className="relative">
                  <AlertTriangle size={24} className="animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-industrial-900">
                    {lowStockProducts.length}
                  </span>
                </div>
              </button>
            )}

            {expiringProducts.length > 0 && (
              <button 
                onClick={() => setIsExpirationModalOpen(true)}
                className="relative p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all animate-pulse"
                title="Alertes de péremption (DLC)"
              >
                <Calendar size={24} />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-industrial-900">
                  {expiringProducts.length}
                </span>
              </button>
            )}

            {currentEmployee && (
              <div className="flex items-center gap-2">
                
                <button 
                  onClick={handleClockInOut}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm",
                    isClockedIn 
                      ? "bg-rose-100 text-rose-700 hover:bg-rose-200" 
                      : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  )}
                >
                  {isClockedIn ? <LogOut size={18} /> : <LogIn size={18} />}
                  <span className="hidden sm:inline">{isClockedIn ? 'Fin de service' : 'Début de service'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Language Selector Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="p-2.5 rounded-xl bg-industrial-800 border border-industrial-700 text-industrial-400 hover:text-indigo-400 hover:border-indigo-500/30 transition-all shadow-sm flex items-center gap-2 group cursor-pointer"
                title="Changer de langue / تغيير اللغة"
              >
                <Languages size={18} className="group-hover:scale-110 transition-transform text-indigo-400" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">
                  {language === 'fr' ? 'FR' : 'العربية'}
                </span>
                <ChevronDown size={14} className={cn("transition-transform", isLangMenuOpen && "rotate-180")} />
              </button>

              {isLangMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsLangMenuOpen(false)}
                  />
                  <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-48 rounded-2xl bg-industrial-900 border border-industrial-800 p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <p className="text-[9px] font-black tracking-widest uppercase text-white/40 px-3 py-1.5 border-b border-white/5 mb-1.5">MOTEUR MULTILINGUE</p>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setLanguage('fr');
                        setIsLangMenuOpen(false);
                        toast.success("Langue : Français");
                      }}
                      className={cn(
                        "w-full text-left rtl:text-right p-2 rounded-xl flex items-center gap-3 transition-all hover:bg-white/5 group relative",
                        language === 'fr' && "bg-white/5 border border-white/10"
                      )}
                    >
                      <div className="text-sm shrink-0">🇫🇷</div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white uppercase tracking-tight">Français</p>
                      </div>
                      {language === 'fr' && (
                        <span className="absolute right-2 rtl:left-2 text-[8px] bg-indigo-500/10 text-indigo-400 font-extrabold px-1.5 py-0.2 rounded uppercase">Actif</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLanguage('ar');
                        setIsLangMenuOpen(false);
                        toast.success("اللغة الحالية: العربية");
                      }}
                      className={cn(
                        "w-full text-left rtl:text-right p-2 rounded-xl flex items-center gap-3 transition-all hover:bg-white/5 group relative",
                        language === 'ar' && "bg-white/5 border border-white/10"
                      )}
                    >
                      <div className="text-sm shrink-0">🇩🇿</div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white uppercase tracking-tight font-sans-arabic">العربية</p>
                      </div>
                      {language === 'ar' && (
                        <span className="absolute right-2 rtl:left-2 text-[8px] bg-indigo-500/10 text-indigo-400 font-extrabold px-1.5 py-0.2 rounded uppercase">نشط</span>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button 
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                className="p-2.5 rounded-xl bg-industrial-800 border border-industrial-700 text-industrial-400 hover:text-indigo-400 hover:border-indigo-500/30 transition-all shadow-sm flex items-center gap-2 group cursor-pointer"
                title="Changer le style visuel de l'application"
              >
                <Palette size={18} className="group-hover:scale-110 transition-transform text-indigo-400" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">
                  Thème: {theme === 'dark' ? 'Onyx' : theme === 'light' ? 'Albâtre' : theme === 'emerald' ? 'Émeraude' : theme === 'gold' ? 'Or Luxe' : 'Nardo'}
                </span>
                <ChevronDown size={14} className={cn("transition-transform", isThemeMenuOpen && "rotate-180")} />
              </button>

              {isThemeMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsThemeMenuOpen(false)}
                  />
                  <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-64 rounded-2xl bg-industrial-900 border border-industrial-800 p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <p className="text-[9px] font-black tracking-widest uppercase text-white/40 px-3 py-1.5 border-b border-white/5 mb-1.5">MOTEUR DE THÈMES NEXUS</p>
                    
                    {[
                      { id: 'dark', name: 'Onyx Carbon', desc: 'Sensation haut de gamme carbone & indigo', color: 'bg-slate-900' },
                      { id: 'light', name: 'Alabaster Puro', desc: 'Clarté clinique et contrastes doux', color: 'bg-amber-50' },
                      { id: 'emerald', name: 'Cyber Émeraude', desc: 'Vert néon sci-fi d\'inspiration Matrix', color: 'bg-emerald-950' },
                      { id: 'gold', name: 'Obsidienne Or Luxe', desc: 'Noir d\'ancre poli et dorures chaleureuses', color: 'bg-amber-950' },
                      { id: 'nardo', name: 'Nardo Motorsport', desc: 'Gris gris piste et orange course pure', color: 'bg-[#1b1c21]' }
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTheme(t.id as any);
                          setIsThemeMenuOpen(false);
                          toast.success(`Atmosphère visuelle : ${t.name}`);
                        }}
                        className={cn(
                          "w-full text-left p-2 rounded-xl flex items-center gap-3 transition-all hover:bg-white/5 group relative",
                          theme === t.id && "bg-white/5 border border-white/10"
                        )}
                      >
                        <div className={cn("w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center shrink-0", t.color)}>
                          {theme === t.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white uppercase tracking-tight flex items-center gap-1.5 justify-between">
                            {t.name}
                            {theme === t.id && (
                              <span className="text-[8px] bg-indigo-500/10 text-indigo-400 font-extrabold px-1.5 py-0.2 rounded uppercase">Actif</span>
                            )}
                          </p>
                          <p className="text-[10px] text-white/40 truncate mt-0.5">{t.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="text-right hidden sm:block">
              <p className="text-xs text-white/40">{formatSafe(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}</p>
              <div className="flex items-center gap-2 justify-end">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <p className="text-sm font-medium text-white">
                  {activeStaffId 
                    ? `Opéré par: ${employees.find(e => e.id === activeStaffId)?.name}`
                    : `Caisse: ${profile?.displayName || user.displayName || 'Principal'}`
                  }
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "h-full overflow-y-auto custom-scrollbar",
                activeTab !== 'checkout' && (isMobile ? "p-4" : "p-8")
              )}
            >
              {isDataLoading ? (
                <div className="h-full">
                  {activeTab === 'checkout' && <CheckoutSkeleton />}
                  {activeTab === 'dashboard' && <DashboardSkeleton />}
                  {activeTab === 'inventory' && <InventorySkeleton />}
                  {!['checkout', 'dashboard', 'inventory'].includes(activeTab) && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-10 w-64 rounded-xl" />
                        <Skeleton className="h-10 w-32 rounded-xl" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                           <Card key={i} className="p-6 space-y-4">
                              <Skeleton className="h-6 w-1/2" />
                              <Skeleton className="h-20 w-full" />
                              <Skeleton className="h-4 w-1/3" />
                           </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {activeTab === 'checkout' && (
                    <Checkout 
                      products={products} 
                      categories={categories}
                      cart={cart} 
                      setCart={setCart} 
                      user={user} 
                      profile={profile} 
                      promotions={promotions} 
                      customers={customers} 
                      settings={settings} 
                      activeShift={activeShift} 
                      setActiveShift={setActiveShift}
                      setActiveTab={setActiveTab} 
                      transactions={transactions} 
                      setIsPOSCustomerModalOpen={setIsPOSCustomerModalOpen} 
                      selectedCustomer={selectedCustomer}
                      setSelectedCustomer={setSelectedCustomer} 
                      posSessions={posSessions}
                      setPosSessions={setPosSessions}
                      activeSessionId={activeSessionId}
                      setActiveSessionId={setActiveSessionId}
                      setIsProductModalOpen={setIsProductModalOpen}
                      setEditingProduct={setEditingProduct}
                      isWholesale={isWholesale}
                      setIsWholesale={setIsWholesale}
                      deliveryMethod={deliveryMethod}
                      setDeliveryMethod={setDeliveryMethod}
                      activeStaffId={activeStaffId}
                      employees={employees}
                    />
                  )}
                  {activeTab === 'dashboard' && <Dashboard transactions={transactions} products={products} settings={settings} isStandalone={isStandalone} deferredPrompt={deferredPrompt} handleInstallApp={handleInstallApp} />}
                  {activeTab === 'ai_assistant' && <AIAssistant products={products} transactions={transactions} expenses={expenses} settings={settings} stockAdjustments={stockAdjustments} />}
                  {activeTab === 'reports' && <DetailedReports transactions={transactions} products={products} employees={employees} expenses={expenses} supplierPayments={supplierPayments} returns={returns} settings={settings} categories={categories} customers={customers} stockAdjustments={stockAdjustments} />}
                  {activeTab === 'inventory' && <Inventory products={products} categories={categories} brands={brands} stockAdjustments={stockAdjustments} user={user} settings={settings} setActiveTab={setActiveTab} supplierSyncs={supplierSyncs} allSuppliers={suppliers} purchases={purchases} transactions={transactions} setIsProductModalOpen={setIsProductModalOpen} setEditingProduct={setEditingProduct} editingProduct={editingProduct} isProductModalOpen={isProductModalOpen} setViewingPurchaseVoucher={setViewingPurchaseVoucher} damagedRecords={damagedItems} />}
                  {activeTab === 'expiry' && (
                    <ExpiryManager 
                      products={products} 
                      categories={categories} 
                      onUpdateProduct={async (id, updates) => {
                        if (!id || id === 'undefined') {
                          console.warn("Attempted to update product with missing id", updates);
                          return;
                        }
                        try {
                          const cachedProduct = products.find(p => p.id === id);
                          if (cachedProduct) {
                            window.dispatchEvent(new CustomEvent('product-cache-update', {
                              detail: {
                                ...cachedProduct,
                                ...updates,
                                updatedAt: new Date().toISOString()
                              }
                            }));
                          }
                          await update(ref(rtdb, `products/${id}`), {
                            ...updates,
                            updatedAt: new Date().toISOString()
                          });
                        } catch (err) {
                          handleFirestoreError(err, OperationType.WRITE, 'products');
                        }
                      }}
                      onAdjustStock={(product) => {
                        setEditingProduct(product);
                        setIsStockAdjustmentModalOpen(true);
                      }}
                      onEditProduct={(product) => {
                        setEditingProduct(product);
                        setIsProductModalOpen(true);
                      }}
                    />
                  )}
                  {activeTab === 'inventory_settings' && (
                    <InventorySettings 
                      categories={categories} 
                      brands={brands} 
                      onAddCategory={(parentId?: string) => { openCategoryModal(); if (parentId) setParentCategoryId(parentId); }} 
                      onEditCategory={(cat: any) => openCategoryModal(cat)} 
                      onDeleteCategory={handleDeleteCategory}
                      onAddBrand={() => openBrandModal()}
                      onEditBrand={(b: any) => openBrandModal(b)}
                      onDeleteBrand={handleDeleteBrand}
                    />
                  )}
                  {activeTab === 'marketing' && <MarketingPosters products={products} settings={settings} />}
              {activeTab === 'vouchers' && <VoucherManager customers={customers} />}
              {activeTab === 'grns' && <GRNManager products={products} suppliers={suppliers} setIsProductModalOpen={setIsProductModalOpen} setEditingProduct={setEditingProduct} />}
              {activeTab === 'audit' && <InventoryAuditComponent audits={audits} products={products} user={user} settings={settings} />}
              {activeTab === 'promotions' && <Promotions promotions={promotions} products={products} categories={categories} transactions={transactions} settings={settings} />}
              {activeTab === 'customers' && <Customers customers={customers} transactions={transactions} settings={settings} onRestore={loadTransactionToCart} products={products} expenses={expenses} stockAdjustments={stockAdjustments} categories={categories} />}
              {activeTab === 'suppliers' && <Suppliers suppliers={suppliers} products={products} settings={settings} purchases={purchases} supplierPayments={supplierPayments} setViewingPurchaseVoucher={setViewingPurchaseVoucher} categories={categories} user={user} damagedItems={damagedItems} />}
              {activeTab === 'employees' && <Employees employees={employees} transactions={transactions} attendance={attendance} advances={advances} settings={settings} users={users} setIsAddUserModalOpen={setIsAddUserModalOpen} />}
              {activeTab === 'transactions' && (
                <TransactionHistory 
                  transactions={transactions} 
                  onReturn={(t: Transaction) => { setSelectedTransactionForReturn(t); setIsReturnModalOpen(true); }} 
                  onMarkAsDelivered={(t: Transaction) => markAsDelivered(t, settings)} 
                  onEdit={(t: Transaction) => { setSelectedTransactionForEdit(t); setIsEditTransactionModalOpen(true); }}
                  onRestore={loadTransactionToCart}
                  settings={settings} 
                  canAccess={canAccess}
                  profile={profile}
                />
              )}
              {activeTab === 'purchases' && <SmartPurchase 
                products={products} 
                suppliers={suppliers} 
                patterns={patterns} 
                purchases={purchases} 
                purchaseOrders={purchaseOrders} 
                settings={settings} 
                user={user} 
                categories={categories}
                supplierPayments={supplierPayments}
                setIsProductModalOpen={setIsProductModalOpen}
                setEditingProduct={setEditingProduct}
                isProductModalOpen={isProductModalOpen}
                editingProduct={editingProduct}
                setViewingPurchaseVoucher={setViewingPurchaseVoucher}
                handlePrintPurchaseHistory={(f) => printHistory(f, settings)}
                printPurchaseOrder={printPurchaseOrder}
              />}
              {activeTab === 'orders' && <Orders orders={onlineOrders} products={products} syncOrder={syncOrder} autoSync={autoSyncOrders} setAutoSync={setAutoSyncOrders} settings={settings} employees={employees} customers={customers} />}
              {activeTab === 'returns' && <Returns returns={returns} settings={settings} />}
              {activeTab === 'expenses' && <Expenses expenses={expenses} user={user} settings={settings} />}
              {activeTab === 'shifts' && <CashManagement activeShift={activeShift} shifts={shifts} transactions={transactions} expenses={expenses} user={profile!} settings={settings} />}
              {activeTab === 'camera' && <CameraPortal settings={settings} user={profile!} />}
              {activeTab === 'settings' && <Settings settings={settings} />}
              {activeTab === 'archives' && <ArchiveManager user={user} settings={settings} />}
              {activeTab === 'team' && <TeamManagement users={users} employees={employees} settings={settings} setIsAddUserModalOpen={setIsAddUserModalOpen} />}
              {activeTab === 'audit_logs' && <AuditLogs logs={auditLogs} settings={settings} products={products} transactions={transactions} />}
              {activeTab === 'help' && <Help />}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>

        {/* Mobile Bottom Bar */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 h-20 bg-workspace/90 backdrop-blur-2xl border-t border-white/5 flex items-center justify-around px-4 z-40 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            <BottomNavItem 
              icon={<ShoppingCart size={24} />} 
              label="Caisse" 
              active={activeTab === 'checkout'} 
              onClick={() => setActiveTab('checkout')} 
            />
            <BottomNavItem 
              icon={<Package size={24} />} 
              label="Stock" 
              active={activeTab === 'inventory'} 
              onClick={() => setActiveTab('inventory')} 
            />
            <BottomNavItem 
              icon={<ShoppingBag size={24} />} 
              label="Ventes" 
              active={activeTab === 'transactions'} 
              onClick={() => setActiveTab('transactions')} 
            />
             <BottomNavItem 
              icon={<LayoutDashboard size={24} />} 
              label="Stats" 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            <BottomNavItem 
              icon={<SettingsIcon size={24} />} 
              label="Configs" 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
            />
          </nav>
        )}
      </main>

      <ReturnModal 
        isOpen={isReturnModalOpen} 
        onClose={() => { setIsReturnModalOpen(false); setSelectedTransactionForReturn(null); }}
        transaction={selectedTransactionForReturn}
        user={user}
        products={products}
        customers={customers}
        settings={settings}
        allReturns={returns}
      />

      <EditTransactionModal
        isOpen={isEditTransactionModalOpen}
        onClose={() => { setIsEditTransactionModalOpen(false); setSelectedTransactionForEdit(null); }}
        transaction={selectedTransactionForEdit}
        products={products}
        settings={settings}
      />

      <CategoryModal 
        isOpen={isCategoryModalOpen} 
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
          setNewCategoryName('');
          setParentCategoryId('');
          setCategoryImageUrl('');
        }}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
        name={newCategoryName}
        setName={setNewCategoryName}
        parentId={parentCategoryId}
        setParentId={setParentCategoryId}
        imageUrl={categoryImageUrl}
        setImageUrl={setCategoryImageUrl}
        categories={categories}
        editingCategory={editingCategory}
      />

      <BrandModal
        isOpen={isBrandModalOpen}
        onClose={() => {
          setIsBrandModalOpen(false);
          setEditingBrand(null);
          setNewBrandName('');
          setNewBrandLogo('');
          setNewBrandDesc('');
        }}
        onSave={handleSaveBrand}
        name={newBrandName}
        setName={setNewBrandName}
        logo={newBrandLogo}
        setLogo={setNewBrandLogo}
        description={newBrandDesc}
        setDescription={setNewBrandDesc}
        editingBrand={editingBrand}
      />

      <PriceCheckerModal 
        isOpen={isPriceCheckerModalOpen} 
        onClose={() => setIsPriceCheckerModalOpen(false)} 
        products={products} 
        settings={settings}
        categories={categories}
        brands={brands}
      />

      <POSCustomerModal
        isOpen={isPOSCustomerModalOpen}
        onClose={() => setIsPOSCustomerModalOpen(false)}
        onCreated={handlePOSCustomerCreated}
      />
      
      <ProductFormModal
        isOpen={isProductModalOpen}
        onClose={() => { setIsProductModalOpen(false); setEditingProduct(null); }}
        editingProduct={editingProduct}
        products={products}
        categories={categories}
        settings={settings}
        user={user}
        brands={brands}
        setActiveTab={setActiveTab}
      />

      <AddStaffModal 
        isOpen={isAddUserModalOpen} 
        onClose={() => setIsAddUserModalOpen(false)} 
        onSave={handleAddStaffManual} 
      />

      {/* Global Purchase Voucher Modal */}
      <Modal 
        isOpen={!!viewingPurchaseVoucher} 
        onClose={() => setViewingPurchaseVoucher(null)} 
        title={viewingPurchaseVoucher ? `Bon de Réception - ${viewingPurchaseVoucher.invoiceNumber || viewingPurchaseVoucher.id.slice(-6).toUpperCase()}` : "Bon de Réception"}
      >
        {viewingPurchaseVoucher && (
          <div className="space-y-6 print:p-0">
            <div className="flex justify-between items-start border-b border-slate-100 pb-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Fournisseur</p>
                <h4 className="text-xl font-black text-slate-900">{viewingPurchaseVoucher.supplierName}</h4>
                <p className="text-sm text-slate-500">{formatSafe(viewingPurchaseVoucher.date, "dd MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">N° Document</p>
                <p className="text-lg font-mono font-bold text-indigo-600">{viewingPurchaseVoucher.invoiceNumber || 'REC-' + viewingPurchaseVoucher.id.slice(-6).toUpperCase()}</p>
                <span className={`inline-block mt-2 px-2 py-1 rounded-full text-[10px] font-black uppercase ${viewingPurchaseVoucher.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {viewingPurchaseVoucher.status === 'completed' ? 'Réceptionné' : 'En attente'}
                </span>
              </div>
            </div>

            <div className="overflow-hidden border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-3 text-[10px] font-black text-slate-400 uppercase">Article</th>
                    <th className="p-3 text-[10px] font-black text-slate-400 uppercase text-center">Qté</th>
                    <th className="p-3 text-[10px] font-black text-slate-400 uppercase text-right">Prix HT</th>
                    <th className="p-3 text-[10px] font-black text-slate-400 uppercase text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingPurchaseVoucher.items.map((item, idx) => (
                    <tr key={`purchase-item-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <p className="text-sm font-bold text-slate-800">{item.name}</p>
                        <p className="text-[10px] text-slate-400">Réf: {item.productId ? item.productId.slice(-6).toUpperCase() : 'NO-SKU'}</p>
                      </td>
                      <td className="p-3 text-sm text-slate-600 text-center font-bold">{item.quantity}</td>
                      <td className="p-3 text-sm text-slate-600 text-right">{item.costPrice.toFixed(2)} {settings.currency}</td>
                      <td className="p-3 text-sm font-bold text-slate-900 text-right">{(item.quantity * item.costPrice).toFixed(2)} {settings.currency}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={3} className="p-4 text-right text-slate-500">Total Général</td>
                    <td className="p-4 text-right text-lg text-indigo-700 font-black">{viewingPurchaseVoucher.total.toFixed(2)} {settings.currency}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex gap-3 pt-6 border-t border-slate-100">
              <Button onClick={() => printPurchaseVoucher(viewingPurchaseVoucher, settings)} variant="secondary" className="flex-1 gap-2">
                <Printer size={16} /> Imprimer
              </Button>
              <Button onClick={() => setViewingPurchaseVoucher(null)} className="flex-1">
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <LowStockModal 
        isOpen={isLowStockModalOpen}
        onClose={() => setIsLowStockModalOpen(false)}
        products={lowStockProducts}
        settings={settings}
      />

      <ExpirationModal
        isOpen={isExpirationModalOpen}
        onClose={() => setIsExpirationModalOpen(false)}
        products={expiringProducts}
      />

      <StockAdjustmentModal
        isOpen={isStockAdjustmentModalOpen}
        onClose={() => { setIsStockAdjustmentModalOpen(false); setEditingProduct(null); }}
        product={editingProduct!}
        user={user}
        settings={settings}
      />
      </div>
    </Suspense>
  );
}



// --- Customer Login ---


// --- Customer Dashboard ---




function NavItem({ icon, label, active, onClick, collapsed, href }: any) {
  const Component = href ? 'a' : 'button';
  return (
    <Component 
      href={href}
      onClick={href ? (e: any) => {
        if (!e.ctrlKey && !e.metaKey && e.button !== 1) {
          e.preventDefault();
          onClick();
        }
      } : onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-[1.25rem] transition-all relative group text-left",
        active 
          ? "bg-indigo-600 text-white shadow-lg ring-1 ring-indigo-400/20" 
          : "text-industrial-400 hover:text-indigo-600 hover:bg-industrial-800"
      )}
    >
      <div className={cn(
        "flex-shrink-0 transition-transform duration-300 group-hover:scale-110",
        active ? "text-white" : "text-industrial-500 group-hover:text-indigo-600"
      )}>
        {icon}
      </div>
      {!collapsed && (
        <span className={cn(
          "font-bold truncate flex-1 tracking-tight text-sm",
          active ? "text-white" : "text-slate-600 group-hover:text-slate-900"
        )}>
          {label}
        </span>
      )}
      {!collapsed && href && <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-all text-indigo-400 translate-x-2 group-hover:translate-x-0" />}
      {collapsed && (
        <div className="absolute left-full ml-4 px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 z-50 bg-slate-900 text-white shadow-2xl border border-slate-700 translate-x-[-10px] group-hover:translate-x-0">
          {label}
        </div>
      )}
      {active && (
        <motion.div 
          layoutId="activeNavIndicator"
          className="absolute left-[-4px] top-1/4 bottom-1/4 w-[4px] bg-white rounded-full"
        />
      )}
    </Component>
  );
}

function BottomNavItem({ icon, label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 min-w-[64px] transition-all relative active:scale-90",
        active ? "text-indigo-400" : "text-white"
      )}
    >
      <div className={cn(
        "p-2.5 rounded-2xl transition-all duration-300",
        active ? "bg-indigo-500/10 shadow-[inset_0_0_10px_rgba(99,102,241,0.1)]" : "bg-transparent"
      )}>
        {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<any>, { 
          strokeWidth: active ? 2.5 : 2,
          size: 24 
        })}
      </div>
      <span className={cn(
        "text-[9px] font-black uppercase tracking-widest transition-all",
        active ? "opacity-100 scale-100" : "opacity-40 scale-95"
      )}>
        {label}
      </span>
      {active && (
        <motion.div 
          layoutId="bottomNavDot"
          className="absolute -top-1 w-1 h-1 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,1)]"
          transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
        />
      )}
    </button>
  );
}

// --- Quick Add Product Modal ---

// --- Checkout View ---


// --- Stock Adjustment Modal ---


// --- Duplicate SKU Manager Modal ---




// --- Dashboard View ---



// --- Promotions View ---


const markAsDelivered = async (transaction: Transaction, settings: CompanySettings) => {
  try {
    const updates: any = {};
    updates[`transactions/${transaction.id}/status`] = 'delivered';
    
    if (transaction.customerId) {
        // We might need the full list of customers here, but markAsDelivered is outside App component
        // Usually it's better to pass it in or fetch it.
        // For now let's hope it's not needed or use a separate fetch if critical.
        // Actually this function is at the bottom of App.tsx but outside App component?
        // Let's check where it's used and if it can access state.
    }
    
    await update(ref(rtdb), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'transactions');
  }
};

// --- End of App ---
