import { DEFAULT_PERMISSIONS } from '../constants';
import React, { useState, useMemo, memo, useEffect, useRef } from 'react';
import { Package, Tag, RefreshCw, LayoutGrid, Plus, FileSpreadsheet, Upload, ShoppingBag, AlertTriangle, Zap, Info, Search, Filter, Scan, LayoutList, Layers, Truck, ArrowUpDown, Award, Calendar, FolderTree, AlertCircle, TrendingDown, ShieldCheck, RotateCcw, Check, Printer, Copy, PackageOpen, Trash2, ChevronUp, BarcodeIcon, ShoppingCart, Eye, X, MessageCircle, Phone, MapPin, Navigation, Edit, Clock, Mail, Percent, DollarSign, Star, Palette, FileText, AlignLeft, Shield, UserCog, Link2, MapIcon, Brain, Database, ArrowRight, CreditCard, Banknote, Minus, UserPlus, ChevronDown, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { rtdb, ref, get, rtdbQuery, orderByChild, equalTo } from '../database';
import { Button, Card, Modal, ConfirmDialog, BlurCard, SortableHeader } from './ui';
import { Product, Category, Brand, StockAdjustment, CompanySettings, SupplierSync, Supplier, Purchase, Transaction, OnlineOrder, Employee, Customer, CartItem, ProductReturn, RolePermissions } from '../types';
import { cn, logAction, safeDate, exportToExcel, getHierarchicalCategories, formatSafe, exportToCSV, generateUniqueId, isLocked } from '../lib/utils';
import { printReceipt } from '../services/printService';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isToday, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';

import { StockAdjustmentModal } from './StockAdjustmentModal';
import { DuplicateSKUModal } from './DuplicateSKUModal';
import { ImportModal } from './ImportModal';
import { ProductFormModal } from './ProductFormModal';
import { LabelPrinter } from './LabelPrinter';
import { SupplierSyncManager } from './SupplierSyncManager';
import { StockHistory } from './StockHistory';
import { BarcodeScanner } from './BarcodeScanner';
import { ManualQRCodeGenerator } from './ManualQRCodeGenerator';


export const mapDoc = <T,>(doc: any): T => {
  return { id: doc.id, ...doc.data() } as unknown as T;
};

 // TODO: fix missing imports 
export function Returns({ returns, settings }: { returns: ProductReturn[], settings: CompanySettings }) {
  const [selectedReturn, setSelectedReturn] = useState<ProductReturn | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-white tracking-tight uppercase">Gestion des Retours</h3>
          <p className="text-sm text-industrial-500">{returns.length} RETOURS ENREGISTRÉS</p>
        </div>
      </div>

      <Card className="p-0 industrial-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-industrial-950 border-b border-industrial-800">
                <th className="p-4 text-[10px] font-black text-industrial-500 uppercase tracking-widest">Date</th>
                <th className="p-4 text-[10px] font-black text-industrial-500 uppercase tracking-widest">Transaction</th>
                <th className="p-4 text-[10px] font-black text-industrial-500 uppercase tracking-widest">Type</th>
                <th className="p-4 text-[10px] font-black text-industrial-500 uppercase tracking-widest">Raison</th>
                <th className="p-4 text-[10px] font-black text-industrial-500 uppercase tracking-widest">Remboursement</th>
                <th className="p-4 text-[10px] font-black text-industrial-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800">
              {returns.map((r: ProductReturn) => (
                <tr key={r.id} className="hover:bg-industrial-800/30 transition-colors">
                  <td className="p-4 text-xs font-mono text-industrial-400">
                    {format(new Date(r.timestamp), 'dd/MM/yyyy HH:mm')}
                  </td>
                  <td className="p-4 text-xs font-mono text-indigo-400">
                    #{r.transactionId?.slice(-8).toUpperCase()}
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                      r.type === 'refund' 
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}>
                      {r.type === 'refund' ? 'Remboursement' : 'Note de Crédit'}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-industrial-400 italic font-mono">
                    "{r.reason}"
                  </td>
                  <td className="p-4 font-black text-white font-mono">{r.totalRefund.toFixed(2)} {settings.currency}</td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => setSelectedReturn(r)}
                      className="p-2 text-industrial-500 hover:text-indigo-400 hover:bg-industrial-800 rounded-xl transition-all"
                      title="Voir les détails"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {returns.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-industrial-600 font-mono italic">AUCUN RETOUR ENREGISTRÉ</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ReturnDetailsModal 
        isOpen={!!selectedReturn}
        onClose={() => setSelectedReturn(null)}
        returnRecord={selectedReturn}
        settings={settings}
      />
    </div>
  );
}

export function ReturnDetailsModal({ isOpen, onClose, returnRecord, settings }: { isOpen: boolean, onClose: () => void, returnRecord: ProductReturn | null, settings: CompanySettings }) {
  if (!returnRecord) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="DÉTAILS DU RETOUR">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 bg-industrial-800/50 p-6 rounded-2xl border border-industrial-800">
          <div>
            <p className="text-[10px] font-black text-industrial-500 uppercase tracking-widest mb-1">ID Transaction</p>
            <p className="text-sm font-mono text-indigo-400">#{returnRecord.transactionId.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-industrial-500 uppercase tracking-widest mb-1">Date du Retour</p>
            <p className="text-sm text-white font-mono">{format(new Date(returnRecord.timestamp), 'dd/MM/yyyy HH:mm')}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-industrial-500 uppercase tracking-widest mb-1">Type</p>
            <p className="text-sm font-black text-white uppercase tracking-tight">
              {returnRecord.type === 'refund' ? 'Remboursement' : 'Note de Crédit'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black text-industrial-500 uppercase tracking-widest mb-1">Montant Total</p>
            <p className="text-sm font-black text-emerald-400 font-mono">{returnRecord.totalRefund.toFixed(2)} {settings.currency}</p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black text-industrial-500 uppercase tracking-widest mb-2">Raison du retour</p>
          <p className="text-sm text-industrial-400 italic bg-industrial-900 border border-industrial-800 p-4 rounded-xl font-mono">
            "{returnRecord.reason}"
          </p>
        </div>

        <div>
          <p className="text-[10px] font-black text-industrial-500 uppercase tracking-widest mb-3">Articles retournés</p>
          <div className="space-y-2">
            {returnRecord.items.map((item, idx) => (
              <div key={`return-record-item-${idx}`} className="flex items-center justify-between p-4 bg-industrial-900 border border-industrial-800 rounded-xl">
                <div>
                  <p className="text-sm font-black text-white uppercase tracking-tight">{item.name}</p>
                  <p className="text-xs text-industrial-500 font-mono">{item.price.toFixed(2)} {settings.currency} / UNITE</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-white font-mono">x{item.quantity}</p>
                  <p className="text-xs font-black text-indigo-400 font-mono">{(item.price * item.quantity).toFixed(2)} {settings.currency}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 space-y-2">
          <Button onClick={() => printReceipt(returnRecord, settings)} className="w-full industrial-button-secondary flex items-center justify-center gap-2">
            <Printer size={16} /> Imprimer le reçu
          </Button>
          <Button onClick={onClose} className="w-full industrial-button-primary">Fermer</Button>
        </div>
      </div>
    </Modal>
  );
}
