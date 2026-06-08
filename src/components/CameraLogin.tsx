import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Camera, ArrowLeft } from 'lucide-react';
import { supabase } from '../supabase';
import { Button } from './ui';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import bcrypt from 'bcryptjs';

export function CameraLogin({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      // Search for any user by email
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', cleanEmail);
      
      if (error || !users || users.length === 0) {
        setError("Identifiants incorrects ou vous n'êtes pas autorisé à accéder à ce portail.");
        setIsLoggingIn(false);
        return;
      }
      
      const userData = users.find(u => u.role === 'camera_agent');

      if (!userData) {
        setError("Identifiants incorrects ou vous n'êtes pas autorisé à accéder à ce portail.");
        setIsLoggingIn(false);
        return;
      }

      if (!userData.password) {
        setError('Aucun mot de passe défini pour ce compte.');
        setIsLoggingIn(false);
        return;
      }

      const isMatch = bcrypt.compareSync(password, userData.password);
      if (isMatch) {
        onLogin(userData);
      } else {
        setError('Mot de passe incorrect.');
      }
    } catch (err) {
      console.error('Camera Login error:', err);
      setError('Une erreur est survenue lors de la connexion.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#0f172a] p-8 rounded-3xl shadow-2xl border border-slate-800 w-full max-w-md relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500"></div>
        
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/20 transform rotate-3">
            <Camera size={40} />
          </div>
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Live Audit</h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2">Portail Agent de Surveillance</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Professionnel</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
              <input 
                type="email" 
                required
                className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-white transition-all placeholder:text-slate-700"
                placeholder="agent@nexus.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mot de Passe</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
              <input 
                type={showPassword ? "text" : "password"} 
                required
                className="w-full pl-12 pr-12 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-white transition-all placeholder:text-slate-700 font-mono"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div 
               initial={{ opacity: 0, x: -10 }}
               animate={{ opacity: 1, x: 0 }}
               className="bg-rose-500/10 text-rose-400 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 border border-rose-500/20"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}

          <Button 
            type="submit" 
            className="w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/10 bg-indigo-600 hover:bg-indigo-500"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? "Authentification..." : "Accéder à la Caméra"}
          </Button>

          <div className="pt-6 border-t border-slate-800/50 text-center">
            <button 
              type="button"
              onClick={() => window.location.href = window.location.pathname}
              className="text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              <ArrowLeft size={14} />
              Retour au point de vente
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
