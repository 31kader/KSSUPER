import React, { useState } from 'react';
import { Customer } from '../types';
import { Modal, Button } from './ui';
import { supabase } from '../supabase';

interface POSCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (c: Customer) => void;
}

export function POSCustomerModal({ isOpen, onClose, onCreated }: POSCustomerModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    loyaltyCardNumber: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    setIsSubmitting(true);
    try {
      const data = {
        ...formData,
        loyaltyPoints: 0,
        totalSpent: 0,
        updatedAt: new Date().toISOString()
      };
      const customerId = Math.random().toString(36).substring(2, 11);
      const { error } = await supabase.from('customers').insert({ id: customerId, ...data });
      if (error) throw error;
      onCreated({ id: customerId, ...data } as Customer);
      setFormData({ name: '', phone: '', email: '', loyaltyCardNumber: '', notes: '' });
    } catch (error: any) {
      console.error("Error creating customer:", error);
      alert("Erreur lors de la création du client: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouveau Client (POS)">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">Nom complet *</label>
          <input 
            required
            type="text"
            className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Téléphone</label>
            <input 
              type="tel"
              className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
            <input 
              type="email"
              className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">N° Carte Fidélité (facultatif)</label>
          <div className="relative">
            <input 
              type="text"
              className="w-full p-2 pr-24 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              value={formData.loyaltyCardNumber}
              onChange={e => setFormData({ ...formData, loyaltyCardNumber: e.target.value })}
            />
            <button
              type="button"
              onClick={() => {
                let digits = "";
                for(let i=0; i<12; i++) digits += Math.floor(Math.random() * 10).toString();
                let sum = 0;
                for(let i=0; i<12; i++) sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3);
                const checkDigit = (10 - (sum % 10)) % 10;
                setFormData({...formData, loyaltyCardNumber: digits + checkDigit});
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded"
            >
              Générer
            </button>
          </div>
        </div>
        <div className="pt-4">
          <Button type="submit" className="w-full py-3" disabled={isSubmitting}>
            {isSubmitting ? "Création..." : "Enregistrer et Sélectionner"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
