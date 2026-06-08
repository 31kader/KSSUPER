import { DEFAULT_PERMISSIONS } from '../constants';
import React, { useState, useMemo, memo, useEffect, useRef, useDeferredValue } from 'react';
import { Package, Tag, RefreshCw, LayoutGrid, Plus, FileSpreadsheet, Upload, ShoppingBag, AlertTriangle, Zap, Info, Search, Filter, Scan, LayoutList, Layers, Truck, ArrowUpDown, Award, Calendar, FolderTree, AlertCircle, TrendingDown, ShieldCheck, RotateCcw, Check, Printer, Copy, PackageOpen, Trash2, ChevronUp, BarcodeIcon, ShoppingCart, Eye, X, MessageCircle, Phone, MapPin, Navigation, Edit, Clock, Mail, Percent, DollarSign, Star, Palette, FileText, AlignLeft, Shield, UserCog, Link2, MapIcon, Brain, Database, ArrowRight, CreditCard, Banknote, Minus, UserPlus, ChevronDown, Users, ArrowUpRight, ArrowDownRight, LogOut, Bell, TrendingUp, History, EyeOff, LogIn, Store, Gift, Wallet, Edit2, MessageSquare, CheckCircle2 } from 'lucide-react';
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

export function CustomerDashboard({ 
  customer, 
  transactions, 
  settings, 
  onLogout 
}: { 
  customer: Customer, 
  transactions: Transaction[], 
  settings: CompanySettings,
  onLogout: () => void
}) {
  const customerTransactions = useMemo(() => {
    return transactions.filter(t => t.customerId === customer.id);
  }, [transactions, customer.id]);

  const stats = useMemo(() => {
    const totalSpent = customerTransactions.reduce((sum, t) => sum + t.total, 0);
    const lastVisit = customerTransactions.length > 0 
      ? new Date(customerTransactions[0].timestamp) 
      : null;
    return { totalSpent, lastVisit };
  }, [customerTransactions]);

  return (
    <div className="min-h-screen bg-nardo flex flex-col font-sans selection:bg-indigo-500/30 selection:text-white">
      {/* Header */}
      <header className="bg-workspace/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-neon-indigo border border-indigo-400/50">
              <ShoppingBag size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-black text-white uppercase italic tracking-tighter text-xl leading-none">Nexus <span className="text-indigo-400">Portal</span></h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">{settings.name}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-2xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/5 transition-all active:scale-90"
            title="Se déconnecter"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-8">
        {/* Welcome Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-indigo-600 rounded-[3rem] p-10 text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden group"
        >
          <div className="relative z-10">
            <h2 className="text-4xl font-black mb-2 italic tracking-tighter uppercase">Bonjour, {customer.name} !</h2>
            <p className="text-indigo-100 font-bold uppercase tracking-widest text-[10px] opacity-80">Membre Nexus Privilège • Accès Autorisé</p>
            
            <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-2">
                <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em]">Crédits Fidélité</p>
                <div className="flex items-center gap-2">
                  <Award className="text-amber-400 w-7 h-7 drop-shadow-md" />
                  <p className="text-4xl font-black tracking-tighter">{customer.loyaltyPoints}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em]">Valeur Nexus</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-4xl font-black tracking-tighter">{(customer.loyaltyPoints * (settings.loyaltyPointValue || 0.01)).toFixed(2)}</p>
                  <span className="text-xs font-black opacity-60 uppercase">{settings.currency}</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em]">Volume Total</p>
                <div className="flex items-baseline gap-1">
                   <p className="text-4xl font-black tracking-tighter">{stats.totalSpent.toFixed(0)}</p>
                   <span className="text-xs font-black opacity-60 uppercase">{settings.currency}</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em]">Opérations</p>
                <p className="text-4xl font-black tracking-tighter">{customerTransactions.length}</p>
              </div>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-80 h-80 bg-white/10 rounded-full blur-[100px] group-hover:scale-110 transition-transform duration-1000"></div>
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-64 h-64 bg-indigo-400/20 rounded-full blur-[80px]"></div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Transactions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white flex items-center gap-3 uppercase italic tracking-wider text-sm">
                <History size={18} className="text-indigo-400" />
                Journal d'activité
              </h3>
            </div>
            
            <div className="space-y-4">
              {customerTransactions.length === 0 ? (
                <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-16 text-center shadow-inner">
                  <ShoppingCart size={48} className="mx-auto text-slate-800 mb-4 opacity-50" />
                  <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Aucune donnée transactionnelle enregistrée.</p>
                </div>
              ) : (
                customerTransactions.map((t) => (
                  <motion.div 
                    key={t.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-6 hover:bg-white/10 hover:border-indigo-500/30 transition-all cursor-pointer group relative overflow-hidden shadow-inner">
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-slate-700 group-hover:text-indigo-400 border border-white/5 transition-all shadow-inner">
                            <ShoppingCart size={24} />
                          </div>
                          <div>
                            <p className="font-black text-white italic tracking-widest uppercase text-sm">Session #{t.id.slice(-8).toUpperCase()}</p>
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-2">
                              <Calendar size={12} className="text-indigo-500" />
                              {formatSafe(t.timestamp, 'dd MMMM yyyy • HH:mm', { locale: fr })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-white tracking-tighter leading-none">{t.total.toFixed(2)}</p>
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mt-1">{settings.currency}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-8">
            <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-8 space-y-8 shadow-inner">
              <h3 className="font-black text-white flex items-center gap-3 uppercase italic tracking-wider text-sm">
                <UserCog size={18} className="text-indigo-400" />
                Matrice Client
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-slate-600 border border-white/5">
                    <Mail size={16} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Passerelle Mail</p>
                    <p className="text-xs font-black text-white tracking-wide">{customer.email || 'N/A'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-slate-600 border border-white/5">
                    <Phone size={16} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Liaison Com</p>
                    <p className="text-xs font-black text-white tracking-widest">{customer.phone || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-slate-600 border border-white/5">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Dernière Sync</p>
                    <p className="text-xs font-black text-white tracking-widest">
                      {stats.lastVisit 
                        ? format(stats.lastVisit, 'dd MMM yyyy', { locale: fr }).toUpperCase()
                        : 'NO_DATA'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/5 rounded-[2.5rem] border border-amber-500/20 p-8 shadow-inner relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-2xl flex items-center justify-center border border-amber-500/20">
                    <Gift size={24} />
                  </div>
                  <h3 className="font-black text-amber-400 uppercase italic tracking-wider text-sm">Reward Logic</h3>
                </div>
                <p className="text-[11px] font-bold text-amber-200/60 mb-6 leading-relaxed uppercase tracking-widest">
                  Générez de la valeur sur chaque achat. 100 points = 1.00 {settings.currency} de remise Nexus.
                </p>
                <div className="p-6 bg-slate-950/40 rounded-3xl border border-amber-500/10 shadow-inner">
                  <p className="text-[9px] font-black text-amber-500/60 uppercase tracking-[0.2em] mb-2">Nexus Balance</p>
                  <p className="text-3xl font-black text-amber-400 tracking-tighter leading-none">{customer.loyaltyPoints} <span className="text-xs">PTS</span></p>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-[40px] -mr-16 -mt-16"></div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-workspace/40 border-t border-white/5 py-10 mt-16">
        <div className="max-w-5xl mx-auto px-6 text-center space-y-4">
          <p className="text-xs font-black text-white uppercase italic tracking-[0.3em]">{settings.name}</p>
          <div className="flex items-center justify-center gap-4 opacity-30">
             <div className="h-px w-12 bg-slate-500"></div>
             <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Nexus System Core &copy; {new Date().getFullYear()}</p>
             <div className="h-px w-12 bg-slate-500"></div>
          </div>
        </div>
      </footer>
    </div>
  );
}
