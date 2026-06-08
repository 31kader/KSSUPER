import React, { useState, useEffect } from 'react';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';
import { Product, CompanySettings, Transaction } from '../types';
import { Modal, Button } from './ui';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  products: Product[];
  settings: CompanySettings;
}

export function EditTransactionModal({ isOpen, onClose, transaction, products, settings }: EditTransactionModalProps) {
  const [items, setItems] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (transaction) {
      setItems(transaction.items.map((item: any) => ({ ...item })));
    }
  }, [transaction]);

  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleUpdate = async () => {
    if (!transaction) return;
    setIsProcessing(true);

    try {
      // 1. Process stock changes
      const originalItems = transaction.items;
      
      for (const originalItem of originalItems) {
        const newItem = items.find(i => i.id === originalItem.id);
        const product = products.find((p: Product) => p.id === originalItem.id);
        
        if (product) {
          let stockChange = 0;
          if (!newItem) {
            stockChange = originalItem.quantity;
          } else if (newItem.quantity !== originalItem.quantity) {
            stockChange = originalItem.quantity - newItem.quantity;
          }
          
          if (stockChange !== 0) {
            if (product.isBundle && product.bundleItems) {
              for (const bundleItem of product.bundleItems) {
                const componentProduct = products.find((p: Product) => p.id === bundleItem.productId);
                if (componentProduct && componentProduct.id) {
                  const currentStock = componentProduct.stock || 0;
                  const { error } = await supabase
                    .from('products')
                    .update({ 
                        stock: currentStock + (bundleItem.quantity * stockChange),
                        updatedAt: new Date().toISOString()
                    })
                    .eq('id', componentProduct.id);
                  if (error) throw error;
                }
              }
            } else if (product.id) {
              const currentStock = product.stock || 0;
              const { error } = await supabase
                .from('products')
                .update({ 
                    stock: currentStock + stockChange,
                    updatedAt: new Date().toISOString()
                })
                .eq('id', product.id);
              if (error) throw error;
            }
          }
        }
      }

      // 2. Update transaction
      const { error: txError } = await supabase
        .from('transactions')
        .update({
            items: items.filter(i => i.quantity > 0),
            total: total,
            updatedAt: new Date().toISOString()
        })
        .eq('id', transaction.id);
      
      if (txError) throw txError;

      onClose();
    } catch (error: any) {
      alert("Erreur lors de la mise à jour: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Modifier la commande (En attente)">
      <div className="space-y-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase mb-4">Articles de la commande</p>
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={`edit-item-${idx}`} className="flex items-center justify-between gap-4 p-3 bg-white rounded-lg border border-slate-100">
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.price.toFixed(2)} {settings.currency} / unité</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      const newItems = [...items];
                      newItems[idx].quantity = Math.max(0, newItems[idx].quantity - 1);
                      setItems(newItems);
                    }}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-10 text-center font-black text-slate-800">{item.quantity}</span>
                  <button 
                    onClick={() => {
                      const newItems = [...items];
                      newItems[idx].quantity += 1;
                      setItems(newItems);
                    }}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500"
                  >
                    <Plus size={16} />
                  </button>
                  <button 
                    onClick={() => {
                      const newItems = items.filter((_, i) => i !== idx);
                      setItems(newItems);
                    }}
                    className="ml-2 p-1 text-rose-500 hover:bg-rose-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-center text-sm text-slate-500 py-4">Aucun article dans la commande.</p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold">Nouveau Total</p>
            <p className="text-2xl font-black text-slate-900">{total.toFixed(2)} {settings.currency}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose} disabled={isProcessing}>Annuler</Button>
            <Button 
              onClick={handleUpdate} 
              disabled={isProcessing || items.length === 0}
              className="px-8"
            >
              {isProcessing ? "Mise à jour..." : "Enregistrer les modifications"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
