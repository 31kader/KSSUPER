
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  User, 
  CreditCard, 
  Banknote,
  Package,
  Eye,
  Filter,
  RefreshCw,
  MoreVertical,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  MessageSquare,
  FileText,
  Activity,
  Check,
  LayoutGrid,
  Bell,
  Cpu,
  History,
  Zap,
  Timer
} from 'lucide-react';
import { supabase } from '../supabase';
import { Transaction, CompanySettings, UserProfile, AuditLog } from '../types';
import { cn, logAction } from '../lib/utils';
import { Card, Button } from './ui';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CameraPortalProps {
  settings: CompanySettings;
  user: UserProfile;
}

export function CameraPortal({ settings, user }: CameraPortalProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'suspicious' | 'pending' | 'anomaly'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentView, setCurrentView] = useState<'archive' | 'live'>('archive');
  const [timeSpent, setTimeSpent] = useState(0);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [activeAiZone, setActiveAiZone] = useState<string | null>(null);
  const [showImageMatch, setShowImageMatch] = useState(false);
  const [replayPosition, setReplayPosition] = useState(0);

  const sendMessageToCashier = async (message: string) => {
    if (!selectedTransaction || !selectedTransaction.employeeId) return;
    try {
      const newId = Math.random().toString(36).substring(2, 10);
      await supabase.from('cashier_alerts').insert({
        id: newId,
        employee_id: selectedTransaction.employeeId,
        message,
        type: 'discrete',
        timestamp: new Date().toISOString(),
        read: false,
        from: user.displayName
      });
      alert(`Alerte envoyée au caissier : "${message}"`);
    } catch (e) {
      console.error("Error sending alert:", e);
    }
  };

  // Timer for session
  useEffect(() => {
    let interval: any;
    if (selectedTransaction) {
      interval = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);
    } else {
      setTimeSpent(0);
    }
    return () => clearInterval(interval);
  }, [selectedTransaction]);

  // Live session mock (could be real-time cart drafts in production)
  useEffect(() => {
    if (currentView === 'live') {
      const fetchCartDrafts = async () => {
        const { data, error } = await supabase
          .from('cart_drafts')
          .select('*')
          .limit(10);
        
        if (error) {
          console.error("Error fetching cart drafts:", error);
          setLiveSessions([]);
        } else {
          setLiveSessions(data || []);
        }
      };
      
      fetchCartDrafts();
    }
  }, [currentView]);

  // Session stats
  const sessionStats = useMemo(() => {
    const sessionTxs = transactions.filter(tx => tx.auditedBy === user.displayName);
    return {
      total: sessionTxs.length,
      verified: sessionTxs.filter(tx => tx.auditStatus === 'verified').length,
      suspicious: sessionTxs.filter(tx => tx.auditStatus === 'suspicious').length,
    };
  }, [transactions, user.displayName]);

  useEffect(() => {
    // Listen to today's transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const fetchTransactions = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('timestamp', today.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        console.error("Error fetching transactions for camera portal:", error);
      } else {
        setTransactions(data || []);
      }
    };
    
    fetchTransactions();
    
    // For now, simpler than real-time subscription.
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Search filter
      const matchesSearch = 
        tx.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
        tx.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.customerName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || (tx.auditStatus || 'pending') === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchQuery, statusFilter]);

  const handleAudit = async (txId: string, status: 'verified' | 'suspicious') => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          auditStatus: status,
          auditedBy: user.displayName,
          auditedAt: new Date().toISOString(),
          auditDuration: timeSpent
        })
        .eq('id', txId);
      
      if (error) throw error;
      
      if (selectedTransaction?.id === txId) {
        setSelectedTransaction(prev => prev ? { ...prev, auditStatus: status, auditedBy: user.displayName, auditedAt: new Date().toISOString(), auditDuration: timeSpent } : null);
      }

      // If suspicious, create an audit log to alert manager
      if (status === 'suspicious') {
        await logAction(
          user.id!,
          user.displayName!,
          `SUSPICIOUS_TRANSACTION_REPORTED`,
          `CAMERA_AUDIT`,
          `Transaction ${txId} marked as suspicious by camera agent.`,
          'critical'
        );
      }
    } catch (error) {
      console.error("Error auditing transaction:", error);
    }
  };

  const callManager = async () => {
    if (!selectedTransaction) return;
    try {
      await logAction(
        user.id!,
        user.displayName!,
        `MANAGER_CALL_REQUEST`,
        `EMERGENCY_BIP`,
        `AGENT CAMERA ${user.displayName} demande une intervention urgente sur la vente ${selectedTransaction.id}.`,
        'critical'
      );
      alert("Manager appelé ! Son écran va vibrer.");
    } catch (e) {
      console.error("Error calling manager:", e);
    }
  };

  const handleAddNote = async (txId: string, note: string) => {
    try {
      await supabase
        .from('transactions')
        .update({
          auditNote: note
        })
        .eq('id', txId);
    } catch (error) {
      console.error("Error adding audit note:", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-nardo text-slate-100 overflow-hidden font-sans">
      {/* Control Header */}
      <header className="h-20 border-b border-white/5 bg-workspace/80 backdrop-blur-xl flex items-center justify-between px-8 shrink-0 z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-neon-indigo">
              <Camera size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">Nexus Guard <span className="text-indigo-400">Pro</span></h1>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Poste Audit: {user.displayName}</p>
              </div>
            </div>
          </div>
          
          <div className="h-10 w-px bg-white/5" />
          
          <div className="flex p-1 bg-black/40 rounded-2xl border border-white/5">
             <button 
                onClick={() => setCurrentView('archive')}
                className={cn(
                  "px-6 py-2 flex items-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  currentView === 'archive' ? "bg-white/10 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                )}
             >
                <History size={14} /> Archives
             </button>
             <button 
                onClick={() => setCurrentView('live')}
                className={cn(
                  "px-6 py-2 flex items-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  currentView === 'live' ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "text-slate-500 hover:text-slate-300"
                )}
             >
                <Zap size={14} /> Live
             </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {selectedTransaction && (
            <div className="flex items-center gap-4 px-6 py-2 bg-black/40 border border-white/5 rounded-2xl">
               <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Durée Session</span>
                  <span className="text-sm font-black text-white font-mono">{Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}</span>
               </div>
               <Timer size={20} className="text-indigo-500 animate-pulse" />
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Button 
               onClick={callManager}
               className="h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest border-b-4 border-rose-900 active:border-b-0 active:translate-y-1 transition-all px-6"
            >
              <Bell size={18} /> Alerte Manager
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Discovery & Search */}
        <div className="w-80 border-r border-white/5 flex flex-col h-full bg-workspace/50 backdrop-blur-md">
          <div className="p-6 border-b border-white/5 space-y-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="N° Vente, Caissier..." 
                className="w-full pl-10 pr-4 py-3 bg-black/20 border border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs transition-all placeholder:text-slate-600 font-bold"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex p-1 bg-black/20 rounded-xl border border-white/5 overflow-x-auto custom-scrollbar">
              {(['all', 'pending', 'verified', 'suspicious'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={cn(
                    "flex-1 px-2 py-2 text-[9px] font-black uppercase tracking-tight rounded-lg transition-all",
                    statusFilter === filter 
                      ? "bg-white/10 text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {filter === 'all' ? 'Tous' : 
                   filter === 'pending' ? 'Attente' : 
                   filter === 'verified' ? 'Fix' : 'Alert'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {currentView === 'live' ? (
               liveSessions.map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl relative overflow-hidden"
                  >
                    <div className="absolute top-2 right-2">
                       <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                       <User size={12} className="text-emerald-400" />
                       <span className="text-[10px] font-black text-white uppercase">{session.employeeName}</span>
                    </div>
                    <div className="space-y-1">
                       {session.items.slice(0, 2).map((it: any, i: number) => (
                          <div key={i} className="flex justify-between text-[9px] font-bold text-slate-400">
                             <span className="truncate">{it.name}</span>
                             <span className="text-emerald-500">×{it.quantity}</span>
                          </div>
                       ))}
                    </div>
                  </motion.div>
               ))
            ) : (
              filteredTransactions.map((tx) => (
                <motion.div
                  key={tx.id}
                  layout
                  onClick={() => setSelectedTransaction(tx)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer group relative",
                    selectedTransaction?.id === tx.id 
                      ? "bg-indigo-600/10 border-indigo-500/50" 
                      : "bg-black/10 border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter">#{tx.id.slice(-6).toUpperCase()}</span>
                    <span className="text-[9px] font-bold text-slate-500">{format(new Date(tx.timestamp), 'HH:mm')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-white">{tx.total.toFixed(2)} {settings.currency}</p>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{tx.employeeName}</p>
                    </div>
                    <div className={cn(
                       "w-2 h-2 rounded-full",
                       tx.auditStatus === 'verified' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                       tx.auditStatus === 'suspicious' ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" :
                       "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                    )} />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Main Feed Section */}
        <div className="flex-1 flex flex-col overflow-hidden bg-nardo">
           {selectedTransaction ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                 {/* Video Area */}
                 <div className="flex-1 p-8 overflow-hidden flex flex-col gap-6">
                    <div className="flex-1 relative rounded-[3rem] overflow-hidden bg-black border border-white/5 shadow-2xl group">
                       {/* Camera Feed Simulator */}
                       <div className="absolute inset-0 flex items-center justify-center">
                          <Activity className="text-indigo-500/20 animate-pulse" size={120} />
                       </div>
                       
                       {/* UI Overlays */}
                       <div className="absolute inset-0 pointer-events-none">
                          {/* Targeting Reticle */}
                          <div className={cn(
                             "absolute top-1/4 left-1/4 w-[40%] h-[40%] border-2 border-indigo-500/30 rounded-3xl transition-all duration-700",
                             activeAiZone ? "border-indigo-500/60 scale-105" : "scale-100"
                          )}>
                             <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-xl" />
                             <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-xl" />
                             <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-xl" />
                             <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-xl" />
                          </div>

                          {/* Data Corner Left */}
                          <div className="absolute top-8 left-8 flex items-center gap-4 bg-black/60 backdrop-blur-md p-4 rounded-3xl border border-white/10">
                              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white">
                                 <Camera size={24} />
                              </div>
                              <div>
                                 <p className="text-xs font-black text-white tracking-widest uppercase">Cam-01 / Sortie 1</p>
                                 <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] animate-pulse">Scanning Live</p>
                              </div>
                          </div>

                          {/* Data Corner Right */}
                          <div className="absolute top-8 right-8 flex flex-col items-end gap-2">
                              <div className="px-6 py-2 bg-rose-600/20 backdrop-blur-md border border-rose-500/30 text-rose-400 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                                 Alerte Zone Bas Chariot
                              </div>
                              <div className="px-6 py-2 bg-indigo-600/20 backdrop-blur-md border border-indigo-500/30 text-indigo-400 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                                 IA Trust: 94.2%
                              </div>
                          </div>
                       </div>

                       {/* Controls Overlay Bottom */}
                       <div className="absolute bottom-10 left-10 right-10 flex items-center justify-between z-10">
                          <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md p-2 rounded-2xl border border-white/5">
                             <button className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"><History size={18} /></button>
                             <div className="w-64 h-1.5 bg-white/10 rounded-full relative group/scrub cursor-pointer">
                                <div className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full" style={{ width: '60%' }} />
                                <div className="absolute top-1/2 left-[60%] -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover/scrub:opacity-100 transition-opacity" />
                             </div>
                             <span className="text-[10px] font-mono text-white/40">-12s</span>
                          </div>

                          <div className="flex items-center gap-4">
                             <Button 
                                onClick={() => handleAudit(selectedTransaction.id, 'verified')}
                                className={cn(
                                   "h-14 px-8 rounded-2xl flex items-center gap-3 font-black text-xs uppercase tracking-widest transition-all shadow-xl",
                                   selectedTransaction.auditStatus === 'verified' ? "bg-emerald-600 text-white" : "bg-white/10 hover:bg-white/20 text-white backdrop-blur-md"
                                )}
                             >
                                <ShieldCheck size={20} /> Valider
                             </Button>
                             <Button 
                                onClick={() => handleAudit(selectedTransaction.id, 'suspicious')}
                                className={cn(
                                   "h-14 px-8 rounded-2xl flex items-center gap-3 font-black text-xs uppercase tracking-widest transition-all shadow-xl",
                                   selectedTransaction.auditStatus === 'suspicious' ? "bg-rose-600 text-white" : "bg-white/10 hover:bg-white/20 text-white backdrop-blur-md"
                                )}
                             >
                                <ShieldAlert size={20} /> Signaler
                             </Button>
                          </div>
                       </div>
                    </div>

                    {/* Horizontal Items Reel */}
                    <div className="h-40 flex gap-6 mt-2 overflow-x-auto custom-scrollbar pb-4 pr-10">
                       {selectedTransaction.items.map((item, i) => (
                          <div key={i} className="flex-none w-72 bg-workspace border border-white/5 rounded-3xl p-4 flex items-center gap-4 hover:border-indigo-500/30 transition-all group">
                             <div className="w-16 h-16 bg-black/40 rounded-2xl flex items-center justify-center text-indigo-500 font-black text-xl border border-white/5 shadow-inner">
                                {i + 1}
                             </div>
                             <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-black text-white uppercase truncate tracking-tight">{item.name}</p>
                                <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Qte: {item.quantity}</p>
                                <div className="flex items-center gap-1">
                                   <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                                   </div>
                                   <ShieldCheck size={10} className="text-emerald-500" />
                                </div>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>

                 {/* Collapsible Action Bar Right */}
                 <div className="w-96 border-l border-white/5 bg-workspace/30 backdrop-blur-xl p-8 space-y-10 overflow-y-auto custom-scrollbar">
                    <section>
                       <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <MessageSquare size={14} className="text-indigo-400" /> Ordres Flash
                       </h3>
                       <div className="grid grid-cols-1 gap-2">
                          {[
                             "Vérifiez le bas du chariot",
                             "Article non scanné détecté",
                             "Ralentissez le scan",
                             "Alerte sécurité discrète"
                          ].map((msg, i) => (
                             <button 
                                key={i}
                                onClick={() => sendMessageToCashier(msg)}
                                className="w-full p-4 bg-black/20 border border-white/5 rounded-2xl text-left text-[11px] font-bold text-slate-300 hover:border-indigo-500/50 hover:bg-black/40 transition-all active:scale-[0.98]"
                             >
                                {msg}
                             </button>
                          ))}
                       </div>
                    </section>

                    <section>
                       <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <Cpu size={14} className="text-indigo-400" /> Analyse IA Matcher
                       </h3>
                       <div className="p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-[2rem] space-y-6">
                          <div className="flex gap-3">
                             <div className="flex-1 aspect-square bg-black rounded-2xl border border-white/10 flex items-center justify-center">
                                <Activity className="text-indigo-500/20" />
                             </div>
                             <div className="flex-1 aspect-square bg-black rounded-2xl border border-white/10 flex items-center justify-center">
                                <Package className="text-slate-800" />
                             </div>
                          </div>
                          <Button 
                             onClick={() => {
                                setAiAnalysisLoading(true);
                                setTimeout(() => setAiAnalysisLoading(false), 1000);
                             }}
                             className="w-full bg-indigo-600 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-neon-indigo"
                          >
                             {aiAnalysisLoading ? "Matching..." : "Lancer ID-Verify"}
                          </Button>
                       </div>
                    </section>

                    <section>
                       <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <FileText size={14} className="text-indigo-400" /> Notes Observation
                       </h3>
                       <textarea
                          placeholder="Compte-rendu d'audit..."
                          className="w-full h-32 p-4 bg-black/20 border border-white/5 rounded-2xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-700 resize-none font-medium"
                          value={selectedTransaction.auditNote || ''}
                          onChange={(e) => handleAddNote(selectedTransaction.id, e.target.value)}
                       />
                    </section>
                 </div>
              </div>
           ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-800">
                <div className="w-32 h-32 bg-workspace border border-white/5 rounded-[3rem] flex items-center justify-center mb-8 shadow-2xl">
                   <LayoutGrid size={48} className="opacity-10 text-indigo-500" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-[0.3em] text-white/20">Système en Veille</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mt-2">Sélectionnez une session pour monitoring</p>
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
