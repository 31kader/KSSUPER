import { DEFAULT_PERMISSIONS } from '../constants';
import React, { useState, useMemo, memo, useEffect, useRef } from 'react';
import { Package, Tag, RefreshCw, LayoutGrid, Plus, FileSpreadsheet, History, Upload, ShoppingBag, AlertTriangle, Zap, Info, Search, Filter, Scan, LayoutList, Layers, Truck, ArrowUpDown, Award, Calendar, FolderTree, AlertCircle, TrendingDown, ShieldCheck, RotateCcw, Check, Printer, Copy, PackageOpen, Trash2, ChevronUp, BarcodeIcon, ShoppingCart, Eye, X, MessageCircle, Phone, MapPin, Navigation, Edit, Clock, Mail, Percent, DollarSign, Star, Palette, FileText, AlignLeft, Shield, UserCog, Link2, MapIcon, Brain, Database, ArrowRight, CreditCard, Banknote, Minus, UserPlus, ChevronDown, Users, ArrowUpRight, ArrowDownRight, Camera } from 'lucide-react';
import { supabase } from '../supabase';
import { Button, Card, Modal, ConfirmDialog, BlurCard, SortableHeader } from './ui';
import { Product, Category, Brand, StockAdjustment, CompanySettings, SupplierSync, Supplier, Purchase, Transaction, OnlineOrder, Employee, Customer, CartItem, ProductReturn, RolePermissions } from '../types';
import { cn, logAction, safeDate, exportToExcel, getHierarchicalCategories, formatSafe, exportToCSV, generateUniqueId, isLocked } from '../lib/utils';
import { printReceipt } from '../services/printService';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isToday, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';

import { StockAdjustmentModal } from './StockAdjustmentModal';
import { DuplicateSKUModal } from './DuplicateSKUModal';
import { ImportModal } from './ImportModal';
import { ProductFormModal } from './ProductFormModal';
import { LabelPrinter } from './LabelPrinter';
import { SupplierSyncManager } from './SupplierSyncManager';
import { StockHistory } from './StockHistory';
import { BarcodeScanner } from './BarcodeScanner';
import { ManualQRCodeGenerator } from './ManualQRCodeGenerator';


 // TODO: fix missing imports 
export function TransactionHistory({ transactions, onReturn, onMarkAsDelivered, onEdit, onRestore, settings, canAccess, profile }: any) {
  const [dateFilter, setDateFilter] = useState('all'); // all, today, last7days, last30days
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [deliveryMethodFilter, setDeliveryMethodFilter] = useState('all');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [customerNameSearch, setCustomerNameSearch] = useState('');
  const [amountSearch, setAmountSearch] = useState('');

  // Temporary filter states for explicit apply action
  const [tempDateFilter, setTempDateFilter] = useState('all');
  const [tempPaymentMethodFilter, setTempPaymentMethodFilter] = useState('all');
  const [tempDeliveryMethodFilter, setTempDeliveryMethodFilter] = useState('all');
  const [tempCustomRange, setTempCustomRange] = useState({ start: '', end: '' });
  const [tempCustomerNameSearch, setTempCustomerNameSearch] = useState('');
  const [tempAmountSearch, setTempAmountSearch] = useState('');

  const applyFilters = () => {
    setDateFilter(tempDateFilter);
    setPaymentMethodFilter(tempPaymentMethodFilter);
    setDeliveryMethodFilter(tempDeliveryMethodFilter);
    setCustomRange(tempCustomRange);
    setCustomerNameSearch(tempCustomerNameSearch);
    setAmountSearch(tempAmountSearch);
  };

  const resetFilters = () => {
    setTempDateFilter('all');
    setTempPaymentMethodFilter('all');
    setTempDeliveryMethodFilter('all');
    setTempCustomRange({ start: '', end: '' });
    setTempCustomerNameSearch('');
    setTempAmountSearch('');

    setDateFilter('all');
    setPaymentMethodFilter('all');
    setDeliveryMethodFilter('all');
    setCustomRange({ start: '', end: '' });
    setCustomerNameSearch('');
    setAmountSearch('');
  };
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction | 'id_display'; direction: 'asc' | 'desc' } | null>({ key: 'timestamp', direction: 'desc' });
  const [historicalTransactions, setHistoricalTransactions] = useState<Transaction[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);

  useEffect(() => {
    // Initial load of history if component is on screen
    if (historicalTransactions.length === 0 && !isLoadingMore) {
      loadOlderTransactions();
    }
  }, []);

  const loadOlderTransactions = async () => {
    setIsLoadingMore(true);
    try {
      let oldestTs: string;
      if (lastVisible && lastVisible !== 'DONE') {
        oldestTs = lastVisible;
      } else {
        if (transactions.length > 0) {
           oldestTs = transactions.reduce((oldest: string, current: Transaction) => 
               new Date(current.timestamp) < new Date(oldest) ? current.timestamp : oldest
           , transactions[0].timestamp);
        } else {
           oldestTs = new Date().toISOString();
        }
      }

      // Query older transactions from Supabase
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .lt('timestamp', oldestTs)
        .order('timestamp', { ascending: false })
        .limit(31);

      if (error) throw error;
      
      if (!data || data.length === 0) {
        setLastVisible('DONE');
        return;
      }

      const newDocs: Transaction[] = data as Transaction[];

      setHistoricalTransactions(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const filteredNewDocs = newDocs.filter(t => !existingIds.has(t.id));
        return [...prev, ...filteredNewDocs];
      });
      
      if (newDocs.length > 0) {
        setLastVisible(newDocs[newDocs.length - 1].timestamp);
      } else {
        setLastVisible('DONE');
      }
    } catch (error) {
      console.error("Error loading historical transactions", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const allCombinedTransactions = useMemo(() => {
    if (!transactions) return historicalTransactions || [];
    const historicalMap = new Map((historicalTransactions || []).map(t => [t.id, t]));
    transactions.forEach((t: Transaction) => {
      if (t && t.id) historicalMap.set(t.id, t);
    });
    let combined = Array.from(historicalMap.values());
    
    // Si c'est un caissier, il ne voit que ses propres transactions
    if (profile?.role === 'cashier') {
      combined = combined.filter((t: Transaction) => 
        (profile.employeeId && t.employeeId === profile.employeeId) || 
        t.userId === profile.uid
      );
    }
    
    return combined;
  }, [transactions, historicalTransactions, profile]);

  const filteredTransactions = useMemo(() => {
    const raw = allCombinedTransactions.filter((t: Transaction) => {
      const date = parseISO(t.timestamp);
      const now = new Date();

      // Date filter
      let dateMatch = true;
      if (dateFilter === 'custom') {
        if (customRange.start && customRange.end) {
          dateMatch = isWithinInterval(date, {
            start: startOfDay(parseISO(customRange.start)),
            end: endOfDay(parseISO(customRange.end))
          });
        }
      } else if (dateFilter === 'today') dateMatch = isToday(date);
      else if (dateFilter === 'last7days') {
        dateMatch = isWithinInterval(date, {
          start: startOfDay(subDays(now, 7)),
          end: endOfDay(now)
        });
      }
      else if (dateFilter === 'last30days') {
        dateMatch = isWithinInterval(date, {
          start: startOfDay(subDays(now, 30)),
          end: endOfDay(now)
        });
      }

      // Payment method filter
      const paymentMatch = paymentMethodFilter === 'all' || t.paymentMethod === paymentMethodFilter;

      // Delivery method filter
      const deliveryMatch = deliveryMethodFilter === 'all' || t.deliveryMethod === deliveryMethodFilter;

      // Customer name search
      const customerMatch = customerNameSearch === '' || (t.customerName && t.customerName.toLowerCase().includes(customerNameSearch.toLowerCase()));

      // Amount search
      const amountMatch = amountSearch === '' || (t.total || 0).toString().includes(amountSearch);

      return dateMatch && paymentMatch && deliveryMatch && customerMatch && amountMatch;
    });

    if (sortConfig !== null) {
      raw.sort((a: any, b: any) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        if (sortConfig.key === 'id_display') {
          aValue = a.id?.slice(-8).toUpperCase();
          bValue = b.id?.slice(-8).toUpperCase();
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return raw;
  }, [transactions, dateFilter, paymentMethodFilter, deliveryMethodFilter, customRange, customerNameSearch, amountSearch, sortConfig]);

  const requestSort = (key: keyof Transaction | 'id_display') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const totalPeriod = filteredTransactions.reduce((acc: number, t: Transaction) => acc + (t.total || 0), 0);

  const handlePrint = (t: Transaction) => {
    printReceipt(t, settings);
  };

  const generateInvoicePDF = (t: Transaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = (t.items || []).map(item => `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #eee; text-align: right;">${item.price.toFixed(2)} ${settings.currency}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #eee; text-align: right;">${(item.price * item.quantity).toFixed(2)} ${settings.currency}</td>
      </tr>
    `).join('');

    const subtotal = t.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const taxAmount = subtotal * (settings.taxRate / 100);

    printWindow.document.write(`
      <html>
        <head>
          <title>Facture #${t.id?.slice(-8).toUpperCase()}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #334155; line-height: 1.5; padding: 40px; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
            .company-info h1 { margin: 0; color: #1e293b; font-size: 24px; }
            .invoice-details { text-align: right; }
            .invoice-details h2 { margin: 0; color: #64748b; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; }
            .section { margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .section-title { font-weight: bold; color: #1e293b; text-transform: uppercase; font-size: 12px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin: 30px 0; }
            th { text-align: left; background: #f8fafc; padding: 12px 8px; border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #64748b; }
            .totals { margin-left: auto; width: 300px; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
            .total-row.grand-total { border-top: 2px solid #1e293b; margin-top: 8px; padding-top: 12px; font-weight: bold; font-size: 18px; color: #1e293b; }
            .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <h1>${settings.name}</h1>
              <p>${settings.address || ''}<br>${settings.phone || ''}<br>${settings.email || ''}</p>
            </div>
            <div class="invoice-details">
              <h2>Facture ${t.status === 'returned' ? '(RETOURNÉ)' : t.status === 'partially_returned' ? '(RETOUR PARTIEL)' : ''}</h2>
              <p>#${t.id?.slice(-8).toUpperCase()}<br>Date: ${formatSafe(t.timestamp, 'dd/MM/yyyy HH:mm')}</p>
            </div>
          </div>

          <div class="section">
            <div>
              <div class="section-title">Facturé à</div>
              <p><strong>${t.customerName || 'Client de passage'}</strong></p>
            </div>
            <div style="text-align: right;">
              <div class="section-title">Mode de Paiement</div>
              <p>${t.paymentMethod.toUpperCase()}</p>
              <div class="section-title" style="margin-top: 10px;">Type de Commande</div>
              <p>${(t.deliveryMethod || 'in_store').toUpperCase().replace('_', ' ')}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: center;">Qté</th>
                <th style="text-align: right;">Prix Unitaire</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>Sous-total HT</span>
              <span>${( (t.total || 0) / (1 + (settings.taxRate || 0)/100) ).toFixed(2)} ${settings.currency}</span>
            </div>
            <div class="total-row">
              <span>TVA (${settings.taxRate || 0}%)</span>
              <span>${( (t.total || 0) - ( (t.total || 0) / (1 + (settings.taxRate || 0)/100) ) ).toFixed(2)} ${settings.currency}</span>
            </div>
            <div class="total-row grand-total">
              <span>TOTAL TTC</span>
              <span>${t.total.toFixed(2)} ${settings.currency}</span>
            </div>
          </div>

          <div class="footer">
            <p>${settings.footerText || 'Merci de votre confiance !'}</p>
            ${settings.taxNumber ? `<p>TVA: ${settings.taxNumber}</p>` : ''}
          </div>

          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintList = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHtml = filteredTransactions.map((t: Transaction) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${formatSafe(t.timestamp, 'dd/MM/yyyy HH:mm')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">#${t.id?.slice(-8).toUpperCase()}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">
          <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; ${
            t.status === 'returned' ? 'background: #fee2e2; color: #b91c1c;' :
            t.status === 'partially_returned' ? 'background: #fef3c7; color: #b45309;' :
            'background: #ecfdf5; color: #047857;'
          }">
            ${t.status === 'returned' ? 'Retourné' : t.status === 'partially_returned' ? 'Retour Partiel' : 'Payé'}
          </span>
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${t.deliveryMethod || 'in_store'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${t.paymentMethod}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${t.total.toFixed(2)} ${settings.currency}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Rapport de Transactions</title>
          <style>
            body { font-family: sans-serif; padding: 40px; }
            h1 { color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; background: #f8fafc; padding: 12px 8px; border-bottom: 2px solid #e2e8f0; }
            .summary { margin-top: 30px; text-align: right; font-size: 1.2em; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Rapport de Transactions - ${dateFilter === 'all' ? 'Toutes' : dateFilter}</h1>
          <p>Généré le: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>ID</th>
                <th>Statut</th>
                <th>Type</th>
                <th>Méthode</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="summary">
            Total Période: ${totalPeriod.toFixed(2)} ${settings.currency}
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">Historique des transactions</h3>
          <p className="text-sm text-white/40">{filteredTransactions.length} transactions trouvées</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={handlePrintList} className="flex items-center gap-2 border-slate-700 text-white bg-slate-800 hover:bg-slate-700">
            <Printer size={18} /> Rapport
          </Button>
          <div className="h-6 w-px bg-slate-800 mx-1" />
          <Button variant="secondary" onClick={() => exportToExcel(filteredTransactions, 'transactions')} className="flex items-center gap-2 bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20">
            <FileSpreadsheet size={18} /> Excel
          </Button>
          <Button variant="secondary" onClick={() => exportToCSV(filteredTransactions, 'transactions')} className="flex items-center gap-2 bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20">
            <Database size={18} /> CSV
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800/40">
          <Filter size={16} className="text-indigo-400" />
          <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Filtres de recherche avancés</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Période</label>
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/60">
                <button 
                  type="button"
                  onClick={() => { setTempDateFilter('all'); if (tempDateFilter === 'custom') setTempCustomRange({start: '', end: ''}); }}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${tempDateFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  Tous
                </button>
                <button 
                  type="button"
                  onClick={() => { setTempDateFilter('today'); if (tempDateFilter === 'custom') setTempCustomRange({start: '', end: ''}); }}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${tempDateFilter === 'today' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  Aujourd'hui
                </button>
                <button 
                  type="button"
                  onClick={() => { setTempDateFilter('last7days'); if (tempDateFilter === 'custom') setTempCustomRange({start: '', end: ''}); }}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${tempDateFilter === 'last7days' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  7 jrs
                </button>
                <button 
                  type="button"
                  onClick={() => setTempDateFilter('custom')}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${tempDateFilter === 'custom' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  Perso.
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Client & Montant</label>
            <div className="space-y-1.5">
              <input
                type="text"
                placeholder="Nom du client..."
                value={tempCustomerNameSearch}
                onChange={(e) => setTempCustomerNameSearch(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/65 border border-slate-800/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 font-medium"
              />
              <input
                type="text"
                placeholder="Montant de vente..."
                value={tempAmountSearch}
                onChange={(e) => setTempAmountSearch(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/65 border border-slate-800/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Paiement & Mode</label>
            <div className="space-y-1.5 font-medium">
              <select 
                value={tempPaymentMethodFilter} 
                onChange={(e) => setTempPaymentMethodFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/65 border border-slate-800/80 rounded-xl text-xs text-slate-300 outline-none focus:border-indigo-500"
              >
                <option value="all">Tous les paiements</option>
                <option value="cash">Espèces</option>
                <option value="card">Carte</option>
                <option value="transfer">Virement</option>
              </select>
              <select 
                value={tempDeliveryMethodFilter} 
                onChange={(e) => setTempDeliveryMethodFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/65 border border-slate-800/80 rounded-xl text-xs text-slate-300 outline-none focus:border-indigo-500"
              >
                <option value="all">Tous les modes</option>
                <option value="in_store">En magasin</option>
                <option value="delivery">Livraison</option>
                <option value="pickup">Retrait</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col justify-end gap-2">
            <Button 
              type="button" 
              onClick={applyFilters} 
              className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 rounded-xl text-xs font-bold"
            >
              <Check size={14} />
              Appliquer les filtres
            </Button>
            <Button 
              type="button" 
              variant="outline"
              onClick={resetFilters} 
              className="w-full h-9 border-slate-800 hover:bg-slate-800 text-slate-400 flex items-center justify-center gap-2 rounded-xl text-xs font-bold"
            >
              <RotateCcw size={14} />
              Réinitialiser
            </Button>
          </div>

        </div>

        {tempDateFilter === 'custom' && (
          <div className="pt-3 border-t border-slate-800/20 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Du</label>
              <input 
                type="date" 
                className="p-1 px-2.5 bg-slate-950/60 border border-slate-800 text-xs text-white rounded-lg outline-none focus:border-indigo-500"
                value={tempCustomRange.start}
                onChange={e => setTempCustomRange({...tempCustomRange, start: e.target.value})}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Au</label>
              <input 
                type="date" 
                className="p-1 px-2.5 bg-slate-950/60 border border-slate-800 text-xs text-white rounded-lg outline-none focus:border-indigo-500"
                value={tempCustomRange.end}
                onChange={e => setTempCustomRange({...tempCustomRange, end: e.target.value})}
              />
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BlurCard title="Total Période" borderClass="border-l-4 border-l-indigo-500">
          <p className="text-2xl font-black text-white">{totalPeriod.toFixed(2)} {settings.currency}</p>
        </BlurCard>
        <BlurCard title="Transactions" borderClass="border-l-4 border-l-emerald-500">
          <p className="text-2xl font-black text-white">{filteredTransactions.length}</p>
        </BlurCard>
        <BlurCard title="Panier Moyen" borderClass="border-l-4 border-l-amber-500">
          <p className="text-2xl font-black text-white">
            {filteredTransactions.length > 0 ? (totalPeriod / filteredTransactions.length).toFixed(2) : '0.00'} {settings.currency}
          </p>
        </BlurCard>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/50 border-bottom border-slate-800/40">
              <SortableHeader label="Date & Heure" sortKey="timestamp" currentSort={sortConfig} onSort={() => requestSort('timestamp')} />
              <SortableHeader label="Utilisateur" sortKey="employeeName" currentSort={sortConfig} onSort={() => requestSort('employeeName')} />
              <SortableHeader label="ID Transaction" sortKey="id_display" currentSort={sortConfig} onSort={() => requestSort('id_display')} />
              <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Articles</th>
              <SortableHeader label="Statut" sortKey="status" currentSort={sortConfig} onSort={() => requestSort('status')} />
              <SortableHeader label="Type" sortKey="deliveryMethod" currentSort={sortConfig} onSort={() => requestSort('deliveryMethod')} />
              <SortableHeader label="Méthode" sortKey="paymentMethod" currentSort={sortConfig} onSort={() => requestSort('paymentMethod')} />
              <SortableHeader label="Total" sortKey="total" currentSort={sortConfig} onSort={() => requestSort('total')} />
              <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {filteredTransactions.map((t: Transaction) => (
              <tr key={t.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 text-sm text-white/60">
                  {format(new Date(t.timestamp), 'dd/MM/yyyy HH:mm')}
                </td>
                <td className="p-4 text-sm font-bold text-white">
                  {t.employeeName || 'Système'}
                </td>
                <td className="p-4 text-sm font-mono text-white/40">
                  #{t.id?.slice(-8).toUpperCase()}
                </td>
                <td className="p-4 text-sm text-white/60">
                  {t.items.length} article(s)
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    {t.status === 'returned' && (
                      <span className="px-2 py-1 rounded-full text-[10px] bg-rose-100 text-rose-700 font-black uppercase tracking-tighter flex items-center gap-1 w-fit">
                        <RotateCcw size={10} /> Retourné
                      </span>
                    )}
                    {t.status === 'partially_returned' && (
                      <span className="px-2 py-1 rounded-full text-[10px] bg-amber-100 text-amber-700 font-black uppercase tracking-tighter flex items-center gap-1 w-fit">
                        <RotateCcw size={10} /> Retour Partiel
                      </span>
                    )}
                    {(t.status === 'delivered' || (t.status === 'completed' || !t.status)) && (t.status !== 'returned' && t.status !== 'partially_returned') && (
                      <span className="px-2 py-1 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-black uppercase tracking-tighter flex items-center gap-1 w-fit">
                        <Check size={10} /> Payé
                      </span>
                    )}
                    {t.status === 'pending' && (
                      <span className="px-2 py-1 rounded-full text-[10px] bg-indigo-100 text-indigo-700 font-black uppercase tracking-tighter flex items-center gap-1 w-fit">
                        <Clock size={10} /> En attente
                      </span>
                    )}

                    {/* Camera Audit Label */}
                    {t.auditStatus && (
                      <div className={cn(
                        "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border flex items-center gap-1 w-fit mt-1",
                        t.auditStatus === 'verified' ? "bg-emerald-50 border-emerald-200 text-emerald-600" :
                        t.auditStatus === 'suspicious' ? "bg-rose-50 border-rose-200 text-rose-600" :
                        "bg-slate-50 border-slate-200 text-slate-500"
                      )}>
                        <Camera size={10} />
                        {t.auditStatus === 'verified' ? 'Vérifié' : t.auditStatus === 'suspicious' ? 'Suspect' : 'Audit'}
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    t.deliveryMethod === 'delivery' ? "bg-indigo-100 text-indigo-700" : 
                    t.deliveryMethod === 'pickup' ? "bg-amber-100 text-amber-700" : 
                    "bg-slate-100 text-slate-700"
                  }`}>
                    {t.deliveryMethod === 'delivery' ? 'Livraison' : 
                     t.deliveryMethod === 'pickup' ? 'Retrait Magasin' : 
                     'Magasin'}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    t.paymentMethod === 'card' ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {t.paymentMethod}
                  </span>
                </td>
                <td className="p-4 font-bold text-white">{(t.total || 0).toFixed(2)} {settings.currency}</td>
                <td className="p-4 text-right flex items-center justify-end gap-2">
                  {(() => {
                    const locked = isLocked(t.timestamp, settings.lockingPeriodDays || 0);
                    return (
                      <>
                        <button 
                          onClick={() => !locked && onRestore(t)}
                          disabled={locked}
                          className={cn(
                            "p-2 rounded-lg group transition-all",
                            locked ? "text-slate-300 cursor-not-allowed opacity-50" : "text-indigo-600 hover:bg-indigo-50"
                          )}
                          title={locked ? "Période de modification clôturée" : "Reprendre la vente"}
                        >
                          <div className="relative">
                            <ShoppingBag size={16} />
                            <ArrowRight size={8} className="absolute -right-1 -bottom-1 bg-white rounded-full" />
                          </div>
                        </button>
                        {t.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => !locked && onEdit(t)}
                              disabled={locked}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                locked ? "text-slate-300 cursor-not-allowed opacity-50" : "text-amber-600 hover:bg-amber-50"
                              )}
                              title={locked ? "Verrouillé" : "Modifier la commande"}
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => onMarkAsDelivered(t)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                              title="Marquer comme livré"
                            >
                              <Check size={16} />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => generateInvoicePDF(t)}
                          className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                          title="Générer Facture PDF"
                        >
                          <FileText size={18} />
                        </button>
                        <button 
                          onClick={() => handlePrint(t)}
                          className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Imprimer le reçu"
                        >
                          <Printer size={18} />
                        </button>
                        {canAccess('canAccessReturns') && (
                          <button 
                            onClick={() => !locked && onReturn(t)}
                            disabled={locked}
                            className={cn(
                              "p-2 transition-colors",
                              (t.status === 'returned' || locked) ? "text-slate-200 cursor-not-allowed opacity-50" : "text-slate-400 hover:text-rose-600"
                            )}
                            title={locked ? "Période de retour clôturée" : t.status === 'returned' ? "Déjà totalement retourné" : "Effectuer un retour"}
                          >
                            <RotateCcw size={18} />
                          </button>
                        )}
                      </>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
