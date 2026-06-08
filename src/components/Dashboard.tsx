import React, { useMemo, memo } from 'react';
import { motion } from 'motion/react';
import { 
  DollarSign, ShoppingBag, AlertCircle, CreditCard, Banknote, TrendingUp, TrendingDown, Smartphone, Zap 
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { Transaction, Product, CompanySettings } from '../types';
import { Card, Button } from './ui';
import { formatSafe, cn } from '../lib/utils';
import { useTranslation } from '../translations';

export function StatCard({ icon, label, value, trend, color }: { 
  icon: React.ReactNode, 
  label: string, 
  value: string | number, 
  trend: string, 
  color: 'emerald' | 'indigo' | 'rose' 
}) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400",
    indigo: "bg-indigo-500/10 text-indigo-400",
    rose: "bg-rose-500/10 text-rose-400"
  };
  return (
    <Card className="p-4 sm:p-6 flex items-center gap-4 sm:gap-6 bg-white/5 backdrop-blur-md border-white/10 shadow-2xl rounded-[2rem] hover:bg-white/10 transition-all group overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-500 opacity-20 group-hover:opacity-100 transition-opacity"></div>
      <div className={cn(
        "w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 shadow-lg",
        colors[color]
      )}>
        {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<any>, { 
          size: 24, 
          strokeWidth: 2.5,
          className: cn((icon as any).props?.className, "text-current")
        })}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] sm:text-[11px] text-white/40 font-black uppercase tracking-[0.2em]">{label}</p>
        <h4 className="text-xl sm:text-3xl font-black text-white mt-1 truncate font-mono tracking-tighter">{value}</h4>
        <div className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-black mt-1.5 shadow-sm border",
          trend.includes('+') ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : color === 'rose' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        )}>
          {trend.includes('+') ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend}
        </div>
      </div>
    </Card>
  );
}

export const Dashboard = memo(function Dashboard({ transactions, products, settings, isStandalone, deferredPrompt, handleInstallApp }: { 
  transactions: Transaction[], 
  products: Product[], 
  settings: CompanySettings,
  isStandalone?: boolean,
  deferredPrompt?: any,
  handleInstallApp?: () => void
}) {
  const { t } = useTranslation();
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let dailyRevenue = 0;
    let totalRevenue = 0;
    
    // Map for last 7 days
    const last7DaysMap: Record<string, number> = {};
    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      last7DaysMap[dayStr] = 0;
      return { dayStr, date: format(d, 'dd MMM', { locale: fr }) };
    });

    transactions.forEach((t: any) => {
      if (t.status === 'returned' || !t.timestamp) return;
      
      totalRevenue += t.total;
      const dateStr = t.timestamp.split('T')[0];
      if (dateStr === today) {
        dailyRevenue += t.total;
      }
      if (dateStr in last7DaysMap) {
        last7DaysMap[dateStr] += t.total;
      }
    });

    const chartData = days.map(d => ({
      date: d.date,
      total: last7DaysMap[d.dayStr]
    })).reverse();

    const lowStock = products.filter((p: any) => p.stock < 10).length;
    return { dailyRevenue, totalRevenue, lowStock, chartData };
  }, [transactions, products]);

  return (
    <div className="space-y-8">
      {/* PWA Installation Banner */}
      {!isStandalone && deferredPrompt && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform">
            <Smartphone size={120} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-wider">{t("Installer Nexus POS Pro")}</h3>
              <p className="text-white/80 text-sm mt-1 max-w-md">
                {t("Profitez d'une expérience fluide, rapide et accessible même sans connexion internet en installant l'application sur votre appareil.")}
              </p>
            </div>
            <Button 
              onClick={handleInstallApp}
              className="bg-white text-indigo-600 hover:bg-indigo-50 font-black px-8 py-4 rounded-2xl shadow-xl shadow-black/20 flex items-center gap-2"
            >
              <Zap size={18} fill="currentColor" />
              {t("Installer maintenant")}
            </Button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: <DollarSign />, label: t("Revenu du jour"), value: `${stats.dailyRevenue.toFixed(2)} ${settings.currency}`, trend: "+12.5%", color: "emerald" as const },
          { icon: <ShoppingBag />, label: t("Ventes totales"), value: transactions.length, trend: "+5.2%", color: "indigo" as const },
          { icon: <AlertCircle />, label: t("Alertes stock"), value: stats.lowStock, trend: stats.lowStock > 0 ? t("Action requise") : t("Tout est nominal"), color: "rose" as const }
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-8 bg-white/5 backdrop-blur-md border-white/10 shadow-2xl rounded-[2rem] overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-[11px] text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,1)]" />
              {t("Performance hebdomadaire")}
            </h3>
            <div className="flex gap-2">
               <div className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-white/40 uppercase tracking-widest border border-white/5">{t("Auto-update")}</div>
            </div>
          </div>
          <div className="h-[300px] w-full relative min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={300} debounce={50}>
              <LineChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.2)', fontWeight: '900', letterSpacing: '0.1em' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.2)', fontWeight: '900' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(10, 10, 15, 0.95)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(12px)' }}
                  itemStyle={{ color: '#818cf8', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}
                  labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}
                  cursor={{ stroke: 'rgba(99,102,241,0.2)', strokeWidth: 2 }}
                />
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Line type="monotone" dataKey="total" stroke="#818cf8" strokeWidth={5} dot={{ r: 0 }} activeDot={{ r: 6, fill: '#fff', stroke: '#818cf8', strokeWidth: 3 }} animationDuration={2000} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-8 bg-white/5 backdrop-blur-md border-white/10 shadow-2xl rounded-[2rem]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-[11px] text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)]" />
              {t("Transactions Récentes")}
            </h3>
            <button className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors">{t("Actualiser")}</button>
          </div>
          <div className="space-y-4">
            {transactions.slice(0, 5).map((tx: Transaction, idx: number) => (
              <motion.div 
                key={tx.id || `recent-t-${idx}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + (idx * 0.05), duration: 0.5 }}
                className="flex items-center justify-between p-4 hover:bg-white/5 rounded-3xl transition-all border border-transparent hover:border-white/5 group relative overflow-hidden"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-lg border border-white/5",
                    tx.paymentMethod === 'card' ? "bg-indigo-500/10 text-indigo-400" : "bg-emerald-500/10 text-emerald-400"
                  )}>
                    {tx.paymentMethod === 'card' ? <CreditCard size={20} /> : <Banknote size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <p className="text-sm font-bold text-white">#{(tx.id || '').slice(-6).toUpperCase() || 'POS-X'}</p>
                       {tx.status === 'returned' && <span className="text-[8px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-lg border border-rose-500/20 font-black uppercase tracking-widest">{t("Retourné")}</span>}
                       {tx.status === 'partially_returned' && <span className="text-[8px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-lg border border-amber-500/20 font-black uppercase tracking-widest">{t("Partiel")}</span>}
                    </div>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-1 font-mono">{formatSafe(tx.timestamp, 'HH:mm:ss')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-black text-white font-mono tracking-tighter">{tx.total.toFixed(2)} <span className="text-[10px] text-white/40 opacity-60 ml-0.5">{settings.currency}</span></p>
                  <p className="text-[9px] font-black text-indigo-400/60 uppercase tracking-widest mt-0.5">{tx.paymentMethod}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <Button variant="ghost" className="w-full mt-8 text-[11px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white hover:bg-white/5 py-4 rounded-2xl h-auto border border-white/5">{t("Voir tout l'historique")}</Button>
        </Card>
      </div>
    </div>
  );
});
