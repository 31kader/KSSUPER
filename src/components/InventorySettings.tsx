import React, { useState } from 'react';
import { FolderTree, Award, Plus, LayoutGrid, List } from 'lucide-react';
import { Category, Brand } from '../types';
import { cn } from '../lib/utils';
import { Categories } from './Categories';
import { Brands } from './Brands';
import { Card } from './ui';

interface InventorySettingsProps {
  categories: Category[];
  brands: Brand[];
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
  onAddCategory: (parentId?: string) => void;
  onEditBrand: (brand: Brand) => void;
  onDeleteBrand: (brand: Brand) => void;
  onAddBrand: () => void;
}

export function InventorySettings({
  categories,
  brands,
  onEditCategory,
  onDeleteCategory,
  onAddCategory,
  onEditBrand,
  onDeleteBrand,
  onAddBrand
}: InventorySettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'categories' | 'brands'>('categories');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Classification & Structure</h2>
        <p className="text-slate-500 text-sm">Gérez l'organisation hiérarchique et les marques de votre inventaire.</p>
      </div>

      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveSubTab('categories')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
            activeSubTab === 'categories' 
              ? "bg-white text-indigo-600 shadow-sm" 
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <FolderTree size={18} />
          Catégories
          <span className="ml-1 bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{categories.length}</span>
        </button>
        <button
          onClick={() => setActiveSubTab('brands')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
            activeSubTab === 'brands' 
              ? "bg-white text-indigo-600 shadow-sm" 
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Award size={18} />
          Marques
          <span className="ml-1 bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{brands.length}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 min-h-[500px]">
        {activeSubTab === 'categories' ? (
          <Categories 
            categories={categories} 
            onEdit={onEditCategory} 
            onDelete={onDeleteCategory} 
            onAdd={onAddCategory} 
          />
        ) : (
          <Brands 
            brands={brands} 
            onEdit={onEditBrand} 
            onDelete={onDeleteBrand} 
            onAdd={onAddBrand} 
          />
        )}
      </div>
    </div>
  );
}
