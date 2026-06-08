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

export function CustomerLogin({ onLogin }: { onLogin: (customer: Customer) => void }) {
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
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('email', cleanEmail);
      
      if (error || !data || data.length === 0) {
        setError('Identifiants incorrects ou compte non activé.');
        setIsLoggingIn(false);
        return;
      }

      const customerData = data.find(c => 
        c.isAppUser === true && 
        (c.email?.toLowerCase().trim() === cleanEmail)
      ) as Customer;

      if (!customerData) {
        setError('Identifiants incorrects ou compte non activé.');
        setIsLoggingIn(false);
        return;
      }

      const hash = customerData.password || (customerData as any).passwordHash || (customerData as any).password_hash;
      if (!hash) {
        setError('Aucun mot de passe défini pour ce compte. Veuillez contacter l\'administrateur.');
        setIsLoggingIn(false);
        return;
      }

      try {
        const isMatch = bcrypt.compareSync(password, hash);
        if (isMatch) {
          onLogin(customerData);
        } else {
          setError('Identifiants incorrects.');
        }
      } catch (bcryptErr) {
        console.error('Bcrypt error:', bcryptErr);
        setError('Erreur technique lors de la vérification du mot de passe.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Une erreur est survenue lors de la connexion.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-nardo flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
            <ShoppingBag className="text-white w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Espace Client</h2>
          <p className="text-slate-500 text-center mt-2">Connectez-vous pour voir vos achats et points de fidélité</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="votre@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 active:scale-95 transition-all disabled:bg-slate-300 disabled:active:scale-100 flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
          >
            {isLoggingIn ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Se connecter
              </>
            )}
          </button>

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

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            Nexus POS &copy; {new Date().getFullYear()} - Tous droits réservés
          </p>
        </div>
      </motion.div>
    </div>
  );
}
