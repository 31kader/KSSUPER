import React, { useState, useMemo, memo } from 'react';
import { History, ChevronUp, Edit2, Trash2, AlertTriangle, Check, X, Package } from 'lucide-react';
import { cn, formatSafe } from '../lib/utils';
import { Card, SortableHeader, Button, Modal } from './ui';
import { StockAdjustment, Product } from '../types';
import { supabase } from '../supabase';
import { toast } from 'sonner';

interface StockHistoryProps {
  adjustments: StockAdjustment[];
  products?: Product[];
  user?: any;
}

export const StockHistory = memo(function StockHistory({ adjustments, products = [], user }: StockHistoryProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof StockAdjustment; direction: 'asc' | 'desc' } | null>({ key: 'timestamp', direction: 'desc' });
  const pageSize = 20;

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState<StockAdjustment | null>(null);
  const [editedReason, setEditedReason] = useState('');
  const [editedAdjustmentValue, setEditedAdjustmentValue] = useState<number | ''>(0);
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [revertProductStock, setRevertProductStock] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // Find product helper
  const getProductForAdjustment = (adj: StockAdjustment | null) => {
    if (!adj) return null;
    return products.find(p => p.id === adj.productId) || null;
  };

  const sortedAdjustments = useMemo(() => {
    let sortableItems = [...adjustments];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [adjustments, sortConfig]);

  const requestSort = (key: keyof StockAdjustment) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const paginatedAdjustments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAdjustments.slice(start, start + pageSize);
  }, [sortedAdjustments, currentPage]);

  const totalPages = Math.ceil(adjustments.length / pageSize);

  // Handlers
  const handleEditClick = (adj: StockAdjustment) => {
    setSelectedAdjustment(adj);
    setEditedReason(adj.reason || '');
    setEditedAdjustmentValue(adj.adjustment || 0);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (adj: StockAdjustment) => {
    setSelectedAdjustment(adj);
    setRevertProductStock(true);
    setIsDeleteModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdjustment) return;
    if (editedAdjustmentValue === '') {
      toast.error("Veuillez saisir une valeur d'ajustement valide.");
      return;
    }

    setIsSaving(true);
    try {
      const originalAdjustment = selectedAdjustment.adjustment || 0;
      const difference = editedAdjustmentValue - originalAdjustment;
      const product = getProductForAdjustment(selectedAdjustment);
      const updates: any = {};

      if (difference !== 0 && product && product.id) {
        // Adjust product stock dynamically: stock + difference
        const updatedStock = (product.stock || 0) + difference;
        const { error } = await supabase
          .from('products')
          .update({
            stock: updatedStock,
            updatedAt: new Date().toISOString()
          })
          .eq('id', product.id);
        if (error) throw error;

        // Trigger local cache update for consistent view
        window.dispatchEvent(new CustomEvent('product-cache-update', { 
          detail: { ...product, stock: updatedStock, updatedAt: new Date().toISOString() } 
        }));
      }

      // Update adjustment document
      const newQuantity = selectedAdjustment.oldQuantity + editedAdjustmentValue;
      const { error: adjError } = await supabase
        .from('stockAdjustments')
        .update({
          adjustment: editedAdjustmentValue,
          quantity: editedAdjustmentValue, // legacy field stability
          newQuantity: newQuantity,
          reason: editedReason,
          timestamp: new Date().toISOString() // update timestamp to reflect modification
        })
        .eq('id', selectedAdjustment.id);
      
      if (adjError) throw adjError;

      toast.success("Ajustement de stock mis à jour avec succès.");
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Error updating stock adjustment:", error);
      toast.error("Erreur lors de la mise à jour de l'ajustement.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedAdjustment) return;

    setIsDeleting(true);
    try {
      const product = getProductForAdjustment(selectedAdjustment);
      const updates: any = {};

      if (revertProductStock && product && product.id) {
        // Revert the original adjustment: stock - adjustment
        const updatedStock = (product.stock || 0) - (selectedAdjustment.adjustment || 0);
        const { error } = await supabase
          .from('products')
          .update({
            stock: updatedStock,
            updatedAt: new Date().toISOString()
          })
          .eq('id', product.id);
        if (error) throw error;

        // Trigger cache update
        window.dispatchEvent(new CustomEvent('product-cache-update', { 
          detail: { ...product, stock: updatedStock, updatedAt: new Date().toISOString() } 
        }));
      }

      // Delete the adjustment document
      const { error: delError } = await supabase
        .from('stockAdjustments')
        .delete()
        .eq('id', selectedAdjustment.id);
      if (delError) throw delError;

      toast.success("Ajustement de stock supprimé/annulé avec succès.");
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting stock adjustment:", error);
      toast.error("Erreur lors de la suppression de l'ajustement.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Live stock change calculation for preview
  const activeProduct = getProductForAdjustment(selectedAdjustment);
  const livePreviewStock = useMemo(() => {
    if (!activeProduct || !selectedAdjustment) return 0;
    const currentProductStock = activeProduct.stock || 0;
    const originalAdjustmentValue = selectedAdjustment.adjustment || 0;
    const targetAdjustmentValue = editedAdjustmentValue === '' ? 0 : editedAdjustmentValue;
    return currentProductStock + (targetAdjustmentValue - originalAdjustmentValue);
  }, [activeProduct, selectedAdjustment, editedAdjustmentValue]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">Historique des Ajustements</h3>
          <p className="text-sm text-slate-400">Suivez, modifiez ou annulez les modifications de stock et leurs causes</p>
        </div>
      </div>

      <Card className="overflow-hidden bg-workspace border border-industrial-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-industrial-750">
                <SortableHeader label="Date" sortKey="timestamp" currentSort={sortConfig} onSort={() => requestSort('timestamp')} />
                <SortableHeader label="Produit" sortKey="productName" currentSort={sortConfig} onSort={() => requestSort('productName')} />
                <SortableHeader label="Ancien" sortKey="oldQuantity" currentSort={sortConfig} onSort={() => requestSort('oldQuantity')} />
                <SortableHeader label="Nouveau" sortKey="newQuantity" currentSort={sortConfig} onSort={() => requestSort('newQuantity')} />
                <SortableHeader label="Ajustement" sortKey="adjustment" currentSort={sortConfig} onSort={() => requestSort('adjustment')} />
                <SortableHeader label="Cause" sortKey="reason" currentSort={sortConfig} onSort={() => requestSort('reason')} />
                <th className="p-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedAdjustments.map((adj) => {
                const isPositive = adj.adjustment > 0;
                return (
                  <tr key={adj.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4 text-sm text-slate-300">
                      {formatSafe(adj.timestamp, 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-semibold text-white">{adj.productName}</p>
                    </td>
                    <td className="p-4 text-sm text-slate-400">{adj.oldQuantity}</td>
                    <td className="p-4 text-sm text-slate-200 font-bold">{adj.newQuantity}</td>
                    <td className="p-4">
                      <span className={cn("px-2 py-1 rounded-full text-xs font-bold shadow-inner border", 
                        isPositive 
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" 
                          : "bg-rose-500/15 text-rose-400 border-rose-500/20"
                      )}>
                        {isPositive ? '+' : ''}{adj.adjustment}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-slate-300 max-w-xs truncate" title={adj.reason}>{adj.reason}</p>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditClick(adj)}
                          className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded-xl transition-all"
                          title="Modifier le motif ou la valeur de cet ajustement"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(adj)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-xl transition-all"
                          title="Supprimer ou annuler cet ajustement de stock"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {adjustments.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 bg-white/5">
                    <div className="flex flex-col items-center gap-3">
                      <History size={48} className="text-slate-600" strokeWidth={1.5} />
                      <p className="text-sm font-medium">Aucun ajustement de stock enregistré</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-industrial-700 flex items-center justify-between bg-black/40">
            <p className="text-xs text-slate-500 font-medium">
              Affichage de <span className="font-bold text-white">{Math.min(adjustments.length, (currentPage - 1) * pageSize + 1)}</span> à <span className="font-bold text-white">{Math.min(adjustments.length, currentPage * pageSize)}</span> sur <span className="font-bold text-white">{adjustments.length}</span> ajustements
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-industrial-700 disabled:opacity-30 hover:bg-white/5 text-slate-400 transition-colors"
              >
                <ChevronUp className="-rotate-90" size={16} />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum = currentPage;
                  if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;

                  if (pageNum <= 0 || pageNum > totalPages) return null;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                        currentPage === pageNum 
                          ? "bg-indigo-600 text-white shadow-neon-indigo border border-indigo-400/50" 
                          : "text-slate-400 hover:bg-white/5"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-industrial-700 disabled:opacity-30 hover:bg-white/5 text-slate-400 transition-colors"
              >
                <ChevronUp className="rotate-90" size={16} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Edit stock adjustment modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Modifier l'Ajustement" className="max-w-md">
        {selectedAdjustment && (
          <form onSubmit={handleSaveEdit} className="space-y-6 pt-4">
            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-black/40 rounded-2xl shadow-inner flex items-center justify-center border border-white/10 text-indigo-400">
                <Package size={24} />
              </div>
              <div>
                <h4 className="font-black text-white uppercase tracking-widest leading-tight">{selectedAdjustment.productName}</h4>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-1">
                  Stock Actuel: <span className="text-indigo-400">{(activeProduct?.stock || 0)} {activeProduct?.unit || 'unité'}</span>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Ajustement Initial</p>
                  <p className="text-lg font-black text-white mt-1">
                    {selectedAdjustment.adjustment > 0 ? '+' : ''}{selectedAdjustment.adjustment}
                  </p>
                </div>
                <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Nouveau Stock Recalculé</p>
                  <p className="text-lg font-black text-indigo-300 mt-1">
                    {livePreviewStock} <span className="text-xs font-normal text-indigo-400/70">{activeProduct?.unit || 'U'}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] pl-2">Nouvel Ajustement Quantité</label>
                <input 
                  required
                  type="number"
                  step="0.01"
                  value={editedAdjustmentValue}
                  onChange={e => setEditedAdjustmentValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-xl font-black text-white focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-center shadow-inner"
                />
                <p className="text-[10px] text-slate-400 pl-2">Saisir une valeur négative (ex: -5) pour réduire ou positive (ex: 5) pour augmenter le stock.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] pl-2">Motif de l'ajustement</label>
                <textarea 
                  rows={2}
                  value={editedReason}
                  onChange={e => setEditedReason(e.target.value)}
                  placeholder="Ex: Inventaire périodique, casse, etc."
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner placeholder:text-white/10"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={() => setIsEditModalOpen(false)} variant="ghost" className="flex-1 py-4">
                Annuler
              </Button>
              <Button type="submit" disabled={isSaving} className="flex-1 py-4 uppercase text-xs tracking-wider">
                {isSaving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete stock adjustment confirmation */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Annuler l'Ajustement de Stock" className="max-w-md">
        {selectedAdjustment && (
          <div className="space-y-6 pt-4">
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="text-sm font-bold text-rose-300">Action irréversible</h4>
                <p className="text-xs text-rose-400/80 mt-1">Vous êtes sur le point de supprimer cet enregistrement d'ajustement de stock.</p>
              </div>
            </div>

            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2">
              <p className="text-xs text-slate-400">Détails de l'élément :</p>
              <p className="text-sm font-bold text-white">{selectedAdjustment.productName}</p>
              <p className="text-xs text-slate-300">Date : {formatSafe(selectedAdjustment.timestamp, 'dd/MM/yyyy HH:mm')}</p>
              <p className="text-xs text-slate-300">Valeur : <span className="font-bold">{selectedAdjustment.adjustment > 0 ? '+' : ''}{selectedAdjustment.adjustment}</span></p>
              <p className="text-xs text-slate-300">Motif : "{selectedAdjustment.reason}"</p>
            </div>

            {activeProduct && (
              <div className="space-y-3 p-4 bg-white/5 border border-white/5 rounded-2xl">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={revertProductStock}
                    onChange={e => setRevertProductStock(e.target.checked)}
                    className="mt-1 accent-indigo-600 rounded"
                  />
                  <div>
                    <span className="text-xs font-bold text-white">Rétablir également le stock du produit ?</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Si coché, le stock de {activeProduct.name} passera de <span className="text-white font-bold">{activeProduct.stock || 0}</span> à <span className="text-indigo-400 font-bold">{(activeProduct.stock || 0) - (selectedAdjustment.adjustment || 0)}</span> (retrait de l'ajustement).
                    </p>
                  </div>
                </label>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={() => setIsDeleteModalOpen(false)} variant="ghost" className="flex-1 py-4">
                Fermer
              </Button>
              <Button onClick={handleConfirmDelete} disabled={isDeleting} variant="danger" className="flex-1 py-4 uppercase text-xs tracking-wider">
                {isDeleting ? "Suppression..." : "Confirmer"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
});
