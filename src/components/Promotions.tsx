import React, { useState, useEffect, useMemo, memo } from 'react';
import { 
  Gift, Calendar, Tag, Package2, Trash2, Plus, 
  CheckCircle2, XCircle, AlertCircle, Search, X,
  Clock, TrendingDown, BarChart3, History, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '../supabase';
import { 
  Promotion, Product, Category, Transaction, CompanySettings 
} from '../types';
import { Button, Card, Modal, ConfirmDialog } from './ui';
import { cn, formatSafe, getHierarchicalCategories } from '../lib/utils';

export const Promotions = memo(function Promotions({ promotions, products, categories, transactions, settings }: { promotions: Promotion[], products: Product[], categories: Category[], transactions: Transaction[], settings: CompanySettings }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
  const [viewingPerformancePromo, setViewingPerformancePromo] = useState<Promotion | null>(null);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [promoToDelete, setPromoToDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'percentage' as 'percentage' | 'fixed' | 'buy_x_get_y',
    value: '',
    minPurchase: '',
    startDate: '',
    endDate: '',
    isActive: true,
    applicableCategories: [] as string[],
    applicableProducts: [] as string[],
    code: '',
    buyQuantity: '',
    getQuantity: ''
  });

  useEffect(() => {
    if (editingPromotion) {
      setFormData({
        name: editingPromotion.name || '',
        type: editingPromotion.type || 'percentage',
        value: (editingPromotion.value ?? '').toString(),
        minPurchase: (editingPromotion.minPurchase ?? '').toString(),
        startDate: editingPromotion.startDate || '',
        endDate: editingPromotion.endDate || '',
        isActive: editingPromotion.isActive ?? true,
        applicableCategories: editingPromotion.applicableCategories || [],
        applicableProducts: editingPromotion.applicableProducts || [],
        code: editingPromotion.code || '',
        buyQuantity: (editingPromotion.buyQuantity ?? '').toString(),
        getQuantity: (editingPromotion.getQuantity ?? '').toString()
      });
    } else {
      setFormData({
        name: '', type: 'percentage', value: '', minPurchase: '', 
        startDate: '', endDate: '', isActive: true, applicableCategories: [], 
        applicableProducts: [], code: '', buyQuantity: '', getQuantity: ''
      });
    }
  }, [editingPromotion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = formData.name.trim();
    const promoValue = parseFloat(formData.value || '0');

    if (!trimmedName) {
      alert("Le nom de la promotion est obligatoire.");
      return;
    }

    if (isNaN(promoValue) || promoValue < 0) {
      alert("Veuillez saisir une valeur de promotion valide.");
      return;
    }

    const data = {
      name: trimmedName,
      code: formData.code?.trim().toUpperCase() || '',
      type: formData.type,
      value: promoValue,
      min_purchase: formData.minPurchase ? parseFloat(formData.minPurchase) : null,
      buy_quantity: formData.buyQuantity ? parseInt(formData.buyQuantity) : null,
      get_quantity: formData.getQuantity ? parseInt(formData.getQuantity) : null,
      start_date: formData.startDate || null,
      end_date: formData.endDate || null,
      is_active: formData.isActive,
      applicable_categories: formData.applicableCategories || [],
      applicable_products: formData.applicableProducts || [],
      updated_at: new Date().toISOString()
    };

    try {
      if (editingPromotion) {
        const { error } = await supabase
          .from('promotions')
          .update(data)
          .eq('id', editingPromotion.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('promotions')
          .insert({ id: Math.random().toString(36).substring(2, 10), ...data });
        if (error) throw error;
      }
      setIsModalOpen(false);
      setEditingPromotion(null);
    } catch (error: any) {
      console.error("Error saving promotion:", error);
      alert("Erreur lors de la sauvegarde: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    setPromoToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!promoToDelete) return;
    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', promoToDelete);
      if (error) throw error;
      setPromoToDelete(null);
      setIsDeleteConfirmOpen(false);
    } catch (error: any) {
      console.error("Error deleting promotion:", error);
      alert("Erreur lors de la suppression: " + error.message);
    }
  };

  const filteredPromotions = useMemo(() => {
    const searchLower = search.toLowerCase();
    return promotions.filter(p => 
      p.name.toLowerCase().includes(searchLower) || 
      (p.code && p.code.toLowerCase().includes(searchLower))
    );
  }, [promotions, search]);

  const totalPages = Math.ceil(filteredPromotions.length / pageSize);
  const paginatedPromotions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPromotions.slice(start, start + pageSize);
  }, [filteredPromotions, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: promotions.length,
      active: promotions.filter(p => p.isActive).length,
      ongoing: promotions.filter(p => {
        if (!p.isActive) return false;
        const start = p.startDate ? new Date(p.startDate) : null;
        const end = p.endDate ? new Date(p.endDate) : null;
        return (!start || start <= now) && (!end || end >= now);
      }).length,
      totalDiscount: transactions.reduce((sum, t) => sum + (t.discountAmount || 0), 0)
    };
  }, [promotions, transactions]);

  const getPromoStatus = (promo: Promotion) => {
    if (!promo.isActive) return { label: 'Désactivée', color: 'bg-slate-100 text-slate-500' };
    const now = new Date();
    const start = promo.startDate ? new Date(promo.startDate) : null;
    const end = promo.endDate ? new Date(promo.endDate) : null;

    if (start && start > now) return { label: 'À venir', color: 'bg-amber-100 text-amber-700' };
    if (end && end < now) return { label: 'Expirée', color: 'bg-rose-100 text-rose-700' };
    return { label: 'En cours', color: 'bg-emerald-100 text-emerald-700' };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Gestion des Promotions</h3>
          <p className="text-sm text-slate-500">Créez des offres spéciales et des remises automatiques</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Rechercher une offre..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-64 text-slate-800"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => { setEditingPromotion(null); setIsModalOpen(true); }}>
            <Plus size={20} /> Nouvelle Promotion
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
            <Tag size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Offres</p>
            <p className="text-lg font-bold text-slate-800">{stats.total}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actives</p>
            <p className="text-lg font-bold text-slate-800">{stats.active}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">En Cours</p>
            <p className="text-lg font-bold text-slate-800">{stats.ongoing}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
            <TrendingDown size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Remises</p>
            <p className="text-lg font-bold text-rose-600">{stats.totalDiscount.toFixed(2)} {settings.currency}</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedPromotions.map((promo: Promotion) => {
          const status = getPromoStatus(promo);
          return (
            <Card key={promo.id} className={cn("p-6 border-l-4 transition-all hover:shadow-md", promo.isActive ? "border-l-indigo-500" : "border-l-slate-300")}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-slate-800">{promo.name}</h4>
                  <p className="text-xs text-slate-500 font-mono">{promo.code || 'Remise automatique'}</p>
                </div>
                <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", status.color)}>
                  {status.label}
                </span>
              </div>
              
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Type:</span>
                  <span className="font-medium text-slate-700 capitalize">{promo.type.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Valeur:</span>
                  <span className="font-bold text-indigo-600">
                    {promo.type === 'percentage' ? `${promo.value}%` : `${promo.value}${settings.currency}`}
                  </span>
                </div>
                {promo.minPurchase && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Min. Achat:</span>
                    <span className="font-medium text-slate-700">{promo.minPurchase}{settings.currency}</span>
                  </div>
                )}
                {(promo.startDate || promo.endDate) && (
                  <div className="pt-2 mt-2 border-t border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Période de validité</p>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Calendar size={12} />
                      <span>
                        {promo.startDate ? formatSafe(promo.startDate, 'dd/MM/yy') : 'Début'} 
                        {' → '} 
                        {promo.endDate ? formatSafe(promo.endDate, 'dd/MM/yy') : 'Fin'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setViewingPerformancePromo(promo); setIsPerformanceModalOpen(true); }}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                    title="Performance de la promotion"
                  >
                    <BarChart3 size={18} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="p-2 text-xs" onClick={() => { setEditingPromotion(promo); setIsModalOpen(true); }}>
                    Modifier
                  </Button>
                  <button onClick={() => handleDelete(promo.id)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
        {filteredPromotions.length === 0 && (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Tag size={32} />
            </div>
            <h4 className="font-bold text-slate-800">Aucune promotion trouvée</h4>
            <p className="text-sm text-slate-500">Ajustez votre recherche ou créez une nouvelle offre.</p>
          </div>
        )}
      </div>

      {/* Pagination UI */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-6">
          <p className="text-xs text-slate-500 font-medium">
            Affichage de <span className="font-bold text-slate-900">{Math.min(filteredPromotions.length, (currentPage - 1) * pageSize + 1)}</span> à <span className="font-bold text-slate-900">{Math.min(filteredPromotions.length, currentPage * pageSize)}</span> sur <span className="font-bold text-slate-900">{filteredPromotions.length}</span> promotions
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronUp className="-rotate-90" size={16} />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                    currentPage === i + 1 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none" 
                      : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronUp className="rotate-90" size={16} />
            </button>
          </div>
        </div>
      )}

      <Modal 
        isOpen={isPerformanceModalOpen} 
        onClose={() => setIsPerformanceModalOpen(false)} 
        title={`Performance: ${viewingPerformancePromo?.name}`}
        maxWidth="max-w-4xl"
      >
        {viewingPerformancePromo && (
          <div className="space-y-6">
            {(() => {
              const promoTransactions = transactions.filter(t => t.promotionId === viewingPerformancePromo.id);
              const totalDiscounted = promoTransactions.reduce((sum, t) => sum + (t.discountAmount || 0), 0);
              const totalRevenue = promoTransactions.reduce((sum, t) => sum + t.total, 0);
              const usageCount = promoTransactions.length;

              return (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Utilisations</p>
                      <p className="text-xl font-bold text-slate-800">{usageCount}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Remises</p>
                      <p className="text-xl font-bold text-rose-600">{totalDiscounted.toFixed(2)} {settings.currency}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Chiffre d'Affaires</p>
                      <p className="text-xl font-bold text-emerald-600">{totalRevenue.toFixed(2)} {settings.currency}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <History size={18} /> Historique d'utilisation
                    </h4>
                    <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
                      {promoTransactions
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                        .map(t => (
                          <div key={t.id} className="p-4 bg-white border border-slate-100 rounded-xl flex justify-between items-center">
                            <div>
                              <p className="text-sm font-bold text-slate-800">Ticket #{t.id.slice(-6).toUpperCase()}</p>
                              <p className="text-xs text-slate-500">{format(new Date(t.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-slate-800">{t.total.toFixed(2)} {settings.currency}</p>
                              <p className="text-xs font-bold text-rose-500">-{t.discountAmount?.toFixed(2)} {settings.currency}</p>
                            </div>
                          </div>
                        ))}
                      {usageCount === 0 && (
                        <div className="text-center py-12 text-slate-400 italic">
                          Cette promotion n'a pas encore été utilisée.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPromotion ? "Modifier la promotion" : "Nouvelle promotion"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Nom de l'offre *</label>
            <input 
              required
              className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Type de remise</label>
              <select 
                className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as any})}
              >
                <option value="percentage">Pourcentage (%)</option>
                <option value="fixed">Montant fixe ({settings.currency})</option>
                <option value="buy_x_get_y">Achetez X, recevez Y</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">
                {formData.type === 'buy_x_get_y' ? 'Remise sur Y (%)' : 'Valeur *'}
              </label>
              <input 
                required
                type="number"
                step="0.01"
                className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.value}
                onChange={e => setFormData({...formData, value: e.target.value})}
              />
            </div>
          </div>

          {formData.type === 'buy_x_get_y' && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="space-y-1">
                <label className="text-xs font-bold text-indigo-600 uppercase">Quantité à acheter (X)</label>
                <input 
                  required
                  type="number"
                  className="w-full p-2 border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.buyQuantity}
                  onChange={e => setFormData({...formData, buyQuantity: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-indigo-600 uppercase">Quantité offerte/remisée (Y)</label>
                <input 
                  required
                  type="number"
                  className="w-full p-2 border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.getQuantity}
                  onChange={e => setFormData({...formData, getQuantity: e.target.value})}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Achat Minimum ({settings.currency})</label>
              <input 
                type="number"
                className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.minPurchase}
                onChange={e => setFormData({...formData, minPurchase: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Code Promo (Optionnel)</label>
              <input 
                className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                value={formData.code}
                onChange={e => setFormData({...formData, code: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Date de début</label>
              <input 
                type="date"
                className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.startDate}
                onChange={e => setFormData({...formData, startDate: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Date de fin</label>
              <input 
                type="date"
                className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.endDate}
                onChange={e => setFormData({...formData, endDate: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Catégories applicables</label>
            <div className="flex flex-col gap-2 p-2 border border-slate-200 rounded-lg max-h-[200px] overflow-y-auto">
              {getHierarchicalCategories(categories).map((cat: Category & { level: number }) => (
                <label key={`cat-filter-${cat.id}`} className="flex items-center gap-2 px-2 py-1 bg-slate-100 rounded-md text-xs cursor-pointer hover:bg-slate-200 transition-colors" style={{ marginLeft: `${cat.level * 1.5}rem` }}>
                  <input 
                    type="checkbox"
                    checked={formData.applicableCategories.includes(cat.id)}
                    onChange={e => {
                      const newCats = e.target.checked 
                        ? [...formData.applicableCategories, cat.id]
                        : formData.applicableCategories.filter(c => c !== cat.id);
                      setFormData({...formData, applicableCategories: newCats});
                    }}
                    className="w-3 h-3 text-indigo-600 rounded"
                  />
                  {cat.name}
                </label>
              ))}
              {categories.length === 0 && <p className="text-[10px] text-slate-400 italic">Aucune catégorie définie dans l'inventaire</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Produits spécifiques (Optionnel)</label>
            <div className="max-h-[150px] overflow-y-auto p-2 border border-slate-200 rounded-lg space-y-1">
              {products.map((prod: Product) => (
                <label key={`prod-filter-${prod.id}`} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded-md text-xs cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formData.applicableProducts.includes(prod.id)}
                    onChange={e => {
                      const newProds = e.target.checked 
                        ? [...formData.applicableProducts, prod.id]
                        : formData.applicableProducts.filter(id => id !== prod.id);
                      setFormData({...formData, applicableProducts: newProds});
                    }}
                    className="w-3 h-3 text-indigo-600 rounded"
                  />
                  <span className="flex-1 truncate">{prod.name}</span>
                  <span className="text-slate-400 font-mono text-[10px]">{prod.sku || prod.id.slice(-4)}</span>
                </label>
              ))}
              {products.length === 0 && <p className="text-[10px] text-slate-400 italic">Aucun produit dans l'inventaire</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={e => setFormData({...formData, isActive: e.target.checked})}
              className="w-4 h-4 text-indigo-600 rounded"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-slate-700">Promotion active immédiatement</label>
          </div>

          <div className="pt-4">
            <Button type="submit" className="w-full py-3">
              {editingPromotion ? "Enregistrer les modifications" : "Créer la promotion"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog 
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Supprimer la promotion"
        message="Êtes-vous sûr de vouloir supprimer cette promotion ? Cette action est irréversible."
      />
    </div>
  );
});
