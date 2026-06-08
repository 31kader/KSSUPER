import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { 
  TrendingUp, HandCoins, UserPlus, DollarSign, Edit, Trash2, X, 
  ShieldCheck, Banknote, AlertTriangle, CheckCircle2, Search,
  ShoppingBag, Calendar, Clock, Activity, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

export interface MicroInvestor {
  id: string;
  name: string;
  phone: string;
  email?: string;
  initialInvestment: number;
  sharePercentage: number;
  joinDate: string;
  totalDividendsPaid: number;
  status: 'active' | 'inactive';
  investmentTargetType?: 'global' | 'category' | 'product';
  targetId?: string;
}

export interface DividendPayment {
  id: string;
  investorId: string;
  amount: number;
  date: string;
  notes?: string;
}

export function MicroInvestorsManager({ 
  settings, 
  transactions = [], 
  products = [], 
  expenses = [], 
  stockAdjustments = [],
  categories = [] 
}: { 
  settings: any;
  transactions?: any[];
  products?: any[];
  expenses?: any[];
  stockAdjustments?: any[];
  categories?: any[];
}) {
  const [investors, setInvestors] = useState<MicroInvestor[]>([]);
  const [payments, setPayments] = useState<DividendPayment[]>([]);
  
  const [isAddingInvestor, setIsAddingInvestor] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<MicroInvestor | null>(null);
  const [selectedInvestorSales, setSelectedInvestorSales] = useState<MicroInvestor | null>(null);
  
  // Custom dialogs state to avoid window.prompt/alert
  const [actionError, setActionError] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState<MicroInvestor | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  
  const [showWithdrawDialog, setShowWithdrawDialog] = useState<MicroInvestor | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<number | ''>('');

  const [targetSearchQuery, setTargetSearchQuery] = useState('');
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const targetDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (targetDropdownRef.current && !targetDropdownRef.current.contains(event.target as Node)) {
        setShowTargetDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [newInvestor, setNewInvestor] = useState<Partial<MicroInvestor>>({
    name: '',
    phone: '',
    initialInvestment: 0,
    sharePercentage: 0,
    joinDate: new Date().toISOString().split('T')[0],
    totalDividendsPaid: 0,
    status: 'active',
    investmentTargetType: 'global',
    targetId: ''
  });

  // Calculate Net Profit
  const { netProfit, grossProfit, totalRevenue, totalCost, totalExpenses, totalLosses, productProfits, categoryProfits } = useMemo(() => {
    const revenue = transactions.reduce((sum, t) => sum + (t.total || 0), 0);
    
    // Track profits granularly per product and category
    const prodProfits: Record<string, number> = {};
    const catProfits: Record<string, number> = {};
    
    // Revenue & Cost from transactions
    transactions.forEach(t => {
       (t.items || []).forEach((item: any) => {
         const p = products.find(prod => prod.id === item.productId);
         if (p) {
            // Estimate item actual revenue taking global discount into account would be complex,
            // we use item.total if exists, else price * qty
            const itemRevenue = item.total || (item.price * item.quantity);
            const itemCost = (p.costPrice || 0) * item.quantity;
            const itemGross = itemRevenue - itemCost;
            
            prodProfits[p.id] = (prodProfits[p.id] || 0) + itemGross;
            if (p.categoryId) {
               catProfits[p.categoryId] = (catProfits[p.categoryId] || 0) + itemGross;
            }
         }
       });
    });

    const cost = transactions.reduce((sum, t) => {
      if (t.totalCost !== undefined) return sum + t.totalCost;
      return sum + (t.items || []).reduce((itemSum: number, item: any) => {
         const p = products.find(prod => prod.id === item.productId);
         return itemSum + ((p?.costPrice || 0) * item.quantity);
      }, 0);
    }, 0);
    
    const exp = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    // Process losses
    const losses = stockAdjustments.filter(adj => adj.adjustment < 0 && adj.isLoss === true);
    let totalLossValue = 0;
    losses.forEach(adj => {
      const p = products.find(prod => prod.id === adj.productId);
      if (p) {
         const lossVal = Math.abs(adj.adjustment) * (p.costPrice || 0);
         totalLossValue += lossVal;
         prodProfits[p.id] = (prodProfits[p.id] || 0) - lossVal;
         if (p.categoryId) {
            catProfits[p.categoryId] = (catProfits[p.categoryId] || 0) - lossVal;
         }
      }
    });
    
    const gross = revenue - cost;
    const net = gross - exp - totalLossValue;
    
    return {
       netProfit: net < 0 ? 0 : net, // Cannot distribute negative profit, but could show total deficit
       realNetProfit: net,
       grossProfit: gross,
       totalRevenue: revenue,
       totalCost: cost,
       totalExpenses: exp,
       totalLosses: totalLossValue,
       productProfits: prodProfits,
       categoryProfits: catProfits
    };
  }, [transactions, products, expenses, stockAdjustments]);

  useEffect(() => {
    const fetchInvestors = async () => {
      const { data, error } = await supabase.from('microInvestors').select('*');
      if (error) console.error("Error fetching investors:", error);
      else setInvestors(data || []);
    };
    const fetchPayments = async () => {
      const { data, error } = await supabase.from('dividendPayments').select('*');
      if (error) console.error("Error fetching payments:", error);
      else setPayments(data || []);
    };
    fetchInvestors();
    fetchPayments();
  }, []);

  const handleSaveInvestor = async () => {
    setActionError(null);
    if (!newInvestor.name) {
      setActionError("Veuillez entrer le nom de l'investisseur.");
      return;
    }
    if (!newInvestor.initialInvestment || Number(newInvestor.initialInvestment) <= 0) {
      setActionError("Veuillez entrer un montant d'investissement valide.");
      return;
    }
    
    const initialInvestment = Number(newInvestor.initialInvestment);
    const sharePercentage = Number(newInvestor.sharePercentage || 0);

    const investorData = {
      ...newInvestor,
      initialInvestment,
      sharePercentage,
    };
    
    if (editingInvestor) {
      const { error } = await supabase
        .from('microInvestors')
        .update(investorData)
        .eq('id', editingInvestor.id);
      if (error) throw error;
      setInvestors(prev => prev.map(inv => inv.id === editingInvestor.id ? { ...inv, ...investorData } as MicroInvestor : inv));
      setEditingInvestor(null);
    } else {
      const { error } = await supabase
        .from('microInvestors')
        .insert({ id: Math.random().toString(36).substring(2, 10), ...investorData });
      if (error) throw error;
      // In a real app we might refetch or use real-time
      setInvestors(prev => [...prev, { id: Math.random().toString(36).substring(2, 10), ...investorData } as MicroInvestor]);
      setIsAddingInvestor(false);
    }
    
    setNewInvestor({
      name: '',
      phone: '',
      initialInvestment: 0,
      sharePercentage: 0,
      joinDate: new Date().toISOString().split('T')[0],
      totalDividendsPaid: 0,
      status: 'active'
    });
  };

  const handleRecordPayment = async () => {
    if (!showPaymentDialog || paymentAmount === '' || Number(paymentAmount) <= 0) return;
    
    const amount = Number(paymentAmount);
    const investorId = showPaymentDialog.id;
    
    const payment = {
      id: Math.random().toString(36).substring(2, 10),
      investorId,
      amount,
      date: new Date().toISOString(),
    };
    
    const { error: paymentError } = await supabase.from('dividendPayments').insert(payment);
    if (paymentError) throw paymentError;
    setPayments(prev => [...prev, payment]);
    
    const investor = investors.find(i => i.id === investorId);
    if (investor) {
      const newTotal = (investor.totalDividendsPaid || 0) + amount;
      const { error: invError } = await supabase
        .from('microInvestors')
        .update({ totalDividendsPaid: newTotal })
        .eq('id', investorId);
      if (invError) throw invError;
      setInvestors(prev => prev.map(inv => inv.id === investorId ? { ...inv, totalDividendsPaid: newTotal } : inv));
    }
    
    setShowPaymentDialog(null);
    setPaymentAmount('');
  };

  const handleWithdrawCapital = async () => {
    if (!showWithdrawDialog || withdrawAmount === '' || Number(withdrawAmount) <= 0) return;
    
    const amount = Number(withdrawAmount);
    const investorId = showWithdrawDialog.id;
    
    if (amount > showWithdrawDialog.initialInvestment) {
      alert("Le montant du retrait ne peut pas dépasser le capital investi.");
      return;
    }
    
    const newCapital = showWithdrawDialog.initialInvestment - amount;
    
    const { error } = await supabase
      .from('microInvestors')
      .update({ initialInvestment: newCapital })
      .eq('id', investorId);
    if (error) throw error;
    setInvestors(prev => prev.map(inv => inv.id === investorId ? { ...inv, initialInvestment: newCapital } : inv));
    
    setShowWithdrawDialog(null);
    setWithdrawAmount('');
  };

  const totalInvestment = investors.reduce((acc, inv) => acc + (inv.status === 'active' ? inv.initialInvestment : 0), 0);
  const totalPaid = investors.reduce((acc, inv) => acc + (inv.totalDividendsPaid || 0), 0);

  // Helper to extract transactions matching the investor target
  const getInvestorSales = (inv: MicroInvestor) => {
    return transactions.filter(t => {
      if (inv.investmentTargetType === 'product' && inv.targetId) {
        return (t.items || []).some((item: any) => item.productId === inv.targetId);
      } else if (inv.investmentTargetType === 'category' && inv.targetId) {
        return (t.items || []).some((item: any) => {
          const p = products.find(prod => prod.id === item.productId);
          return p && p.categoryId === inv.targetId;
        });
      }
      return true; // global
    });
  };

  const getInvestorSalesDetails = (inv: MicroInvestor) => {
    const list = getInvestorSales(inv);
    let totalRev = 0;
    let totalCostVal = 0;
    
    const details = list.map(t => {
      let matchingRevenue = 0;
      let matchingCost = 0;
      
      const matchingItems = (t.items || []).filter((item: any) => {
        const p = products.find(prod => prod.id === item.productId);
        let matches = false;
        if (inv.investmentTargetType === 'product') {
          matches = item.productId === inv.targetId;
        } else if (inv.investmentTargetType === 'category') {
          matches = !!p && p.categoryId === inv.targetId;
        } else {
          matches = true;
        }
        
        if (matches) {
          const itemRev = item.total || (item.price * item.quantity);
          const itemCost = (p?.costPrice || 0) * item.quantity;
          matchingRevenue += itemRev;
          matchingCost += itemCost;
        }
        return matches;
      });
      
      const profit = matchingRevenue - matchingCost;
      const investorShare = profit * (inv.sharePercentage / 100);
      
      totalRev += matchingRevenue;
      totalCostVal += matchingCost;
      
      return {
        id: t.id,
        timestamp: t.timestamp,
        items: t.items,
        matchingItems,
        total: t.total,
        matchingRevenue,
        profit,
        investorShare,
        buyerName: t.customerName || t.customer?.name || "Client de passage",
        sellerName: t.employeeName || "Caisse"
      };
    }).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const totalProfit = totalRev - totalCostVal;
    const totalShare = totalProfit * (inv.sharePercentage / 100);

    return {
      details,
      totalRevenue: totalRev,
      totalProfit,
      totalShare
    };
  };

  // Merge and sort dividend payouts
  const sortedDividendJournal = useMemo(() => {
    return [...payments].map(p => {
      const inv = investors.find(i => i.id === p.investorId);
      return {
        id: p.id,
        investorName: inv?.name || 'Investisseur Inconnu',
        investorTarget: inv ? (inv.investmentTargetType === 'product' ? 'Produit' : inv.investmentTargetType === 'category' ? 'Catégorie' : 'Global') : 'Global',
        amount: p.amount,
        date: p.date,
        type: 'versement' as const,
        notes: p.notes || 'Versement de dividendes'
      };
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, investors]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-4 lg:p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/5 p-6 rounded-[2rem] border border-white/5 shadow-xl py-8">
        <div className="mb-4 sm:mb-0">
          <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-neon-amber">
              <HandCoins size={24} />
            </div>
            Micro-Investisseurs
          </h2>
          <p className="text-slate-400 text-sm mt-2 ml-1">Gérez le capital, les parts et les paiements de dividendes</p>
        </div>
        <button 
          onClick={() => {
             setIsAddingInvestor(true);
             setEditingInvestor(null);
             setNewInvestor({
                name: '',
                phone: '',
                initialInvestment: 0,
                sharePercentage: 0,
                joinDate: new Date().toISOString().split('T')[0],
                totalDividendsPaid: 0,
                status: 'active'
             });
          }}
          className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 font-bold px-6 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg text-sm uppercase tracking-widest w-full sm:w-auto"
        >
          <UserPlus size={18} />
          Ajouter
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/5 p-8 rounded-[2rem] relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
             <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Capital Actif Total</p>
             <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20">
               <Banknote size={20} />
             </div>
          </div>
          <h3 className="text-4xl font-black text-white tracking-tighter">{totalInvestment.toLocaleString()} {settings.currency}</h3>
        </div>
        
        <div className="bg-slate-900 border border-indigo-500/30 p-8 rounded-[2rem] relative overflow-hidden flex flex-col justify-between shadow-neon-indigo/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none"></div>
          <div className="flex items-center justify-between mb-4">
             <p className="text-indigo-400 text-xs font-black uppercase tracking-widest">Bénéfice Net Disponible</p>
             <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/20">
               <TrendingUp size={20} />
             </div>
          </div>
          <div>
            <h3 className="text-4xl font-black text-white tracking-tighter">{netProfit.toFixed(2)} {settings.currency}</h3>
            <div className="mt-4 space-y-1">
               <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex justify-between">
                 <span>Chiffre d'affaires:</span> <span className="text-white">+{totalRevenue.toFixed(2)}</span>
               </p>
               <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex justify-between">
                 <span>Coût d'achat:</span> <span className="text-rose-400">-{totalCost.toFixed(2)}</span>
               </p>
               <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex justify-between">
                 <span>Dépenses:</span> <span className="text-rose-400">-{totalExpenses.toFixed(2)}</span>
               </p>
               <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex justify-between">
                 <span>Pertes (Produits):</span> <span className="text-rose-400">-{totalLosses.toFixed(2)}</span>
               </p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/5 p-8 rounded-[2rem] relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
             <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Bénéfices Reversés</p>
             <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/20 shadow-neon-amber">
               <DollarSign size={20} />
             </div>
          </div>
          <h3 className="text-4xl font-black text-amber-400 tracking-tighter">{totalPaid.toLocaleString()} {settings.currency}</h3>
        </div>
      </div>

      {(isAddingInvestor || editingInvestor) && (
        <div className="p-8 bg-slate-900 border border-white/5 rounded-[2rem] relative shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-white tracking-tight">{editingInvestor ? 'Modifier Investisseur' : 'Nouvel Investisseur'}</h3>
            <button onClick={() => { setIsAddingInvestor(false); setEditingInvestor(null); }} className="w-10 h-10 bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 rounded-2xl flex items-center justify-center text-slate-400 transition-colors">
              <X size={20} />
            </button>
          </div>
          
          {actionError && (
             <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm font-bold flex items-center gap-2">
                <ShieldCheck size={16} />
                {actionError}
             </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nom complet</label>
              <input 
                value={newInvestor.name} 
                onChange={(e) => setNewInvestor({...newInvestor, name: e.target.value})}
                className="w-full bg-slate-950 border border-white/5 text-white rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/50 placeholder:text-slate-700"
                placeholder="Nom de l'investisseur"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Montant Investi ({settings.currency})</label>
              <input 
                type="number"
                value={newInvestor.initialInvestment === 0 ? '' : newInvestor.initialInvestment} 
                onChange={(e) => setNewInvestor({...newInvestor, initialInvestment: e.target.value === '' ? 0 : Number(e.target.value)})}
                className="w-full bg-slate-950 border border-white/5 text-white rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Parts sur Bénéfices (%)</label>
              <input 
                type="number"
                value={newInvestor.sharePercentage === 0 ? '' : newInvestor.sharePercentage} 
                onChange={(e) => setNewInvestor({...newInvestor, sharePercentage: e.target.value === '' ? 0 : Number(e.target.value)})}
                className="w-full bg-slate-950 border border-white/5 text-white rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                placeholder="0"
              />
            </div>
            <div className="flex flex-col space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Cible d'investissement</label>
              <select
                value={newInvestor.investmentTargetType || 'global'}
                onChange={(e) => setNewInvestor({ ...newInvestor, investmentTargetType: e.target.value as any, targetId: '' })}
                className="w-full bg-slate-950 border border-white/5 text-white rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                 <option value="global">Global (Tout)</option>
                 <option value="category">Par Catégorie</option>
                 <option value="product">Par Produit</option>
              </select>
            </div>
            {newInvestor.investmentTargetType === 'category' && (
              <div className="relative group w-full" ref={targetDropdownRef}>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Catégorie cible</label>
                <div className="relative" onClick={() => setShowTargetDropdown(true)}>
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-amber-400 transition-colors" size={18} />
                  <input
                    type="text"
                    value={targetSearchQuery}
                    onChange={(e) => {
                      setTargetSearchQuery(e.target.value);
                      setShowTargetDropdown(true);
                      setNewInvestor({ ...newInvestor, targetId: '' });
                    }}
                    onFocus={() => setShowTargetDropdown(true)}
                    placeholder={newInvestor.targetId ? categories.find((c: any) => c.id === newInvestor.targetId)?.name || 'Sélectionner une catégorie' : "RECHERCHER UNE CATÉGORIE..."}
                    className="w-full pl-12 pr-10 py-3 bg-slate-950 border border-white/5 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/50 text-sm font-bold text-white placeholder:text-slate-600 transition-all uppercase tracking-wider"
                  />
                  {newInvestor.targetId && (
                     <button 
                       onClick={(e) => {
                          e.stopPropagation();
                          setNewInvestor({ ...newInvestor, targetId: '' });
                          setTargetSearchQuery('');
                       }} 
                       className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-rose-400 transition-colors"
                     >
                       <X size={16} />
                     </button>
                  )}
                </div>
                {showTargetDropdown && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                    {categories.filter((c: any) => c.name.toLowerCase().includes(targetSearchQuery.toLowerCase())).length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500">Aucune catégorie trouvée</div>
                    ) : (
                      categories.filter((c: any) => c.name.toLowerCase().includes(targetSearchQuery.toLowerCase())).map((cat: any) => (
                        <div 
                          key={cat.id} 
                          className="px-4 py-3 hover:bg-white/5 cursor-pointer text-sm font-bold transition-colors border-b border-white/5 last:border-0 text-slate-300 hover:text-amber-400"
                          onClick={() => {
                             setNewInvestor({ ...newInvestor, targetId: cat.id });
                             setTargetSearchQuery('');
                             setShowTargetDropdown(false);
                          }}
                        >
                          {cat.name}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            {newInvestor.investmentTargetType === 'product' && (
              <div className="relative group w-full" ref={targetDropdownRef}>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Produit cible</label>
                <div className="relative" onClick={() => setShowTargetDropdown(true)}>
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-amber-400 transition-colors" size={18} />
                  <input
                    type="text"
                    value={targetSearchQuery}
                    onChange={(e) => {
                      setTargetSearchQuery(e.target.value);
                      setShowTargetDropdown(true);
                      setNewInvestor({ ...newInvestor, targetId: '' });
                    }}
                    onFocus={() => setShowTargetDropdown(true)}
                    placeholder={newInvestor.targetId ? products.find((p: any) => p.id === newInvestor.targetId)?.name || 'Sélectionner un produit' : "RECHERCHER UN PRODUIT..."}
                    className="w-full pl-12 pr-10 py-3 bg-slate-950 border border-white/5 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/50 text-sm font-bold text-white placeholder:text-slate-600 transition-all uppercase tracking-wider truncate"
                  />
                  {newInvestor.targetId && (
                     <button 
                       onClick={(e) => {
                          e.stopPropagation();
                          setNewInvestor({ ...newInvestor, targetId: '' });
                          setTargetSearchQuery('');
                       }} 
                       className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-rose-400 transition-colors"
                     >
                       <X size={16} />
                     </button>
                  )}
                </div>
                {showTargetDropdown && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                    {products.filter((p: any) => p.name.toLowerCase().includes(targetSearchQuery.toLowerCase())).length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500">Aucun produit trouvé</div>
                    ) : (
                      products.filter((p: any) => p.name.toLowerCase().includes(targetSearchQuery.toLowerCase())).map((p: any) => (
                        <div 
                          key={p.id} 
                          className="px-4 py-3 hover:bg-white/5 cursor-pointer text-sm font-bold transition-colors border-b border-white/5 last:border-0 text-slate-300 hover:text-amber-400"
                          onClick={() => {
                             setNewInvestor({ ...newInvestor, targetId: p.id });
                             setTargetSearchQuery('');
                             setShowTargetDropdown(false);
                          }}
                        >
                          {p.name}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-end lg:col-span-5 mt-2">
              <button 
                onClick={handleSaveInvestor}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black uppercase tracking-widest py-4 px-4 rounded-2xl transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)] text-xs h-14"
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentDialog && (
         <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/5 p-8 rounded-[2rem] w-full max-w-sm shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-emerald-500"></div>
               <div className="flex justify-between items-start mb-6">
                 <div>
                   <h3 className="text-xl font-black text-white">Reverser des bénéfices</h3>
                   <p className="text-slate-400 text-sm mt-1 text-amber-500">Pour: {showPaymentDialog.name}</p>
                 </div>
                 <button onClick={() => setShowPaymentDialog(null)} className="text-slate-500 hover:text-white transition-colors">
                   <X size={20} />
                 </button>
               </div>
               
               <div className="space-y-4">
                 <div>
                    <label className="block text-[10px] uppercase tracking-widest font-black text-slate-400 mb-2">Montant ({settings.currency})</label>
                    <input 
                      type="number"
                      autoFocus
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full text-2xl font-black text-white bg-slate-950 border border-white/5 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/50"
                      placeholder="0.00"
                    />
                 </div>
                 <button 
                   onClick={handleRecordPayment}
                   className="w-full bg-emerald-500 text-slate-900 font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-emerald-400 transition-all text-xs shadow-lg shadow-emerald-500/20"
                 >
                   Confirmer Versement
                 </button>
               </div>
            </div>
         </div>
      )}

      {showWithdrawDialog && (
         <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/5 p-8 rounded-[2rem] w-full max-w-sm shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-rose-500"></div>
               <div className="flex justify-between items-start mb-6">
                 <div>
                   <h3 className="text-xl font-black text-white">Retirer du Capital</h3>
                   <p className="text-slate-400 text-sm mt-1 text-rose-500">Depuis: {showWithdrawDialog.name}</p>
                 </div>
                 <button onClick={() => setShowWithdrawDialog(null)} className="text-slate-500 hover:text-white transition-colors">
                   <X size={20} />
                 </button>
               </div>
               
               <div className="space-y-4">
                 <div>
                    <label className="block text-[10px] uppercase tracking-widest font-black text-slate-400 mb-2">Montant à Retirer ({settings.currency})</label>
                    <input 
                      type="number"
                      autoFocus
                      max={showWithdrawDialog.initialInvestment}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full text-2xl font-black text-rose-500 bg-slate-950 border border-white/5 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/50"
                      placeholder={showWithdrawDialog.initialInvestment.toString()}
                    />
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-2 text-right">
                       Max: {showWithdrawDialog.initialInvestment.toLocaleString()} {settings.currency}
                    </p>
                 </div>
                 <button 
                   onClick={handleWithdrawCapital}
                   className="w-full bg-rose-500/10 text-rose-500 border border-rose-500/20 font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-rose-500/20 transition-all text-xs shadow-lg shadow-rose-500/10"
                 >
                   Confirmer Retrait
                 </button>
               </div>
            </div>
         </div>
      )}

      <div className="bg-white/5 border border-white/5 rounded-[2rem] overflow-hidden shadow-xl">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-[10px] uppercase font-black text-slate-400 tracking-widest">
            <tr>
              <th className="px-6 py-5">Investisseur</th>
              <th className="px-6 py-5">Capital ({settings.currency})</th>
              <th className="px-6 py-5">Parts (Bénéfices)</th>
              <th className="px-6 py-5">Bénéfices Reversés</th>
              <th className="px-6 py-5 border-l border-white/5 bg-indigo-500/5">Bénéfice Disponible</th>
              <th className="px-6 py-5 text-center">Ventes Cibles</th>
              <th className="px-6 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm">
            {investors.map((inv) => {
              let tartgetProfit = netProfit;
              let targetLabel = "Global";
              
              if (inv.investmentTargetType === 'product' && inv.targetId) {
                 tartgetProfit = productProfits[inv.targetId] || 0;
                 const p = products.find(prod => prod.id === inv.targetId);
                 targetLabel = `Produit: ${p?.name || 'Inconnu'}`;
              } else if (inv.investmentTargetType === 'category' && inv.targetId) {
                 tartgetProfit = categoryProfits[inv.targetId] || 0;
                 const c = categories.find((cat: any) => cat.id === inv.targetId);
                 targetLabel = `Catégorie: ${c?.name || 'Inconnue'}`;
              }

              const eligibleBenefit = (tartgetProfit * (inv.sharePercentage / 100));
              const availableBenefit = Math.max(0, eligibleBenefit - (inv.totalDividendsPaid || 0));
              
              const salesCount = getInvestorSales(inv).length;
              
              return (
              <tr key={inv.id} className="hover:bg-white/5 transition-colors group">
                <td className="px-6 py-5 font-bold text-white flex items-center gap-4 border-b-0">
                  <div className="w-10 h-10 bg-slate-800 rounded-2xl flex items-center justify-center text-amber-500 border border-white/5 shadow-inner">
                    <HandCoins size={18} />
                  </div>
                  <div>
                     <p>{inv.name}</p>
                     <p className="text-[10px] text-slate-500 mt-1 font-black uppercase tracking-widest">{targetLabel}</p>
                  </div>
                </td>
                <td className="px-6 py-5 font-mono text-lg">{inv.initialInvestment.toLocaleString()}</td>
                <td className="px-6 py-5">
                   <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-xl font-black tracking-widest text-[10px] uppercase shadow-neon-indigo">
                     {inv.sharePercentage}%
                   </span>
                </td>
                <td className="px-6 py-5 font-mono font-black text-amber-400 tracking-tighter text-lg">+{inv.totalDividendsPaid.toLocaleString()}</td>
                <td className="px-6 py-5 font-mono font-black border-l border-white/5 bg-indigo-500/5">
                   <div className="flex flex-col">
                      <span className="text-emerald-400 text-lg tracking-tighter cursor-help" title={`Part totale calculée: ${eligibleBenefit.toFixed(2)}`}>
                        {availableBenefit.toFixed(2)} {settings.currency}
                      </span>
                      {availableBenefit > 0 && <span className="text-[9px] text-white/30 uppercase tracking-widest mt-1">Solde retirable</span>}
                   </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <button 
                    onClick={() => setSelectedInvestorSales(inv)}
                    className="inline-flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105 shadow-neon-indigo/10"
                    title="Voir les ventes effectuées"
                  >
                    <ShoppingBag size={14} className="text-indigo-400" />
                    <span>{salesCount} {salesCount > 1 ? 'ventes' : 'vente'}</span>
                  </button>
                </td>
                <td className="px-6 py-5 text-right space-x-2">
                  <button 
                    onClick={() => {
                        setShowPaymentDialog(inv);
                        setPaymentAmount(parseFloat(availableBenefit.toFixed(2)) || '');
                    }}
                    disabled={availableBenefit <= 0}
                    className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 px-4 py-2 rounded-xl font-black uppercase tracking-widest transition-all shadow-neon-amber disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:group-hover:opacity-30"
                  >
                    Verser
                  </button>
                  <button 
                    onClick={() => {
                        setShowWithdrawDialog(inv);
                        setWithdrawAmount('');
                    }}
                    disabled={inv.initialInvestment <= 0}
                    className="text-[10px] bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 px-4 py-2 rounded-xl font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(244,63,94,0.1)] disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:group-hover:opacity-30"
                  >
                    Retrait
                  </button>
                  <button 
                    onClick={() => {
                      setEditingInvestor(inv);
                      setNewInvestor(inv);
                      setIsAddingInvestor(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-10 h-10 inline-flex items-center justify-center bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                    title="Modifier"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={async () => {
                      if (confirm(`Êtes-vous sûr de vouloir supprimer l'investisseur "${inv.name}" ?`)) {
                        const { error } = await supabase.from('microInvestors').delete().eq('id', inv.id);
                        if (error) alert("Erreur suppression: " + error.message);
                        else setInvestors(prev => prev.filter(i => i.id !== inv.id));
                      }
                    }}
                    className="w-10 h-10 inline-flex items-center justify-center bg-white/5 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-xl transition-all"
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
              );
            })}
            {investors.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-bold">
                  <div className="flex flex-col items-center gap-4">
                     <div className="w-16 h-16 bg-white/5 text-slate-400 rounded-3xl flex items-center justify-center">
                        <HandCoins size={24} />
                     </div>
                     <p>Aucun investisseur enregistré pour le moment.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Journal de Bourse (Dividendes & Versements) */}
      <div className="bg-white/5 border border-white/5 rounded-[2rem] p-6 lg:p-8 shadow-xl mt-8">
         <div className="flex items-center justify-between mb-6">
            <div>
               <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                  <Activity className="text-amber-400" size={20} />
                  Journal des Dividendes & Opérations de Bourse
               </h3>
               <p className="text-slate-400 text-xs mt-1">Historique complet des reversements et dividendes versés aux micro-investisseurs</p>
            </div>
         </div>
         
         <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full text-left">
               <thead className="bg-[#0f111a] text-[9px] uppercase font-black text-slate-400 tracking-widest">
                  <tr>
                     <th className="px-6 py-4">Date & Heure</th>
                     <th className="px-6 py-4">Investisseur</th>
                     <th className="px-6 py-4">Cible</th>
                     <th className="px-6 py-4 font-mono">Description</th>
                     <th className="px-6 py-4 text-right">Montant ({settings.currency})</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                  {sortedDividendJournal.map((op, idx) => (
                     <tr key={op.id || idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-mono text-slate-500">
                           {new Date(op.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 font-bold text-white">
                           {op.investorName}
                        </td>
                        <td className="px-6 py-4">
                           <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                              {op.investorTarget}
                           </span>
                        </td>
                        <td className="px-6 py-4 font-normal text-slate-400 italic">
                           {op.notes}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-black text-amber-500 text-sm">
                           -{op.amount.toFixed(2)}
                        </td>
                     </tr>
                  ))}
                  {sortedDividendJournal.length === 0 && (
                     <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 uppercase tracking-widest font-black text-[10px]">
                           Aucune transaction enregistrée dans le journal de bourse.
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {selectedInvestorSales && (() => {
         const salesData = getInvestorSalesDetails(selectedInvestorSales);
         return (
         <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/5 p-8 rounded-[2rem] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-amber-500"></div>
               
               <div className="flex justify-between items-start mb-6 shrink-0">
                  <div>
                    <h3 className="text-2xl font-black text-white flex items-center gap-3">
                      <ShoppingBag className="text-indigo-400" size={24} />
                      Historique des Ventes Effectuées
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">
                      Ventes correspondantes aux parts de l'investisseur <span className="text-amber-400 font-bold">{selectedInvestorSales.name}</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedInvestorSales(null)} 
                    className="w-10 h-10 bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 rounded-2xl flex items-center justify-center text-slate-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
               </div>

               {/* Stats Overview */}
               <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 shrink-0">
                 <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Ventes</p>
                   <p className="text-xl font-black text-white">{salesData.details.length} transactions</p>
                 </div>
                 <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">H.T. / C.A Cible</p>
                   <p className="text-xl font-black text-emerald-400">+{salesData.totalRevenue.toFixed(2)} {settings.currency}</p>
                 </div>
                 <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Marge Cible</p>
                   <p className="text-xl font-black text-indigo-400">+{salesData.totalProfit.toFixed(2)} {settings.currency}</p>
                 </div>
                 <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl">
                   <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">Part ({selectedInvestorSales.sharePercentage}%)</p>
                   <p className="text-xl font-black text-amber-500">+{salesData.totalShare.toFixed(2)} {settings.currency}</p>
                 </div>
               </div>

               {/* Sales Table */}
               <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left">
                     <thead className="bg-[#0f111a] sticky top-0 text-[10px] uppercase font-black text-slate-400 tracking-widest z-10 border-b border-white/5">
                        <tr>
                           <th className="px-4 py-3">Date & Ticket</th>
                           <th className="px-4 py-3">Client & Caissier</th>
                           <th className="px-4 py-3">Détail des Produits</th>
                           <th className="px-4 py-3 text-right">CA Cible</th>
                           <th className="px-4 py-3 text-right">Part ({selectedInvestorSales.sharePercentage}%)</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-white/[0.03] text-xs">
                        {salesData.details.map((s, idx) => (
                           <tr key={s.id || idx} className="hover:bg-white/5 transition-colors">
                              <td className="px-4 py-4">
                                 <p className="text-slate-300 font-mono">#{s.id.slice(-6).toUpperCase()}</p>
                                 <p className="text-[10px] text-slate-500 font-medium leading-none mt-1 flex items-center gap-1">
                                   <Clock size={10} />
                                   {new Date(s.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                 </p>
                              </td>
                              <td className="px-4 py-4">
                                 <p className="text-white font-bold">{s.buyerName}</p>
                                 <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black leading-none mt-1">{s.sellerName}</p>
                              </td>
                              <td className="px-4 py-4">
                                 <div className="flex flex-col gap-1">
                                    {s.matchingItems.map((item: any, i: number) => (
                                       <span key={item.productId || i} className="text-[10px] text-slate-300">
                                          <strong className="text-indigo-400">{item.quantity}x</strong> {item.productName || item.name}
                                       </span>
                                    ))}
                                 </div>
                              </td>
                              <td className="px-4 py-4 text-right font-mono font-bold text-white">
                                 {s.matchingRevenue.toFixed(2)} {settings.currency}
                              </td>
                              <td className="px-4 py-4 text-right font-mono font-black text-emerald-400">
                                 +{s.investorShare.toFixed(2)} {settings.currency}
                              </td>
                           </tr>
                        ))}
                        {salesData.details.length === 0 && (
                           <tr>
                              <td colSpan={5} className="py-12 text-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                                 Aucune vente n'a été enregistrée pour cette cible.
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
         );
      })()}
    </div>
  );
}
