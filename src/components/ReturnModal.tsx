import React, { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { db, rtdb, ref, get, set, remove, child, update, push, handleFirestoreError, OperationType } from '../database';
import { Product, CompanySettings, Transaction, ProductReturn, Customer } from '../types';
import { cn, generateUniqueId, logAction } from '../lib/utils';
import { Modal, Button } from './ui';

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  user: any;
  products: Product[];
  customers: Customer[];
  settings: CompanySettings;
  allReturns: ProductReturn[];
}

export function ReturnModal({ isOpen, onClose, transaction, user, products, customers, settings, allReturns }: ReturnModalProps) {
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [reason, setReason] = useState('');
  const [returnType, setReturnType] = useState<'refund' | 'credit_note'>('refund');
  const [returnDate, setReturnDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (transaction) {
      // Calculate already returned quantities for this transaction
      const transactionReturns = (allReturns || []).filter((r: any) => r.transactionId === transaction.id);
      
      setReturnItems(transaction.items.map((item: any) => {
        const alreadyReturned = transactionReturns.reduce((sum: number, r: any) => {
          const matchingItem = r.items.find((ri: any) => ri.productId === item.id);
          return sum + (matchingItem ? matchingItem.quantity : 0);
        }, 0);

        const availableToReturn = Math.max(0, item.quantity - alreadyReturned);
        return {
          ...item,
          alreadyReturned,
          availableToReturn,
          returnQuantity: availableToReturn
        };
      }));
      setReason('');
      setReturnType('refund');
      setReturnDate(format(new Date(), 'yyyy-MM-dd'));
      setShowConfirmation(false);
    }
  }, [transaction, allReturns]);

  const totalRefund = returnItems.reduce((sum, item) => sum + (item.price * item.returnQuantity), 0);

  const handleReturn = async () => {
    if (!transaction || returnItems.every(item => item.returnQuantity === 0)) return;
    if (isProcessing) return;
    setIsProcessing(true);

    let parsedDate = new Date().toISOString();
    try {
      if (returnDate) {
        parsedDate = new Date(returnDate).toISOString();
      }
    } catch (e) {
      console.error("Invalid return date", e);
    }

    try {
      const returnId = push(child(ref(rtdb), 'returns')).key || generateUniqueId();
      const returnData: ProductReturn = {
        id: returnId,
        transactionId: transaction.id || '',
        items: returnItems.filter(item => item.returnQuantity > 0).map(item => ({
          lineId: generateUniqueId(),
          productId: item.id || item.productId || 'unknown',
          name: item.name || 'Produit inconnu',
          quantity: item.returnQuantity || 0,
          price: item.price || 0
        })),
        totalRefund: totalRefund || 0,
        reason: reason || '',
        timestamp: parsedDate,
        userId: user?.uid || 'unknown',
        customerId: transaction.customerId || null,
        type: returnType || 'refund'
      };

      const updates: any = {};
      
      // 1. Create return record
      updates[`returns/${returnId}`] = returnData;

      // 2. Update stock
      for (const item of returnData.items) {
        const product = products.find((p: Product) => p.id === item.productId);
        if (product) {
          if (product.isBundle && product.bundleItems) {
            for (const bundleItem of product.bundleItems) {
              const componentProduct = products.find((p: Product) => p.id === bundleItem.productId);
              if (componentProduct && componentProduct.id) {
                updates[`products/${componentProduct.id}/stock`] = (componentProduct.stock || 0) + (bundleItem.quantity * item.quantity);
                updates[`products/${componentProduct.id}/updatedAt`] = new Date().toISOString();
              }
            }
          } else if (product.id) {
            updates[`products/${product.id}/stock`] = (product.stock || 0) + item.quantity;
            updates[`products/${product.id}/updatedAt`] = new Date().toISOString();
          }
        }
      }

      // 3. Update customer loyalty points (deduct)
      if (transaction.customerId) {
        const customer = customers.find((c: Customer) => c.id === transaction.customerId);
        if (customer) {
          const pointsToDeduct = Math.floor(totalRefund);
          updates[`customers/${customer.id}/loyaltyPoints`] = Math.max(0, (customer.loyaltyPoints || 0) - pointsToDeduct);
          updates[`customers/${customer.id}/totalSpent`] = Math.max(0, (customer.totalSpent || 0) - totalRefund);
        }
      }

      // 4. Update transaction status
      const totalInitiallySold = transaction.items.reduce((sum: number, i: any) => sum + i.quantity, 0);
      const totalReturnedSoFar = returnItems.reduce((sum: number, i: any) => sum + i.alreadyReturned + i.returnQuantity, 0);
      
      const allItemsReturned = totalReturnedSoFar >= totalInitiallySold;
      updates[`transactions/${transaction.id}/status`] = allItemsReturned ? 'returned' : 'partially_returned';

      if (Object.keys(updates).length > 0) {
        await update(ref(rtdb), updates);
      }

      logAction(user.uid, user.displayName || 'Utilisateur', 'Retour', 'Vente', `Retour de ${totalRefund.toFixed(2)} ${settings.currency} pour la transaction #${transaction.id.slice(-8).toUpperCase()}`);

      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'returns');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enregistrer un retour">
      <div className="space-y-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Transaction #{transaction?.id?.slice(-8).toUpperCase()}</p>
          <div className="space-y-3">
            {returnItems.map((item, idx) => (
              <div key={`return-item-${item.productId}-${idx}`} className={`flex items-center justify-between gap-4 p-2 rounded-lg ${item.availableToReturn === 0 ? 'opacity-50 grayscale bg-slate-100' : ''}`}>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {item.price.toFixed(2)} {settings.currency} x {item.quantity} 
                    {item.alreadyReturned > 0 && <span className="ml-2 text-rose-500 font-bold">(Déjà retourné: {item.alreadyReturned})</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      const newItems = [...returnItems];
                      newItems[idx].returnQuantity = Math.max(0, newItems[idx].returnQuantity - 1);
                      setReturnItems(newItems);
                    }}
                    disabled={item.availableToReturn === 0}
                    className="p-1 hover:bg-slate-200 rounded disabled:opacity-0"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center font-bold">{item.returnQuantity}</span>
                  <button 
                    onClick={() => {
                      const newItems = [...returnItems];
                      newItems[idx].returnQuantity = Math.min(item.availableToReturn, newItems[idx].returnQuantity + 1);
                      setReturnItems(newItems);
                    }}
                    disabled={item.availableToReturn === 0 || item.returnQuantity >= item.availableToReturn}
                    className="p-1 hover:bg-slate-200 rounded disabled:opacity-0"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Date du retour</label>
            <input 
              type="date"
              required
              className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={returnDate}
              onChange={e => setReturnDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Raison du retour</label>
            <textarea 
              className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-20 text-sm"
              placeholder="Ex: Article défectueux, erreur de taille..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Type de remboursement</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setReturnType('refund')}
                className={cn(
                  "py-2 rounded-lg text-xs font-bold border transition-all",
                  returnType === 'refund' ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                Remboursement
              </button>
              <button 
                onClick={() => setReturnType('credit_note')}
                className={cn(
                  "py-2 rounded-lg text-xs font-bold border transition-all",
                  returnType === 'credit_note' ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                Note de Crédit
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Total à rembourser</p>
            <p className="text-xl font-bold text-slate-900">{totalRefund.toFixed(2)} {settings.currency}</p>
          </div>
          <div className="flex items-center gap-3">
            {showConfirmation && (
              <Button 
                variant="ghost" 
                onClick={() => setShowConfirmation(false)}
                disabled={isProcessing}
                className="text-slate-500"
              >
                Annuler
              </Button>
            )}
            <Button 
              onClick={() => {
                if (!showConfirmation) {
                  setShowConfirmation(true);
                } else {
                  handleReturn();
                }
              }} 
              disabled={totalRefund === 0 || isProcessing}
              className={cn("px-8", showConfirmation ? "bg-rose-600 hover:bg-rose-700 text-white" : "")}
            >
              {isProcessing ? "Traitement..." : showConfirmation ? "Confirmer le retour" : "Valider le retour"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
