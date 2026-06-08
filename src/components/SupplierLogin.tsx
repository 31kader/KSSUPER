import { DEFAULT_PERMISSIONS } from '../constants';
import bcrypt from 'bcryptjs';
import React, { useState, useMemo, memo, useEffect, useRef, useDeferredValue } from 'react';
import { Package, Tag, RefreshCw, LayoutGrid, Plus, FileSpreadsheet, Upload, ShoppingBag, AlertTriangle, Zap, Info, Search, Filter, Scan, LayoutList, Layers, Truck, ArrowUpDown, Award, Calendar, FolderTree, AlertCircle, TrendingDown, ShieldCheck, RotateCcw, Check, Printer, Copy, PackageOpen, Trash2, ChevronUp, BarcodeIcon, ShoppingCart, Eye, X, MessageCircle, Phone, MapPin, Navigation, Edit, Clock, Mail, Percent, DollarSign, Star, Palette, FileText, AlignLeft, Shield, UserCog, Link2, MapIcon, Brain, Database, ArrowRight, CreditCard, Banknote, Minus, UserPlus, ChevronDown, Users, ArrowUpRight, ArrowDownRight, LogOut, Bell, TrendingUp, History, EyeOff, LogIn, Store, Gift, Wallet, Edit2, MessageSquare, CheckCircle2, Lock } from 'lucide-react';
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

export function SupplierLogin({ onLogin }: { onLogin: (supplier: Supplier) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error: fetchError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('email', cleanEmail);
      
      if (fetchError || !data || data.length === 0) {
        setError('Identifiants incorrects ou compte non activé.');
        setIsLoggingIn(false);
        return;
      }

      const supplierData = data.find(s => 
        s.isAppUser === true && 
        (s.email?.toLowerCase().trim() === cleanEmail)
      ) as Supplier;

      if (!supplierData) {
        setError('Identifiants incorrects ou compte non activé.');
        setIsLoggingIn(false);
        return;
      }

      const hash = supplierData.password || (supplierData as any).passwordHash || (supplierData as any).password_hash;
      if (!hash) {
        setError('Aucun mot de passe défini. Veuillez contacter l\'administrateur.');
        setIsLoggingIn(false);
        return;
      }

      try {
        const isMatch = bcrypt.compareSync(password, hash);
        if (isMatch) {
          onLogin(supplierData);
        } else {
          setError('Identifiants incorrects.');
        }
      } catch (bcryptErr) {
        console.error('Bcrypt error:', bcryptErr);
        setError('Erreur technique lors de la vérification.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Une erreur est survenue.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-nardo flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <Truck size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Portail Fournisseur</h1>
          <p className="text-slate-500">Connectez-vous pour gérer vos commandes</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="email" 
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="votre@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type={showPassword ? "text" : "password"} 
                required
                className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-sm flex items-center gap-2 border border-rose-100">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-100"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? "Connexion..." : "Se connecter"}
          </Button>

          <div className="pt-4 border-t border-slate-100 text-center">
            <button 
              type="button"
              onClick={() => window.location.href = window.location.pathname}
              className="text-slate-500 text-sm font-medium hover:underline"
            >
              Retour à l'accueil du POS
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
