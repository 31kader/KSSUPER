import React, { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { supabase } from '../supabase';
import { Product, CompanySettings } from '../types';
import { Button, Modal } from './ui';
import { toast } from 'sonner';
import { sanitizeProductForSupabase } from '../lib/utils';

export function StockAdjustmentModal({ 
  isOpen, onClose, product, user, settings 
}: { 
  isOpen: boolean, onClose: () => void, product: Product | null, user: any, settings: CompanySettings 
}) {
  const [newStock, setNewStock] = useState<number | ''>('');
  const [localBatches, setLocalBatches] = useState<any[]>([]);
  const [reason, setReason] = useState('Ajustement manuel');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoss, setIsLoss] = useState(false);

  const isLossCheckboxVisible = product && newStock !== '' && (newStock as number) < (product.stock || 0);

  useEffect(() => {
    if (product) {
      setNewStock(product.stock || 0);
      setLocalBatches(product.batches ? product.batches.map(b => ({ ...b })) : []);
    }
  }, [product]);

  const handleLocalBatchStockChange = (index: number, value: string) => {
    const val = value === '' ? 0 : parseFloat(value);
    const updated = localBatches.map((b, i) => i === index ? { ...b, stock: isNaN(val) ? 0 : val } : b);
    setLocalBatches(updated);
    
    // Sum them up
    const total = updated.reduce((sum, item) => sum + item.stock, 0);
    setNewStock(total);
  };

  useEffect(() => {
    if (!isLossCheckboxVisible) {
      setIsLoss(false);
    }
  }, [isLossCheckboxVisible]);

  if (!product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newStock === '' || newStock === (product.stock || 0)) return;
    if (!product.id || product.id === 'undefined') {
      toast.error("Impossible de modifier le stock : ID du produit manquant.");
      return;
    }

    setIsProcessing(true);
    try {
      const currentStock = product.stock || 0;
      const delta = (newStock as number) - currentStock;
      const isLossRecord = delta < 0 && isLoss;
      
      let earliestDate = product.expirationDate;
      let primaryBatch = product.batchNumber;
      if (product.useMultiExpiry && localBatches.length > 0) {
        const sorted = [...localBatches].sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
        earliestDate = sorted[0].expirationDate;
        primaryBatch = sorted[0].batchNumber;
      }

      // Update product stocks
      const updatedProduct = {
        ...product,
        stock: newStock,
        batches: product.useMultiExpiry ? localBatches : (product.batches || null),
        expirationDate: earliestDate,
        batchNumber: primaryBatch,
        damagedStock: isLossRecord ? (product.damagedStock || 0) + Math.abs(delta) : (product.damagedStock || 0),
        updatedAt: new Date().toISOString()
      };

      // Optimistic cache update for immediate local reflection
      window.dispatchEvent(new CustomEvent('product-cache-update', { detail: updatedProduct }));

      // Cleaned update for Supabase schema safety
      const { error: prodError } = await supabase
        .from('products')
        .update(sanitizeProductForSupabase(updatedProduct))
        .eq('id', product.id);
      if (prodError) throw prodError;

      const adjustmentData = {
        id: Math.random().toString(36).substring(2, 10),
        productId: product.id,
        productName: product.name,
        oldQuantity: currentStock,
        newQuantity: newStock,
        adjustment: delta, // To match StockAdjustment interface
        quantity: delta, // Legacy compatibility
        type: delta > 0 ? 'found' : 'damage',
        reason: reason,
        userId: user.uid,
        userName: user.displayName || 'Inconnu',
        date: new Date().toISOString(), // Legacy compatibility
        timestamp: new Date().toISOString(), // To match StockAdjustment interface
        isLoss: isLossRecord
      };
      
      const { error: adjError } = await supabase.from('stockAdjustments').insert(adjustmentData);
      if (adjError) throw adjError;

      if (isLossRecord) {
        const { error: damError } = await supabase.from('damaged_items').insert({
          id: Math.random().toString(36).substring(2, 10),
          productId: product.id,
          productName: product.name,
          quantity: Math.abs(delta),
          reason: reason || "Perte/casse via ajustement",
          date: new Date().toISOString(),
          userId: user.uid,
          userName: user.displayName || 'Inconnu',
          claimStatus: 'to_claim',
          costPrice: product.costPrice || 0
        });
        if (damError) throw damError;
      }

      onClose();
    } catch (error: any) {
      console.error("Error adjusting stock:", error);
      toast.error("Erreur lors de l'ajustement: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajustement Rapide" className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-6 pt-4">
        <div className="bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-black/40 rounded-2xl shadow-inner flex items-center justify-center border border-white/10">
              <Package className="text-white/20" size={28} />
            </div>
            <div>
              <h4 className="font-black text-white uppercase tracking-widest leading-tight">{product.name}</h4>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-1">Actuel: <span className="text-indigo-400">{product.stock || 0} {product.unit || 'unité'}</span></p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] pl-2">
              Inventaire Réel (Nouveau Stock) {product.useMultiExpiry && <span className="text-indigo-400 lowercase italic">(somme des lots)</span>}
            </label>
            <div className="relative group">
              <input 
                required
                type="number"
                step="0.01"
                value={newStock}
                disabled={product.useMultiExpiry}
                onChange={e => setNewStock(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0.00"
                className={`w-full p-6 bg-white/5 border border-white/10 rounded-3xl text-4xl font-black text-white focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-center shadow-inner group-hover:border-white/20 ${product.useMultiExpiry ? 'opacity-65 cursor-not-allowed bg-white/[0.02]' : ''}`}
              />
              <div className="absolute inset-y-0 right-6 flex items-center text-white/10 font-black text-xl pointer-events-none group-focus-within:text-indigo-500/30 transition-colors">{product.unit || 'U'}</div>
            </div>
          </div>

          {product.useMultiExpiry && localBatches && localBatches.length > 0 && (
            <div className="space-y-3 bg-white/[0.02] border border-white/5 p-4 rounded-3xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                  Stocks par date de péremption
                </span>
              </div>
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {localBatches.map((batch, index) => (
                  <div key={batch.id || index} className="flex items-center justify-between gap-3 bg-black/40 p-3 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex-1">
                      <span className="font-mono text-xs font-bold text-indigo-300 block">{batch.batchNumber}</span>
                      <span className="text-[9px] text-white/40 font-bold block">
                        DLC: {new Date(batch.expirationDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="w-24">
                      <input 
                        type="number"
                        step="0.01"
                        value={batch.stock}
                        onChange={e => handleLocalBatchStockChange(index, e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-1.5 px-2 text-center text-xs font-mono font-bold text-emerald-400 outline-none focus:border-indigo-500/50"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] pl-2">Motif de l'ajustement</label>
            <textarea 
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ex: Inventaire périodique, Casse, Erreur..."
              className="w-full p-5 bg-white/5 border border-white/10 rounded-3xl text-sm text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner placeholder:text-white/10"
            />
          </div>

          {isLossCheckboxVisible && (
            <div className="bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 p-5 rounded-3xl transition-all flex items-start gap-4 mx-1">
              <input 
                id="check-loss"
                type="checkbox"
                checked={isLoss}
                onChange={e => setIsLoss(e.target.checked)}
                className="w-5 h-5 rounded border-white/10 bg-white/5 text-rose-500 focus:ring-rose-500/20 focus:ring-2 mt-0.5 cursor-pointer accent-rose-500"
              />
              <label htmlFor="check-loss" className="flex-1 cursor-pointer select-none">
                <p className="text-xs font-black text-rose-400 uppercase tracking-wider">Considérer comme Perte ou Casse</p>
                <p className="text-[10px] text-slate-400 mt-1">Cochez cette case pour enregistrer cette diminution de stock dans le rapport des pertes et déduire sa valeur d'achat des bénéfices de l'entreprise.</p>
              </label>
            </div>
          )}
        </div>

        <div className="pt-4">
          <Button type="submit" disabled={isProcessing} className="w-full py-6 rounded-3xl text-xs font-black uppercase tracking-[0.3em] industrial-button-primary shadow-2xl shadow-indigo-500/20 active:scale-[0.98]">
            {isProcessing ? "Traitement..." : "Valider l'ajustement"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
