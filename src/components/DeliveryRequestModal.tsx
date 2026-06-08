import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Truck, X, User, Phone, MapPin, MessageSquare } from 'lucide-react';
import { Button } from './ui';
import { supabase } from '../supabase';
import { toast } from 'sonner';

export const DeliveryRequestModal = ({ isOpen, onClose, cartTotal }: { isOpen: boolean, onClose: () => void, cartTotal: number }) => {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRequesting(true);
    try {
      const newId = Math.random().toString(36).substring(2, 11);
      const { error } = await supabase.from('externalDeliveryRequests').insert({
        id: newId,
        customerName,
        phone,
        address,
        notes,
        total: cartTotal,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      if (error) throw error;
      toast.success("Demande de livraison envoyée !");
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Erreur d'envoi");
    } finally {
      setIsRequesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-800 tracking-tight">Commande Livreur</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Nom du client</label>
            <div className="relative">
              <input required value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-3 pl-10 bg-slate-50 border border-slate-100 rounded-xl" placeholder="Nom..." />
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Téléphone</label>
            <div className="relative">
              <input required value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 pl-10 bg-slate-50 border border-slate-100 rounded-xl" placeholder="05..." />
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Adresse</label>
            <div className="relative">
              <input required value={address} onChange={e => setAddress(e.target.value)} className="w-full p-3 pl-10 bg-slate-50 border border-slate-100 rounded-xl" placeholder="Adresse complète..." />
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Notes</label>
            <div className="relative">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 pl-10 bg-slate-50 border border-slate-100 rounded-xl" placeholder="Instructions..." />
              <MessageSquare className="absolute left-3 top-3 text-slate-300" size={16} />
            </div>
          </div>

          <Button type="submit" disabled={isRequesting} className="w-full py-4 bg-rose-600 shadow-lg shadow-rose-200">
            {isRequesting ? 'Envoi...' : 'Commander Livreur'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};
