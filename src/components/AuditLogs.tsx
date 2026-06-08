import React, { useState } from 'react';
import { AuditLog, CompanySettings, Product, Transaction } from '../types';
import { Card, Modal, Button, ConfirmDialog } from './ui';
import { Search, FileSpreadsheet, Database, Pencil, Trash2, RotateCcw, Ban, Check, X, AlertTriangle } from 'lucide-react';
import { exportToExcel, exportToCSV, formatSafe } from '../lib/utils';
import { supabase } from '../supabase';

interface AuditLogsProps {
  logs: AuditLog[];
  settings: CompanySettings;
  products?: Product[];
  transactions?: Transaction[];
}

export function AuditLogs({ logs, settings, products = [], transactions = [] }: AuditLogsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');

  // Modal State for Editing Log
  const [editingLog, setEditingLog] = useState<AuditLog | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editAction, setEditAction] = useState('');
  const [editModule, setEditModule] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editSeverity, setEditSeverity] = useState<'info' | 'warning' | 'high' | 'critical'>('info');

  // Modal State for Deleting Log
  const [deletingLog, setDeletingLog] = useState<AuditLog | null>(null);

  // Modal State for Cancelling/Undoing Log Action
  const [cancellingLog, setCancellingLog] = useState<AuditLog | null>(null);
  const [undoTransactionDetails, setUndoTransactionDetails] = useState<Transaction | null>(null);
  const [shouldRestoreStock, setShouldRestoreStock] = useState(true);
  const [isProcessingUndo, setIsProcessingUndo] = useState(false);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesModule = moduleFilter === 'all' || log.module === moduleFilter;
    
    return matchesSearch && matchesModule;
  });

  const modules = Array.from(new Set(logs.map(l => l.module)));

  // Open Edit Modal
  const handleOpenEdit = (log: AuditLog) => {
    setEditingLog(log);
    setEditUserName(log.userName || '');
    setEditAction(log.action || '');
    setEditModule(log.module || '');
    setEditDetails(log.details || '');
    setEditSeverity(log.severity || 'info');
  };

  // Save edited log fields to Supabase
  const handleSaveEdit = async () => {
    if (!editingLog) return;
    try {
      const { error } = await supabase.from('audit_logs').update({
        user_name: editUserName,
        action: editAction,
        module: editModule,
        details: editDetails,
        severity: editSeverity,
        updated_at: new Date().toISOString()
      }).eq('id', editingLog.id);
      
      if (error) throw error;
      setEditingLog(null);
    } catch (e) {
      console.error("Failed to update audit log:", e);
    }
  };

  // Handle Log Deletion
  const handleDeleteConfirm = async () => {
    if (!deletingLog) return;
    try {
      const { error } = await supabase.from('audit_logs').delete().eq('id', deletingLog.id);
      if (error) throw error;
      setDeletingLog(null);
    } catch (e) {
      console.error("Failed to delete audit log:", e);
    }
  };

  // Detect and analyze matching transaction when undoing a log
  const handleOpenCancelUndo = (log: AuditLog) => {
    setCancellingLog(log);
    setUndoTransactionDetails(null);
    setShouldRestoreStock(true);

    // Try to find a transaction related to this action
    let foundTx: Transaction | null = null;

    // Check by details: POS Sale contains text like "Vente de 150.00" or similar
    // Let's also check if code can run a search matching total price or timestamp
    if (log.action.toLowerCase().includes('vente') || log.module.toLowerCase() === 'pos' || log.module.toLowerCase() === 'vente') {
      // Find transactions within +/- 15 minutes of the log timestamp
      const logTime = new Date(log.timestamp).getTime();
      
      // Look for first matching transaction with a similar total weight
      // Or just try to match closest time
      const candidates = transactions.filter(tx => {
        const txTime = new Date(tx.timestamp || (tx as any).date).getTime();
        const diffMinutes = Math.abs(txTime - logTime) / (60 * 1000);
        return diffMinutes < 30; // Closer than 30 minutes
      });

      if (candidates.length > 0) {
        // Find best match if price can be parsed from details
        const priceMatch = log.details.match(/\d+([.,]\d+)?/);
        if (priceMatch) {
          const expectedTotal = parseFloat(priceMatch[0].replace(',', '.'));
          const exactPriceMatch = candidates.find(tx => Math.abs(tx.total - expectedTotal) < 0.1);
          if (exactPriceMatch) {
            foundTx = exactPriceMatch;
          } else {
            foundTx = candidates[0];
          }
        } else {
          foundTx = candidates[0];
        }
      }
    }

    setUndoTransactionDetails(foundTx);
  };

  // Confirm undo / cancellation of action
  const handleConfirmCancelUndo = async () => {
    if (!cancellingLog) return;
    setIsProcessingUndo(true);

    try {
      const isCurrentlyCancelled = (cancellingLog as any).isCancelled;
      
      if (!isCurrentlyCancelled) {
        // 1. Mark the log itself as cancelled
        const { error: logError } = await supabase.from('audit_logs').update({
          is_cancelled: true,
          cancelled_at: new Date().toISOString(),
          details: `[ANNULÉ] ${cancellingLog.details}`
        }).eq('id', cancellingLog.id);
        if (logError) throw logError;

        // 2. Perform dervied physical rollback if selected
        if (undoTransactionDetails) {
          // Revert Transaction status to 'returned' or mark as cancelled
          const { error: txError } = await supabase.from('transactions').update({
            status: 'returned',
            audit_status: 'verified',
            audit_note: (undoTransactionDetails as any).notes || (undoTransactionDetails as any).auditNote
              ? `${(undoTransactionDetails as any).notes || (undoTransactionDetails as any).auditNote} (Annulé via journal d'audit)`
              : "Annulé via journal d'audit"
          }).eq('id', undoTransactionDetails.id);
          if (txError) throw txError;

          // Restore product quantity stock if request set
          if (shouldRestoreStock && undoTransactionDetails.items) {
            for (const item of undoTransactionDetails.items) {
              const matchedProd = products.find(p => p.id === item.id);
              if (matchedProd) {
                const currentStock = typeof matchedProd.stock === 'number' ? matchedProd.stock : 0;
                const newStock = currentStock + (item.quantity || 1);
                
                const { error: prodError } = await supabase.from('products').update({ stock: newStock }).eq('id', matchedProd.id);
                if (prodError) throw prodError;
              }
            }
          }
        }
      } else {
        // Restore/Un-cancel
        const { error: logError } = await supabase.from('audit_logs').update({
          is_cancelled: false,
          cancelled_at: null,
          details: cancellingLog.details.replace('[ANNULÉ] ', '')
        }).eq('id', cancellingLog.id);
        if (logError) throw logError;
        
        // Return transaction to active if possible
        if (undoTransactionDetails) {
          const { error: txError } = await supabase.from('transactions').update({
            status: 'completed'
          }).eq('id', undoTransactionDetails.id);
          if (txError) throw txError;

          // Decrease stock again
          if (shouldRestoreStock && undoTransactionDetails.items) {
            for (const item of undoTransactionDetails.items) {
              const matchedProd = products.find(p => p.id === item.id);
              if (matchedProd) {
                const currentStock = typeof matchedProd.stock === 'number' ? matchedProd.stock : 0;
                const newStock = Math.max(0, currentStock - (item.quantity || 1));
                const { error: prodError } = await supabase.from('products').update({ stock: newStock }).eq('id', matchedProd.id);
                if (prodError) throw prodError;
              }
            }
          }
        }
      }

      setCancellingLog(null);
    } catch (e: any) {
      console.error("Action cancellation failed:", e);
      alert("Erreur lors de l'annulation: " + e.message);
    } finally {
      setIsProcessingUndo(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-white tracking-tight uppercase">Journaux d'Audit</h3>
          <p className="text-sm text-industrial-500">Suivi des actions et de la sécurité</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportToExcel(logs, 'audit_logs')}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/20"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={() => exportToCSV(logs, 'audit_logs')}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-500/20"
          >
            <Database className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      <Card className="p-0 industrial-card overflow-hidden">
        <div className="p-6 bg-industrial-800/50 border-b border-industrial-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-industrial-500" size={18} />
              <input
                type="text"
                placeholder="RECHERCHER..."
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-industrial-700 bg-industrial-900 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="p-3 rounded-xl border border-industrial-700 bg-industrial-900 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono text-sm"
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
            >
              <option value="all">TOUS LES MODULES</option>
              {modules.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto text-[13px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-industrial-950 border-b border-industrial-800">
                <th className="p-4 text-[10px] font-black text-industrial-500 uppercase tracking-widest">Date / Statut</th>
                <th className="p-4 text-[10px] font-black text-industrial-500 uppercase tracking-widest">Utilisateur</th>
                <th className="p-4 text-[10px] font-black text-industrial-500 uppercase tracking-widest">Action</th>
                <th className="p-4 text-[10px] font-black text-industrial-500 uppercase tracking-widest">Module</th>
                <th className="p-4 text-[10px] font-black text-industrial-500 uppercase tracking-widest">Détails</th>
                <th className="p-4 text-[10px] font-black text-industrial-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800">
              {filteredLogs.map((log) => {
                const isCancelled = (log as any).isCancelled;
                return (
                  <tr key={log.id} className={`hover:bg-industrial-800/30 transition-colors ${isCancelled ? 'opacity-40 bg-rose-950/5' : ''}`}>
                    <td className="p-4 text-xs font-mono text-industrial-400">
                      <div>{formatSafe(log.timestamp, 'dd/MM/yyyy HH:mm:s')}</div>
                      {isCancelled && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-rose-500/20 text-rose-400 text-[8px] font-black rounded uppercase tracking-widest border border-rose-500/20">
                          ANNULÉ / ROLLBACK
                        </span>
                      )}
                    </td>
                    <td className={`p-4 font-black text-white ${isCancelled ? 'line-through decoration-rose-500' : ''}`}>
                      {log.userName}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                        isCancelled 
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 line-through' 
                          : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-bold text-industrial-500">
                      {log.module}
                    </td>
                    <td className={`p-4 text-sm text-industrial-400 max-w-xs truncate font-mono ${isCancelled ? 'line-through text-industrial-600' : ''}`}>
                      {log.details}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Undo / Cancel Action button */}
                        <button
                          onClick={() => handleOpenCancelUndo(log)}
                          title={isCancelled ? "Rétablir cette action" : "Annuler l'action"}
                          className={`p-1.5 rounded-lg transition-all ${
                            isCancelled 
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20' 
                              : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
                          }`}
                        >
                          <RotateCcw size={14} className={isCancelled ? "rotate-180" : ""} />
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEdit(log)}
                          title="Modifier les détails de la log"
                          className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all"
                        >
                          <Pencil size={14} />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => setDeletingLog(log)}
                          title="Supprimer définitivement l'entrée"
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-industrial-600 italic font-mono text-sm">
                    AUCUN JOURNAL D'AUDIT TROUVÉ.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL: Modifier le Log */}
      <Modal isOpen={!!editingLog} onClose={() => setEditingLog(null)} title="Modifier Entrée Journal">
        <div className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-1.5">Date original</label>
            <input 
              type="text" 
              disabled 
              value={editingLog ? formatSafe(editingLog.timestamp, 'dd/MM/yyyy HH:mm:s') : ''}
              className="w-full px-4 py-2.5 rounded-xl border border-industrial-700 bg-industrial-900/60 text-industrial-500 outline-none font-mono text-sm cursor-not-allowed" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-1.5">Utilisateur</label>
              <input 
                type="text" 
                value={editUserName}
                aria-label="Utilisateur"
                onChange={e => setEditUserName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-industrial-700 bg-industrial-900 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-semibold" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-1.5">Module</label>
              <input 
                type="text" 
                value={editModule}
                aria-label="Module"
                onChange={e => setEditModule(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-industrial-700 bg-industrial-900 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-semibold" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-1.5">Action</label>
            <input 
              type="text" 
              value={editAction}
              aria-label="Action"
              onChange={e => setEditAction(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-industrial-700 bg-industrial-900 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-semibold" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-1.5 font-mono">Détails</label>
            <textarea 
              rows={3}
              value={editDetails}
              aria-label="Détails"
              onChange={e => setEditDetails(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-industrial-700 bg-industrial-900 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-mono" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-1.5">Sévérité / Importance</label>
            <select
              value={editSeverity}
              aria-label="Sévérité"
              onChange={e => setEditSeverity(e.target.value as any)}
              className="w-full p-2.5 rounded-xl border border-industrial-700 bg-industrial-900 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
            >
              <option value="info">INFO</option>
              <option value="warning">WARNING</option>
              <option value="high">HIGH / ÉLEVÉ</option>
              <option value="critical">CRITICAL / CRITIQUE</option>
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button onClick={() => setEditingLog(null)} variant="secondary">Annuler</Button>
            <Button onClick={handleSaveEdit} variant="primary">Enregistrer</Button>
          </div>
        </div>
      </Modal>

      {/* CONFIRM: Deleting Log */}
      <ConfirmDialog 
        isOpen={!!deletingLog} 
        onClose={() => setDeletingLog(null)} 
        onConfirm={handleDeleteConfirm}
        title="Supprimer Entrée Journal"
        message={`Voulez-vous vraiment supprimer définitivement cet enregistrement du journal d'audit de ${deletingLog?.userName} (${deletingLog?.action}) ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Conserver"
        variant="danger"
      />

      {/* MODAL: Cancel / Undo / Revert Action */}
      <Modal 
        isOpen={!!cancellingLog} 
        onClose={() => setCancellingLog(null)} 
        title={cancellingLog && (cancellingLog as any).isCancelled ? "Restaurer l'action" : "Annuler l'action"}
      >
        <div className="space-y-6 text-left">
          <div className="flex items-start gap-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="text-sm font-black text-amber-500 uppercase tracking-wider">
                {cancellingLog && (cancellingLog as any).isCancelled ? "Restaurer cette opération" : "Confirmer l'annulation de l'opération"}
              </h4>
              <p className="text-xs text-industrial-400 mt-1">
                Le système va tenter de marquer cette ligne comme annulée et d'automatiser le rollback associé si la transaction d'origine est identifiée.
              </p>
            </div>
          </div>

          <div className="font-mono bg-industrial-950 p-4 rounded-xl border border-industrial-800 text-xs text-industrial-400 space-y-1">
            <p><span className="font-black text-white">Utilisateur:</span> {cancellingLog?.userName}</p>
            <p><span className="font-black text-white">Action:</span> {cancellingLog?.action}</p>
            <p><span className="font-black text-white">Date:</span> {cancellingLog ? formatSafe(cancellingLog.timestamp, 'dd/MM/yyyy HH:mm:s') : ''}</p>
            <p className="border-t border-industrial-800 pt-1.5 mt-1.5">
              <span className="font-black text-white">Détails:</span> {cancellingLog?.details}
            </p>
          </div>

          {/* If the system found a related transaction, show details of rollback option */}
          {undoTransactionDetails ? (
            <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  Transaction Associée Trouvée
                </span>
                <span className="font-mono text-xs font-black text-white">#{undoTransactionDetails.id.slice(-8).toUpperCase()}</span>
              </div>
              <p className="text-xs text-industrial-400">
                Une transaction de <strong className="text-white">{undoTransactionDetails.total.toFixed(2)} {settings.currency}</strong> émise le {formatSafe(undoTransactionDetails.timestamp || (undoTransactionDetails as any).date, 'dd/MM/yyyy HH:mm')} correspond à cette action.
              </p>

              <div className="border-t border-indigo-500/10 pt-3 flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="restore-stock"
                  checked={shouldRestoreStock}
                  onChange={e => setShouldRestoreStock(e.target.checked)}
                  className="w-4 h-4 rounded border-industrial-700 bg-industrial-900 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                />
                <label htmlFor="restore-stock" className="text-xs text-industrial-300 font-semibold cursor-pointer select-none">
                  {cancellingLog && (cancellingLog as any).isCancelled 
                    ? "Soustraire à nouveau les stocks d'articles vendus"
                    : "Restaurer automatiquement les stocks des articles vendus"
                  }
                </label>
              </div>

              <div className="text-[10px] text-industrial-500 leading-relaxed italic">
                {cancellingLog && (cancellingLog as any).isCancelled
                  ? "Note: La transaction sera réactivée et marquée comme finalisée."
                  : "Note: La transaction sera automatiquement mise en statut \"Retournée/Remboursée\" dans votre base."
                }
              </div>
            </div>
          ) : (
            <div className="p-4 bg-industrial-900 text-industrial-500 rounded-2xl border border-industrial-800 text-xs italic">
              Aucune transaction POS correspondante trouvée automatiquement. L'annulation marquera simplement l'événement comme "ANNULÉ" visuellement sans restaurer de stock physique.
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4">
            <Button onClick={() => setCancellingLog(null)} variant="secondary" disabled={isProcessingUndo}>
              Conserver Tel Quel
            </Button>
            <Button 
              onClick={handleConfirmCancelUndo} 
              variant={cancellingLog && (cancellingLog as any).isCancelled ? "success" : "danger"}
              disabled={isProcessingUndo}
            >
              {isProcessingUndo ? "Traitement..." : cancellingLog && (cancellingLog as any).isCancelled ? "Rétablir Opération" : "Annuler Opération"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
