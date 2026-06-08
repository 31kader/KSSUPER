import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  ArrowRight, 
  Trash2, 
  Tag, 
  TrendingDown,
  CalendarDays,
  LayoutList,
  ChevronLeft,
  ChevronRight,
  Info,
  Percent,
  History,
  FileDown,
  Edit2,
  RefreshCcw,
  Printer
} from 'lucide-react';
import { 
  format, 
  addDays, 
  isBefore, 
  isAfter, 
  startOfDay, 
  endOfDay, 
  parseISO, 
  isSameDay, 
  differenceInDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  subDays
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Product, Category } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface ExpiryManagerProps {
  products: Product[];
  categories: Category[];
  onUpdateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  onAdjustStock: (product: Product) => void;
  onEditProduct: (product: Product) => void;
}

export function ExpiryManager({ products, categories, onUpdateProduct, onAdjustStock, onEditProduct }: ExpiryManagerProps) {
  const [view, setView] = useState<'list' | 'calendar' | 'analytics'>('list');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'expired' | 'critical' | 'warning'>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const now = startOfDay(new Date());

  const handleExportCSV = () => {
    const headers = [
      'SKU/Code-barre',
      'Produit',
      'Date de peremption',
      'No de Lot / Batch',
      'Jours restants',
      'Statut',
      'Stock',
      'Unite',
      'Prix de Vente (CFA)',
      'Prix d Purchase (CFA)',
      'Valeur de Vente a risque (CFA)',
      'Cout d Purchase a risque (CFA)'
    ];

    const rows = analyzedProducts.map(p => [
      p.sku || '',
      p.name,
      p.expirationDate ? format(p.expiryDate, 'yyyy-MM-dd') : '',
      p.batchNumber || '',
      p.daysLeft,
      p.expiryStatus === 'expired' ? 'Expire' : p.expiryStatus === 'critical' ? 'Critique' : p.expiryStatus === 'warning' ? 'A surveiller' : 'Normal',
      p.stock,
      p.unit || '',
      p.price,
      p.costPrice || 0,
      p.stock * p.price,
      p.stock * (p.costPrice || 0)
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.map(val => typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val).join(';'))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rapport_peremption_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Rapport d'expiration CSV exporté !");
  };

  const handlePrintPDF = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow || iframe.contentDocument;
    if (!doc) return;
    
    const iframeDoc = (doc as any).document || doc;

    const itemsHtml = analyzedProducts.map(p => {
      const valueAtRisk = p.stock * p.price;
      const statusLabel = p.expiryStatus === 'expired' ? 'EXPIRÉ' : p.expiryStatus === 'critical' ? 'CRITIQUE (<7j)' : 'ATTENTION (<30j)';
      const statusColor = p.expiryStatus === 'expired' ? '#e11d48' : p.expiryStatus === 'critical' ? '#d97706' : '#2563eb';
      
      return `
        <tr style="border-bottom: 1px solid #efefef;">
          <td style="padding: 10px 8px; font-size: 11px;">
            <span style="font-weight: bold; color: #111;">${p.name}</span>
            <div style="font-size: 9px; color: #888; font-family: monospace;">SKU: ${p.sku || '---'}</div>
          </td>
          <td style="padding: 10px 8px; font-size: 11px; text-align: center; font-family: monospace;">${p.batchNumber || '---'}</td>
          <td style="padding: 10px 8px; font-size: 11px; text-align: center; font-weight: bold; color: ${statusColor};">${p.expirationDate ? format(p.expiryDate, 'dd/MM/yyyy') : '---'}</td>
          <td style="padding: 10px 8px; font-size: 11px; text-align: center; font-weight: bold; color: ${p.daysLeft < 0 ? '#e11d48' : '#333'}">${p.daysLeft < 0 ? 'Expiré' : `${p.daysLeft}j`}</td>
          <td style="padding: 10px 8px; font-size: 11px; text-align: center;">${p.stock} ${p.unit}</td>
          <td style="padding: 10px 8px; font-size: 11px; text-align: right; font-family: monospace;">${p.price.toLocaleString()} CFA</td>
          <td style="padding: 10px 8px; font-size: 11px; text-align: right; font-weight: bold; font-family: monospace;">${valueAtRisk.toLocaleString()} CFA</td>
        </tr>
      `;
    }).join('');

    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <title>Rapport de Péremption</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #333;
              background: white;
              padding: 0;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div style="max-width: 800px; margin: 0 auto; padding: 10px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 15px; margin-bottom: 20px; align-items: flex-end;">
               <div>
                  <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; color: #111; font-weight: 900; letter-spacing: 1px;">RAPPORT DE PÉREMPTION</h1>
                  <p style="margin: 4px 0 0 0; color: #666; font-size: 10px; letter-spacing: 0.5px; font-weight: bold;">Édité le ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
               </div>
               <div style="text-align: right;">
                  <div style="font-weight: 900; font-size: 15px; text-transform: uppercase; color: #111;">NEXUS POS PRO</div>
                  <div style="font-size: 10px; color: #555; margin-top: 2px;">Rapport de Suivi des Dates Limites</div>
               </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 25px;">
              <div style="background-color: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 10px; text-align: center;">
                <div style="font-size: 8px; font-weight: 850; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">PRODUITS EXPIRÉS</div>
                <div style="font-size: 18px; font-weight: 900; color: #e11d48; margin-top: 3px;">${stats.expiredCount}</div>
              </div>
              <div style="background-color: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 10px; text-align: center;">
                <div style="font-size: 8px; font-weight: 850; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">CRITIQUES (7j)</div>
                <div style="font-size: 18px; font-weight: 900; color: #d97706; margin-top: 3px;">${stats.criticalCount}</div>
              </div>
              <div style="background-color: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 10px; text-align: center;">
                <div style="font-size: 8px; font-weight: 850; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">PV À RISQUE</div>
                <div style="font-size: 16px; font-weight: 900; color: #111; margin-top: 3px;">${stats.valueAtRisk.toLocaleString()} CFA</div>
              </div>
              <div style="background-color: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 10px; text-align: center;">
                <div style="font-size: 8px; font-weight: 850; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">COÛT À RISQUE</div>
                <div style="font-size: 16px; font-weight: 900; color: #111; margin-top: 3px;">${stats.costAtRisk.toLocaleString()} CFA</div>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
               <thead>
                  <tr style="background-color: #111; color: white;">
                     <th style="padding: 10px 8px; font-size: 10px; text-transform: uppercase; text-align: left; font-weight: 900; letter-spacing: 0.5px; width: 33%;">Article</th>
                     <th style="padding: 10px 8px; font-size: 10px; text-transform: uppercase; text-align: center; font-weight: 900; letter-spacing: 0.5px; width: 12%;">N° de Lot</th>
                     <th style="padding: 10px 8px; font-size: 10px; text-transform: uppercase; text-align: center; font-weight: 900; letter-spacing: 0.5px; width: 15%;">DLC / DLUO</th>
                     <th style="padding: 10px 8px; font-size: 10px; text-transform: uppercase; text-align: center; font-weight: 900; letter-spacing: 0.5px; width: 10%;">Jours restants</th>
                     <th style="padding: 10px 8px; font-size: 10px; text-transform: uppercase; text-align: center; font-weight: 900; letter-spacing: 0.5px; width: 10%;">Stock</th>
                     <th style="padding: 10px 8px; font-size: 10px; text-transform: uppercase; text-align: right; font-weight: 900; letter-spacing: 0.5px; width: 10%;">Prix Unitaire</th>
                     <th style="padding: 10px 8px; font-size: 10px; text-transform: uppercase; text-align: right; font-weight: 900; letter-spacing: 0.5px; width: 10%;">Valeur total</th>
                  </tr>
               </thead>
               <tbody>
                  ${itemsHtml}
               </tbody>
            </table>

            <div style="margin-top: 40px; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
               <div style="font-size: 9px; color: #aaa;">Nexus POS Pro - Système de traçabilité des péremptions</div>
            </div>
          </div>
          <script>
            window.onload = () => {
              try {
                window.focus();
                window.print();
              } catch (e) {
                console.error("Print failed:", e);
              }
            };
          </script>
        </body>
      </html>
    `);
    iframeDoc.close();
    
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 15000);
  };

  // Logic for analyzing expiry
  const analyzedProducts = useMemo(() => {
    return products
      .filter(p => p.expirationDate)
      .map(p => {
        const expiryDate = startOfDay(parseISO(p.expirationDate!));
        const daysLeft = differenceInDays(expiryDate, now);
        
        let expiryStatus: 'expired' | 'critical' | 'warning' | 'safe' = 'safe';
        if (daysLeft < 0) expiryStatus = 'expired';
        else if (daysLeft <= 7) expiryStatus = 'critical';
        else if (daysLeft <= 30) expiryStatus = 'warning';

        return { ...p, daysLeft, expiryStatus, expiryDate };
      })
      .filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                             p.sku?.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
        const matchesStatus = filterStatus === 'all' || p.expiryStatus === filterStatus;
        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [products, search, selectedCategory, filterStatus, now]);

  const stats = useMemo(() => {
    const expiredCount = analyzedProducts.filter(p => p.expiryStatus === 'expired').length;
    const criticalCount = analyzedProducts.filter(p => p.expiryStatus === 'critical').length;
    const valueAtRisk = analyzedProducts
      .filter(p => p.expiryStatus !== 'safe')
      .reduce((sum, p) => sum + (Number(p.price) * Number(p.stock)), 0);
    
    const costAtRisk = analyzedProducts
      .filter(p => p.expiryStatus !== 'safe')
      .reduce((sum, p) => sum + (Number(p.costPrice || 0) * Number(p.stock)), 0);
    
    return { expiredCount, criticalCount, valueAtRisk, costAtRisk };
  }, [analyzedProducts]);

  // Calendar Logic
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handleApplyPromo = async (product: any, percent: number) => {
    const oldPrice = product.price;
    try {
      const discount = percent / 100;
      const newPrice = Math.round(Number(product.price) * (1 - discount));
      
      // Store original price if not already stored
      const updates: any = { price: newPrice };
      if (!product.originalPrice) {
        updates.originalPrice = oldPrice;
      }
      
      await onUpdateProduct(product.id, updates);
      toast.success(`Promo -${percent}% appliquée sur ${product.name}`, {
        action: {
          label: "Annuler",
          onClick: () => onUpdateProduct(product.id, { price: oldPrice, originalPrice: null })
        }
      });
    } catch (err) {
      toast.error("Erreur lors de l'application de la promo");
    }
  };

  const handleRestorePrice = async (product: any) => {
    try {
      if (product.originalPrice) {
        await onUpdateProduct(product.id, { price: product.originalPrice, originalPrice: null });
        toast.success("Prix original restauré");
      } else if (product.costPrice) {
        const restoredPrice = Math.round(Number(product.costPrice) * 1.3); // 30% margin default
        await onUpdateProduct(product.id, { price: restoredPrice });
        toast.success("Prix restauré (Marge 30%)");
      } else {
        toast.error("Prix d'origine inconnu. Veuillez éditer manuellement.");
        onEditProduct(product);
      }
    } catch (err) {
      toast.error("Erreur lors de la restauration du prix");
    }
  };

  const handleBatchDiscount = async (status: 'expired' | 'critical') => {
    // We want to target ALL products of this status, regardless of search/filter
    const allAnalyzed = products
      .filter(p => p.expirationDate)
      .map(p => {
        const expiryDate = startOfDay(parseISO(p.expirationDate!));
        const daysLeft = differenceInDays(expiryDate, now);
        
        let expiryStatus: 'expired' | 'critical' | 'warning' | 'safe' = 'safe';
        if (daysLeft < 0) expiryStatus = 'expired';
        else if (daysLeft <= 7) expiryStatus = 'critical';
        else if (daysLeft <= 30) expiryStatus = 'warning';

        return { ...p, daysLeft, expiryStatus };
      });

    const targets = allAnalyzed.filter(p => p.expiryStatus === status && p.stock > 0);
    
    if (targets.length === 0) {
      toast.info("Aucun produit en stock à traiter pour ce statut");
      return;
    }

    const discount = status === 'expired' ? 50 : 20;
    toast.promise(
      Promise.all(targets.map(p => {
        const newPrice = Math.round(Number(p.price) * (1 - discount/100));
        return onUpdateProduct(p.id, { price: newPrice });
      })),
      {
        loading: `Application des promos (-${discount}%)...`,
        success: `${targets.length} produits mis en promo !`,
        error: "Échec du traitement par lots"
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-3xl">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="text-rose-500" size={24} />
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-full">Urgent</span>
          </div>
          <p className="text-2xl font-black text-white">{stats.expiredCount}</p>
          <p className="text-xs text-white/40 font-bold uppercase tracking-wider">Produits expirés</p>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-3xl">
          <div className="flex items-center justify-between mb-2">
            <Clock className="text-amber-500" size={24} />
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-full">Semaine</span>
          </div>
          <p className="text-2xl font-black text-white">{stats.criticalCount}</p>
          <p className="text-xs text-white/40 font-bold uppercase tracking-wider">Expire sous 7 jours</p>
        </div>

        <div className="bg-indigo-500/10 border border-indigo-500/20 p-5 rounded-3xl">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="text-indigo-500" size={24} />
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-full">PV à risque</span>
          </div>
          <p className="text-2xl font-black text-white">{stats.valueAtRisk.toLocaleString()} CFA</p>
          <p className="text-xs text-white/40 font-bold uppercase tracking-wider">Valeur (PV) à risque</p>
        </div>

        <div className="bg-slate-500/10 border border-slate-500/20 p-5 rounded-3xl">
          <div className="flex items-center justify-between mb-2">
            <History className="text-slate-400" size={24} />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-500/10 px-2 py-0.5 rounded-full">Coût</span>
          </div>
          <p className="text-2xl font-black text-white">{stats.costAtRisk.toLocaleString()} CFA</p>
          <p className="text-xs text-white/40 font-bold uppercase tracking-wider">Coût d'achat à risque</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 p-4 rounded-3xl border border-white/10">
        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-2xl border border-white/5">
          <button 
            onClick={() => setView('list')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
              view === 'list' ? "bg-indigo-500 text-white shadow-lg" : "text-white/40 hover:text-white"
            )}
          >
            <LayoutList size={14} /> Liste
          </button>
          <button 
            onClick={() => setView('calendar')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
              view === 'calendar' ? "bg-indigo-500 text-white shadow-lg" : "text-white/40 hover:text-white"
            )}
          >
            <CalendarDays size={14} /> Calendrier
          </button>
          <button 
            onClick={() => setView('analytics')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
              view === 'analytics' ? "bg-indigo-500 text-white shadow-lg" : "text-white/40 hover:text-white"
            )}
          >
            <TrendingDown size={14} /> Analystique
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-2xl text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2 shadow-lg"
          >
            <FileDown size={14} /> Exporter (CSV)
          </button>
          
          <button 
            onClick={handlePrintPDF}
            className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-2xl text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2 shadow-lg"
          >
            <Printer size={14} /> Imprimer (PDF)
          </button>

          <div className="h-6 w-px bg-white/10 mx-2 hidden md:block" />

          <button 
            onClick={() => handleBatchDiscount('critical')}
            className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-2xl text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-500/5"
          >
            <Percent size={14} /> Tout solder (-20%)
          </button>

          <div className="h-6 w-px bg-white/10 mx-2 hidden md:block" />

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
            <input 
              type="text"
              placeholder="Rechercher..."
              className="bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-2 text-xs text-white focus:border-indigo-500 transition-all outline-none"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          
          <select 
            className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/60 outline-none hover:border-white/20 cursor-pointer"
            value={filterStatus}
            onChange={(e: any) => setFilterStatus(e.target.value)}
          >
            <option value="all">Tous les Statuts</option>
            <option value="expired" className="bg-slate-900">Expirés</option>
            <option value="critical" className="bg-slate-900">Critiques (7j)</option>
            <option value="warning" className="bg-slate-900">À surveiller (30j)</option>
          </select>
        </div>
      </div>

      {view === 'list' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {analyzedProducts.map((product) => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={product.id}
                className={cn(
                  "group relative bg-white/5 border rounded-3xl p-5 hover:bg-white/[0.08] transition-all",
                  product.expiryStatus === 'expired' ? "border-rose-500/30" : 
                  product.expiryStatus === 'critical' ? "border-amber-500/30" : "border-white/10"
                )}
              >
                <div className="flex gap-4">
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border relative group",
                    product.expiryStatus === 'expired' ? "bg-rose-500/10 border-rose-500/20 text-rose-500" :
                    product.expiryStatus === 'critical' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-500"
                  )}>
                    {product.image ? (
                      <img src={product.image} className="w-full h-full object-cover rounded-2xl" alt="" />
                    ) : (
                      <CalendarIcon size={24} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <h4 className="font-black text-white uppercase tracking-tight truncate pr-2">{product.name}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-white/30 font-black tracking-widest uppercase truncate">{product.sku}</p>
                          <span className="w-1 h-1 bg-white/10 rounded-full" />
                          <p className="text-[10px] text-white/30 font-black tracking-widest uppercase">Stock: {product.stock} {product.unit}</p>
                          {product.batchNumber && (
                            <>
                              <span className="w-1 h-1 bg-white/10 rounded-full" />
                              <span className="text-[10px] text-indigo-400 font-extrabold tracking-widest uppercase truncate border border-indigo-500/20 px-1 py-0.2 rounded bg-indigo-500/5">Lot: {product.batchNumber}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border",
                        product.expiryStatus === 'expired' ? "bg-rose-500/20 border-rose-500/30 text-rose-400" :
                        product.expiryStatus === 'critical' ? "bg-amber-500/20 border-amber-500/30 text-amber-400" :
                        "bg-white/5 border-white/10 text-white/40"
                      )}>
                        {product.expiryStatus === 'expired' ? 'Expiré' : `${product.daysLeft} jours`}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-white/20 mb-1">
                          <span>{format(product.expiryDate, 'dd MMMM yyyy', { locale: fr })}</span>
                          <span>{product.price.toLocaleString()} CFA</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(0, Math.min(100, (product.daysLeft / 90) * 100))}%` }}
                            className={cn(
                              "h-full rounded-full transition-all duration-1000",
                              product.expiryStatus === 'expired' ? "bg-rose-500" :
                              product.expiryStatus === 'critical' ? "bg-amber-500" : "bg-indigo-500"
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                       <button 
                        onClick={() => handleApplyPromo(product, 20)}
                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 rounded-xl py-2 text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Percent size={12} /> Promo -20%
                      </button>
                      <button 
                        onClick={() => handleRestorePrice(product)}
                        className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl py-2 text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <RefreshCcw size={12} /> Prix Normal
                      </button>
                      <button 
                        onClick={() => onEditProduct(product)}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2 text-[9px] font-black uppercase tracking-widest text-white/40 transition-all flex items-center justify-center gap-2"
                      >
                        <Edit2 size={12} /> Modifier
                      </button>
                      <button 
                        onClick={() => onAdjustStock(product)}
                        className="bg-rose-500/5 hover:bg-rose-500/20 text-rose-400 border border-rose-500/10 rounded-xl py-2 text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 size={12} /> Jeter / Perte
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {analyzedProducts.length === 0 && (
            <div className="lg:col-span-2 py-20 flex flex-col items-center justify-center text-white/20">
              <CheckCircle2 size={48} className="mb-4" />
              <p className="font-black uppercase tracking-widest text-xs">Aucun produit à risque détecté</p>
            </div>
          )}
        </div>
      ) : view === 'calendar' ? (
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 lg:p-10">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">
              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentMonth(prev => addDays(startOfMonth(prev), -1))}
                className="p-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={() => setCurrentMonth(prev => addDays(endOfMonth(prev), 1))}
                className="p-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-white/10 rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
              <div key={day} className="bg-black/40 p-4 text-center text-[10px] font-black text-white/30 uppercase tracking-widest underline decoration-indigo-500/10 underline-offset-8">
                {day}
              </div>
            ))}
            {calendarDays.map((day, i) => {
              const dayProducts = analyzedProducts.filter(p => isSameDay(p.expiryDate, day));
              const isToday = isSameDay(day, now);
              
              return (
                <div 
                  key={i} 
                  className={cn(
                    "min-h-[140px] bg-slate-900/40 p-3 flex flex-col gap-1 transition-all hover:bg-white/5 group/day",
                    !isSameMonth(day, currentMonth) && "opacity-20",
                    isToday && "bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-xs font-black",
                      isToday ? "text-indigo-400" : "text-white/40"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayProducts.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse hidden group-hover/day:block" />
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    {dayProducts.slice(0, 4).map(p => (
                      <div 
                        key={p.id}
                        className={cn(
                          "text-[8px] font-black uppercase tracking-tighter px-2 py-1 rounded border truncate cursor-default transition-all hover:scale-105",
                          p.expiryStatus === 'expired' ? "bg-rose-500/20 text-rose-400 border-rose-500/30" :
                          p.expiryStatus === 'critical' ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                          "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
                        )}
                        title={`${p.name} (${p.stock} unités)`}
                      >
                        {p.name.substring(0, 10)}...
                      </div>
                    ))}
                    {dayProducts.length > 4 && (
                      <div className="text-[7px] text-white/20 font-black text-center pt-1">+ {dayProducts.length - 4} autres</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
              <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-500" /> Top Pertes Potentielles
              </h3>
              <div className="space-y-4">
                {analyzedProducts.slice(0, 5).map(p => (
                  <div key={`loss-${p.id}`} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-white uppercase truncate">{p.name}</p>
                      <p className="text-[9px] text-white/40 uppercase tracking-widest">{p.stock} {p.unit} à {p.price} CFA</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-rose-500">-{(p.stock * p.price).toLocaleString()} CFA</p>
                      <p className="text-[8px] text-white/20 uppercase font-black">{p.daysLeft} jours restants</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
              <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <TrendingDown size={18} className="text-indigo-500" /> Analyse par Catégorie
              </h3>
              <div className="space-y-6">
                {categories.map(cat => {
                  const catProducts = analyzedProducts.filter(p => p.categoryId === cat.id);
                  if (catProducts.length === 0) return null;
                  const catValue = catProducts.reduce((sum, p) => sum + (p.price * p.stock), 0);
                  const totalValue = analyzedProducts.reduce((sum, p) => sum + (p.price * p.stock), 0);
                  const percent = (catValue / totalValue) * 100;
                  
                  return (
                    <div key={`cat-loss-${cat.id}`}>
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                        <span className="text-white/60">{cat.name}</span>
                        <span className="text-white">{catValue.toLocaleString()} CFA</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          className="h-full bg-indigo-500 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-[2.5rem] p-8 text-center">
             <div className="max-w-xl mx-auto space-y-4">
                <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Info className="text-indigo-400" size={32} />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Conseil de Gestion</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Vous avez <span className="text-white font-bold">{stats.criticalCount} produits</span> qui expirent dans moins d'une semaine. 
                  Une promotion flash de 20% pourrait aider à libérer ce stock tout en conservant une marge opérationnelle.
                </p>
                <div className="pt-4">
                  <button 
                    onClick={() => handleBatchDiscount('critical')}
                    className="bg-indigo-500 hover:bg-indigo-400 text-white font-black uppercase tracking-[0.2em] text-[10px] px-8 py-4 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
                  >
                    Lancer la Promo Flash
                  </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
