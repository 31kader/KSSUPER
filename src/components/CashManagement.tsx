import React, { useState, useMemo } from 'react';
import { 
  Plus, Wallet, AlertCircle, RefreshCw, Printer, 
  TrendingUp, Clock 
} from 'lucide-react';
import { 
  CashShift, Transaction, Expense, UserProfile as User, 
  CompanySettings 
} from '../types';
import { supabase } from '../supabase';
import { convertKeysToSnake } from '../database';
import { formatSafe } from '../lib/utils';
import { fr } from 'date-fns/locale';
import { Modal, Button, Card } from './ui';

interface CashManagementProps {
  activeShift: CashShift | null;
  shifts: CashShift[];
  transactions: Transaction[];
  expenses: Expense[];
  user: User;
  settings: CompanySettings;
}

export function CashManagement({ 
  activeShift, 
  shifts, 
  transactions, 
  expenses, 
  user, 
  settings 
}: CashManagementProps) {
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [initialCash, setInitialCash] = useState('');
  const [finalCash, setFinalCash] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const currentShiftStats = useMemo(() => {
    if (!activeShift) return null;
    const shiftTransactions = transactions.filter(t => 
      new Date(t.timestamp) >= new Date(activeShift.openedAt) && t.status !== 'returned'
    );
    const shiftExpenses = expenses.filter(e => 
      new Date(e.date) >= new Date(activeShift.openedAt)
    );

    const totalSales = shiftTransactions.reduce((sum, t) => sum + t.total, 0);
    const totalCashSales = shiftTransactions.filter(t => t.paymentMethod === 'cash').reduce((sum, t) => sum + t.total, 0);
    const totalCardSales = shiftTransactions.filter(t => t.paymentMethod === 'card').reduce((sum, t) => sum + t.total, 0);
    const totalExpenses = shiftExpenses.reduce((sum, e) => sum + e.amount, 0);
    const expectedCash = activeShift.initialCash + totalCashSales - totalExpenses;

    return { totalSales, totalCashSales, totalCardSales, totalExpenses, expectedCash };
  }, [activeShift, transactions, expenses]);

  const handleOpenShift = async () => {
    if (!initialCash || isProcessing) return;
    setIsProcessing(true);
    try {
      const newId = Math.random().toString(36).substring(2, 10);
      const newShift: CashShift = {
        id: newId,
        openedAt: new Date().toISOString(),
        openedBy: user.displayName || user.email || 'Unknown',
        initialCash: parseFloat(initialCash) || 0,
        status: 'open'
      };
      const { error } = await supabase.from('shifts').insert(convertKeysToSnake(newShift));
      if (error) throw error;
      setIsOpeningModalOpen(false);
      setInitialCash('');
    } catch (error: any) {
      alert("Erreur lors de l'ouverture de la caisse: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift || !finalCash || !currentShiftStats || isProcessing) return;
    setIsProcessing(true);
    try {
      const finalCashVal = parseFloat(finalCash) || 0;
      const updatedShift: Partial<CashShift> = {
        closedAt: new Date().toISOString(),
        closedBy: user.displayName || user.email || 'Unknown',
        finalCash: finalCashVal,
        expectedCash: currentShiftStats.expectedCash,
        totalSales: currentShiftStats.totalSales,
        totalCashSales: currentShiftStats.totalCashSales,
        totalCardSales: currentShiftStats.totalCardSales,
        totalExpenses: currentShiftStats.totalExpenses,
        status: 'closed',
        notes
      };
      
      const { error } = await supabase.from('shifts').update(convertKeysToSnake(updatedShift)).eq('id', activeShift.id);
      if (error) throw error;

      setIsClosingModalOpen(false);
      setFinalCash('');
      setNotes('');
      
      printZReport({ ...activeShift, ...updatedShift } as CashShift, settings);
    } catch (error: any) {
      alert("Erreur lors de la clôture de la caisse: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const printZReport = (shift: CashShift, settings: CompanySettings) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const diff = (shift.finalCash || 0) - (shift.expectedCash || 0);

    printWindow.document.write(`
      <html>
        <head>
          <title>Rapport Z - ${formatSafe(shift.closedAt, 'dd/MM/yyyy')}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin: 5px 0; }
            .total { font-weight: bold; font-size: 1.1em; }
            .footer { text-align: center; margin-top: 20px; font-size: 0.8em; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>RAPPORT Z</h2>
            <p>${settings.name}</p>
            <p>Session #${shift.id?.slice(-6).toUpperCase()}</p>
          </div>
          <div class="divider"></div>
          <div class="row"><span>Ouverture:</span> <span>${formatSafe(shift.openedAt, 'dd/MM HH:mm')}</span></div>
          <div class="row"><span>Fermeture:</span> <span>${formatSafe(shift.closedAt, 'dd/MM HH:mm')}</span></div>
          <div class="row"><span>Par:</span> <span>${shift.closedBy}</span></div>
          <div class="divider"></div>
          <div class="row"><span>Fonds initiaux:</span> <span>${shift.initialCash.toFixed(2)} ${settings.currency}</span></div>
          <div class="row"><span>Ventes Espèces:</span> <span>${shift.totalCashSales?.toFixed(2)} ${settings.currency}</span></div>
          <div class="row"><span>Dépenses:</span> <span>-${shift.totalExpenses?.toFixed(2)} ${settings.currency}</span></div>
          <div class="divider"></div>
          <div class="row total"><span>Attendu en caisse:</span> <span>${shift.expectedCash?.toFixed(2)} ${settings.currency}</span></div>
          <div class="row total"><span>Réel en caisse:</span> <span>${shift.finalCash?.toFixed(2)} ${settings.currency}</span></div>
          <div class="row" style="color: ${diff < 0 ? 'red' : 'green'}">
            <span>Écart:</span> <span>${diff.toFixed(2)} ${settings.currency}</span>
          </div>
          <div class="divider"></div>
          <div class="row"><span>Ventes Carte:</span> <span>${shift.totalCardSales?.toFixed(2)} ${settings.currency}</span></div>
          <div class="row total"><span>CHIFFRE D'AFFAIRES:</span> <span>${shift.totalSales?.toFixed(2)} ${settings.currency}</span></div>
          <div class="divider"></div>
          ${shift.notes ? `<p>Notes: ${shift.notes}</p>` : ''}
          <div class="footer">
            <p>Nexus POS - Logiciel de Caisse</p>
          </div>
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Gestion de Caisse</h3>
          <p className="text-sm text-slate-500">Suivi des sessions et clôtures journalières</p>
        </div>
        {!activeShift && (
          <Button onClick={() => setIsOpeningModalOpen(true)} className="flex items-center gap-2">
            <Plus size={18} /> Ouvrir la caisse
          </Button>
        )}
      </div>

      {activeShift ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <Wallet size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">Session Active</h4>
                  <p className="text-xs text-slate-500">Ouverte le {formatSafe(activeShift.openedAt, 'dd MMMM à HH:mm', { locale: fr })}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase">En cours</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fonds de départ</p>
                <p className="text-lg font-bold text-slate-800">{activeShift.initialCash.toFixed(2)} {settings.currency}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ventes Espèces</p>
                <p className="text-lg font-bold text-emerald-600">+{currentShiftStats?.totalCashSales.toFixed(2)} {settings.currency}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dépenses</p>
                <p className="text-lg font-bold text-rose-600">-{currentShiftStats?.totalExpenses.toFixed(2)} {settings.currency}</p>
              </div>
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Attendu en caisse</p>
                <p className="text-lg font-bold text-indigo-700">{currentShiftStats?.expectedCash.toFixed(2)} {settings.currency}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button onClick={() => setIsClosingModalOpen(true)} variant="secondary" className="bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100">
                Fermer la caisse (Rapport Z)
              </Button>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-500" />
              Performance Session
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Total Ventes</span>
                <span className="font-bold text-slate-800">{currentShiftStats?.totalSales.toFixed(2)} {settings.currency}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Paiements Carte</span>
                <span className="font-bold text-slate-800">{currentShiftStats?.totalCardSales.toFixed(2)} {settings.currency}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Paiements Espèces</span>
                <span className="font-bold text-slate-800">{currentShiftStats?.totalCashSales.toFixed(2)} {settings.currency}</span>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-12 border-dashed border-2 border-slate-200 bg-slate-50/50 text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
            <Wallet size={32} />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-800">Aucune session ouverte</h4>
            <p className="text-slate-500 max-w-xs mx-auto mt-1">
              Vous devez ouvrir une session de caisse pour commencer à vendre et suivre vos encaissements.
            </p>
          </div>
          <Button onClick={() => setIsOpeningModalOpen(true)}>
            Ouvrir la caisse maintenant
          </Button>
        </Card>
      )}

      <div className="space-y-4">
        <h4 className="font-bold text-slate-800">Historique des clôtures</h4>
        <Card className="overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Date</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Ouvert par</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Initial</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Final</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Écart</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">CA Total</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shifts.filter(s => s.status === 'closed').length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    Aucune session clôturée pour le moment.
                  </td>
                </tr>
              ) : shifts.filter(s => s.status === 'closed').map(shift => {
                const diff = (shift.finalCash || 0) - (shift.expectedCash || 0);
                return (
                  <tr key={shift.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="text-sm font-medium text-slate-800">
                        {formatSafe(shift.closedAt, 'dd/MM/yyyy')}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {formatSafe(shift.openedAt, 'HH:mm')} - {formatSafe(shift.closedAt, 'HH:mm')}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{shift.openedBy}</td>
                    <td className="p-4 text-sm text-slate-600">{shift.initialCash.toFixed(2)} {settings.currency}</td>
                    <td className="p-4 text-sm font-bold text-slate-800">{shift.finalCash?.toFixed(2)} {settings.currency}</td>
                    <td className="p-4">
                      <span className={`text-xs font-bold ${diff < 0 ? 'text-rose-600' : diff > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(2)} {settings.currency}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-bold text-indigo-600">{shift.totalSales?.toFixed(2)} {settings.currency}</td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => printZReport(shift, settings)}
                        className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                        title="Réimprimer le rapport"
                      >
                        <Printer size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <Modal isOpen={isOpeningModalOpen} onClose={() => setIsOpeningModalOpen(false)} title="Ouverture de Caisse">
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center gap-3">
            <AlertCircle className="text-indigo-600" size={20} />
            <p className="text-xs text-indigo-700">
              Veuillez compter le fond de caisse initial avant de commencer la session.
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Fond de caisse initial ({settings.currency})</label>
            <input 
              type="number"
              autoFocus
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-lg"
              placeholder="0.00"
              value={initialCash}
              onChange={e => setInitialCash(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && initialCash && handleOpenShift()}
            />
          </div>
          <Button onClick={handleOpenShift} className="w-full py-3" disabled={!initialCash || isProcessing}>
            {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : "Confirmer l'ouverture"}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={isClosingModalOpen} onClose={() => setIsClosingModalOpen(false)} title="Clôture de Caisse (Rapport Z)">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Attendu (Espèces)</p>
              <p className="text-sm font-bold text-slate-800">{currentShiftStats?.expectedCash.toFixed(2)} {settings.currency}</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
              <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Total Ventes</p>
              <p className="text-sm font-bold text-indigo-700">{currentShiftStats?.totalSales.toFixed(2)} {settings.currency}</p>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Montant réel compté ({settings.currency})</label>
            <input 
              type="number"
              autoFocus
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-lg"
              placeholder="0.00"
              value={finalCash}
              onChange={e => setFinalCash(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Notes de clôture (Optionnel)</label>
            <textarea 
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] text-sm"
              placeholder="Remarques éventuelles sur la session..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <Button onClick={handleCloseShift} className="w-full py-3 bg-rose-600 hover:bg-rose-700" disabled={!finalCash || isProcessing}>
            {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : "Confirmer la clôture & Imprimer"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
