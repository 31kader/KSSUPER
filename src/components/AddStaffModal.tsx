import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, UserPlus } from 'lucide-react';
import { Button } from './ui';
import { cn } from '../lib/utils';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, email: string, role: string, phone?: string, password?: string) => void;
}

export function AddStaffModal({ isOpen, onClose, onSave }: AddStaffModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('cashier');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 my-10"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <UserPlus size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Ajouter un membre</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Informations</label>
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-600">Nom complet *</span>
                <input 
                  type="text" 
                  placeholder="Ex: Ahmed Ben"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 font-medium transition-all"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-600">Téléphone (Identifiant)</span>
                <input 
                  type="tel" 
                  placeholder="05XXXXXXXX"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 font-medium transition-all"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Accès System</label>
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-600">Email Google (Optionnel)</span>
                <input 
                  type="email" 
                  placeholder="email@gmail.com"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 font-medium transition-all"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-600">Mot de Passe</span>
                <input 
                  type="password" 
                  placeholder="Minimum 6 caractères"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 font-medium transition-all"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rôle</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'cashier', label: 'Caissier' },
                { id: 'picker', label: 'Préparateur' },
                { id: 'delivery', label: 'Livreur' },
                { id: 'manager', label: 'Manager' }
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all border",
                    role === r.id ? "bg-indigo-600 border-indigo-600 text-white shadow-md" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button 
            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            onClick={() => onSave(name, email, role, phone, password)}
            disabled={!name || (!email && !phone)}
          >
            Ajouter
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
