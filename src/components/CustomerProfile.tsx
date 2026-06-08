import React, { useState } from 'react';
import { Customer } from '../types';
import { useTranslation } from '../translations';
import { Cake, Heart, Coffee, AlertTriangle, NotebookText, Plus } from 'lucide-react';
import { cn, formatSafe } from '../lib/utils';

interface CustomerProfileProps {
  customer: Customer;
  onAddNote: (note: string) => void;
}

export const CustomerProfile: React.FC<CustomerProfileProps> = ({ customer, onAddNote }) => {
  const { t, isRtl } = useTranslation();
  const [newNote, setNewNote] = useState('');

  return (
    <div className="bg-industrial-900 border border-industrial-800 rounded-3xl p-6 shadow-2xl space-y-6 text-right rtl:text-right" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-xl">
          {customer.name.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{customer.name}</h2>
          <p className="text-sm text-white/40">
            {t("Client depuis")}: {customer.joinDate || 'N/A'}
          </p>
        </div>
      </div>

      {customer.alerts && customer.alerts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={16} />
            <span className="font-bold text-xs uppercase tracking-widest">{t("Alertes")}</span>
          </div>
          <ul className="list-disc list-inside text-xs text-red-200/60">
            {customer.alerts.map((alert, i) => <li key={i}>{alert}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-industrial-800 p-4 rounded-2xl">
          <p className="text-[10px] text-white/40 uppercase mb-1">{t("Produits favoris")}</p>
          <div className="flex flex-wrap gap-2">
            {customer.favoriteItems?.map(item => (
              <span key={item} className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg text-xs font-bold">{item}</span>
            ))}
          </div>
        </div>
        <div className="bg-industrial-800 p-4 rounded-2xl">
          <p className="text-[10px] text-white/40 uppercase mb-1">{t("Anniversaire")}</p>
          <div className="flex items-center gap-2 text-white font-bold">
            <Cake size={16} className="text-amber-400" />
            5 {t("jours")}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-white flex items-center gap-2"><NotebookText size={16} /> {t("Notes caissier")}</h3>
          <button className="text-indigo-400 text-xs font-bold hover:underline" onClick={() => { onAddNote(newNote); setNewNote(''); }}>{t("Ajouter")}</button>
        </div>
        <div className="space-y-2">
          {customer.cashierNotes?.map((n, i) => (
            <div key={i} className="text-xs text-white/60 bg-white/5 p-3 rounded-lg">
              {n.note} <span className="text-white/20 ml-2">({n.author})</span>
            </div>
          ))}
          <input 
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder={t("Ajouter une note...")}
            className="w-full bg-industrial-800 p-3 rounded-lg text-sm text-white outline-none border border-industrial-700" 
          />
        </div>
      </div>
    </div>
  );
};
