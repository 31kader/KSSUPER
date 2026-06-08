import { DEFAULT_PERMISSIONS } from '../constants';
import React, { useState, useMemo, memo, useEffect, useRef, useDeferredValue } from 'react';
import { Package, Tag, RefreshCw, LayoutGrid, Plus, FileSpreadsheet, Upload, ShoppingBag, AlertTriangle, Zap, Info, Search, Filter, Scan, LayoutList, Layers, Truck, ArrowUpDown, Award, Calendar, FolderTree, AlertCircle, TrendingDown, ShieldCheck, RotateCcw, Check, Printer, Copy, PackageOpen, Trash2, ChevronUp, BarcodeIcon, ShoppingCart, Eye, X, MessageCircle, Phone, MapPin, Navigation, Edit, Clock, Mail, Percent, DollarSign, Star, Palette, FileText, AlignLeft, Shield, UserCog, Link2, MapIcon, Brain, Database, ArrowRight, CreditCard, Banknote, Minus, UserPlus, ChevronDown, Users, ArrowUpRight, ArrowDownRight, LogOut, Bell, TrendingUp, History, EyeOff, LogIn, Store, Gift, Wallet, Edit2, MessageSquare, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabase';
import { Button, Card, Modal, ConfirmDialog, BlurCard, SortableHeader } from './ui';
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

export const mapDoc = <T,>(doc: any): T => {
  return { id: doc.id, ...doc.data() } as unknown as T;
};

export function QuickAddProductModal({ 
  isOpen, 
  onClose, 
  barcode, 
  onSuccess,
  user
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  barcode: string; 
  onSuccess: (product: Product) => void;
  user: any;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [location, setLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setPrice('');
      setCostPrice('');
      setLocation('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const trimmedBarcode = barcode ? barcode.trim() : '';
      if (trimmedBarcode) {
        // Check barcode duplicates using Supabase
        const { data: dbProds, error: countError } = await supabase
          .from('products')
          .select('id')
          .or(`barcode.eq.${trimmedBarcode},sku.eq.${trimmedBarcode}`);

        if (dbProds && dbProds.length > 0) {
          setErrorMsg(`Le code-barres "${trimmedBarcode}" est déjà enregistré sur un autre produit de la base de données !`);
          setIsSaving(false);
          return;
        }
      }

      const newProductId = Math.random().toString(36).substring(2, 11);
      const newProduct: Product = {
        id: newProductId,
        name,
        price: parseFloat(price),
        costPrice: parseFloat(costPrice) || 0,
        location: location.toUpperCase(),
        taxRate: 0,
        stock: 999,
        minStock: 0,
        categoryId: 'uncategorized',
        supplier: 'N/A',
        unit: 'unité',
        sku: barcode,
        barcode: barcode,
        status: 'active',
        showInPos: true,
        updatedAt: new Date().toISOString()
      };
      
      const { error: insertError } = await supabase.from('products').insert(newProduct);
      if (insertError) throw insertError;
      
      logAction(user?.uid || 'pos', user?.displayName || 'Utilisateur', 'Ajout Rapide', 'POS', `Produit ajouté via POS: ${name} (${barcode})`);
      
      onSuccess(newProduct);
      onClose();
    } catch (error) {
      console.error("Error quick adding product:", error);
      setErrorMsg("Une erreur est survenue lors de l'enregistrement rapide du produit.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 shadow-lg ring-4 ring-indigo-50">
            <Plus size={32} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Produit Inconnu</h3>
          <p className="text-slate-500 font-medium">Le code-barres <span className="font-bold text-indigo-600">{barcode}</span> n'existe pas. Ajoutez-le rapidement pour continuer.</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-start gap-2.5 text-xs font-bold leading-relaxed">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-500 animate-bounce" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Nom du produit</label>
            <input 
              autoFocus
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-bold text-slate-800"
              placeholder="Ex: Nouveauté"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Prix de vente</label>
            <div className="relative">
              <input 
                required
                type="number"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full p-4 pl-12 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-bold text-slate-800"
                placeholder="0.00"
              />
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Prix d'achat</label>
            <div className="relative">
              <input 
                type="number"
                step="0.01"
                value={costPrice}
                onChange={e => setCostPrice(e.target.value)}
                className="w-full p-4 pl-12 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-bold text-slate-800"
                placeholder="0.00 (Optionnel)"
              />
              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Emplacement (Rayon)</label>
            <div className="relative">
              <input 
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full p-4 pl-12 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-bold text-indigo-600"
                placeholder="Ex: A-01"
              />
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={onClose}
              className="flex-1 py-4 text-sm font-black uppercase tracking-wider"
            >
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={isSaving}
              className="flex-1 py-4 text-sm font-black uppercase tracking-wider bg-indigo-600 shadow-lg shadow-indigo-200"
            >
              {isSaving ? 'Envoi...' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
