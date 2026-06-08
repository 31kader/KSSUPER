import { DEFAULT_PERMISSIONS } from '../constants';
import React, { useState, useMemo, memo, useEffect, useRef, useDeferredValue } from 'react';
import { Package, Tag, RefreshCw, LayoutGrid, Plus, FileSpreadsheet, Upload, ShoppingBag, AlertTriangle, Zap, Info, Search, Filter, Scan, LayoutList, Layers, Truck, ArrowUpDown, Award, Calendar, FolderTree, AlertCircle, TrendingDown, ShieldCheck, RotateCcw, Check, Printer, Copy, PackageOpen, Trash2, ChevronUp, BarcodeIcon, ShoppingCart, Eye, X, MessageCircle, Phone, MapPin, Navigation, Edit, Clock, Mail, Percent, DollarSign, Star, Palette, FileText, AlignLeft, Shield, UserCog, Link2, MapIcon, Brain, Database, ArrowRight, CreditCard, Banknote, Minus, UserPlus, ChevronDown, Users, ArrowUpRight, ArrowDownRight, LogOut, Bell, TrendingUp, History, EyeOff, LogIn, Store, Gift, Wallet, Edit2, MessageSquare, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabase';
import { Button, Card, Modal, ConfirmDialog, BlurCard, SortableHeader, SafeImage } from './ui';
import { Product, Category, Brand, StockAdjustment, CompanySettings, SupplierSync, Supplier, Purchase, Transaction, OnlineOrder, Employee, Customer, CartItem, ProductReturn, RolePermissions, Promotion, Voucher, PurchaseOrder, POSSession } from '../types';
import { cn, logAction, safeDate, exportToExcel, getHierarchicalCategories, formatSafe, exportToCSV, generateUniqueId, isLocked, formatProductStock, calculateItemPrice } from '../lib/utils';
import { printReceipt, printPurchaseOrder } from '../services/printService';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isToday, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';

import { BarcodeScanner } from './BarcodeScanner';
import { Categories } from './Categories';
import { Brands } from './Brands';
import { ProductFormModal } from './ProductFormModal';

export const SupplierDashboard = ({ 
  supplier, 
  onLogout,
  products,
  categories,
  brands,
  settings,
  handleCreatePurchaseOrder,
  purchaseOrders,
  user,
  setIsProductModalOpen,
  setEditingProduct,
  editingProduct,
  isProductModalOpen,
  setActiveTab: setGlobalActiveTab
}: { 
  supplier: Supplier; 
  onLogout: () => void;
  products: Product[];
  categories: Category[];
  brands: Brand[];
  settings: CompanySettings;
  handleCreatePurchaseOrder: (order: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  purchaseOrders: PurchaseOrder[];
  user: any;
  setIsProductModalOpen: (v: boolean) => void;
  setEditingProduct: (p: Product | null) => void;
  editingProduct: Product | null;
  isProductModalOpen: boolean;
  setActiveTab: (t: string) => void;
}) => {
  const [orderNumber, setOrderNumber] = useState('');
  const [items, setItems] = useState<{ productId: string; productName: string; quantity: number; price: number; vat?: number; discount?: number; }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [costPrice, setCostPrice] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'new-order' | 'products' | 'orders'>('new-order');

  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleBarcodeScan = (barcode: string) => {
    setSearchQuery(barcode);
    setIsScannerOpen(false);
    if (activeTab === 'new-order') {
      const cleanBarcode = barcode.trim().toLowerCase();
      const availableProducts = supplier.hasFullInventoryAccess ? products : products.filter(p => p.supplier === supplier.name);
      const exactMatch = availableProducts.find(p => p.sku && p.sku.toLowerCase() === cleanBarcode);
      if (exactMatch) {
        handleSelectProduct(exactMatch);
      }
    }
  };

  const filteredProducts = useMemo(() => {
    const availableProducts = supplier.hasFullInventoryAccess 
      ? products 
      : products.filter(p => {
          const pSupp = (p.supplier || '').toLowerCase().trim();
          const sName = (supplier.name || '').toLowerCase().trim();
          const sId = (supplier.id || '').toLowerCase().trim();
          return pSupp === sName || pSupp === sId;
        });
        
    if (!searchQuery.trim()) return availableProducts.slice(0, 50);
    const q = searchQuery.toLowerCase().trim();
    return availableProducts.filter(p => 
      (p.name || '').toLowerCase().includes(q) || 
      (p.sku || '').toLowerCase().includes(q)
    ).slice(0, 15);
  }, [products, searchQuery, supplier.name, supplier.id, supplier.hasFullInventoryAccess]);

  const myOrders = useMemo(() => {
    return purchaseOrders.filter(o => o.supplierId === supplier.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [purchaseOrders, supplier.id]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setCostPrice(product.costPrice || 0);
    setSearchQuery('');
  };

  const handleAddItem = () => {
    if (!selectedProduct) return;
    setItems([...items, { 
      productId: selectedProduct.id, 
      productName: selectedProduct.name, 
      quantity, 
      price: costPrice 
    }]);
    setSelectedProduct(null);
    setQuantity(1);
    setCostPrice(0);
    setSearchQuery('');
  };



  const handleSubmit = async () => {
    if (!supplier || !orderNumber || items.length === 0) return;
    setIsSubmitting(true);
    try {
      await handleCreatePurchaseOrder({
        supplierId: supplier.id,
        orderNumber,
        items,
        total,
        status: 'pending'
      });
      setOrderNumber('');
      setItems([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <Truck size={20} />
            </div>
            <div>
              <h1 className="font-bold text-slate-900">{settings.name} - Portail Fournisseur</h1>
              <p className="text-xs text-slate-500">Bienvenue, {supplier.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button 
                onClick={() => setActiveTab('new-order')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                  activeTab === 'new-order' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Nouvelle Commande
              </button>
              <button 
                onClick={() => setActiveTab('products')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                  activeTab === 'products' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Mes Produits
              </button>
              <button 
                onClick={() => setActiveTab('orders')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                  activeTab === 'orders' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Mes Commandes
              </button>
            </div>
            <button 
              onClick={() => setIsProductModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all font-bold text-sm"
            >
              <Package size={18} /> Nouveau Produit
            </button>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all font-bold text-sm"
            >
              <LogOut size={18} /> Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="w-full min-h-screen">
        {activeTab === 'products' ? (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                {supplier.hasFullInventoryAccess ? "Catalogue / Inventaire Complet" : "Mes Produits Référencés"}
              </h2>
              <div className="relative w-full max-w-sm flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    placeholder="Rechercher..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => setIsScannerOpen(true)}
                  className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm shrink-0"
                  title="Scanner"
                >
                  <Scan size={18} />
                </button>
              </div>
            </div>

            <div className="bg-white border-t border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Produit</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">SKU</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Prix d'achat</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Prix de vente</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(supplier.hasFullInventoryAccess ? products : products.filter(p => {
                      const pSupp = (p.supplier || '').toLowerCase().trim();
                      const sName = (supplier.name || '').toLowerCase().trim();
                      const sId = (supplier.id || '').toLowerCase().trim();
                      return pSupp === sName || pSupp === sId;
                    }))
                    .filter(p => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase().trim();
                      return (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
                    })
                    .map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          {p.name}
                          <button
                            onClick={() => {
                              setEditingProduct(p);
                              setIsProductModalOpen(true);
                            }}
                            className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Modifier la fiche produit"
                          >
                            <Edit size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-500 font-mono">{p.sku || '-'}</td>
                      <td className="p-4 text-right font-bold text-slate-700">{p.costPrice?.toFixed(2)} {settings.currency}</td>
                      <td className="p-4 text-right font-bold text-indigo-600">{p.price.toFixed(2)} {settings.currency}</td>
                      <td className="p-4 text-center">
                        <span className={cn(
                          "px-2 py-1 rounded-lg text-xs font-bold",
                          p.stock <= (p.minStock || 5) ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {p.stock} {p.unit}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'orders' ? (
          <div className="p-8 space-y-6">
            <h2 className="text-xl font-bold text-slate-800">Historique des Commandes</h2>
            <div className="bg-white border-t border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Date</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">N° Commande</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Articles</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Total</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400 italic">Aucune commande trouvée</td>
                    </tr>
                  ) : (
                    myOrders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-sm text-slate-600">{formatSafe(order.createdAt, 'dd/MM/yyyy HH:mm')}</td>
                        <td className="p-4 text-sm font-mono text-slate-500">{order.orderNumber}</td>
                        <td className="p-4 text-sm text-slate-600">{order.items.length} articles</td>
                        <td className="p-4 text-sm font-bold text-slate-900 text-right">{order.total.toFixed(2)} {settings.currency}</td>
                        <td className="p-4 text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                            order.status === 'pending' ? "bg-amber-100 text-amber-700" :
                            order.status === 'received' ? "bg-emerald-100 text-emerald-700" :
                            "bg-slate-100 text-slate-700"
                          )}>
                            {order.status === 'pending' ? 'En attente' : 
                             order.status === 'received' ? 'Reçue' : 'Validée'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Plus size={24} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Nouveau Bon de Commande</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Numéro de commande</label>
              <input 
                type="text" 
                placeholder="Ex: BC-2024-001" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">Ajouter des articles</h3>
              <div className="relative w-full max-w-sm flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    placeholder="Rechercher par nom ou SKU..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        const cleanVal = searchQuery.trim().toLowerCase();
                        const exactMatch = filteredProducts.find(p => (p.sku || '').toLowerCase() === cleanVal);
                        if (exactMatch) {
                          handleSelectProduct(exactMatch);
                        } else if (filteredProducts.length > 0) {
                          handleSelectProduct(filteredProducts[0]);
                        }
                      }
                    }}
                  />
                  {searchQuery.trim() !== '' && isSearchFocused && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map(p => (
                          <button
                            key={p.id}
                            onClick={() => handleSelectProduct(p)}
                            className="w-full p-3 text-left hover:bg-slate-50 flex items-center gap-3 border-b last:border-0"
                          >
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                              {p.imageUrl ? (
                                <SafeImage 
                                  src={p.imageUrl} 
                                  alt={p.name} 
                                  className="w-full h-full object-cover" 
                                  fallback={<Package size={18} className="text-slate-500/20" />}
                                />
                              ) : (
                                <Package size={18} className="text-slate-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-slate-800 truncate">{p.name}</p>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{p.sku || 'Pas de SKU'}</p>
                            </div>
                            <p className="font-bold text-emerald-600 text-sm whitespace-nowrap">{p.price?.toFixed(2) || '0.00'} {settings.currency}</p>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-slate-500 text-sm">
                          Aucun article trouvé.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setIsScannerOpen(true)}
                  className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm shrink-0"
                  title="Scanner"
                >
                  <Scan size={18} />
                </button>
              </div>
            </div>

            {selectedProduct && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-4 rounded-xl border border-indigo-100 flex flex-col md:flex-row gap-4 items-end"
              >
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Produit sélectionné</label>
                  <p className="font-bold text-slate-800">{selectedProduct.name}</p>
                </div>
                <div className="w-full md:w-32 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Prix d'achat</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    value={costPrice} 
                    onChange={e => setCostPrice(parseFloat(e.target.value) || 0)} 
                  />
                </div>
                <div className="w-full md:w-32 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Quantité</label>
                  <input 
                    type="number" 
                    min="1"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    value={quantity} 
                    onChange={e => setQuantity(parseInt(e.target.value) || 1)} 
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddItem} className="px-6 py-2 rounded-lg font-bold">
                    Ajouter
                  </Button>
                  <button 
                    onClick={() => setSelectedProduct(null)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700">Articles de la commande</h3>
            <div className="border border-slate-100 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Produit</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Quantité</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Prix d'achat</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">TVA (%)</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Remise (%)</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total</th>
                    <th className="p-4 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 italic">Aucun article ajouté</td>
                    </tr>
                  ) : (
                    items.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-medium text-slate-800">
                          <div className="flex items-center gap-2">
                            {item.productName}
                            <button
                              onClick={() => {
                                const p = products.find(prod => prod.id === item.productId);
                                if (p) {
                                  setEditingProduct(p);
                                  setIsProductModalOpen(true);
                                }
                              }}
                              className="text-slate-300 hover:text-indigo-600 p-1 rounded-lg transition-colors"
                              title="Modifier la fiche produit"
                            >
                              <Edit size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-center font-bold">
                          <input type="number" value={item.quantity} onChange={(e) => {
                            const newItems = [...items];
                            newItems[i].quantity = parseInt(e.target.value) || 0;
                            setItems(newItems);
                          }} className="w-16 p-1 border rounded text-center" />
                        </td>
                        <td className="p-4 text-right">
                          <input type="number" value={item.price} onChange={(e) => {
                            const newItems = [...items];
                            newItems[i].price = parseFloat(e.target.value) || 0;
                            setItems(newItems);
                          }} className="w-20 p-1 border rounded text-right" />
                        </td>
                        <td className="p-4 text-right">
                          <input type="number" value={item.vat || 0} onChange={(e) => {
                            const newItems = [...items];
                            newItems[i].vat = parseFloat(e.target.value) || 0;
                            setItems(newItems);
                          }} className="w-16 p-1 border rounded text-right" />
                        </td>
                        <td className="p-4 text-right">
                          <input type="number" value={item.discount || 0} onChange={(e) => {
                            const newItems = [...items];
                            newItems[i].discount = parseFloat(e.target.value) || 0;
                            setItems(newItems);
                          }} className="w-16 p-1 border rounded text-right" />
                        </td>
                        <td className="p-4 text-right font-bold text-indigo-600">
                          {((item.price * item.quantity * (1 - (item.discount || 0) / 100) * (1 + (item.vat || 0) / 100))).toFixed(2)} {settings.currency}
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-slate-100">
            <div className="text-center md:text-left">
              <p className="text-sm text-slate-500 font-medium">Montant Total</p>
              <p className="text-3xl font-black text-slate-900">{total.toFixed(2)} <span className="text-indigo-600">{settings.currency}</span></p>
            </div>
            <Button 
              onClick={handleSubmit} 
              className="w-full md:w-auto px-12 py-4 rounded-xl font-bold text-lg shadow-xl shadow-indigo-100"
              disabled={items.length === 0 || !orderNumber || isSubmitting}
            >
              {isSubmitting ? "Traitement..." : "Valider la commande"}
            </Button>
          </div>
        </div>
      </div>
      )}
      {isScannerOpen && (
        <BarcodeScanner 
          onScan={handleBarcodeScan} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}
      
      <ProductFormModal
        isOpen={isProductModalOpen}
        onClose={() => { setIsProductModalOpen(false); setEditingProduct(null); }}
        editingProduct={editingProduct}
        products={products}
        categories={categories}
        settings={settings}
        user={user}
        brands={brands}
        setActiveTab={setGlobalActiveTab}
      />
    </main>
  </div>
);
};
