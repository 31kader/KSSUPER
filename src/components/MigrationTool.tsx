
import React, { useState } from 'react';
import { 
  auth, db, collection, getDocs, 
  rtdb, ref, update, set, child
} from '../firebase';
import { Button, Card } from './ui';
import { Database, AlertTriangle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export const MigrationTool: React.FC = () => {
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState<{ current: string, done: string[] }>({ current: '', done: [] });
  const [stats, setStats] = useState<Record<string, number>>({});

  const currentUser = auth.currentUser;
  const isOwner = currentUser?.uid === 'FaQiBWkg8uTxZ2np7BQjDINTyQc2' || 
                 currentUser?.email === 'hrskader305@gmail.com' || 
                 currentUser?.email === 'hrskader305@gmail.com'.toLowerCase();

  if (!isOwner) return null;

  const collectionsToMigrate = [
    { source: 'settings/company', dest: 'settings/company', type: 'doc' },
    { source: 'products', dest: 'products', type: 'collection' },
    { source: 'customers', dest: 'customers', type: 'collection' },
    { source: 'categories', dest: 'categories', type: 'collection' },
    { source: 'brands', dest: 'brands', type: 'collection' },
    { source: 'transactions', dest: 'transactions', type: 'collection' },
    { source: 'employees', dest: 'employees', type: 'collection' },
    { source: 'users', dest: 'users', type: 'collection' },
    { source: 'onlineOrders', dest: 'onlineOrders', type: 'collection' },
    { source: 'shifts', dest: 'shifts', type: 'collection' },
    { source: 'attendance', dest: 'attendance', type: 'collection' },
    { source: 'purchaseOrders', dest: 'purchaseOrders', type: 'collection' },
    { source: 'returns', dest: 'returns', type: 'collection' },
    { source: 'expenses', dest: 'expenses', type: 'collection' },
    { source: 'supplierPayments', dest: 'supplierPayments', type: 'collection' },
    { source: 'supplierSyncs', dest: 'supplierSyncs', type: 'collection' },
    { source: 'damaged_items', dest: 'damaged_items', type: 'collection' },
    { source: 'stockAdjustments', dest: 'stockAdjustments', type: 'collection' },
    { source: 'purchases', dest: 'purchases', type: 'collection' },
    { source: 'promotions', dest: 'promotions', type: 'collection' },
    { source: 'vouchers', dest: 'vouchers', type: 'collection' },
    { source: 'invoicePatterns', dest: 'invoicePatterns', type: 'collection' }
  ];

  const handleMigration = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir migrer TOUTES les données de Firestore vers Realtime Database ? Cela écrasera les données existantes dans Realtime.")) {
      return;
    }

    setIsMigrating(true);
    const newStats: Record<string, number> = {};
    const completed: string[] = [];

    try {
      // Test RTDB connection first
      try {
        await set(ref(rtdb, 'migration_test'), { timestamp: Date.now(), user: auth.currentUser?.email });
        console.log("RTDB Connection Test Success");
      } catch (e: any) {
        throw new Error(`PERMISSION DENIED : ${e.message}. VOUS DEVEZ CONFIGURER LES RÈGLES DANS LA CONSOLE FIREBASE.`);
      }

      for (const item of collectionsToMigrate) {
        setProgress(prev => ({ ...prev, current: item.source }));
        
        let dataToMigrate: Record<string, any> = {};
        let count = 0;

        try {
          if (item.type === 'doc') {
            const settingsSnap = await getDocs(collection(db, 'settings'));
            settingsSnap.forEach(d => {
              dataToMigrate[`settings/${d.id}`] = d.data();
              count++;
            });
          } else {
            const snap = await getDocs(collection(db, item.source));
            snap.forEach(d => {
              dataToMigrate[`${item.dest}/${d.id}`] = d.data();
              count++;
            });
          }
        } catch (e: any) {
          console.warn(`Could not read Firestore collection ${item.source}:`, e.message);
          // Continue with next if one fails, but log it
          newStats[item.source + ' (FAILED READ)'] = 0;
          continue;
        }

        if (count > 0) {
          // Chunk updates to avoid RTDB payload limits
          const entries = Object.entries(dataToMigrate);
          const chunkSize = 500;
          for (let i = 0; i < entries.length; i += chunkSize) {
            const chunk = Object.fromEntries(entries.slice(i, i + chunkSize));
            await update(ref(rtdb), chunk);
          }
          newStats[item.source] = count;
        } else {
          newStats[item.source] = 0;
        }

        completed.push(item.source);
        setProgress(prev => ({ ...prev, done: [...completed] }));
        setStats({ ...newStats });
      }

      toast.success("Migration terminée avec succès !");
    } catch (error: any) {
      console.error("Migration failed with full object:", JSON.parse(JSON.stringify(error)));
      const details = error.code ? `Code: ${error.code}. ` : '';
      const isPermission = error.message.includes('PERMISSION') || error.message.includes('permission_denied') || error.message.includes('PERMISSION_DENIED');
      
      toast.error(
        <div className="flex flex-col gap-2">
          <p className="font-bold">Erreur de migration</p>
          <p className="text-xs">{details}{error.message}</p>
          {isPermission && (
            <div className="p-3 bg-slate-900 rounded-xl border border-white/10 text-[10px] mt-2 space-y-2">
              <p className="text-amber-400 font-black uppercase tracking-widest text-[8px]">Action Requise :</p>
              <p>Copiez le contenu du fichier <code className="text-indigo-400">database.rules.json</code> dans l'onglet <span className="text-white font-bold">Règles</span> de Realtime Database dans votre console Firebase.</p>
            </div>
          )}
        </div>, 
        { duration: 20000 }
      );
    } finally {
      setIsMigrating(false);
      setProgress(prev => ({ ...prev, current: '' }));
    }
  };

  return (
    <Card className="p-6 border-amber-500/20 bg-amber-500/5 backdrop-blur-xl">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
          <Database size={24} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-black text-white uppercase tracking-tight">Outil de Migration Critique</h3>
          <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
             <p className="text-[10px] text-red-400 font-bold leading-relaxed">
               <AlertTriangle size={12} className="inline mr-1" />
               <b>IMPORTANT :</b> Les règles de la base de données ne peuvent pas être synchronisées automatiquement. 
               Vous <b>DEVEZ</b> copier manuellement les règles du fichier <code className="text-white">database.rules.json</code> 
               dans l'onglet <b>Règles</b> de votre console Firebase Realtime Database avant de lancer la migration.
             </p>
          </div>
          <p className="text-xs text-white/60 font-medium mt-3 leading-relaxed">
            Cet outil va copier toutes vos données depuis l'ancienne base (Firestore) vers la nouvelle base ultra-rapide (Realtime Database). 
            Utilisez-le une seule fois pour récupérer vos produits et clients.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {isMigrating ? (
              <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 w-full">
                <Loader2 className="animate-spin text-indigo-400" size={18} />
                <div className="flex-1">
                   <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Migration en cours...</p>
                   <p className="text-xs font-bold text-white uppercase">{progress.current}</p>
                </div>
              </div>
            ) : (
              <Button 
                onClick={handleMigration}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase tracking-widest text-[10px] py-4 px-6 rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                Lancer la migration maintenant
                <ArrowRight size={16} />
              </Button>
            )}
          </div>

          {progress.done.length > 0 && (
            <div className="mt-6 space-y-2 max-h-48 overflow-y-auto no-scrollbar">
              <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-3">Rapport de transfert</p>
              {Object.entries(stats).map(([key, count]) => (
                <div key={key} className="flex items-center justify-between p-2 bg-slate-900/40 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span className="text-[10px] font-bold text-white/60 uppercase">{key}</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">{count} docs</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
