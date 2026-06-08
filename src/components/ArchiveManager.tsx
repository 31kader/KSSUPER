import React, { useState } from 'react';
import { Card, Button } from './ui';
import { Download, Upload, AlertTriangle, ShieldAlert, CheckCircle, Clock, Info } from 'lucide-react';
import { supabase } from '../supabase';
import { Transaction, Purchase, Expense, StockAdjustment } from '../types';
import { format } from 'date-fns';

interface ArchiveManagerProps {
  user: any;
  settings: any;
}

export function ArchiveManager({ user, settings }: ArchiveManagerProps) {
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [deleteAfterArchive, setDeleteAfterArchive] = useState(true);
  const [progress, setProgress] = useState<{ step: string; count?: number; total?: number } | null>(null);

  const [statusMessage, setStatusMessage] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info'; confirmAction?: () => void } | null>(null);

  const collectionsToArchive = [
    { name: 'transactions', dateField: 'timestamp' },
    { name: 'purchases', dateField: 'date' },
    { name: 'expenses', dateField: 'date' },
    { name: 'returns', dateField: 'timestamp' },
    { name: 'stock_adjustments', dateField: 'timestamp' }, // Renamed to match likely table name
    { name: 'supplier_payments', dateField: 'date' }, // Renamed
    { name: 'online_orders', dateField: 'timestamp' } // Renamed
  ];

  const executeArchiveTask = async () => {
    setIsArchiving(true);
    setProgress({ step: 'Récupération des données...' });
    
    try {
      const archiveData: Record<string, any[]> = {};
      const endDateTime = endDate + 'T23:59:59.999Z';

      for (const col of collectionsToArchive) {
        setProgress({ step: `Récupération de ${col.name}...` });
        
        const { data, error } = await supabase
          .from(col.name)
          .select('*')
          .lte(col.dateField, endDateTime);

        if (error) throw error;
        archiveData[col.name] = data || [];
      }

      // Add metadata
      const exportObject = {
        meta: {
          version: '1.0',
          type: 'monthly_closure_archive',
          createdAt: new Date().toISOString(),
          endDate: endDate,
          company: settings?.companyName || 'Mon Entreprise'
        },
        data: archiveData
      };

      const jsonStr = JSON.stringify(exportObject, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `cloture_archive_${endDate}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (deleteAfterArchive) {
        setProgress({ step: 'Suppression des données archivées...' });
        for (const col of collectionsToArchive) {
          const items = archiveData[col.name];
          if (items.length === 0) continue;
          
          const ids = items.map((item: any) => item.id);
          const { error } = await supabase.from(col.name).delete().in('id', ids);
          if (error) throw error;
        }
      }

      setStatusMessage({ title: "Succès", message: "Clôture et archivage terminés avec succès!", type: "success" });
    } catch (e: any) {
      console.error(e);
      let errMsg = "Une erreur est survenue lors de l'archivage: " + e.message;
      setStatusMessage({ title: "Erreur", message: errMsg, type: "error" });
    } finally {
      setIsArchiving(false);
      setProgress(null);
    }
  };

  const handleArchive = async () => {
    if (!endDate) {
      setStatusMessage({ title: "Action requise", message: "Veuillez sélectionner une date de fin.", type: "info" });
      return;
    }
    
    if (deleteAfterArchive) {
      setStatusMessage({ 
        title: "Confirmation de suppression", 
        message: "Êtes-vous sûr de vouloir cloturer et SUPPRIMER l'historique jusqu'à cette date ? Assurez-vous de bien garder le fichier de sauvegarde qui sera téléchargé.", 
        type: "info",
        confirmAction: executeArchiveTask
      });
    } else {
      await executeArchiveTask();
    }
  };

  const executeRestoreTask = async (file: File) => {
    setIsRestoring(true);
    setProgress({ step: 'Lecture du fichier...' });

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (parsed.meta?.type !== 'monthly_closure_archive' || !parsed.data) {
        throw new Error("Format de fichier non valide pour la restauration d'archive.");
      }

      const archiveData = parsed.data;
      
      for (const col of collectionsToArchive) {
        const items = archiveData[col.name];
        if (!items || items.length === 0) continue;

        setProgress({ step: `Restauration de ${col.name} (${items.length} éléments)...` });
        
        const { error } = await supabase.from(col.name).upsert(items);
        if (error) throw error;
      }

      setStatusMessage({ title: "Succès", message: "Restauration réussie!", type: "success" });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ title: "Erreur", message: err.message || "Erreur lors de la lecture ou restauration du fichier.", type: "error" });
    } finally {
      setIsRestoring(false);
      setProgress(null);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage({
      title: "Confirmation de restauration",
      message: "Vous êtes sur le point de restaurer des données d'archives. Ces données réintégreront votre historique en cours (sans modifier les stocks et soldes actuels). Continuer ?",
      type: "info",
      confirmAction: () => executeRestoreTask(file)
    });
    
    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldAlert className="text-rose-500" />
          Clôture de Mois & Archives
        </h2>
        <p className="text-slate-500 text-sm">
          Fermez votre période comptable, déchargez l'application et sauvegardez l'historique sur un fichier de sécurité externe. L'archivage ne touche pas aux bénéfices, soldes clients ou fournisseurs, ni vos stocks : seuls les historiques de mouvements sont nettoyés et sauvegardés localement.
        </p>
      </div>

      {progress && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 p-4 rounded-xl flex items-center gap-3">
          <Clock className="animate-spin" size={20} />
          <span className="font-medium text-sm">{progress.step}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 border border-rose-200 bg-rose-50/50 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 text-rose-100 rotate-12">
            <Download size={120} />
          </div>
          
          <div className="relative z-10 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-rose-900 flex items-center gap-2">
                Créer une Archive
              </h3>
              <p className="text-xs text-rose-700 mt-1">
                Téléchargez l'historique jusqu'à la date souhaitée.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-rose-800 uppercase tracking-widest">Date de clôture (incluse)</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full p-2.5 border border-rose-200 rounded-lg outline-none focus:ring-2 focus:ring-rose-500 bg-white" 
                />
              </div>

              <label className="flex items-center gap-2 bg-white border border-rose-200 p-3 rounded-lg cursor-pointer hover:bg-rose-50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={deleteAfterArchive} 
                  onChange={e => setDeleteAfterArchive(e.target.checked)}
                  className="w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500" 
                />
                <div className="text-sm">
                  <span className="font-bold text-slate-800 block">Vider l'historique de l'application</span>
                  <span className="text-xs text-slate-500 block">Supprime les transactions pour alléger l'application après les avoir sauvegardé.</span>
                </div>
              </label>

              <Button 
                onClick={handleArchive} 
                disabled={isArchiving || isRestoring || !endDate}
                className="w-full gap-2 bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-200 mt-2"
              >
                <Download size={18} />
                {isArchiving ? 'Archivage...' : 'Archiver et Télécharger'}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-emerald-200 bg-emerald-50/50 shadow-sm relative overflow-hidden">
           <div className="absolute -right-4 -bottom-4 text-emerald-100 -rotate-12">
            <Upload size={120} />
          </div>
          
          <div className="relative z-10 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-emerald-900 flex items-center gap-2">
                Restaurer une Archive
              </h3>
              <p className="text-xs text-emerald-700 mt-1">
                Remettre un fichier archivé dans l'historique complet en cours.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center border-2 border-dashed border-emerald-300 rounded-xl bg-white p-6 mt-4">
              <Upload className="text-emerald-400 mb-2" size={32} />
              <p className="text-sm font-medium text-emerald-800 mb-4 text-center">
                Sélectionnez le fichier d'archive JSON
              </p>
              
              <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg shadow-md transition-colors text-sm font-bold flex items-center gap-2">
                <Upload size={18} /> Parcourir...
                <input 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  onChange={handleRestore}
                  disabled={isArchiving || isRestoring}
                />
              </label>
            </div>
            
            <div className="bg-emerald-100 p-3 rounded-lg flex items-start gap-2">
               <Info size={16} className="text-emerald-700 mt-0.5 shrink-0" />
               <p className="text-xs text-emerald-800 font-medium">Les données restaurées n'altèrent pas vos soldes ou quantités actuelles, et vous permettront de refouiller vos statistiques pour analyser le passé.</p>
            </div>
          </div>
        </Card>
      </div>

      {statusMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className={`p-4 ${statusMessage.type === 'error' ? 'bg-rose-50 border-b border-rose-100' : statusMessage.type === 'success' ? 'bg-emerald-50 border-b border-emerald-100' : 'bg-indigo-50 border-b border-indigo-100'}`}>
              <h3 className={`text-lg font-bold flex items-center gap-2 ${statusMessage.type === 'error' ? 'text-rose-800' : statusMessage.type === 'success' ? 'text-emerald-800' : 'text-indigo-800'}`}>
                {statusMessage.type === 'error' && <ShieldAlert size={20} />}
                {statusMessage.type === 'success' && <CheckCircle size={20} />}
                {statusMessage.type === 'info' && <Info size={20} />}
                {statusMessage.title}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-sm">{statusMessage.message}</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <Button 
                onClick={() => setStatusMessage(null)}
                className="bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              >
                {statusMessage.confirmAction ? 'Annuler' : 'Fermer'}
              </Button>
              {statusMessage.confirmAction && (
                <Button 
                  onClick={() => {
                    const action = statusMessage.confirmAction;
                    setStatusMessage(null);
                    if (action) action();
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Confirmer
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
