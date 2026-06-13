import { DEFAULT_PERMISSIONS } from '../constants';
import React, { useState, useMemo, memo, useEffect, useRef, useDeferredValue } from 'react';
import { List } from 'react-window';
import { printReceipt, printLabels } from '../services/printService';
import { Package, Tag, RefreshCw, History, LayoutGrid, Plus, FileSpreadsheet, Upload, ShoppingBag, AlertTriangle, Zap, Info, Search, Filter, Scan, LayoutList, Layers, Bot, Truck, ArrowUpDown, ArrowRight, Banknote, Users, Check, Printer, Copy, PackageOpen, Trash2, ChevronUp, ChevronLeft, ChevronRight, BarcodeIcon, ShoppingCart, Eye, X, MessageCircle, Phone, MapPin, Navigation, Edit, Clock, Mail, Percent, DollarSign, Star, Palette, FileText, AlignLeft, Shield, UserCog, Link2, MapIcon, Brain, Database, CreditCard, Minus, UserPlus, ChevronDown, ArrowUpRight, ArrowDownRight, Sparkles, FolderTree, Award, Calendar, AlertCircle, TrendingDown, ShieldCheck, RotateCcw } from 'lucide-react';
import { supabase } from '../supabase';
import { Button, Card, Modal, ConfirmDialog, BlurCard, SortableHeader, SafeImage } from './ui';
import { Product, Category, Brand, StockAdjustment, CompanySettings, SupplierSync, Supplier, Purchase, Transaction, OnlineOrder, Employee, Customer, CartItem, ProductReturn, RolePermissions, DamagedRecord } from '../types';
import { cn, logAction, safeDate, exportToExcel, getHierarchicalCategories, getCategoryDescendants, formatSafe, exportToCSV, generateUniqueId, isLocked } from '../lib/utils';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isToday, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../translations';

import { StockAdjustmentModal } from './StockAdjustmentModal';
import { DuplicateSKUModal } from './DuplicateSKUModal';
import { ImportModal } from './ImportModal';
import { ProductFormModal } from './ProductFormModal';
import { LabelPrinter, SingleLabel, getCommonStyles } from './LabelPrinter';
import { SupplierSyncManager } from './SupplierSyncManager';
import { StockHistory } from './StockHistory';
import { BarcodeScanner } from './BarcodeScanner';
import { ManualQRCodeGenerator } from './ManualQRCodeGenerator';


import { LossReport } from './LossReport';

export function ProductMobileCard({ product, settings, brands, categories, onEdit, onAdjust, onDelete, onHistory, onPrint, isPosSelectionMode, isDeleting, selectedProductIds, onToggleSelect, onCopy }: any) {
  const margin = product.price - (product.costPrice || 0);
  const isLowStock = product.stock <= (product.minStock || 5);
  
  return (
    <div 
      onClick={onEdit}
      className={cn(
        "bg-white/5 backdrop-blur-md p-5 rounded-[2.5rem] border border-white/10 shadow-2xl space-y-5 active:scale-[0.98] transition-all relative overflow-hidden group",
        isLowStock && "border-rose-500/30 bg-rose-500/5 shadow-neon-cyan/20"
      )}
    >
      <div className="flex items-start gap-4">
        {selectedProductIds && onToggleSelect && (
          <div className="flex items-center self-center mr-1" onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
            <div className={cn(
              "w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all flex-shrink-0 cursor-pointer",
              selectedProductIds.includes(product.id) 
                ? "bg-indigo-600 border-indigo-500 shadow-neon-indigo" 
                : "border-white/10 bg-black/20 hover:border-white/30"
            )}>
              {selectedProductIds.includes(product.id) && <Check size={14} className="text-white" strokeWidth={4} />}
            </div>
          </div>
        )}
        <div className="w-20 h-20 rounded-[1.5rem] bg-black/60 flex items-center justify-center overflow-hidden border border-white/10 flex-shrink-0 shadow-2xl group-hover:border-indigo-500 transition-all duration-500">
          <SafeImage 
            src={product.imageUrl} 
            className="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700" 
            containerClassName="w-full h-full"
            fallback={<Package size={28} className="text-white/10" />}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h5 className="font-black text-white truncate uppercase text-sm tracking-widest">{product.name}</h5>
            {isPosSelectionMode && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!product || !product.id) return;
                  try {
                    const newShowInPos = product.showInPos === false ? true : false;
                    const updatedProduct = {
                      ...product,
                      showInPos: newShowInPos,
                      updatedAt: new Date().toISOString()
                    };
                    
                    // Optimistic update
                    window.dispatchEvent(new CustomEvent('product-cache-update', { detail: updatedProduct }));
                    
                    await supabase.from('products').update({
                      show_in_pos: newShowInPos,
                      updated_at: updatedProduct.updatedAt
                    }).eq('id', product.id);
                  } catch (error) {
                    console.error("Error toggling POS visibility:", error);
                  }
                }}
                className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-xl border-2 transition-all flex items-center justify-center",
                  product.showInPos === false 
                    ? "border-white/10 bg-white/5 text-transparent" 
                    : "border-indigo-500 bg-indigo-500 text-white shadow-neon-indigo"
                )}
              >
                <Check size={14} strokeWidth={4} />
              </button>
            )}
          </div>
          <p className="text-[10px] font-black font-mono text-white/30 mt-2 uppercase tracking-[0.2em]">{product.sku || '-'}</p>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
             <span className={cn(
                "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border",
                isLowStock ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
             )}>
               STOCK: {product.stock} {product.unit}
             </span>
             {product.brandId && brands && (
               <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em]">
                 {brands.find((b: any) => b.id === product.brandId)?.name || 'Inconnu'}
               </span>
             )}
             {product.categoryId && categories && (
                <span className="bg-white/5 text-white/60 border border-white/10 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em]">
                  {(() => {
                    const cat = categories.find(c => c.id === product.categoryId);
                    if (!cat) return '-';
                    const parent = cat.parentId ? categories.find(p => p.id === cat.parentId) : null;
                    return parent ? `${parent.name} > ${cat.name}` : cat.name;
                  })()}
                </span>
             )}
             {product.location && (
                <span className="bg-amber-500/10 text-white border border-amber-500/50 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] shadow-neon-amber/20">
                  LOC: {product.location}
                </span>
             )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between p-5 bg-black/40 rounded-[1.5rem] border border-white/5">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-2 leading-none">PRIX UNITAIRE</span>
          <div className="flex items-baseline gap-1.5">
             <span className="text-2xl font-black text-white tracking-tighter">{product.price.toFixed(2)}</span>
             <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{settings.currency}</span>
          </div>
        </div>
        <div className="text-right flex flex-col">
          <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-2 leading-none">MARGE NETTE</span>
          <span className={cn("text-lg font-black tracking-tighter", margin > 0 ? "text-emerald-400" : "text-rose-400")}>
            {margin > 0 ? '+' : ''}{margin.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2" onClick={(e) => e.stopPropagation()}>
        <button 
          onClick={onAdjust}
          className="flex-1 flex items-center justify-center gap-3 py-4 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-neon-indigo transition-all border border-indigo-400/20 active:scale-95"
        >
          <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" /> Stock
        </button>
        <div className="flex gap-2">
           {[
             { icon: History, onClick: onHistory },
             { icon: Printer, onClick: onPrint },
             { icon: Copy, onClick: onCopy },
             { icon: Trash2, onClick: onDelete, danger: true, loading: isDeleting }
           ].map((btn, i) => (
             <button 
                key={i}
                onClick={btn.onClick}
                disabled={btn.loading}
                className={cn(
                  "h-12 w-12 flex items-center justify-center rounded-[1.25rem] border transition-all active:scale-90",
                  btn.danger 
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white" 
                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white"
                )}
             >
                {btn.loading ? <RefreshCw size={18} className="animate-spin" /> : <btn.icon size={18} />}
              </button>
           ))}
        </div>
      </div>
    </div>
  );
}

const mapDoc = <T,>(doc: any): T => {
  return { id: doc.id, ...doc.data() } as unknown as T;
};

export function Inventory({ products, categories, brands, stockAdjustments, user, settings, setActiveTab, supplierSyncs, allSuppliers, purchases, transactions, setIsProductModalOpen, setEditingProduct, editingProduct, isProductModalOpen, setViewingPurchaseVoucher, damagedRecords }: { products: Product[], categories: Category[], brands: Brand[], stockAdjustments: StockAdjustment[], user: any, settings: CompanySettings, setActiveTab: (tab: string) => void, supplierSyncs: SupplierSync[], allSuppliers: Supplier[], purchases: Purchase[], transactions: Transaction[], setIsProductModalOpen: (v: boolean) => void, setEditingProduct: (p: Product | null) => void, editingProduct: Product | null, isProductModalOpen: boolean, setViewingPurchaseVoucher: (p: Purchase | null) => void, damagedRecords: DamagedRecord[] }) {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkImageModalOpen, setIsBulkImageModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedProductForAdjustment, setSelectedProductForAdjustment] = useState<Product | null>(null);
  const [selectedProductForLabel, setSelectedProductForLabel] = useState<Product | null>(null);
  const [inventoryTab, setInventoryTab] = useState<'products' | 'history' | 'labels' | 'sync' | 'losses'>('products');
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'discontinued'>('all');
  const [stockLevelFilter, setStockLevelFilter] = useState<'all' | 'low' | 'out'>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isBarcodeGenOpen, setIsBarcodeGenOpen] = useState(false);
  const [isPurchaseHistoryModalOpen, setIsPurchaseHistoryModalOpen] = useState(false);
  const [isSalesHistoryModalOpen, setIsSalesHistoryModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string>('all');

  // O(1) Speed Index for Barcode Scanning - High Performance
  const productsIndexMap = useMemo(() => {
    const map = new Map<string, Product>();
    const normalizedMap = new Map<string, Product>();

    products.forEach(p => {
      const keys = [p.sku, p.barcode, p.reference, p.id].filter(Boolean) as string[];
      keys.forEach(k => {
        const clean = k.trim().toLowerCase();
        map.set(clean, p);
        const normalized = clean.replace(/[^a-z0-9]/g, '');
        if (normalized) normalizedMap.set(normalized, p);
      });
    });
    return { exact: map, normalized: normalizedMap };
  }, [products]);

  const handleBarcodeScan = (barcode: string) => {
    if (!barcode) return;
    const cleanBarcode = barcode.trim().toLowerCase();
    const normalizedBarcode = cleanBarcode.replace(/[^a-z0-9]/g, '');
    
    // O(1) Lookup instead of nested loop searches
    const product = productsIndexMap.exact.get(cleanBarcode) || productsIndexMap.normalized.get(normalizedBarcode);
    
    if (product) {
      setSearch(barcode);
      setIsScannerOpen(false);
      setEditingProduct(product);
      setIsProductModalOpen(true);
    } else {
      setSearch(barcode);
      setIsScannerOpen(false);
    }
  };
  const [isPriceCheckerOpen, setIsPriceCheckerOpen] = useState(false);
  const [priceCheckResult, setPriceCheckResult] = useState<Product | null>(null);
  const [isProductHistoryModalOpen, setIsProductHistoryModalOpen] = useState(false);
  const [viewingHistoryProduct, setViewingHistoryProduct] = useState<Product | null>(null);
  const [historyTab, setHistoryTab] = useState<'sales' | 'purchases' | 'price'>('sales');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: any; direction: 'asc' | 'desc' } | null>(null);
  const [showMarginExtremes, setShowMarginExtremes] = useState(false);
  const [posVisibilityFilter, setPosVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [importPreviewData, setImportPreviewData] = useState<any[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Configuration de la pagination pour la performance
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMassDeleting, setIsMassDeleting] = useState(false);
  const [massDeleteProgress, setMassDeleteProgress] = useState(0);
  const [isAutoMerging, setIsAutoMerging] = useState(false);
  const [autoMergeProgress, setAutoMergeProgress] = useState(0);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [isMassDeleteConfirmOpen, setIsMassDeleteConfirmOpen] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isPosSelectionMode, setIsPosSelectionMode] = useState(false);

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const toggleSelectAll = () => {
    if (selectedProductIds.length === paginatedProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(paginatedProducts.map(p => p.id));
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    setConfirmAction({
      title: "Supprimer la sélection",
      message: `Êtes-vous sûr de vouloir supprimer les ${selectedProductIds.length} produits sélectionnés ? Cette action est irréversible.`,
      onConfirm: async () => {
        setConfirmAction(null);
        setIsMassDeleting(true);
        setMassDeleteProgress(0);
        try {
          const { error } = await supabase.from('products').delete().in('id', selectedProductIds);
          if (error) throw error;
          
          window.dispatchEvent(new CustomEvent('products-batch-delete', { detail: { ids: selectedProductIds } }));
          logAction(user.uid, user.displayName || 'Utilisateur', 'Suppression Groupée', 'Inventaire', `${selectedProductIds.length} produits supprimés`);
          setSelectedProductIds([]);
          toast.success("Produits supprimés de l'inventaire avec succès.");
        } catch (error: any) {
          alert("Erreur lors de la suppression: " + error.message);
        } finally {
          setIsMassDeleting(false);
        }
      }
    });
  };

  const handleBulkPrintLabels = () => {
    const selected = products.filter(p => selectedProductIds.includes(p.id));
    // Implementation depends on how LabelPrinter receives products
    // For now, we can set a state that LabelPrinter uses
    setInventoryTab('labels');
    // We might need to pass the initial selection to LabelPrinter
  };

  // Bulk category / brand update states
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [bulkUpdateCategory, setBulkUpdateCategory] = useState(false);
  const [bulkUpdateBrand, setBulkUpdateBrand] = useState(false);
  const [bulkParentCatId, setBulkParentCatId] = useState('');
  const [bulkSubCatId, setBulkSubCatId] = useState('');
  const [bulkBrandId, setBulkBrandId] = useState('');
  const [isMassUpdating, setIsMassUpdating] = useState(false);

  const handleBulkUpdate = async () => {
    if (selectedProductIds.length === 0) return;
    if (!bulkUpdateCategory && !bulkUpdateBrand) {
      toast.error("Veuillez sélectionner au moins un champ à modifier (Catégorie ou Marque).");
      return;
    }

    setIsMassUpdating(true);
    try {
      const brandIdToSet = bulkUpdateBrand ? (bulkBrandId || null) : undefined;
      const categoryIdToSet = bulkUpdateCategory ? (bulkSubCatId || bulkParentCatId || null) : undefined;
      const updatedAt = new Date().toISOString();

      const updateData: any = { updated_at: updatedAt };
      if (brandIdToSet !== undefined) updateData.brand_id = brandIdToSet;
      if (categoryIdToSet !== undefined) updateData.category_id = categoryIdToSet;

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .in('id', selectedProductIds);
        
      if (error) throw error;

      const details = [
        bulkUpdateCategory ? `Catégorie: ${bulkSubCatId || bulkParentCatId || 'Aucune'}` : null,
        bulkUpdateBrand ? `Marque: ${bulkBrandId || 'Aucune'}` : null
      ].filter(Boolean).join(', ');

      logAction(
        user.uid,
        user.displayName || 'Utilisateur',
        'Mise à jour Groupée',
        'Inventaire',
        `Changement groupé pour ${selectedProductIds.length} articles (${details})`
      );

      toast.success(`Les ${selectedProductIds.length} produits ont été mis à jour avec succès !`);
      setSelectedProductIds([]);
      setIsBulkUpdateModalOpen(false);
      
      // Reset modal values
      setBulkUpdateCategory(false);
      setBulkUpdateBrand(false);
      setBulkParentCatId('');
      setBulkSubCatId('');
      setBulkBrandId('');
    } catch (error) {
      console.error(error);
      toast.error("Une erreur s'est produite lors de la mise à jour groupée.");
    } finally {
      setIsMassUpdating(false);
    }
  };

  // Reset selection when tab or page changes
  useEffect(() => {
    setSelectedProductIds([]);
  }, [inventoryTab, currentPage, search, selectedCategories]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategories, selectedSupplier, selectedBrand, statusFilter, stockLevelFilter, dateRange, posVisibilityFilter]);

  const generateLowStockOrder = async () => {
    const lowStockItems = products.filter(p => p.stock <= (p.minStock || 5));
    if (lowStockItems.length === 0) {
      alert("Aucun produit en stock faible.");
      return;
    }
    
    setIsProcessing(true);
    try {
      const purchaseData: Omit<Purchase, 'id'> = {
        supplierId: 'low-stock-auto',
        supplierName: 'Auto-Réapprovisionnement',
        items: lowStockItems.map(p => ({
          productId: p.id,
          name: p.name,
          quantity: (p.minStock || 5) * 2 - p.stock,
          costPrice: p.costPrice || 0
        })),
        total: lowStockItems.reduce((sum, p) => sum + ((p.costPrice || 0) * ((p.minStock || 5) * 2 - p.stock)), 0),
        date: new Date().toISOString(),
        status: 'draft',
        paymentStatus: 'unpaid',
        paidAmount: 0,
        updatedAt: new Date().toISOString()
      };
      const newId = Math.random().toString(36).substring(2, 10);
      await supabase.from('purchases').insert({ id: newId, ...purchaseData });
      alert("Commande automatique générée dans les achats (Brouillon).");
      setActiveTab('purchases');
    } catch (error: any) {
      console.error("Error creating purchase:", error);
      alert("Erreur lors de la création de la commande: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };



  const handleDelete = (id: string) => {
    setProductToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      const product = products.find(p => p.id === productToDelete);
      try {
        await supabase.from('products').delete().eq('id', productToDelete);
        window.dispatchEvent(new CustomEvent('product-cache-delete', { detail: { id: productToDelete } }));
        logAction(user.uid, user.displayName || 'Utilisateur', 'Suppression Produit', 'Inventaire', `Produit: ${product?.name || 'Inconnu'}, SKU: ${product?.sku || 'Inconnu'}`);
        setIsDeleteConfirmOpen(false);
        setProductToDelete(null);
      } catch (error: any) {
        console.error("Error deleting product:", error);
        alert("Erreur lors de la suppression: " + error.message);
      }
    }
  };

  const handleAutoResolveAll = async () => {
    const groupsToProcess = [...duplicateSKUGroups];
    if (groupsToProcess.length === 0) return;
    
    setConfirmAction({
      title: "Fusion Automatique",
      message: `Voulez-vous fusionner AUTOMATIQUEMENT les ${groupsToProcess.length} groupes de doublons ? Les stocks seront additionnés pour chaque groupe.`,
      onConfirm: async () => {
        setIsAutoMerging(true);
        setAutoMergeProgress(0);
        let successCount = 0;

        try {
          for (let i = 0; i < groupsToProcess.length; i++) {
            const group = groupsToProcess[i];
            if (!group || !group.products || group.products.length < 2) continue;

            const [mainProduct, ...others] = group.products;
            const totalStock = group.products.reduce((acc, p) => acc + (p.stock || 0), 0);
            
            const updatedAt = new Date().toISOString();
            
            // In Supabase, update main product stock
            const { error: updErr } = await supabase
              .from('products')
              .update({ stock: totalStock, updated_at: updatedAt })
              .eq('id', mainProduct.id);
            if (updErr) throw updErr;

            // Delete other duplicate products in Supabase
            const otherIds = others.map(other => other.id);
            if (otherIds.length > 0) {
              const { error: delErr } = await supabase
                .from('products')
                .delete()
                .in('id', otherIds);
              if (delErr) throw delErr;
            }
            
            window.dispatchEvent(new CustomEvent('product-cache-update', { 
              detail: { ...mainProduct, stock: totalStock, updatedAt } 
            }));
            
            others.forEach(other => {
              window.dispatchEvent(new CustomEvent('product-cache-delete', { detail: { id: other.id } }));
            });
            successCount++;
            setAutoMergeProgress(((i + 1) / groupsToProcess.length) * 100);
          }
          toast.success(`Nettoyage terminé : ${successCount} groupes fusionnés.`);
        } catch (err) {
          console.error('Auto merge failed:', err);
          toast.error("Erreur lors de la fusion automatique.");
        } finally {
          setIsAutoMerging(false);
          setAutoMergeProgress(0);
          setConfirmAction(null);
        }
      }
    });
  };

  const handleMassDeleteProducts = async () => {
    setIsMassDeleting(true);
    setMassDeleteProgress(0);
    try {
      // In Supabase, delete all products
      const { error } = await supabase
        .from('products')
        .delete()
        .neq('id', 'none_placeholder_delete_all');
      if (error) throw error;
      
      window.dispatchEvent(new CustomEvent('products-batch-delete', { detail: { ids: products.map(d => d.id) } }));
      setIsMassDeleteConfirmOpen(false);
      toast.success("Tous les produits ont été supprimés.");
    } catch (error) {
      console.error("Mass delete failed:", error);
      toast.error("Erreur lors de la suppression massive.");
    } finally {
      setIsMassDeleting(false);
      setMassDeleteProgress(0);
    }
  };

  const productSuppliers = useMemo(() => {
    return Array.from(new Set(products.map((p: Product) => p.supplier))).filter(Boolean) as string[];
  }, [products]);

  const expandedSelectedCategories = useMemo(() => {
    if (selectedCategories.length === 0) return [];
    const all = new Set<string>();
    selectedCategories.forEach(cid => {
      if (cid === 'uncategorized') {
        all.add('uncategorized');
        return;
      }
      all.add(cid);
      getCategoryDescendants(categories, cid).forEach(d => all.add(d));
    });
    return Array.from(all);
  }, [selectedCategories, categories]);

  // Precompute category product counts (including descendants)
  const categoryProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach(c => {
      counts[c.id] = 0;
    });
    counts['uncategorized'] = 0;

    products.forEach(p => {
      const cid = p.categoryId || 'uncategorized';
      if (counts[cid] !== undefined) {
        counts[cid]++;
      } else {
        counts['uncategorized']++;
      }
    });

    const aggregated: Record<string, number> = {};
    categories.forEach(c => {
      const descendants = getCategoryDescendants(categories, c.id);
      let total = counts[c.id] || 0;
      descendants.forEach(dId => {
        total += counts[dId] || 0;
      });
      aggregated[c.id] = total;
    });
    aggregated['uncategorized'] = counts['uncategorized'] || 0;
    return aggregated;
  }, [categories, products]);

  const filteredProducts = useMemo(() => {
    const searchTerms = deferredSearch.toLowerCase().split(' ').filter(Boolean);
    return products.filter((p: Product) => {
      const matchesSearch = searchTerms.every(term =>
        (p.name || '').toLowerCase().includes(term) ||
        (p.sku || '').toLowerCase().includes(term) ||
        (p.barcode || '').toLowerCase().includes(term) ||
        (p.reference || '').toLowerCase().includes(term) ||
        (p.description || '').toLowerCase().includes(term) ||
        (p.tags || []).some(tag => tag.toLowerCase().includes(term)) ||
        (p.supplier || '').toLowerCase().includes(term)
      );

      // Robust category matching (case-insensitive fallback based on ID and name)
      let matchesCategory = true;
      if (expandedSelectedCategories.length > 0) {
        const pCatId = (p.categoryId || '').trim();
        let isMatched = expandedSelectedCategories.includes(pCatId);
        
        if (!isMatched) {
          const productCat = categories.find(c => c.id === pCatId);
          if (productCat) {
            const selectedCatNames = categories
              .filter(c => expandedSelectedCategories.includes(c.id))
              .map(c => c.name.toLowerCase().trim());
            if (selectedCatNames.includes(productCat.name.toLowerCase().trim())) {
              isMatched = true;
            }
          }
        }

        if (!pCatId) {
          isMatched = expandedSelectedCategories.includes('uncategorized');
        }
        
        matchesCategory = isMatched;
      }

      const matchesSupplier = selectedSupplier === 'all' || (p.supplier || 'Sans fournisseur') === selectedSupplier;
      const matchesBrand = selectedBrand === 'all' || (selectedBrand === 'none' ? !p.brandId : p.brandId === selectedBrand);
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      
      const matchesStock = stockLevelFilter === 'all' 
        ? true 
        : stockLevelFilter === 'low' 
          ? p.stock <= (p.minStock || 5) && p.stock > 0
          : p.stock <= 0;

      const matchesDate = (!dateRange.start || safeDate(p.createdAt || p.updatedAt) >= safeDate(dateRange.start)) &&
                          (!dateRange.end || safeDate(p.createdAt || p.updatedAt) <= safeDate(dateRange.end));

      const matchesPos = posVisibilityFilter === 'all'
        ? true
        : posVisibilityFilter === 'visible'
          ? p.showInPos !== false
          : p.showInPos === false;

      return matchesSearch && matchesCategory && matchesSupplier && matchesStatus && matchesStock && matchesDate && matchesPos && matchesBrand;
    });
  }, [products, deferredSearch, selectedCategories, categories, selectedSupplier, selectedBrand, statusFilter, stockLevelFilter, dateRange, posVisibilityFilter]);

  const sortedProducts = useMemo(() => {
    let sortableProducts = [...filteredProducts];
    if (sortConfig !== null) {
      sortableProducts.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'margin') {
          aValue = a.price - (a.costPrice || 0);
          bValue = b.price - (b.costPrice || 0);
        } else {
          aValue = a[sortConfig.key as keyof Product];
          bValue = b[sortConfig.key as keyof Product];
        }
        
        // Handle "Relevance" (just uses the default filter if no sort specified, 
        // but here we can treat "createdAt" or the order of finding as relevance)
        
        if (sortConfig.key === 'createdAt' || sortConfig.key === 'updatedAt') {
          aValue = new Date(aValue || 0).getTime();
          bValue = new Date(bValue || 0).getTime();
        }

        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        
        if (typeof aValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableProducts;
  }, [filteredProducts, sortConfig]);

  const duplicateSKUGroups = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    products.forEach(p => {
      if (p.sku && p.sku.trim() !== '') {
        const sku = p.sku.trim();
        if (!groups[sku]) groups[sku] = [];
        groups[sku].push(p);
      }
    });
    return Object.entries(groups)
      .filter(([_, group]) => group.length > 1)
      .map(([sku, group]) => ({ sku, products: group }));
  }, [products]);

  const requestSort = (key: any) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const productsBySupplier = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    filteredProducts.forEach((p: Product) => {
      const s = p.supplier || 'Sans fournisseur';
      if (!grouped[s]) grouped[s] = [];
      grouped[s].push(p);
    });
    return grouped;
  }, [filteredProducts]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedProducts.slice(start, start + pageSize);
  }, [sortedProducts, currentPage]);

  const marginExtremes = useMemo(() => {
    if (paginatedProducts.length < 2) return { maxId: null, minId: null };
    let maxMargin = -Infinity;
    let minMargin = Infinity;
    let maxId: string | null = null;
    let minId: string | null = null;

    paginatedProducts.forEach((p: Product) => {
      const m = p.price - (p.costPrice || 0);
      if (m > maxMargin) {
        maxMargin = m;
        maxId = p.id;
      }
      if (m < minMargin) {
        minMargin = m;
        minId = p.id;
      }
    });

    if (maxMargin === minMargin) {
      return { maxId: null, minId: null };
    }

    return { maxId, minId };
  }, [paginatedProducts]);

  const totalPages = Math.ceil(sortedProducts.length / pageSize);

  // Row Renderer for Virtualized List
  const ProductRow = useMemo(() => memo(({ index, style, sortedProducts: listProducts }: { index: number; style: React.CSSProperties; sortedProducts?: Product[] }) => {
    const product = (listProducts || sortedProducts)[index];
    if (!product) return null;

    const margin = product.price - (product.costPrice || 0);
    const isLowStock = product.stock <= (product.minStock || 5);

    return (
      <div style={{ ...style, top: 0 }} className="px-6">
        <motion.div 
          initial={false}
          className={cn(
            "group flex items-center gap-6 p-4 rounded-3xl border transition-all duration-300 relative overflow-hidden mb-3 h-[88px] box-border",
            isLowStock ? "bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10" : "bg-white/5 border-white/10 hover:bg-white/10",
            (isDeletingId === product.id || isMassDeleting) && "opacity-50 grayscale pointer-events-none"
          )}
          onClick={() => { setEditingProduct(product); setIsProductModalOpen(true); }}
        >
                <div className="flex items-center gap-2 min-w-0" onClick={(e) => { e.stopPropagation(); toggleSelectProduct(product.id); }}>
                   <div className={cn(
                     "w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all flex-shrink-0 cursor-pointer",
                     selectedProductIds.includes(product.id) 
                       ? "bg-indigo-600 border-indigo-500 shadow-neon-indigo" 
                       : "border-white/10 bg-black/20 hover:border-white/30"
                   )}>
                     {selectedProductIds.includes(product.id) && <Check size={16} className="text-white" strokeWidth={4} />}
                   </div>
                </div>

                <div 
                  className="w-14 h-14 rounded-2xl bg-black/40 border border-white/10 overflow-hidden flex-shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    const mainImg = product.imageUrl || (product.imageUrls && product.imageUrls[0]);
                    if (mainImg) setEnlargedImage(mainImg);
                  }}
                >
                  <SafeImage 
                    src={product.imageUrl} 
                    className="w-full h-full object-cover" 
                    containerClassName="w-full h-full"
                    fallback={<Package size={22} className="text-white/10" />}
                  />
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="font-black text-white text-[11px] truncate uppercase tracking-widest leading-none">{product.name}</h5>
                    {isLowStock && <AlertTriangle size={12} className="text-rose-500 animate-pulse flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black font-mono text-white/30 uppercase tracking-[0.2em] truncate max-w-[120px]">{product.sku || '-'}</span>
                    <span className="text-[9px] font-black text-indigo-400/80 uppercase tracking-widest bg-indigo-500/5 px-2 py-0.5 rounded-full border border-indigo-500/10">
                      {product.brandId ? (brands.find(b => b.id === product.brandId)?.name || '...') : 'No Brand'}
                    </span>
                  </div>
                </div>

                <div className="w-48 hidden xl:flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <FolderTree size={10} className="text-white/20" />
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest truncate leading-none">
                      {(() => {
                        const cat = categories.find(c => c.id === product.categoryId);
                        if (!cat) return 'Général';
                        const parent = cat.parentId ? categories.find(p => p.id === cat.parentId) : null;
                        return parent ? `${parent.name} > ${cat.name}` : cat.name;
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Fournisseur:</span>
                    <span className="text-[9px] font-black text-white/60 truncate">{product.supplier || '-'}</span>
                  </div>
                </div>

                <div className="w-24 text-right flex flex-col justify-center">
                  <div className="flex items-center justify-end gap-1 mb-1">
                    <span className="text-lg font-black text-white tracking-tighter leading-none">{product.price.toFixed(2)}</span>
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{settings.currency}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Marge:</span>
                    <span className={cn("text-[10px] font-black tracking-tighter", margin > 0 ? "text-emerald-400" : "text-rose-400")}>
                      {margin.toFixed(2)}
                      {showMarginExtremes && marginExtremes.maxId === product.id && <Zap size={10} className="inline ml-1 text-yellow-400 animate-pulse" />}
                    </span>
                  </div>
                </div>

                <div className="w-32 flex flex-col items-end justify-center">
                  <div className={cn(
                    "px-4 py-2 rounded-2xl flex items-center gap-3 border transition-all shadow-inner",
                    isLowStock ? "bg-rose-500/10 border-rose-500/20" : "bg-black/40 border-white/5"
                  )}>
                    <div className="flex flex-col items-end">
                      <span className={cn("text-sm font-black tracking-tighter", isLowStock ? "text-rose-400" : "text-white")}>
                        {product.stock}
                      </span>
                      <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] leading-none">{product.unit}</span>
                    </div>
                    <Layers size={14} className={isLowStock ? "text-rose-500/50" : "text-white/10"} />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pl-4 ml-4 border-l border-white/5" onClick={(e) => e.stopPropagation()}>
                  {[
                    { icon: Printer, onClick: () => printQuickLabel(product), color: 'text-indigo-400 hover:bg-indigo-500/20', title: 'Impression Rapide' },
                    { icon: Edit, onClick: () => { setEditingProduct(product); setIsProductModalOpen(true); }, color: 'text-indigo-400 hover:bg-indigo-500/10', title: 'Modifier' },
                    { icon: Copy, onClick: () => { setEditingProduct({...product, id: undefined, name: product.name + " (Copie)"}); setIsProductModalOpen(true); }, color: 'text-amber-400 hover:bg-amber-500/20', title: 'Copier' },
                    { icon: RefreshCw, onClick: () => { setSelectedProductForAdjustment(product); setIsAdjustmentModalOpen(true); }, color: 'text-emerald-400 hover:bg-emerald-500/20', title: 'Ajuster' },
                    { icon: Trash2, onClick: () => handleDelete(product.id), color: 'text-rose-400 hover:bg-rose-500/20', danger: true, title: 'Supprimer' }
                  ].map((btn, i) => (
                    <button 
                      key={i}
                      onClick={btn.onClick}
                      title={(btn as any).title}
                      className={cn(
                        "w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 flex-shrink-0 bg-white/5",
                        btn.color
                      )}
                    >
                      <btn.icon size={16} />
                    </button>
                  ))}
                </div>
        </motion.div>
      </div>
    );
  }), [sortedProducts, categories, brands, settings, selectedProductIds, isDeletingId, isMassDeleting, showMarginExtremes, marginExtremes, setEditingProduct, setIsProductModalOpen, toggleSelectProduct, setEnlargedImage, handleDelete, setSelectedProductForAdjustment, setIsAdjustmentModalOpen]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as any[];
          if (data.length > 0) {
            setCsvHeaders(Object.keys(data[0]));
            setImportPreviewData(data); // Preview all data
            setIsImportModalOpen(true);
          }
        },
        error: (error) => {
          console.error('Error parsing CSV:', error);
          alert('Erreur lors de la lecture du fichier CSV.');
        }
      });
    } else if (file.name.endsWith('.xlsx')) {
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (jsonData.length > 0) {
          setCsvHeaders(Object.keys(jsonData[0] as object));
          setImportPreviewData(jsonData);
          setIsImportModalOpen(true);
        }
      } catch (error) {
        console.error('Error parsing XLSX:', error);
        alert('Erreur lors de la lecture du fichier Excel.');
      }
    }
  };

  const [importProgress, setImportProgress] = useState(0);
  const [importErrors, setImportErrors] = useState<{ row: number, message: string }[]>([]);

  const executeImport = async (mapping: Record<string, string>) => {
    setIsProcessing(true);
    setImportProgress(1); // Start immediately with 1%
    setImportErrors([]);
    let importedCount = 0;
    let errorCount = 0;
    const errors: { row: number, message: string }[] = [];

    let upsertQueue: Product[] = [];
    const totalLines = importPreviewData.length;

    // Cache existing products by SKU, Barcode, and Name in O(1) Map for lightning-fast lookups and live updates
    const productBySkuMap = new Map<string, Product>();
    const productByBarcodeMap = new Map<string, Product>();
    const productByNameMap = new Map<string, Product>();
    products.forEach(prod => {
      if (prod.sku) {
        productBySkuMap.set(prod.sku.toLowerCase().trim(), prod);
      }
      if (prod.barcode) {
        productByBarcodeMap.set(prod.barcode.toLowerCase().trim(), prod);
      }
      if (prod.name) {
        productByNameMap.set(prod.name.toLowerCase().trim(), prod);
      }
    });

    // Cache categories by name
    const categoryByNameMap = new Map<string, any>();
    categories.forEach(cat => {
      if (cat.name) {
        categoryByNameMap.set(cat.name.toLowerCase().trim(), cat);
      }
    });

    for (let i = 0; i < totalLines; i++) {
      const p = importPreviewData[i];
      const name = p[mapping.name] || p.name;
      const price = p[mapping.price] || p.price;
      
      if (!name || (!price && price !== 0)) {
        errors.push({ row: i + 1, message: 'Nom ou prix de vente manquant' });
        errorCount++;
      } else {
        try {
          const categoryName = p[mapping.category] || p.category || 'Général';
          const category = categoryByNameMap.get(categoryName.toString().toLowerCase().trim());
          const categoryId = category ? category.id : '';

          const skuVal = (p[mapping.sku] || p.sku || '').toString().trim();
          const barcodeVal = (p[mapping.barcode] || p.barcode || '').toString().trim();

          // Get product by either matching SKU, matching Barcode, or crossed lookups
          const existingProductBySku = skuVal ? productBySkuMap.get(skuVal.toLowerCase()) : null;
          const existingProductByBarcode = barcodeVal ? productByBarcodeMap.get(barcodeVal.toLowerCase()) : null;
          const existingProductBySkuAsBarcode = skuVal ? productByBarcodeMap.get(skuVal.toLowerCase()) : null;
          const existingProductByBarcodeAsSku = barcodeVal ? productBySkuMap.get(barcodeVal.toLowerCase()) : null;

          const existingProduct = existingProductBySku || existingProductByBarcode || existingProductBySkuAsBarcode || existingProductByBarcodeAsSku;

          const updatedAt = new Date().toISOString();

          // Safe math conversions to prevent NaN from breaking reports and analytics
          const parsedPrice = parseFloat(price.toString().replace(',', '.').replace(/\s/g, '') || '0');
          const finalPrice = isNaN(parsedPrice) ? 0 : parsedPrice;

          const rawCost = p[mapping.costPrice] || p.costprice || p.cost_price || '0';
          const parsedCost = parseFloat(rawCost.toString().replace(',', '.').replace(/\s/g, '') || '0');
          const finalCost = isNaN(parsedCost) ? 0 : parsedCost;

          const rawStock = p[mapping.stock] || p.stock || '0';
          const parsedStock = parseFloat(rawStock.toString().replace(',', '.').replace(/\s/g, '') || '0');
          const finalStock = isNaN(parsedStock) ? 0 : parsedStock;

          if (existingProduct) {
            const currentStock = parseFloat(existingProduct.stock?.toString() || '0');
            const updatedProduct: Product = {
              ...existingProduct,
              name: name.toString().trim(),
              price: finalPrice,
              costPrice: finalCost,
              stock: currentStock + finalStock,
              categoryId: categoryId || existingProduct.categoryId || '',
              sku: skuVal || existingProduct.sku || `SKU-${generateUniqueId()}`,
              barcode: barcodeVal || existingProduct.barcode || '',
              unit: p[mapping.unit] || p.unit || existingProduct.unit || 'unité',
              updatedAt: updatedAt
            };

            upsertQueue.push(updatedProduct);

            // Dynamically update the lookups maps in real-time to avoid creating duplicates from identical sequential entries in the source file
            productByNameMap.set(updatedProduct.name.toLowerCase().trim(), updatedProduct);
            if (updatedProduct.sku) {
              productBySkuMap.set(updatedProduct.sku.toLowerCase().trim(), updatedProduct);
            }
            if (updatedProduct.barcode) {
              productByBarcodeMap.set(updatedProduct.barcode.toLowerCase().trim(), updatedProduct);
            }
          } else {
            const productId = Math.random().toString(36).substring(2, 11);
            const newProduct: Product = {
              id: productId,
              name: name.toString().trim(),
              price: finalPrice,
              costPrice: finalCost,
              stock: finalStock,
              categoryId: categoryId,
              sku: skuVal || `SKU-${generateUniqueId()}`,
              barcode: barcodeVal || '',
              unit: p[mapping.unit] || p.unit || 'unité',
              status: 'active',
              taxRate: 0,
              minStock: 0,
              supplier: '',
              createdAt: updatedAt,
              updatedAt: updatedAt
            };

            upsertQueue.push(newProduct);

            // Dynamically add to maps to track new creations list instantly
            productByNameMap.set(newProduct.name.toLowerCase().trim(), newProduct);
            if (newProduct.sku) {
              productBySkuMap.set(newProduct.sku.toLowerCase().trim(), newProduct);
            }
            if (newProduct.barcode) {
              productByBarcodeMap.set(newProduct.barcode.toLowerCase().trim(), newProduct);
            }
          }
          importedCount++;
          
          if (upsertQueue.length >= 250) {
            const sanitizeProductForSupabase = (p: Product) => ({
              id: p.id,
              name: p.name,
              barcode: p.barcode || null,
              sku: p.sku || null,
              price: p.price ?? 0,
              cost_price: p.costPrice ?? 0,
              stock: p.stock ?? 0,
              category_id: p.categoryId || 'uncategorized',
              status: p.status || 'active',
              unit: p.unit || 'unité',
              tax_rate: p.taxRate ?? 0,
              min_stock: p.minStock ?? 0,
              supplier: p.supplier || null,
              created_at: p.createdAt || updatedAt,
              updated_at: p.updatedAt || updatedAt
            });

            const payloads = upsertQueue.map(sanitizeProductForSupabase);
            const { error: upsertErr } = await supabase
              .from('products')
              .upsert(payloads, { onConflict: 'id' });
            if (upsertErr) throw upsertErr;

            upsertQueue.forEach(item => {
              window.dispatchEvent(new CustomEvent('product-cache-update', { detail: item }));
            });

            upsertQueue = [];
            
            // Periodically update progress bar and yield to browser paint thread
            const currentPercent = Math.min(100, Math.round(((i + 1) / totalLines) * 100));
            setImportProgress(currentPercent);
            if (errors.length > 0) {
              setImportErrors([...errors]);
            }
            // Yield thread for snappy UI response
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        } catch (error) {
          console.error('Error preparing update for product:', p, error);
          errors.push({ row: i + 1, message: error instanceof Error ? error.message : 'Erreur inconnue' });
          errorCount++;
        }
      }
      
      // Prevent running setTimeout on every single line, which slows down execution significantly.
      // Instead, we only yield occasionally based on progress.
      const shouldYield = (i % 250 === 0) || (totalLines < 250 && i % Math.max(1, Math.floor(totalLines / 10)) === 0) || i === totalLines - 1;
      if (shouldYield) {
        const currentPercent = Math.min(100, Math.round(((i + 1) / totalLines) * 100));
        setImportProgress(currentPercent);
        if (errors.length > 0) {
          setImportErrors([...errors]);
        }
        // Small yield so the DOM has a chance to repaint the progress bar
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
    
    if (upsertQueue.length > 0) {
      const sanitizeProductForSupabase = (p: Product) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode || null,
        sku: p.sku || null,
        price: p.price ?? 0,
        cost_price: p.costPrice ?? 0,
        stock: p.stock ?? 0,
        category_id: p.categoryId || 'uncategorized',
        status: p.status || 'active',
        unit: p.unit || 'unité',
        tax_rate: p.taxRate ?? 0,
        min_stock: p.minStock ?? 0,
        supplier: p.supplier || null,
        created_at: p.createdAt || new Date().toISOString(),
        updated_at: p.updatedAt || new Date().toISOString()
      });

      const payloads = upsertQueue.map(sanitizeProductForSupabase);
      const { error: upsertErr } = await supabase
        .from('products')
        .upsert(payloads, { onConflict: 'id' });
      if (upsertErr) throw upsertErr;

      upsertQueue.forEach(item => {
        window.dispatchEvent(new CustomEvent('product-cache-update', { detail: item }));
      });
    }
    
    setImportProgress(100);
    setImportErrors([...errors]);
    setIsProcessing(false);

    if (errorCount === 0) {
      toast.success(`Importation réussie de ${importedCount} produits !`);
      setTimeout(() => {
        setIsImportModalOpen(false);
      }, 1200);
    } else {
      toast.warning(`Importation terminée : ${importedCount} importés, ${errorCount} lignes ignorées (voir détails).`);
    }
  };

  const handleCSVExport = () => {
    const headers = ['name', 'price', 'costPrice', 'stock', 'category', 'sku', 'unit'];
    const csvContent = [
      headers.join(','),
      ...products.map((p: Product) => [
        `"${p.name}"`,
        p.price,
        p.costPrice || 0,
        p.stock,
        `"${p.categoryId || ''}"`,
        `"${p.sku || ''}"`,
        `"${p.unit || 'unité'}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'inventaire.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintLabel = (product: Product) => {
    printLabels([product], settings);
  };



  const printQuickLabel = (product: Product) => {
    printLabels([product], settings);

    

  };

  return (
    <div className="space-y-4">
      {/* En-tête Compacte & Réorganisée */}
      <div className="bg-white/5 backdrop-blur-md p-6 rounded-[2rem] border border-white/10 shadow-2xl space-y-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32 transition-colors group-hover:bg-indigo-500/10" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-6">
            <div>
              <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic">Inventory<span className="text-indigo-500">.nexus</span></h3>
              <div className="text-[10px] font-black text-white/40 flex items-center gap-2 uppercase tracking-[0.2em] mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {products.length} {t("Articles répertoriés")}
              </div>
            </div>
            <div className="h-10 w-px bg-white/10 mx-2 hidden sm:block" />
            <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
              {(['products', 'history', 'labels', 'sync', 'losses'] as const).map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setInventoryTab(tab)}
                  className={cn(
                    "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                    inventoryTab === tab ? "bg-indigo-600 text-white shadow-neon-indigo border border-indigo-400/50" : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                >
                  {tab === 'products' ? <Package size={14} /> : tab === 'history' ? <History size={14} /> : tab === 'labels' ? <Tag size={14} /> : tab === 'losses' ? <Trash2 size={14} /> : <RefreshCw size={14} />}
                  <span className="hidden sm:inline">{tab === 'products' ? 'Produits' : tab === 'history' ? 'Historique' : tab === 'labels' ? 'Étiquettes' : tab === 'losses' ? 'Pertes' : 'Sync'}</span>
                </button>
              ))}
            </div>

            {inventoryTab === 'products' && (
              <button 
                onClick={() => setIsPosSelectionMode(!isPosSelectionMode)}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border shadow-sm",
                  isPosSelectionMode ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                <LayoutGrid size={14} strokeWidth={3} />
                <span className="hidden lg:inline">Visibilité Caisse</span>
                <span className="lg:hidden text-[10px]">Caisse</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }} className="gap-2 px-4 shadow-md shadow-indigo-100">
              <Plus size={18} /> <span className="hidden sm:inline">Produit</span>
            </Button>
            <div className="h-6 w-px bg-slate-200 mx-1" />
            <Button variant="secondary" onClick={() => exportToExcel(products, 'inventaire')} className="p-2 bg-emerald-50 text-emerald-600 border-none hover:bg-emerald-100" title="Excel">
              <FileSpreadsheet size={18} />
            </Button>
            <label className="cursor-pointer" title="Importer CSV/Excel">
              <input type="file" accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" className="hidden" onChange={handleCSVImport} />
              <div className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                <Upload size={18} />
              </div>
            </label>
            <Button variant="secondary" onClick={generateLowStockOrder} disabled={isProcessing} className="p-2 bg-amber-50 text-amber-600 border-none" title="Commande Auto">
              <ShoppingBag size={18} />
            </Button>
          </div>
        </div>

        {inventoryTab === 'products' && (
          <div className="space-y-4">
            {duplicateSKUGroups.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-rose-900 uppercase tracking-tighter">Codes-barres en Double détectés !</p>
                      <p className="text-xs text-rose-600 font-bold">Il y a {duplicateSKUGroups.length} groupe(s) d'articles partageant le même code-barre.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={() => setIsDuplicateModalOpen(true)}
                      className="px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center gap-2 shadow-sm"
                    >
                      Détails
                    </Button>
                    <Button 
                      disabled={isAutoMerging}
                      onClick={handleAutoResolveAll}
                      className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-rose-200 flex items-center gap-2 border-none disabled:opacity-50"
                    >
                      {isAutoMerging ? <RefreshCw className="animate-spin" size={14} /> : <Zap size={14} fill="currentColor" />}
                      {isAutoMerging ? "Fusion..." : "Tout Fusionner Direct"}
                    </Button>
                  </div>
                </div>
                
                {isAutoMerging && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-black text-rose-600 uppercase tracking-widest">
                      <span>Traitement automatique...</span>
                      <span>{Math.round(autoMergeProgress)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-rose-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${autoMergeProgress}%` }}
                        className="h-full bg-rose-600"
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {isPosSelectionMode && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Info size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-indigo-900 uppercase tracking-tighter">Configuration de la Caisse</p>
                    <p className="text-xs text-indigo-600 font-bold">Cochez ou décochez les articles pour les afficher/masquer dans la grille de vente.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setConfirmAction({
                        title: "DÉCOCHER TOUS les produits",
                        message: "Voulez-vous DÉCOCHER TOUS les produits ? Ils ne seront plus visibles sur la caisse.",
                        onConfirm: async () => {
                          setConfirmAction(null);
                          setIsProcessing(true);
                          try {
                            const updatedAt = new Date().toISOString();
                            const { error } = await supabase
                              .from('products')
                              .update({ show_in_pos: false, updated_at: updatedAt })
                              .neq('show_in_pos', false);
                            if (error) throw error;
                            
                            products.forEach(p => {
                              if (p.showInPos !== false && p.id && p.id !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('product-cache-update', { 
                                  detail: { ...p, showInPos: false, updatedAt } 
                                }));
                              }
                            });
                            
                            toast.success("Tous les produits ont été décochés.");
                          } catch (error) {
                            console.error("Error unchecking all products:", error);
                            toast.error("Erreur lors de la mise à jour massive.");
                          } finally {
                            setIsProcessing(false);
                          }
                        }
                      });
                    }}
                    className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-md shadow-rose-100"
                  >
                    Tout Décocher
                  </button>
                  <button 
                    onClick={() => {
                      setConfirmAction({
                        title: "AFFICHER TOUS les produits",
                        message: "Afficher TOUS les produits dans la caisse ?",
                        onConfirm: async () => {
                          setConfirmAction(null);
                          setIsProcessing(true);
                          try {
                            const updatedAt = new Date().toISOString();
                            const { error } = await supabase
                              .from('products')
                              .update({ show_in_pos: true, updated_at: updatedAt })
                              .eq('show_in_pos', false);
                            if (error) throw error;
                            
                            products.forEach(p => {
                              if (p.showInPos === false && p.id && p.id !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('product-cache-update', { 
                                  detail: { ...p, showInPos: true, updatedAt } 
                                }));
                              }
                            });
                            
                            toast.success("Tous les produits sont maintenant visibles en caisse.");
                          } catch (error) {
                            console.error("Error checking all products:", error);
                            toast.error("Erreur lors de la mise à jour massive.");
                          } finally {
                            setIsProcessing(false);
                          }
                        }
                      });
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                  >
                    Tout Afficher
                  </button>
                </div>
              </motion.div>
            )}
            
            <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1 relative group w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={18} />
              <input 
                type="text"
                placeholder="Chercher par nom, SKU, fournisseur..."
                className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 text-sm font-bold text-white placeholder:text-white/20 transition-all uppercase tracking-wider"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "px-6 py-3.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all",
                  showFilters ? "bg-indigo-600 text-white border-indigo-400/50 shadow-neon-indigo" : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white"
                )}
              >
                <Filter size={18} /> Filtres
                {(selectedCategories.length > 0 || statusFilter !== 'all' || stockLevelFilter !== 'all') && (
                  <span className="w-2 h-2 bg-rose-500 rounded-full shadow-neon-cyan animate-pulse" />
                )}
              </button>
              <button 
                onClick={() => setIsScannerOpen(true)}
                className="p-3.5 bg-white/5 text-white/60 border border-white/10 rounded-2xl hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all shadow-lg"
                title="Scanner"
              >
                <Scan size={20} />
              </button>
              <button 
                onClick={() => {
                  if (selectedProductIds.length > 0) {
                    handleBulkDelete();
                  } else {
                    setIsMassDeleteConfirmOpen(true);
                  }
                }}
                className={cn(
                  "p-3.5 rounded-2xl border transition-all shadow-lg",
                  selectedProductIds.length > 0 
                    ? "bg-rose-600 text-white border-rose-500 hover:bg-rose-700 font-bold" 
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500 hover:text-white"
                )}
                title={selectedProductIds.length > 0 ? "Supprimer la sélection" : "Vider tout l'inventaire"}
              >
                <Trash2 size={20} />
              </button>
              <div className="h-8 w-px bg-white/10 mx-1" />
              <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
                <button onClick={() => setViewMode('list')} className={cn("p-2 rounded-xl transition-all", viewMode === 'list' ? "bg-white/10 text-white shadow-inner" : "text-white/20 hover:text-white/40")}>
                  <LayoutList size={20} />
                </button>
                <button onClick={() => setViewMode('grouped')} className={cn("p-2 rounded-xl transition-all", viewMode === 'grouped' ? "bg-white/10 text-white shadow-inner" : "text-white/20 hover:text-white/40")}>
                  <Layers size={20} />
                </button>
              </div>
            </div>
          </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showFilters && inventoryTab === 'products' && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 shadow-2xl space-y-8 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Truck size={14} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Fournisseur</span>
                  </div>
                  <select 
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-[1.25rem] outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 text-[11px] font-black uppercase tracking-widest text-white transition-all cursor-pointer appearance-none"
                  >
                    <option value="all" className="bg-nardo">Tous les fournisseurs</option>
                    {productSuppliers.map(s => (
                      <option key={s} value={s} className="bg-nardo">{s}</option>
                    ))}
                    <option value="Sans fournisseur" className="bg-nardo">Sans fournisseur</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown size={14} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Tri par</span>
                  </div>
                  <select 
                    value={sortConfig?.key || ''}
                    onChange={(e) => requestSort(e.target.value as keyof Product)}
                    className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-[1.25rem] outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 text-[11px] font-black uppercase tracking-widest text-white transition-all cursor-pointer appearance-none"
                  >
                    <option value="" className="bg-nardo">Sélectionner un tri</option>
                    <option value="name" className="bg-nardo">Désignation (A-Z)</option>
                    <option value="price" className="bg-nardo">Prix croissant</option>
                    <option value="margin" className="bg-nardo">Marge bénéficiaire (Profit)</option>
                    <option value="stock" className="bg-nardo">Stock disponible</option>
                    <option value="updatedAt" className="bg-nardo">Dernière modification</option>
                    <option value="createdAt" className="bg-nardo">Date de création</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Award size={14} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Marque</span>
                  </div>
                  <select 
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-[1.25rem] outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 text-[11px] font-black uppercase tracking-widest text-white transition-all cursor-pointer appearance-none"
                  >
                    <option value="all" className="bg-nardo">Toutes les marques</option>
                    {brands.map(b => (
                      <option key={b.id} value={b.id} className="bg-nardo">{b.name}</option>
                    ))}
                    <option value="none" className="bg-nardo">Sans marque</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Période</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date"
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-[1.25rem] text-[10px] font-black uppercase text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      value={dateRange.start}
                      onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    />
                    <span className="text-white/20 font-black">→</span>
                    <input 
                      type="date"
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-[1.25rem] text-[10px] font-black uppercase text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      value={dateRange.end}
                      onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/5" />

              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FolderTree size={16} className="text-indigo-400" />
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Catégories</span>
                    </div>
                    <button onClick={() => setSelectedCategories([])} className="text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors">Tout réinitialiser</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {categories.filter(c => !c.parentId).map((parent: Category) => {
                      const subs = categories.filter(c => c.parentId === parent.id);
                      const isParentSelected = selectedCategories.includes(parent.id);
                      const parentCount = categoryProductCounts[parent.id] || 0;
                      
                      return (
                        <div 
                          key={parent.id} 
                          className={cn(
                            "p-5 rounded-[1.5rem] border transition-all duration-300 flex flex-col justify-between space-y-4",
                            isParentSelected 
                              ? "bg-indigo-600/10 border-indigo-500/35 ring-1 ring-indigo-500/25 shadow-[0_0_20px_rgba(99,102,241,0.05)]" 
                              : "bg-white/[0.02] border-white/5 hover:border-indigo-500/15"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => toggleCategory(parent.id)}
                              className="flex items-center gap-2 text-left group"
                            >
                              <FolderTree 
                                size={14} 
                                className={cn(
                                  "transition-colors",
                                  isParentSelected ? "text-indigo-400" : "text-white/40 group-hover:text-white/60"
                                )} 
                              />
                              <div className="flex flex-col">
                                <span className={cn(
                                  "text-[11px] font-black uppercase tracking-wider transition-colors",
                                  isParentSelected ? "text-white" : "text-white/70 group-hover:text-white"
                                )}>
                                  {parent.name}
                                </span>
                                <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-0.5">
                                  {parentCount} article{parentCount > 1 ? 's' : ''}
                                </span>
                              </div>
                            </button>
                            
                            <input 
                              type="checkbox"
                              checked={isParentSelected}
                              onChange={() => toggleCategory(parent.id)}
                              className="w-4 h-4 rounded text-indigo-600 bg-white/5 border-white/10 focus:ring-indigo-500 cursor-pointer"
                            />
                          </div>

                          {subs.length > 0 && (
                            <div className="pt-3 border-t border-white/5 flex flex-wrap gap-1.5">
                              {subs.map((sub: Category) => {
                                const isSubSelected = selectedCategories.includes(sub.id);
                                const subCount = categoryProductCounts[sub.id] || 0;
                                return (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    onClick={() => toggleCategory(sub.id)}
                                    className={cn(
                                      "px-3 py-1.5 rounded-[0.8rem] text-[9px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5",
                                      isSubSelected
                                        ? "bg-indigo-500/25 text-indigo-300 border-indigo-500/40 shadow-sm"
                                        : "bg-white/[0.02] text-white/40 border-white/5 hover:border-white/15 hover:text-white"
                                    )}
                                  >
                                    <span>{sub.name}</span>
                                    <span className="text-[8px] font-bold opacity-60">({subCount})</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* Non classés Card */}
                    <div 
                      className={cn(
                        "p-5 rounded-[1.5rem] border transition-all duration-300 flex items-center justify-between",
                        selectedCategories.includes('uncategorized')
                          ? "bg-rose-500/10 border-rose-500/35 ring-1 ring-rose-500/25 shadow-[0_0_20px_rgba(239,68,68,0.05)]" 
                          : "bg-white/[0.02] border-white/5 hover:border-rose-500/15"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCategory('uncategorized')}
                        className="flex items-center gap-2 text-left group"
                      >
                        <AlertCircle 
                          size={14} 
                          className={cn(
                            "transition-colors",
                            selectedCategories.includes('uncategorized') ? "text-rose-400" : "text-rose-400/40 group-hover:text-rose-400/60"
                          )} 
                        />
                        <div className="flex flex-col">
                          <span className={cn(
                            "text-[11px] font-black uppercase tracking-wider transition-colors",
                            selectedCategories.includes('uncategorized') ? "text-white" : "text-white/70 group-hover:text-white"
                          )}>
                            Sans Catégorie
                          </span>
                          <span className="text-[9px] font-bold text-rose-400/50 uppercase tracking-widest mt-0.5">
                            {categoryProductCounts['uncategorized'] || 0} article{(categoryProductCounts['uncategorized'] || 0) > 1 ? 's' : ''}
                          </span>
                        </div>
                      </button>
                      <input 
                        type="checkbox"
                        checked={selectedCategories.includes('uncategorized')}
                        onChange={() => toggleCategory('uncategorized')}
                        className="w-4 h-4 rounded text-rose-600 bg-white/5 border-white/10 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <TrendingDown size={14} className="text-indigo-400" />
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">État Stocks</span>
                    </div>
                    <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 h-fit">
                      {(['all', 'low', 'out'] as const).map((level) => (
                        <button 
                          key={level}
                          onClick={() => setStockLevelFilter(level)}
                          className={cn(
                            "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            stockLevelFilter === level
                              ? "bg-white/10 text-white shadow-inner" 
                              : "text-white/40 hover:text-white/60"
                          )}
                        >
                          {level === 'all' ? 'Tous' : level === 'low' ? 'Faible' : 'Rupture'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-indigo-400" />
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Statut</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {(['all', 'active', 'inactive', 'discontinued'] as const).map((status) => (
                        <button 
                          key={status}
                          onClick={() => setStatusFilter(status)}
                          className={cn(
                            "whitespace-nowrap px-5 py-2.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all border",
                            statusFilter === status
                              ? "bg-indigo-600 text-white border-indigo-400/50 shadow-neon-indigo" 
                              : "bg-white/5 text-white/40 border-white/5 hover:text-white"
                          )}
                        >
                          {status === 'all' ? 'Tous' : status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <LayoutGrid size={14} className="text-indigo-400" />
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Caisse (POS)</span>
                    </div>
                    <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 h-fit">
                      {(['all', 'visible', 'hidden'] as const).map((v) => (
                        <button 
                          key={v}
                          onClick={() => setPosVisibilityFilter(v)}
                          className={cn(
                            "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            posVisibilityFilter === v
                              ? "bg-white/10 text-white shadow-inner" 
                              : "text-white/40 hover:text-white/60"
                          )}
                        >
                          {v === 'all' ? 'Tous' : v === 'visible' ? 'Visibles' : 'Masqués'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col justify-end">
                    <Button 
                      variant="ghost" 
                      className="w-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/10 hover:bg-white/5 py-6 rounded-[1.25rem]"
                      onClick={() => {
                        setSearch('');
                        setSelectedSupplier('all');
                        setSelectedBrand('all');
                        setSelectedCategories([]);
                        setStatusFilter('all');
                        setStockLevelFilter('all');
                        setPosVisibilityFilter('all');
                        setDateRange({ start: '', end: '' });
                      }}
                    >
                      <RotateCcw size={14} className="mr-3" /> Reset
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {inventoryTab === 'products' ? (
        <>
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
              onClose={() => {
                setPriceCheckResult(null);
                setIsPriceCheckerOpen(false);
              }} 
              title="Vérificateur de Prix"
              className="max-w-md"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-6 bg-white/5 rounded-3xl border border-white/10 shadow-2xl">
                  <div className="w-20 h-20 bg-black/40 rounded-2xl flex items-center justify-center border border-white/10 overflow-hidden shadow-inner">
                    {priceCheckResult.imageUrl ? (
                      <img src={priceCheckResult.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Package className="text-white/10" size={32} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-white text-lg truncate uppercase tracking-widest leading-tight">{priceCheckResult.name}</h4>
                    <p className="text-[10px] font-black font-mono text-indigo-400 mt-1 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-full inline-block">SKU: {priceCheckResult.sku}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-emerald-500/5 rounded-3xl border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <ShoppingCart size={12} /> Vente
                    </p>
                    <p className="text-3xl font-black text-white tracking-tighter tabular-nums">{priceCheckResult.price.toFixed(2)} <span className="text-xs text-emerald-400 uppercase tracking-widest ml-1">{settings.currency}</span></p>
                  </div>
                  <div className="p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <Package size={12} /> Stock
                    </p>
                    <p className="text-3xl font-black text-white tracking-tighter tabular-nums">{priceCheckResult.stock} <span className="text-xs text-indigo-400 uppercase tracking-widest ml-1">{priceCheckResult.unit}</span></p>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button 
                    onClick={() => {
                      setEditingProduct(priceCheckResult);
                      setPriceCheckResult(null);
                      setIsProductModalOpen(true);
                    }}
                    className="flex-1 py-5 industrial-button-primary rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] active:scale-95"
                  >
                    Modifier
                  </Button>
                  <Button 
                    onClick={() => setPriceCheckResult(null)}
                    variant="secondary"
                    className="flex-1 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] active:scale-95"
                  >
                    Fermer
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {viewMode === 'list' ? (
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
               <div className="flex-1 min-h-[600px] h-[calc(100vh-320px)] bg-black/10 rounded-[3rem] border border-white/5 relative overflow-hidden backdrop-blur-sm group/catalog">
                {sortedProducts.length > 0 ? (
                  <div className="virtual-catalog-container flex flex-col h-full min-h-0 pt-4 pb-4">
                    {isMobile ? (
                      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 custom-scrollbar pb-24">
                        {paginatedProducts.map((product) => (
                          <ProductMobileCard
                            key={product.id}
                            product={product}
                            settings={settings}
                            brands={brands}
                            categories={categories}
                            isPosSelectionMode={isPosSelectionMode}
                            selectedProductIds={selectedProductIds}
                            onToggleSelect={() => toggleSelectProduct(product.id)}
                            onEdit={() => { setEditingProduct(product); setIsProductModalOpen(true); }}
                            onAdjust={() => { setSelectedProductForAdjustment(product); setIsAdjustmentModalOpen(true); }}
                            onDelete={() => handleDelete(product.id)}
                            onHistory={() => { setViewingHistoryProduct(product); setIsProductHistoryModalOpen(true); setHistoryTab('sales'); }}
                            onPrint={() => printQuickLabel(product)}
                            onCopy={() => { setEditingProduct({...product, id: undefined, name: product.name + " (Copie)"}); setIsProductModalOpen(true); }}
                            isDeleting={isDeletingId === product.id}
                          />
                        ))}
                      </div>
                    ) : (
                      <>
                        {/* Unified Virtualized Catalog Ready */}
                        <div className="flex items-center gap-6 px-10 mb-4 text-[10px] font-black uppercase tracking-widest text-white/40">
                           <div className="w-10"></div>
                           <div className="w-14">Image</div>
                           <div className="flex-1 cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('name')}>Nom du Produit</div>
                           <div className="w-48 hidden xl:block">Catégorie / Fns</div>

                           <div className="w-24 flex flex-col items-end gap-1">
                             <div className="cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('margin')}>Prix / Marge</div>
                             <button 
                               onClick={() => setShowMarginExtremes(!showMarginExtremes)}
                               className={cn("text-[9px] px-2 py-0.5 rounded border transition-all", showMarginExtremes ? "bg-indigo-500/50 text-white border-indigo-400" : "bg-white/5 text-white/30 border-white/10")}
                             >
                               Extrêmes
                             </button>
                           </div>
                           <div className="w-32 text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('stock')}>Stock</div>
                        </div>
                        {/* @ts-ignore */}
                        <List
                          style={{ height: '100%', width: '100%' }}
                          rowCount={paginatedProducts.length}
                          rowHeight={104}
                          rowComponent={ProductRow as any}
                          rowProps={{ sortedProducts: paginatedProducts } as any}
                          className="custom-scrollbar py-0"
                        />
                      </>
                    )}
                    
                    <div className="flex justify-center items-center gap-6 p-4 border-t border-white/5">
                      <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        className="p-3 bg-white/5 disabled:opacity-30 text-white rounded-xl hover:bg-white/10 transition-all"
                      >
                         <ChevronLeft size={20} />
                      </button>
                      <span className="text-white/60 text-xs font-black tracking-widest uppercase">Page {currentPage} / {totalPages || 1}</span>
                      <button 
                         disabled={currentPage === totalPages || totalPages === 0}
                         onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                         className="p-3 bg-white/5 disabled:opacity-30 text-white rounded-xl hover:bg-white/10 transition-all"
                      >
                         <ChevronRight size={20} />
                      </button>
                    </div>
                    
                    {/* Floating Stats Badge */}
                    <div className="absolute bottom-6 left-6 px-4 py-2 bg-indigo-600/90 backdrop-blur-md rounded-2xl border border-indigo-400/50 shadow-2xl flex items-center gap-3 transition-all duration-500 hover:scale-105 active:scale-95 group-hover/catalog:translate-y-0 translate-y-20">
                      <Package size={14} className="text-white" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">
                        {sortedProducts.length} PRODUITS CHARGÉS
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-20 text-center flex flex-col items-center justify-center h-full">
                    <Package size={64} className="opacity-10 mb-6" />
                    <p className="text-white/30 font-black uppercase tracking-[0.2em]">{t("Aucun produit trouvé")}</p>
                    <p className="text-white/10 text-[10px] uppercase mt-2 tracking-widest italic leading-relaxed">Vérifiez vos filtres ou effectuez une nouvelle recherche</p>
                  </div>
                )}
               </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8">
              {(Object.entries(productsBySupplier) as [string, Product[]][]).map(([supplier, supplierProducts]) => {
                const totalStock = supplierProducts.reduce((sum, p) => sum + p.stock, 0);
                const totalValue = supplierProducts.reduce((sum, p) => sum + (p.stock * p.price), 0);
                const lowStockCount = supplierProducts.filter(p => p.stock <= (p.minStock || 5)).length;

                return (
                  <div key={supplier} className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                          <Truck size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-lg">{supplier}</h4>
                          <p className="text-xs text-white/40">{supplierProducts.length} produits référencés</p>
                        </div>
                      </div>
                      <div className="flex gap-6 text-right">
                        <div>
                          <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Articles Totaux</p>
                          <p className="text-sm font-bold text-white">{totalStock}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Valeur Stock</p>
                          <p className="text-sm font-bold text-emerald-400">{totalValue.toFixed(2)} {settings.currency}</p>
                        </div>
                        {lowStockCount > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-rose-400 dark:text-rose-500 uppercase tracking-wider">Alertes</p>
                            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{lowStockCount}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Card className="overflow-hidden overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                          <tr className="bg-white/5 border-bottom border-white/5">
                            <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Produit</th>
                            <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Stock</th>
                            <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Prix Unitaire</th>
                            <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Valeur Totale</th>
                            <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {supplierProducts.map(p => (
                            <tr key={p.id} className="hover:bg-white/5 transition-colors">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded bg-black/20 flex items-center justify-center overflow-hidden border border-white/10">
                                    {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Package size={16} className="text-white/20" />}
                                  </div>
                                  {isPosSelectionMode && (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!p || !p.id) return;
                                        try {
                                          const newShowInPos = p.showInPos === false ? true : false;
                                          const updatedProduct = {
                                            ...p,
                                            showInPos: newShowInPos,
                                            updatedAt: new Date().toISOString()
                                          };
                                          
                                          // Optimistic update
                                          window.dispatchEvent(new CustomEvent('product-cache-update', { detail: updatedProduct }));
                                          
                                          await supabase.from('products').update({
                                            show_in_pos: newShowInPos,
                                            updated_at: updatedProduct.updatedAt
                                          }).eq('id', p.id);
                                        } catch (error) {
                                          console.error("Error toggling POS visibility:", error);
                                        }
                                      }}
                                      className={cn(
                                        "flex-shrink-0 w-6 h-6 rounded bg-slate-100 border transition-all flex items-center justify-center",
                                        p.showInPos === false 
                                          ? "border-slate-200 text-transparent" 
                                          : "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                                      )}
                                    >
                                      <Check size={10} strokeWidth={4} />
                                    </button>
                                  )}
                                  <span className="text-sm font-medium text-white">{p.name}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className={cn("text-sm font-bold", p.stock <= (p.minStock || 5) ? "text-rose-400" : "text-white/60")}>
                                  {p.stock} {p.unit}
                                </span>
                              </td>
                              <td className="p-4 text-sm text-white/40">{p.price.toFixed(2)} {settings.currency}</td>
                              <td className="p-4 text-sm font-bold text-white">{(p.stock * p.price).toFixed(2)} {settings.currency}</td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => { setViewingHistoryProduct(p); setIsProductHistoryModalOpen(true); setHistoryTab('sales'); }}
                                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                                    title="Historique du produit"
                                  >
                                    <History size={16} />
                                  </button>
                                  <button 
                                    onClick={() => { setSelectedProductForAdjustment(p); setIsAdjustmentModalOpen(true); }}
                                    className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                    title="Ajuster le stock"
                                  >
                                    <RefreshCw size={16} />
                                  </button>
                                  <button 
                                    onClick={() => printQuickLabel(p)}
                                    className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                    title="Impression Rapide"
                                  >
                                    <Printer size={16} />
                                  </button>
                                  <button onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }} className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Modifier">
                                    <Edit size={16} />
                                  </button>
                                  <button 
                                    disabled={isDeletingId === p.id}
                                    onClick={async () => {
                                      setIsDeletingId(p.id);
                                      try {
                                        await handleDelete(p.id);
                                      } finally {
                                        setIsDeletingId(null);
                                      }
                                    }} 
                                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors disabled:opacity-50"
                                    title="Supprimer"
                                  >
                                    {isDeletingId === p.id ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : inventoryTab === 'history' ? (
        <StockHistory adjustments={stockAdjustments} products={products} user={user} />
      ) : inventoryTab === 'labels' ? (
        <div className="space-y-4">
          <LabelPrinter products={products} settings={settings} initialSelectedProductIds={selectedProductIds} />
        </div>
      ) : inventoryTab === 'losses' ? (
        <LossReport 
          damagedRecords={damagedRecords} 
          products={products} 
          categories={categories}
          onPrintReport={(records) => {
            // Basic print functionality
            window.print();
          }}
        />
      ) : (
        <div className="space-y-4">
          <SupplierSyncManager supplierSyncs={supplierSyncs} suppliers={allSuppliers} products={products} />
          
          <div className="mt-8 p-6 bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-white font-bold mb-1">Restauration Complète</h3>
              <p className="text-slate-400 text-sm">Si vous rencontrez des problèmes d'affichage ou que certains produits semblent manquer, forcez une récupération depuis le cloud.</p>
            </div>
            <button
              onClick={() => {
                setConfirmAction({
                  title: "Restauration Complète",
                  message: "Êtes-vous sûr de vouloir forcer la récupération de vos produits depuis le cloud ? Cela peut prendre plusieurs minutes en fonction de votre connexion.",
                  onConfirm: () => {
                    localStorage.setItem('nexus_products_last_sync', '2000-01-01T00:00:00Z');
                    window.location.reload();
                  }
                });
              }}
              className="bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white px-4 py-2 rounded-xl transition-colors font-bold whitespace-nowrap"
            >
              Forcer la Synchronisation
            </button>
          </div>
        </div>
      )}

      <StockAdjustmentModal 
        isOpen={isAdjustmentModalOpen}
        onClose={() => { setIsAdjustmentModalOpen(false); setSelectedProductForAdjustment(null); }}
        product={selectedProductForAdjustment}
        user={user}
        settings={settings}
      />

      {isDuplicateModalOpen && (
        <DuplicateSKUModal
          isOpen={isDuplicateModalOpen}
          onClose={() => setIsDuplicateModalOpen(false)}
          groups={duplicateSKUGroups}
          onEdit={(p) => {
            setEditingProduct(p);
            setIsProductModalOpen(true);
            setIsDuplicateModalOpen(false);
          }}
          onDelete={(id) => {
            handleDelete(id);
          }}
          onMerge={async (group) => {
            const [mainProduct, ...others] = group.products;
            const totalStock = group.products.reduce((acc, p) => acc + (p.stock || 0), 0);
            
            try {
              if (!mainProduct || !mainProduct.id) {
                throw new Error("Produit principal sans ID valide.");
              }
              const updatedAt = new Date().toISOString();
              const updatedMainProductData = {
                ...mainProduct,
                stock: totalStock,
                updatedAt: updatedAt
              };
              
              // Update main product stock in Supabase
              const { error: updErr } = await supabase
                .from('products')
                .update({ stock: totalStock, updated_at: updatedAt })
                .eq('id', mainProduct.id);
              if (updErr) throw updErr;

              // Delete duplicate products from Supabase
              const otherIds = others.map(other => other.id);
              if (otherIds.length > 0) {
                const { error: delErr } = await supabase
                  .from('products')
                  .delete()
                  .in('id', otherIds);
                if (delErr) throw delErr;
              }
              
              window.dispatchEvent(new CustomEvent('product-cache-update', { detail: updatedMainProductData }));
              others.forEach(other => {
                window.dispatchEvent(new CustomEvent('product-cache-delete', { detail: { id: other.id } }));
              });
              logAction(user.uid, user.displayName || 'Utilisateur', 'Fusion Doublons', 'Inventaire', `Fusion de ${others.length + 1} articles pour le SKU: ${group.sku}`);
            } catch (error) {
              console.error("Duplicate resolver failed:", error);
              throw error; // Re-throw to ensure the parent can track success/failure
            }
          }}
          settings={settings}
        />
      )}

      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        headers={csvHeaders} 
        data={importPreviewData}
        onConfirm={executeImport} 
        isProcessing={isProcessing}
        progress={importProgress}
        errors={importErrors}
      />

      {selectedProductForLabel && (
        <Modal 
          isOpen={true} 
          onClose={() => setSelectedProductForLabel(null)} 
          title={`Impression Rapide - ${selectedProductForLabel.name}`}
          maxWidth="max-w-md"
        >
        </Modal>
      )}


      {/* Bulk category / brand update modal */}
      {isBulkUpdateModalOpen && (
        <Modal 
          isOpen={isBulkUpdateModalOpen} 
          onClose={() => setIsBulkUpdateModalOpen(false)} 
          title="CLASSIFICATION / MARQUAGE GROUPÉ"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-6 p-2">
            <div className="p-5 bg-indigo-500/10 rounded-[2rem] border border-indigo-500/20 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-lg shrink-0">
                {selectedProductIds.length}
              </div>
              <div>
                <h5 className="font-black text-white text-sm tracking-wider uppercase">Changement groupé</h5>
                <p className="text-xs text-indigo-200/60 mt-1 uppercase tracking-widest font-bold">
                  Vous allez modifier la catégorie ou la marque de {selectedProductIds.length} articles sélectionnés.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Category Section */}
              <div className={cn(
                "p-6 rounded-[2rem] border transition-all duration-300",
                bulkUpdateCategory 
                  ? "bg-indigo-500/5 border-indigo-500/20" 
                  : "bg-white/[0.02] border-white/5 opacity-60"
              )}>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 text-indigo-600 rounded-lg focus:ring-indigo-500 bg-white/10 border-white/20"
                    checked={bulkUpdateCategory}
                    onChange={(e) => setBulkUpdateCategory(e.target.checked)}
                  />
                  <span className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <FolderTree size={16} className="text-indigo-400" />
                    Mettre à jour la Catégorie / Sous-catégorie
                  </span>
                </label>

                {bulkUpdateCategory && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Catégorie Principale</label>
                      <select 
                        className="w-full bg-slate-950 border border-white/10 text-white rounded-xl p-3 text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500" 
                        value={bulkParentCatId} 
                        onChange={e => { setBulkParentCatId(e.target.value); setBulkSubCatId(''); }}
                      >
                        <option value="" className="bg-slate-900">Aucune / Sélectionner</option>
                        {categories.filter(c => !c.parentId).map((c: any) => (
                          <option key={c.id} value={c.id} className="bg-slate-900">
                            {c.name.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1 text-indigo-400">Sous-catégorie</label>
                      <select 
                        className={cn(
                          "w-full bg-slate-950 border text-white rounded-xl p-3 text-xs font-black uppercase tracking-widest outline-none disabled:opacity-30 focus:ring-2 focus:ring-indigo-500",
                          bulkParentCatId ? "border-indigo-500/50" : "border-white/10"
                        )}
                        value={bulkSubCatId} 
                        disabled={!bulkParentCatId}
                        onChange={e => setBulkSubCatId(e.target.value)}
                      >
                        <option value="" className="bg-slate-900">Aucune / Sélectionner</option>
                        {categories.filter(c => c.parentId === bulkParentCatId).map((c: any) => (
                          <option key={c.id} value={c.id} className="bg-slate-900">
                            {c.name.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Brand Section */}
              <div className={cn(
                "p-6 rounded-[2rem] border transition-all duration-300",
                bulkUpdateBrand 
                  ? "bg-indigo-500/5 border-indigo-500/20" 
                  : "bg-white/[0.02] border-white/5 opacity-60"
              )}>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 text-indigo-600 rounded-lg focus:ring-indigo-500 bg-white/10 border-white/20"
                    checked={bulkUpdateBrand}
                    onChange={(e) => setBulkUpdateBrand(e.target.checked)}
                  />
                  <span className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Tag size={16} className="text-indigo-400" />
                    Mettre à jour la Marque
                  </span>
                </label>

                {bulkUpdateBrand && (
                  <div className="space-y-3 mt-6">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Marque cible</label>
                    <select 
                      className="w-full bg-slate-950 border border-white/10 text-white rounded-xl p-3 text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500" 
                      value={bulkBrandId} 
                      onChange={e => setBulkBrandId(e.target.value)}
                    >
                      <option value="" className="bg-slate-900">Aucune marque (Dissocier)</option>
                      {brands.map((b: any) => (
                        <option key={b.id} value={b.id} className="bg-slate-900">
                          {b.name.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 flex gap-4">
              <button 
                onClick={() => setIsBulkUpdateModalOpen(false)}
                className="flex-1 py-4 text-white/40 hover:text-white text-[10px] uppercase font-black tracking-widest bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5"
              >
                Annuler
              </button>
              <button 
                onClick={handleBulkUpdate}
                disabled={isMassUpdating || (!bulkUpdateCategory && !bulkUpdateBrand)}
                className="flex-1 py-4 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none shadow-lg shadow-indigo-600/10"
              >
                {isMassUpdating ? (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin" />
                    Mise à jour...
                  </div>
                ) : (
                  "Valider le changement"
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Modal isOpen={isPurchaseHistoryModalOpen} onClose={() => setIsPurchaseHistoryModalOpen(false)} title="Historique des Achats">
        <div className="space-y-4">
          {purchases.filter(p => p.items.some(item => item.productId === editingProduct?.id)).map(p => (
            <div key={p.id} className="p-4 border border-slate-200 rounded-lg flex justify-between items-center">
              <div>
                <p className="font-bold">{format(new Date(p.date), 'dd/MM/yyyy')}</p>
                <p className="text-sm text-slate-500">{p.supplierName}</p>
              </div>
              <Button onClick={() => { 
                setIsPurchaseHistoryModalOpen(false);
                setActiveTab('purchases');
                // Potential logic to select/highlight the purchase order
              }}>Voir</Button>
            </div>
          ))}
        </div>
      </Modal>

      <Modal isOpen={isSalesHistoryModalOpen} onClose={() => setIsSalesHistoryModalOpen(false)} title="Historique des Ventes">
        <div className="space-y-4">
          {transactions.filter(t => t.items.some(item => item.id === editingProduct?.id)).map(t => (
            <div key={t.id} className="p-4 border border-slate-200 rounded-lg flex justify-between items-center">
              <div>
                <p className="font-bold">{format(new Date(t.timestamp), 'dd/MM/yyyy')}</p>
                <p className="text-sm text-slate-500">{t.customerName || 'Client inconnu'}</p>
              </div>
              <Button onClick={() => { 
                setIsSalesHistoryModalOpen(false);
                setActiveTab('pos');
                // Potential logic to select/highlight the cart/sale
              }}>Voir</Button>
            </div>
          ))}
        </div>
      </Modal>

      <ProductFormModal 
        isOpen={isProductModalOpen}
        onClose={() => { setIsProductModalOpen(false); setEditingProduct(null); }}
        editingProduct={editingProduct}
        products={products}
        categories={categories}
        brands={brands}
        settings={settings}
        user={user}
        setIsPurchaseHistoryModalOpen={setIsPurchaseHistoryModalOpen}
        setIsSalesHistoryModalOpen={setIsSalesHistoryModalOpen}
        setActiveTab={setActiveTab}
      />

      <ConfirmDialog 
        isOpen={isDeleteConfirmOpen}
        onClose={() => { setIsDeleteConfirmOpen(false); setProductToDelete(null); }}
        onConfirm={confirmDelete}
        title="Supprimer le produit"
        message="Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible."
        confirmText="Supprimer"
        variant="danger"
      />

      {/* Custom Confirmation Modal for Auto-Resolve */}
      <Modal 
        isOpen={!!confirmAction} 
        onClose={() => setConfirmAction(null)} 
        title={confirmAction?.title || "Confirmation"}
      >
        <div className="space-y-4">
          <p className="text-sm font-medium text-slate-600 leading-relaxed text-center py-4">
            {confirmAction?.message}
          </p>
          <div className="flex gap-3">
            <Button 
              variant="secondary" 
              className="flex-1 rounded-xl h-12 text-sm font-bold" 
              onClick={() => setConfirmAction(null)}
            >
              Annuler
            </Button>
            <Button 
              className="flex-1 rounded-xl h-12 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100" 
              onClick={() => confirmAction?.onConfirm()}
            >
              Continuer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Image Zoom Modal */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setEnlargedImage(null)}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative max-w-4xl max-h-full"
          >
            <img 
              src={enlargedImage} 
              className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain" 
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-slate-300 transition-colors"
            >
              <X size={32} />
            </button>
          </motion.div>
        </div>
      )}

      <Modal 
        isOpen={isProductHistoryModalOpen} 
        onClose={() => setIsProductHistoryModalOpen(false)} 
        title={`Historique du produit: ${viewingHistoryProduct?.name}`}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5 w-fit">
            {[
              { id: 'sales', label: 'Ventes', icon: ShoppingCart },
              { id: 'purchases', label: 'Achats', icon: ShoppingBag },
              { id: 'price', label: 'Prix & Coût', icon: History },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setHistoryTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all",
                  historyTab === tab.id 
                    ? "bg-white/10 text-white shadow-inner ring-1 ring-white/5" 
                    : "text-white/30 hover:text-white/60 hover:bg-white/5"
                )}
              >
                <tab.icon size={14} className={cn(historyTab === tab.id ? "text-indigo-400" : "")} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {historyTab === 'sales' && (
              <div className="space-y-3">
                {transactions.filter(t => t.items.some(i => i.id === viewingHistoryProduct?.id)).length > 0 ? (
                  transactions.filter(t => t.items.some(i => i.id === viewingHistoryProduct?.id))
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((t) => {
                      const item = t.items.find(i => i.id === viewingHistoryProduct?.id);
                      return (
                        <div key={t.id} className="p-6 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-between hover:bg-white/10 hover:border-indigo-500/30 transition-all group shadow-xl">
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-lg shadow-indigo-500/5">
                              <ShoppingCart size={24} />
                            </div>
                            <div>
                               <div className="flex items-center gap-3">
                                 <p className="font-black text-white italic uppercase text-xs tracking-widest">Vente #{t.id.slice(-8).toUpperCase()}</p>
                                 <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase rounded border border-emerald-500/20">Payé</span>
                               </div>
                              <p className="text-[10px] font-medium text-white/40 mt-1">{format(new Date(t.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mt-2 bg-indigo-500/5 px-2 py-0.5 rounded-full inline-block">Client: {t.customerName || 'Client anonyme'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-white tabular-nums">{item?.quantity} <span className="text-[10px] text-white/30 uppercase ml-1">{viewingHistoryProduct?.unit}</span></p>
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">P.U: {item?.price.toFixed(2)} {settings.currency}</p>
                            <p className="text-sm font-black text-emerald-400 mt-2 tracking-tighter shadow-emerald-500/20 shadow-sm px-3 py-1 bg-emerald-500/10 rounded-full inline-block">Total: {((item?.quantity || 0) * (item?.price || 0)).toFixed(2)} {settings.currency}</p>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShoppingCart size={32} />
                    </div>
                    <p className="text-slate-400 font-medium">Aucune vente enregistrée pour ce produit</p>
                  </div>
                )}
              </div>
            )}

            {historyTab === 'purchases' && (
              <div className="space-y-3">
                {purchases.filter(p => p.items.some(i => i.productId === viewingHistoryProduct?.id)).length > 0 ? (
                  purchases.filter(p => p.items.some(i => i.productId === viewingHistoryProduct?.id))
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((p) => {
                      const item = p.items.find(i => i.productId === viewingHistoryProduct?.id);
                      return (
                        <div 
                          key={p.id} 
                          onClick={() => setViewingPurchaseVoucher(p)}
                          className="p-6 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-between hover:bg-white/10 hover:border-amber-500/30 transition-all cursor-pointer group shadow-xl"
                        >
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-lg shadow-amber-500/5">
                              <ShoppingBag size={24} />
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <p className="font-black text-white italic uppercase text-xs tracking-widest">Achat - {p.supplierName}</p>
                                <Eye size={14} className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <p className="text-[10px] font-medium text-white/40 mt-1">{format(new Date(p.date), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                              {p.invoiceNumber && <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mt-2 bg-indigo-500/5 px-2 py-0.5 rounded-full inline-block">Fiche: {p.invoiceNumber}</p>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-white tabular-nums">+{item?.quantity} <span className="text-[10px] text-white/30 uppercase ml-1">{viewingHistoryProduct?.unit}</span></p>
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">Coût: {item?.costPrice.toFixed(2)} {settings.currency}</p>
                            <p className="text-sm font-black text-amber-400 mt-2 tracking-tighter shadow-amber-500/20 shadow-sm px-3 py-1 bg-amber-500/10 rounded-full inline-block">Total: {((item?.quantity || 0) * (item?.costPrice || 0)).toFixed(2)} {settings.currency}</p>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShoppingBag size={32} />
                    </div>
                    <p className="text-slate-400 font-medium">Aucun achat enregistré pour ce produit</p>
                  </div>
                )}
              </div>
            )}

            {historyTab === 'price' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 pl-1">Prix de vente actuel</p>
                    <p className="text-3xl font-black text-white tabular-nums">{(viewingHistoryProduct?.price || 0).toFixed(2)} <span className="text-xs text-emerald-400 font-black uppercase tracking-widest ml-1">{settings.currency}</span></p>
                  </div>
                  <div className="text-right relative z-10">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 pr-1">Coût d'achat actuel</p>
                    <p className="text-3xl font-black text-white tabular-nums">{(viewingHistoryProduct?.costPrice || 0).toFixed(2)} <span className="text-xs text-rose-400 font-black uppercase tracking-widest ml-1">{settings.currency}</span></p>
                  </div>
                </div>

                <div className="space-y-3 pr-1">
                  {viewingHistoryProduct?.priceHistory && viewingHistoryProduct.priceHistory.length > 0 ? (
                    viewingHistoryProduct.priceHistory.map((entry, idx) => (
                      <div key={`price-history-${idx}`} className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl flex items-center justify-between group hover:border-indigo-100 dark:hover:border-indigo-900 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center">
                            <History size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <p className="font-bold text-slate-800 dark:text-slate-100">{entry.price.toFixed(2)} {settings.currency}</p>
                              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                              <span className="text-[10px] font-bold text-slate-500">Coût: {entry.costPrice.toFixed(2)} {settings.currency}</span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium">{format(new Date(entry.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                            {entry.reason && <p className="text-[10px] text-indigo-500 font-bold italic mt-1 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded w-fit">{entry.reason}</p>}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-400"
                          onClick={async () => {
                            if (!viewingHistoryProduct) return;
                            try {
                              const newHistory = [
                                {
                                  price: viewingHistoryProduct.price,
                                  costPrice: viewingHistoryProduct.costPrice || 0,
                                  timestamp: new Date().toISOString(),
                                  reason: 'Restauration historique'
                                },
                                ...viewingHistoryProduct.priceHistory!
                              ].slice(0, 50);

                               const newProductData = {
                                 ...viewingHistoryProduct,
                                 price: entry.price,
                                 costPrice: entry.costPrice,
                                 priceHistory: newHistory,
                                 updatedAt: new Date().toISOString()
                               };
                               window.dispatchEvent(new CustomEvent('product-cache-update', { detail: newProductData }));
                               if (viewingHistoryProduct.id) {
                                  supabase.from('products').update({
                                   price: entry.price,
                                   cost_price: entry.costPrice,
                                   updated_at: newProductData.updatedAt
                                 }).eq('id', viewingHistoryProduct.id);
                               }
                              setViewingHistoryProduct(newProductData);
                              toast.success("Ancien prix restauré avec succès.");
                            } catch (e) {
                              console.error(e);
                              toast.error("Erreur lors de la restauration.");
                            }
                          }}
                        >
                          Restaurer
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <History size={32} />
                      </div>
                      <p className="text-slate-400 font-medium">Aucune modification de prix enregistrée</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isMassDeleteConfirmOpen} 
        onClose={() => { if (!isMassDeleting) setIsMassDeleteConfirmOpen(false); }} 
        title="Confirmation de Suppression Totale"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed font-medium">
            Êtes-vous sûr de vouloir supprimer <span className="font-black text-rose-600 underline">TOUS</span> les produits ? Cette action est irréversible.
          </p>
          
          {isMassDeleting && (
            <div className="space-y-2 p-4 bg-rose-50 border border-rose-100 rounded-xl">
              <div className="flex justify-between text-[10px] font-black text-rose-600 uppercase tracking-widest">
                <span>Suppression massive...</span>
                <span>{Math.round(massDeleteProgress)}%</span>
              </div>
              <div className="h-2 w-full bg-rose-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${massDeleteProgress}%` }}
                  className="h-full bg-rose-600"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" disabled={isMassDeleting} onClick={() => setIsMassDeleteConfirmOpen(false)}>Annuler</Button>
            <Button 
              variant="danger" 
              disabled={isMassDeleting} 
              onClick={handleMassDeleteProducts}
              className="px-6 font-bold"
            >
              {isMassDeleting ? "Suppression en cours..." : "Oui, Tout Supprimer"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedProductIds.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] px-6 py-4 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center gap-6 border border-slate-800"
          >
            <div className="flex items-center gap-3 pr-6 border-r border-slate-700">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-black">
                {selectedProductIds.length}
              </div>
              <span className="text-sm font-bold text-slate-300">Produits sélectionnés</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleBulkPrintLabels}
                className="flex items-center gap-2 px-4 py-2 hover:bg-slate-800 rounded-xl transition-colors text-sm font-bold"
              >
                <Printer size={18} className="text-indigo-400" />
                Imprimer Étiquettes
              </button>

              <button 
                onClick={() => setIsBulkUpdateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 hover:bg-slate-800 rounded-xl transition-colors text-sm font-bold text-indigo-400 hover:text-indigo-300"
                title="Déplacer vers une catégorie ou changer la marque pour tous les articles sélectionnés"
              >
                <FolderTree size={18} />
                Classer / Marquer
              </button>
              
              <button 
                onClick={() => {
                  const items = products.filter(p => selectedProductIds.includes(p.id));
                  exportToExcel(items, `export_selection_${format(new Date(), 'dd_MM_yyyy')}`);
                }}
                className="flex items-center gap-2 px-4 py-2 hover:bg-slate-800 rounded-xl transition-colors text-sm font-bold"
              >
                <FileSpreadsheet size={18} className="text-emerald-400" />
                Exporter Excel
              </button>
              
              <button 
                onClick={handleBulkDelete}
                disabled={isMassDeleting}
                className="flex items-center gap-2 px-4 py-2 hover:bg-rose-900/30 text-rose-400 hover:text-rose-300 rounded-xl transition-colors text-sm font-bold disabled:opacity-50"
              >
                {isMassDeleting ? <RefreshCw size={18} className="animate-spin" /> : <Trash2 size={18} />}
                Supprimer
              </button>
              
              <button 
                onClick={() => setSelectedProductIds([])}
                className="ml-2 w-8 h-8 flex items-center justify-center hover:bg-slate-800 rounded-full transition-colors"
                title="Annuler la sélection"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}
