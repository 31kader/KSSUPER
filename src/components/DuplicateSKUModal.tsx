import React from 'react';
import { 
  Trash2, Edit, Zap, Layers, Package 
} from 'lucide-react';
import { Product, CompanySettings } from '../types';
import { Button, Modal, Card, SafeImage } from './ui';

interface DuplicateGroup {
  sku: string;
  products: Product[];
}

export function DuplicateSKUModal({ 
  isOpen, onClose, groups, onEdit, onDelete, onMerge, settings
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  groups: DuplicateGroup[], 
  onEdit: (p: Product) => void, 
  onDelete: (id: string) => void, 
  onMerge: (group: DuplicateGroup) => void,
  settings: CompanySettings
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Doublons Détectés" size="lg">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-amber-600 shadow-sm shrink-0">
            <Layers size={20} />
          </div>
          <div className="text-sm">
            <p className="font-bold text-amber-900">Pourquoi est-ce un problème ?</p>
            <p className="text-amber-700 leading-relaxed">
              Le système a détecté des produits différents partageant le même SKU (Code-barre). 
              Cela peut fausser les ventes et l'inventaire. Vous pouvez soit <strong>fusionner</strong> le stock, soit <strong>supprimer</strong> les doublons.
            </p>
          </div>
        </div>

        {groups.map((group, idx) => (
          <Card key={group.sku} className="p-4 border-slate-200 hover:border-slate-300 transition-all bg-slate-50/30">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase">SKU: {group.sku}</span>
                <span className="text-xs font-bold text-slate-400">{group.products.length} produits trouvés</span>
              </div>
              <Button onClick={() => onMerge(group)} className="h-8 text-[10px] gap-1 bg-rose-600 hover:bg-rose-700">
                <Zap size={12} fill="currentColor" /> Fusionner le stock
              </Button>
            </div>
            
            <div className="space-y-3">
              {group.products.map(p => (
                <div key={p.id} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                      {p.imageUrl ? (
                        <SafeImage 
                          src={p.imageUrl} 
                          className="w-full h-full object-cover" 
                          alt="" 
                          fallback={<Package size={16} className="m-3 text-slate-300" />}
                        />
                      ) : <Package size={16} className="m-3 text-slate-300" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{p.name}</p>
                      <p className="text-[10px] text-slate-500">Stock actuel: {p.stock} | Prix: {p.price} {settings.currency}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onEdit(p)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-lg hover:bg-indigo-50 transition-all">
                      <Edit size={14} />
                    </button>
                    <button onClick={() => onDelete(p.id)} className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 rounded-lg hover:bg-rose-50 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <div className="pt-4 mt-6 border-t border-slate-100 flex justify-end">
        <Button onClick={onClose} variant="secondary" className="px-8">Fermer</Button>
      </div>
    </Modal>
  );
}
