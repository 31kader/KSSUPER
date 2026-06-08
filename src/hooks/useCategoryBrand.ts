import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Category, Brand, Product } from '../types';

export function useCategoryBrand(categories: Category[], products: Product[]) {
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [categoryImageUrl, setCategoryImageUrl] = useState('');
  
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandLogo, setNewBrandLogo] = useState('');
  const [newBrandDesc, setNewBrandDesc] = useState('');

  const openCategoryModal = (category?: Category | null) => {
    if (category) {
      setEditingCategory(category);
      setNewCategoryName(category.name);
      setParentCategoryId(category.parentId || '');
      setCategoryImageUrl(category.imageUrl || '');
    } else {
      setEditingCategory(null);
      setNewCategoryName('');
      setParentCategoryId('');
      setCategoryImageUrl('');
    }
    setIsCategoryModalOpen(true);
  };

  const openBrandModal = (brand?: Brand | null) => {
    if (brand) {
      setEditingBrand(brand);
      setNewBrandName(brand.name);
      setNewBrandLogo(brand.logoUrl || '');
      setNewBrandDesc(brand.description || '');
    } else {
      setEditingBrand(null);
      setNewBrandName('');
      setNewBrandLogo('');
      setNewBrandDesc('');
    }
    setIsBrandModalOpen(true);
  };

  const handleSaveCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      alert("Le nom de la catégorie est obligatoire.");
      return;
    }

    // Duplicate check
    const duplicate = categories.find(c => 
      c.name.toLowerCase() === trimmedName.toLowerCase() && 
      c.parentId === (parentCategoryId || null) &&
      c.id !== editingCategory?.id
    );

    if (duplicate) {
      alert(`Une catégorie nommée "${duplicate.name}" existe déjà à ce niveau.`);
      return;
    }

    try {
      if (editingCategory) {
        const { error } = await supabase.from('categories').update({
          name: trimmedName,
          parent_id: parentCategoryId || null,
          image_url: categoryImageUrl || null
        }).eq('id', editingCategory.id);
        
        if (error) throw error;
      } else {
        const newId = Math.random().toString(36).substring(2, 10);
        const { error } = await supabase.from('categories').insert({
          id: newId,
          name: trimmedName,
          parent_id: parentCategoryId || null,
          image_url: categoryImageUrl || null
        });
        
        if (error) throw error;
      }
      setIsCategoryModalOpen(false);
      setNewCategoryName('');
      setParentCategoryId('');
      setCategoryImageUrl('');
      setEditingCategory(null);
    } catch (error: any) {
      alert("Erreur: " + error.message);
    }
  };

  const handleDeleteCategory = async (categoryToDelete?: Category | null) => {
    const targetCategory = categoryToDelete || editingCategory;
    if (!targetCategory) return;
    const hasProducts = products.some(p => p.categoryId === targetCategory.id);
    if (hasProducts) {
      alert("Impossible de supprimer une catégorie contenant des produits.");
      return;
    }
    const hasSubcategories = categories.some(c => c.parentId === targetCategory.id);
    if (hasSubcategories) {
      alert("Impossible de supprimer une catégorie contenant des sous-catégories.");
      return;
    }
    try {
      const { error } = await supabase.from('categories').delete().eq('id', targetCategory.id);
      if (error) throw error;
      
      setIsCategoryModalOpen(false);
      setNewCategoryName('');
      setParentCategoryId('');
      setCategoryImageUrl('');
      setEditingCategory(null);
    } catch (error: any) {
      alert("Erreur: " + error.message);
    }
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const brandData = {
        name: newBrandName,
        logo_url: newBrandLogo,
        description: newBrandDesc
      };
      if (editingBrand) {
        const { error } = await supabase.from('brands').update(brandData).eq('id', editingBrand.id);
        if (error) throw error;
      } else {
        const newId = Math.random().toString(36).substring(2, 10);
        const { error } = await supabase.from('brands').insert({
          id: newId,
          ...brandData
        });
        if (error) throw error;
      }
      setIsBrandModalOpen(false);
      setEditingBrand(null);
      setNewBrandName('');
      setNewBrandLogo('');
      setNewBrandDesc('');
    } catch (err: any) {
      alert("Erreur: " + err.message);
    }
  };

  const handleDeleteBrand = async (brand: Brand) => {
    if (!window.confirm(`Supprimer la marque "${brand.name}" ?`)) return;
    try {
      const { error } = await supabase.from('brands').delete().eq('id', brand.id);
      if (error) throw error;
    } catch (err: any) {
      alert("Erreur: " + err.message);
    }
  };

  return {
    isCategoryModalOpen, setIsCategoryModalOpen,
    isBrandModalOpen, setIsBrandModalOpen,
    editingCategory, setEditingCategory,
    editingBrand, setEditingBrand,
    newCategoryName, setNewCategoryName,
    parentCategoryId, setParentCategoryId,
    categoryImageUrl, setCategoryImageUrl,
    newBrandName, setNewBrandName,
    newBrandLogo, setNewBrandLogo,
    newBrandDesc, setNewBrandDesc,
    openCategoryModal, openBrandModal,
    handleSaveCategory, handleDeleteCategory,
    handleSaveBrand, handleDeleteBrand
  }
}

