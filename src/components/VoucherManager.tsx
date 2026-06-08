import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { supabase } from '../supabase';
import { cn, generateUniqueId } from '../lib/utils';
import { motion } from 'motion/react';
import { Search, History, CheckCircle2, X, LayoutGrid, Package, MapPin, Truck, ShoppingBag, Phone, MessageCircle, Navigation, Eye, Trash2, Printer, Edit, RefreshCw, Scan, RotateCcw, ShieldCheck, TrendingDown } from 'lucide-react';

export interface VoucherLog {
  transactionId: string;
  amountUsed: number;
  remainingBalance: number;
  date: string;
  userName: string;
}

export interface Voucher {
  id: string;
  code: string;
  type: 'fixed' | 'percent';
  value: number; // Value for percent or initial value for fixed
  currentBalance: number; // For fixed amount only
  minPurchase?: number;
  expiryDate: string;
  status: 'active' | 'used' | 'expired' | 'revoked';
  customerId?: string;
  customerName?: string;
  notes?: string;
  createdAt: any;
  usageLogs?: VoucherLog[];
}

export function VoucherManager({ customers = [] }: { customers?: any[] }) {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [type, setType] = useState<'fixed' | 'percent'>('fixed');
  const [value, setValue] = useState('');
  const [minPurchase, setMinPurchase] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [notes, setNotes] = useState('');
  const [newVoucher, setNewVoucher] = useState<Voucher | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filterCode, setFilterCode] = useState('');
  const [selectedVoucherLogs, setSelectedVoucherLogs] = useState<Voucher | null>(null);

  useEffect(() => {
    const fetchVouchers = async () => {
      try {
        const { data, error } = await supabase.from('vouchers').select('*');
        if (error) throw error;
        if (data) {
          setVouchers(data as Voucher[]);
        }
      } catch (err) {
        console.warn("Supabase error in VoucherManager:", err);
      }
    };
    fetchVouchers();
  }, []);

  const handleGenerate = async () => {
    if (!value || parseFloat(value) <= 0) return alert("Valeur invalide");
    setIsGenerating(true);
    try {
      const code = 'VOUCH-' + generateUniqueId();
      const numValue = parseFloat(value);
      const customer = customers.find(c => c.id === selectedCustomer);
      
      const voucherData: any = {
        id: Math.random().toString(36).substring(2, 10),
        code,
        type,
        value: numValue,
        currentBalance: type === 'fixed' ? numValue : 0,
        minPurchase: parseFloat(minPurchase) || 0,
        expiryDate,
        status: 'active',
        notes,
        createdAt: new Date().toISOString(),
        usageLogs: []
      };

      if (selectedCustomer) {
        voucherData.customerId = selectedCustomer;
        voucherData.customerName = customer?.name || 'Inconnu';
      }

      const { error } = await supabase.from('vouchers').insert(voucherData);
      if (error) throw error;
      setNewVoucher(voucherData);
      
      // Reset form
      setValue('');
      setMinPurchase('');
      setExpiryDate('');
      setSelectedCustomer('');
      setNotes('');
    } catch (error) {
      console.error("Error generating voucher:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleVoucherStatus = async (voucher: Voucher) => {
    const newStatus = voucher.status === 'revoked' ? 'active' : 'revoked';
    if (!confirm(`Voulez-vous ${newStatus === 'revoked' ? 'désactiver' : 'réactiver'} ce bon ?`)) return;
    
    try {
      const { error } = await supabase
        .from('vouchers')
        .update({ status: newStatus })
        .eq('id', voucher.id);
      
      if (error) throw error;
      setVouchers(prev => prev.map(v => v.id === voucher.id ? {...v, status: newStatus} : v));
    } catch (error) {
      console.error("Error updating voucher status:", error);
    }
  };

  const filteredVouchers = vouchers.filter(v => 
    v.code.toLowerCase().includes(filterCode.toLowerCase()) ||
    (v.customerName || '').toLowerCase().includes(filterCode.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white/5 p-6 rounded-2xl border border-white/10 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight uppercase tracking-wider">Cartes Cadeaux &amp; Bons de Réduction</h3>
            <p className="text-xs text-white/40 font-medium">Générez et suivez les bons de réduction pour vos clients</p>
          </div>
          <div className="flex gap-2">
             <div className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">
               {vouchers.filter(v => v.status === 'active').length} Actifs
             </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4 bg-white/5 p-4 rounded-xl border border-dashed border-white/10">
            <h4 className="text-xs font-black text-white/20 uppercase tracking-widest">Nouveau Bon</h4>
            
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setType('fixed')}
                className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all", 
                  type === 'fixed' ? "bg-white text-indigo-600 shadow-xl" : "text-white/40")}
              >Montant Fixe</button>
              <button 
                onClick={() => setType('percent')}
                className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all", 
                  type === 'percent' ? "bg-white text-indigo-600 shadow-xl" : "text-white/40")}
              >Pourcentage %</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-white/20 uppercase mb-1 block">Valeur ({type === 'percent' ? '%' : 'Montant'})</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={value} 
                    onChange={(e) => setValue(e.target.value)} 
                    placeholder="25.00" 
                    className="w-full px-4 py-2 rounded-xl border border-white/10 bg-[#0a0a0f] text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold" 
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 font-bold">
                    {type === 'percent' ? '%' : 'FCFA'}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-white/20 uppercase mb-1 block">Date d'expiration</label>
                <input 
                  type="date" 
                  value={expiryDate} 
                  onChange={(e) => setExpiryDate(e.target.value)} 
                  className="w-full px-4 py-2 rounded-xl border border-white/10 bg-[#0a0a0f] text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold" 
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-white/20 uppercase mb-1 block">Achat Minimum (Optionnel)</label>
                <input 
                  type="number" 
                  value={minPurchase} 
                  onChange={(e) => setMinPurchase(e.target.value)} 
                  placeholder="0.00" 
                  className="w-full px-4 py-2 rounded-xl border border-white/10 bg-[#0a0a0f] text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold" 
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-white/20 uppercase mb-1 block">Assigner au Client (Optionnel)</label>
                <select 
                  value={selectedCustomer} 
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-white/10 bg-[#0a0a0f] text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                >
                  <option value="">Public / Tout client</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={handleGenerate} 
                className="w-full py-3 bg-amber-500 text-black rounded-xl font-black uppercase text-xs tracking-widest hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20"
                disabled={isGenerating}
              >
                Générer Bon
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-black text-white/20 uppercase tracking-widest">Liste des Bons</h4>
              <div className="relative w-48">
                <input 
                  type="text" 
                  placeholder="Rechercher code..." 
                  className="w-full pl-8 pr-4 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-bold outline-none"
                  value={filterCode}
                  onChange={(e) => setFilterCode(e.target.value)}
                />
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="p-3 text-[10px] font-black text-white/20 uppercase tracking-widest">Code & Type</th>
                    <th className="p-3 text-[10px] font-black text-white/20 uppercase tracking-widest">Valeur / Solde</th>
                    <th className="p-3 text-[10px] font-black text-white/20 uppercase tracking-widest">Client / Exp.</th>
                    <th className="p-3 text-[10px] font-black text-white/20 uppercase tracking-widest text-center">Statut</th>
                    <th className="p-3 text-[10px] font-black text-white/20 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredVouchers.map(v => {
                    const isExpired = v.expiryDate && new Date(v.expiryDate) < new Date();
                    return (
                      <tr key={v.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3">
                          <div className="space-y-1">
                            <p className="text-sm font-black text-white font-mono tracking-tighter uppercase">{v.code}</p>
                            <span className={cn(
                              "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest",
                              v.type === 'percent' ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"
                            )}>
                              {v.type === 'percent' ? 'Pourcentage' : 'Fixe'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-0.5">
                            <p className="text-sm font-black text-white font-mono">
                              {v.type === 'percent' ? `${v.value}%` : `${v.value.toFixed(2)} FCFA`}
                            </p>
                            {v.type === 'fixed' && v.currentBalance !== undefined && v.currentBalance < v.value && (
                              <p className="text-[10px] text-emerald-400 font-bold">Reste: {v.currentBalance.toFixed(2)}</p>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-white truncate max-w-[120px] uppercase tracking-tight">{v.customerName || 'Tout public'}</p>
                            <p className={cn("text-[9px] font-bold", isExpired ? "text-rose-400" : "text-white/20")}>
                              Exp: {v.expiryDate || 'Jamais'}
                            </p>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                            v.status === 'active' && !isExpired ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/20" :
                            v.status === 'used' ? "bg-white/10 text-white/40 border-white/5" :
                            v.status === 'revoked' ? "bg-rose-500 text-white border-rose-600" :
                            "bg-rose-500/20 text-rose-400 border-rose-500/20"
                          )}>
                            {isExpired && v.status === 'active' ? 'Expiré' : v.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button 
                              onClick={() => setSelectedVoucherLogs(v)}
                              className="p-1.5 text-white/20 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-all"
                              title="Historique d'utilisation"
                            >
                              <History size={14} />
                            </button>
                            <button 
                              onClick={() => toggleVoucherStatus(v)}
                              className="p-1.5 text-white/20 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-all"
                              title={v.status === 'revoked' ? 'Réactiver' : 'Désactiver'}
                            >
                              {v.status === 'revoked' ? <CheckCircle2 size={14} /> : <X size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {newVoucher && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-2xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-top duration-500 border border-slate-700">
           <div className="w-24 h-24 bg-white p-2 rounded-xl flex-shrink-0 flex items-center justify-center">
             <QRCodeCanvas value={newVoucher.code} size={80} />
           </div>
           <div className="flex-1">
             <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Bon généré avec succès</p>
             <h4 className="text-2xl font-black text-white tracking-tighter mb-2">{newVoucher.code}</h4>
             <div className="flex gap-4">
               <div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Valeur</p>
                  <p className="text-sm font-bold text-amber-500">{newVoucher.type === 'percent' ? `${newVoucher.value}%` : `${newVoucher.value} FCFA`}</p>
               </div>
               <div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Expiration</p>
                  <p className="text-sm font-bold text-white">{newVoucher.expiryDate || 'Accès illimité'}</p>
               </div>
             </div>
           </div>
           <button onClick={() => setNewVoucher(null)} className="p-2 text-slate-500 hover:text-white transition-colors">
             <X size={20} />
           </button>
        </div>
      )}

      {selectedVoucherLogs && (
        <VoucherLogsDialog 
          voucher={selectedVoucherLogs} 
          onClose={() => setSelectedVoucherLogs(null)} 
        />
      )}
    </div>
  );
}

function VoucherLogsDialog({ voucher, onClose }: { voucher: Voucher, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#1a1a24] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-white/10"
      >
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Historique du Bon</p>
              <h4 className="text-lg font-black text-white tracking-tight uppercase">{voucher.code}</h4>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/20"><X size={20}/></button>
          </div>

          <div className="space-y-3">
            {(!voucher.usageLogs || voucher.usageLogs.length === 0) ? (
              <div className="p-8 text-center text-white/20 italic text-sm uppercase tracking-widest font-black">
                Aucune utilisation enregistrée
              </div>
            ) : (
              voucher.usageLogs.map((log, idx) => (
                <div key={`voucher-log-${idx}`} className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white uppercase tracking-tight">Caisse: {log.userName}</p>
                    <p className="text-[10px] text-white/20 font-bold uppercase">{log.date}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-sm font-black text-amber-500 font-mono">-{log.amountUsed.toFixed(2)} FCFA</p>
                    <p className="text-[8px] font-bold text-white/20 uppercase">Solde: {log.remainingBalance.toFixed(2)}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <button onClick={onClose} className="w-full py-3 bg-white/5 text-white/40 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:bg-white/10">
            Fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Add necessary icons to imports if needed
