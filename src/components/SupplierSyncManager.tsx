import React, { useState, memo } from 'react';
import { 
  Plus, RefreshCw, Trash2, X, AlertTriangle, FileText, CheckCircle2 
} from 'lucide-react';
import { supabase } from '../supabase';
import { 
  Supplier, Product, SupplierSync 
} from '../types';
import { Button, Card, Modal, ConfirmDialog } from './ui';
import { getApiUrl } from '../lib/api';

export const SupplierSyncManager = memo(function SupplierSyncManager({ 
  supplierSyncs, suppliers, products 
}: { 
  supplierSyncs: SupplierSync[], suppliers: Supplier[], products: Product[] 
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSync, setEditingSync] = useState<SupplierSync | null>(null);
  const [activeSyncing, setActiveSyncing] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [syncToDelete, setSyncToDelete] = useState<SupplierSync | null>(null);

  const [formData, setFormData] = useState<{
    supplierId: string;
    name?: string;
    url: string;
    format: 'json' | 'csv';
    mapping: {
      sku: string;
      name?: string;
      category?: string;
      description?: string;
      stock: string;
      price?: string;
      costPrice?: string;
      [key: string]: string | undefined;
    };
    interval: number;
    active: boolean;
  }>({
    supplierId: '',
    name: '',
    url: '',
    format: 'json',
    mapping: {
      sku: 'sku',
      name: 'name',
      price: 'price',
      stock: 'stock',
      costPrice: 'costPrice'
    },
    interval: 60,
    active: true
  });

  const handleEdit = (sync: SupplierSync) => {
    setEditingSync(sync);
    setFormData({
      supplierId: sync.supplierId,
      name: sync.name,
      url: sync.url,
      format: sync.format,
      mapping: sync.mapping,
      interval: sync.interval || 60,
      active: sync.active
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSync) {
        const { error } = await supabase
          .from('supplierSyncs')
          .update({
            ...formData,
            updatedAt: new Date().toISOString()
          })
          .eq('id', editingSync.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('supplierSyncs')
          .insert({
            id: Math.random().toString(36).substring(2, 10),
            ...formData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        if (error) throw error;
      }
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Error saving supplier sync:", error);
      alert("Erreur lors de la sauvegarde du flux: " + error.message);
    }
  };

  const handleDelete = async () => {
    if (!syncToDelete) return;
    try {
      const { error } = await supabase
        .from('supplierSyncs')
        .delete()
        .eq('id', syncToDelete.id);
      if (error) throw error;

      setIsDeleteConfirmOpen(false);
      setSyncToDelete(null);
    } catch (error: any) {
      console.error("Error deleting supplier sync:", error);
      alert("Erreur lors de la suppression: " + error.message);
    }
  };

  const triggerSync = async (sync: SupplierSync) => {
    setActiveSyncing(sync.id);
    try {
      const response = await fetch(getApiUrl('/api/suppliers/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncId: sync.id })
      });
      if (!response.ok) throw new Error('Sync failed');
      const result = await response.json();
      alert(`Synchronisation terminée : ${result.updated} mis à jour, ${result.created} créés.`);
    } catch (error) {
      console.error(error);
      alert('Erreur lors de la synchronisation.');
    } finally {
      setActiveSyncing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-800">Flux Fournisseurs</h3>
          <p className="text-sm text-slate-500">Automatisez la mise à jour de vos prix et stocks</p>
        </div>
        <Button onClick={() => { setEditingSync(null); setIsModalOpen(true); }} className="gap-2">
          <Plus size={20} /> Nouveau Flux
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {supplierSyncs.map(sync => (
          <Card key={sync.id} className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <RefreshCw size={20} className={activeSyncing === sync.id ? "animate-spin" : ""} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">{sync.name}</h4>
                  <p className="text-[10px] text-slate-400 uppercase font-black">{sync.format} FEED</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => triggerSync(sync)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                  <RefreshCw size={16} />
                </button>
                <button onClick={() => handleEdit(sync)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg">
                  <FileText size={16} />
                </button>
                <button onClick={() => { setSyncToDelete(sync); setIsDeleteConfirmOpen(true); }} className="p-2 text-rose-400 hover:text-rose-600 rounded-lg">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-2">
               <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Dernière Sync</span>
                  <span className="font-bold">{sync.lastSync ? new Date(sync.lastSync).toLocaleString('fr-FR') : 'Jamais'}</span>
               </div>
               <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Statut</span>
                  <span className={sync.active ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                    {sync.active ? "Actif" : "Désactivé"}
                  </span>
               </div>
            </div>

            <p className="text-[10px] text-slate-400 truncate bg-white border border-slate-100 p-1.5 rounded">{sync.url}</p>
          </Card>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSync ? "Modifier le flux" : "Nouveau flux"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Fournisseur</label>
            <select required className="w-full p-2 border border-slate-200 rounded-lg" value={formData.supplierId} onChange={e => setFormData({...formData, supplierId: e.target.value})}>
              <option value="">Sélectionner un fournisseur</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Nom du flux</label>
            <input required className="w-full p-2 border border-slate-200 rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="ex: Feed JSON Principal" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">URL du flux</label>
            <input required className="w-full p-2 border border-slate-200 rounded-lg font-mono text-xs" value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} placeholder="https://api.fournisseur.com/products" />
          </div>
          
          <div className="bg-slate-50 p-4 rounded-xl space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mapping des Colonnes</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(formData.mapping) as Array<keyof typeof formData.mapping>).map(key => (
                <div key={key} className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 capitalize">{key}</label>
                  <input className="w-full p-1.5 text-xs border border-slate-200 rounded-lg" value={formData.mapping[key]} onChange={e => setFormData({...formData, mapping: {...formData.mapping, [key]: e.target.value}})} />
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full">Enregistrer le flux</Button>
        </form>
      </Modal>

      <ConfirmDialog 
        isOpen={isDeleteConfirmOpen} 
        onClose={() => setIsDeleteConfirmOpen(false)} 
        onConfirm={handleDelete} 
        title="Supprimer le flux" 
        message="Êtes-vous sûr de vouloir supprimer ce flux de synchronisation ?" 
      />
    </div>
  );
});
