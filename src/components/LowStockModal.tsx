import React from 'react';
import { Modal, Button } from './ui';
import { Product, CompanySettings } from '../types';

interface LowStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  settings: CompanySettings;
}

export function LowStockModal({ isOpen, onClose, products, settings }: LowStockModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Alertes de Stock Bas">
      <div className="space-y-4">
        {products.length === 0 ? (
          <p className="text-center text-slate-500 py-8">Aucun produit en stock bas.</p>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {products.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-rose-50 border border-rose-100 rounded-xl">
                <div>
                  <p className="font-bold text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-500">SKU: {p.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-rose-600">{p.stock} {p.unit}</p>
                  <p className="text-[10px] text-slate-400">Seuil: {p.minStock}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button onClick={onClose} className="w-full">Fermer</Button>
      </div>
    </Modal>
  );
}
