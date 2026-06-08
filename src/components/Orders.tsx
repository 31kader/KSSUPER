import { DEFAULT_PERMISSIONS } from '../constants';
import React, { useState, useMemo, memo, useEffect, useRef } from 'react';
import { Package, Tag, RefreshCw, LayoutGrid, Plus, FileSpreadsheet, Upload, ShoppingBag, AlertTriangle, Zap, Info, Search, Filter, Scan, LayoutList, Layers, Truck, ArrowUpDown, Award, Calendar, FolderTree, AlertCircle, TrendingDown, ShieldCheck, RotateCcw, Check, Printer, Copy, PackageOpen, Trash2, ChevronUp, BarcodeIcon, ShoppingCart, Eye, X, MessageCircle, Phone, MapPin, Navigation, Edit, Clock, Mail, Percent, DollarSign, Star, Palette, FileText, AlignLeft, Shield, UserCog, Link2, MapIcon, Brain, Database, ArrowRight, CreditCard, Banknote, Minus, UserPlus, ChevronDown, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { 
  rtdb, ref, update, push, set, remove, get, auth, handleFirestoreError, OperationType, runRtdbTransaction, rtdbQuery as query, orderByChild as orderBy, onValue
} from '../firebase';
import { Button, Card, Modal, ConfirmDialog, BlurCard, SortableHeader } from './ui';
import { Product, Category, Brand, StockAdjustment, CompanySettings, SupplierSync, Supplier, Purchase, Transaction, OnlineOrder, Employee, Customer, CartItem, ProductReturn, RolePermissions } from '../types';
import { cn, logAction, safeDate, exportToExcel, getHierarchicalCategories, formatSafe, exportToCSV, generateUniqueId, isLocked } from '../lib/utils';
import { printReceipt } from '../services/printService';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isToday, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { useTranslation } from '../translations';
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


export const mapDoc = <T,>(doc: any): T => {
  return { id: doc.id, ...doc.data() } as unknown as T;
};

 // TODO: fix missing imports 
export function EditOrderItems({ order, onSave, onCancel, settings }: { order: OnlineOrder, onSave: (order: OnlineOrder, items: OnlineOrder['items']) => void, onCancel: () => void, settings: CompanySettings }) {
  const [items, setItems] = useState<OnlineOrder['items']>(order.items);

  const updateQuantity = (productId: string, delta: number) => {
    setItems(items.map(item => {
      if (item.productId === productId) {
        const newQuantity = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  return (
    <div className="space-y-4">
      <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Modifier les articles</h4>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={`order-item-${idx}`} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-md">
            <div className="flex-1">
              <p className="text-sm font-bold text-white tracking-tight">{item.name}</p>
              <p className="text-xs text-white/40 font-mono mt-0.5">{(item.price || 0).toFixed(2)} {settings.currency} x {item.quantity}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => updateQuantity(item.productId, -1)}
                className="bg-white/10 hover:bg-white/20 border-none text-white w-8 h-8 p-0 flex items-center justify-center rounded-lg"
              >-</Button>
              <span className="text-sm font-black w-8 text-center text-white font-mono">{item.quantity || 0}</span>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => updateQuantity(item.productId, 1)}
                className="bg-indigo-500/20 hover:bg-indigo-500/30 border-none text-indigo-400 w-8 h-8 p-0 flex items-center justify-center rounded-lg"
              >+</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 pt-6">
        <Button variant="secondary" onClick={onCancel} className="flex-1 bg-white/10 hover:bg-white/20 border-none text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl h-auto">Annuler</Button>
        <Button onClick={() => onSave(order, items)} className="flex-1 bg-indigo-500 hover:bg-indigo-600 border-none text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl h-auto shadow-lg shadow-indigo-500/20">Sauvegarder</Button>
      </div>
    </div>
  );
}
export function Orders({ orders, products, syncOrder, autoSync, setAutoSync, settings, employees, customers }: { 
  orders: OnlineOrder[], 
  products: Product[], 
  syncOrder: (order: OnlineOrder) => Promise<void>,
  autoSync: boolean,
  setAutoSync: (val: boolean) => void,
  settings: CompanySettings,
  employees: Employee[],
  customers: Customer[]
}) {
  const { t } = useTranslation();
  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<string>('all');
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const filteredOrders = orders.filter(o => 
    (statusFilter === 'all' || o.status === statusFilter) &&
    (deliveryFilter === 'all' || o.deliveryMethod === deliveryFilter)
  );

  useEffect(() => {
    if (selectedOrder) {
      const updatedOrder = orders.find(o => o.id === selectedOrder.id);
      if (updatedOrder && JSON.stringify(updatedOrder) !== JSON.stringify(selectedOrder)) {
        setSelectedOrder(updatedOrder);
      }
    }
  }, [orders, selectedOrder]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'confirmed': return 'bg-blue-100 text-blue-700';
      case 'processing': return 'bg-indigo-100 text-indigo-700';
      case 'shipped': return 'bg-purple-100 text-purple-700';
      case 'delivered': return 'bg-emerald-100 text-emerald-700';
      case 'cancelled': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const updateOrderPaymentStatus = async (order: OnlineOrder, newPaymentStatus: OnlineOrder['paymentStatus']) => {
    try {
      await update(ref(rtdb, `onlineOrders/${order.id}`), { paymentStatus: newPaymentStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'onlineOrders');
    }
  };

  const updateOrderStatus = async (order: OnlineOrder, newStatus: OnlineOrder['status']) => {
    try {
      const updates: any = {};
      updates[`onlineOrders/${order.id}/status`] = newStatus;
      
      // Status history
      const user = auth.currentUser;
      const historyEntry = {
        status: newStatus,
        changedBy: user?.email || 'System',
        timestamp: new Date().toISOString()
      };
      const newStatusHistory = [...(order.statusHistory || []), historyEntry];
      updates[`onlineOrders/${order.id}/statusHistory`] = newStatusHistory;

      // Find customer ID if null but we have their phone or name
      let finalCustomerId = order.customerId;
      if (!finalCustomerId) {
        const found = customers.find(c => 
          (order.customerPhone && c.phone && c.phone.replace(/\D/g, '') === order.customerPhone.replace(/\D/g, '')) || 
          (c.name && order.customerName && c.name.toLowerCase() === order.customerName.toLowerCase())
        );
        if (found) {
          finalCustomerId = found.id;
          updates[`onlineOrders/${order.id}/customerId`] = found.id;
        }
      }

      // If just delivered, log as a finalized transaction for daily reports
      if (newStatus === 'delivered' && order.status !== 'delivered') {
        if (!order.syncedToPos) {
          const transactionRef = push(ref(rtdb, 'transactions'));
          const transaction: Transaction = {
            id: transactionRef.key!,
            items: order.items as unknown as CartItem[],
            total: order.total,
            timestamp: new Date().toISOString(),
            paymentMethod: (order.paymentMethod as 'cash' | 'card') || 'cash',
            status: 'completed',
            employeeName: 'Système (Online)',
            userId: 'system',
            onlineOrderId: order.id,
            customerId: finalCustomerId || null,
            customerName: order.customerName || null,
            pointsEarned: finalCustomerId ? Math.floor(order.total * (settings.loyaltyPointsPerCurrencyUnit || 1)) : 0
          };
          updates[`transactions/${transactionRef.key}`] = transaction;
          updates[`onlineOrders/${order.id}/syncedToPos`] = true;
        }
        
        // Update customer's loyalty points
        if (finalCustomerId) {
          try {
            const customer = customers.find(c => c.id === finalCustomerId);
            if (customer) {
              const pointsEarned = Math.floor(order.total * (settings.loyaltyPointsPerCurrencyUnit || 1));
              updates[`customers/${finalCustomerId}/loyaltyPoints`] = (customer.loyaltyPoints || 0) + pointsEarned;
              updates[`customers/${finalCustomerId}/totalSpent`] = (customer.totalSpent || 0) + order.total;
              updates[`customers/${finalCustomerId}/lastVisit`] = new Date().toISOString();
            }
          } catch (e) {
            console.error("Failed to prepare customer loyalty points update:", e);
          }
        }
      }

      await update(ref(rtdb), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'onlineOrders');
    }
  };

  const assignOrderToEmployee = async (order: OnlineOrder, employeeId: string) => {
    try {
      const employee = employees.find(e => e.id === employeeId);
      const updates: any = {
        assignedEmployeeId: employeeId,
        assignedEmployeeName: employee?.name || 'Inconnu'
      };
      await update(ref(rtdb, `onlineOrders/${order.id}`), updates);
    } catch (error) {
      console.error('Error assigning order:', error);
    }
  };

  const assignPickerToOrder = async (order: OnlineOrder, pickerId: string) => {
    try {
      const picker = employees.find(e => e.id === pickerId);
      const updates: any = {
        assignedPickerId: pickerId,
        assignedPickerName: picker?.name || 'Inconnu'
      };
      await update(ref(rtdb, `onlineOrders/${order.id}`), updates);
    } catch (error) {
      console.error('Error assigning picker:', error);
    }
  };

  // Auto-assignment logic (Round-Robin)
  useEffect(() => {
    const unassignedOrders = orders.filter(o => o.status === 'pending' && !o.assignedPickerId);
    if (unassignedOrders.length > 0) {
      const pickers = employees.filter(e => e.role === 'picker');
      if (pickers.length > 0) {
        unassignedOrders.forEach((order, index) => {
          // simple distribution: use order index or timestamp to distribute
          const pickerIndex = (orders.filter(o => o.assignedPickerId).length + index) % pickers.length;
          const targetPicker = pickers[pickerIndex];
          assignPickerToOrder(order, targetPicker.id);
        });
      }
    }
  }, [orders, employees]);
  const updateDeliveryMethod = async (order: OnlineOrder, newMethod: 'delivery' | 'pickup') => {
    try {
      await update(ref(rtdb, `onlineOrders/${order.id}`), { deliveryMethod: newMethod });
    } catch (error) {
      console.error('Error updating delivery method:', error);
    }
  };

  const saveOrderItems = async (order: OnlineOrder, newItems: OnlineOrder['items']) => {
    try {
      const oldItems = order.items;
      
      // Calculate stock changes
      const stockChanges: { [productId: string]: number } = {};
      
      // Add back old items
      for (const item of oldItems) {
        stockChanges[item.productId] = (stockChanges[item.productId] || 0) + item.quantity;
      }
      
      // Remove new items
      for (const item of newItems) {
        stockChanges[item.productId] = (stockChanges[item.productId] || 0) - item.quantity;
      }
      
      const updates: any = {};
      
      // Update stocks
      for (const [productId, change] of Object.entries(stockChanges)) {
        if (change === 0 || !productId || productId === 'undefined') continue;
        const product = products.find(p => p.id === productId);
        if (product) {
          updates[`products/${productId}/stock`] = (product.stock || 0) + change;
        }
      }
      
      // Update order
      const newTotal = newItems.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0);
      updates[`onlineOrders/${order.id}/items`] = newItems;
      updates[`onlineOrders/${order.id}/total`] = newTotal;

      await update(ref(rtdb), updates);
      
      setIsEditingItems(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error saving order items:', error);
      alert('Erreur lors de la sauvegarde des articles.');
    }
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    const order = orders.find(o => o.id === orderToDelete);
    if (order && isLocked(order.timestamp, settings.lockingPeriodDays || 0)) {
      alert("Cette commande est verrouillée par la période de clôture et ne peut pas être supprimée.");
      setOrderToDelete(null);
      return;
    }
    try {
      await remove(ref(rtdb, `onlineOrders/${orderToDelete}`));
      setOrderToDelete(null);
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Erreur lors de la suppression de la commande.');
    }
  };

  const handleManualSync = async (order: OnlineOrder) => {
    setIsSyncing(order.id);
    await syncOrder(order);
    setIsSyncing(null);
  };

  const handleYassirRequest = async (order: OnlineOrder) => {
    try {
      const updates: any = {
        assignedEmployeeId: 'YASSIR_EXT',
        assignedEmployeeName: 'Yassir Express'
      };
      await update(ref(rtdb, `onlineOrders/${order.id}`), updates);
      toast.success(t("Commande assignée à Yassir Express. Veuillez finaliser la demande sur votre application Yassir."));
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'assignation");
    }
  };

  const handlePrintOrder = (order: OnlineOrder) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="padding: 8px 0;">${item.name} x${item.quantity}</td>
        <td style="padding: 8px 0; text-align: right;">${(item.price || 0).toFixed(2)} {settings.currency}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Commande #${order.externalOrderId}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { max-width: 100px; margin-bottom: 10px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; }
            .total { font-weight: bold; font-size: 1.2em; }
            .footer { text-align: center; margin-top: 20px; font-size: 0.8em; }
            .qr-container { margin-top: 20px; display: flex; justify-content: center; }
          </style>
        </head>
        <body>
          <div class="header">
            ${settings.logoUrl ? `<img src="${settings.logoUrl}" class="logo" />` : ''}
            <h2>${settings.name}</h2>
            <p>COMMANDE EN LIGNE</p>
            <p>#${order.externalOrderId}</p>
            <p>Source: ${order.source}</p>
            <p>Type: ${order.deliveryMethod === 'delivery' ? 'LIVRAISON' : 'RETRAIT EN MAGASIN'}</p>
            <p>${format(new Date(order.timestamp), 'dd/MM/yyyy HH:mm')}</p>
          </div>
          <div class="divider"></div>
          <div style="font-size: 0.9em; margin-bottom: 10px;">
            <p><strong>Client:</strong> ${order.customerName}</p>
            <p><strong>Tél:</strong> ${order.customerPhone}</p>
            <p><strong>Adresse:</strong> ${order.shippingAddress || 'N/A'}</p>
          </div>
          <div class="divider"></div>
          <table>
            ${itemsHtml}
          </table>
          <div class="divider"></div>
          <div style="display: flex; justify-content: space-between;" class="total">
            <span>TOTAL</span>
            <span>${(order.total || 0).toFixed(2)} {settings.currency}</span>
          </div>
          <div class="qr-container" id="qr"></div>
          <div class="footer">
            <p>${settings.footerText || 'Merci de votre commande !'}</p>
          </div>
          <script src="https://unpkg.com/qrcode-generator@1.4.4/qrcode.js"></script>
          <script>
            window.onload = () => {
              const qr = qrcode(0, 'M');
              qr.addData('${order.id}');
              qr.make();
              document.getElementById('qr').innerHTML = qr.createSvgTag(3, 0);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Commandes en Ligne</h3>
          <p className="text-sm text-white/40">{orders.length} commandes reçues</p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-white shadow-sm transition-all hover:bg-white/10"
          >
            <option value="all" className="bg-[#0a0a0f]">Tous les statuts</option>
            <option value="pending" className="bg-[#0a0a0f]">En attente</option>
            <option value="confirmed" className="bg-[#0a0a0f]">Confirmé</option>
            <option value="shipped" className="bg-[#0a0a0f]">Expédié</option>
            <option value="delivered" className="bg-[#0a0a0f]">Livré</option>
          </select>
          <select 
            value={deliveryFilter}
            onChange={(e) => setDeliveryFilter(e.target.value)}
            className="p-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-white shadow-sm transition-all hover:bg-white/10"
          >
            <option value="all" className="bg-[#0a0a0f]">Tous les types</option>
            <option value="delivery" className="bg-[#0a0a0f]">Livraison</option>
            <option value="pickup" className="bg-[#0a0a0f]">Retrait Magasin</option>
          </select>
          <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md p-3 rounded-xl border border-white/10 shadow-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${autoSync ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-white/20'}`} />
              <span className="text-xs font-black uppercase tracking-widest text-white/60">Synchro Auto</span>
            </div>
            <button 
              onClick={() => setAutoSync(!autoSync)}
              className={cn(
                "relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none",
                autoSync ? "bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.3)]" : "bg-white/10"
              )}
            >
              <span className={cn(
                "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm",
                autoSync ? "translate-x-6" : "translate-x-0.5"
              )} />
            </button>
          </div>
        </div>
      </div>

      <Card className="overflow-x-auto bg-white/5 backdrop-blur-md border-white/10 shadow-2xl rounded-2xl">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="border-b border-white/10">
              <th className="p-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Date</th>
              <th className="p-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Client</th>
              <th className="p-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Type</th>
              <th className="p-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Total</th>
              <th className="p-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Statut</th>
              <th className="p-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Préparateur</th>
              <th className="p-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Livreur</th>
              <th className="p-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Paiement</th>
              <th className="p-4 text-[10px] font-black text-white/40 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredOrders.map((o: OnlineOrder) => (
              <tr key={o.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="p-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-white/80 font-mono tracking-tight">{formatSafe(o.timestamp, 'dd/MM/yyyy HH:mm')}</span>
                    {o.syncedToPos && (
                      <span className="flex items-center gap-1 text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                        <Check size={8} strokeWidth={3} /> Synchro
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <p className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{o.customerName}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-white/40 font-mono">{o.customerPhone}</p>
                    {o.customerPhone && (
                      <a 
                        href={`https://wa.me/${o.customerPhone.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 transition-colors"
                        title="Contacter sur WhatsApp"
                      >
                        <MessageCircle size={14} />
                      </a>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    <span className={cn(
                      "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit shadow-lg",
                      o.deliveryMethod === 'delivery' ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20" : "bg-amber-500/20 text-amber-300 border border-amber-500/20"
                    )}>
                      {o.deliveryMethod === 'delivery' ? 'Livraison' : 'Retrait'}
                    </span>
                    {o.deliveryMethod === 'pickup' && o.pickupTime && (
                      <span className="text-[9px] font-black text-white/40 uppercase">Heure: {o.pickupTime}</span>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-sm font-black text-white font-mono tracking-tight">{(o.total || 0).toFixed(2)}</span>
                  <span className="text-[10px] text-white/40 ml-1 font-bold">{settings.currency}</span>
                </td>
                <td className="p-4 text-xs">
                  <select 
                    value={o.status}
                    onChange={(e) => updateOrderStatus(o, e.target.value as any)}
                    className={cn(
                      "text-[9px] font-black uppercase tracking-widest rounded-lg px-2.5 py-1.5 outline-none border border-white/5 cursor-pointer transition-all shadow-sm",
                      getStatusColor(o.status).replace('bg-', 'bg-opacity-20 bg-').replace('text-', 'text-')
                    )}
                  >
                    <option value="pending" className="bg-[#0a0a0f]">En attente</option>
                    <option value="confirmed" className="bg-[#0a0a0f]">Confirmé</option>
                    <option value="processing" className="bg-[#0a0a0f]">En préparation</option>
                    <option value="shipped" className="bg-[#0a0a0f]">Expédié</option>
                    <option value="delivered" className="bg-[#0a0a0f]">Livré</option>
                    <option value="cancelled" className="bg-[#0a0a0f]">Annulé</option>
                  </select>
                </td>
                <td className="p-4">
                  <select
                    value={o.assignedPickerId || ''}
                    onChange={(e) => assignPickerToOrder(o, e.target.value)}
                    className="text-[10px] bg-white/5 border border-white/10 text-white rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 w-full max-w-[120px] transition-all font-bold"
                  >
                    <option value="" className="bg-[#0a0a0f]">Auto-Assigné</option>
                    {employees.filter(e => e.role === 'picker').map(e => (
                      <option key={e.id} value={e.id} className="bg-[#0a0a0f]">{e.name}</option>
                    ))}
                  </select>
                </td>
                <td className="p-4">
                  <select
                    value={o.assignedEmployeeId || ''}
                    onChange={(e) => {
                      if (e.target.value === 'YASSIR_EXT') {
                        handleYassirRequest(o);
                      } else {
                        assignOrderToEmployee(o, e.target.value);
                      }
                    }}
                    className={cn(
                      "text-[10px] bg-white/5 border border-white/10 text-white rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 w-full max-w-[120px] transition-all font-bold",
                      o.assignedEmployeeId === 'YASSIR_EXT' ? "bg-[#f2ec24]/20 text-[#f2ec24] border-[#f2ec24]/50" : ""
                    )}
                    disabled={o.deliveryMethod !== 'delivery'}
                  >
                    <option value="" className="bg-[#0a0a0f]">{o.deliveryMethod === 'delivery' ? 'Choisir Livreur' : 'Pas de livraison'}</option>
                    <option value="YASSIR_EXT" className="bg-[#0a0a0f] text-[#f2ec24] font-black">🚕 Yassir Express</option>
                    {employees.filter(e => e.role === 'delivery').map(e => (
                      <option key={e.id} value={e.id} className="bg-[#0a0a0f]">{e.name}</option>
                    ))}
                  </select>
                </td>
                <td className="p-4">
                  <select 
                    value={o.paymentStatus || 'unpaid'}
                    onChange={(e) => updateOrderPaymentStatus(o, e.target.value as any)}
                    className={cn(
                      "text-[9px] font-black uppercase tracking-widest rounded-lg px-2.5 py-1.5 outline-none border border-white/5 cursor-pointer appearance-none transition-all shadow-sm",
                      o.paymentStatus === 'paid' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                    )}
                  >
                    <option className="bg-[#0a0a0f] text-emerald-400" value="paid">Payé</option>
                    <option className="bg-[#0a0a0f] text-rose-400" value="unpaid">Non payé</option>
                  </select>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {!o.syncedToPos && ['confirmed', 'shipped', 'delivered'].includes(o.status) && (
                      <button 
                        onClick={() => handleManualSync(o)}
                        disabled={isSyncing === o.id}
                        className="p-2 text-indigo-400 hover:bg-white/5 rounded-xl transition-all shadow-sm"
                        title="Synchroniser avec la caisse"
                      >
                        {isSyncing === o.id ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                      </button>
                    )}
                    <button 
                      onClick={() => handlePrintOrder(o)}
                      className="p-2 text-white/40 hover:text-indigo-400 hover:bg-white/5 rounded-xl transition-all"
                      title="Imprimer le ticket de commande"
                    >
                      <Printer size={18} />
                    </button>
                    <button 
                      onClick={() => setSelectedOrder(o)}
                      className="p-2 text-white/40 hover:text-indigo-400 hover:bg-white/5 rounded-xl transition-all"
                      title="Voir les détails"
                    >
                      <Eye size={18} />
                    </button>
                    <button 
                      onClick={() => setOrderToDelete(o.id)}
                      className="p-2 text-white/20 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                      title="Supprimer la commande"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">Aucune commande reçue</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {selectedOrder && (
        <Modal isOpen={!!selectedOrder} onClose={() => { setSelectedOrder(null); setIsEditingItems(false); }} title={`Détails Commandes #${selectedOrder.externalOrderId || selectedOrder.id.slice(0, 8)}`}>
          <div className="space-y-8">
            {isEditingItems ? (
              <EditOrderItems order={selectedOrder} onSave={saveOrderItems} onCancel={() => setIsEditingItems(false)} settings={settings} />
            ) : (
              <>
                <div className="bg-white/5 border text-center border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 backdrop-blur-md">
                  <div className="flex-1 text-center items-center justify-center space-y-1 w-full">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Client</p>
                    <p className="text-xl font-bold text-white tracking-tight">{selectedOrder.customerName || 'Client Inconnu'}</p>
                    <div className="flex items-center justify-center gap-3">
                      {selectedOrder.customerPhone && (
                        <a href={`tel:${selectedOrder.customerPhone}`} className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono">
                          <Phone size={14} /> {selectedOrder.customerPhone}
                        </a>
                      )}
                      {selectedOrder.customerPhone && (
                        <a 
                          href={`https://wa.me/${selectedOrder.customerPhone.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-emerald-500/30 transition-all shadow-sm border border-emerald-500/20"
                        >
                          <MessageCircle size={12} /> WhatsApp
                        </a>
                      )}
                    </div>
                    {selectedOrder.customerEmail && <p className="text-xs text-white/40 font-mono italic">{selectedOrder.customerEmail}</p>}
                  </div>

                  <div className="hidden md:block w-px h-16 bg-white/10" />

                  <div className="flex-1 text-center items-center justify-center space-y-3 w-full">
                    <div className="flex flex-col items-center gap-2 justify-center">
                      <span className={cn(
                        "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg",
                        selectedOrder.deliveryMethod === 'delivery' ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20" : "bg-amber-500/20 text-amber-300 border border-amber-500/20"
                      )}>
                        {selectedOrder.deliveryMethod === 'delivery' ? (
                          <><Truck size={14} /> Livraison</>
                        ) : (
                          <><ShoppingBag size={14} /> Retrait Magasin</>
                        )}
                      </span>
                      {selectedOrder.deliveryMethod === 'pickup' && selectedOrder.pickupTime && (
                        <p className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20 animate-pulse uppercase tracking-widest">
                          Heure de retrait: {selectedOrder.pickupTime}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Date de création</p>
                      <p className="text-sm font-bold text-white/80 font-mono">{formatSafe(selectedOrder.timestamp, 'dd MMMM yyyy à HH:mm')}</p>
                      <span className="inline-block px-2 py-0.5 bg-white/5 text-white/40 text-[9px] font-black uppercase tracking-widest rounded-lg mt-1 border border-white/5">Source: {selectedOrder.source}</span>
                    </div>
                  </div>
                </div>

                {selectedOrder.shippingAddress && selectedOrder.deliveryMethod === 'delivery' && (
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 flex items-center gap-2">
                       <MapPin size={12} className="text-rose-500" /> Adresse de Livraison
                    </p>
                    <div className="flex justify-between items-start gap-4">
                      <p className="text-sm text-white/80 font-medium leading-relaxed flex-1 italic">{selectedOrder.shippingAddress}</p>
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedOrder.shippingAddress)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-white/10 text-white rounded-xl shadow-lg border border-white/10 hover:bg-white/20 transition-all flex items-center gap-1 text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
                      >
                         <Navigation size={12} /> Itinéraire
                      </a>
                    </div>
                  </div>
                )}

                <div className="bg-white/5 border rounded-2xl p-6 shadow-2xl text-center border-white/10 backdrop-blur-md">
                  <p className="text-xs font-black text-white/60 uppercase tracking-widest text-left mb-4 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-indigo-400"><Package size={14}/> Articles Commandés</span>
                    <span className="text-[10px] font-black text-white/20">Vérifier avant emballage</span>
                  </p>
                  <div className="space-y-2">
                    {selectedOrder.items
                      .slice()
                      .sort((a, b) => {
                        const prodA = products.find(p => p.id === (a.productId || (a as any).id));
                        const prodB = products.find(p => p.id === (b.productId || (b as any).id));
                        const locA = prodA?.location || 'ZZZ';
                        const locB = prodB?.location || 'ZZZ';
                        return locA.localeCompare(locB);
                      })
                      .map((item, idx) => {
                        const itemKey = item.lineId || `pick-item-${idx}`;
                        const productRef = products.find(p => p.id === (item.productId || (item as any).id));
                        return (
                          <div key={itemKey} className="flex items-center gap-4 p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                            <div className="flex items-center justify-center">
                              <input 
                                type="checkbox" 
                                id={`check-${itemKey}`} 
                                className="w-5 h-5 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                              />
                            </div>
                            
                            {/* Product Thumbnail */}
                            <div 
                              className="w-12 h-12 rounded-xl bg-white/10 border border-white/10 overflow-hidden shrink-0 cursor-zoom-in"
                              onClick={() => {
                                const mainImg = productRef?.imageUrl || (productRef?.imageUrls && productRef.imageUrls[0]);
                                if (mainImg) setEnlargedImage(mainImg);
                              }}
                            >
                              {(() => {
                                const imgSrc = productRef?.imageUrl || productRef?.imageUrls?.[0];
                                return imgSrc && imgSrc.trim() !== '' ? (
                                  <img 
                                    src={imgSrc} 
                                    className="w-full h-full object-cover" 
                                    referrerPolicy="no-referrer" 
                                    alt={item.name}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/20">
                                    <Package size={20} />
                                  </div>
                                );
                              })()}
                            </div>

                            <label htmlFor={`check-${itemKey}`} className="flex-1 flex justify-between items-center cursor-pointer min-w-0">
                              <div className="text-left truncate mr-2">
                                <div className="flex items-center gap-2">
                                  {productRef?.location && (
                                    <span className="px-1.5 py-0.5 bg-indigo-500 text-white rounded text-[10px] font-black uppercase tracking-widest shrink-0 shadow-lg shadow-indigo-500/20">
                                      {productRef.location}
                                    </span>
                                  )}
                                  <p className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors truncate">{item.name}</p>
                                </div>
                                <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-0.5">{(item.price || 0).toFixed(2)} {settings.currency} x {item.quantity}</p>
                              </div>
                              <p className="text-lg font-black text-white font-mono tracking-tighter">{((item.price || 0) * (item.quantity || 0)).toFixed(2)}</p>
                            </label>
                          </div>
                        );
                      })}
                  </div>

                  <div className="border-t border-dashed border-white/10 mt-6 pt-6 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest text-left">Total de la commande</p>
                      <p className="text-xs font-bold text-indigo-400 mt-1">Taxes et service inclus</p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-black text-white tracking-tighter">
                        {(selectedOrder.total || 0).toFixed(2)} <span className="text-xl text-white/40">{settings.currency}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-3 pt-4">
                  <Button onClick={() => handlePrintOrder(selectedOrder)} className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border-white/10 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl h-auto">
                    <Printer size={18} /> Imprimer Ticket
                  </Button>
                  
                  {selectedOrder.status === 'pending' && (
                    <Button variant="secondary" onClick={() => updateOrderStatus(selectedOrder, 'confirmed')} className="flex-1 bg-indigo-500 text-white hover:bg-indigo-600 border-none font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl h-auto shadow-lg shadow-indigo-500/20">
                      Confirmer la Cde
                    </Button>
                  )}
                  
                  {selectedOrder.status === 'pending' && (
                    <Button onClick={() => setIsEditingItems(true)} className="flex-1 flex items-center justify-center gap-2 bg-amber-500 text-white hover:bg-amber-600 border-none font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl h-auto shadow-lg shadow-amber-500/20">
                      <Edit size={18} /> Modifier Articles
                    </Button>
                  )}
                  
                  {selectedOrder.status === 'confirmed' && selectedOrder.deliveryMethod === 'delivery' && (
                    <Button variant="secondary" onClick={() => updateOrderStatus(selectedOrder, 'shipped')} className="flex-1 bg-indigo-500 text-white hover:bg-indigo-600 border-none font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl h-auto shadow-lg shadow-indigo-500/20">
                      Marquer Expédié
                    </Button>
                  )}
                </div>
                
                {selectedOrder.deliveryMethod === 'delivery' && selectedOrder.assignedEmployeeId !== 'YASSIR_EXT' && (
                  <div className="pt-2">
                    <Button 
                      onClick={() => handleYassirRequest(selectedOrder)} 
                      className="w-full flex items-center justify-center gap-2 bg-[#f2ec24] text-black hover:bg-[#dcd01b] border-none font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl h-auto shadow-lg shadow-[#f2ec24]/20"
                    >
                      <Truck size={18} /> {t("Demander livreur Yassir")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog 
        isOpen={!!orderToDelete}
        onClose={() => setOrderToDelete(null)}
        onConfirm={confirmDeleteOrder}
        title="Supprimer la commande"
        message="Êtes-vous sûr de vouloir supprimer cette commande ? Cette action est irréversible."
        confirmText="Supprimer"
        variant="danger"
      />

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
    </div>
  );
}
