import React from 'react';
import { Modal, Button } from './ui';
import { Product, CompanySettings } from '../types';

interface ExpirationModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

export function ExpirationModal({ isOpen, onClose, products }: ExpirationModalProps) {
  const getDaysDiff = (expDateStr: string) => {
    const expDate = new Date(expDateStr);
    const now = new Date();
    const diffTime = expDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Alertes de Péremption (DLC)">
      <div className="space-y-4">
        {products.length === 0 ? (
          <p className="text-center text-slate-500 py-8">Aucun produit périmé ou proche de la péremption.</p>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {products.sort((a, b) => new Date(a.expirationDate!).getTime() - new Date(b.expirationDate!).getTime()).map(p => {
              const daysLeft = getDaysDiff(p.expirationDate!);
              const isExpired = daysLeft < 0;
              
              return (
                <div key={p.id} className={`flex items-center justify-between p-3 border rounded-xl ${isExpired ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div>
                    <p className={`font-bold ${isExpired ? 'text-red-800' : 'text-amber-800'}`}>{p.name}</p>
                    <p className="text-xs text-slate-500">SKU: {p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${isExpired ? 'text-red-600' : 'text-amber-600'}`}>
                      {isExpired ? 'Périmé !' : `${daysLeft} jours restants`}
                    </p>
                    <p className="text-[10px] text-slate-500">DLC: {new Date(p.expirationDate!).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Button onClick={onClose} className="w-full">Fermer</Button>
      </div>
    </Modal>
  );
}
