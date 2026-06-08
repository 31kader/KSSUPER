import { DEFAULT_PERMISSIONS } from '../constants';
import React, { useState, useMemo, memo, useEffect, useRef, useDeferredValue } from 'react';
import { Package, Tag, RefreshCw, LayoutGrid, Plus, FileSpreadsheet, Upload, ShoppingBag, AlertTriangle, Zap, Info, Search, Filter, Scan, LayoutList, Layers, Truck, ArrowUpDown, Award, Calendar, FolderTree, AlertCircle, TrendingDown, ShieldCheck, RotateCcw, Check, Printer, Copy, PackageOpen, Trash2, ChevronUp, BarcodeIcon, ShoppingCart, Eye, X, MessageCircle, Phone, MapPin, Navigation, Edit, Clock, Mail, Percent, DollarSign, Star, Palette, FileText, AlignLeft, Shield, UserCog, Link2, MapIcon, Brain, Database, ArrowRight, CreditCard, Banknote, Minus, UserPlus, ChevronDown, Users, ArrowUpRight, ArrowDownRight, LogOut, Bell, TrendingUp, History, EyeOff, LogIn, Store, Gift, Wallet, Edit2, MessageSquare, CheckCircle2 } from 'lucide-react';
import { rtdb, ref, get, rtdbQuery, orderByChild, equalTo, push, set, update, child } from '../database';
import { auth, handleFirestoreError, OperationType } from '../database';
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

export function DeliveryDashboard({ user, profile, onLogout, settings, onlineOrders, customers }: any) {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const isPicker = profile?.role === 'picker';
  const roleName = isPicker ? 'Ramasseur' : 'Livreur';

  // Filter orders assigned to this person or available to them
  const myOrders = onlineOrders.filter((o: any) => {
    // Pickers look for assigned orders (to prepare them) or confirmed ones if admin-testing
    if (isPicker) {
      return (o.assignedPickerId === profile?.employeeId) || 
             (profile?.role === 'admin' && (o.status === 'confirmed' || o.status === 'processing'));
    }
    
    // Delivery people look for shipped orders assigned to them
    return o.deliveryMethod === 'delivery' && 
           (o.assignedEmployeeId === profile?.employeeId || (profile?.role === 'admin' && o.status === 'shipped'));
  });

  const pendingStatuses = isPicker ? ['pending', 'confirmed', 'processing'] : ['shipped', 'confirmed'];
  const pendingOrders = myOrders.filter((o: any) => pendingStatuses.includes(o.status));
  const pastOrders = myOrders.filter((o: any) => o.status === 'delivered');

  // Sound notification for new assignments
  const pendingCountRef = useRef(pendingOrders.length);
  useEffect(() => {
    if (pendingOrders.length > pendingCountRef.current) {
      // New order assigned!
      const playAssignmentSound = () => {
        try {
          const AudioContextCls = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (typeof AudioContextCls !== 'function') return;
          const canUseNew = AudioContextCls.prototype && typeof AudioContextCls.prototype === 'object';
          const audioCtx = canUseNew ? new AudioContextCls() : (typeof AudioContextCls === 'function' ? AudioContextCls() : null);
          if (!audioCtx) return;
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.2);
          gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.2);
        } catch(e) {
          console.warn("AudioContext failed:", e);
        }
      };
      playAssignmentSound();
    }
    pendingCountRef.current = pendingOrders.length;
  }, [pendingOrders.length]);

  const handleUpdateStatus = async (order: any, newStatus: string) => {
    setIsProcessing(order.id);
    try {
      const historyEntry = {
        status: newStatus,
        changedBy: profile?.employeeId || user.email,
        timestamp: new Date().toISOString()
      };
      
      const updates: any = {
        status: newStatus,
        statusHistory: [...(order.statusHistory || []), historyEntry]
      };

      // Find customer ID if null but we have their phone or name
      let finalCustomerId = order.customerId;
      if (!finalCustomerId && customers) {
        const found = customers.find((c: Customer) => 
          (order.customerPhone && c.phone && c.phone.replace(/\D/g, '') === order.customerPhone.replace(/\D/g, '')) || 
          (c.name.toLowerCase() === order.customerName?.toLowerCase())
        );
        if (found) {
          finalCustomerId = found.id;
          updates.customerId = found.id;
        }
      }

      // Perform transaction logging only if marking as delivered and previously not
      if (newStatus === 'delivered' && order.status !== 'delivered') {
        if (!order.syncedToPos) {
          const txRef = push(ref(rtdb, 'transactions'));
          const transaction: any = {
            id: txRef.key,
            items: order.items,
            total: order.total,
            timestamp: new Date().toISOString(),
            paymentMethod: order.paymentMethod || 'cash',
            status: 'completed',
            employeeName: profile?.displayName || user.email,
            userId: user.uid,
            onlineOrderId: order.id,
            customerId: finalCustomerId || null,
            customerName: order.customerName || null,
            pointsEarned: finalCustomerId ? Math.floor(order.total * (settings.loyaltyPointsPerCurrencyUnit || 1)) : 0
          };
          await set(txRef, transaction);
          updates.syncedToPos = true;
        }

        // Update customer's loyalty points
        if (finalCustomerId) {
          try {
            const customerRef = ref(rtdb, `customers/${finalCustomerId}`);
            const customerSnap = await get(customerRef);
            if (customerSnap.exists()) {
              const customerData = customerSnap.val();
              const pointsEarned = Math.floor(order.total * (settings.loyaltyPointsPerCurrencyUnit || 1));
              await update(customerRef, {
                loyaltyPoints: (customerData.loyaltyPoints || 0) + pointsEarned,
                totalSpent: (customerData.totalSpent || 0) + order.total,
                lastVisit: new Date().toISOString()
              });
            }
          } catch (e) {
            console.error("Failed to update customer loyalty points:", e);
          }
        }

      }

      await update(ref(rtdb, `onlineOrders/${order.id}`), updates);
      
      // Play a small success sound
      try {
        const AudioContextCls = (window as any).AudioContext || (window as any).webkitAudioContext; 
        if (typeof AudioContextCls === 'function') {
          const audioCtx = new AudioContextCls();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(1500, audioCtx.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.1);
        }
      } catch(e) {
         console.warn("Success sound audio failed:", e);
      }
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Erreur: impossible de mettre à jour la commande');
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Mobile-friendly Header */}
      <div className="bg-indigo-600 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            {isPicker ? <Package size={20} /> : <Truck size={20} />}
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Portail {roleName}</h1>
            <p className="text-indigo-200 text-[10px] uppercase font-bold">{profile?.displayName || user.email}</p>
          </div>
        </div>
        <button onClick={onLogout} className="p-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-colors">
          <LogOut size={20} />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-6 max-w-lg mx-auto w-full">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center">
            <h3 className="text-3xl font-black text-indigo-600">{pendingOrders.length}</h3>
            <p className="text-xs font-bold text-slate-500 uppercase">À Livrer</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center">
            <h3 className="text-3xl font-black text-emerald-600">{pastOrders.length}</h3>
            <p className="text-xs font-bold text-slate-500 uppercase">Livrées</p>
          </div>
        </div>

        {/* Custom Tabs */}
        <div className="flex p-1 bg-slate-200 rounded-xl">
          <button 
            onClick={() => setActiveTab('pending')}
            className={cn(
              "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
              activeTab === 'pending' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
            )}
          >
            Missions ({pendingOrders.length})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
              activeTab === 'history' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
            )}
          >
            Terminées
          </button>
        </div>

        {/* Order List */}
        <div className="space-y-4">
          {(activeTab === 'pending' ? pendingOrders : pastOrders).map((order: any) => (
            <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-50 flex justify-between items-start bg-indigo-50/30">
                <div>
                  <h3 className="font-black text-slate-800 text-lg">#{order.id.slice(0, 8).toUpperCase()}</h3>
                  <p className="text-xs text-slate-500">{format(new Date(order.timestamp), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                  order.status === 'confirmed' ? "bg-blue-100 text-blue-700" :
                  order.status === 'processing' ? "bg-indigo-100 text-indigo-700" :
                  order.status === 'shipped' ? "bg-purple-100 text-purple-700" :
                  order.status === 'delivered' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                )}>
                  {order.status === 'confirmed' ? 'Prête' :
                   order.status === 'processing' ? 'En préparation' :
                   order.status === 'shipped' ? 'En livraison' :
                   order.status === 'delivered' ? 'Livrée' : order.status}
                </span>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Customer Info */}
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                    <Users size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 truncate">{order.customerName}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <a href={`tel:${order.customerPhone}`} className="text-slate-600 font-bold text-xs flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg">
                        <Phone size={12} /> Appeler
                      </a>
                      <a 
                        href={`https://wa.me/${order.customerPhone?.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-emerald-600 font-bold text-xs flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg"
                      >
                        <MessageCircle size={12} /> WhatsApp
                      </a>
                    </div>
                  </div>
                </div>

                {/* Location */}
                {order.shippingAddress && (
                  <div className="flex gap-4 p-3 bg-slate-50 rounded-xl relative group">
                    <MapPin className="text-rose-500 shrink-0 mt-0.5" size={18} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Adresse</p>
                      <p className="text-sm font-medium text-slate-700">{order.shippingAddress}</p>
                    </div>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.shippingAddress)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-white text-rose-500 rounded-lg shadow-sm border border-slate-100 self-center"
                    >
                      <Navigation size={18} />
                    </a>
                  </div>
                )}
                
                {/* Total */}
                <div className="flex justify-between items-center py-2 border-t border-slate-100">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">À Encaisser</span>
                  <span className="text-xl font-black text-slate-900">{order.total.toFixed(2)} {settings.currency}</span>
                </div>

                {/* Actions */}
                {activeTab === 'pending' && (
                  <div className="space-y-3 pt-2">
                    {/* Picker Flow */}
                    {isPicker && (
                      order.status === 'confirmed' ? (
                        <button 
                          onClick={() => handleUpdateStatus(order, 'processing')}
                          disabled={isProcessing === order.id}
                          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl active:bg-indigo-700 disabled:opacity-50"
                        >
                          {isProcessing === order.id ? "..." : "Démarrer Préparation"}
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleUpdateStatus(order, 'shipped')} // In picker context, shipping means ready for delivery
                          disabled={isProcessing === order.id}
                          className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl active:bg-emerald-700 disabled:opacity-50"
                        >
                          {isProcessing === order.id ? "..." : "Prêt pour Livraison"}
                        </button>
                      )
                    )}

                    {/* Delivery Flow */}
                    {!isPicker && (
                      order.status === 'confirmed' ? (
                        <button 
                          onClick={() => handleUpdateStatus(order, 'shipped')}
                          disabled={isProcessing === order.id}
                          className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl active:bg-blue-700 disabled:opacity-50"
                        >
                          {isProcessing === order.id ? "..." : "Démarrer Livraison"}
                        </button>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <button 
                             onClick={() => {
                               if(confirm("Confirmer le retour au magasin ?")) {
                                 handleUpdateStatus(order, 'confirmed');
                               }
                             }}
                            disabled={isProcessing === order.id}
                            className="py-3 bg-slate-100 text-slate-600 font-bold rounded-xl active:bg-slate-200 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <RotateCcw size={18} /> Retour
                          </button>
                          <button 
                            onClick={() => {
                              if(confirm("Confirmer la livraison au client ?")) {
                                handleUpdateStatus(order, 'delivered');
                              }
                            }}
                            disabled={isProcessing === order.id}
                            className="py-3 bg-emerald-600 text-white font-bold rounded-xl active:bg-emerald-700 shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <Check size={18} /> Livré
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {(activeTab === 'pending' ? pendingOrders : pastOrders).length === 0 && (
            <div className="text-center p-8 bg-white border border-slate-200 border-dashed rounded-2xl">
              <Package size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="font-bold text-slate-600">Aucune commande {activeTab === 'pending' ? 'en attente' : 'terminée'}</p>
              <p className="text-sm text-slate-400 mt-1">Vous êtes à jour !</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
