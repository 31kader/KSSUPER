import { supabase } from '../supabase';
import { toast } from 'sonner';
import { DEFAULT_PERMISSIONS } from '../constants';
import { QuickAddProductModal } from './QuickAddProductModal';
import { DeliveryRequestModal } from './DeliveryRequestModal';
import { CustomerProfile } from './CustomerProfile';
import React, { useState, useMemo, memo, useEffect, useRef, useDeferredValue, useCallback } from 'react';
import { Package, Tag, RefreshCw, LayoutGrid, Plus, FileSpreadsheet, Upload, ShoppingBag, AlertTriangle, Zap, Info, Search, Filter, Scan, LayoutList, Layers, Truck, ArrowUpDown, Award, Calendar, FolderTree, AlertCircle, TrendingDown, ShieldCheck, RotateCcw, Check, Printer, Copy, PackageOpen, Trash2, ChevronUp, BarcodeIcon, ShoppingCart, Eye, X, MessageCircle, Phone, MapPin, Navigation, Edit, Clock, Mail, Percent, DollarSign, Star, Palette, FileText, AlignLeft, Shield, UserCog, Link2, MapIcon, Brain, Database, ArrowRight, CreditCard, Banknote, Minus, UserPlus, ChevronDown, Users, ArrowUpRight, ArrowDownRight, LogOut, Bell, TrendingUp, History, EyeOff, LogIn, Store, Gift, Wallet, Edit2, MessageSquare, CheckCircle2 } from 'lucide-react';
import { Button, Card, Modal, ConfirmDialog, BlurCard, SortableHeader, SafeImage } from './ui';
import { Product, Category, Brand, StockAdjustment, CompanySettings, SupplierSync, Supplier, Purchase, Transaction, OnlineOrder, Employee, Customer, CartItem, ProductReturn, RolePermissions, Promotion, Voucher, PurchaseOrder, POSSession } from '../types';
import { cn, logAction, safeDate, exportToExcel, getHierarchicalCategories, formatSafe, exportToCSV, generateUniqueId, isLocked, formatProductStock, calculateItemPrice, playScanSound, announcePrice } from '../lib/utils';
import { printReceipt, printPurchaseOrder } from '../services/printService';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isToday, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';

import { BarcodeScanner } from './BarcodeScanner';
import { Categories } from './Categories';
import { Brands } from './Brands';

export const mapDoc = <T,>(doc: any): T => {
  return { id: doc.id, ...doc.data() } as unknown as T;
};

interface QuantityInputProps {
  item: CartItem;
  setQuantity: (cartItemId: string, quantity: number) => void;
}

const QuantityInput = React.forwardRef<HTMLInputElement, QuantityInputProps>(
  ({ item, setQuantity }, ref) => {
    const [localVal, setLocalVal] = useState<string>(item.quantity.toString());

    useEffect(() => {
      if (parseFloat(localVal) !== item.quantity) {
        setLocalVal(item.quantity.toString());
      }
    }, [item.quantity]);

    const handleChange = (valStr: string) => {
      const normalized = valStr.replace(',', '.');
      
      if (normalized === '' || normalized === '-' || /^-?\d*[.]?\d*$/.test(normalized)) {
        setLocalVal(valStr);
        
        const parsed = parseFloat(normalized);
        if (!isNaN(parsed)) {
          setQuantity(item.cartItemId || '', parsed);
        }
      }
    };

    const handleBlur = () => {
      const parsed = parseFloat(localVal.replace(',', '.'));
      if (isNaN(parsed) || parsed <= 0) {
        setLocalVal('0');
        setQuantity(item.cartItemId || '', 0);
      } else {
        setLocalVal(parsed.toString());
        setQuantity(item.cartItemId || '', parsed);
      }
    };

    return (
      <input
        type="text"
        inputMode="decimal"
        ref={ref}
        value={localVal}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onClick={(e) => e.stopPropagation()}
        className="w-16 text-center text-sm font-black bg-transparent border-none outline-none text-white appearance-none m-0 focus:ring-0"
      />
    );
  }
);

QuantityInput.displayName = 'QuantityInput';

export const Checkout = memo(function Checkout({ 
  products, 
  cart, 
  setCart, 
  user, 
  profile, 
  promotions, 
  customers, 
  settings, 
  activeShift,
  setActiveShift, 
  setActiveTab, 
  transactions, 
  setIsPOSCustomerModalOpen, 
  selectedCustomer,
  setSelectedCustomer,
  posSessions,
  setPosSessions,
  activeSessionId,
  setActiveSessionId,
  setIsProductModalOpen,
  setEditingProduct,
  isWholesale,
  setIsWholesale,
  deliveryMethod,
  setDeliveryMethod,
  activeStaffId,
  employees
}: any) {
  const role = profile?.role || 'cashier';
  const permissions = settings.rolePermissions?.[role] || DEFAULT_PERMISSIONS[role as keyof typeof DEFAULT_PERMISSIONS];
  
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const cartEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to cart end when items change
  useEffect(() => {
    cartEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [cart]);

  const deferredSearch = useDeferredValue(search);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [activePromotion, setActivePromotion] = useState<Promotion | null>(null);
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [useBalance, setUseBalance] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [isPriceCheckerOpen, setIsPriceCheckerOpen] = useState(false);
  const [priceCheckResult, setPriceCheckResult] = useState<Product | null>(null);
  const [hasRestored, setHasRestored] = useState(false);
  const [isProductGridOpen, setIsProductGridOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [newProductBarcode, setNewProductBarcode] = useState('');
  const [initialCashInput, setInitialCashInput] = useState('');
  const [isOpeningSession, setIsOpeningSession] = useState(false);

  const handleDirectOpenShift = async () => {
    if (!initialCashInput || isOpeningSession) return;
    setIsOpeningSession(true);
    try {
      const newId = Math.random().toString(36).substring(2, 10);
      const newShift = {
        id: newId,
        openedAt: new Date().toISOString(),
        openedBy: profile?.displayName || profile?.email || user?.email || 'Unknown',
        initialCash: parseFloat(initialCashInput) || 0,
        status: 'open'
      };
      const { error } = await supabase.from('shifts').insert(newShift);
      if (error) throw error;
      setActiveShift(newShift); // Optimistic update to hide overlay immediately
      toast.success("Session de caisse ouverte avec succès !");
      setInitialCashInput('');
    } catch (error: any) {
      console.error("Failed to open shift:", error);
      toast.error("Erreur lors de l'ouverture de la session: " + error.message);
    } finally {
      setIsOpeningSession(false);
    }
  };
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [keepExcessInBalance, setKeepExcessInBalance] = useState<boolean>(false);

  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const scannerBuffer = useRef<{ text: string, lastTime: number }>({ text: '', lastTime: 0 });

  // Reset session-specific local states when switching tabs
  useEffect(() => {
    setActivePromotion(null);
    setAppliedVoucher(null);
    setPromoCode('');
    setVoucherCode('');
    setUseLoyaltyPoints(false);
    setUseBalance(false);
    setIsReturnMode(false);
    setReceivedAmount('');
    setKeepExcessInBalance(false);
    setTimeout(() => searchRef.current?.focus(), 100);
  }, [activeSessionId]);

  // Reset payment calculations when customer changes
  useEffect(() => {
    setReceivedAmount('');
    setKeepExcessInBalance(false);
  }, [selectedCustomer]);

  const addNewSession = () => {
    if (posSessions.length >= 10) return;
    const newId = generateUniqueId();
    const nextNumber = posSessions.length + 1;
    const newSession: POSSession = {
      id: newId,
      name: `Ticket ${nextNumber}`,
      cart: [],
      selectedCustomer: null
    };
    setPosSessions((prev: any) => [...prev, newSession]);
    setActiveSessionId(newId);
  };

  const removeSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (posSessions.length <= 1) return;
    
    setPosSessions((prev: any) => {
      const filtered = prev.filter((s: any) => s.id !== id);
      if (activeSessionId === id) {
        setActiveSessionId(filtered[filtered.length - 1].id);
      }
      return filtered;
    });
  };

  // Auto-focus search on mount
  useEffect(() => {
    if (activeShift) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [activeShift]);

  // Keyboard shortcuts for cart quantity and search focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' || e.key === 'F11') {
        e.preventDefault();
        if (cart.length > 0) {
          const lastItem = cart[cart.length - 1];
          setSelectedItemId(lastItem.id);
          setTimeout(() => {
            const input = quantityInputRefs.current[lastItem.cartItemId || ''];
            if (input) {
              input.focus();
              input.select();
            }
          }, 10);
        }
      } else if (e.key === 'F10' || e.key === 'F3') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  useEffect(() => {
    if (selectedItemId && !cart.find(item => item.id === selectedItemId)) {
      setSelectedItemId(null);
    }
  }, [cart, selectedItemId]);

  const customerHistory = useMemo(() => {
    if (!selectedCustomer) return [];
    return transactions
      .filter((t: any) => t.customerId === selectedCustomer.id)
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3);
  }, [selectedCustomer, transactions]);

  // Restore cart draft on mount
  useEffect(() => {
    if (!user?.uid || hasRestored) return;

    const loadDraft = async () => {
      try {
        const { data: draft, error } = await supabase
          .from('cart_drafts')
          .select('*')
          .eq('userId', user.uid)
          .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found

        if (draft) {
          if (draft.sessions && draft.sessions.length > 0) {
            setPosSessions(draft.sessions);
            if (activeSessionId !== draft.activeSessionId) {
               setActiveSessionId(draft.activeSessionId);
            }
          } else if (draft.items && cart.length === 0) {
            setCart(draft.items);
          }
        }
        setHasRestored(true);
      } catch (error: any) {
        console.error("Error loading cart draft:", error);
        setHasRestored(true);
      }
    };

    loadDraft();
  }, [user?.uid, hasRestored, cart.length, setCart]);

  // Auto-save cart draft
  useEffect(() => {
    if (!user?.uid || !hasRestored) return;

    const saveOrDeleteDraft = async () => {
      try {
        const hasContent = posSessions.some(s => s.cart.length > 0);
        
        if (!hasContent) {
          await supabase.from('cart_drafts').delete().eq('userId', user.uid);
          return;
        }

        const sanitizedSessions = posSessions.map(session => ({
          ...session,
          cart: session.cart.map(item => {
            const { imageUrl, imageUrls, description, bundleItems, ...rest } = item;
            return rest;
          })
        }));

        await supabase.from('cart_drafts').upsert({
          userId: user.uid,
          sessions: sanitizedSessions,
          activeSessionId,
          updatedAt: new Date().toISOString()
        });
      } catch (error: any) {
        console.error("Error saving cart draft:", error);
      }
    };

    const timeoutId = setTimeout(saveOrDeleteDraft, 2000);
    return () => clearTimeout(timeoutId);
  }, [posSessions, activeSessionId, user?.uid, hasRestored]);

  // Memoized Cart modification functions
  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    if (!product) return;
    
    if (!settings.allowNegativeStock && (product.stock || 0) <= 0 && quantity > 0) {
      toast.error(`Rupture de stock pour ${product.name}. Stock actuel: ${product.stock}`);
      return;
    }
    
    const newCartItemId = generateUniqueId();
    setSelectedItemId(product.id);
    
    setCart((prev: CartItem[]) => {
      if (quantity === 0) return prev;
      
      const existingItemIndex = prev.findIndex(item => item.id === product.id);
      
      if (existingItemIndex !== -1 && !isReturnMode) {
        const updatedCart = [...prev];
        const existingItem = updatedCart[existingItemIndex];
        const newQty = existingItem.quantity + quantity;
        
        if (!settings.allowNegativeStock && newQty > (product.stock || 0) && quantity > 0) {
           toast.error(`Stock insuffisant pour ${product.name}. Stock: ${product.stock}`);
           return prev;
        }
        
        // Remove from current position and push to the end
        updatedCart.splice(existingItemIndex, 1);
        const updatedItem = { ...existingItem, quantity: newQty };
        
        toast.success(`${product.name} mis à jour (+${quantity})`);
        return [...updatedCart, updatedItem];
      }

      const initialQty = settings.allowNegativeStock 
        ? quantity 
        : (quantity > 0 ? Math.min(quantity, Math.max(0, product.stock)) : quantity);

      if (initialQty <= 0 && quantity > 0 && !settings.allowNegativeStock) {
        toast.error(`Stock épuisé pour ${product.name}`);
        return prev;
      }

      toast.success(`${product.name} ajouté au panier`);
      return [...prev, { ...product, quantity: initialQty, cartItemId: newCartItemId }];
    });
    
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [settings.allowNegativeStock, setCart, isReturnMode]);

  // Pre-cached O(1) maps of products for lightning fast scan/search resolution
  const productsCache = useMemo(() => {
    const exactMap = new Map<string, Product>();
    const normalizedMap = new Map<string, Product>();
    const nameMap = new Map<string, Product>();

    products.forEach((p: Product) => {
      // 1. Exact matches (sku, barcode, reference, id)
      if (p.sku) exactMap.set(String(p.sku).trim().toLowerCase(), p);
      if (p.barcode) exactMap.set(String(p.barcode).trim().toLowerCase(), p);
      if (p.reference) exactMap.set(String(p.reference).trim().toLowerCase(), p);
      if (p.id) exactMap.set(String(p.id).trim().toLowerCase(), p);

      // 2. Normalized matches
      if (p.sku) normalizedMap.set(String(p.sku).replace(/[^a-z0-9]/g, '').toLowerCase(), p);
      if (p.barcode) normalizedMap.set(String(p.barcode).replace(/[^a-z0-9]/g, '').toLowerCase(), p);
      if (p.reference) normalizedMap.set(String(p.reference).replace(/[^a-z0-9]/g, '').toLowerCase(), p);

      // 3. Name matches
      if (p.name) nameMap.set(String(p.name).trim().toLowerCase(), p);
    });

    return { exactMap, normalizedMap, nameMap };
  }, [products]);

  const handleBarcodeScan = useCallback((barcode: string) => {
    if (!barcode || barcode.trim().length === 0) return;
    const cleanBarcode = barcode.trim().toLowerCase();
    const normalizedBarcode = cleanBarcode.replace(/[^a-z0-9]/g, '');
    playScanSound();

    let product = productsCache.exactMap.get(cleanBarcode);

    if (!product && normalizedBarcode) {
      product = productsCache.normalizedMap.get(normalizedBarcode);
    }
    
    if (!product) {
      product = productsCache.nameMap.get(cleanBarcode);
    }
    
    if (!product && normalizedBarcode.length >= 6) {
      // High Performance: Use a more targeted scan fallback if possible
      // But for now, we'll keep the find but ensure it's not run unnecessarily
      product = products.find((p: Product) => 
        (p.sku && String(p.sku).toLowerCase().endsWith(normalizedBarcode)) ||
        (p.barcode && String(p.barcode).toLowerCase().endsWith(normalizedBarcode))
      );
    }

    if (product) {
      if (isPriceCheckerOpen) {
        setPriceCheckResult(product);
      } else {
        addToCart(product, isReturnMode ? -1 : 1);
      }
    } else {
      toast.error(`Code barres non reconnu: ${barcode}`);
      setNewProductBarcode(barcode);
      setIsScannerOpen(false); // Close scanner to show modal
      setIsQuickAddModalOpen(true);
    }
  }, [products, productsCache, isPriceCheckerOpen, isReturnMode, addToCart]);

  // Global Barcode Scanner Listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      
      const now = Date.now();
      const diff = now - scannerBuffer.current.lastTime;
      
      if (e.key === 'Enter') {
        if (scannerBuffer.current.text.length >= 2 && diff < 200) {
          handleBarcodeScan(scannerBuffer.current.text);
          scannerBuffer.current.text = '';
        } else {
          scannerBuffer.current.text = '';
        }
      } else if (e.key.length === 1) {
        if (diff < 150 || scannerBuffer.current.text === '') {
          scannerBuffer.current.text += e.key;
        } else {
          scannerBuffer.current.text = e.key;
        }
      }
      scannerBuffer.current.lastTime = now;
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleBarcodeScan]);

  const handleCheckout = async (method: 'cash' | 'card' | 'balance', shouldPrint: boolean = false) => {
    if (isProcessing) return;
    if (cart.length === 0) return;
    
    if (method === 'balance') {
      if (!selectedCustomer) {
        alert("Veuillez sélectionner un client pour payer par solde.");
        return;
      }
      if ((selectedCustomer.balance || 0) < total) {
        alert("Solde insuffisant.");
        return;
      }
    }

    setIsProcessing(true);
    console.log("Checkout processing started");
    try {
      const transactionId = generateUniqueId();
      
      const sanitizedCart = cart.map((item: CartItem) => {
        const { imageUrl, imageUrls, description, bundleItems, ...rest } = item;
        return rest;
      }) as CartItem[];

      const pointsEarned = (selectedCustomer && deliveryMethod === 'in_store') 
        ? Math.floor(total * (settings.loyaltyPointsPerCurrencyUnit || 1)) 
        : 0;
        
      const parsedReceived = receivedAmount !== '' ? parseFloat(receivedAmount) || 0 : total;
      const parsedReturned = (receivedAmount !== '' && parsedReceived > total && !keepExcessInBalance) ? parsedReceived - total : 0;
        
      const transaction = {
        id: transactionId,
        items: sanitizedCart,
        total,
        discountAmount,
        pointsDiscount,
        balanceUsed: method === 'balance' ? total : 0,
        voucherDiscount,
        promotionId: promotionToApply?.id || null,
        paymentMethod: method,
        deliveryMethod,
        status: deliveryMethod === 'in_store' ? 'delivered' : 'pending',
        pointsEarned,
        amountReceived: parsedReceived,
        amountReturned: parsedReturned,
        timestamp: new Date().toISOString(),
        userId: user.uid,
        isWholesale,
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || null,
        employeeId: activeStaffId || profile?.employeeId || null,
        employeeName: activeStaffId 
          ? (employees.find((e: any) => e.id === activeStaffId)?.name || profile?.displayName)
          : (profile?.displayName || null)
      };
      
      // Save Transaction
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || (user && (user as any).isOffline)) {
        try {
          const offlineTxs = JSON.parse(localStorage.getItem('nexus_offline_transactions') || '[]');
          offlineTxs.unshift(transaction);
          localStorage.setItem('nexus_offline_transactions', JSON.stringify(offlineTxs));
          window.dispatchEvent(new CustomEvent('offline-transaction-created', { detail: transaction }));
        } catch (err) {
          console.error("Failed to write to offline storage:", err);
        }
      } else {
        const { error: txError } = await supabase.from('transactions').insert(transaction);
        if (txError) throw txError;
      }
      logAction(user.uid, user.displayName || 'Utilisateur', 'Vente', 'POS', `Vente de ${total.toFixed(2)} ${settings.currency} via ${method}`);
      
      // 2. Update Stock
      for (const item of cart) {
        if (!item.id || item.id === 'undefined') continue;
        if (item.isBundle && item.bundleItems) {
          for (const bundleItem of item.bundleItems) {
            const componentProduct = products.find((p: Product) => p.id === bundleItem.productId);
            if (componentProduct && componentProduct.id) {
              const { data: pData } = await supabase.from('products').select('stock').eq('id', componentProduct.id).single();
              const currentStock = pData?.stock || 0;
              await supabase.from('products').update({ 
                  stock: currentStock - (bundleItem.quantity * item.quantity),
                  updatedAt: new Date().toISOString()
              }).eq('id', componentProduct.id);
            }
          }
        } else {
          if (item.id && item.id.trim() !== '') {
            const product = products.find((p: Product) => p.id === item.id);
            if (product) {
              let newStock = product.stock - item.quantity;
              
              // Handle unpack
              if (newStock < 0 && product.autoUnpack && product.parentId && product.unitsPerParent) {
                const shortfall = -newStock;
                const parentsNeeded = Math.ceil(shortfall / product.unitsPerParent);
                const parentProduct = products.find((p: Product) => p.id === product.parentId);
                if (parentProduct && parentProduct.id) {
                   await supabase.from('products').update({
                       stock: parentProduct.stock - parentsNeeded,
                       updatedAt: new Date().toISOString()
                   }).eq('id', parentProduct.id);
                   newStock = (parentsNeeded * product.unitsPerParent) + newStock;
                }
              }
              await supabase.from('products').update({
                  stock: newStock,
                  updatedAt: new Date().toISOString()
              }).eq('id', product.id);
            }
          }
        }
      }

      // 3. Update Customer
      if (selectedCustomer) {
        const pointsSpent = useLoyaltyPoints ? Math.floor(pointsDiscount / (settings.loyaltyPointValue || 0.01)) : 0;
        
        let finalBalance = selectedCustomer.balance || 0;
        let noteStr = `[FACTURE] Validation commande d'un total de ${total.toFixed(2)} ${settings.currency} (Payé via ${method.toUpperCase()})`;
        
        if (method === 'balance') {
          finalBalance -= total;
          noteStr = `[ACHAT SUR SOLDE] Achat de ${total.toFixed(2)} ${settings.currency} débité du solde prépayé. (Nouveau solde: ${finalBalance.toFixed(2)} ${settings.currency})`;
        } else if (receivedAmount !== '') {
          const actualPaid = parseFloat(receivedAmount) || 0;
          if (actualPaid < total) {
            const diff = total - actualPaid;
            finalBalance -= diff;
            noteStr = `[VENTE A CREDIT] Achat de ${total.toFixed(2)} ${settings.currency}. Reçu: ${actualPaid.toFixed(2)} ${settings.currency}. Dette ajoutée: +${diff.toFixed(2)} ${settings.currency}. (Reste à payer: ${Math.abs(finalBalance).toFixed(2)} ${settings.currency})`;
          } else if (actualPaid > total && keepExcessInBalance) {
            const diff = actualPaid - total;
            finalBalance += diff;
            noteStr = `[SURPLUS EN CREDIT] Achat de ${total.toFixed(2)} ${settings.currency}. Reçu: ${actualPaid.toFixed(2)} ${settings.currency}. Surplus gardé en solde: +${diff.toFixed(2)} ${settings.currency}. (Nouveau solde: ${finalBalance.toFixed(2)} ${settings.currency})`;
          } else if (actualPaid > total) {
            const diff = actualPaid - total;
            noteStr = `[FACTURE] Achat de ${total.toFixed(2)} ${settings.currency}. Reçu: ${actualPaid.toFixed(2)} ${settings.currency}. Monnaie rendue: ${diff.toFixed(2)} ${settings.currency}.`;
          }
        }

        const noteEntry = {
          note: noteStr,
          author: user.displayName || 'Vente POS',
          timestamp: new Date().toISOString()
        };
        const cashierNotes = [...(selectedCustomer.cashierNotes || []), noteEntry];
        
        await supabase.from('customers').update({
            cashierNotes,
            loyaltyPoints: (selectedCustomer.loyaltyPoints || 0) + pointsEarned - pointsSpent,
            balance: finalBalance,
            totalSpent: (selectedCustomer.totalSpent || 0) + total,
            updatedAt: new Date().toISOString(),
            lastVisit: new Date().toISOString()
        }).eq('id', selectedCustomer.id);
      }

      // 4. Update Voucher
      if (appliedVoucher) {
        const newBalance = (appliedVoucher.currentBalance || appliedVoucher.value) - voucherDiscount;
        const isFullyUsed = appliedVoucher.type === 'percent' || newBalance <= 0;
        
        const newLog = {
          transactionId: transactionId,
          amountUsed: voucherDiscount,
          remainingBalance: Math.max(0, newBalance),
          date: new Date().toISOString(),
          userName: profile?.displayName || 'Caisse'
        };
        const currentLogs = appliedVoucher.usageLogs || [];
        
        await supabase.from('vouchers').update({
            currentBalance: Math.max(0, newBalance),
            status: isFullyUsed ? 'used' : 'active',
            usageLogs: [...currentLogs, newLog]
        }).eq('id', appliedVoucher.id);
      }

      setLastTransaction({ ...transaction, id: transactionId, paymentMethod: method } as Transaction);
      if (shouldPrint) {
        printReceipt({ ...transaction, id: transactionId, paymentMethod: method } as any, settings);
      }
      setCart([]);
      setSelectedCustomer(null);
      setAppliedVoucher(null);
      setDeliveryMethod('in_store');
      setUseLoyaltyPoints(false);
      setUseBalance(false);
      setReceivedAmount('');
      setKeepExcessInBalance(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        searchRef.current?.focus();
      }, 5000);
      searchRef.current?.focus();
    } catch (error) {
      console.error("Local checkout logic error: ", error);
      setIsProcessing(false);
    } finally {
      console.log("Checkout processing finished, setting isProcessing to false");
      setIsProcessing(false);
    }
  };

  // Main Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1' || e.key === 'F5') { 
        e.preventDefault(); 
        handleCheckout('cash', false); 
      }
      else if (e.key === 'F4' || (e.altKey && e.key.toLowerCase() === 'p')) { 
        e.preventDefault(); 
        handleCheckout('cash', true); 
      }
      else if (e.key === 'F3' || e.key === 'F10') { 
        e.preventDefault(); 
        searchRef.current?.focus(); 
        searchRef.current?.select();
      }
      else if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleCheckout('cash'); }
      else if (e.ctrlKey && e.key === 'v') { e.preventDefault(); setCart([]); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCheckout, setCart]);

  // Price Announcement on Add
  useEffect(() => {
    if (cart.length > 0 && settings.enableVoiceGuidance) {
      const lastItem = cart[cart.length - 1];
      announcePrice(lastItem.name, calculateItemPrice(lastItem, isWholesale), settings.currency);
    }
  }, [cart.length, isWholesale, settings.enableVoiceGuidance, settings.currency]);

  const filteredProducts = useMemo(() => {
    const activeProducts = products.filter((p: Product) => p.status === 'active');
    if (!deferredSearch) return activeProducts.slice(0, 100); // Show first 100 products by default
    const searchLower = deferredSearch.toLowerCase();
    return activeProducts.filter((p: Product) => {
      // Remove visibility constraint for search - we want to be able to find anything
      return (
        (p.name || '').toLowerCase().includes(searchLower) || 
        (p.sku || '').toLowerCase().includes(searchLower) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchLower)) ||
        (p.description || '').toLowerCase().includes(searchLower) ||
        (p.tags || []).some(tag => tag.toLowerCase().includes(searchLower))
      );
    }).slice(0, 500); // Limit results for performance
  }, [products, deferredSearch]);

  const applyVoucher = async () => {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .eq('code', voucherCode.toUpperCase())
        .eq('status', 'active');
      
      if (error || !data || data.length === 0) {
        alert('Bon d\'achat invalide ou expiré.');
        return;
      }
      
      const voucher = data[0] as Voucher;
      
      // Basic Expiry Check
      if (voucher.expiryDate && new Date(voucher.expiryDate) < new Date()) {
        alert('Ce bon d\'achat est expiré.');
        return;
      }

      // Min Purchase Check
      if (voucher.minPurchase && subtotal < voucher.minPurchase) {
        alert(`Ce bon nécessite un achat minimum de ${voucher.minPurchase.toFixed(2)} ${settings.currency}.`);
        return;
      }

      // Customer Restriction Check
      if (voucher.customerId && (!selectedCustomer || selectedCustomer.id !== voucher.customerId)) {
        alert(`Ce bon est réservé à un client spécifique (${voucher.customerName || 'Identifié'}).`);
        return;
      }

      // Balance/Usage Check for fixed
      if (voucher.type === 'fixed' && (voucher.currentBalance || 0) <= 0) {
        alert("Ce bon n'a plus de solde disponible.");
        return;
      }
      
      setAppliedVoucher(voucher);
      setVoucherCode('');
    } catch (error) {
      console.error('Error applying voucher:', error);
      alert('Erreur lors de l\'application du bon.');
    }
  };

  const applyPromoCode = () => {
    const promo = promotions.find((p: Promotion) => p.code?.toUpperCase() === promoCode.toUpperCase() && p.isActive);
    if (promo) {
      setActivePromotion(promo);
      setPromoCode('');
    } else {
      alert("Code promo invalide ou expiré");
    }
  };

  const addCustomerNote = async (note: string) => {
    if (!selectedCustomer) return;
    const noteEntry = {
      note,
      timestamp: new Date().toISOString(),
      author: profile?.displayName || 'Caisse'
    };
    
    setSelectedCustomer((prev: Customer) => ({
      ...prev,
      cashierNotes: [...(prev.cashierNotes || []), noteEntry]
    }));
    
    try {
      const notes = [...(selectedCustomer.cashierNotes || []), noteEntry];
      const { error } = await supabase.from('customers').update({ cashierNotes: notes }).eq('id', selectedCustomer.id);
      if (error) throw error;
      toast.success("Note ajoutée");
    } catch (error: any) {
      console.error("Error adding note:", error);
      toast.error("Erreur lors de l'ajout de la note: " + error.message);
    }
  };

  const setQuantity = useCallback((cartItemId: string, quantity: number) => {
    setCart((prev: CartItem[]) => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        const product = products.find((p: Product) => p.id === item.id);
        const resolvedQty = isNaN(quantity) ? 1 : quantity;
        return { 
          ...item, 
          quantity: settings.allowNegativeStock ? resolvedQty : (resolvedQty > 0 ? Math.min(resolvedQty, Math.max(resolvedQty, product?.stock || 0)) : resolvedQty) 
        };
      }
      return item;
    }));
  }, [products, settings.allowNegativeStock, setCart]);

  const setPrice = useCallback((cartItemId: string, price: number) => {
    setCart((prev: CartItem[]) => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        return { ...item, overriddenPrice: price };
      }
      return item;
    }));
  }, [setCart]);

  const removeFromCart = useCallback((cartItemId: string) => {
    setCart((prev: CartItem[]) => prev.filter(item => item.cartItemId !== cartItemId));
    searchRef.current?.focus();
  }, [setCart]);

  const [discountingItemId, setDiscountingItemId] = useState<string | null>(null);
  const [lineDiscountType, setLineDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [lineDiscountValue, setLineDiscountValue] = useState<string>('0');

  useEffect(() => {
    if (discountingItemId) {
      const item = cart.find(i => i.cartItemId === discountingItemId);
      if (item?.lineDiscount) {
        setLineDiscountType(item.lineDiscount.type);
        setLineDiscountValue(item.lineDiscount.value.toString());
      } else {
        setLineDiscountType('percentage');
        setLineDiscountValue('0');
      }
    }
  }, [discountingItemId, cart]);

  const setLineDiscount = (cartItemId: string, discount: { type: 'percentage' | 'fixed', value: number } | null) => {
    setCart((prev: CartItem[]) => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        return { ...item, lineDiscount: discount || null };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((sum: number, item: CartItem) => {
    const itemPrice = parseFloat(calculateItemPrice(item, isWholesale)?.toString()) || 0;
    const quantity = parseFloat(item.quantity?.toString()) || 0;
    return sum + (itemPrice * Math.max(-999, isNaN(quantity) ? 0 : quantity));
  }, 0);

  // Apply automatic promotions (no code needed)
  const autoPromotion = promotions.find((p: Promotion) => {
    if (p.code || !p.isActive) return false;
    const now = new Date();
    const start = p.startDate ? new Date(p.startDate) : null;
    const end = p.endDate ? new Date(p.endDate) : null;
    if (start && start > now) return false;
    if (end && end < now) return false;
    return !p.minPurchase || subtotal >= p.minPurchase;
  });

  const promotionToApply = activePromotion || autoPromotion;

  let total = subtotal;
  let discountAmount = 0;

  if (promotionToApply) {
    const isApplicable = (item: CartItem) => {
      const hasCats = promotionToApply.applicableCategories && promotionToApply.applicableCategories.length > 0;
      const hasProds = promotionToApply.applicableProducts && promotionToApply.applicableProducts.length > 0;
      
      if (!hasCats && !hasProds) return true;
      
      const catMatch = hasCats && item.categoryId && promotionToApply.applicableCategories?.includes(item.categoryId);
      const prodMatch = hasProds && promotionToApply.applicableProducts?.includes(item.id);
      
      return catMatch || prodMatch;
    };

    if (promotionToApply.type === 'percentage') {
      const applicableSubtotal = cart.reduce((sum: number, item: CartItem) => {
        const p = parseFloat(item.price?.toString()) || 0;
        const q = parseFloat(item.quantity?.toString()) || 0;
        return isApplicable(item) ? sum + ((isNaN(p) ? 0 : p) * Math.max(0, isNaN(q) ? 0 : q)) : sum;
      }, 0);
      const val = parseFloat(promotionToApply.value?.toString());
      discountAmount = applicableSubtotal * ((isNaN(val) ? 0 : val) / 100);
    } else if (promotionToApply.type === 'fixed') {
      const val = parseFloat(promotionToApply.value?.toString());
      discountAmount = isNaN(val) ? 0 : val;
    } else if (promotionToApply.type === 'buy_x_get_y' && promotionToApply.buyQuantity && promotionToApply.getQuantity) {
      cart.forEach((item: CartItem) => {
        if (isApplicable(item)) {
          const q = parseFloat(item.quantity?.toString()) || 0;
          const p = parseFloat(item.price?.toString()) || 0;
          const safeQ = isNaN(q) ? 0 : Math.max(0, q);
          const safeP = isNaN(p) ? 0 : Math.max(0, p);
          const sets = Math.floor(safeQ / (promotionToApply.buyQuantity! + promotionToApply.getQuantity!));
          const remaining = safeQ % (promotionToApply.buyQuantity! + promotionToApply.getQuantity!);
          const discountedInRemaining = Math.max(0, remaining - promotionToApply.buyQuantity!);
          
          const totalDiscountedQty = (sets * promotionToApply.getQuantity!) + discountedInRemaining;
          const val = parseFloat(promotionToApply.value?.toString());
          discountAmount += totalDiscountedQty * safeP * ((isNaN(val) ? 0 : val) / 100);
        }
      });
    }
    total = Math.max(0, subtotal - (discountAmount || 0));
  }

  const pointsDiscount = useLoyaltyPoints && selectedCustomer ? Math.min(total, selectedCustomer.loyaltyPoints * (settings.loyaltyPointValue || 0.01)) : 0;
  
  let voucherDiscount = 0;
  if (appliedVoucher) {
    if (appliedVoucher.type === 'percent') {
      voucherDiscount = (total - pointsDiscount) * (appliedVoucher.value / 100);
    } else {
      voucherDiscount = Math.min(total - pointsDiscount, appliedVoucher.currentBalance || appliedVoucher.value);
    }
  }

  total = Math.max(0, total - pointsDiscount - voucherDiscount);


  return (
    <div className="relative h-full flex flex-col w-full bg-nardo">
      <QuickAddProductModal 
        isOpen={isQuickAddModalOpen}
        onClose={() => setIsQuickAddModalOpen(false)}
        barcode={newProductBarcode}
        user={user}
        onSuccess={(product) => addToCart(product, isReturnMode ? -1 : 1)}
      />
      <DeliveryRequestModal 
        isOpen={isDeliveryModalOpen}
        onClose={() => setIsDeliveryModalOpen(false)}
        cartTotal={total}
      />
      {/* Session Tabs */}
      {activeShift && (
        <div className="flex items-center gap-1 p-2 bg-slate-900/40 border-b border-slate-800/40 overflow-x-auto no-scrollbar flex-shrink-0">
          {posSessions.map((session: any) => (
            <div
              key={session.id}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveSessionId(session.id); }}
              onClick={() => setActiveSessionId(session.id)}
              className={cn(
                "cursor-pointer group flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap relative min-w-[120px] border border-transparent",
                activeSessionId === session.id 
                  ? "bg-indigo-600 text-white shadow-neon-indigo border-indigo-400/50" 
                  : "text-slate-500 hover:bg-slate-800/40 hover:text-slate-300"
              )}
            >
              <ShoppingCart size={14} className={session.cart.length > 0 ? (activeSessionId === session.id ? "text-white" : "text-indigo-400") : "text-slate-600"} />
              <span className="flex-1 text-left">{session.name}</span>
              {session.cart.length > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-black",
                  activeSessionId === session.id ? "bg-white/20 text-white" : "bg-indigo-500/10 text-indigo-400"
                )}>
                  {session.cart.reduce((s: number, i: any) => s + i.quantity, 0)}
                </span>
              )}
              {posSessions.length > 1 && (
                <button 
                  onClick={(e) => removeSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 hover:bg-rose-500/20 hover:text-rose-400 rounded-md transition-all"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <button 
            onClick={addNewSession}
            className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all flex items-center gap-1 px-3 border border-indigo-500/20 bg-indigo-500/5 shadow-sm"
            title="Nouveau Ticket"
          >
            <Plus size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Nouveau</span>
          </button>

          {/* Mode Retour Toggle on the right side of the Session Tabs container */}
          <button
              onClick={() => setIsReturnMode(!isReturnMode)}
              className={cn(
                "ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap",
                isReturnMode 
                  ? "bg-rose-600 text-white shadow-neon-rose border-rose-500/50 animate-pulse" 
                  : "bg-slate-900/80 border border-slate-800/40 text-slate-400 hover:bg-slate-800"
              )}
          >
              <RotateCcw size={12} className={cn(isReturnMode && "animate-spin-slow")} /> 
              <span>{isReturnMode ? 'Retour Activé' : 'Mode Retour'}</span>
          </button>
        </div>
      )}

      {!activeShift && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6 text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="max-w-md w-full"
          >
            <Card className="p-8 space-y-8 bg-slate-900/50 border-white/5 backdrop-blur-xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
              <div className="space-y-4">
                <div className="w-20 h-20 bg-indigo-500/20 text-indigo-400 rounded-3xl flex items-center justify-center mx-auto rotate-12 group-hover:rotate-0 transition-transform">
                  <Wallet size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Session Close</h3>
                  <p className="text-slate-400 text-sm font-medium">
                    Initialisez votre fond de caisse pour commencer à vendre.
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-left">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fond de caisse initial ({settings.currency})</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <Banknote size={20} />
                    </div>
                    <input 
                      type="number"
                      autoFocus
                      placeholder="0.00"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-12 pr-6 text-2xl font-black text-white placeholder:text-white/10 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      value={initialCashInput}
                      onChange={(e) => setInitialCashInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && initialCashInput && handleDirectOpenShift()}
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleDirectOpenShift}
                  disabled={!initialCashInput || isOpeningSession}
                  className="w-full py-6 text-sm font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  {isOpeningSession ? (
                    <RefreshCw className="animate-spin" size={20} />
                  ) : (
                    <>
                      Commencer le travail
                      <ArrowRight size={20} />
                    </>
                  )}
                </Button>

                {role === 'admin' && (
                  <button 
                    onClick={() => setActiveTab('shifts')}
                    className="w-full py-2 text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors"
                  >
                    Voir l'historique des sessions
                  </button>
                )}
              </div>
            </Card>
          </motion.div>
        </div>
      )}

      <div className={cn(
        "flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden",
        isMobile && "overflow-y-auto"
      )}>
        {/* Main Cart / Ticket View - Taking primary space */}
        <div className={cn(
          "flex-1 flex flex-col bg-workspace/20 border-r border-slate-800/40 shadow-sm relative z-0",
          isMobile ? "min-h-[50vh]" : "h-full"
        )}>
          {/* Header Search & Actions */}
          <div className="p-4 border-b border-slate-800/40 bg-workspace/40 sticky top-0 z-50 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-indigo-400 transition-colors" size={20} />
                <input 
                  ref={searchRef}
                  type="text"
                  placeholder="Rechercher un produit... (F3)"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-slate-800/50 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all text-white font-black text-xs uppercase tracking-widest placeholder:text-white/20"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    const val = e.currentTarget.value;
                    if (e.key === 'Enter' && val.trim() !== '') {
                      handleBarcodeScan(val);
                      setSearch('');
                    }
                  }}
                />
                
                {/* Floating Search Results */}


 





                <AnimatePresence>
                  {search.length >= 2 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] overflow-hidden max-h-[70vh] flex flex-col"
                    >
                      <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <span className="text-xs font-black text-white/40 uppercase tracking-widest">Résultats de recherche ({filteredProducts.length})</span>
                        <button onClick={() => { setSearch(''); searchRef.current?.focus(); }} className="p-2 text-white/40 hover:text-white transition-colors"><X size={20} /></button>
                      </div>
                      <div className="overflow-y-auto bg-slate-900">
                        {filteredProducts.length > 0 ? (
                          filteredProducts.map((p, idx) => (
                            <button
                              key={p.id || `search-res-${idx}`}
                              className="w-full text-left p-5 hover:bg-white/5 flex items-center gap-5 transition-colors border-b border-white/5 last:border-0 group outline-none focus:bg-white/5"
                              onClick={() => {
                                addToCart(p, isReturnMode ? -1 : 1);
                                setSearch('');
                              }}
                            >
                              <div className="w-14 h-14 bg-white/5 rounded-xl flex-shrink-0 overflow-hidden border border-white/5 group-hover:border-indigo-500/30 transition-colors shadow-sm">
                                {p.imageUrl ? (
                                  <SafeImage 
                                    src={p.imageUrl} 
                                    alt={p.name} 
                                    className="w-full h-full object-cover" 
                                    fallback={<Package size={18} className="text-slate-500/20" />}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <Package size={24} />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0 py-1">
                                <p className="text-base font-black text-white truncate group-hover:text-indigo-400 transition-colors">{p.name}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-xs font-mono font-medium text-white/40 bg-white/5 px-2 py-0.5 rounded">SKU: {p.sku}</span>
                                  <span className={cn(
                                    "text-xs px-2 py-0.5 rounded-full font-black uppercase tracking-tighter",
                                    p.stock <= (p.minStock || 5) ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                                  )}>
                                    Stock: {p.stock}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right flex flex-col justify-center gap-0.5">
                                <p className="text-xl font-black text-indigo-600 tracking-tighter leading-none">{p.price.toFixed(2)}</p>
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{settings.currency}</p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-12 text-center space-y-3">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                              <Search size={32} />
                            </div>
                            <p className="text-slate-500 font-medium">Aucun produit trouvé pour "{search}"</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setIsProductGridOpen(!isProductGridOpen)}
                  className={cn(
                    "p-3 rounded-xl border transition-all flex items-center gap-2 font-bold text-sm shadow-sm",
                    isProductGridOpen 
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-neon-indigo" 
                      : "bg-slate-900/60 border-slate-800/50 text-white/40 hover:text-white hover:bg-slate-800"
                  )}
                >
                  <LayoutGrid size={20} />
                </button>
                <button 
                  onClick={() => setIsScannerOpen(true)}
                  className="p-3 bg-slate-900/60 border border-slate-800/50 rounded-xl hover:bg-slate-800 text-white/40 hover:text-indigo-400 transition-all shadow-sm"
                  title="Scanner"
                >
                  <Scan size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Cart Items List */}
          {cart.length > 0 && (
            <div className="px-5 py-3 bg-slate-900/60 border-b border-slate-800/40 flex justify-between items-center text-[11px] font-black uppercase tracking-widest text-slate-400">
              <span className="flex items-center gap-2"><LayoutList size={14} className="opacity-50"/> Produits uniques : <span className="text-white">{cart.length}</span></span>
              <span className="flex items-center gap-2"><Package size={14} className="opacity-50"/> Total articles : <span className="text-white">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span></span>
            </div>
          )}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-workspace/10">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-white/40 p-12 text-center max-w-sm mx-auto">
                <div className="w-24 h-24 bg-slate-900/40 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl border border-slate-800/60 group">
                  <ShoppingBag size={48} strokeWidth={1} className="text-white/10 group-hover:text-indigo-500/40 transition-colors duration-500" />
                </div>
                <h4 className="text-lg font-black text-white/40 uppercase tracking-[0.2em] mb-2">Panier Vide</h4>
                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest leading-relaxed">Prêt pour une nouvelle vente futuriste.</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                  {cart.map((item: CartItem, idx: number) => {
                    const isLast = idx === cart.length - 1;
                    const isSelected = selectedItemId === item.id;
                    
                    return (
                      <div 
                        key={`${item.cartItemId || item.id}-${item.quantity}`} 
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-2xl bg-slate-900/40 border group relative overflow-hidden",
                          isLast || isSelected ? "border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/50" : "border-slate-800/40 hover:border-slate-700/60"
                        )}
                        onClick={() => setSelectedItemId(item.id)}
                      >
                    <div className="w-12 h-12 bg-slate-800 rounded-xl flex-shrink-0 overflow-hidden border border-slate-700/50 shadow-inner group-hover:scale-105 transition-transform duration-300">
                      {item.imageUrl || products.find((p: Product) => p.id === item.id)?.imageUrl ? (
                        <SafeImage 
                          src={item.imageUrl || products.find((p: Product) => p.id === item.id)?.imageUrl} 
                          alt={item.name} 
                          className="w-full h-full object-cover" 
                          fallback={<Package size={14} className="text-slate-500/20" />}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Package size={24} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h5 className="text-base font-black text-white truncate tracking-tight">{item.name}</h5>
                          <p className="text-[9px] font-black font-mono text-white/30 uppercase tracking-widest mt-0.5 opacity-60">SKU: {item.sku}</p>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeFromCart(item.cartItemId || ''); }}
                          className="p-2 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-slate-900/60 rounded-2xl p-1 border border-slate-800/80 ring-1 ring-white/5" onClick={(e) => e.stopPropagation()}>
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setQuantity(item.cartItemId, item.quantity - 1); }}
                              className="w-9 h-9 flex items-center justify-center hover:bg-slate-800 hover:text-white rounded-xl transition-all text-white/30"
                            >
                              <Minus size={16} />
                            </button>
                            <QuantityInput 
                              item={item} 
                              setQuantity={setQuantity} 
                              ref={(el) => { if (el) quantityInputRefs.current[item.cartItemId || ''] = el; }} 
                            />
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setQuantity(item.cartItemId, item.quantity + 1); }}
                              className="w-9 h-9 flex items-center justify-center hover:bg-slate-800 hover:text-white rounded-xl transition-all text-white/30"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest bg-slate-950/45 px-2 py-1 rounded-lg border border-slate-800/40">
                            {((item as any).unit || 'PCS').toUpperCase()}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          {permissions.canAccessInventory && (
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                const { quantity, overriddenPrice, lineDiscount, productName, cartItemId, ...product } = item;
                                setEditingProduct(product as Product); 
                                setIsProductModalOpen(true); 
                              }}
                              className="p-2 rounded-xl text-slate-600 hover:bg-amber-500/10 hover:text-amber-400 transition-all border border-transparent hover:border-amber-500/20"
                              title="Modifier le produit"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setDiscountingItemId(item.cartItemId); }}
                            className={cn(
                              "p-2 rounded-xl transition-all border",
                              item.lineDiscount ? "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-neon-cyan" : "text-slate-600 hover:bg-indigo-500/10 hover:text-indigo-400 border-transparent hover:border-indigo-500/20"
                            )}
                            title="Remise par ligne"
                          >
                            <Tag size={16} fill={item.lineDiscount ? "currentColor" : "none"} />
                          </button>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <input
                                  type="number"
                                  value={item.overriddenPrice !== undefined ? item.overriddenPrice : (isWholesale && item.wholesalePrice ? item.wholesalePrice : item.price)}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => setPrice(item.cartItemId, parseFloat(e.target.value) || 0)}
                                  className={cn(
                                    "w-20 p-1 text-right text-sm font-black bg-transparent border-b border-dashed outline-none transition-all",
                                    item.lineDiscount ? "text-amber-400 border-amber-500/40" : "text-white border-slate-700/50 focus:border-indigo-500"
                                  )}
                                />
                                <span className={cn("text-[9px] font-black uppercase tracking-tighter", item.lineDiscount ? "text-amber-500/60" : "text-slate-500")}>{settings.currency}</span>
                              </div>
                              {item.lineDiscount && (
                                <p className="text-[10px] font-black text-amber-500 uppercase tracking-tighter mt-0.5">
                                  -{item.lineDiscount.value}{item.lineDiscount.type === 'percentage' ? '%' : settings.currency} OFF
                                </p>
                              )}
                              <p className="text-[9px] font-black text-white/20 line-through opacity-40">
                                {((item.overriddenPrice || item.price || 0) * (item.quantity || 0)).toFixed(2)}
                              </p>
    </div>
                            <div className="pl-3 border-l border-white/10 text-right min-w-[90px]">
                              <p className="text-lg font-black text-white whitespace-nowrap tracking-tighter">
                                {((calculateItemPrice(item, isWholesale) || 0) * (item.quantity || 0)).toFixed(2)}
                              </p>
                              <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-[-2px]">{settings.currency}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                      </div>
                    );
                  })}
                <div ref={cartEndRef} />
              </div>
            )}
          </div>

          {/* Scanners & Product Grid (Conditional Overlays) */}
          {isScannerOpen && (
            <BarcodeScanner 
              onScan={handleBarcodeScan} 
              onClose={() => {
                setIsScannerOpen(false);
                setIsPriceCheckerOpen(false);
              }} 
            />
          )}

          {priceCheckResult && (
            <Modal 
              isOpen={!!priceCheckResult} 
              onClose={() => setPriceCheckResult(null)} 
              title="Vérificateur de Prix"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-900/60 rounded-[2rem] border border-slate-800/40 shadow-inner">
                  <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700/50 overflow-hidden shadow-2xl">
                    {priceCheckResult.imageUrl ? (
                      <img src={priceCheckResult.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Package className="text-slate-600" size={32} />
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-white text-lg tracking-tight uppercase tracking-widest">{priceCheckResult.name}</h4>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">SKU: {priceCheckResult.sku}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-emerald-500/10 rounded-[2rem] border border-emerald-500/20 text-center shadow-neon-cyan">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Prix Final</p>
                    <p className="text-3xl font-black text-emerald-400 tracking-tighter">{priceCheckResult.price.toFixed(2)} <span className="text-xs uppercase tracking-widest opacity-60">{settings.currency}</span></p>
                  </div>
                  <div className="p-6 bg-indigo-500/10 rounded-[2rem] border border-indigo-500/20 text-center shadow-neon-indigo">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Stock Dispo</p>
                    <p className="text-3xl font-black text-indigo-400 tracking-tighter">{formatProductStock(priceCheckResult, products)}</p>
                  </div>
                </div>
                <div className="flex gap-4 pt-2">
                  <Button onClick={() => { addToCart(priceCheckResult); setPriceCheckResult(null); }} className="flex-1 py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] bg-emerald-600 shadow-neon-cyan text-xs">AJOUTER AU PANIER</Button>
                  <Button onClick={() => setPriceCheckResult(null)} variant="secondary" className="flex-1 py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs">ANNULER</Button>
                </div>
              </div>
            </Modal>
          )}

          {isProductGridOpen && (
            <div className="absolute inset-0 z-40 bg-workspace/95 backdrop-blur-xl overflow-y-auto custom-scrollbar p-6 animate-in fade-in zoom-in duration-300">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Catalogue</h3>
                <button 
                  onClick={() => setIsProductGridOpen(false)}
                  className="w-14 h-14 flex items-center justify-center bg-slate-800/80 hover:bg-indigo-600 hover:text-white rounded-full text-slate-400 transition-all shadow-2xl border border-white/5 active:scale-90"
                >
                  <X size={28} />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-4 pb-20">
                {products.filter(p => p.showInPos !== false && p.status === 'active').map((p, idx) => (
                  <button 
                    key={p.id || `grid-item-${idx}`}
                    onClick={() => { addToCart(p); if (settings.closeGridOnSelect) setIsProductGridOpen(false); }}
                    className="flex flex-col bg-slate-900/40 border border-slate-800/60 rounded-[2rem] p-4 hover:border-indigo-500/50 hover:bg-indigo-500/5 hover:shadow-neon-indigo transition-all text-left group box-border active:scale-95 relative overflow-hidden"
                  >
                    <div className="aspect-square bg-slate-800/60 rounded-2xl mb-4 overflow-hidden border border-slate-800/40 flex items-center justify-center shadow-inner">
                      {p.imageUrl ? (
                        <SafeImage 
                          src={p.imageUrl} 
                          alt={p.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                          fallback={<Package size={24} className="text-white/10" />}
                        />
                      ) : (
                        <Package size={32} className="text-slate-700 group-hover:text-indigo-500/40 transition-colors" />
                      )}
                    </div>
                    <p className="text-[10px] font-black text-white uppercase tracking-tight truncate mb-1 group-hover:text-indigo-400 transition-colors">{p.name}</p>
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-800/60">
                      <p className="text-sm font-black text-indigo-400 tracking-tighter">{p.price.toFixed(2)}</p>
                      <span className={cn(
                        "text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter",
                        p.stock <= 5 ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                      )}>S: {formatProductStock(p, products)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {discountingItemId && (
            <Modal
              isOpen={!!discountingItemId}
              onClose={() => setDiscountingItemId(null)}
              title="Remise sur l'article"
            >
              <div className="space-y-6">
                {(() => {
                  const item = cart.find(i => i.cartItemId === discountingItemId);
                  if (!item) return null;
                  return (
                    <>
                      <div className="flex items-center gap-3 p-4 bg-slate-900/60 rounded-[2rem] border border-slate-800/40 shadow-inner">
                        <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700/50 overflow-hidden shadow-2xl">
                          <SafeImage 
                            src={item.imageUrl} 
                            className="w-full h-full object-cover" 
                            fallback={<Package size={20} className="text-slate-600" />}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white uppercase tracking-tight">{item.name}</p>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Prix unitaire: {item.price.toFixed(2)} {settings.currency}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setLineDiscountType('percentage')}
                          className={cn(
                            "py-4 px-4 rounded-[1.5rem] border transition-all font-black text-[10px] uppercase tracking-[0.2em]",
                            lineDiscountType === 'percentage' ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-400 shadow-neon-indigo" : "border-slate-800/40 bg-slate-900/40 text-slate-500"
                          )}
                        >
                          Pourcentage (%)
                        </button>
                        <button
                          onClick={() => setLineDiscountType('fixed')}
                          className={cn(
                            "py-4 px-4 rounded-[1.5rem] border transition-all font-black text-[10px] uppercase tracking-[0.2em]",
                            lineDiscountType === 'fixed' ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-400 shadow-neon-indigo" : "border-slate-800/40 bg-slate-900/40 text-slate-500"
                          )}
                        >
                          Montant fixe ({settings.currency})
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Valeur de la remise</label>
                        <div className="relative group">
                          <input
                            type="number"
                            autoFocus
                            value={lineDiscountValue}
                            onChange={(e) => setLineDiscountValue(e.target.value)}
                            className="w-full bg-slate-900/60 border border-slate-800/50 rounded-[2rem] py-5 px-8 text-2xl font-black text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all outline-none text-center shadow-inner"
                          />
                          <div className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-500 font-black text-lg">
                            {lineDiscountType === 'percentage' ? '%' : settings.currency}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4 pt-4">
                        <Button
                          variant="outline"
                          className="flex-1 py-5 rounded-[1.5rem] font-black uppercase tracking-widest border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-[10px]"
                          onClick={() => {
                            setLineDiscount(item.cartItemId, null);
                            setDiscountingItemId(null);
                          }}
                        >
                          Supprimer
                        </Button>
                        <Button
                          className="flex-1 py-5 rounded-[1.5rem] font-black uppercase tracking-widest bg-indigo-600 shadow-neon-indigo text-[10px]"
                          onClick={() => {
                            const val = parseFloat(lineDiscountValue);
                            if (!isNaN(val) && val > 0) {
                              setLineDiscount(item.cartItemId, { type: lineDiscountType, value: val });
                            } else {
                              setLineDiscount(item.cartItemId, null);
                            }
                            setDiscountingItemId(null);
                          }}
                        >
                          Appliquer
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </Modal>
          )}
          <div className="flex items-center justify-between p-4 bg-slate-900/80 border-t border-slate-800/60 lg:hidden backdrop-blur-xl">
                      <div className="flex flex-col">
              <p className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest">Total</p>
              <p className="text-2xl font-black text-emerald-400 tracking-tighter drop-shadow-md">{total.toFixed(2)} <span className="text-[10px] uppercase font-serif tracking-widest opacity-60 ml-0.5">{settings.currency}</span></p>
            </div>
            <Button 
              disabled={cart.length === 0}
              onClick={() => {
                const checkoutPanel = document.getElementById('checkout-panel');
                checkoutPanel?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 shadow-neon-indigo active:scale-95 transition-transform"
            >
              Payer <ArrowRight size={18} />
            </Button>
          </div>
        </div>

        {/* Checkout Controls Panel */}
        <div id="checkout-panel" className="w-full lg:w-96 flex flex-col bg-slate-900/20 border-l border-slate-800/60 shadow-2xl z-10 transition-all relative">
          <div className="p-6 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
            {/* Customer Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Client</h4>
                <button 
                  onClick={() => setIsWholesale(!isWholesale)}
                  className={cn(
                    "px-3 py-1.5 rounded-[1rem] text-[9px] font-black uppercase tracking-widest transition-all border",
                    isWholesale ? "bg-indigo-600 text-white border-indigo-400/50 shadow-neon-indigo" : "bg-slate-800/40 text-white/40 border-slate-700/50 hover:border-slate-600"
                  )}
                >
                  {isWholesale ? "Mode Gros" : "Standard"}
                </button>
              </div>

              {selectedCustomer ? (
                <div className="space-y-4">
                  <div className="p-5 bg-slate-900/60 border border-slate-800/60 rounded-[2rem] shadow-inner space-y-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-1">
                       <div className="w-20 h-20 bg-indigo-500/5 rounded-full absolute -top-10 -right-10 blur-2xl" />
                    </div>
                    <div className="flex items-center gap-4 relative">
                      <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center font-black border border-indigo-500/20 shadow-neon-indigo">
                        {selectedCustomer.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white truncate uppercase tracking-tight">{selectedCustomer.name}</p>
                        <p className="text-[10px] font-black text-white/40 tracking-wider font-mono opacity-80">{selectedCustomer.phone}</p>
                      </div>
                      <button onClick={() => { setSelectedCustomer(null); setUseLoyaltyPoints(false); }} className="text-slate-600 hover:text-rose-400 p-2 transition-colors">
                        <X size={20} />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-2xl border border-slate-700/30">
                      <div>
                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Fidélité</p>
                        <p className="text-sm font-black text-amber-400">{selectedCustomer.loyaltyPoints} Points</p>
                      </div>
                      {selectedCustomer.loyaltyPoints >= 10 && (
                        <button 
                          onClick={() => setUseLoyaltyPoints(!useLoyaltyPoints)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                            useLoyaltyPoints ? "bg-amber-500 text-white border-amber-400/50 shadow-neon-cyan" : "bg-slate-900/60 border-amber-500/20 text-amber-500 hover:bg-amber-500/10"
                          )}
                        >
                          <Gift size={14} />
                          {useLoyaltyPoints ? "Utilisé" : "Utiliser"}
                        </button>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-2xl border border-slate-700/30">
                      <div>
                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                          {(selectedCustomer.balance || 0) < 0 ? "Ardoise / Dette" : "Solde Prépayé"}
                        </p>
                        <p className={cn(
                          "text-sm font-black", 
                          (selectedCustomer.balance || 0) > 0 
                            ? "text-emerald-400" 
                            : (selectedCustomer.balance || 0) < 0 
                              ? "text-rose-400 font-bold" 
                              : "text-white/30"
                        )}>
                          {(selectedCustomer.balance || 0) < 0
                            ? `Dette: ${Math.abs(selectedCustomer.balance).toFixed(2)}`
                            : (selectedCustomer.balance || 0).toFixed(2)
                          } <span className="text-[10px] font-black opacity-60 ml-0.5">{settings.currency}</span>
                        </p>
                      </div>
                      {(selectedCustomer.balance || 0) >= total && total > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-neon-cyan">
                          <Wallet size={14} />
                          Prêt
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Calculateur de Règlement & Co-crédit */}
                  {total > 0 && (
                    <div className="p-5 bg-slate-900/40 border border-slate-800/60 rounded-[2rem] space-y-4 relative overflow-hidden text-left shadow-inner">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign size={16} className="text-amber-400" />
                          <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Enregistrement Règlement</h4>
                        </div>
                        {receivedAmount !== '' && (
                          <button
                            onClick={() => { setReceivedAmount(''); setKeepExcessInBalance(false); }}
                            className="text-[9px] font-black text-rose-400/80 hover:text-rose-400 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/10"
                          >
                            Réinitialiser
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.15em]">Montant Reçu</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              value={receivedAmount}
                              onChange={(e) => setReceivedAmount(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCheckout('cash');
                                }
                              }}
                              placeholder={(total || 0).toFixed(2)}
                              className="w-full bg-slate-950/80 border border-slate-800 text-white text-sm font-black font-mono rounded-xl pl-3 pr-8 py-2.5 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10 transition-all text-left placeholder:text-white/20"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30 font-black font-mono leading-none">{settings.currency}</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.15em]">Rendu / Solde</label>
                          <div className="w-full bg-slate-950/30 border border-slate-800/40 text-white rounded-xl px-3 py-2.5 font-mono flex items-center justify-between min-h-[44px]">
                            {(() => {
                              const typed = parseFloat(receivedAmount);
                              if (isNaN(typed)) return <span className="text-white/20 text-[10px] font-black uppercase tracking-wider leading-none">Automatique</span>;
                              if (typed > total) {
                                return (
                                  <div className="flex flex-col text-right w-full">
                                    <span className="text-emerald-400 text-xs font-black leading-none">
                                      +{(typed - total).toFixed(2)} {settings.currency}
                                    </span>
                                    <span className="text-[7.5px] font-bold text-emerald-400/60 uppercase tracking-tighter mt-1">À RENDRE</span>
                                  </div>
                                );
                              } else if (typed < total) {
                                return (
                                  <div className="flex flex-col text-right w-full">
                                    <span className="text-rose-400 text-xs font-black leading-none">
                                      -{(total - typed).toFixed(2)} {settings.currency}
                                    </span>
                                    <span className="text-[7.5px] font-bold text-rose-400/60 uppercase tracking-tighter mt-1">NOUVELLE DETTE</span>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="flex flex-col text-right w-full">
                                    <span className="text-white/50 text-xs font-black leading-none">0.00 {settings.currency}</span>
                                    <span className="text-[7.5px] font-bold text-white/30 uppercase tracking-tighter mt-1">COMPLET</span>
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Raccourcis de paiement rapides */}
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setReceivedAmount(total.toFixed(2))}
                          className="px-2 py-1 bg-slate-800/60 hover:bg-slate-700/80 active:scale-95 text-slate-300 font-mono text-[9px] font-bold rounded-lg border border-slate-700/30 transition-all"
                        >
                          Total exact
                        </button>
                        {[10, 20, 50, 100].map(val => {
                          const currentVal = parseFloat(receivedAmount) || 0;
                          return (
                            <button
                              key={val}
                              onClick={() => setReceivedAmount((currentVal + val).toString())}
                              className="px-2 py-1 bg-slate-800/40 hover:bg-slate-700/50 active:scale-95 text-[9px] text-slate-400 font-mono font-medium rounded-lg border border-slate-800 transition-all"
                            >
                              +{val}
                            </button>
                          );
                        })}
                      </div>

                      {/* Explications & Options du Crédit */}
                      {(() => {
                        const typed = parseFloat(receivedAmount);
                        if (!isNaN(typed)) {
                          if (typed < total) {
                            const diff = total - typed;
                            return (
                              <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-start gap-2.5">
                                <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  <p className="text-[8.5px] font-black uppercase text-rose-400 tracking-wider">Achat à Crédit (Dette)</p>
                                  <p className="text-[10px] text-rose-300/80 leading-normal font-medium">
                                    Le montant restant de <span className="font-bold text-white">{diff.toFixed(2)} {settings.currency}</span> sera déduit du solde du client, qui passera à <span className="font-bold text-white">{((selectedCustomer.balance || 0) - diff).toFixed(2)} {settings.currency}</span>.
                                  </p>
                                </div>
                              </div>
                            );
                          } else if (typed > total) {
                            const diff = typed - total;
                            return (
                              <div className="space-y-3">
                                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-start gap-2.5">
                                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                                  <div className="space-y-0.5">
                                    <p className="text-[8.5px] font-black uppercase text-emerald-400 tracking-wider">Surplus constaté</p>
                                    <p className="text-[10px] text-emerald-300/80 leading-normal font-medium">
                                      Le client a donné un surplus de <span className="font-bold text-white">{diff.toFixed(2)} {settings.currency}</span>.
                                    </p>
                                  </div>
                                </div>
                                
                                <label className="flex items-center gap-2.5 cursor-pointer p-3 bg-slate-950/60 hover:bg-slate-950 rounded-2xl border border-slate-800 hover:border-amber-500/20 transition-all select-none group">
                                  <input 
                                    type="checkbox"
                                    checked={keepExcessInBalance}
                                    onChange={(e) => setKeepExcessInBalance(e.target.checked)}
                                    className="accent-amber-500 rounded cursor-pointer w-3.5 h-3.5"
                                  />
                                  <div className="text-left">
                                    <p className="text-[9px] font-black uppercase text-slate-200 tracking-wider group-hover:text-white transition-colors">Garder le surplus en crédit</p>
                                    <p className="text-[8.5px] text-slate-500 font-bold leading-none mt-0.5">Le solde du client passera à {((selectedCustomer.balance || 0) + diff).toFixed(2)} {settings.currency}</p>
                                  </div>
                                </label>
                              </div>
                            );
                          }
                        }
                        return null;
                      })()}
                    </div>
                  )}

                  <CustomerProfile customer={selectedCustomer} onAddNote={addCustomerNote} />
                </div>
               ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1 group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                      <input 
                        type="text"
                        placeholder="Chercher un client..."
                        className="w-full pl-10 pr-4 py-3.5 bg-slate-900/60 border border-slate-800/50 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 text-[10px] font-black uppercase tracking-widest text-white placeholder:text-slate-600 shadow-inner"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                      />
                      {customerSearch && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl z-50 max-h-64 overflow-y-auto backdrop-blur-xl ring-1 ring-white/5 no-scrollbar">
                          {customers.length === 0 ? (
                            <div className="p-8 text-center text-[10px] font-black text-white/20 uppercase tracking-widest">Aucun client en base</div>
                          ) : (
                            customers
                              .filter((c: Customer) => customerSearch ? (c.name.toLowerCase().includes(customerSearch.trim().toLowerCase()) || (c.phone || '').includes(customerSearch.trim())) : true)
                              .slice(0, customerSearch ? 50 : 5)
                              .map((c: Customer) => (
                                <button 
                                  key={c.id}
                                  className="w-full p-4 text-left hover:bg-indigo-500/10 flex items-center justify-between border-b border-slate-800 last:border-0 group transition-colors"
                                  onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                                >
                                  <div>
                                    <p className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{c.name}</p>
                                    <p className="text-[10px] font-black text-white/40 font-mono tracking-wider">{c.phone}</p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span className="text-[9px] font-black bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-amber-500/20">
                                      {c.loyaltyPoints || 0} pts
                                    </span>
                                    {(c.balance || 0) < 0 && (
                                      <span className="text-[8px] font-black tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-md font-mono uppercase whitespace-nowrap">
                                        Dette: {Math.abs(c.balance).toFixed(2)}
                                      </span>
                                    )}
                                    {(c.balance || 0) > 0 && (
                                      <span className="text-[8px] font-black tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-mono uppercase whitespace-nowrap">
                                        Solde: {c.balance.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              ))
                          )}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => setIsPOSCustomerModalOpen(true)}
                      onMouseEnter={() => setCustomerSearch(customerSearch || ' ')}
                      onMouseLeave={() => { if (customerSearch === ' ') setCustomerSearch(''); }}
                      className="p-3.5 bg-slate-800/40 border border-slate-700/50 rounded-2xl hover:bg-slate-800 hover:text-indigo-400 text-white transition-all flex-shrink-0 shadow-sm"
                      title="Nouveau Client"
                    >
                      <UserPlus size={20} />
                    </button>
                  </div>
              )}
            </div>

            {/* Delivery Methods */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Passage en caisse</h4>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'in_store', icon: Store, label: 'Magasin' },
                  { id: 'delivery', icon: Truck, label: 'Livraison' },
                  { id: 'pickup', icon: ShoppingBag, label: 'Retrait' }
                ].map((m) => (
                  <button 
                    key={m.id}
                    onClick={() => setDeliveryMethod(m.id as any)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-[1.5rem] border transition-all active:scale-95",
                      deliveryMethod === m.id 
                        ? "bg-indigo-600 text-white border-indigo-400/50 shadow-neon-indigo" 
                        : "bg-slate-800/40 text-slate-500 border-slate-700/50 hover:border-slate-600 hover:text-white"
                    )}
                  >
                    <div className={cn("p-2 rounded-xl transition-colors", deliveryMethod === m.id ? "bg-white/20" : "bg-slate-900/40")}>
                      <m.icon size={22} className={deliveryMethod === m.id ? "text-white" : "text-slate-400 group-hover:text-white"} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>


            {/* Vouchers & Gift Cards & Promos */}
            <div className="space-y-4">
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Carte cadeau / Code..."
                  className="flex-1 px-4 py-3 text-[10px] bg-slate-900/60 border border-slate-800/50 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 text-white font-black uppercase tracking-widest placeholder:text-slate-600 shadow-inner"
                  value={voucherCode}
                  onChange={e => setVoucherCode(e.target.value)}
                />
                <button 
                  onClick={applyVoucher}
                  className="px-6 bg-slate-800/80 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:shadow-neon-indigo transition-all border border-slate-700/50 shadow-sm"
                >
                  OK
                </button>
              </div>
              {appliedVoucher && (
                <div className="flex items-center justify-between p-3 bg-amber-500/10 text-amber-400 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-amber-500/20 shadow-lg shadow-amber-500/10">
                  <span>Carte cadeau/Bon utilisé: -{appliedVoucher.value}{appliedVoucher.type === 'percent' ? '%' : ` ${settings.currency}`}</span>
                  <button onClick={() => setAppliedVoucher(null)} className="hover:text-rose-400 transition-colors"><X size={14} /></button>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-900/60 border-t border-slate-800/60 space-y-3 backdrop-blur-xl">
            <div className="space-y-1.5">
              <div className="flex justify-between text-slate-500 text-[10px] font-black uppercase tracking-widest px-1">
                <span>Sous-total</span>
                <span>{(isNaN(subtotal) ? 0 : subtotal).toFixed(2)} {settings.currency}</span>
              </div>
              {(discountAmount || 0) > 0 && (
                <div className="flex justify-between text-rose-400 text-[10px] font-black uppercase tracking-widest px-1">
                  <span>Remises</span>
                  <span>-{(isNaN(discountAmount) ? 0 : discountAmount).toFixed(2)} {settings.currency}</span>
                </div>
              )}
              {(pointsDiscount || 0) > 0 && (
                <div className="flex justify-between text-amber-400 text-[10px] font-black uppercase tracking-widest px-1">
                  <span>Points Fidélité</span>
                  <span>-{(isNaN(pointsDiscount) ? 0 : pointsDiscount).toFixed(2)} {settings.currency}</span>
                </div>
              )}
              {(voucherDiscount || 0) > 0 && (
                <div className="flex justify-between text-emerald-400 text-[10px] font-black uppercase tracking-widest px-1">
                  <span>Carte Cadeau / Réduction</span>
                  <span>-{(isNaN(voucherDiscount) ? 0 : voucherDiscount).toFixed(2)} {settings.currency}</span>
                </div>
              )}
              <div className="flex justify-between text-emerald-400 font-black text-3xl pt-2 border-t border-slate-800/60 items-center tracking-tighter">
                <span className="text-sm opacity-80 text-emerald-500 uppercase tracking-wider font-extrabold flex flex-col">
                  TOTAL
                  <span className="text-[9px] text-emerald-600 tracking-widest font-bold mt-0.5">{cart.reduce((sum, item) => sum + item.quantity, 0)} {cart.reduce((sum, item) => sum + item.quantity, 0) > 1 ? 'articles' : 'article'}</span>
                </span>
                <div className="text-right">
                  {(selectedCustomer && total > 0) && (
                    <div className="text-[9px] font-black text-amber-500 mb-0.5 flex items-center justify-end gap-1 uppercase tracking-widest animate-pulse">
                      <Gift size={10} /> +{Math.floor(total * (settings.loyaltyPointsPerCurrencyUnit || 1))} pts
                    </div>
                  )}
                  <span className="flex items-baseline justify-end gap-1 text-emerald-400 drop-shadow-md">
                    {(isNaN(total) ? 0 : total).toFixed(2)}
                    <span className="text-xs text-emerald-500 uppercase tracking-widest font-black ml-0.5">{settings.currency}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button 
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest shadow-inner group active:scale-95" 
                onClick={() => handleCheckout('cash')}
                disabled={cart.length === 0 || isProcessing}
                title="Raccourci: F1"
              >
                <Banknote size={16} className="text-slate-400 group-hover:text-white transition-colors" />
                <span>Espèces</span>
              </button>
              <button 
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest shadow-sm group active:scale-95 hover:shadow-neon-indigo"
                onClick={() => handleCheckout('card')}
                disabled={cart.length === 0 || isProcessing}
              >
                <CreditCard size={16} className="text-indigo-400 group-hover:text-white transition-colors" />
                <span>Carte / Digital</span>
              </button>
            </div>
            
            {selectedCustomer && (selectedCustomer.balance || 0) >= total && total > 0 && (
              <button 
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-500/5 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white transition-all font-black text-[9px] uppercase tracking-widest shadow-sm group hover:shadow-neon-cyan active:scale-95"
                onClick={() => handleCheckout('balance')}
                disabled={cart.length === 0 || isProcessing}
              >
                <Wallet size={14} />
                <span>Payer avec le solde ({(selectedCustomer.balance || 0).toFixed(2)})</span>
              </button>
            )}
            
            <div className="flex flex-wrap gap-1.5 justify-center opacity-60">
              <button 
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-rose-650 border border-rose-500/20 rounded-lg hover:bg-rose-500/5 transition-colors bg-rose-500/5"
                onClick={() => setIsDeliveryModalOpen(true)}
              >
                <Truck size={10} /> Livraison
              </button>
              {[
                { key: 'F3', label: 'Search' },
                { key: 'F2', label: 'Qty' },
                { key: 'F1', label: 'Cash' },
                { key: 'F4', label: 'Print' },
                { key: 'Vider', label: 'Clear' }
              ].map(s => (
                <div key={s.key} className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800/40 border border-slate-700/55 rounded-lg text-[8px] font-black text-slate-500 uppercase tracking-tighter">
                  <span className="bg-slate-900 px-1 rounded text-indigo-400 border border-indigo-400/20">{s.key}</span>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
            
            <button 
              className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-[0.15em] hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-neon-cyan active:scale-95"
              onClick={() => handleCheckout('cash', true)}
              disabled={cart.length === 0 || isProcessing}
            >
              <Printer size={16} />
              CONFIRMER & IMPRIMER (F4)
            </button>
          </div>
        </div>
      </div>


      {/* Success Notification */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-emerald-500/30 text-white px-8 py-6 rounded-[2.5rem] shadow-neon-cyan flex flex-col gap-4 z-50 min-w-[360px] backdrop-blur-2xl ring-1 ring-white/5"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-inner">
                <CheckCircle2 size={32} />
              </div>
              <div className="flex-1">
                <p className="text-lg font-black uppercase tracking-widest">Nexus System</p>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-0.5">Vente enregistrée avec succès</p>
              </div>
              <button onClick={() => setShowSuccess(false)} className="p-2 text-slate-500 hover:text-white transition-colors bg-slate-800/40 rounded-xl">
                <X size={20} />
              </button>
            </div>
            
            <div className="bg-slate-950/60 rounded-3xl p-4 border border-slate-800/60 shadow-inner">
               <div className="flex justify-between items-baseline mb-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Transaction ID</span>
                  <span className="text-[10px] font-mono font-black text-slate-400">#{(lastTransaction?.id || 'NX-0000').slice(-6)}</span>
               </div>
               <div className="flex justify-between items-end">
                  <span className="text-3xl font-black text-white tracking-tighter">{(lastTransaction?.total || 0).toFixed(2)}</span>
                  <span className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">{settings.currency}</span>
               </div>
               {lastTransaction?.pointsEarned ? (
                 <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Points Fidélité</span>
                    <span className="text-[10px] font-black text-amber-500 flex items-center gap-1"><Gift size={12} />+{lastTransaction.pointsEarned} PTS</span>
                 </div>
               ) : null}
            </div>
            
            {lastTransaction && (
              <div className="flex gap-3">
                <button 
                  onClick={() => printReceipt(lastTransaction, settings)}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 py-4 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-neon-indigo active:scale-95"
                >
                  <Printer size={18} /> Imprimer Reçu
                </button>
                {lastTransaction.customerId && (
                  <button 
                    onClick={() => {
                      const customer = customers.find((c: Customer) => c.id === lastTransaction.customerId);
                      if (customer) {
                        const text = `Bonjour ${customer.name}, merci pour votre achat de ${lastTransaction.total.toFixed(2)} ${settings.currency} chez nexus. POS. Votre nouveau solde est de ${customer.loyaltyPoints} pts.`;
                        window.open(`https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 py-4 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all border border-slate-700 shadow-sm active:scale-95"
                  >
                    <MessageSquare size={18} /> WhatsApp
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
