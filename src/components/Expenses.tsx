import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, FileText, Trash2, TrendingDown, 
  CreditCard, Banknote, RefreshCw 
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../supabase';
import { cn, formatSafe } from '../lib/utils';
import { Button, Card, Modal, ConfirmDialog, SortableHeader } from './ui';
import { Expense, CompanySettings } from '../types';

interface ExpensesProps {
  expenses: Expense[];
  user: any;
  settings: CompanySettings;
}

export function Expenses({ expenses, user, settings }: ExpensesProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Loyer',
    date: format(new Date(), 'yyyy-MM-dd'),
    paymentMethod: 'cash' as 'cash' | 'card' | 'transfer'
  });

  useEffect(() => {
    if (editingExpense) {
      setFormData({
        description: editingExpense.description || '',
        amount: (editingExpense.amount ?? '').toString(),
        category: editingExpense.category || 'Loyer',
        date: editingExpense.date ? formatSafe(editingExpense.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        paymentMethod: editingExpense.paymentMethod || 'cash'
      });
    } else {
      setFormData({
        description: '',
        amount: '',
        category: 'Loyer',
        date: format(new Date(), 'yyyy-MM-dd'),
        paymentMethod: 'cash'
      });
    }
  }, [editingExpense, isModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedDescription = formData.description.trim();
    const amountNum = parseFloat(formData.amount);

    if (!trimmedDescription) {
      alert("La description est obligatoire.");
      return;
    }

    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Veuillez saisir un montant valide supérieur à 0.");
      return;
    }

    const data = {
      description: trimmedDescription,
      amount: amountNum,
      category: formData.category,
      date: formData.date,
      user_id: user.uid,
      payment_method: formData.paymentMethod
    };

    try {
      if (editingExpense) {
        const { error } = await supabase.from('expenses').update(data).eq('id', editingExpense.id);
        if (error) throw error;
      } else {
        const newId = Math.random().toString(36).substring(2, 10);
        const { error } = await supabase.from('expenses').insert({ id: newId, ...data });
        if (error) throw error;
      }
      setIsModalOpen(false);
      setEditingExpense(null);
    } catch (error: any) {
      alert("Erreur: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    setExpenseToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!expenseToDelete) return;
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', expenseToDelete);
      if (error) throw error;
      setExpenseToDelete(null);
      setIsDeleteConfirmOpen(false);
    } catch (error: any) {
      alert("Erreur: " + error.message);
    }
  };

  const categories = ['Loyer', 'Électricité', 'Eau', 'Salaires', 'Fournitures', 'Marketing', 'Maintenance', 'Taxes', 'Autre'];

  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });

  const filteredExpenses = useMemo(() => {
    const raw = expenses.filter(e => {
      const matchesSearch = e.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    if (sortConfig !== null) {
      raw.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return raw;
  }, [expenses, search, categoryFilter, sortConfig]);

  const requestSort = (key: keyof Expense) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white uppercase tracking-wider">Gestionnaire de Dépenses</h3>
          <p className="text-sm text-white/40">Suivez les coûts opérationnels de votre magasin</p>
        </div>
        <Button onClick={() => { setEditingExpense(null); setIsModalOpen(true); }}>
          <Plus size={20} /> Nouvelle Dépense
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 md:col-span-1 bg-indigo-600 text-white shadow-xl shadow-indigo-500/20">
          <p className="text-xs font-bold uppercase tracking-wider opacity-80">Total Dépenses</p>
          <h4 className="text-3xl font-black mt-1">{totalExpenses.toFixed(2)} {settings.currency}</h4>
          <div className="mt-4 p-3 bg-white/10 rounded-lg">
            <p className="text-[10px] font-medium opacity-70">Période sélectionnée</p>
            <p className="text-xs font-bold">Toutes les dépenses</p>
          </div>
        </Card>

        <Card className="p-4 md:col-span-3 bg-white/5 border-white/10">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input 
                type="text"
                placeholder="Rechercher une dépense..."
                className="w-full pl-10 pr-4 py-2 bg-[#0a0a0f] border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-white font-bold"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="px-4 py-2 bg-[#0a0a0f] border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-white/60"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Toutes les catégories</option>
              {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden bg-white/5 border-white/10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 border-bottom border-white/10">
              <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} onSort={() => requestSort('date')} />
              <SortableHeader label="Description" sortKey="description" currentSort={sortConfig} onSort={() => requestSort('description')} />
              <SortableHeader label="Catégorie" sortKey="category" currentSort={sortConfig} onSort={() => requestSort('category')} />
              <SortableHeader label="Méthode" sortKey="paymentMethod" currentSort={sortConfig} onSort={() => requestSort('paymentMethod')} />
              <SortableHeader label="Montant" sortKey="amount" currentSort={sortConfig} onSort={() => requestSort('amount')} />
              <th className="p-4 text-xs font-bold text-white/20 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredExpenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 text-sm text-white/60 font-medium">
                  {formatSafe(expense.date, 'dd/MM/yyyy')}
                </td>
                <td className="p-4">
                  <p className="text-sm font-bold text-white uppercase tracking-tight">{expense.description}</p>
                </td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-white/10 text-white/40 rounded-lg text-[10px] font-black uppercase tracking-widest">
                    {expense.category}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-widest">
                    {expense.paymentMethod === 'card' ? <CreditCard size={14} /> : 
                     expense.paymentMethod === 'cash' ? <Banknote size={14} /> : <RefreshCw size={14} />}
                    <span>{expense.paymentMethod}</span>
                  </div>
                </td>
                <td className="p-4">
                  <p className="text-sm font-black text-rose-500 font-mono">-{expense.amount.toFixed(2)} {settings.currency}</p>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => { setEditingExpense(expense); setIsModalOpen(true); }} className="p-2 text-white/20 hover:text-indigo-400 transition-colors">
                      <FileText size={18} />
                    </button>
                    <button onClick={() => handleDelete(expense.id)} className="p-2 text-white/20 hover:text-rose-500 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredExpenses.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-white/20 uppercase tracking-widest">
                  <div className="flex flex-col items-center gap-2 opacity-20">
                    <TrendingDown size={48} strokeWidth={1} />
                    <p className="text-xs font-black">Aucune dépense trouvée</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingExpense ? "Modifier la dépense" : "Nouvelle dépense"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Description *</label>
            <input 
              required
              className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ex: Loyer Mars 2026"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Montant ({settings.currency}) *</label>
              <input 
                required
                type="number"
                step="0.01"
                className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Date *</label>
              <input 
                required
                type="date"
                className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Catégorie *</label>
              <select 
                required
                className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                <option value="">Sélectionner une catégorie</option>
                {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Méthode de Paiement *</label>
              <select 
                required
                className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.paymentMethod}
                onChange={e => setFormData({...formData, paymentMethod: e.target.value as any})}
              >
                <option value="cash">Espèces</option>
                <option value="card">Carte Bancaire</option>
                <option value="transfer">Virement</option>
              </select>
            </div>
          </div>

          <div className="pt-4">
            <Button type="submit" className="w-full py-3">
              {editingExpense ? "Enregistrer les modifications" : "Ajouter la dépense"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog 
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Supprimer la dépense"
        message="Êtes-vous sûr de vouloir supprimer cette dépense ? Cette action est irréversible."
      />
    </div>
  );
}
