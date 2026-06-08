import React, { useState, useEffect, memo } from 'react';
import { 
  Plus, Truck, RefreshCw, Package, Trash2, X, Phone, Mail, 
  History, Wallet, AlertTriangle, FileText, Calendar, Clock, 
  CheckCircle2, Shuffle, CreditCard, Edit, TrendingUp, Search,
  Bell, ChevronLeft, ChevronRight, AlertCircle, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import bcrypt from 'bcryptjs';
import { supabase } from '../supabase';
import { 
  Supplier, Product, CompanySettings, Category, DamagedRecord, SupplierPayment 
} from '../types';
import { Button, Card, Modal, ConfirmDialog } from './ui';
import { cn, formatSafe } from '../lib/utils';

export const Suppliers = memo(function Suppliers({ 
  suppliers, products, settings, purchases, supplierPayments, 
  setViewingPurchaseVoucher, categories, user, damagedItems 
}: { 
  suppliers: Supplier[], products: Product[], settings: CompanySettings, 
  purchases: any[], supplierPayments: any[], 
  setViewingPurchaseVoucher: (p: any) => void, categories: Category[], 
  user: any, damagedItems: DamagedRecord[] 
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [viewingDetailsSupplier, setViewingDetailsSupplier] = useState<Supplier | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [activeDetailsTab, setActiveDetailsTab] = useState<'products' | 'purchases' | 'payments' | 'damaged'>('products');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activeSupplierTab, setActiveSupplierTab] = useState<'list' | 'planning'>('list');
  const [editingPayment, setEditingPayment] = useState<SupplierPayment | null>(null);
  const [paymentData, setPaymentData] = useState<{ amount: number, method: 'cash' | 'card' | 'transfer' | 'check', note: string, date: string }>({ amount: 0, method: 'cash', note: '', date: new Date().toISOString() });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [selectedProductForDamage, setSelectedProductForDamage] = useState<Product | null>(null);
  const [damageData, setDamageData] = useState({ quantity: 1, reason: '' });
  const [isProcessingDamage, setIsProcessingDamage] = useState(false);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Reminders & Calendar State
  const [newReminderData, setNewReminderData] = useState({
    supplierId: '',
    title: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
    priority: 'medium' as 'low' | 'medium' | 'high'
  });
  const [reminderFilter, setReminderFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [selectedReminderDate, setSelectedReminderDate] = useState<string | null>(null);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());

  // Purchase Order Auto-Draft State
  const [poDraftItems, setPoDraftItems] = useState<{ productId: string; productName: string; quantity: number; price: number }[]>([]);
  const [isPODraftOpen, setIsPODraftOpen] = useState(false);
  const [isSavingPurchaseOrder, setIsSavingPurchaseOrder] = useState(false);

  // Reminders Helper Computations
  const allReminders = suppliers.flatMap(s => 
    (s.reminders || []).map(r => ({ ...r, supplierId: s.id, supplierName: s.name }))
  );

  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0).getDate();
    
    let startDayIndex = firstDay.getDay();
    startDayIndex = startDayIndex === 0 ? 6 : startDayIndex - 1;
    
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = startDayIndex; i > 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevLastDay - i + 1),
        isCurrentMonth: false
      });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }
    return days;
  };

  const calendarDays = getDaysInMonth(currentCalendarMonth);
  const activeMonthName = currentCalendarMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    categories: [] as string[],
    feedUrl: '',
    feedFormat: 'json' as 'json' | 'csv',
    syncEnabled: false,
    isAppUser: false,
    hasFullInventoryAccess: false,
    password: '',
    preSaleDays: [] as string[],
    deliveryDays: [] as string[],
    paymentDays: [] as string[],
    planningNotes: '',
    ratingQuality: 5,
    ratingDelivery: 5,
    ratingPrice: 5
  });

  useEffect(() => {
    if (editingSupplier) {
      setFormData({
        name: editingSupplier.name || '',
        contactName: editingSupplier.contactName || '',
        phone: editingSupplier.phone || '',
        email: editingSupplier.email || '',
        address: editingSupplier.address || '',
        categories: editingSupplier.categories || [],
        feedUrl: editingSupplier.feedUrl || '',
        feedFormat: editingSupplier.feedFormat || 'json',
        syncEnabled: editingSupplier.syncEnabled || false,
        isAppUser: editingSupplier.isAppUser || false,
        hasFullInventoryAccess: editingSupplier.hasFullInventoryAccess || false,
        password: '',
        preSaleDays: editingSupplier.preSaleDays || [],
        deliveryDays: editingSupplier.deliveryDays || [],
        paymentDays: editingSupplier.paymentDays || [],
        planningNotes: editingSupplier.planningNotes || '',
        ratingQuality: editingSupplier.ratingQuality ?? 5,
        ratingDelivery: editingSupplier.ratingDelivery ?? 5,
        ratingPrice: editingSupplier.ratingPrice ?? 5
      });
    } else {
      setFormData({ 
        name: '', contactName: '', phone: '', email: '', address: '', categories: [],
        feedUrl: '', feedFormat: 'json', syncEnabled: false, isAppUser: false, hasFullInventoryAccess: false, password: '',
        preSaleDays: [], deliveryDays: [], paymentDays: [], planningNotes: '',
        ratingQuality: 5, ratingDelivery: 5, ratingPrice: 5
      });
    }
  }, [editingSupplier]);

  useEffect(() => {
    if (editingPayment) {
      setPaymentData({
        amount: editingPayment.amount,
        method: editingPayment.method,
        note: editingPayment.note || '',
        date: editingPayment.date
      });
    } else {
      setPaymentData({ amount: 0, method: 'cash', note: '', date: new Date().toISOString() });
    }
  }, [editingPayment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let finalData = { ...formData, email: formData.email ? formData.email.trim().toLowerCase() : '' };
      if (formData.password) {
        finalData.password = bcrypt.hashSync(formData.password, 10);
      } else if (editingSupplier) {
        // Keep existing password if not changing
        // @ts-ignore
        const { password, ...rest } = finalData;
        finalData = rest as any;
      }

      const data = { 
        ...finalData, 
        updatedAt: new Date().toISOString() 
      };

      if (editingSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update(data)
          .eq('id', editingSupplier.id);
        if (error) throw error;
      } else {
        const newId = Math.random().toString(36).substring(2, 11);
        const { error } = await supabase.from('suppliers').insert({
          id: newId,
          ...data,
          balance: 0,
          createdAt: new Date().toISOString()
        });
        if (error) throw error;
      }
      setIsModalOpen(false);
      setEditingSupplier(null);
    } catch (error: any) {
      console.error("Error creating/editing supplier:", error);
      alert("Erreur d'enregistrement: " + error.message);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplierToDelete.id);
      if (error) throw error;
      setIsDeleteConfirmOpen(false);
      setSupplierToDelete(null);
    } catch (error: any) {
      console.error("Error deleting supplier:", error);
      alert("Erreur de suppression: " + error.message);
    }
  };

  const handleSync = async (supplier: Supplier) => {
    if (!supplier.feedUrl) return;
    setIsSyncing(supplier.id);
    try {
      console.log(`Syncing from ${supplier.feedUrl} (${supplier.feedFormat})...`);
      
      const response = await fetch(supplier.feedUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      let data: any[] = [];
      
      if (supplier.feedFormat === 'json') {
        data = await response.json();
        if (!Array.isArray(data) && (data as any).products) {
          data = (data as any).products;
        }
      } else {
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) throw new Error('CSV file is empty or missing data');
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, i) => {
            obj[header] = values[i];
          });
          return obj;
        });
      }

      if (!Array.isArray(data)) throw new Error('Invalid data format: expected an array of products');

      const supplierProducts = products.filter(p => p.supplier === supplier.name);
      let updatedCount = 0;
      
      for (const item of data) {
        const sku = item.sku || item.SKU || item.reference || item.id;
        if (!sku) continue;

        const product = supplierProducts.find(p => p.sku === sku);
        if (product) {
          const newPrice = parseFloat(item.price || item.Price || item.sale_price);
          const newStock = parseInt(item.stock || item.Stock || item.quantity || item.qty);
          const newCostPrice = parseFloat(item.cost_price || item.costPrice || item.purchase_price);

          const updates: any = { updatedAt: new Date().toISOString() };
          if (!isNaN(newPrice)) updates.price = newPrice;
          if (!isNaN(newStock)) updates.stock = newStock;
          if (!isNaN(newCostPrice)) updates.costPrice = newCostPrice;

          if (Object.keys(updates).length > 1) {
            if (product.id && product.id !== 'undefined') {
              const { error } = await supabase
                .from('products')
                .update(updates)
                .eq('id', product.id);
              if (error) throw error;
              updatedCount++;
            }
          }
        }
      }

      const { error: syncError } = await supabase
        .from('suppliers')
        .update({
          lastSync: new Date().toISOString()
        })
        .eq('id', supplier.id);
      if (syncError) throw syncError;

      alert(`Synchronisation terminée pour ${supplier.name}. ${updatedCount} produits mis à jour.`);
    } catch (error: any) {
      console.error('Sync failed:', error);
      alert(`La synchronisation a échoué: ${error.message}`);
    } finally {
      setIsSyncing(null);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!viewingDetailsSupplier || paymentData.amount <= 0) return;
    setIsProcessingPayment(true);
    try {
      let paymentDate = new Date().toISOString();
      try {
        if (paymentData.date) {
            paymentDate = new Date(paymentData.date).toISOString();
        }
      } catch (e) {
        console.error("Invalid payment date", e);
      }

      const payment: SupplierPayment = {
        id: editingPayment?.id || '',
        supplierId: viewingDetailsSupplier.id,
        supplierName: viewingDetailsSupplier.name,
        amount: paymentData.amount,
        method: paymentData.method,
        note: paymentData.note,
        date: paymentDate
      };

      const currentBalance = viewingDetailsSupplier.balance || 0;

      if (editingPayment) {
        // Update existing payment
        const { error: payError } = await supabase
          .from('supplierPayments')
          .update(payment)
          .eq('id', editingPayment.id);
        if (payError) throw payError;
        
        // Update supplier balance by the difference
        const diff = paymentData.amount - editingPayment.amount;
        const { error: supError } = await supabase
          .from('suppliers')
          .update({
            balance: currentBalance - diff,
            updatedAt: new Date().toISOString()
          })
          .eq('id', viewingDetailsSupplier.id);
        if (supError) throw supError;
      } else {
        // Create new payment
        const newPaymentId = Math.random().toString(36).substring(2, 11);
        payment.id = newPaymentId;
        const { error: payError } = await supabase
          .from('supplierPayments')
          .insert(payment);
        if (payError) throw payError;

        // Update supplier balance
        const { error: supError } = await supabase
          .from('suppliers')
          .update({
            balance: currentBalance - paymentData.amount,
            updatedAt: new Date().toISOString()
          })
          .eq('id', viewingDetailsSupplier.id);
        if (supError) throw supError;
      }

      setIsPaymentModalOpen(false);
      setEditingPayment(null);
      setPaymentData({ amount: 0, method: 'cash', note: '', date: new Date().toISOString() });
    } catch (error: any) {
      console.error("Error submitting supplier payment:", error);
      alert("Erreur de paiement : " + error.message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleDamageSubmit = async () => {
    if (!selectedProductForDamage || damageData.quantity <= 0) return;
    setIsProcessingDamage(true);
    try {
      const recordId = Math.random().toString(36).substring(2, 11);
      const record: DamagedRecord = {
        id: recordId,
        productId: selectedProductForDamage.id,
        productName: selectedProductForDamage.name,
        quantity: damageData.quantity,
        reason: damageData.reason,
        date: new Date().toISOString(),
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Admin',
        claimStatus: 'to_claim',
        costPrice: selectedProductForDamage.costPrice || 0
      };
      
      const { error: recordError } = await supabase
        .from('damaged_items')
        .insert(record);
      if (recordError) throw recordError;

      // 2. Adjust stock
      if (selectedProductForDamage.id && selectedProductForDamage.id !== 'undefined') {
        const currentStock = selectedProductForDamage.stock || 0;
        const currentDamaged = selectedProductForDamage.damagedStock || 0;
        
        const { error: prodError } = await supabase
          .from('products')
          .update({
            stock: currentStock - damageData.quantity,
            damagedStock: currentDamaged + damageData.quantity,
            updatedAt: new Date().toISOString()
          })
          .eq('id', selectedProductForDamage.id);
        if (prodError) throw prodError;
      }

      setIsDamageModalOpen(false);
      setSelectedProductForDamage(null);
      setDamageData({ quantity: 1, reason: '' });
    } catch (error: any) {
      console.error("Error submitting damage record:", error);
      alert("Erreur de signalement : " + error.message);
    } finally {
      setIsProcessingDamage(false);
    }
  };

  const handleUpdateClaimStatus = async (recordId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('damaged_items')
        .update({
          claimStatus: status as any,
          updatedAt: new Date().toISOString()
        })
        .eq('id', recordId);
      if (error) throw error;
    } catch (error: any) {
      console.error("Error updating claim status:", error);
      alert("Erreur: " + error.message);
    }
  };

  const handleAddReminder = async (supplierId: string, reminderData: { title: string, notes: string, date: string, priority: 'low' | 'medium' | 'high' }) => {
    try {
      const supplier = suppliers.find(s => s.id === supplierId);
      if (!supplier) return;
      const newReminder = {
        id: Math.random().toString(36).substring(2, 9),
        title: reminderData.title,
        notes: reminderData.notes || '',
        date: reminderData.date,
        priority: reminderData.priority,
        isCompleted: false
      };
      const currentReminders = supplier.reminders || [];
      const { error } = await supabase
        .from('suppliers')
        .update({
          reminders: [...currentReminders, newReminder],
          updatedAt: new Date().toISOString()
        })
        .eq('id', supplierId);
      if (error) throw error;
      setNewReminderData(prev => ({ ...prev, title: '', notes: '' }));
    } catch (error: any) {
      console.error("Error adding reminder:", error);
      alert("Erreur: " + error.message);
    }
  };

  const handleToggleReminder = async (supplierId: string, reminderId: string) => {
    try {
      const supplier = suppliers.find(s => s.id === supplierId);
      if (!supplier) return;
      const updatedReminders = (supplier.reminders || []).map(r => 
        r.id === reminderId ? { ...r, isCompleted: !r.isCompleted } : r
      );
      const { error } = await supabase
        .from('suppliers')
        .update({
          reminders: updatedReminders,
          updatedAt: new Date().toISOString()
        })
        .eq('id', supplierId);
      if (error) throw error;
    } catch (error: any) {
      console.error("Error toggling reminder:", error);
      alert("Erreur: " + error.message);
    }
  };

  const handleDeleteReminder = async (supplierId: string, reminderId: string) => {
    try {
      const supplier = suppliers.find(s => s.id === supplierId);
      if (!supplier) return;
      const updatedReminders = (supplier.reminders || []).filter(r => r.id !== reminderId);
      const { error } = await supabase
        .from('suppliers')
        .update({
          reminders: updatedReminders,
          updatedAt: new Date().toISOString()
        })
        .eq('id', supplierId);
      if (error) throw error;
    } catch (error: any) {
      console.error("Error deleting reminder:", error);
      alert("Erreur: " + error.message);
    }
  };

  const handlePaymentDelete = async (payment: SupplierPayment) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce versement ? Cela réajustera la dette du fournisseur.')) return;
    try {
      const supplier = suppliers.find(s => s.id === payment.supplierId);
      
      const { error: payError } = await supabase
        .from('supplierPayments')
        .delete()
        .eq('id', payment.id);
      if (payError) throw payError;
      
      if (supplier) {
        const { error: supError } = await supabase
          .from('suppliers')
          .update({
            balance: (supplier.balance || 0) + payment.amount,
            updatedAt: new Date().toISOString()
          })
          .eq('id', payment.supplierId);
        if (supError) throw supError;
      }
    } catch (error: any) {
      console.error("Error deleting payment:", error);
      alert("Erreur : " + error.message);
    }
  };

  const handleSavePurchaseOrderDraft = async () => {
    if (!viewingDetailsSupplier || poDraftItems.length === 0) return;
    setIsSavingPurchaseOrder(true);
    try {
      const orderNumber = `BC-${Date.now().toString().slice(-6)}`;
      const total = poDraftItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      
      const newOrderId = Math.random().toString(36).substring(2, 11);
      const { error } = await supabase.from('purchaseOrders').insert({
        id: newOrderId,
        supplierId: viewingDetailsSupplier.id,
        supplierName: viewingDetailsSupplier.name,
        orderNumber,
        items: poDraftItems.map(it => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          price: it.price
        })),
        total,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      if (error) throw error;
      alert(`Bon de Commande ${orderNumber} enregistré avec succès !`);
      setIsPODraftOpen(false);
      setPoDraftItems([]);
    } catch (error: any) {
      console.error("Error saving purchase order draft:", error);
      alert("Erreur: " + error.message);
    } finally {
      setIsSavingPurchaseOrder(false);
    }
  };

  return (
    <div className="space-y-6">
    <div className="bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden group mb-8">
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32 transition-colors group-hover:bg-indigo-500/10" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div>
          <h3 className="text-3xl font-black text-white tracking-widest uppercase italic">Suppliers<span className="text-indigo-500">.hub</span></h3>
          <div className="text-[10px] font-black text-white/40 flex items-center gap-2 uppercase tracking-[0.2em] mt-1 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 w-fit">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Réseau de {suppliers.length} partenaires commerciaux
          </div>
        </div>
        <Button 
          onClick={() => { setEditingSupplier(null); setIsModalOpen(true); }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.25rem] px-8 py-6 font-black uppercase tracking-widest text-[11px] shadow-neon-indigo transition-all hover:scale-105 active:scale-95 flex items-center gap-3 border border-indigo-400/50"
        >
          <Plus size={20} strokeWidth={3} /> Nouveau Partenaire
        </Button>
      </div>
      
      <div className="flex gap-4 mt-8 pt-6 border-t border-white/10 relative z-10">
        <button
          onClick={() => setActiveSupplierTab('list')}
          className={cn(
            "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2",
            activeSupplierTab === 'list'
              ? "bg-indigo-600 border-indigo-500 text-white shadow-neon-indigo scale-105"
              : "bg-white/5 border-white/5 text-white/50 hover:bg-white/10 hover:text-white"
          )}
        >
          💼 Liste d'Affaires
        </button>
        <button
          onClick={() => setActiveSupplierTab('planning')}
          className={cn(
            "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2",
            activeSupplierTab === 'planning'
              ? "bg-indigo-600 border-indigo-500 text-white shadow-neon-indigo scale-105"
              : "bg-white/5 border-white/5 text-white/50 hover:bg-white/10 hover:text-white"
          )}
        >
          📆 Planning & Agendas
        </button>
      </div>
    </div>

      {activeSupplierTab === 'planning' ? (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="p-8 bg-white/5 border border-white/5 rounded-[2.5rem] backdrop-blur-md">
            <h4 className="text-xl font-black text-indigo-400 uppercase tracking-widest mb-2 italic">TABLEAU DE BORD DES ACTIVITÉS FOURNISSEURS</h4>
            <p className="text-xs text-slate-400 font-mono uppercase">
              Visualisez l'agenda des visites de pré-vente, des livraisons de stock et des règlements de factures pour toute la semaine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((day) => {
              const preSaleSuppliers = suppliers.filter(s => s.preSaleDays?.includes(day));
              const deliverySuppliers = suppliers.filter(s => s.deliveryDays?.includes(day));
              const paymentSuppliers = suppliers.filter(s => s.paymentDays?.includes(day));
              const totalEvents = preSaleSuppliers.length + deliverySuppliers.length + paymentSuppliers.length;

              return (
                <div key={day} className="bg-white/5 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-6 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-6 pb-3 border-b border-white/5">
                      <h4 className="font-black text-white text-lg tracking-wider uppercase italic">{day}</h4>
                      {totalEvents > 0 && (
                        <span className="bg-indigo-600/20 text-indigo-400 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border border-indigo-500/30">
                          {totalEvents} {totalEvents === 1 ? 'Action' : 'Actions'}
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {preSaleSuppliers.map(s => (
                        <div 
                          key={`presale-${s.id}`}
                          onClick={() => { setViewingDetailsSupplier(s); setActiveDetailsTab('products'); setIsDetailsModalOpen(true); }}
                          className="bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-2xl p-4 hover:bg-purple-500/20 transition-all cursor-pointer group flex flex-col gap-1.5"
                          title="Modifier ou voir les détails"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">📝 Commande / Pré-vente</span>
                          </div>
                          <p className="text-sm font-black text-white group-hover:text-purple-200 transition-colors uppercase">{s.name}</p>
                          {s.planningNotes && (
                            <p className="text-[10px] text-purple-300/60 font-mono italic truncate mt-1">
                              "{s.planningNotes}"
                            </p>
                          )}
                        </div>
                      ))}

                      {deliverySuppliers.map(s => (
                        <div 
                          key={`delivery-${s.id}`}
                          onClick={() => { setViewingDetailsSupplier(s); setActiveDetailsTab('products'); setIsDetailsModalOpen(true); }}
                          className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-2xl p-4 hover:bg-emerald-500/20 transition-all cursor-pointer group flex flex-col gap-1.5"
                          title="Modifier ou voir les détails"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">🚚 Livraison</span>
                          </div>
                          <p className="text-sm font-black text-white group-hover:text-emerald-200 transition-colors uppercase">{s.name}</p>
                          {s.planningNotes && (
                            <p className="text-[10px] text-emerald-300/60 font-mono italic truncate mt-1">
                              "{s.planningNotes}"
                            </p>
                          )}
                        </div>
                      ))}

                      {paymentSuppliers.map(s => (
                        <div 
                          key={`payment-${s.id}`}
                          onClick={() => { setViewingDetailsSupplier(s); setActiveDetailsTab('payments'); setIsDetailsModalOpen(true); }}
                          className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl p-4 hover:bg-rose-500/20 transition-all cursor-pointer group flex flex-col gap-1.5"
                          title="Gérer les règlements"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-rose-400">💳 Règlement</span>
                          </div>
                          <p className="text-sm font-black text-white group-hover:text-rose-200 transition-colors uppercase">{s.name}</p>
                          {s.planningNotes && (
                            <p className="text-[10px] text-rose-300/60 font-mono italic truncate mt-1">
                              "{s.planningNotes}"
                            </p>
                          )}
                        </div>
                      ))}

                      {totalEvents === 0 && (
                        <div className="py-8 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                          <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Jour Libre</p>
                          <span className="text-[9px] text-white/10 font-mono mt-1">AUCUNE ACTION</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section Calendrier Mensuel & Rappels */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start mt-10">
            {/* Colonne Gauche: Calendrier Interactif */}
            <div className="xl:col-span-5 bg-white/5 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-6 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={16} className="text-indigo-400 animate-pulse" />
                    Calendrier Opérationnel
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono uppercase block mt-0.5">Cliquez sur un jour pour voir les détails</span>
                </div>
                
                <div className="flex items-center gap-1">
                  <button 
                    type="button"
                    onClick={() => {
                      setCurrentCalendarMonth(new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() - 1, 1));
                    }}
                    className="p-1 px-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/5 transition-all text-sm"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-[10px] font-black text-indigo-450 uppercase tracking-wider px-2 min-w-[100px] text-center">
                    {activeMonthName.replace(/^\w/, c => c.toUpperCase())}
                  </span>
                  <button 
                    type="button"
                    onClick={() => {
                      setCurrentCalendarMonth(new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, 1));
                    }}
                    className="p-1 px-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/5 transition-all text-sm"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Calendrier Grid */}
              <div className="space-y-2">
                {/* Jours de la semaine abreviation */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                    <span key={day} className="text-[9px] font-black text-slate-400 uppercase tracking-wider py-1">
                      {day}
                    </span>
                  ))}
                </div>

                {/* Grille des jours */}
                <div className="grid grid-cols-7 gap-1.5 text-center">
                  {calendarDays.map((cell, idx) => {
                    const cellDateStr = formatDateKey(cell.date);
                    const isSelected = selectedReminderDate === cellDateStr;
                    
                    const cellTodayStr = formatDateKey(new Date());
                    const isToday = cellDateStr === cellTodayStr;

                    // Reminders on this day (active only)
                    const cellReminders = allReminders.filter(r => r.date === cellDateStr && !r.isCompleted);
                    
                    // Cyclical pre-sale, delivery, payment events for this cell weekday
                    const cellDayOfWeek = (cell.date.getDay() + 6) % 7;
                    const cellWeekdayName = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][cellDayOfWeek];
                    
                    const cellPreSales = suppliers.filter(s => s.preSaleDays?.includes(cellWeekdayName));
                    const cellDeliveries = suppliers.filter(s => s.deliveryDays?.includes(cellWeekdayName));
                    const cellPayments = suppliers.filter(s => s.paymentDays?.includes(cellWeekdayName));
                    const activeEventsCount = cellPreSales.length + cellDeliveries.length + cellPayments.length;

                    return (
                      <button
                        key={`${cellDateStr}-${idx}`}
                        type="button"
                        onClick={() => setSelectedReminderDate(isSelected ? null : cellDateStr)}
                        className={cn(
                          "relative p-3 rounded-xl border flex flex-col items-center justify-between min-h-[50px] transition-all group active:scale-95",
                          cell.isCurrentMonth 
                            ? isSelected 
                              ? "bg-indigo-600/30 border-indigo-500 text-white shadow-md shadow-indigo-600/10"
                              : isToday 
                                ? "bg-indigo-650 border-indigo-500 text-white font-bold shadow-neon-indigo" 
                                : "bg-white/5 border-white/5 text-white/80 hover:bg-white/10 hover:border-slate-500"
                            : "bg-white/[0.02] border-transparent text-white/30 hover:bg-white/5 hover:border-white/5"
                        )}
                      >
                        <span className="text-xs font-black">{cell.date.getDate()}</span>
                        
                        {/* Dot indicator area */}
                        <div className="flex gap-0.5 justify-center mt-1 w-full h-1.5">
                          {/* Reminders dots */}
                          {cellReminders.slice(0, 3).map((r, rIdx) => (
                            <span 
                              key={r.id} 
                              className={cn(
                                "w-1 h-1 rounded-full",
                                r.priority === 'high' ? "bg-rose-500 animate-pulse" : r.priority === 'medium' ? "bg-amber-400" : "bg-sky-400"
                              )} 
                              title={r.title}
                            />
                          ))}
                          
                          {/* If no reminders but cyclical events, show subtle indicator */}
                          {cellReminders.length === 0 && activeEventsCount > 0 && (
                            <span className="w-1 h-1 rounded-full bg-slate-500/40" title={`${activeEventsCount} évènements récurrents`} />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 pt-4 border-t border-white/5 text-[9px] font-mono text-slate-400 justify-center">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded bg-indigo-600 border border-indigo-400" />
                  <span>Aujourd'hui</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>Urgent (H)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Moyen (M)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-450" />
                  <span>Normal (B)</span>
                </div>
              </div>
            </div>

            {/* Colonne Droite: Reminders Workspace */}
            <div className="xl:col-span-7 space-y-6">
              {/* Add reminder Card */}
              <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-6">
                <h4 className="text-sm font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <Plus size={16} /> Enregistrer un Nouveau Rappel Fournisseur
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-900">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block">Sélectionner Fournisseur</label>
                    <select
                      className="w-full p-2.5 bg-black/40 border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-white cursor-pointer"
                      value={newReminderData.supplierId}
                      onChange={e => setNewReminderData({ ...newReminderData, supplierId: e.target.value })}
                    >
                      <option value="" className="bg-slate-900 text-white">Sélectionner un partenaire...</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.name.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block">Date d'Échéance</label>
                    <input
                      type="date"
                      value={newReminderData.date}
                      onChange={e => setNewReminderData({ ...newReminderData, date: e.target.value })}
                      className="w-full p-2.5 bg-black/40 border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block">Sujet / Consigne du Rappel</label>
                    <input
                      type="text"
                      placeholder="Ex: Demander le remboursement de la livraison en retard, chèque pret..."
                      value={newReminderData.title}
                      onChange={e => setNewReminderData({ ...newReminderData, title: e.target.value })}
                      className="w-full p-2.5 bg-black/40 border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-white placeholder-slate-500"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block">Notes additionnelles (Facultatif)</label>
                    <textarea
                      placeholder="Ajouter des consignes de négociation, références de retour de marchandise..."
                      value={newReminderData.notes}
                      onChange={e => setNewReminderData({ ...newReminderData, notes: e.target.value })}
                      className="w-full p-2 bg-black/40 border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-white placeholder-slate-500 min-h-[50px] max-h-[100px]"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between md:col-span-2 pt-2 border-t border-white/5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase block">Priorité d'Alerte</label>
                      <div className="flex gap-2">
                        {(['low', 'medium', 'high'] as const).map(p => {
                          const priorityNames = { low: 'Bas', medium: 'Moyen', high: 'Élevé' };
                          const isActive = newReminderData.priority === p;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setNewReminderData({ ...newReminderData, priority: p })}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border",
                                isActive 
                                  ? p === 'high' 
                                    ? "bg-rose-600 border-rose-600 text-white font-black" 
                                    : p === 'medium' 
                                      ? "bg-amber-500 border-amber-500 text-slate-950 font-black" 
                                      : "bg-sky-600 border-sky-600 text-white font-black"
                                  : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                              )}
                            >
                              {priorityNames[p]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!newReminderData.supplierId || !newReminderData.title}
                      onClick={() => handleAddReminder(newReminderData.supplierId, newReminderData)}
                      className={cn(
                        "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all self-end",
                        newReminderData.supplierId && newReminderData.title
                          ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-neon-indigo hover:scale-105 active:scale-95 cursor-pointer"
                          : "bg-white/5 text-white/20 cursor-not-allowed border border-white/5"
                      )}
                    >
                      <Plus size={14} /> Enregistrer
                    </button>
                  </div>
                </div>
              </div>

              {/* Reminders List area */}
              <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <Bell size={16} className="text-amber-400 animate-pulse" />
                      Rappels et Tâches de Suivi
                    </h4>
                    {selectedReminderDate ? (
                      <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase block mt-0.5">
                        Échéances du {formatSafe(selectedReminderDate, 'dd MMMM yyyy') || selectedReminderDate}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono uppercase block mt-0.5">
                        {allReminders.filter(r => !r.isCompleted).length} rappels actifs programmés
                      </span>
                    )}
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setReminderFilter('active')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border",
                        reminderFilter === 'active' ? "bg-amber-600/20 border-amber-500/30 text-amber-300" : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      En cours ({allReminders.filter(r => !r.isCompleted).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderFilter('completed')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border",
                        reminderFilter === 'completed' ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-300" : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      Résolus ({allReminders.filter(r => r.isCompleted).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderFilter('all')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border",
                        reminderFilter === 'all' ? "bg-slate-500/20 border-slate-500/30 text-slate-300" : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      Tous
                    </button>

                    {selectedReminderDate && (
                      <button
                        type="button"
                        onClick={() => setSelectedReminderDate(null)}
                        className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-indigo-600 border border-indigo-500 text-white hover:bg-indigo-500 transition-all flex items-center gap-1 cursor-pointer"
                        title="Effacer le filtre de calendrier"
                      >
                        <X size={10} /> Voir Tout
                      </button>
                    )}
                  </div>
                </div>

                {/* Reminder Cards List */}
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {(() => {
                    const todayStr = formatDateKey(new Date());
                    const filtered = allReminders.filter(r => {
                      const isCompletedMatch = reminderFilter === 'all' 
                        ? true 
                        : reminderFilter === 'completed' 
                          ? r.isCompleted 
                          : !r.isCompleted;

                      const isDateMatch = selectedReminderDate 
                        ? r.date === selectedReminderDate 
                        : true;

                      return isCompletedMatch && isDateMatch;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="py-12 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                          <Clock size={28} className="text-white/10 mb-1" />
                          <p className="text-xs font-black text-white/30 uppercase tracking-widest mt-2">{selectedReminderDate ? "Pas d'échéance aujourd'hui" : "Aucun rappel enregistré"}</p>
                          <span className="text-[10px] text-white/20 font-mono mt-1">Utilisez l'agenda ou le formulaire de création</span>
                        </div>
                      );
                    }

                    return filtered.map(r => {
                      const isOverdue = !r.isCompleted && r.date < todayStr;
                      return (
                        <div 
                          key={r.id}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border transition-all hover:bg-white/10 group relative overflow-hidden",
                            r.isCompleted 
                              ? "bg-emerald-950/10 border-emerald-900/10 text-slate-500 opacity-60" 
                              : isOverdue 
                                ? "bg-rose-950/20 border-rose-900/30 text-rose-100" 
                                : "bg-white/5 border-white/5 text-white"
                          )}
                        >
                          <div className="flex items-start gap-3.5 flex-1 min-w-0">
                            {/* Complete checkbox trigger */}
                            <button
                              type="button"
                              onClick={() => handleToggleReminder(r.supplierId, r.id)}
                              className={cn(
                                "mt-0.5 rounded-full transition-all focus:outline-none flex-shrink-0 active:scale-90",
                                r.isCompleted 
                                  ? "text-emerald-400 hover:text-emerald-500" 
                                  : "text-slate-500 hover:text-indigo-400"
                              )}
                            >
                              <CheckCircle2 size={18} strokeWidth={r.isCompleted ? 3 : 2} />
                            </button>

                            <div className="space-y-1 min-w-0 flex-1">
                              <p className={cn(
                                "text-xs font-bold leading-tight uppercase tracking-wider truncate",
                                r.isCompleted ? "line-through text-slate-500" : "text-white"
                              )}>
                                {r.title}
                              </p>
                              
                              {r.notes && (
                                <p className="text-[10px] text-slate-400 font-mono truncate max-w-[400px]">
                                  {r.notes}
                                </p>
                              )}

                              <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
                                {/* Supplier name trigger click open Supplier Hub files */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const sup = suppliers.find(s => s.id === r.supplierId);
                                    if (sup) {
                                      setViewingDetailsSupplier(sup);
                                      setActiveDetailsTab('products');
                                      setIsDetailsModalOpen(true);
                                    }
                                  }}
                                  className="text-[9px] font-black text-indigo-450 uppercase tracking-widest hover:underline"
                                >
                                  💼 {r.supplierName}
                                </button>

                                <span className={cn(
                                  "text-[9px] font-mono",
                                  isOverdue ? "text-rose-400 font-bold" : "text-slate-400"
                                )}>
                                  🕒 Échéance: {formatSafe(r.date, 'dd/MM/yy') || r.date} {isOverdue && '(Retardé)'}
                                </span>

                                <span className={cn(
                                  "px-1.5 py-0.5 rounded shadow-sm text-[8px] font-black uppercase tracking-wider border",
                                  r.priority === 'high' 
                                    ? "bg-rose-500/10 border-rose-500/30 text-rose-450" 
                                    : r.priority === 'medium' 
                                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
                                      : "bg-sky-500/10 border-sky-500/30 text-sky-400"
                                )}>
                                  {r.priority === 'high' ? 'HAUTE' : r.priority === 'medium' ? 'MOYENNE' : 'BASSE'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Voulez-vous supprimer ce rappel ?')) {
                                handleDeleteReminder(r.supplierId, r.id);
                              }
                            }}
                            className="text-slate-500 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 flex-shrink-0 ml-4 h-fit cursor-pointer"
                            title="Supprimer ce rappel"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map((supplier: Supplier) => (
          <Card key={supplier.id} className="p-8 bg-white/5 backdrop-blur-md border border-white/5 shadow-2xl rounded-[2.5rem] hover:bg-white/10 transition-all group overflow-hidden relative active:scale-[0.98]">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-black/60 text-indigo-400 rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform shadow-2xl">
                  <Truck size={28} strokeWidth={2.5} />
                </div>
                <div>
                  <h4 className="font-black text-white text-xl tracking-tighter uppercase italic flex flex-wrap items-center gap-3">
                    {supplier.name}
                    {supplier.hasFullInventoryAccess && (
                      <span className="px-3 py-1 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-full shadow-neon-indigo border border-indigo-400/50">Nexus Access</span>
                    )}
                  </h4>
                  
                  {/* Dynamic Score badge */}
                  {(() => {
                    const avg = ((supplier.ratingQuality ?? 5) + (supplier.ratingDelivery ?? 5) + (supplier.ratingPrice ?? 5)) / 3;
                    return (
                      <div className="flex items-center gap-1.5 mt-1" title={`Qualité: ${supplier.ratingQuality ?? 5}/5 | Délai: ${supplier.ratingDelivery ?? 5}/5 | Prix: ${supplier.ratingPrice ?? 5}/5`}>
                        <div className="flex text-amber-400 select-none">
                          {"★".repeat(Math.round(avg)) + "☆".repeat(5 - Math.round(avg))}
                        </div>
                        <span className="text-[10px] font-mono font-bold text-amber-500">{avg.toFixed(1)}/5</span>
                      </div>
                    );
                  })()}

                  <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mt-1.5">{supplier.contactName || 'CONTACT NON DÉFINI'}</p>
                </div>
              </div>
              {supplier.feedUrl && (
                <button 
                  onClick={() => handleSync(supplier)}
                  disabled={isSyncing === supplier.id}
                  className={cn(
                    "w-12 h-12 rounded-2xl transition-all shadow-xl flex items-center justify-center border border-white/5",
                    isSyncing === supplier.id ? "bg-indigo-600 text-white animate-spin" : "bg-white/5 text-white/40 hover:bg-indigo-600 hover:text-white hover:border-indigo-500"
                  )}
                  title="Synchroniser"
                >
                  <RefreshCw size={22} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 bg-black/40 rounded-2xl border border-white/5 flex items-center gap-3 group/item">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/20 group-hover/item:text-indigo-400 transition-colors"><Phone size={14} /></div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[8px] font-black text-white/20 uppercase tracking-widest leading-none mb-1">TEL</span>
                  <span className="text-[11px] font-black text-white/60 tracking-widest truncate">{supplier.phone || '—'}</span>
                </div>
              </div>
              <div className="p-4 bg-black/40 rounded-2xl border border-white/5 flex items-center gap-3 group/item">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/20 group-hover/item:text-indigo-400 transition-colors"><Mail size={14} /></div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[8px] font-black text-white/20 uppercase tracking-widest leading-none mb-1">MAIL</span>
                  <span className="text-[11px] font-black text-white/60 tracking-widest truncate uppercase italic">{supplier.email || '—'}</span>
                </div>
              </div>
            </div>

            {((supplier.preSaleDays && supplier.preSaleDays.length > 0) || 
              (supplier.deliveryDays && supplier.deliveryDays.length > 0) || 
              (supplier.paymentDays && supplier.paymentDays.length > 0)) && (
              <div className="mb-8 p-4 bg-black/40 rounded-3xl border border-white/5 space-y-2">
                <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] block">📌 Agenda opérationnel</span>
                <div className="space-y-1.5 text-[10px]">
                  {supplier.preSaleDays && supplier.preSaleDays.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-400 uppercase">📝 Commande</span>
                      <span className="font-mono text-white/60 tracking-wider font-semibold uppercase">{supplier.preSaleDays.map(d => d.substring(0, 3)).join(', ')}</span>
                    </div>
                  )}
                  {supplier.deliveryDays && supplier.deliveryDays.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400 uppercase">🚚 Livraison</span>
                      <span className="font-mono text-white/60 tracking-wider font-semibold uppercase">{supplier.deliveryDays.map(d => d.substring(0, 3)).join(', ')}</span>
                    </div>
                  )}
                  {supplier.paymentDays && supplier.paymentDays.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-400 uppercase">💳 Règlement</span>
                      <span className="font-mono text-white/60 tracking-wider font-semibold uppercase">{supplier.paymentDays.map(d => d.substring(0, 3)).join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-white/5">
              <div className="flex gap-2">
                <button 
                  onClick={() => { setViewingDetailsSupplier(supplier); setActiveDetailsTab('products'); setIsDetailsModalOpen(true); }}
                  className="w-12 h-12 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10 rounded-2xl transition-all border border-transparent hover:border-white/10"
                  title="Voir les détails"
                >
                  <Package size={22} />
                </button>
                <button 
                  onClick={() => { setSupplierToDelete(supplier); setIsDeleteConfirmOpen(true); }}
                  className="w-12 h-12 flex items-center justify-center text-white/20 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all border border-transparent hover:border-rose-500/20"
                  title="Supprimer"
                >
                  <Trash2 size={22} />
                </button>
              </div>
              <Button 
                variant="ghost" 
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white font-black uppercase tracking-[0.2em] text-[10px] px-8 rounded-2xl h-12 group-hover:border-indigo-500/50 transition-all" 
                onClick={() => { setEditingSupplier(supplier); setIsModalOpen(true); }}
              >
                MODIFIER
              </Button>
            </div>
          </Card>
        ))}
      </div>
      )}

      <Modal 
        isOpen={isDetailsModalOpen} 
        onClose={() => setIsDetailsModalOpen(false)} 
        title={null}
        maxWidth="max-w-[96vw]"
        maxHeight="max-h-[96vh]"
        padding="p-0"
      >
        {viewingDetailsSupplier && (
          <div className="flex flex-col bg-[#0a0a0f] h-[96vh] max-h-[96vh] overflow-hidden text-white">
            {/* Header */}
            <header className="bg-white/5 px-10 pt-10 pb-8 border-b border-white/10 relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500"></div>
              
              <button 
                onClick={() => setIsDetailsModalOpen(false)}
                className="absolute top-6 right-6 p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-white/40 hover:text-white z-10 hover:scale-110 active:scale-95"
              >
                <X size={24} />
              </button>
              
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center text-3xl font-black shadow-2xl relative group overflow-hidden">
                    <span className="relative z-10">{viewingDetailsSupplier.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-2 uppercase">{viewingDetailsSupplier.name}</h2>
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-black uppercase rounded-full tracking-widest shadow-lg shadow-emerald-500/20">Actif</span>
                      {viewingDetailsSupplier.hasFullInventoryAccess && (
                        <span className="px-3 py-1 bg-indigo-500 text-white text-[10px] font-black uppercase rounded-full tracking-widest shadow-lg shadow-indigo-500/20">Accès Total</span>
                      )}
                      <div className="h-4 w-px bg-white/10"></div>
                      <span className="text-sm font-bold text-white/40 flex items-center gap-2">
                        <Phone size={14} className="text-white/20" /> {viewingDetailsSupplier.phone || 'N/A'}
                      </span>
                      <span className="text-sm font-bold text-white/40 flex items-center gap-2">
                        <Mail size={14} className="text-white/20" /> {viewingDetailsSupplier.email || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="bg-white/5 p-5 px-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col justify-center min-w-[200px]">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Dette Globale</p>
                    <p className="text-3xl font-black text-rose-500 leading-none font-mono">
                      {(viewingDetailsSupplier.balance || 0).toFixed(2)} <span className="text-sm font-medium">{settings.currency}</span>
                    </p>
                  </div>
                  <Button 
                    onClick={() => { setPaymentData({...paymentData, amount: viewingDetailsSupplier.balance || 0}); setIsPaymentModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-20 rounded-[2rem] flex flex-col items-center justify-center shadow-2xl shadow-indigo-500/20 transition-all hover:-translate-y-1 active:translate-y-0"
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-70">Effectuer</span>
                    <span className="text-lg font-black whitespace-nowrap">VERSEMENT</span>
                  </Button>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex flex-wrap gap-2 p-1.5 bg-white/5 backdrop-blur-md rounded-2xl w-fit border border-white/10">
                {[
                  { id: 'products', label: 'Catalogue', icon: Package },
                  { id: 'damaged', label: 'Dommages', icon: AlertTriangle },
                  { id: 'purchases', label: 'Réceptions', icon: History },
                  { id: 'payments', label: 'Finances', icon: Wallet }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveDetailsTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-3 px-4 sm:px-8 py-3 rounded-xl text-sm font-black transition-all duration-300",
                      activeDetailsTab === tab.id 
                        ? "bg-white text-black shadow-lg" 
                        : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <tab.icon size={18} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-10 bg-[#0a0a0f]">
              {activeDetailsTab === 'products' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
                    {[
                      { 
                        label: 'Total Références', 
                        val: products.filter(p => p.supplier === viewingDetailsSupplier.name).length, 
                        suffix: 'Articles',
                        color: 'text-white',
                        bg: 'bg-white/5'
                      },
                      { 
                        label: 'Valeur Catalogue', 
                        val: products.filter(p => p.supplier === viewingDetailsSupplier.name).reduce((sum, p) => sum + (p.stock * p.price), 0).toFixed(2), 
                        suffix: settings.currency,
                        color: 'text-emerald-400',
                        bg: 'bg-emerald-400/5 border-emerald-400/10'
                      },
                      { 
                        label: 'Dernière Flux', 
                        val: viewingDetailsSupplier.lastSync ? formatSafe(viewingDetailsSupplier.lastSync, 'dd MMM yyyy', { locale: fr }) : 'Aucune', 
                        suffix: '', 
                        color: 'text-indigo-400',
                        bg: 'bg-indigo-400/5 border-indigo-400/10'
                      }
                    ].map((stat, i) => (
                      <div key={i} className={cn("p-6 sm:p-8 rounded-[2.5rem] border shadow-2xl flex flex-col justify-between min-h-[140px] sm:min-h-[160px] transition-transform hover:scale-[1.02]", stat.bg || 'bg-white/5 border-white/10')}>
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4">{stat.label}</p>
                        <p className={cn("text-2xl sm:text-4xl font-black mb-1 font-mono", stat.color)}>
                          {stat.val} <span className="text-sm sm:text-lg font-bold opacity-40 ml-1">{stat.suffix}</span>
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Replenishment Warning Card & Auto PO generator */}
                  {(() => {
                    const lowStockProducts = products.filter(p => p.supplier === viewingDetailsSupplier.name && p.stock <= (p.minStock || 5));
                    if (lowStockProducts.length === 0) return null;
                    return (
                      <div className="bg-amber-500/10 border border-amber-500/25 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                              <AlertCircle size={20} className="animate-pulse" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                Ruptures ou Seuils Critiques Atteints ({lowStockProducts.length} articles)
                              </h4>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Certains articles de ce fournisseur ont atteint ou dépassé leur seuil minimal de sécurité.
                              </p>
                            </div>
                          </div>

                          {!isPODraftOpen && (
                            <button
                              type="button"
                              onClick={() => {
                                const initialDraft = lowStockProducts.map(p => ({
                                  productId: p.id,
                                  productName: p.name,
                                  quantity: Math.max(10, (p.minStock || 5) * 2 - p.stock),
                                  price: p.costPrice || p.price
                                }));
                                setPoDraftItems(initialDraft);
                                setIsPODraftOpen(true);
                              }}
                              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/10 cursor-pointer flex items-center gap-1.5"
                            >
                              <Sparkles size={14} className="fill-slate-950" />
                              Calculer Automatiquement le Bon d'Achat
                            </button>
                          )}
                        </div>

                        {/* Interactive draft editor inside the same container */}
                        {isPODraftOpen && poDraftItems.length > 0 && (
                          <div className="bg-slate-950/80 rounded-2xl p-5 border border-white/5 space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-white/5">
                              <div>
                                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Brouillon de Réapprovisionnement automatique</span>
                                <h5 className="text-xs font-black text-amber-400 uppercase tracking-widest mt-0.5">Vérification des Quantités</h5>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsPODraftOpen(false);
                                  setPoDraftItems([]);
                                }}
                                className="text-slate-400 hover:text-white transition-colors"
                              >
                                <X size={16} />
                              </button>
                            </div>

                            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                              {poDraftItems.map((item, index) => {
                                const prod = products.find(p => p.id === item.productId);
                                return (
                                  <div key={item.productId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-slate-800 transition-colors gap-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-white uppercase tracking-wider truncate">{item.productName}</p>
                                      <p className="text-[10px] text-slate-400 font-mono">
                                        Stock actuel: {prod?.stock || 0} {prod?.unit || 'U'} | Seuil Min: {prod?.minStock || 5}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = [...poDraftItems];
                                            updated[index].quantity = Math.max(1, updated[index].quantity - 5);
                                            setPoDraftItems(updated);
                                          }}
                                          className="w-7 h-7 bg-white/5 hover:bg-white/10 text-white rounded flex items-center justify-center font-bold text-xs"
                                        >
                                          -5
                                        </button>
                                        <input
                                          type="number"
                                          min={1}
                                          className="w-14 p-1 bg-black text-white border border-white/10 rounded text-center text-xs font-mono"
                                          value={item.quantity}
                                          onChange={e => {
                                            const updated = [...poDraftItems];
                                            updated[index].quantity = Math.max(1, parseInt(e.target.value) || 1);
                                            setPoDraftItems(updated);
                                          }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = [...poDraftItems];
                                            updated[index].quantity += 5;
                                            setPoDraftItems(updated);
                                          }}
                                          className="w-7 h-7 bg-white/5 hover:bg-white/10 text-white rounded flex items-center justify-center font-bold text-xs"
                                        >
                                          +5
                                        </button>
                                      </div>

                                      <div className="text-right w-24">
                                        <span className="text-xs font-mono font-bold text-white">
                                          {(item.price * item.quantity).toFixed(2)} {settings.currency}
                                        </span>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = poDraftItems.filter(it => it.productId !== item.productId);
                                          setPoDraftItems(updated);
                                        }}
                                        className="text-slate-500 hover:text-rose-450 transition-colors p-1 hover:bg-white/5 rounded"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
                              <div className="text-left w-full sm:w-auto">
                                <span className="text-[10px] text-slate-400 block uppercase font-mono tracking-widest">Estimation de l'ordre d'achat</span>
                                <span className="text-lg font-black text-white font-mono">
                                  {poDraftItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)} {settings.currency}
                                </span>
                              </div>

                              <div className="flex gap-2 w-full sm:w-auto">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsPODraftOpen(false);
                                    setPoDraftItems([]);
                                  }}
                                  className="w-full sm:w-auto px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase rounded-lg border border-white/5 transition-all text-center cursor-pointer"
                                >
                                  Annuler
                                </button>
                                <button
                                  type="button"
                                  disabled={isSavingPurchaseOrder || poDraftItems.length === 0}
                                  onClick={handleSavePurchaseOrderDraft}
                                  className="w-full sm:w-auto px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase rounded-lg shadow-lg shadow-emerald-600/10 transition-all text-center cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                  {isSavingPurchaseOrder ? (
                                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                  ) : (
                                    <CheckCircle2 size={14} />
                                  )}
                                  Enregistrer le Bon
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="bg-white/5 rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
                    <header className="px-6 sm:px-8 py-6 border-b border-white/5 flex items-center justify-between">
                      <h3 className="font-extrabold text-white text-sm uppercase tracking-widest">INVENTAIRE DU FOURNISSEUR</h3>
                      <div className="hidden sm:flex gap-2">
                         <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
                         <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Mise à jour en temps réel</p>
                      </div>
                    </header>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white/5">
                            <th className="px-6 sm:px-8 py-5 text-[10px] font-black text-white/20 uppercase tracking-widest border-b border-white/5">Désignation Produit</th>
                            <th className="px-6 sm:px-8 py-5 text-[10px] font-black text-white/20 uppercase tracking-widest border-b border-white/5 text-center">Stock Actual</th>
                            <th className="px-6 sm:px-8 py-5 text-[10px] font-black text-white/20 uppercase tracking-widest border-b border-white/5 text-right">Prix d'Achat</th>
                            <th className="px-6 sm:px-8 py-5 text-[10px] font-black text-white/20 uppercase tracking-widest border-b border-white/5 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {products
                            .filter(p => p.supplier === viewingDetailsSupplier.name)
                            .map(p => (
                              <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-6 sm:px-8 py-5">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/20 group-hover:bg-indigo-600 group-hover:text-white transition-colors hidden sm:flex">
                                      <Package size={20} />
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-white">{p.name}</p>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-[10px] text-white/40 font-bold uppercase">{categories.find(c => c.id === p.categoryId)?.name || 'SANS CATÉGORIE'}</p>
                                        {p.damagedStock && p.damagedStock > 0 ? (
                                          <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-400 text-[8px] font-black uppercase rounded border border-rose-500/20 flex items-center gap-0.5">
                                            <AlertTriangle size={8} /> {p.damagedStock} Endommagé(s)
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 sm:px-8 py-5 text-center">
                                  <span className={cn(
                                    "px-3 sm:px-4 py-1.5 rounded-xl text-[10px] font-black border",
                                    p.stock <= (p.minStock || 5) 
                                      ? "bg-rose-500/10 border-rose-500/20 text-rose-400" 
                                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  )}>
                                    {p.stock} <span className="opacity-60">{p.unit}</span>
                                  </span>
                                </td>
                                <td className="px-6 sm:px-8 py-5 text-right">
                                  <p className="text-base font-black text-white font-mono">{(p.costPrice || p.price).toFixed(2)} {settings.currency}</p>
                                </td>
                                <td className="px-6 sm:px-8 py-5 text-center">
                                  <button 
                                    onClick={() => { setSelectedProductForDamage(p); setDamageData({quantity: 1, reason: ''}); setIsDamageModalOpen(true); }}
                                    className="p-2 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
                                    title="Signaler Dommage"
                                  >
                                    <AlertTriangle size={18} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Other tabs follow similar structure... I'll keep the core functionality for now */}
              {activeDetailsTab === 'purchases' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4">
                    {purchases
                      .filter(p => p.supplierId === viewingDetailsSupplier.id)
                      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(p => {
                        const remaining = p.total - (p.paidAmount || 0);
                        return (
                          <div key={p.id} className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 hover:border-indigo-400 hover:shadow-2xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                            <div className="flex items-center gap-4 sm:gap-8">
                              <div className="w-12 h-12 sm:w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-400 transition-colors">
                                <FileText size={32} />
                              </div>
                              <div>
                                <div className="flex items-center gap-3 mb-2">
                                  <p className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">BR-{p.id.slice(-6).toUpperCase()}</p>
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                                    p.status === 'completed' ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-600"
                                  )}>
                                    {p.status}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-6">
                                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    <Calendar size={14} className="opacity-40" /> {formatSafe(p.date, 'EEEE dd MMMM yyyy', { locale: fr })}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    <Clock size={14} className="opacity-40" /> {formatSafe(p.date, 'HH:mm')}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-6 sm:gap-12 self-end md:self-auto">
                              <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total</p>
                                <p className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">{p.total.toFixed(2)}</p>
                              </div>
                              <div className="text-right pr-4 sm:pr-6 border-r border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Reste</p>
                                <p className={cn("text-lg sm:text-xl font-black tracking-tight", remaining > 0 ? "text-rose-600" : "text-emerald-500")}>
                                  {remaining.toFixed(2)}
                                </p>
                              </div>
                              <Button 
                                onClick={() => { setIsDetailsModalOpen(false); setViewingPurchaseVoucher(p); }}
                                className="bg-slate-50 hover:bg-slate-100 text-slate-900 font-black rounded-2xl h-12 sm:h-14 px-4 sm:px-8 border border-slate-200 shadow-sm text-xs sm:text-sm"
                              >
                                VOIR
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {activeDetailsTab === 'damaged' && (() => {
                const supplierDamaged = damagedItems.filter(d => products.find(p => p.id === d.productId)?.supplier === viewingDetailsSupplier.name);
                
                const totalLoss = supplierDamaged.reduce((acc, d) => {
                  const cost = d.costPrice || products.find(p => p.id === d.productId)?.costPrice || 0;
                  return acc + (d.quantity * cost);
                }, 0);

                const totalRecovered = supplierDamaged.reduce((acc, d) => {
                  if (d.claimStatus !== 'refunded' && d.claimStatus !== 'replaced') return acc;
                  const cost = d.costPrice || products.find(p => p.id === d.productId)?.costPrice || 0;
                  return acc + (d.quantity * cost);
                }, 0);

                const totalPendingClaim = supplierDamaged.reduce((acc, d) => {
                  if (d.claimStatus !== 'to_claim' && d.claimStatus !== 'claimed' && d.claimStatus !== undefined) return acc;
                  const cost = d.costPrice || products.find(p => p.id === d.productId)?.costPrice || 0;
                  return acc + (d.quantity * cost);
                }, 0);

                return (
                  <div className="space-y-6">
                    {/* Claims Metrics Dashboard */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-[1.5rem] shadow-xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">💸 Valeur Totale des Pertes</span>
                        <p className="text-2xl font-black text-rose-450">{totalLoss.toFixed(2)} {settings.currency}</p>
                        <span className="text-[10px] text-slate-500 font-mono italic">{supplierDamaged.length} articles défectueux enregistrés</span>
                      </div>
                      <div className="bg-emerald-950/40 border border-emerald-900/30 p-6 rounded-[1.5rem] shadow-xl">
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block mb-1">💵 Remboursé / Résolu</span>
                        <p className="text-2xl font-black text-emerald-400">{totalRecovered.toFixed(2)} {settings.currency}</p>
                        <span className="text-[10px] text-emerald-600 font-mono italic">Pertes récupérées de ce fournisseur</span>
                      </div>
                      <div className="bg-amber-950/40 border border-amber-900/30 p-6 rounded-[1.5rem] shadow-xl">
                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block mb-1">⏳ Dossiers en Cours / À Réclamer</span>
                        <p className="text-2xl font-black text-amber-550">{totalPendingClaim.toFixed(2)} {settings.currency}</p>
                        <span className="text-[10px] text-amber-500 font-mono italic">Montants réclamés ou en attente d'action</span>
                      </div>
                    </div>

                    <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm p-6 space-y-4 text-slate-900">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
                        <div>
                          <h4 className="text-base font-black text-slate-900 uppercase tracking-wider">Suivi des Réclamations & Pertes</h4>
                           <p className="text-xs text-slate-400 mt-1">Gérez le statut des articles défectueux à retourner ou à réclamer auprès de ce fournisseur.</p>
                         </div>
                         
                         <div>
                           <select 
                             className="p-3 text-xs font-black uppercase text-slate-800 border border-slate-250 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer"
                             defaultValue=""
                             onChange={(e) => {
                               if (!e.target.value) return;
                               const prod = products.find(p => p.id === e.target.value);
                               if (prod) {
                                 setSelectedProductForDamage(prod);
                                 setDamageData({quantity: 1, reason: ''});
                                 setIsDamageModalOpen(true);
                               }
                               e.target.value = ""; // Reset
                             }}
                           >
                             <option value="">➕ Article Défectueux...</option>
                             {products
                               .filter(p => p.supplier === viewingDetailsSupplier.name)
                               .map(p => (
                                 <option key={p.id} value={p.id}>
                                   {p.name.toUpperCase()} (STOCK: {p.stock})
                                 </option>
                               ))}
                           </select>
                         </div>
                       </div>

                       {supplierDamaged.length === 0 ? (
                         <div className="text-center py-12">
                           <p className="text-xs text-slate-400 font-black uppercase tracking-wider">Aucune perte de stock enregistrée chez ce fournisseur</p>
                         </div>
                       ) : (
                         <div className="overflow-x-auto">
                           <table className="w-full text-left">
                             <thead>
                               <tr className="bg-slate-50/50">
                                 <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Date</th>
                                 <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Produit</th>
                                 <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Qté</th>
                                 <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Coût U.</th>
                                 <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Total Perte</th>
                                 <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Motif</th>
                                 <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Statut Réclamation</th>
                               </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-150">
                               {supplierDamaged.map(record => {
                                 const itemCost = record.costPrice || products.find(p => p.id === record.productId)?.costPrice || 0;
                                 const claimStatusVal = record.claimStatus || 'to_claim';

                                 return (
                                   <tr key={record.id} className="hover:bg-slate-50/30">
                                     <td className="px-6 py-4 whitespace-nowrap">
                                       <p className="text-xs font-bold text-slate-655">{formatSafe(record.date, 'dd/MM/yy')}</p>
                                     </td>
                                     <td className="px-6 py-4">
                                       <p className="text-xs font-black text-slate-800 uppercase leading-none mb-1">{record.productName}</p>
                                       <span className="text-[9px] text-slate-400 font-mono font-bold">Ref: {record.productId.slice(-8).toUpperCase()}</span>
                                     </td>
                                     <td className="px-6 py-4 text-center">
                                       <span className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black border border-rose-100">{record.quantity}</span>
                                     </td>
                                     <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-500">
                                       {itemCost.toFixed(2)} {settings.currency}
                                     </td>
                                     <td className="px-6 py-4 font-mono text-xs font-black text-rose-500">
                                       {(record.quantity * itemCost).toFixed(2)} {settings.currency}
                                     </td>
                                     <td className="px-6 py-4 text-xs text-slate-500 italic max-w-[150px] truncate" title={record.reason}>
                                       {record.reason}
                                     </td>
                                     <td className="px-6 py-4">
                                       <select
                                         value={claimStatusVal}
                                         onChange={(e) => handleUpdateClaimStatus(record.id, e.target.value)}
                                         className={cn(
                                           "px-2.5 py-1.5 text-[10px] font-black uppercase rounded-lg border outline-none cursor-pointer transition-colors focus:ring-1 focus:ring-slate-400",
                                           claimStatusVal === 'to_claim' && "bg-amber-50 border-amber-200 text-amber-700",
                                           claimStatusVal === 'claimed' && "bg-blue-50 border-blue-200 text-blue-700",
                                           claimStatusVal === 'refunded' && "bg-emerald-50 border-emerald-200 text-emerald-700",
                                           claimStatusVal === 'replaced' && "bg-indigo-50 border-indigo-200 text-indigo-700",
                                           claimStatusVal === 'rejected' && "bg-rose-50 border-rose-200 text-rose-700"
                                         )}
                                       >
                                         <option value="to_claim">⏳ À réclamer</option>
                                         <option value="claimed">📣 Réclamé</option>
                                         <option value="refunded">💵 Remboursé</option>
                                         <option value="replaced">🔄 Échangé (U)</option>
                                         <option value="rejected">❌ Sans suite</option>
                                       </select>
                                     </td>
                                   </tr>
                                 );
                               })}
                             </tbody>
                           </table>
                         </div>
                       )}
                     </div>
                   </div>
                 );
               })()}

              {activeDetailsTab === 'payments' && (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-emerald-600 p-8 sm:p-10 rounded-[2rem] sm:rounded-[3rem] text-white shadow-2xl flex flex-col justify-between relative overflow-hidden group">
                      <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70 mb-4">Total Versement</p>
                        <p className="text-4xl sm:text-6xl font-black mb-1 tracking-tighter">
                          {supplierPayments
                            .filter(pm => pm.supplierId === viewingDetailsSupplier.id)
                            .reduce((sum, pm) => sum + pm.amount, 0)
                            .toFixed(2)} <span className="text-xl sm:text-2xl font-medium opacity-50">{settings.currency}</span>
                        </p>
                      </div>
                    </div>

                    <div className="bg-white p-8 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-xl flex flex-col justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Actions Financières</p>
                      <Button 
                        onClick={() => { setPaymentData({...paymentData, amount: 0, date: new Date().toISOString()}); setIsPaymentModalOpen(true); }}
                        className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 sm:py-5 rounded-2xl sm:rounded-3xl shadow-2xl transition-all"
                      >
                        NOUVEAU VERSEMENT
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto bg-white rounded-[1.5rem] sm:rounded-[3rem] border border-slate-200 shadow-sm">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="px-6 sm:px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Date</th>
                          <th className="px-6 sm:px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Montant</th>
                          <th className="px-6 sm:px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {supplierPayments
                          .filter(pm => pm.supplierId === viewingDetailsSupplier.id)
                          .map(payment => (
                            <tr key={payment.id}>
                              <td className="px-6 sm:px-10 py-6">
                                <p className="text-sm font-black text-slate-800">{formatSafe(payment.date, 'dd/MM/yyyy')}</p>
                              </td>
                              <td className="px-6 sm:px-10 py-6">
                                <span className="text-lg font-black text-emerald-600">{payment.amount.toFixed(2)}</span>
                              </td>
                              <td className="px-6 sm:px-10 py-6">
                                <div className="flex gap-2">
                                  <button onClick={() => { setEditingPayment(payment); setIsPaymentModalOpen(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                    <Edit size={16} />
                                  </button>
                                  <button onClick={() => handlePaymentDelete(payment)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal 
        isOpen={isPaymentModalOpen} 
        onClose={() => { setIsPaymentModalOpen(false); setEditingPayment(null); }} 
        title={editingPayment ? "Modifier le Versement" : "Effectuer un Versement"} 
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-xl space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Fournisseur</span>
              <span className="font-bold text-slate-800">{viewingDetailsSupplier?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Dette Actuelle</span>
              <span className="font-bold text-rose-600">{(viewingDetailsSupplier?.balance || 0).toFixed(2)} {settings.currency}</span>
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Date du versement</label>
            <input type="datetime-local" className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={paymentData.date ? paymentData.date.slice(0, 16) : ''} onChange={(e) => {
              const val = e.target.value;
              let dateIso = new Date().toISOString();
              try {
                if (val) {
                  dateIso = new Date(val).toISOString();
                }
              } catch(err) {}
              setPaymentData({...paymentData, date: dateIso});
            }} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Montant du versement</label>
            <input type="number" step="0.01" className="w-full p-2 text-xl font-bold border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={paymentData.amount || ''} onChange={e => setPaymentData({...paymentData, amount: parseFloat(e.target.value) || 0})} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Mode de paiement</label>
            <select className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={paymentData.method} onChange={e => setPaymentData({...paymentData, method: e.target.value as any})}>
              <option value="cash">Espèces</option>
              <option value="card">Carte Bancaire</option>
              <option value="transfer">Virement</option>
              <option value="check">Chèque</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Note / Référence (Optionnel)</label>
            <input className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Chèque N° 123456" value={paymentData.note} onChange={e => setPaymentData({...paymentData, note: e.target.value})} />
          </div>

          <div className="pt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setIsPaymentModalOpen(false); setEditingPayment(null); }}>Annuler</Button>
            <Button className="flex-1" onClick={handlePaymentSubmit} disabled={paymentData.amount <= 0 || (editingPayment ? false : paymentData.amount > (viewingDetailsSupplier?.balance || 0)) || isProcessingPayment}>
              {isProcessingPayment ? 'Traitement...' : 'Valider'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isDamageModalOpen} 
        onClose={() => setIsDamageModalOpen(false)} 
        title="Signaler un article endommagé" 
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-50 rounded-xl">
            <p className="text-sm font-bold text-rose-800">{selectedProductForDamage?.name}</p>
            <p className="text-xs text-rose-600">Stock actuel: {selectedProductForDamage?.stock} {selectedProductForDamage?.unit}</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Quantité endommagée</label>
            <input 
              type="number" 
              min="1" 
              max={selectedProductForDamage?.stock}
              className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
              value={damageData.quantity} 
              onChange={e => setDamageData({...damageData, quantity: parseInt(e.target.value) || 0})} 
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Raison / Motif</label>
            <textarea 
              className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]" 
              placeholder="Ex: Cassé pendant le transport, Date périmée, Defectueux..."
              value={damageData.reason} 
              onChange={e => setDamageData({...damageData, reason: e.target.value})} 
            />
          </div>

          <div className="pt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setIsDamageModalOpen(false)}>Annuler</Button>
            <Button 
              className="flex-1 bg-rose-600 hover:bg-rose-700" 
              onClick={handleDamageSubmit} 
              disabled={damageData.quantity <= 0 || damageData.quantity > (selectedProductForDamage?.stock || 0) || !damageData.reason || isProcessingDamage}
            >
              {isProcessingDamage ? 'Traitement...' : 'Déduire du stock'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSupplier ? "Modifier le fournisseur" : "Nouveau fournisseur"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Nom du Fournisseur *</label>
            <input required className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Téléphone</label>
              <input className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
              <input type="email" className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={14} /> Agenda & Planning Opérationnel
            </h4>
            
            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">📝 Jours de Pré-vente (Prise de commande)</span>
                <div className="flex gap-1.5 flex-wrap">
                  {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((day) => {
                    const active = formData.preSaleDays?.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => {
                          const current = formData.preSaleDays || [];
                          const updated = current.includes(day)
                            ? current.filter(d => d !== day)
                            : [...current, day];
                          setFormData({ ...formData, preSaleDays: updated });
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all border",
                          active 
                            ? "bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-600/20" 
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        {day.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">🚚 Jours de Livraison</span>
                <div className="flex gap-1.5 flex-wrap">
                  {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((day) => {
                    const active = formData.deliveryDays?.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => {
                          const current = formData.deliveryDays || [];
                          const updated = current.includes(day)
                            ? current.filter(d => d !== day)
                            : [...current, day];
                          setFormData({ ...formData, deliveryDays: updated });
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all border",
                          active 
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20" 
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        {day.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">💳 Jours de Paiement / Règlement</span>
                <div className="flex gap-1.5 flex-wrap">
                  {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((day) => {
                    const active = formData.paymentDays?.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => {
                          const current = formData.paymentDays || [];
                          const updated = current.includes(day)
                            ? current.filter(d => d !== day)
                            : [...current, day];
                          setFormData({ ...formData, paymentDays: updated });
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all border",
                          active 
                            ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/20" 
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        {day.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Consignes & Notes de Planning</label>
                <textarea 
                  className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-xs min-h-[50px]" 
                  placeholder="Ex: Passe à 10h, livrer par l'arrière, chèque à préparer..."
                  value={formData.planningNotes} 
                  onChange={e => setFormData({...formData, planningNotes: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Intégration Flux (Sync Auto)</h4>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">URL du Flux (JSON/CSV)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
                  placeholder="https://api.supplier.com/v1/products"
                  value={formData.feedUrl} 
                  onChange={e => setFormData({...formData, feedUrl: e.target.value})} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Format</label>
                <select 
                  className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={formData.feedFormat}
                  onChange={e => setFormData({...formData, feedFormat: e.target.value as any})}
                >
                  <option value="json">JSON API</option>
                  <option value="csv">CSV File</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input 
                  type="checkbox"
                  id="syncEnabled"
                  checked={formData.syncEnabled}
                  onChange={e => setFormData({...formData, syncEnabled: e.target.checked})}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="syncEnabled" className="text-xs font-bold text-slate-700">Activer la sync</label>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Accès Portail Fournisseur</h4>
            
            <div className="flex items-center gap-2">
              <input 
                type="checkbox"
                id="isAppUser"
                checked={formData.isAppUser}
                onChange={e => setFormData({...formData, isAppUser: e.target.checked})}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <label htmlFor="isAppUser" className="text-xs font-bold text-slate-700">Autoriser l'accès au portail</label>
            </div>

            {formData.isAppUser && (
              <>
                <div className="flex items-center gap-2 mt-2">
                  <input 
                    type="checkbox"
                    id="hasFullInventoryAccess"
                    checked={formData.hasFullInventoryAccess}
                    onChange={e => setFormData({...formData, hasFullInventoryAccess: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <label htmlFor="hasFullInventoryAccess" className="text-xs font-bold text-slate-700">Accès Total (Voir tout l'inventaire)</label>
                </div>
                <div className="space-y-1 mt-4">
                  <label className="text-xs font-bold text-slate-500 uppercase">Mot de passe {editingSupplier ? "(laisser vide pour ne pas changer)" : "*"}</label>
                  <input 
                    type="password"
                    required={!editingSupplier}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              </>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500 fill-amber-500" /> Évaluation du Partenaire (Scorecard)
            </h4>
            
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-150">
              {[
                { label: 'Qualité des Produits', key: 'ratingQuality' as const },
                { label: 'Respect des Délais', key: 'ratingDelivery' as const },
                { label: 'Rapport Qualité/Prix', key: 'ratingPrice' as const },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{label}</span>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setFormData({ ...formData, [key]: star })}
                        className="text-amber-400 hover:scale-110 active:scale-90 transition-all focus:outline-none"
                      >
                        <span className="text-base select-none">
                          {formData[key] >= star ? "★" : "☆"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full py-3">
            {editingSupplier ? "Enregistrer" : "Créer"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog 
        isOpen={isDeleteConfirmOpen}
        onClose={() => { setIsDeleteConfirmOpen(false); setSupplierToDelete(null); }}
        onConfirm={handleDeleteSupplier}
        title="Supprimer le fournisseur"
        message={`Êtes-vous sûr de vouloir supprimer le fournisseur "${supplierToDelete?.name}" ?`}
      />
    </div>
  );
});
