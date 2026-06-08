import { DEFAULT_PERMISSIONS } from '../constants';
import React, { useState, useMemo, memo, useEffect, useRef } from 'react';
import { Package, Tag, RefreshCw, LayoutGrid, Plus, FileSpreadsheet, Upload, ShoppingBag, AlertTriangle, Zap, Info, Search, Filter, Scan, LayoutList, Layers, Truck, ArrowUpDown, Award, Calendar, FolderTree, AlertCircle, TrendingDown, ShieldCheck, RotateCcw, Check, Printer, Copy, PackageOpen, Trash2, ChevronUp, BarcodeIcon, ShoppingCart, Eye, X, MessageCircle, Phone, MapPin, Navigation, Edit, Clock, Mail, Percent, DollarSign, Star, Palette, FileText, AlignLeft, Shield, UserCog, Link2, MapIcon, Brain, Database, ArrowRight, CreditCard, Banknote, Minus, UserPlus, ChevronDown, Users, ArrowUpRight, ArrowDownRight, Camera } from 'lucide-react';
import { useTranslation } from '../translations';
import { rtdb, ref, set, get, remove, auth, handleFirestoreError, OperationType } from '../database';
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
import { MigrationTool } from './MigrationTool';
import { SupabaseDiagnostics } from './SupabaseDiagnostics';


export const mapDoc = <T,>(doc: any): T => {
  return { id: doc.id, ...doc.data() } as unknown as T;
};

 // TODO: fix missing imports 
export function Settings({ settings }: { settings: CompanySettings }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<CompanySettings>({
    ...settings,
    name: settings.name || '',
    logoUrl: settings.logoUrl || '',
    address: settings.address || '',
    phone: settings.phone || '',
    email: settings.email || '',
    taxNumber: settings.taxNumber || '',
    receiptTemplate: settings.receiptTemplate || 'standard',
    labelTemplate: settings.labelTemplate || 'standard',
    currency: settings.currency || 'FCFA',
    taxRate: settings.taxRate ?? 18,
    loyaltyPointsPerCurrencyUnit: settings.loyaltyPointsPerCurrencyUnit ?? 1,
    loyaltyPointValue: settings.loyaltyPointValue ?? 0.01,
    footerText: settings.footerText || '',
    accountingFormat: settings.accountingFormat || 'csv',
    siteLocations: settings.siteLocations || [],
    roleKPIs: settings.roleKPIs || {},
    notifications: settings.notifications || {
      whatsapp: { enabled: false, onConfirmation: true, onShipped: true, onDelivered: true },
      email: { enabled: false, onConfirmation: true, onShipped: true, onDelivered: true }
    },
    operationalCosts: settings.operationalCosts || { basePackaging: 0, baseShipping: 0 },
    lockingPeriodDays: settings.lockingPeriodDays ?? 0,
    deliveryZones: settings.deliveryZones || [],
    paperFormat: settings.paperFormat || '80mm',
    silentPrinting: settings.silentPrinting ?? false,
    globalStockAlertThreshold: settings.globalStockAlertThreshold || 10,
    apiKeys: settings.apiKeys || { twilioSid: '', twilioToken: '', twilioNumber: '', googleMapsKey: '' },
    availableTaxes: settings.availableTaxes || [],
    displayPriceHT: settings.displayPriceHT ?? false,
    loyaltyTiers: settings.loyaltyTiers || [],
    enableTimeClock: settings.enableTimeClock ?? false,
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes ?? 30,
    auditLogRetentionDays: settings.auditLogRetentionDays ?? 90,
    brandColor: settings.brandColor || '#4f46e5',
    fastModeEnabled: settings.fastModeEnabled ?? false,
    defaultLeadTimeDays: settings.defaultLeadTimeDays ?? 3,
    loyaltyPointsPerUnit: settings.loyaltyPointsPerUnit ?? 1,
  });
  const [activeSubTab, setActiveSubTab] = useState('main');
  const [isSaving, setIsSaving] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'permissions' | 'logistics' | 'hr' | 'notifications' | 'financials' | 'integrations' | 'tools'>('general');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState(0);
  const [isToolsScannerOpen, setIsToolsScannerOpen] = useState(false);

  const handleSave = async () => {
    const trimmedName = (formData.name || '').trim();
    if (!trimmedName) {
      alert("Le nom de l'entreprise est obligatoire.");
      return;
    }

    setIsSaving(true);
    try {
      const finalData = {
        ...formData,
        name: trimmedName,
        email: (formData.email || '').trim().toLowerCase(),
        phone: (formData.phone || '').trim(),
      };
      await set(ref(rtdb, 'settings/company'), finalData);
      alert("Paramètres enregistrés avec succès.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/company');
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
    }
  };

  const requestSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsConfirmOpen(true);
  };

  const togglePermission = (role: 'admin' | 'manager' | 'cashier' | 'delivery' | 'picker' | 'camera_agent', permission: keyof RolePermissions) => {
    if (role === 'admin') return; // Admin permissions are fixed
    
    const currentPermissions = formData.rolePermissions?.[role] || DEFAULT_PERMISSIONS[role as keyof typeof DEFAULT_PERMISSIONS];
    const updatedPermissions = {
      ...currentPermissions,
      [permission]: !currentPermissions[permission]
    };

    setFormData({
      ...formData,
      rolePermissions: {
        admin: DEFAULT_PERMISSIONS.admin,
        manager: formData.rolePermissions?.manager || DEFAULT_PERMISSIONS.manager,
        cashier: formData.rolePermissions?.cashier || DEFAULT_PERMISSIONS.cashier,
        delivery: formData.rolePermissions?.delivery || DEFAULT_PERMISSIONS.delivery,
        picker: formData.rolePermissions?.picker || DEFAULT_PERMISSIONS.picker,
        camera_agent: formData.rolePermissions?.camera_agent || DEFAULT_PERMISSIONS.camera_agent,
        [role]: updatedPermissions
      }
    });
  };

  const setAllPermissions = (role: 'manager' | 'cashier' | 'delivery' | 'picker' | 'camera_agent', value: boolean) => {
    const updatedPermissions = Object.keys(DEFAULT_PERMISSIONS[role as keyof typeof DEFAULT_PERMISSIONS]).reduce((acc, key) => ({
      ...acc,
      [key]: value
    }), {} as RolePermissions);

    setFormData({
      ...formData,
      rolePermissions: {
        admin: DEFAULT_PERMISSIONS.admin,
        manager: formData.rolePermissions?.manager || DEFAULT_PERMISSIONS.manager,
        cashier: formData.rolePermissions?.cashier || DEFAULT_PERMISSIONS.cashier,
        delivery: formData.rolePermissions?.delivery || DEFAULT_PERMISSIONS.delivery,
        picker: formData.rolePermissions?.picker || DEFAULT_PERMISSIONS.picker,
        camera_agent: formData.rolePermissions?.camera_agent || DEFAULT_PERMISSIONS.camera_agent,
        [role]: updatedPermissions
      }
    });
  };

  const getPermissionLabel = (perm: string) => {
    const labels: Record<string, string> = {
      canAccessInventory: "Inventaire & Stock",
      canAccessSales: "Ventes & Caisse",
      canAccessCustomers: "Gestion Clients",
      canAccessEmployees: "Gestion Employés",
      canAccessSuppliers: "Gestion Fournisseurs",
      canAccessSettings: "Paramètres Système",
      canAccessOnlineOrders: "Commandes en Ligne",
      canAccessExpenses: "Gestion Dépenses",
      canAccessReturns: "Gestion Retours",
      canAccessPurchases: "Achats Fournisseurs",
      canAccessPromotions: "Promotions & Remises",
      canAccessVouchers: "Bons d'Achat",
      canAccessAnalytics: "Analytique & Rapports",
      canAccessShifts: "Gestion des Sessions (Clôture)",
      canModifyPrices: "Modifier les prix manuellement",
      canApplyDiscount: "Appliquer des remises",
      canVoidTransaction: "Annuler des reçus",
      canManageUsers: "Gestion avancée des utilisateurs"
    };
    return labels[perm] || perm.replace('canAccess', '').replace(/([A-Z])/g, ' $1').trim();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-industrial-800 pb-8">
        <div>
          <div className="flex items-center gap-3">
             <h3 className="text-4xl font-black text-white tracking-tight uppercase">{t("Configuration Système")}</h3>
             <span className="px-2 py-1 bg-indigo-600/10 border border-indigo-500/20 rounded-lg text-indigo-400 text-[10px] font-black tracking-widest uppercase">v1.2.6</span>
          </div>
          <p className="text-[10px] font-black text-industrial-500 uppercase tracking-widest mt-1">{t("Gestion administrative et technique de l'infrastructure")}</p>
        </div>
      </div>

      <div className="flex bg-industrial-900 p-1.5 rounded-2xl border border-industrial-800 overflow-x-auto shadow-inner no-scrollbar gap-1">
        {(['general', 'permissions', 'hr', 'logistics', 'notifications', 'financials', 'integrations', 'tools'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSettingsTab(tab)}
            className={cn(
              "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2",
              settingsTab === tab 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                : "text-industrial-500 hover:text-industrial-300 hover:bg-industrial-800/50"
            )}
          >
            {tab === 'general' && <Palette size={14} />}
            {tab === 'permissions' && <Shield size={14} />}
            {tab === 'hr' && <Users size={14} />}
            {tab === 'logistics' && <Truck size={14} />}
            {tab === 'notifications' && <MessageCircle size={14} />}
            {tab === 'financials' && <DollarSign size={14} />}
            {tab === 'integrations' && <Link2 size={14} />}
            {tab === 'tools' && <Database size={14} />}
            {tab === 'general' ? t('Général') : 
             tab === 'permissions' ? t('Permissions') :
             tab === 'hr' ? t('RH') :
             tab === 'logistics' ? t('Logistique') :
             tab === 'notifications' ? t('Alertes') :
             tab === 'financials' ? t('Finance') :
             tab === 'integrations' ? t('APIs') :
             tab === 'tools' ? t('Outils') : t('Impression')}
          </button>
        ))}
        <button
          onClick={() => setSettingsTab('printing' as any)}
          className={cn(
            "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2",
            settingsTab === 'printing' as any 
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
              : "text-industrial-500 hover:text-industrial-300 hover:bg-industrial-800/50"
          )}
        >
          <Printer size={14} /> {t("Impression")}
        </button>
      </div>

      {settingsTab === 'hr' && (
        <Card className="p-8 space-y-8">
          {(auth.currentUser?.uid === 'FaQiBWkg8uTxZ2np7BQjDINTyQc2' || auth.currentUser?.email === 'hrskader305@gmail.com') && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
              <h4 className="text-rose-800 font-bold flex items-center gap-2">
                <AlertCircle size={20} />
                Maintenance d'Urgence
              </h4>
              <p className="text-sm text-rose-600">Supprimez tous les comptes d'employés et personnels pour réinitialiser les accès. <b>Attention : Cette action est irréversible.</b></p>
              <Button 
                onClick={async () => {
                  if (confirm("Êtes-vous sûr de vouloir supprimer TOUS les comptes personnels (employés) ?")) {
                    try {
                      const employeesSnap = await get(ref(rtdb, 'employees'));
                      const userProfilesSnap = await get(ref(rtdb, 'users'));
                      
                      const employeeData = employeesSnap.val() || {};
                      const userData = userProfilesSnap.val() || {};

                      const promises: Promise<void>[] = [];
                      
                      Object.keys(employeeData).forEach(id => {
                        promises.push(remove(ref(rtdb, `employees/${id}`)));
                      });

                      Object.entries(userData).forEach(([id, data]: [string, any]) => {
                        // Never delete the admin's own profile
                        if (id !== auth.currentUser?.uid && data.role !== 'admin' && data.email !== 'hrskader305@gmail.com') {
                          promises.push(remove(ref(rtdb, `users/${id}`)));
                        }
                      });
                      
                      await Promise.all(promises);
                      alert("Tous les comptes personnels ont été supprimés avec succès.");
                      window.location.reload();
                    } catch (err) {
                      alert("Erreur lors de la suppression : " + (err instanceof Error ? err.message : String(err)));
                    }
                  }
                }}
                variant="outline" 
                className="border-rose-300 text-rose-700 hover:bg-rose-100 font-bold"
              >
                Supprimer tous les personnels
              </Button>
            </div>
          )}

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
               <h4 className="text-slate-800 font-bold flex items-center gap-2">
                 <Camera size={18} className="text-indigo-600" />
                 Portail Caméra Nexus Guard
               </h4>
               <p className="text-xs text-slate-500">Activer ou désactiver le module de surveillance et d'audit en direct.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={formData.enableCameraPortal !== false}
                onChange={(e) => setFormData({ ...formData, enableCameraPortal: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div>
            <h4 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Award className="text-indigo-600" size={20} />
              Objectifs de Performance (KPI) & Primes
            </h4>
            <p className="text-sm text-slate-500 mb-6">Définissez les objectifs journaliers et les commissions pour vos collaborateurs.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {['picker', 'delivery'].map((role) => (
                <div key={role} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-6">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-slate-800 capitalize">Rôle: {role === 'picker' ? 'Préparateur' : 'Livreur'}</h5>
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                      {role === 'picker' ? <Package size={20} /> : <Truck size={20} />}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Objectif Journalier (Commandes)</label>
                      <input 
                        type="number" 
                        value={isNaN(formData.roleKPIs?.[role]?.dailyOrderGoal as any) ? 0 : (formData.roleKPIs?.[role]?.dailyOrderGoal || 0)}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                          setFormData({
                            ...formData,
                            roleKPIs: {
                              ...formData.roleKPIs,
                              [role]: { ...(formData.roleKPIs?.[role] || { dailyOrderGoal: 0, bonusPerOrder: 0, bonusType: 'fixed' }), dailyOrderGoal: isNaN(val) ? 0 : val }
                            }
                          });
                        }}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: 50"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Prime / Commande</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={isNaN(formData.roleKPIs?.[role]?.bonusPerOrder as any) ? 0 : (formData.roleKPIs?.[role]?.bonusPerOrder || 0)}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            setFormData({
                              ...formData,
                              roleKPIs: {
                                ...formData.roleKPIs,
                                [role]: { ...(formData.roleKPIs?.[role] || { dailyOrderGoal: 0, bonusPerOrder: 0, bonusType: 'fixed' }), bonusPerOrder: isNaN(val) ? 0 : val }
                              }
                            });
                          }}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Ex: 5.00"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Type de Prime</label>
                        <select 
                          value={formData.roleKPIs?.[role]?.bonusType || 'fixed'}
                          onChange={(e) => setFormData({
                            ...formData,
                            roleKPIs: {
                              ...formData.roleKPIs,
                              [role]: { ...(formData.roleKPIs?.[role] || { dailyOrderGoal: 0, bonusPerOrder: 0, bonusType: 'fixed' }), bonusType: e.target.value as 'fixed' | 'percent' }
                            }
                          })}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="fixed">Montant Fixe ({settings.currency})</option>
                          <option value="percent">% du Total</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
            <div className="flex justify-end pt-4">
              <Button onClick={requestSave} disabled={isSaving} className="px-12 py-3">
                {isSaving ? "Enregistrement..." : "Sauvegarder les KPI"}
              </Button>
            </div>

          <div className="pt-8 border-t border-slate-100">
            <h4 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Clock className="text-indigo-600" size={20} />
              Sécurité & Temps de Travail
            </h4>
            <p className="text-sm text-slate-500 mb-6">Paramétrez la pointeuse digitale et les délais de sécurité.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="text-sm font-bold text-slate-700">Pointeuse Digitale</label>
                    <p className="text-xs text-slate-500">Activer le pointage des heures.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, enableTimeClock: !formData.enableTimeClock})}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      formData.enableTimeClock ? "bg-emerald-500" : "bg-slate-200"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      formData.enableTimeClock ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Déconnexion auto (Minutes d'inactivité)</label>
                  <input 
                    type="number" 
                    value={isNaN(formData.sessionTimeoutMinutes as any) ? 30 : formData.sessionTimeoutMinutes}
                    onChange={(e) => setFormData({ ...formData, sessionTimeoutMinutes: e.target.value === '' ? 30 : parseInt(e.target.value) })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Rétention Log Audit (Jours)</label>
                  <input 
                    type="number" 
                    value={isNaN(formData.auditLogRetentionDays as any) ? 90 : formData.auditLogRetentionDays}
                    onChange={(e) => setFormData({ ...formData, auditLogRetentionDays: e.target.value === '' ? 90 : parseInt(e.target.value) })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {settingsTab === 'logistics' && (
        <Card className="p-8 space-y-8">
          <div>
            <h4 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <MapPin className="text-indigo-600" size={20} />
              Gestion Multi-Sites (Dépôts & Magasins)
            </h4>
            <p className="text-sm text-slate-500 mb-6">Ajoutez vos entrepôts ou boutiques physiques pour la gestion des stocks et ramassages.</p>
            
            <div className="space-y-4">
              {formData.siteLocations?.map((site, idx) => (
                <div key={site.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-600 shadow-sm">
                    {site.type === 'warehouse' ? <Package size={20} /> : <ShoppingBag size={20} />}
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input 
                      placeholder="Nom du site" 
                      className="p-2 border border-slate-200 rounded-lg text-sm"
                      value={site.name}
                      onChange={(e) => {
                        const newSites = [...(formData.siteLocations || [])];
                        newSites[idx].name = e.target.value;
                        setFormData({ ...formData, siteLocations: newSites });
                      }}
                    />
                    <input 
                      placeholder="Adresse complète" 
                      className="p-2 border border-slate-200 rounded-lg text-sm"
                      value={site.address}
                      onChange={(e) => {
                        const newSites = [...(formData.siteLocations || [])];
                        newSites[idx].address = e.target.value;
                        setFormData({ ...formData, siteLocations: newSites });
                      }}
                    />
                    <select 
                      className="p-2 border border-slate-200 rounded-lg text-sm"
                      value={site.type}
                      onChange={(e) => {
                        const newSites = [...(formData.siteLocations || [])];
                        newSites[idx].type = e.target.value as 'warehouse' | 'store';
                        setFormData({ ...formData, siteLocations: newSites });
                      }}
                    >
                      <option value="store">Magasin / Boutique</option>
                      <option value="warehouse">Entrepôt / Dépôt</option>
                    </select>
                  </div>
                  <button 
                    onClick={() => {
                      const newSites = formData.siteLocations?.filter((_, i) => i !== idx);
                      setFormData({ ...formData, siteLocations: newSites });
                    }}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              
              <button 
                onClick={() => setFormData({ 
                  ...formData, 
                  siteLocations: [...(formData.siteLocations || []), { id: generateUniqueId(), name: '', address: '', type: 'store' }] 
                })}
                className="w-full p-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all flex items-center justify-center gap-2 font-bold text-sm"
              >
                <Plus size={20} /> Ajouter un Nouveau Site
              </button>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-100">
            <h4 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Truck className="text-indigo-600" size={20} />
              Zones de Livraison & Frais
            </h4>
            <p className="text-sm text-slate-500 mb-6">Définissez des frais de port spécifiques par quartier ou ville.</p>
            
            <div className="space-y-4">
              {formData.deliveryZones?.map((zone, idx) => (
                <div key={`delivery-zone-${idx}`} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-4">
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <input 
                      placeholder="Nom de la zone (ex: Plateau, Tunis...)" 
                      className="p-2 border border-slate-200 rounded-lg text-sm"
                      value={zone.name}
                      onChange={(e) => {
                        const newZones = [...(formData.deliveryZones || [])];
                        newZones[idx].name = e.target.value;
                        setFormData({ ...formData, deliveryZones: newZones });
                      }}
                    />
                    <div className="relative">
                      <input 
                        type="number"
                        placeholder="Frais de livraison" 
                        className="w-full p-2 pl-8 border border-slate-200 rounded-lg text-sm"
                        value={isNaN(zone.cost as any) ? 0 : zone.cost}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          const newZones = [...(formData.deliveryZones || [])];
                          newZones[idx].cost = isNaN(val) ? 0 : val;
                          setFormData({ ...formData, deliveryZones: newZones });
                        }}
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{settings.currency}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      const newZones = formData.deliveryZones?.filter((_, i) => i !== idx);
                      setFormData({ ...formData, deliveryZones: newZones });
                    }}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              
              <button 
                onClick={() => setFormData({ 
                  ...formData, 
                  deliveryZones: [...(formData.deliveryZones || []), { name: '', cost: 0 }] 
                })}
                className="w-full p-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all flex items-center justify-center gap-2 font-bold text-sm"
              >
                <Plus size={20} /> Ajouter une Zone de Livraison
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={requestSave} disabled={isSaving} className="px-12 py-3">
              {isSaving ? "Enregistrement..." : "Sauvegarder la logistique"}
            </Button>
          </div>
        </Card>
      )}

      {settingsTab === 'notifications' && (
        <Card className="p-8 space-y-8">
          <div>
            <h4 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <MessageCircle className="text-indigo-600" size={20} />
              Automatisation des Communications
            </h4>
            <p className="text-sm text-slate-500 mb-6">Préparez vos envois automatiques WhatsApp et Email pour les clients.</p>
            
            <div className="space-y-6">
              {(['whatsapp', 'email'] as const).map((channel) => (
                <div key={channel} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm", 
                        channel === 'whatsapp' ? "bg-emerald-500 text-white" : "bg-blue-500 text-white")}>
                        {channel === 'whatsapp' ? <MessageCircle size={20} /> : <Mail size={20} />}
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-800 capitalize">Notifications {channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}</h5>
                        <p className="text-xs text-slate-500">Gérez les alertes automatiques pour ce canal.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={formData.notifications?.[channel]?.enabled}
                        onChange={(e) => setFormData({
                          ...formData,
                          notifications: {
                            ...formData.notifications!,
                            [channel]: { ...formData.notifications![channel], enabled: e.target.checked }
                          }
                        })}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  
                  <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4", !formData.notifications?.[channel]?.enabled && "opacity-50 pointer-events-none")}>
                    {[
                      { key: 'onConfirmation', label: 'Confirmation de commande' },
                      { key: 'onShipped', label: 'Commande prête / Expédiée' },
                      { key: 'onDelivered', label: 'Livréesé / Reçue' }
                    ].map((trigger) => (
                      <label key={trigger.key} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-200 transition-all cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                          checked={formData.notifications?.[channel]?.[trigger.key as keyof typeof formData.notifications.whatsapp]}
                          onChange={(e) => setFormData({
                            ...formData,
                            notifications: {
                              ...formData.notifications!,
                              [channel]: { ...formData.notifications![channel], [trigger.key]: e.target.checked }
                            }
                          })}
                        />
                        <span className="text-xs font-bold text-slate-700">{trigger.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end pt-4">
            <Button onClick={requestSave} disabled={isSaving} className="px-12 py-3">
              {isSaving ? "Enregistrement..." : "Sauvegarder les notifications"}
            </Button>
          </div>
        </Card>
      )}

      {settingsTab === 'financials' && (
        <Card className="p-8 space-y-8">
          <div>
            <h4 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <DollarSign className="text-indigo-600" size={20} />
              Paramètres Financiers & Compta
            </h4>
            <p className="text-sm text-slate-500 mb-6">Configurez les frais fixes et les périodes de verrouillage pour la sécurité de vos données.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h5 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">Frais Opérationnels Standards</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Emballage de base ({settings.currency})</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={isNaN(formData.operationalCosts?.basePackaging as any) ? 0 : (formData.operationalCosts?.basePackaging || 0)}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        setFormData({
                          ...formData,
                          operationalCosts: { ...(formData.operationalCosts || { basePackaging: 0, baseShipping: 0 }), basePackaging: isNaN(val) ? 0 : val }
                        })
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Frais Port de base ({settings.currency})</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={isNaN(formData.operationalCosts?.baseShipping as any) ? 0 : (formData.operationalCosts?.baseShipping || 0)}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        setFormData({
                          ...formData,
                          operationalCosts: { ...(formData.operationalCosts || { basePackaging: 0, baseShipping: 0 }), baseShipping: isNaN(val) ? 0 : val }
                        })
                      }}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 italic">Ces frais seront utilisés par défaut pour calculer la marge nette si aucun frais spécifique n'est défini sur le produit.</p>
              </div>
              
              <div className="space-y-6">
                <h5 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">Période de Clôture</h5>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Verrouillage après (Jours)</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.lockingPeriodDays}
                    onChange={(e) => setFormData({ ...formData, lockingPeriodDays: parseInt(e.target.value) })}
                  >
                    <option value={0}>Pas de verrouillage</option>
                    <option value={1}>24 Heures</option>
                    <option value={7}>7 Jours</option>
                    <option value={30}>30 Jours</option>
                  </select>
                </div>
                <p className="text-[10px] text-slate-400 italic">Interdit toute modification ou suppression d'une vente passée après ce délai pour garantir l'intégrité comptable.</p>
              </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-100">
            <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Percent className="text-indigo-600" size={20} />
              Fiscalité Avancée
            </h4>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-slate-700">Mode d'affichage des prix</label>
                  <p className="text-xs text-slate-500">Afficher les prix Hors Taxe (HT) par défaut dans le magasin.</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, displayPriceHT: !formData.displayPriceHT})}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    formData.displayPriceHT ? "bg-indigo-600" : "bg-slate-200"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    formData.displayPriceHT ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700">Taxes Disponibles</label>
                {formData.availableTaxes?.map((tax, idx) => (
                  <div key={`available-tax-${idx}`} className="flex gap-4 items-center">
                    <input 
                      placeholder="Nom (ex: TVA 20%)" 
                      className="flex-1 p-3 bg-white border border-slate-200 rounded-xl outline-none"
                      value={tax.name}
                      onChange={e => {
                        const newTaxes = [...(formData.availableTaxes || [])];
                        newTaxes[idx].name = e.target.value;
                        setFormData({...formData, availableTaxes: newTaxes});
                      }}
                    />
                    <input 
                      type="number" 
                      placeholder="Taux (%)"
                      className="w-24 p-3 bg-white border border-slate-200 rounded-xl outline-none"
                      value={isNaN(tax.rate as any) ? 0 : tax.rate}
                      onChange={e => {
                        const newTaxes = [...(formData.availableTaxes || [])];
                        newTaxes[idx].rate = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        setFormData({...formData, availableTaxes: newTaxes});
                      }}
                    />
                    <button 
                      onClick={() => setFormData({...formData, availableTaxes: formData.availableTaxes?.filter((_, i) => i !== idx)})}
                      className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => setFormData({...formData, availableTaxes: [...(formData.availableTaxes || []), { name: '', rate: 0 }]})}
                  className="w-full p-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-indigo-400 hover:text-indigo-600 text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Ajouter une taxe
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-4">
            <Button onClick={requestSave} disabled={isSaving} className="px-12 py-3">
              {isSaving ? "Enregistrement..." : "Sauvegarder les finances"}
            </Button>
          </div>
        </Card>
      )}

      {settingsTab === ('printing' as any) && (
        <Card className="p-8 space-y-8">
          <div>
            <h4 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Printer className="text-indigo-600" size={20} />
              Propriétés d'Impression & Matériel
            </h4>
            <p className="text-sm text-slate-500 mb-6">Configurez les paramètres de vos imprimantes thermiques ou standard.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Format de Papier Principal</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.paperFormat}
                    onChange={e => setFormData({...formData, paperFormat: e.target.value as any})}
                  >
                    <option value="80mm">Ticket de Caisse Standard (80mm)</option>
                    <option value="60mm">Petit Ticket (60mm)</option>
                    <option value="A4">Facture Standard (A4)</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="text-sm font-bold text-slate-700">Impression "Silencieuse" (Iframe)</label>
                    <p className="text-xs text-slate-500">Tente d'éviter les popups de nouvelles fenêtres.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, silentPrinting: !formData.silentPrinting})}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      formData.silentPrinting ? "bg-indigo-600" : "bg-slate-200"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      formData.silentPrinting ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Modèle de Reçu</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.receiptTemplate}
                    onChange={e => setFormData({...formData, receiptTemplate: e.target.value as any})}
                  >
                    <option value="classic">Classique</option>
                    <option value="modern">Moderne</option>
                    <option value="minimal">Minimaliste</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Modèle d'Étiquette</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.labelTemplate}
                    onChange={e => setFormData({...formData, labelTemplate: e.target.value as any})}
                  >
                    <option value="standard">Standard</option>
                    <option value="price-only">Prix Uniquement</option>
                    <option value="barcode-only">Code-barres Uniquement</option>
                    <option value="shelf-standard">Rayon Standard</option>
                    <option value="shelf-large">Rayon Large</option>
                    <option value="shelf-promo">Rayon Promo</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-amber-800">
               <Info size={20} className="flex-shrink-0 mt-0.5" />
               <div className="text-xs space-y-1">
                 <p className="font-bold">Note sur l'impression automatique :</p>
                 <p>Pour imprimer sans confirmer le dialogue système (Silent Print), vous devez configurer votre navigateur :</p>
                 <ul className="list-disc pl-4 space-y-1 mt-1">
                   <li><b>Chrome/Edge :</b> Ajoutez le flag <code>--kiosk-printing</code> au raccourci du navigateur.</li>
                   <li><b>Firefox :</b> Activez <code>print.always_print_silent</code> dans <code>about:config</code>.</li>
                 </ul>
               </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-4">
            <Button onClick={requestSave} disabled={isSaving} className="px-12 py-3">
              {isSaving ? "Enregistrement..." : "Sauvegarder les Propriétés d'Impression"}
            </Button>
          </div>
        </Card>
      )}

      {settingsTab === 'tools' && (
        <div className="max-w-2xl space-y-6">
          <SupabaseDiagnostics />
          <MigrationTool />
          <ManualQRCodeGenerator />
          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Scan size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Scanner de Code-barres</h3>
            </div>
            <p className="text-sm text-slate-500">Utilisez cet outil pour tester la compatibilité de votre caméra ou scanner des codes manuellement.</p>
            <Button onClick={() => setIsToolsScannerOpen(true)} variant="outline" className="w-full gap-2">
              <Scan size={18} /> Lancer le Scanner
            </Button>
            {isToolsScannerOpen && (
              <BarcodeScanner 
                onScan={(text) => {
                  alert(`Scanné avec succès: ${text}`);
                  setIsToolsScannerOpen(false);
                }} 
                onClose={() => setIsToolsScannerOpen(false)} 
              />
            )}
          </div>
        </div>
      )}

      {settingsTab === 'general' ? (
        <Card className="p-8">
          <form onSubmit={requestSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Nom de l'entreprise</label>
                <input 
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.name || ''}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">URL du Logo</label>
                <input 
                  type="url"
                  placeholder="https://example.com/logo.png"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.logoUrl || ''}
                  onChange={e => setFormData({...formData, logoUrl: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Adresse</label>
                <input 
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.address || ''}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Téléphone</label>
                <input 
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.phone || ''}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <input 
                  type="email"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.email || ''}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Numéro de TVA / SIRET</label>
                <input 
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.taxNumber || ''}
                  onChange={e => setFormData({...formData, taxNumber: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Modèle de Reçu</label>
                <select 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.receiptTemplate}
                  onChange={e => setFormData({...formData, receiptTemplate: e.target.value as any})}
                >
                  <option value="classic">Classique (Ticket de caisse)</option>
                  <option value="modern">Moderne (Épuré)</option>
                  <option value="minimal">Minimaliste (Compact)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Modèle d'Étiquette</label>
                <select 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.labelTemplate}
                  onChange={e => setFormData({...formData, labelTemplate: e.target.value as any})}
                >
                  <option value="standard">Standard (Nom + Prix + Barcode)</option>
                  <option value="price-only">Prix Uniquement</option>
                  <option value="barcode-only">Code-barres Uniquement</option>
                  <option value="shelf-standard">Rayon Standard (40x30mm)</option>
                  <option value="shelf-large">Rayon Supermarché (80x50mm)</option>
                  <option value="shelf-promo">Rayon Promo (Rouge)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Devise (Symbole)</label>
                <input 
                  type="text"
                  placeholder="€, $, CFA..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.currency}
                  onChange={e => setFormData({...formData, currency: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Taux de Taxe par défaut (%)</label>
                <input 
                  type="number"
                  step="0.01"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.taxRate}
                  onChange={e => setFormData({...formData, taxRate: parseFloat(e.target.value) || 0})}
                  required
                />
              </div>

              <div className="md:col-span-2 p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">Autoriser la vente avec stock zéro</p>
                  <p className="text-xs text-slate-500">Permet d'ajouter des produits au panier même si la quantité en stock est épuisée.</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, allowNegativeStock: !formData.allowNegativeStock})}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    formData.allowNegativeStock ? "bg-indigo-600" : "bg-slate-200"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    formData.allowNegativeStock ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Points de Fidélité par {formData.currency} dépensé</label>
                <input 
                  type="number"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.loyaltyPointsPerCurrencyUnit || 0}
                  onChange={e => setFormData({...formData, loyaltyPointsPerCurrencyUnit: parseFloat(e.target.value) || 0})}
                  required
                />
              </div>
              <div className="space-y-4">
                <h5 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Star className="text-amber-500" size={16} /> Fidélité & Marketing
                </h5>
                <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Points par unité de devise ({formData.currency})</label>
                    <input 
                      type="number"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={isNaN(formData.loyaltyPointsPerUnit as any) ? 1 : formData.loyaltyPointsPerUnit}
                      onChange={e => setFormData({...formData, loyaltyPointsPerUnit: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Valeur d'un point en remise ({formData.currency})</label>
                    <input 
                      type="number"
                      step="0.001"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={isNaN(formData.loyaltyPointValue as any) ? 0.01 : formData.loyaltyPointValue}
                      onChange={e => setFormData({...formData, loyaltyPointValue: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                    />
                  </div>
                  
                  <div className="pt-2 border-t border-slate-200">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Niveaux de Fidélité (Multiplier)</label>
                    <div className="space-y-2 mt-2">
                      {formData.loyaltyTiers?.map((tier, idx) => (
                        <div key={`loyalty-tier-${idx}`} className="flex gap-2">
                          <input 
                            placeholder="Nom (ex: Gold)" 
                            className="flex-1 p-2 text-xs border border-slate-200 rounded-lg"
                            value={tier.name}
                            onChange={e => {
                              const newTiers = [...(formData.loyaltyTiers || [])];
                              newTiers[idx].name = e.target.value;
                              setFormData({...formData, loyaltyTiers: newTiers});
                            }}
                          />
                          <input 
                            type="number" 
                            step="0.1"
                            className="w-16 p-2 text-xs border border-slate-200 rounded-lg"
                            value={isNaN(tier.multiplier as any) ? 1 : tier.multiplier}
                            onChange={e => {
                              const newTiers = [...(formData.loyaltyTiers || [])];
                              newTiers[idx].multiplier = e.target.value === '' ? 1 : parseFloat(e.target.value);
                              setFormData({...formData, loyaltyTiers: newTiers});
                            }}
                          />
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, loyaltyTiers: formData.loyaltyTiers?.filter((_, i) => i !== idx)})}
                            className="p-2 text-rose-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, loyaltyTiers: [...(formData.loyaltyTiers || []), { name: '', multiplier: 1 }]})}
                        className="text-[10px] font-bold text-indigo-600 hover:underline"
                      >
                        + Ajouter un niveau
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <AlertTriangle className="text-rose-500" size={16} /> Alerte Stock Rupture
                </h5>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Seuil d'alerte global (Quantité)</label>
                  <input 
                    type="number"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={isNaN(formData.globalStockAlertThreshold as any) ? 10 : formData.globalStockAlertThreshold}
                    onChange={e => setFormData({...formData, globalStockAlertThreshold: e.target.value === '' ? 0 : parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Palette className="text-indigo-600" size={16} /> Identité Visuelle & UI
                </h5>
                <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Couleur de la marque</label>
                    <div className="flex gap-2">
                      <input 
                        type="color"
                        className="w-10 h-10 border-0 rounded-lg cursor-pointer"
                        value={formData.brandColor}
                        onChange={e => setFormData({...formData, brandColor: e.target.value})}
                      />
                      <input 
                        type="text"
                        className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-sm font-mono"
                        value={formData.brandColor}
                        onChange={e => setFormData({...formData, brandColor: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                        <Zap size={14} className="text-amber-500 animate-pulse" />
                        Mode V8 Super Turbo
                      </p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Synchronisation instantanée & Mode éco désactivé.</p>
                    </div>
                    <button 
                      type="button"
                      className="relative inline-flex h-5 w-9 items-center rounded-full bg-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                    >
                      <span className="inline-block h-3 w-3 transform rounded-full bg-white translate-x-5 transition-transform" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-700">Mode Caisse Rapide</p>
                      <p className="text-[10px] text-slate-500">Interface simplifiée pour affluence.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, fastModeEnabled: !formData.fastModeEnabled})}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        formData.fastModeEnabled ? "bg-indigo-600" : "bg-slate-200"
                      )}
                    >
                      <span className={cn(
                        "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                        formData.fastModeEnabled ? "translate-x-5" : "translate-x-1"
                      )} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <FileText className="text-indigo-600" size={16} /> Documents & Impression
                </h5>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Format Papier Principal</label>
                  <select 
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.paperFormat}
                    onChange={e => setFormData({...formData, paperFormat: e.target.value as '80mm' | '60mm' | 'A4'})}
                  >
                    <option value="80mm">Ticket de Caisse (80mm)</option>
                    <option value="60mm">Ticket de Caisse (60mm)</option>
                    <option value="A4">Facture Standard (A4)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100">
              <h5 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-4">
                <AlignLeft className="text-slate-400" size={16} /> Pied de Page Facture (Commun)
              </h5>
              <textarea 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 text-sm"
                placeholder="Ex: Merci de votre confiance ! Retour sous 30 jours avec ticket."
                value={formData.footerText}
                onChange={e => setFormData({...formData, footerText: e.target.value})}
              />
            </div>
            <div className="flex justify-end pt-4 gap-4">
              <Button type="submit" disabled={isSaving} className="px-8">
                {isSaving ? "Enregistrement..." : "Enregistrer les paramètres"}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="p-8">
          <div className="space-y-12">
            <div>
              <h4 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                <Shield size={22} className="text-indigo-600" />
                Gestion des Accès par Rôle
              </h4>
              <p className="text-sm text-slate-500 mb-8">Définissez précisément ce que chaque rôle peut voir et faire dans l'application.</p>
            </div>

            {(['manager', 'cashier', 'delivery', 'picker'] as const).map(role => (
              <div key={role} className="space-y-6 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center text-indigo-600">
                      <UserCog size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 capitalize text-lg">{role === 'cashier' ? 'Caissier' : role === 'delivery' ? 'Livreur' : role === 'picker' ? 'Ramasseur' : role}</h4>
                      <p className="text-xs text-slate-500">Personnalisez les accès pour ce rôle</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setAllPermissions(role, true)}
                      className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-all"
                    >
                      Tout Activer
                    </button>
                    <button 
                      onClick={() => setAllPermissions(role, false)}
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-all"
                    >
                      Tout Désactiver
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.keys(DEFAULT_PERMISSIONS[role]).map(perm => {
                    const isChecked = (formData.rolePermissions?.[role] || DEFAULT_PERMISSIONS[role])[perm as keyof RolePermissions];
                    return (
                      <label 
                        key={perm} 
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-xl cursor-pointer border transition-all select-none",
                          isChecked 
                            ? "bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-50" 
                            : "bg-slate-50 border-transparent text-slate-400 opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded flex items-center justify-center border transition-all",
                          isChecked ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-300"
                        )}>
                          {isChecked && <Check size={14} className="text-white" />}
                        </div>
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={isChecked}
                          onChange={() => togglePermission(role, perm as keyof RolePermissions)}
                        />
                        <span className={cn("text-sm font-medium", isChecked ? "text-slate-800" : "text-slate-500")}>
                          {getPermissionLabel(perm)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                <Award size={24} />
              </div>
              <div className="flex-1">
                <h5 className="font-bold text-indigo-900 text-sm">Rôle Administrateur</h5>
                <p className="text-xs text-indigo-700/70">L'administrateur possède tous les accès par défaut et ne peut pas être restreint pour éviter tout blocage du système.</p>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={requestSave} disabled={isSaving} className="px-12 py-3 text-lg">
                {isSaving ? "Enregistrement..." : "Sauvegarder les permissions"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {settingsTab === 'integrations' && (
        <Card className="p-8 space-y-8">
          <div>
            <h4 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Link2 className="text-indigo-600" size={20} />
              Intégrations & API Tierces
            </h4>
            <p className="text-sm text-slate-500 mb-6">Connectez vos services externes pour automatiser vos processus.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-sm">
                    <MessageCircle size={20} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800">Twilio (WhatsApp Pro)</h5>
                    <p className="text-[10px] text-slate-400">Pour les notifications automatiques.</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Account SID</label>
                    <input 
                      type="password"
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.apiKeys?.twilioSid || ''}
                      onChange={e => setFormData({
                        ...formData,
                        apiKeys: { ...(formData.apiKeys || {}), twilioSid: e.target.value }
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Auth Token</label>
                    <input 
                      type="password"
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.apiKeys?.twilioToken || ''}
                      onChange={e => setFormData({
                        ...formData,
                        apiKeys: { ...(formData.apiKeys || {}), twilioToken: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-sm">
                    <MapIcon size={20} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800">Google Maps Platform</h5>
                    <p className="text-[10px] text-slate-400">Pour le calcul d'itinéraires et distances.</p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">API Key (Maps, Places)</label>
                  <input 
                    type="password"
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.apiKeys?.googleMapsKey || ''}
                    onChange={e => setFormData({
                      ...formData,
                      apiKeys: { ...(formData.apiKeys || {}), googleMapsKey: e.target.value }
                    })}
                  />
                </div>
                <p className="text-[10px] text-slate-400 italic">Nécessaire pour estimer précisément les temps de livraison.</p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-4">
            <Button onClick={requestSave} disabled={isSaving} className="px-12 py-3">
              {isSaving ? "Enregistrement..." : "Sauvegarder les intégrations"}
            </Button>
          </div>
        </Card>
      )}

      <ConfirmDialog 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleSave}
        title="Confirmer les modifications"
        message="Êtes-vous sûr de vouloir enregistrer ces modifications ? Elles seront appliquées immédiatement à l'ensemble du système."
        confirmText="Confirmer l'enregistrement"
        variant="primary"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Printer size={18} className="text-indigo-600" />
            Aperçu du Reçu
          </h4>
          <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300 font-mono text-xs space-y-4 max-w-[250px] mx-auto">
            <div className="text-center space-y-1">
              {formData.logoUrl && <img src={formData.logoUrl} alt="Logo" className="w-12 h-12 mx-auto mb-2 object-contain" />}
              <p className="font-bold uppercase">{formData.name}</p>
              {formData.address && <p>{formData.address}</p>}
              {formData.phone && <p>Tél: {formData.phone}</p>}
            </div>
            <div className="border-t border-dashed border-slate-300 py-2">
              <div className="flex justify-between">
                <span>Article Exemple x1</span>
                <span>10.00 {settings.currency}</span>
              </div>
            </div>
            <div className="border-t border-dashed border-slate-300 pt-2 font-bold flex justify-between text-sm">
              <span>TOTAL</span>
              <span>10.00 {settings.currency}</span>
            </div>
            <div className="text-center pt-4 text-[10px] text-slate-500">
              <p>{formData.footerText || 'Merci de votre visite !'}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-center items-center text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
            <Brain size={32} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800">Besoin d'aide ?</h4>
            <p className="text-sm text-slate-500 mt-1">L'IA peut vous aider à configurer vos paramètres ou à personnaliser vos modèles d'impression.</p>
          </div>
          <Button variant="outline" className="w-full">
            Demander à l'assistant
          </Button>
        </Card>
      </div>
    </div>
  );
}
