import React, { useState, useMemo } from 'react';
import { 
  Trash2, 
  Search, 
  Calendar, 
  Filter, 
  FileDown, 
  TrendingDown,
  AlertCircle,
  Clock,
  Package,
  FileText,
  RefreshCw,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Printer
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  parseISO,
  subMonths,
  startOfDay,
  endOfDay
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { DamagedRecord, Product, Category } from '../types';
import { cn, formatSafe } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Card, Button } from './ui';

interface LossReportProps {
  damagedRecords: DamagedRecord[];
  products: Product[];
  categories: Category[];
  onPrintReport: (records: DamagedRecord[]) => void;
}

export function LossReport({ damagedRecords, products, categories, onPrintReport }: LossReportProps) {
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ 
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [view, setView] = useState<'table' | 'analytics'>('table');

  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Produit / SKU',
      'Quantite',
      'Unite',
      'Raison / Notes',
      'Prix de Vente Unitaire (CFA)',
      'Prix de Cout Unitaire (CFA)',
      'Valeur de Vente Perdue (CFA)',
      'Cout dAchat Perdu (CFA)',
      'Operateur'
    ];

    const rows = filteredRecords.map(r => {
      const product = products.find(p => p.id === r.productId);
      const salePrice = product?.price || 0;
      const costPrice = product?.costPrice || 0;
      return [
        formatSafe(r.date, 'yyyy-MM-dd HH:mm'),
        `${r.productName} (${product?.sku || '---'})`,
        r.quantity,
        product?.unit || 'unite',
        r.reason,
        salePrice,
        costPrice,
        r.quantity * salePrice,
        r.quantity * costPrice,
        r.userName
      ];
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.map(val => typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val).join(';'))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rapport_pertes_${dateRange.start}_a_${dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    const itemsHtml = filteredRecords.map(r => {
      const product = products.find(p => p.id === r.productId);
      const saleVal = r.quantity * (product?.price || 0);
      const costVal = r.quantity * (product?.costPrice || 0);
      
      return `
        <tr style="border-bottom: 1px solid #efefef;">
          <td style="padding: 10px 8px; font-size: 11px;">
            <span style="font-weight: bold; color: #111;">${r.productName}</span>
            <div style="font-size: 9px; color: #888; font-family: monospace;">SKU: ${product?.sku || '---'}</div>
          </td>
          <td style="padding: 10px 8px; font-size: 11px; text-align: center;">${formatSafe(r.date, 'dd/MM/yyyy HH:mm')}</td>
          <td style="padding: 10px 8px; font-size: 11px; text-align: center; font-weight: bold; color: #e11d48;">${r.quantity} ${product?.unit || 'unites'}</td>
          <td style="padding: 10px 8px; font-size: 11px; color: #555;">${r.reason}</td>
          <td style="padding: 10px 8px; font-size: 11px; text-align: right; font-family: monospace; color: #e11d48; font-weight: bold;">-${saleVal.toLocaleString()} CFA</td>
          <td style="padding: 10px 8px; font-size: 11px; text-align: right; font-family: monospace; color: #666;">-${costVal.toLocaleString()} CFA</td>
          <td style="padding: 10px 8px; font-size: 11px; text-align: center; color: #666;">${r.userName}</td>
        </tr>
      `;
    }).join('');

    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <title>Rapport de Pertes - Nexus POS</title>
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
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #e11d48; padding-bottom: 15px; margin-bottom: 20px; align-items: flex-end;">
               <div>
                  <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; color: #111; font-weight: 900; letter-spacing: 1px;">RAPPORT DE PERTES</h1>
                  <p style="margin: 4px 0 0 0; color: #666; font-size: 10px; letter-spacing: 0.5px; font-weight: bold;">Période: du ${format(new Date(dateRange.start), 'dd/MM/yyyy')} au ${format(new Date(dateRange.end), 'dd/MM/yyyy')}</p>
               </div>
               <div style="text-align: right;">
                  <div style="font-weight: 900; font-size: 15px; text-transform: uppercase; color: #e11d48;">NEXUS POS PRO</div>
                  <div style="font-size: 10px; color: #555; margin-top: 2px;">Rapport de Démarque / Casse</div>
               </div>
            </div>

            <!-- Stats Box -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 25px;">
              <div style="background-color: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 10px; text-align: center;">
                <div style="font-size: 8px; font-weight: 850; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">VALEUR VENTE PERDUE</div>
                <div style="font-size: 14px; font-weight: 900; color: #e11d48; margin-top: 3px;">${stats.totalValue.toLocaleString()} CFA</div>
              </div>
              <div style="background-color: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 10px; text-align: center;">
                <div style="font-size: 8px; font-weight: 850; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">COÛT ACHAT PERDU</div>
                <div style="font-size: 14px; font-weight: 900; color: #e11d48; margin-top: 3px;">${stats.totalCost.toLocaleString()} CFA</div>
              </div>
              <div style="background-color: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 10px; text-align: center;">
                <div style="font-size: 8px; font-weight: 850; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">ARTICLES</div>
                <div style="font-size: 14px; font-weight: 900; color: #111; margin-top: 3px;">${stats.itemsCount}</div>
              </div>
              <div style="background-color: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 10px; text-align: center;">
                <div style="font-size: 8px; font-weight: 850; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">NBRE RAPPORTS</div>
                <div style="font-size: 14px; font-weight: 900; color: #111; margin-top: 3px;">${stats.count}</div>
              </div>
            </div>

            <!-- Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
               <thead>
                  <tr style="background-color: #e11d48; color: white;">
                     <th style="padding: 10px 8px; font-size: 10px; text-transform: uppercase; text-align: left; font-weight: 900; letter-spacing: 0.5px; width: 30%;">Article</th>
                     <th style="padding: 10px 8px; font-size: 10px; text-transform: uppercase; text-align: center; font-weight: 900; letter-spacing: 0.5px; width: 15%;">Date & Heure</th>
                     <th style="padding: 10px 8px; font-size: 10px; text-transform: uppercase; text-align: center; font-weight: 900; letter-spacing: 0.5px; width: 10%;">Quantité</th>
                     <th style="padding: 10px 8px; font-size: 10px; text-transform: uppercase; text-align: left; font-weight: 900; letter-spacing: 0.5px; width: 18%;">Raison</th>
                     <th style="padding: 10px 8px; font-size: 10px; text-transform: uppercase; text-align: right; font-weight: 900; letter-spacing: 0.5px; width: 13%;">Vente Perdue</th>
                     <th style="padding: 10px 8px; font-size: 10px; text-transform: uppercase; text-align: right; font-weight: 900; letter-spacing: 0.5px; width: 10%;">Coût Perdu</th>
                     <th style="padding: 10px 8px; font-size: 10px; text-transform: uppercase; text-align: center; font-weight: 900; letter-spacing: 0.5px; width: 10%;">Opérateur</th>
                   </tr>
               </thead>
               <tbody>
                  ${itemsHtml}
               </tbody>
            </table>

            <div style="margin-top: 40px; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
               <div style="font-size: 9px; color: #aaa;">Généré via Nexus POS Pro - Logiciel certifié de Gestion de Caisse</div>
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

  const filteredRecords = useMemo(() => {
    return damagedRecords
      .filter(r => {
        const product = products.find(p => p.id === r.productId);
        const matchesSearch = r.productName.toLowerCase().includes(search.toLowerCase()) || 
                             r.reason.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || (product && product.categoryId === selectedCategory);
        const matchesDate = r.date >= new Date(dateRange.start).toISOString() && 
                           r.date <= new Date(dateRange.end + 'T23:59:59').toISOString();
        return matchesSearch && matchesCategory && matchesDate;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [damagedRecords, search, selectedCategory, dateRange, products]);

  const stats = useMemo(() => {
    const totalValue = filteredRecords.reduce((sum, r) => {
      const product = products.find(p => p.id === r.productId);
      return sum + (Number(r.quantity) * (product?.price || 0));
    }, 0);

    const totalCost = filteredRecords.reduce((sum, r) => {
      const product = products.find(p => p.id === r.productId);
      return sum + (Number(r.quantity) * (product?.costPrice || 0));
    }, 0);

    const count = filteredRecords.length;
    const itemsCount = filteredRecords.reduce((sum, r) => sum + Number(r.quantity), 0);

    return { totalValue, totalCost, count, itemsCount };
  }, [filteredRecords, products]);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 bg-rose-500/10 border-rose-500/20">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="text-rose-500" size={24} />
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-full">Pertes PV</span>
          </div>
          <p className="text-2xl font-black text-white">{stats.totalValue.toLocaleString()} CFA</p>
          <p className="text-xs text-white/40 font-bold uppercase tracking-wider">Valeur de vente perdue</p>
        </Card>

        <Card className="p-6 bg-slate-500/10 border-slate-500/20">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="text-slate-400" size={24} />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-500/10 px-2 py-0.5 rounded-full">Pertes Coût</span>
          </div>
          <p className="text-2xl font-black text-white">{stats.totalCost.toLocaleString()} CFA</p>
          <p className="text-xs text-white/40 font-bold uppercase tracking-wider">Coût d'achat perdu</p>
        </Card>

        <Card className="p-6 bg-indigo-500/10 border-indigo-500/20">
          <div className="flex items-center justify-between mb-2">
            <Package className="text-indigo-500" size={24} />
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-full">Unités</span>
          </div>
          <p className="text-2xl font-black text-white">{stats.itemsCount}</p>
          <p className="text-xs text-white/40 font-bold uppercase tracking-wider">Articles retirés</p>
        </Card>

        <Card className="p-6 bg-amber-500/10 border-amber-500/20">
          <div className="flex items-center justify-between mb-2">
            <FileText className="text-amber-500" size={24} />
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-full">Saisies</span>
          </div>
          <p className="text-2xl font-black text-white">{stats.count}</p>
          <p className="text-xs text-white/40 font-bold uppercase tracking-wider">Nombre de rapports</p>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 p-4 rounded-3xl border border-white/10">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
            <input 
              type="text"
              placeholder="Rechercher produit, raison..."
              className="bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-2 text-xs text-white focus:border-indigo-500 transition-all outline-none md:w-64"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-white/20" />
            <input 
              type="date"
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none"
              value={dateRange.start}
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
            <span className="text-white/20">à</span>
            <input 
              type="date"
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none"
              value={dateRange.end}
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>

          <select 
            className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/60 outline-none hover:border-white/20 cursor-pointer"
            value={selectedCategory}
            onChange={(e: any) => setSelectedCategory(e.target.value)}
          >
            <option value="all">Toutes les Catégories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id} className="bg-slate-900">{c.name.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={handleExportCSV}
            className="bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest rounded-2xl px-6"
          >
            <FileDown size={14} className="mr-2" /> Exporter CSV
          </Button>
          <Button 
            onClick={handlePrintPDF}
            className="bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl px-6"
          >
            <Printer size={14} className="mr-2" /> Imprimer Rapport (PDF)
          </Button>
        </div>
      </div>

      {/* Results Table */}
      <Card className="overflow-hidden border-white/10 bg-white/5 p-0 rounded-[2.5rem]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40">
                <th className="p-6">Date & Heure</th>
                <th className="p-6">Produit</th>
                <th className="p-6">Quantité</th>
                <th className="p-6">Raison / Note</th>
                <th className="p-6">Valeur Perdue</th>
                <th className="p-6">Opérateur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence mode="popLayout">
                {filteredRecords.map((record) => {
                  const product = products.find(p => p.id === record.productId);
                  return (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={record.id} 
                      className="hover:bg-white/5 transition-colors group"
                    >
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <Clock size={14} className="text-white/20" />
                          <span className="text-xs font-mono text-white/60">{formatSafe(record.date, 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-white uppercase tracking-tight">{record.productName}</span>
                          <span className="text-[10px] text-white/20 font-black uppercase">{product?.sku || '---'}</span>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-black text-rose-400">
                          {record.quantity} {product?.unit || 'unité(s)'}
                        </span>
                      </td>
                      <td className="p-6">
                        <span className="text-xs text-white/40 italic">“{record.reason}”</span>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-rose-500 font-mono">
                            -{(record.quantity * (product?.price || 0)).toLocaleString()} CFA
                          </span>
                          <span className="text-[9px] text-white/20 font-black uppercase tracking-tighter">
                            Coût: -{(record.quantity * (product?.costPrice || 0)).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[10px] font-black text-indigo-400">
                            {record.userName.charAt(0)}
                          </div>
                          <span className="text-[10px] font-black text-white/40 uppercase">{record.userName}</span>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-32 text-center text-white/10">
                    <Trash2 size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="font-black uppercase tracking-widest text-xs">Aucune perte enregistrée sur cette période</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
