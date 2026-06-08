import React, { useState, useEffect } from 'react';
import { Button } from './ui';
import { Product, CompanySettings } from '../types';
import { supabase } from '../supabase';
import { 
  RefreshCw, CheckCircle2, X, TrendingUp, TrendingDown, 
  Sparkles, DollarSign, ArrowRight, ShieldCheck, Scale, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface UpdatePricesViewProps {
  items: any[];
  onComplete: () => void;
  settings: CompanySettings;
  products: Product[];
}

export function UpdatePricesView({ items, onComplete, settings, products }: UpdatePricesViewProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  
  // Setup form states
  const [updates, setUpdates] = useState<Record<string, { price: number; active: boolean }>>(() => {
    const initial: Record<string, { price: number; active: boolean }> = {};
    items.forEach(item => {
      if (item.productId) {
        const prod = products.find(p => p.id === item.productId);
        if (prod) {
          // Suggest target price based on cost + absolute margin logic
          const currentMargin = prod.price - (prod.costPrice || 0);
          const newPrice = item.costPrice + (currentMargin > 0 ? currentMargin : item.costPrice * 0.3);
          initial[item.productId] = { price: parseFloat(newPrice.toFixed(2)), active: true };
        }
      }
    });
    return initial;
  });

  const activeCount = Object.values(updates).filter(u => u.active).length;

  // Handle Escape and Enter shortcut events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      } else if (e.key === 'Enter') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'BUTTON' || activeTag === 'TEXTAREA') {
          return;
        }
        if (!isProcessing && activeCount > 0) {
          e.preventDefault();
          e.stopPropagation();
          handleUpdate();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isProcessing, activeCount, updates]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      onComplete();
    }, 200);
  };

  const handleUpdate = async () => {
    setIsProcessing(true);
    try {
      for (const productId of Object.keys(updates)) {
        if (updates[productId].active) {
          if (!productId || productId === 'undefined') continue;
          await supabase.from('products').update({ price: updates[productId].price }).eq('id', productId);
        }
      }
      handleClose();
    } catch (error) {
      console.error("Error updating prices:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[6px]"
          />

          {/* Right side drawer sliding panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0.95 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="relative w-full max-w-2xl h-full bg-industrial-950 border-l border-industrial-800 flex flex-col shadow-2xl z-10 overflow-hidden"
          >
            {/* Top Header */}
            <div className="p-6 border-b border-industrial-800/80 bg-industrial-900/60 backdrop-blur-md flex items-start justify-between">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg flex items-center gap-1">
                    <Sparkles size={10} className="animate-pulse" /> IA Recommandation
                  </span>
                  <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg flex items-center gap-1">
                    <Scale size={10} /> Marges Détectées
                  </span>
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <RefreshCw size={20} className="text-indigo-400 animate-spin-slow" />
                  Mise à jour des prix de vente
                </h3>
                <p className="text-xs text-slate-400 uppercase tracking-widest leading-relaxed">
                  Le coût de vos articles a changé. Ajustez vos prix de vente pour préserver la rentabilité de votre commerce.
                </p>
              </div>
              <button 
                onClick={handleClose}
                className="p-2 text-slate-400 hover:text-white bg-industrial-800 hover:bg-industrial-700 active:scale-95 rounded-xl border border-industrial-700 transition-all ml-4 shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable list of products */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {items.filter(i => i.productId).map(item => {
                const product = products.find(p => p.id === item.productId);
                if (!product) return null;

                const currentCost = product.costPrice || 0;
                const newCost = item.costPrice || 0;
                const currentPrice = product.price || 0;
                
                // Old absolute margin
                const oldMargin = currentPrice - currentCost;
                const oldMarginPercent = currentPrice > 0 ? (oldMargin / currentPrice) * 100 : 0;

                // Profit drop alert if cost is higher and price remains identical
                const isCostIncreased = newCost > currentCost;
                const profitDropPercent = currentPrice > 0 ? ((newCost - currentCost) / currentPrice) * 100 : 0;

                // New Margin projection
                const selectedPrice = updates[item.productId]?.price || 0;
                const newMargin = selectedPrice - newCost;
                const newMarginPercent = selectedPrice > 0 ? (newMargin / selectedPrice) * 100 : 0;
                
                const isItemActive = updates[item.productId]?.active || false;

                return (
                  <div 
                    key={item.productId} 
                    className={cn(
                      "group p-5 bg-industrial-900/40 rounded-2xl border transition-all duration-300 shadow-sm space-y-4 flex flex-col",
                      isItemActive 
                        ? "border-industrial-700 hover:border-indigo-500/30 bg-industrial-900/65" 
                        : "border-industrial-900 bg-industrial-950/40 opacity-50"
                    )}
                  >
                    {/* Title + Checkbox header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-black text-white text-base tracking-tight uppercase group-hover:text-indigo-300 transition-colors">
                          {product.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 font-mono">
                          <span className="flex items-center gap-1">
                            Ancien Coût: <strong className="text-slate-300">{currentCost.toFixed(2)}</strong>
                          </span>
                          <ArrowRight size={10} className="text-industrial-600" />
                          <span className="flex items-center gap-1 bg-industrial-950 px-2 py-0.5 rounded border border-industrial-800">
                            Nouveau Coût: <strong className="text-indigo-400 font-bold">{newCost.toFixed(2)}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Precision styled toggle checkbox */}
                      <button 
                        type="button"
                        onClick={() => setUpdates(prev => ({
                          ...prev,
                          [item.productId]: { ...prev[item.productId], active: !isItemActive }
                        }))}
                        className={cn(
                          "w-11 h-6 rounded-full relative transition-all duration-200 shadow-inner shrink-0",
                          isItemActive ? "bg-indigo-600" : "bg-industrial-800"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md flex items-center justify-center text-[8px] font-bold text-indigo-600",
                          isItemActive ? "left-6" : "left-1"
                        )} />
                      </button>
                    </div>

                    {/* Margin analysis visual matrix */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {/* Old & Current Margin State */}
                      <div className="p-3 bg-industrial-950 border border-industrial-900 rounded-xl space-y-1.5 font-mono text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Marge Précédente :</span>
                          <span className="text-slate-300 font-semibold">{oldMargin.toFixed(2)} {settings.currency}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400 text-[11px]">
                          <span>Taux de marque :</span>
                          <span className="text-slate-400 font-bold">{oldMarginPercent.toFixed(1)}%</span>
                        </div>
                        {isCostIncreased && (
                          <div className="pt-1.5 border-t border-industrial-900/80 flex justify-between items-center text-rose-400 text-[10px] font-bold">
                            <span className="flex items-center gap-1">
                              <AlertTriangle size={12} /> Baisse de Marge
                            </span>
                            <span>-{profitDropPercent.toFixed(1)}%</span>
                          </div>
                        )}
                      </div>

                      {/* Future Projected Margin State */}
                      <div className={cn(
                        "p-3 border rounded-xl space-y-1.5 font-mono text-xs transition-colors",
                        isItemActive ? "bg-indigo-950/20 border-indigo-500/10" : "bg-industrial-950 border-industrial-900"
                      )}>
                        <div className="flex justify-between text-slate-400">
                          <span>Nouvelle Marge :</span>
                          <span className={cn("font-bold", newMargin >= oldMargin ? "text-emerald-400" : "text-amber-400")}>
                            {newMargin.toFixed(2)} {settings.currency}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400 text-[11px]">
                          <span>Nouveau Taux :</span>
                          <span className={cn("font-extrabold", newMarginPercent >= oldMarginPercent ? "text-emerald-400" : "text-amber-400")}>
                            {newMarginPercent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="pt-1.5 border-t border-industrial-900/80 flex justify-between items-center text-[10px] uppercase font-black">
                          <span className="text-slate-500">Impact Global :</span>
                          {newMargin >= oldMargin ? (
                            <span className="text-emerald-400 flex items-center gap-0.5">
                              <TrendingUp size={12} /> Stabilisé
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-0.5">
                              <TrendingDown size={12} /> Réduit
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Numeric Input controls */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-industrial-900/50">
                      <div className="text-left font-mono">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Prix de vente actuel</p>
                        <p className="font-extrabold text-white mt-0.5 text-sm">
                          {currentPrice.toFixed(2)} {settings.currency}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Ajuster Prix :</span>
                        <div className="relative flex items-center">
                          <input 
                            type="number"
                            step="any"
                            disabled={!isItemActive}
                            className={cn(
                              "w-36 pl-3 pr-10 py-2.5 bg-industrial-950 border text-white rounded-xl text-right font-mono font-black outline-none select-all transition-all text-sm",
                              isItemActive 
                                ? "border-indigo-500/30 hover:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                                : "border-industrial-900 opacity-50 cursor-not-allowed"
                            )}
                            value={updates[item.productId]?.price || 0}
                            onChange={(e) => setUpdates(prev => ({ 
                              ...prev, 
                              [item.productId]: { ...prev[item.productId], price: parseFloat(e.target.value) || 0 } 
                            }))}
                          />
                          <span className="absolute right-3.5 text-[10px] font-black text-indigo-400 pointer-events-none font-mono tracking-tight">{settings.currency}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Footer Section */}
            <div className="p-6 border-t border-industrial-800 bg-industrial-900/90 backdrop-blur-md flex flex-col sm:flex-row gap-4">
              <Button 
                variant="secondary" 
                onClick={handleClose} 
                className="flex-1 font-black uppercase tracking-widest text-xs py-3.5 border-industrial-800 hover:bg-industrial-800 text-slate-300"
              >
                Ignorer pour l'instant
              </Button>
              <Button 
                onClick={handleUpdate} 
                disabled={isProcessing || activeCount === 0} 
                className={cn(
                  "flex-[2] gap-2 font-black uppercase tracking-widest text-xs py-3.5 text-white active:scale-[0.98] transition-all duration-150 shadow-xl",
                  activeCount > 0 
                    ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20" 
                    : "bg-industrial-800 opacity-50 cursor-not-allowed border-industrial-700"
                )}
              >
                {isProcessing ? (
                  <RefreshCw className="animate-spin" size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {isProcessing ? "Application..." : `Appliquer (${activeCount}) Prix`}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
