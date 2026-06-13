import React, { useState, memo } from 'react';
import { Plus, Search, Package, X } from 'lucide-react';
import { InventoryAudit as InventoryAuditType, Product, CompanySettings } from '../types';
import { supabase } from '../supabase';
import { convertKeysToSnake } from '../database';
import { formatSafe, cn } from '../lib/utils';
import { Button, Card, Modal, ConfirmDialog } from './ui';

interface InventoryAuditProps {
  audits: InventoryAuditType[];
  products: Product[];
  user: any;
  settings: CompanySettings;
}

export const InventoryAudit = memo(function InventoryAudit({ audits, products, user, settings }: InventoryAuditProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeAudit, setActiveAudit] = useState<InventoryAuditType | null>(null);
  const [auditItems, setAuditItems] = useState<any[]>([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const startNewAudit = async () => {
    const newAudit = {
      id: Math.random().toString(36).substring(2, 10),
      startDate: new Date().toISOString(),
      status: 'in_progress',
      auditorId: user.uid,
      items: []
    };
    try {
      const { error } = await supabase.from('audits').insert(convertKeysToSnake(newAudit));
      if (error) throw error;
      setActiveAudit(newAudit as InventoryAuditType);
      setAuditItems([]);
      setIsModalOpen(true);
    } catch (error: any) {
      console.error("Error creating audit:", error);
      alert("Erreur: " + error.message);
    }
  };

  const addProductToAudit = (product: Product) => {
    if (auditItems.find(item => item.productId === product.id)) return;
    setAuditItems([...auditItems, {
      productId: product.id,
      productName: product.name,
      expectedStock: product.stock,
      actualStock: product.stock,
      discrepancy: 0,
      notes: ''
    }]);
  };

  const updateActualStock = (productId: string, actual: number) => {
    setAuditItems(auditItems.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          actualStock: actual,
          discrepancy: actual - item.expectedStock
        };
      }
      return item;
    }));
  };

  const completeAudit = async () => {
    if (!activeAudit) return;
    setIsConfirmModalOpen(true);
  };

  const handleConfirmAudit = async () => {
    if (!activeAudit) return;
    try {
      const totalDiscrepancyValue = auditItems.reduce((sum, item) => {
        const product = products.find(p => p.id === item.productId);
        return sum + (item.discrepancy * (product?.costPrice || 0));
      }, 0);

      const { error: auditError } = await supabase
        .from('audits')
        .update(convertKeysToSnake({
          status: 'completed',
          endDate: new Date().toISOString(),
          items: auditItems,
          totalDiscrepancyValue
        }))
        .eq('id', activeAudit.id);
      if (auditError) throw auditError;

      // Update product stocks & record stock adjustment
      for (const item of auditItems) {
        if (item.discrepancy !== 0 && item.productId) {
          const { error: prodError } = await supabase
            .from('products')
            .update({
              stock: item.actualStock,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.productId);
          if (prodError) throw prodError;

          const { error: adjError } = await supabase.from('stock_adjustments').insert(convertKeysToSnake({
            id: Math.random().toString(36).substring(2, 10),
            productId: item.productId,
            productName: item.productName,
            oldQuantity: item.expectedStock,
            newQuantity: item.actualStock,
            adjustment: item.discrepancy,
            reason: "Audit d'inventaire",
            timestamp: new Date().toISOString(),
            userId: user.uid
          }));
          if (adjError) throw adjError;
        }
      }

      setIsModalOpen(false);
      setActiveAudit(null);
      setIsConfirmModalOpen(false);
    } catch (error: any) {
      console.error("Error confirming audit:", error);
      alert("Erreur lors de la validation: " + error.message);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.tags || []).some(tag => tag.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-10 max-w-6xl mx-auto py-8 px-4 font-sans">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-neon-indigo">
               <Package size={20} className="text-white" />
            </div>
            <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Gestion <span className="text-indigo-400">Stocks</span></h3>
          </div>
          <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Vérification de l'inventaire physique & Réconciliation</p>
        </div>
        <Button onClick={startNewAudit} className="h-14 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[11px] tracking-widest shadow-neon-indigo active:translate-y-1 transition-all">
          <Plus size={20} /> Lancer un audit
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {audits.length === 0 ? (
          <div className="col-span-full py-20 bg-workspace/50 border border-dashed border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-600">
             <Package size={48} className="mb-4 opacity-20" />
             <p className="text-sm font-black uppercase tracking-widest">Aucun historique d'audit</p>
          </div>
        ) : audits.map((audit) => (
          <Card key={audit.id} className="p-8 bg-workspace/80 border-white/5 backdrop-blur-xl relative overflow-hidden group hover:border-indigo-500/30 transition-all">
            <div className="absolute top-0 right-0 p-4">
               <span className={cn(
                 "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                 audit.status === 'completed' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse"
               )}>
                 {audit.status === 'completed' ? 'Clos' : 'Ouvert'}
               </span>
            </div>

            <div className="mb-8">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Audit du</h4>
              <p className="text-lg font-black text-white italic">{formatSafe(audit.startDate, 'dd MMMM yyyy HH:mm')}</p>
            </div>
            
            <div className="flex justify-between items-end">
              {audit.status === 'completed' && audit.totalDiscrepancyValue !== undefined ? (
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Impact Financier</p>
                  <p className={cn("text-2xl font-black tracking-tighter", audit.totalDiscrepancyValue < 0 ? "text-rose-500" : "text-emerald-500")}>
                    {audit.totalDiscrepancyValue.toFixed(2)} {settings.currency}
                  </p>
                </div>
              ) : (
                <div className="w-full">
                  <Button 
                    variant="secondary" 
                    className="w-full bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                    onClick={() => { setActiveAudit(audit); setAuditItems(audit.items || []); setIsModalOpen(true); }}
                  >
                    Reprendre l'audit
                  </Button>
                </div>
              )}
            </div>

            {audit.status === 'completed' && (
              <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-500">{audit.items.length} Refs</span>
                <span className={cn(
                  audit.items.filter(i => i.discrepancy !== 0).length > 0 ? "text-rose-400" : "text-emerald-400"
                )}>
                  {audit.items.filter(i => i.discrepancy !== 0).length} Écarts
                </span>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Audit Opérationnel" maxWidth="max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[75vh]">
          <div className="lg:col-span-5 flex flex-col gap-6 overflow-hidden">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
              <input 
                type="text"
                placeholder="Scanner Code-Barre ou Recherche..."
                className="w-full pl-12 pr-4 h-14 bg-black/40 border border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {filteredProducts.map(p => (
                <button 
                  key={p.id}
                  onClick={() => addProductToAudit(p)}
                  className="w-full p-4 flex items-center justify-between bg-workspace/50 border border-white/5 rounded-2xl hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black/40 rounded-xl flex items-center justify-center text-slate-500 group-hover:text-indigo-400 transition-colors">
                       <Package size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white uppercase tracking-tight">{p.name}</p>
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{p.sku} • Stock: <span className="text-slate-400 font-mono italic">{p.stock}</span></p>
                    </div>
                  </div>
                  <div className="w-8 h-8 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <Plus size={16} className="text-indigo-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1 border-r border-white/5 hidden lg:block" />

          <div className="lg:col-span-6 flex flex-col gap-6 overflow-hidden">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.25em] flex items-center gap-2">
                <Package size={16} className="text-indigo-400" /> Liste de pointage ({auditItems.length})
              </h4>
              <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full uppercase italic">Vérification Manuelle</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {auditItems.map(item => (
                <div key={item.productId} className="p-6 bg-black/20 rounded-3xl border border-white/5 space-y-6 relative group overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 translate-x-10 group-hover:translate-x-0 transition-transform">
                    <button 
                      onClick={() => setAuditItems(auditItems.filter(i => i.productId !== item.productId))} 
                      className="w-8 h-8 bg-rose-500/10 text-rose-500 rounded-lg flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg shadow-rose-500/10"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <p className="text-base font-black text-white uppercase tracking-tight">{item.productName}</p>
                  
                  <div className="grid grid-cols-3 gap-6">
                    <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 italic">Système</p>
                      <p className="text-lg font-black text-slate-400 font-mono">{item.expectedStock}</p>
                    </div>
                    <div className="bg-indigo-500/5 p-3 rounded-2xl border border-indigo-500/20">
                      <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1 italic">Réel</p>
                      <input 
                        type="number"
                        className="w-full bg-transparent text-lg font-black text-white font-mono outline-none focus:text-indigo-400 transition-colors"
                        value={item.actualStock}
                        onChange={(e) => updateActualStock(item.productId, parseFloat(e.target.value) || 0)}
                        autoFocus
                      />
                    </div>
                    <div className={cn(
                      "p-3 rounded-2xl border flex flex-col justify-center",
                      item.discrepancy < 0 ? "bg-rose-500/5 border-rose-500/20" : item.discrepancy > 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-black/20 border-white/5"
                    )}>
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 italic">Écart</p>
                      <p className={cn("text-lg font-black font-mono", item.discrepancy < 0 ? "text-rose-500" : item.discrepancy > 0 ? "text-emerald-500" : "text-slate-500")}>
                        {item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {auditItems.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-700">
                  <div className="w-20 h-20 bg-workspace border border-dashed border-white/5 rounded-full flex items-center justify-center mb-6">
                     <Package size={32} className="opacity-20" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em]">Sélectionnez des articles à gauche</p>
                </div>
              )}
            </div>
            <div className="pt-6 border-t border-white/5">
              <Button 
                onClick={completeAudit} 
                className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-[0.2em] shadow-neon-indigo shadow-lg active:scale-[0.98] transition-all disabled:opacity-20 disabled:grayscale" 
                disabled={auditItems.length === 0}
              >
                Valider et synchroniser l'inventaire
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog 
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmAudit}
        title="Clôture de l'audit"
        message="Cette action va définitivement écraser les stocks actuels par les quantités comptées. Cette opération est irréversible dans le journal d'ajustement."
        confirmText="Confirmer & Appliquer"
        variant="danger"
      />
    </div>
  );
});
