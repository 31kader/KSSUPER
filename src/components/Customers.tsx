import React, { useState, useEffect, useMemo, memo } from 'react';
import { 
  Plus, Search, Smartphone, Award, Phone, Mail, MessageSquare, 
  Trash2, Contact, User as UserIcon, Quote, Clock, ShoppingBag, 
  CreditCard as CardIcon, Eye, EyeOff, Printer, Users
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import bcrypt from 'bcryptjs';
import { supabase } from '../supabase';
import { 
  Customer, Transaction, CompanySettings 
} from '../types';
import { Button, Modal, ConfirmDialog } from './ui';
import { cn, formatSafe } from '../lib/utils';
import { CustomerProfile } from './CustomerProfile';
import { MicroInvestorsManager } from './MicroInvestorsManager';
import { useTranslation } from '../translations';

export const Customers = memo(function Customers({ 
  customers, 
  transactions, 
  settings, 
  onRestore,
  products,
  expenses,
  stockAdjustments,
  categories
}: { 
  customers: Customer[], 
  transactions: Transaction[], 
  settings: CompanySettings, 
  onRestore: (t: Transaction) => void,
  products?: any[],
  expenses?: any[],
  stockAdjustments?: any[],
  categories?: any[]
}) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'card'>('info');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);
  const [financialOpType, setFinancialOpType] = useState<'encaissement' | 'decaissement'>('encaissement');
  const [financialMethod, setFinancialMethod] = useState<'cash' | 'card' | 'bank' | 'other'>('cash');
  const [financialNote, setFinancialNote] = useState('');

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !topUpAmount || isProcessingTopUp) return;
    
    setIsProcessingTopUp(true);
    try {
      const amount = parseFloat(topUpAmount);
      if (isNaN(amount) || amount <= 0) {
        alert("Veuillez saisir un montant valide.");
        setIsProcessingTopUp(false);
        return;
      }

      const change = financialOpType === 'encaissement' ? amount : -amount;
      const newBalance = (selectedCustomer.balance || 0) + change;
      
      const labelOp = financialOpType === 'encaissement' ? 'Encaissement/Versement' : 'Décaissement/Sortie';
      const noteRefStr = `[REGLEMENT] ${labelOp} de ${amount.toFixed(2)} ${settings.currency} (${financialMethod.toUpperCase()}) - ${financialNote || 'Ajustement de solde'}`;
      const noteEntry = {
        note: noteRefStr,
        author: 'Direction/Caisse',
        timestamp: new Date().toISOString()
      };
      
      const newNotes = [...(selectedCustomer.cashierNotes || []), noteEntry];

      const { error: customerError } = await supabase
        .from('customers')
        .update({
          balance: newBalance,
          cashierNotes: newNotes,
          updatedAt: new Date().toISOString()
        })
        .eq('id', selectedCustomer.id);
      if (customerError) throw customerError;

      const { error: expenseError } = await supabase
        .from('expenses')
        .insert({
          id: Math.random().toString(36).substring(2, 10),
          description: `${financialOpType === 'encaissement' ? 'Encaissement Règlement Client' : 'Décaissement/Retrait Client'} : ${selectedCustomer.name} (${financialNote || 'Sans note'})`,
          amount: -change,
          category: financialOpType === 'encaissement' ? 'Versement Client' : 'Remboursement Client',
          date: new Date().toISOString(),
          userId: 'system',
          paymentMethod: financialMethod
        });
      if (expenseError) throw expenseError;
      
      setIsTopUpModalOpen(false);
      setTopUpAmount('');
      setFinancialNote('');
      setFinancialMethod('cash');
      setFinancialOpType('encaissement');
    } catch (error: any) {
      console.error("Error top-up:", error);
      alert("Erreur lors de l'opération: " + error.message);
    } finally {
      setIsProcessingTopUp(false);
    }
  };

  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId) || null, [customers, selectedCustomerId]);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    loyaltyCardNumber: '',
    notes: '',
    isAppUser: false,
    password: ''
  });

  useEffect(() => {
    if (editingCustomer) {
      setFormData({
        name: editingCustomer.name || '',
        phone: editingCustomer.phone || '',
        email: editingCustomer.email || '',
        loyaltyCardNumber: editingCustomer.loyaltyCardNumber || '',
        notes: editingCustomer.notes || '',
        isAppUser: editingCustomer.isAppUser || false,
        password: ''
      });
    } else {
      setFormData({ name: '', phone: '', email: '', loyaltyCardNumber: '', notes: '', isAppUser: false, password: '' });
    }
  }, [editingCustomer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalPassword = editingCustomer?.password || '';
    
    // Hash password if a new one is provided
    if (formData.password) {
      finalPassword = bcrypt.hashSync(formData.password, 10);
    }

    const data = {
      ...formData,
      email: formData.email ? formData.email.trim().toLowerCase() : '',
      loyaltyPoints: editingCustomer?.loyaltyPoints || 0,
      balance: editingCustomer?.balance || 0,
      totalSpent: editingCustomer?.totalSpent || 0,
      password: finalPassword,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(data)
          .eq('id', editingCustomer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customers')
          .insert({ id: Math.random().toString(36).substring(2, 10), ...data, loyaltyPoints: 0, balance: 0, totalSpent: 0 });
        if (error) throw error;
      }
      setIsModalOpen(false);
      setEditingCustomer(null);
    } catch (error: any) {
      console.error("Error saving customer:", error);
      alert("Erreur lors de la sauvegarde: " + error.message);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerToDelete.id);
      if (error) throw error;
      
      if (selectedCustomerId === customerToDelete.id) {
        setSelectedCustomerId(null);
      }
      setIsDeleteConfirmOpen(false);
      setCustomerToDelete(null);
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      alert("Erreur lors de la suppression: " + error.message);
    }
  };

  const [sortConfig, setSortConfig] = useState<{ key: keyof Customer; direction: 'asc' | 'desc' } | null>(null);

  const filteredCustomers = useMemo(() => {
    const searchLower = search.toLowerCase();
    const raw = customers.filter((c: Customer) => 
      (c.name?.toLowerCase() || '').includes(searchLower) || 
      (c.phone || '').includes(search) ||
      (c.email?.toLowerCase() || '').includes(searchLower)
    );

    if (sortConfig !== null) {
      raw.sort((a, b) => {
        const aValue = a[sortConfig.key] ?? '';
        const bValue = b[sortConfig.key] ?? '';
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return raw;
  }, [customers, search, sortConfig]);

  const requestSort = (key: keyof Customer) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const openWhatsApp = (phone: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const [mainSection, setMainSection] = useState<'customers' | 'investors'>('customers');

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex gap-4 p-1 bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/5 w-fit">
        <button
          onClick={() => setMainSection('customers')}
          className={cn(
            "px-6 py-3 rounded-3xl text-xs font-black uppercase tracking-widest transition-all",
            mainSection === 'customers' 
              ? "bg-indigo-500 text-white shadow-neon-indigo" 
              : "text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          Clients
        </button>
        <button
          onClick={() => setMainSection('investors')}
          className={cn(
            "px-6 py-3 rounded-3xl text-xs font-black uppercase tracking-widest transition-all",
            mainSection === 'investors' 
              ? "bg-amber-500 text-slate-900 shadow-neon-amber" 
              : "text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          Micro-Investisseurs
        </button>
      </div>

      {mainSection === 'investors' ? (
        <div className="flex-1 overflow-hidden bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/5 p-6">
           <MicroInvestorsManager 
             settings={settings} 
             transactions={transactions} 
             products={products || []} 
             expenses={expenses || []} 
             stockAdjustments={stockAdjustments || []} 
             categories={categories || []}
           />
        </div>
      ) : (
      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
        {/* Left Panel: Customer List */}
        <div className="w-full md:w-1/3 flex flex-col gap-4 bg-white/5 backdrop-blur-xl p-6 rounded-[2rem] shadow-neon-indigo/5 border border-white/5 h-1/2 md:h-full overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Clients</h3>
            <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">{customers.length} total</p>
          </div>
          <Button onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }} size="sm" className="hidden sm:flex">
            <Plus size={16} /> Nouveau
          </Button>
          <Button variant="ghost" onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }} className="sm:hidden p-2 text-indigo-600">
            <Plus size={20} />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          <input 
            type="text"
            placeholder="Rechercher un dossier client..."
            className="w-full pl-11 pr-4 py-4 bg-slate-900/50 border border-white/5 rounded-2xl text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-white placeholder:text-slate-700 shadow-inner"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
          {filteredCustomers.map((customer: Customer) => (
            <div 
              key={customer.id} 
              onClick={() => setSelectedCustomerId(customer.id)}
              className={cn(
                "p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group",
                selectedCustomerId === customer.id 
                  ? "bg-indigo-600/20 border-indigo-500/40 shadow-neon-indigo" 
                  : "bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10"
              )}
            >
              <div className="flex items-center gap-4 overflow-hidden">
                <div className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center font-black flex-shrink-0 text-sm transition-all shadow-inner",
                  selectedCustomerId === customer.id ? "bg-indigo-500 text-white" : "bg-slate-900 text-slate-400 group-hover:text-indigo-400"
                )}>
                  {customer.name.charAt(0)}
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-white truncate text-sm uppercase tracking-wider">{customer.name}</h4>
                    {customer.isAppUser && (
                      <Smartphone size={14} className="text-indigo-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-tighter truncate">{customer.phone || 'Pas de téléphone'}</p>
                </div>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 gap-1.5">
                <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest animate-pulse">
                  <Award size={12} />
                  {customer.loyaltyPoints}
                </div>
                {(customer.balance || 0) < 0 && (
                  <span className="text-[8px] font-black tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-md font-mono uppercase">
                    Dette: {Math.abs(customer.balance).toFixed(2)}
                  </span>
                )}
                {(customer.balance || 0) > 0 && (
                  <span className="text-[8px] font-black tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-mono uppercase">
                    Solde: {customer.balance.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
          {filteredCustomers.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <Users size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucun client trouvé</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Detail View */}
      <div className="w-full md:w-2/3 bg-workspace rounded-[2.5rem] shadow-neon-indigo/5 border border-white/5 h-1/2 md:h-full flex flex-col overflow-hidden">
        {selectedCustomer ? (
          <>
            {/* Detail Header */}
            <div className="p-8 border-b border-white/5 bg-white/5">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-indigo-500/10 text-indigo-400 rounded-3xl border border-indigo-500/20 flex items-center justify-center font-black text-3xl shadow-neon-indigo">
                    {selectedCustomer.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white italic uppercase tracking-tight flex items-center gap-3">
                       {selectedCustomer.name}
                       {selectedCustomer.isAppUser && (
                         <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 text-indigo-400 text-[10px] font-black rounded-xl uppercase tracking-[0.2em] border border-indigo-500/20">
                           <Smartphone size={12} /> Live API
                         </span>
                       )}
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-white/60 font-bold uppercase tracking-widest">
                      {selectedCustomer.phone && (
                        <span className="flex items-center gap-2"><Phone size={14} className="text-indigo-400" /> {selectedCustomer.phone}</span>
                      )}
                      {selectedCustomer.email && (
                        <span className="flex items-center gap-2"><Mail size={14} className="text-indigo-400" /> {selectedCustomer.email}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedCustomer.phone && (
                    <button 
                      onClick={() => openWhatsApp(selectedCustomer.phone)}
                      className="p-3 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] flex items-center gap-2 shadow-lg shadow-emerald-500/5"
                    >
                      <MessageSquare size={16} /> WhatsApp
                    </button>
                  )}
                  <button 
                    onClick={() => { setEditingCustomer(selectedCustomer); setIsModalOpen(true); }}
                    className="p-3 text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-500/5"
                  >
                    Modifier
                  </button>
                  <button 
                    onClick={() => { setCustomerToDelete(selectedCustomer); setIsDeleteConfirmOpen(true); }}
                    className="p-3 text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-2xl transition-all shadow-lg shadow-rose-500/5"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-6 mt-8">
                <div className={cn(
                  "p-5 rounded-3xl border shadow-inner relative group transition-colors",
                  (selectedCustomer.balance || 0) < 0 
                    ? "bg-rose-500/5 border-rose-500/10" 
                    : "bg-slate-900 border-white/5"
                )}>
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-2 leading-none">
                    {(selectedCustomer.balance || 0) < 0 ? "Dette Client (Crédit)" : "Solde Prépayé"}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className={cn(
                      "text-xl font-black transition-colors",
                      (selectedCustomer.balance || 0) < 0 ? "text-rose-400" : "text-emerald-400"
                    )}>
                      {(selectedCustomer.balance || 0) < 0 
                        ? `${Math.abs(selectedCustomer.balance || 0).toFixed(2)}` 
                        : (selectedCustomer.balance || 0).toFixed(2)
                      } <span className="text-xs opacity-60 font-bold">{settings.currency}</span>
                    </p>
                    <button 
                      onClick={() => {
                        setFinancialOpType((selectedCustomer.balance || 0) < 0 ? 'encaissement' : 'encaissement'); // default
                        setFinancialMethod('cash');
                        setFinancialNote('');
                        setIsTopUpModalOpen(true);
                      }}
                      className={cn(
                        "p-1 px-3 rounded-xl text-[9px] border font-black uppercase hover:text-white transition-all opacity-0 group-hover:opacity-100",
                        (selectedCustomer.balance || 0) < 0 
                          ? "bg-rose-500/20 text-rose-400 border-rose-500/20 hover:bg-rose-500"
                          : "bg-emerald-500/20 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500"
                      )}
                    >
                      {(selectedCustomer.balance || 0) < 0 ? "Régler / Gérer" : "Gérer"}
                    </button>
                  </div>
                </div>
                <div className="bg-slate-900 p-5 rounded-3xl border border-white/5 shadow-inner">
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-2 leading-none">Status Points</p>
                  <p className="text-xl font-black text-amber-400">{selectedCustomer.loyaltyPoints} <span className="text-xs opacity-60 font-bold">PTS</span></p>
                </div>
                <div className="bg-slate-900 p-5 rounded-3xl border border-white/5 shadow-inner">
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-2 leading-none">Dernière Transaction</p>
                  <p className="text-xs font-black text-white mt-1 uppercase tracking-tighter">
                    {selectedCustomer.lastVisit ? formatSafe(selectedCustomer.lastVisit, 'dd/MM/yy', { locale: fr }) : 'Aucune'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b border-white/5 bg-slate-900/50">
              <button 
                onClick={() => setActiveTab('info')}
                className={cn("px-8 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all", activeTab === 'info' ? "border-indigo-500 text-indigo-400 bg-white/5" : "border-transparent text-slate-500 hover:text-white hover:bg-white/5")}
              >
                {t("Général")}
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={cn("px-8 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2", activeTab === 'history' ? "border-indigo-500 text-indigo-400 bg-white/5" : "border-transparent text-slate-500 hover:text-white hover:bg-white/5")}
              >
                {t("Journal de bord")} <span className="bg-indigo-500/20 text-indigo-400 py-0.5 px-2 rounded-lg text-[9px] border border-indigo-500/20">{transactions.filter(t => t.customerId === selectedCustomer.id).length}</span>
              </button>
              <button 
                onClick={() => setActiveTab('card')}
                className={cn("px-8 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all", activeTab === 'card' ? "border-indigo-500 text-indigo-400 bg-white/5" : "border-transparent text-slate-500 hover:text-white hover:bg-white/5")}
              >
                {t("Digital Card")}
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-nardo/50">
              {activeTab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 shadow-inner group">
                    <h4 className="text-xs font-black text-indigo-400 mb-8 flex items-center gap-3 uppercase tracking-widest leading-none">
                       <Contact size={18} /> Credentials Logic
                    </h4>
                    <div className="space-y-6 text-sm">
                      <div className="flex items-center gap-4">
                        <UserIcon className="text-white/40" size={16} />
                        <span className="text-white/60 w-28 text-[11px] font-black uppercase tracking-wider">Identité:</span>
                        <span className="text-white font-black uppercase tracking-tight">{selectedCustomer.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Phone className="text-white/40" size={16} />
                        <span className="text-white/60 w-28 text-[11px] font-black uppercase tracking-wider">Liaison Com:</span>
                        <span className="text-white font-black tracking-widest">{selectedCustomer.phone || '-' }</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Mail className="text-white/40" size={16} />
                        <span className="text-white/60 w-28 text-[11px] font-black uppercase tracking-wider">Interface Mail:</span>
                        <span className="text-white font-bold">{selectedCustomer.email || '-' }</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <CardIcon className="text-white/40" size={16} />
                        <span className="text-white/60 w-28 text-[11px] font-black uppercase tracking-wider">Nexus ID:</span>
                        <span className="text-indigo-400 font-mono text-xs font-black tracking-widest">{selectedCustomer.loyaltyCardNumber || 'NOTSET' }</span>
                      </div>
                    </div>
                  </div>

                  {selectedCustomer.notes && (
                    <div className="bg-amber-500/5 p-8 rounded-[2rem] border border-amber-500/20 shadow-inner group">
                      <h4 className="text-xs font-black text-amber-400 mb-4 flex items-center gap-3 uppercase tracking-widest leading-none">
                        <Quote size={18} /> Notes Internes
                      </h4>
                      <p className="text-sm text-amber-200/80 leading-relaxed italic">{selectedCustomer.notes}</p>
                    </div>
                  )}

                  <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 shadow-inner group md:col-span-2">
                    <h4 className="text-xs font-black text-indigo-400 mb-6 flex items-center gap-3 uppercase tracking-widest leading-none">
                       <Quote size={18} /> Historique des Règlements & Mémos
                    </h4>
                    <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
                      {selectedCustomer.cashierNotes && selectedCustomer.cashierNotes.length > 0 ? (
                        [...selectedCustomer.cashierNotes].sort((a,b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).map((note, index) => (
                          <div key={index} className="p-4 bg-slate-950/40 rounded-2xl border border-white/5 space-y-2 text-left">
                            <p className="text-xs text-slate-300 font-medium leading-relaxed">{note.note}</p>
                            <div className="flex justify-between items-center text-[9px] text-white/40 uppercase font-bold tracking-wider pt-2 border-t border-white/[0.03]">
                              <span>Par: {note.author}</span>
                              <span>{formatSafe(note.timestamp || Date.now(), 'dd/MM/yyyy HH:mm')}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-white/30 uppercase tracking-wider italic text-center py-6">Aucun règlement ou mémo enregistré d'historique.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  {transactions
                    .filter(t => t.customerId === selectedCustomer.id)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map(t => (
                      <div key={t.id} className="p-6 bg-[#0f111a] border border-white/5 rounded-3xl hover:bg-[#151823] hover:border-indigo-500/20 transition-all group relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4 relative z-10">
                          <div>
                            <p className="text-sm font-black text-white italic uppercase tracking-wider flex items-center gap-2">
                              SESSION #{t.id.slice(-6).toUpperCase()}
                            </p>
                            <p className="text-[10px] text-white/50 font-bold flex items-center gap-2 mt-1 uppercase tracking-widest"><Clock size={12} className="text-indigo-400/80"/> {format(new Date(t.timestamp), 'dd MMM yyyy • HH:mm', { locale: fr })}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="text-lg font-black text-indigo-400 tracking-tight">{t.total.toFixed(2)} <span className="text-[10px] opacity-70 font-bold">{settings.currency}</span></p>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onRestore(t);
                              }}
                              className="w-8 h-8 flex items-center justify-center bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl hover:bg-indigo-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                              title="Reprendre les produits"
                            >
                              <ShoppingBag size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-4 border-t border-white/[0.03] relative z-10">
                          {(t.items || []).map((item: any, idx: number) => (
                            <span key={item.cartItemId || item.id || `hist-item-${idx}`} className="px-2.5 py-1 bg-white/5 text-slate-300 font-bold rounded-lg text-[10px] border border-white/5 uppercase tracking-wide flex items-center gap-1.5">
                              <span className="text-white font-black">{item.quantity}X</span> {item.productName || item.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  {transactions.filter(t => t.customerId === selectedCustomer.id).length === 0 && (
                    <div className="text-center py-16 text-slate-500">
                      <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="font-medium">Aucun achat effectué.</p>
                      <p className="text-sm mt-1">Les achats liés à ce client apparaîtront ici.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'card' && (
                <div className="flex flex-col items-center max-w-md mx-auto space-y-6">
                  <div id={`loyalty-card-export-${selectedCustomer.id}`} className="w-full space-y-6 bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-2xl relative">
                    <div id="loyalty-card-preview" className="w-full aspect-[1.586/1] bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden transition-transform hover:scale-[1.02]">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400/20 rounded-full -ml-16 -mb-16 blur-xl" />
                    
                    <div className="relative h-full flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xl font-black tracking-tight">{settings.name}</h4>
                          <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest mt-0.5">Membre Privilège</p>
                        </div>
                        <Award size={28} className="text-amber-400 drop-shadow-md" />
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-xs text-indigo-300 uppercase tracking-wider font-bold">Titulaire</p>
                        <p className="text-2xl font-black tracking-wide truncate">{selectedCustomer.name}</p>
                      </div>
                      
                      <div className="flex justify-between items-end">
                        <div className="font-mono text-sm tracking-widest text-indigo-100 bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
                          {selectedCustomer.loyaltyCardNumber || 'XXXX XXXX XXXX'}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-indigo-200 uppercase font-bold tracking-wider">Points</p>
                          <p className="text-3xl font-black text-amber-400 leading-none drop-shadow-sm">{selectedCustomer.loyaltyPoints}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-full p-4 bg-white rounded-xl border border-slate-200 flex flex-col items-center gap-3 shadow-sm">
                    <div className="p-4 bg-white rounded-xl border-2 border-slate-100">
                      <QRCodeCanvas 
                        id={`qr-loyalty-${selectedCustomer.id}`}
                        value={selectedCustomer.loyaltyCardNumber || selectedCustomer.id} 
                        size={140}
                        level="Q"
                        includeMargin={false}
                      />
                    </div>
                    <p className="text-xs text-slate-500 font-medium text-center">
                      Code pour le scan en caisse<br/>
                      <span className="font-mono font-bold text-slate-800 mt-1 block">{selectedCustomer.loyaltyCardNumber || selectedCustomer.id}</span>
                    </p>
                  </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <Button variant="secondary" className="gap-2 font-bold py-4" onClick={() => {
                      const printWindow = window.open('', '_blank');
                      if (!printWindow) return;
                      const canvas = document.getElementById(`qr-loyalty-${selectedCustomer.id}`) as HTMLCanvasElement;
                      const qrImageData = canvas ? canvas.toDataURL() : '';
                      
                      const cardHtml = `
                        <html>
                          <head>
                            <title>Carte Fidélité - ${selectedCustomer.name}</title>
                            <style>
                              @page { size: auto; margin: 0; }
                              body { font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; }
                              .card { 
                                width: 350px; 
                                height: 200px; 
                                background: linear-gradient(135deg, #4f46e5, #7c3aed); 
                                border-radius: 16px; 
                                padding: 24px; 
                                color: white; 
                                position: relative;
                                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                              }
                              .qr-section { 
                                background: white; 
                                padding: 8px; 
                                border-radius: 12px; 
                                width: 80px; 
                                height: 80px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                border: 1px solid #e2e8f0;
                              }
                              .qr-section img { width: 100%; height: 100%; }
                              .name { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
                              .points-badge { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
                              .points-val { color: #fbbf24; font-size: 20px; font-weight: 900; }
                            </style>
                          </head>
                          <body>
                            <div class="card">
                              <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div>
                                  <div style="font-size: 16px; font-weight: 800;">${settings.name}</div>
                                  <div style="font-size: 9px; opacity: 0.8; letter-spacing: 1px; margin-top: 2px;">CARTE FIDÉLITÉ</div>
                                </div>
                                <div class="qr-section">
                                  <img src="${qrImageData}" />
                                </div>
                              </div>
                              
                              <div style="margin-top: 10px;">
                                <div style="font-size: 9px; opacity: 0.8; margin-bottom: 2px;">TITULAIRE</div>
                                <div class="name">${selectedCustomer.name}</div>
                                <div style="font-family: monospace; font-size: 12px; letter-spacing: 2px; opacity: 0.9; margin-top: 4px;">
                                  ${selectedCustomer.loyaltyCardNumber || '#### #### #### ####'}
                                </div>
                              </div>
                              
                              <div style="position: absolute; bottom: 24px; right: 24px; text-align: right;">
                                <div style="font-size: 9px; opacity: 0.8;">POINTS</div>
                                <div class="points-val">${selectedCustomer.loyaltyPoints}</div>
                              </div>
                            </div>
                            <script>
                              window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };
                            </script>
                          </body>
                        </html>
                      `;
                      printWindow.document.write(cardHtml);
                      printWindow.document.close();
                    }}>
                      <Printer size={18} /> Imprimer
                    </Button>
                    <Button variant="outline" className="gap-2 border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold hover:bg-emerald-500 hover:text-white py-4 transition-colors" onClick={async () => {
                      const exportEl = document.getElementById(`loyalty-card-export-${selectedCustomer.id}`);
                      if (!exportEl) {
                        const message = encodeURIComponent(`Bonjour ${selectedCustomer.name}, voici votre carte de fidélité ${settings.name}.\n\nNuméro de Carte: ${selectedCustomer.loyaltyCardNumber || selectedCustomer.id}\nSolde de Points: ${selectedCustomer.loyaltyPoints} pts\n\nMerci de votre fidélité !`);
                        window.open(`https://wa.me/${selectedCustomer.phone?.replace(/\\D/g, '')}?text=${message}`, '_blank');
                        return;
                      }
                      
                      try {
                        const { toBlob } = await import('html-to-image');
                        const blob = await toBlob(exportEl, {
                          pixelRatio: 2,
                          backgroundColor: '#0f172a',
                        });
                        
                        if (!blob) return;
                        
                        const message = `Bonjour ${selectedCustomer.name}, voici votre carte de fidélité ${settings.name}.\n\nSolde de Points: ${selectedCustomer.loyaltyPoints} pts\n\nMerci de votre fidélité !`;
                        
                        // Always download the image to ensure they get it
                        const link = document.createElement('a');
                        link.download = `carte_fidelite_${selectedCustomer.id}.png`;
                        link.href = URL.createObjectURL(blob);
                        link.click();
                        
                        // Use location.href instead of window.open to avoid popup block after async ops
                        setTimeout(() => {
                          window.location.href = `https://wa.me/${selectedCustomer.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(message + " (N'oubliez pas de joindre l'image téléchargée !)")}`;
                        }, 500);
                        
                      } catch(e) {
                        console.error('Erreur html-to-image', e);
                      }
                    }}>
                      <MessageSquare size={18} /> WhatsApp
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-600">
            <div className="w-24 h-24 bg-slate-900 rounded-[2rem] flex items-center justify-center mb-8 border border-white/5 shadow-inner">
              <UserIcon size={48} className="text-slate-700" />
            </div>
            <h3 className="text-xl font-black text-white italic uppercase tracking-tight mb-3">Aucun client sélectionné</h3>
            <p className="max-w-xs text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">Sélectionnez un client dans la liste pour voir son solde de points, son historique et générer sa carte de fidélité.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCustomer ? "Modifier le client" : "Nouveau client"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Nom Complet *</label>
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
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Numéro de Carte de Fidélité</label>
            <div className="relative">
              <input className="w-full p-2 pr-24 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono" value={formData.loyaltyCardNumber} onChange={e => setFormData({...formData, loyaltyCardNumber: e.target.value})} />
              <button
                type="button"
                onClick={() => {
                  // Generate an EAN-13 compliant 13-digit number (we will just generate 12 random digits and calculate the 13th check digit for EAN13 validity)
                  let digits = "";
                  for(let i=0; i<12; i++) digits += Math.floor(Math.random() * 10).toString();
                  let sum = 0;
                  for(let i=0; i<12; i++) {
                    sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3);
                  }
                  const checkDigit = (10 - (sum % 10)) % 10;
                  setFormData({...formData, loyaltyCardNumber: digits + checkDigit});
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded"
              >
                Générer
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Notes</label>
            <textarea className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-24" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
          </div>
          <div className="flex flex-col gap-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                <Smartphone size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-800">Accès Application Client</p>
                <p className="text-xs text-slate-500">Permet au client de voir ses points et l'historique en ligne</p>
              </div>
              <input 
                type="checkbox" 
                className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                checked={formData.isAppUser}
                onChange={e => setFormData({...formData, isAppUser: e.target.checked})}
              />
            </div>
            
            {formData.isAppUser && (
              <div className="mt-2 pt-3 border-t border-indigo-100/50">
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Mot de passe pour l'accès App</label>
                <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      placeholder={editingCustomer ? "Laisser vide pour ne pas changer..." : "Définir un mot de passe..."}
                      className="w-full p-2.5 pr-24 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
                          let retVal = "";
                          for (let i = 0, n = charset.length; i < 8; ++i) {
                            retVal += charset.charAt(Math.floor(Math.random() * n));
                          }
                          setFormData({...formData, password: retVal});
                          setShowPassword(true);
                        }}
                        className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md hover:bg-slate-200 font-bold uppercase transition-colors"
                      >
                        Générer
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                </div>
                <p className="text-[10px] text-indigo-500 font-medium mt-1.5 flex items-start gap-1">
                  <span className="text-lg leading-none">&bull;</span>
                  L'email ci-dessus servira d'identifiant de connexion.
                </p>
              </div>
            )}
          </div>
          <Button type="submit" className="w-full py-3">
            {editingCustomer ? "Enregistrer les modifications" : "Créer le client"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog 
        isOpen={isDeleteConfirmOpen}
        onClose={() => { setIsDeleteConfirmOpen(false); setCustomerToDelete(null); }}
        onConfirm={handleDeleteCustomer}
        title="Supprimer le client"
        message={`Êtes-vous sûr de vouloir supprimer le client "${customerToDelete?.name}" ?`}
      />

      {/* Caisse & Crédit Client Modal */}
      <Modal 
        isOpen={isTopUpModalOpen} 
        onClose={() => setIsTopUpModalOpen(false)} 
        title="Règlement, Crédit & Mouvements de Caisse"
      >
        <form onSubmit={handleTopUp} className="space-y-5 py-2">
          {/* Client summary */}
          <div className={cn(
            "flex items-center gap-4 p-4 rounded-2xl border transition-colors",
            (selectedCustomer?.balance || 0) < 0 
              ? "bg-rose-500/5 border-rose-500/20" 
              : "bg-emerald-500/5 border-emerald-500/20"
          )}>
            <div className={cn(
               "w-12 h-12 rounded-xl flex items-center justify-center font-black shadow-sm",
               (selectedCustomer?.balance || 0) < 0 
                 ? "bg-rose-500/10 text-rose-400" 
                 : "bg-emerald-500/10 text-emerald-400"
            )}>
              <CardIcon size={24} />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase tracking-tight">{selectedCustomer?.name}</p>
              <p className={cn(
                "text-xs font-black uppercase mt-0.5",
                (selectedCustomer?.balance || 0) < 0 ? "text-rose-400" : "text-emerald-400"
              )}>
                {(selectedCustomer?.balance || 0) < 0 
                  ? `Dette Actuelle: ${Math.abs(selectedCustomer?.balance || 0).toFixed(2)} ${settings.currency}`
                  : `Solde Disponible: ${(selectedCustomer?.balance || 0).toFixed(2)} ${settings.currency}`
                }
              </p>
            </div>
          </div>

          {/* Operation type picker */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">Type d'opération</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFinancialOpType('encaissement')}
                className={cn(
                  "p-4 rounded-2xl border text-left flex flex-col gap-1 transition-all",
                  financialOpType === 'encaissement'
                    ? "bg-emerald-500/10 border-emerald-500/30 ring-2 ring-emerald-500/20"
                    : "bg-slate-900/30 border-white/5 opacity-60 hover:opacity-100"
                )}
              >
                <span className="text-emerald-400 text-xs font-black uppercase tracking-wider">Encaissement (+)</span>
                <span className="text-[9px] text-slate-450 font-bold leading-normal">Le client règle une partie ou totalité de sa dette, ou recharge son solde.</span>
              </button>
              <button
                type="button"
                onClick={() => setFinancialOpType('decaissement')}
                className={cn(
                  "p-4 rounded-2xl border text-left flex flex-col gap-1 transition-all",
                  financialOpType === 'decaissement'
                    ? "bg-rose-500/10 border-rose-500/30 ring-2 ring-rose-500/20"
                    : "bg-slate-900/30 border-white/5 opacity-60 hover:opacity-100"
                )}
              >
                <span className="text-rose-400 text-xs font-black uppercase tracking-wider">Décaissement (-)</span>
                <span className="text-[9px] text-slate-450 font-bold leading-normal">Vous sortez de l'argent pour rembourser le client, ou enregistrez un crédit d'achat.</span>
              </button>
            </div>
          </div>

          {/* Amount and quick actions */}
          <div className="space-y-2 font-mono">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">Montant ({settings.currency})</label>
            <div className="relative">
              <input 
                type="number"
                step="any"
                required
                autoFocus
                className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 px-5 text-xl font-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                placeholder="0.00"
                value={topUpAmount}
                onChange={e => setTopUpAmount(e.target.value)}
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 font-black">
                {settings.currency}
              </div>
            </div>

            {/* Quick amount buttons */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {/* If there's a debt, offer to clear it completely */}
              {selectedCustomer && (selectedCustomer.balance || 0) < 0 && (
                <button
                  type="button"
                  onClick={() => setTopUpAmount(Math.abs(selectedCustomer.balance || 0).toFixed(2))}
                  className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-400 font-mono text-[9px] font-black rounded-lg border border-rose-500/10 transition-all uppercase tracking-wider"
                >
                  Régler toute la dette ({Math.abs(selectedCustomer.balance || 0).toFixed(2)})
                </button>
              )}
              {[10, 20, 50, 100, 200, 505].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    const currentVal = parseFloat(topUpAmount) || 0;
                    setTopUpAmount((currentVal + val).toString());
                  }}
                  className="px-2.5 py-1.5 bg-slate-800/40 hover:bg-slate-800/80 active:scale-95 text-[9px] text-slate-300 font-mono font-bold rounded-lg border border-white/5 transition-all"
                >
                  +{val}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setTopUpAmount('')}
                className="px-2.5 py-1.5 bg-rose-500/5 hover:bg-rose-500/15 active:scale-95 text-[9px] text-rose-400 font-mono font-bold rounded-lg border border-rose-500/10 transition-all"
              >
                Vider
              </button>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">Mode de règlement</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'cash', label: 'Espèces' },
                { id: 'card', label: 'Carte' },
                { id: 'bank', label: 'Virement' },
                { id: 'other', label: 'Autre' }
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFinancialMethod(m.id as any)}
                  className={cn(
                    "py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-wider text-center transition-all",
                    financialMethod === m.id
                      ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-400 font-black shadow-neon-indigo/10"
                      : "bg-slate-900 text-slate-400 border-white/5 hover:text-white"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comment/Note */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold font-sans">Note / Motif (Facultatif)</label>
            <input 
              type="text"
              placeholder="Ex: Règlement ardoise, Remboursement espèces..."
              className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-3.5 px-4 text-xs font-bold text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              value={financialNote}
              onChange={e => setFinancialNote(e.target.value)}
            />
          </div>

          {/* Projected outcome */}
          {(() => {
            const val = parseFloat(topUpAmount) || 0;
            if (val > 0) {
              const currentBalance = selectedCustomer?.balance || 0;
              const change = financialOpType === 'encaissement' ? val : -val;
              const newBalance = currentBalance + change;
              return (
                <div className="p-4 bg-slate-950/80 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider">
                    <span className="text-slate-400">Nouveau Solde :</span>
                    <span className={cn(
                      "font-black text-sm",
                      newBalance < 0 ? "text-rose-400" : newBalance > 0 ? "text-emerald-400" : "text-white/60"
                    )}>
                      {newBalance < 0 
                        ? `Dette de ${Math.abs(newBalance).toFixed(2)}` 
                        : `${newBalance.toFixed(2)}`
                      } {settings.currency}
                    </span>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-3">
            <Button variant="secondary" type="button" onClick={() => setIsTopUpModalOpen(false)} className="py-4 font-bold">Annuler</Button>
            <Button 
              type="submit" 
              disabled={isProcessingTopUp} 
              className={cn(
                "py-4 font-extrabold uppercase tracking-wider text-xs border border-transparent",
                financialOpType === 'encaissement' 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                  : "bg-rose-600 hover:bg-rose-700 text-white"
              )}
            >
              {isProcessingTopUp ? "Traitement..." : `Valider l'${financialOpType}`}
            </Button>
          </div>
        </form>
      </Modal>
      </div>
      )}
    </div>
  );
});
