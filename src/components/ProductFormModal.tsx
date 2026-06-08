import React, { useState, useEffect } from 'react';
import { Search, Upload, Package, Trash2, Camera, ShoppingCart, ShoppingBag, X, Sparkles, RefreshCw, Plus, Mic, Loader2, Check } from 'lucide-react';
import { supabase } from '../supabase';
import { Award } from 'lucide-react';
import { Product, Category, CompanySettings, Brand } from '../types';
import { logAction } from '../lib/utils';
import { Modal, Button, SafeImage } from './ui';
import { cn, generateUniqueId } from '../lib/utils';
import { callGeminiAI } from '../services/geminiService';
import { BarcodeScanner } from './BarcodeScanner';

// Removed module-level AI initialization

function BundleItemSearchSelect({ 
  value, 
  onChange, 
  products,
  filterFn
}: { 
  value: string; 
  onChange: (val: string) => void; 
  products: Product[];
  filterFn?: (p: Product) => boolean;
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedProduct = products.find(p => p.id === value);
  const displayValue = selectedProduct ? selectedProduct.name : '';
  
  const filteredProducts = products.filter(p => {
    if (filterFn && !filterFn(p)) return false;
    const searchTerms = search.toLowerCase().trim().split(' ').filter(Boolean);
    if (searchTerms.length === 0) return true;
    return searchTerms.every(term => 
      p.name.toLowerCase().includes(term) || 
      p.sku.toLowerCase().includes(term) ||
      (p.barcode || '').toLowerCase().includes(term) ||
      (p.reference || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400/50" size={16} />
        <input 
          type="text" 
          placeholder="Rechercher par nom, SKU ou code..."
          className="w-full pl-11 pr-10 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-white/20 transition-all font-bold"
          value={isOpen ? search : displayValue}
          onFocus={() => { setIsOpen(true); setSearch(''); }}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
        />
        {value && !isOpen && (
           <button type="button" onClick={() => { onChange(''); setSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"><X size={16}/></button>
        )}
      </div>
      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-workspace border border-white/10 rounded-2xl shadow-2xl max-h-80 overflow-hidden flex flex-col backdrop-blur-xl">
          <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/5">
             <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] px-1">Résultats ({filteredProducts.length})</span>
             <button type="button" className="text-white/20 hover:text-white transition-colors p-1" onClick={() => { onChange(''); setIsOpen(false); }}>
               <X size={16} />
             </button>
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-white/20 italic">
              <Package size={24} className="mx-auto mb-2 opacity-10" />
              <p className="text-xs font-bold uppercase tracking-widest">Aucun produit</p>
            </div>
          ) : (
            filteredProducts.map(p => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left p-4 hover:bg-white/5 border-b border-white/5 last:border-0 flex items-center gap-4 transition-all group"
                onClick={() => {
                  onChange(p.id);
                  setIsOpen(false);
                }}
              >
                <div className="w-12 h-12 bg-industrial-800 rounded-xl flex-shrink-0 overflow-hidden border border-industrial-700 group-hover:border-indigo-500/50 transition-all shadow-lg">
                  {(() => {
                    const imgSrc = p.imageUrl || p.imageUrls?.[0];
                    return imgSrc && imgSrc.trim() !== '' ? (
                      <SafeImage 
                        src={imgSrc} 
                        alt={p.name} 
                        className="w-full h-full object-cover" 
                        fallback={<Package size={18} className="text-slate-500/20" />}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/10">
                        <Package size={20} />
                      </div>
                    );
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white uppercase tracking-wider truncate group-hover:text-indigo-400 transition-colors">{p.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono font-black text-white tracking-widest uppercase">{p.sku}</span>
                    <span className={cn(
                      "text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter",
                      p.stock <= (p.minStock || 5) ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    )}>
                      Stock: {p.stock}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-indigo-400">{p.price.toFixed(2)}</p>
                </div>
              </button>
            ))
          )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchableBrandSelect({ 
  value, 
  onChange, 
  brands,
  onManage
}: { 
  value: string; 
  onChange: (val: string) => void; 
  brands: Brand[];
  onManage?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedBrand = brands.find(b => b.id === value);
  const displayValue = selectedBrand ? selectedBrand.name : '';
  
  const filteredBrands = brands.filter(b => {
    const searchTerms = search.toLowerCase().trim().split(' ').filter(Boolean);
    if (searchTerms.length === 0) return true;
    return searchTerms.every(term => b.name.toLowerCase().includes(term));
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="relative flex-1">
      <div className="relative">
        <input 
          type="text" 
          placeholder="Rechercher une marque..."
          className="w-full pl-4 pr-10 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-white/20 transition-all font-bold"
          value={isOpen ? search : displayValue}
          onFocus={() => { setIsOpen(true); setSearch(''); }}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {value && !isOpen && (
            <button type="button" onClick={() => { onChange(''); setSearch(''); }} className="text-white/20 hover:text-white transition-colors">
               <X size={16}/>
            </button>
          )}
          <Search size={16} className="text-white/20" />
        </div>
      </div>
      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-workspace border border-white/10 rounded-2xl shadow-2xl max-h-80 overflow-hidden flex flex-col backdrop-blur-xl">
          <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/5">
             <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] px-1 flex-1">Marques ({filteredBrands.length})</span>
             {onManage && (
               <button type="button" onClick={onManage} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest px-2 transition-colors">Gérer</button>
             )}
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1">
          {filteredBrands.length === 0 ? (
            <div className="p-8 text-center text-white/20 italic">
              <Award size={24} className="mx-auto mb-2 opacity-10" />
              <p className="text-xs font-bold uppercase tracking-widest">Aucune marque</p>
            </div>
          ) : (
            filteredBrands.map(b => (
              <button
                key={b.id}
                type="button"
                className={cn(
                  "w-full text-left p-3 hover:bg-white/5 border-b border-white/5 last:border-0 flex items-center gap-4 transition-all group",
                  value === b.id ? "bg-indigo-500/10" : ""
                )}
                onClick={() => {
                  onChange(b.id);
                  setIsOpen(false);
                  setSearch('');
                }}
              >
                <div className="w-8 h-8 bg-industrial-800 rounded-lg flex-shrink-0 overflow-hidden border border-industrial-700 group-hover:border-indigo-500/50 transition-all shadow-md">
                  {b.logoUrl ? (
                    <img src={b.logoUrl} alt={b.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/10">
                      <Award size={14} />
                    </div>
                  )}
                </div>
                <span className="text-sm font-black text-white uppercase tracking-wider truncate group-hover:text-indigo-400 transition-colors">{b.name}</span>
              </button>
            ))
          )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  products: Product[];
  categories: Category[];
  settings: CompanySettings;
  user: any;
  brands: Brand[];
  setIsPurchaseHistoryModalOpen?: (v: boolean) => void;
  setIsSalesHistoryModalOpen?: (v: boolean) => void;
  setActiveTab?: (tab: string) => void;
}

export function ProductFormModal({
  isOpen, onClose, editingProduct, products, categories, settings, user, brands,
  setIsPurchaseHistoryModalOpen, setIsSalesHistoryModalOpen, setActiveTab
}: ProductFormModalProps) {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isVoiceScanning, setIsVoiceScanning] = useState(false);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [skuError, setSkuError] = useState<string | null>(null);
  const [parentCatId, setParentCatId] = useState<string>('');
  const [subCatId, setSubCatId] = useState<string>('');
  const [displayExpDate, setDisplayExpDate] = useState('');
  const [formData, setFormData] = useState({
    name: '', price: '', costPrice: '', taxRate: settings?.taxRate?.toString() || '0', 
    stock: '', minStock: '5', categoryId: '', brandId: '', supplier: '', 
    unit: 'unité', sku: '', status: 'active', imageUrl: '', description: '',
    imageUrls: [] as string[],
    isBundle: false, wholesalePrice: '', onlinePrice: '', tags: '', location: '', reference: '', expirationDate: '', batchNumber: '', showInPos: true, bundleItems: [] as { productId: string; quantity: number }[],
    parentId: '', unitsPerParent: '', autoUnpack: false,
    quantityDiscounts: [] as { minQuantity: number; discountPrice: number }[],
    operationalCosts: { packaging: '', shipping: '', other: '' }
  });

  // SKU Uniqueness validation
  useEffect(() => {
    if (!formData.sku) {
      setSkuError(null);
      return;
    }
    const duplicate = products.find(p => p.sku === formData.sku && p.id !== editingProduct?.id);
    if (duplicate) {
      setSkuError(`Ce code-barre est déjà utilisé par le produit : "${duplicate.name}"`);
    } else {
      setSkuError(null);
    }
  }, [formData.sku, products, editingProduct]);

  const formatDisplayDate = (isoDate: string) => {
    if (!isoDate) return '';
    try {
      const [y, m, d] = isoDate.split('-');
      if (!y || !m || !d) return '';
      return `${d} ${m} ${y.substring(2)}`;
    } catch (e) {
      return '';
    }
  };

  const parseDisplayDate = (display: string) => {
    const numbers = display.replace(/\D/g, '');
    if (numbers.length < 6) return '';
    
    const day = numbers.substring(0, 2);
    const month = numbers.substring(2, 4);
    let year = numbers.substring(4, 6);
    
    if (parseInt(day) > 31 || parseInt(month) > 12) return '';
    
    const fullYear = `20${year}`;
    return `${fullYear}-${month}-${day}`;
  };

  useEffect(() => {
    if (editingProduct) {
      const currentCat = categories.find(c => c.id === editingProduct.categoryId);
      if (currentCat && currentCat.parentId) {
        setParentCatId(currentCat.parentId);
        setSubCatId(currentCat.id);
      } else {
        setParentCatId(editingProduct.categoryId || '');
        setSubCatId('');
      }

      setDisplayExpDate(formatDisplayDate(editingProduct.expirationDate || ''));
      setFormData({
        name: editingProduct.name || '',
        price: (editingProduct.price ?? '').toString(),
        costPrice: (editingProduct.costPrice ?? 0).toString(),
        taxRate: (editingProduct.taxRate ?? settings?.taxRate ?? 0).toString(),
        stock: (editingProduct.stock ?? 0).toString(),
        minStock: (editingProduct.minStock ?? 5).toString(),
        categoryId: editingProduct.categoryId || '',
        brandId: editingProduct.brandId || '',
        supplier: editingProduct.supplier || '',
        unit: editingProduct.unit || 'unité',
        sku: editingProduct.sku || '',
        status: editingProduct.status || 'active',
        imageUrl: editingProduct.imageUrl || '',
        imageUrls: editingProduct.imageUrls || (editingProduct.imageUrl ? [editingProduct.imageUrl] : []),
        description: editingProduct.description || '',
        isBundle: editingProduct.isBundle || false,
        wholesalePrice: (editingProduct.wholesalePrice ?? '').toString(),
        onlinePrice: (editingProduct.onlinePrice ?? '').toString(),
        tags: (editingProduct.tags || []).join(', '),
        location: editingProduct.location || '',
        reference: editingProduct.reference || '',
        batchNumber: editingProduct.batchNumber || '',
        parentId: editingProduct.parentId || '',
        unitsPerParent: editingProduct.unitsPerParent?.toString() || '',
        autoUnpack: editingProduct.autoUnpack || false,
        expirationDate: editingProduct.expirationDate || '',
        showInPos: editingProduct.showInPos !== false,
        bundleItems: editingProduct.bundleItems || [],
        quantityDiscounts: editingProduct.quantityDiscounts || [],
        operationalCosts: {
          packaging: editingProduct.operationalCosts?.packaging?.toString() || '',
          shipping: editingProduct.operationalCosts?.shipping?.toString() || '',
          other: editingProduct.operationalCosts?.other?.toString() || ''
        }
      });
    } else {
      setParentCatId('');
      setSubCatId('');
      setDisplayExpDate('');
      setFormData({ 
        name: '', price: '', costPrice: '', taxRate: settings?.taxRate?.toString() || '0', 
        stock: '', minStock: '5', categoryId: '', brandId: '', supplier: '', 
        unit: 'unité', sku: '', status: 'active', imageUrl: '', description: '',
        imageUrls: [],
        isBundle: false, wholesalePrice: '', onlinePrice: '', tags: '', location: '', reference: '', expirationDate: '', batchNumber: '', showInPos: true, bundleItems: [], quantityDiscounts: [],
        operationalCosts: { packaging: '', shipping: '', other: '' },
        parentId: '', unitsPerParent: '1', autoUnpack: false
      });
    }
  }, [editingProduct, settings?.taxRate, isOpen]);

  const handleDisplayDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 6) val = val.substring(0, 6);
    
    let formatted = '';
    if (val.length > 0) formatted += val.substring(0, 2);
    if (val.length > 2) formatted += ' ' + val.substring(2, 4);
    if (val.length > 4) formatted += ' ' + val.substring(4, 6);
    
    setDisplayExpDate(formatted);
    if (val.length === 6) {
      const iso = parseDisplayDate(formatted);
      setFormData(prev => ({ ...prev, expirationDate: iso }));
    } else {
      setFormData(prev => ({ ...prev, expirationDate: '' }));
    }
  };

  // SKU Global Lookup (OpenFoodFacts)
  useEffect(() => {
    const lookupBarcode = async (barcode: string) => {
      if (!barcode || barcode.length < 8) return;
      
      // Don't lookup if we already have a name or if it's already in the DB
      if (formData.name && products.find(p => p.sku === barcode)) return;

      setIsGlobalLoading(true);
      try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        const data = await response.json();

        if (data.status === 1 && data.product) {
          const product = data.product;
          
          setFormData(prev => ({
            ...prev,
            name: prev.name || product.product_name || product.product_name_fr || '',
            description: prev.description || product.generic_name || product.generic_name_fr || '',
            imageUrl: prev.imageUrl || product.image_url || product.image_front_url || '',
            imageUrls: (product.image_url || product.image_front_url) 
              ? [product.image_url || product.image_front_url, ...prev.imageUrls].slice(0, 5) 
              : prev.imageUrls
          }));

          // Try to find matching category
          if (product.categories) {
            const worldCategories = product.categories.split(',');
            for (const worldCat of worldCategories) {
              const matchedCat = categories.find(c => 
                c.name.toLowerCase().includes(worldCat.trim().toLowerCase()) || 
                worldCat.trim().toLowerCase().includes(c.name.toLowerCase())
              );
              if (matchedCat) {
                setFormData(prev => ({ ...prev, categoryId: matchedCat.id }));
                break;
              }
            }
          }
        }
      } catch (error) {
        console.warn("[Barcode Lookup Info] External API lookup bypassed or offline:", error);
      } finally {
        setIsGlobalLoading(false);
      }
    };

    const timer = setTimeout(() => {
      lookupBarcode(formData.sku);
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.sku, categories, products]);

  // Voice Recognition & AI Parsing
  const startVoiceEntry = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      alert("La reconnaissance vocale n'est pas supportée par votre navigateur.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsVoiceScanning(true);
    recognition.start();

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      recognition.stop();
      setIsVoiceScanning(false);

      if (!transcript) return;

      // Use AI to parse the transcript
      setIsGeneratingDescription(true); 
      try {
        const systemPrompt = `L'utilisateur a dit: "${transcript}". 
        Extrais les informations du produit au format JSON: 
        {"name": "Nom du produit", "price": "Prix numérique", "description": "Brève description", "quantity": "quantité si mentionnée"}.
        Si une information manque, mets null.
        Réponds uniquement au format JSON strict.`;

        const responseText = await callGeminiAI({}, "Extrais le JSON du produit.", systemPrompt);
        const result = JSON.parse(responseText.replace(/```json|```/g, '').trim());
        
        setFormData(prev => ({
          ...prev,
          name: result.name || prev.name,
          price: result.price?.toString() || prev.price,
          description: result.description || prev.description
        }));
      } catch (error) {
        console.error("Voice AI parsing error:", error);
      } finally {
        setIsGeneratingDescription(false);
      }
    };

    recognition.onerror = () => {
      setIsVoiceScanning(false);
      recognition.stop();
    };

    recognition.onend = () => {
      setIsVoiceScanning(false);
    };
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      // Do not submit the form if "Enter" is pressed inside an input field or general select/textarea.
      // This prevents barcode scanners (which trigger Enter at the end of scan) from closing the sheet prematurely.
      if (
        (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'submit') ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        e.preventDefault();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    const trimmedName = formData.name.trim();
    const trimmedSku = formData.sku.trim();
    
    if (!trimmedName) {
      alert("Le nom du produit est obligatoire.");
      return;
    }
    
    if (skuError) {
      alert("Veuillez corriger l'erreur de SKU/Code-barre.");
      return;
    }

    const newPrice = parseFloat(formData.price || '0');
    const newCostPrice = parseFloat(formData.costPrice || '0');
    const newStock = parseFloat(formData.stock || '0');
    
    if (newPrice < 0 || newCostPrice < 0) {
      alert("Les prix ne peuvent pas être négatifs.");
      return;
    }

    if (newStock < -1000) { // arbitrary limit to prevent massive errors
      alert("La valeur de stock semble incorrecte.");
      return;
    }
    
    let priceHistory = editingProduct?.priceHistory || [];
    
    if (editingProduct && (editingProduct.price !== newPrice || editingProduct.costPrice !== newCostPrice)) {
      priceHistory = [
        {
          price: editingProduct.price,
          costPrice: editingProduct.costPrice || 0,
          timestamp: new Date().toISOString(),
          reason: 'Mise à jour manuelle'
        },
        ...priceHistory
      ].slice(0, 50);
    }

    const data = {
      ...formData,
      name: trimmedName,
      sku: trimmedSku,
      price: newPrice,
      costPrice: newCostPrice,
      taxRate: parseFloat(formData.taxRate || '0'),
      stock: newStock,
      minStock: parseFloat(formData.minStock || '5'),
      unitsPerParent: formData.unitsPerParent ? parseFloat(formData.unitsPerParent) : null,
      parentId: formData.parentId || null,
      autoUnpack: !!formData.autoUnpack,
      wholesalePrice: formData.wholesalePrice ? parseFloat(formData.wholesalePrice) : null,
      onlinePrice: formData.onlinePrice ? parseFloat(formData.onlinePrice) : null,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      categoryId: subCatId || parentCatId || '',
      updatedAt: new Date().toISOString(),
      priceHistory,
      operationalCosts: {
        packaging: formData.operationalCosts.packaging ? parseFloat(formData.operationalCosts.packaging) : null,
        shipping: formData.operationalCosts.shipping ? parseFloat(formData.operationalCosts.shipping) : null,
        other: formData.operationalCosts.other ? parseFloat(formData.operationalCosts.other) : null,
      }
    };
    delete (data as any).category;

    try {
      if (editingProduct && editingProduct.id) {
        const updatedProduct = {
          ...editingProduct,
          ...data,
          id: editingProduct.id
        } as Product;
        
        // Optimistic local state update first
        window.dispatchEvent(new CustomEvent('product-cache-update', { detail: updatedProduct }));
        
        // Non-blocking Supabase update
        supabase.from('products').update(data).eq('id', editingProduct.id)
          .then(({ error }) => {
            if (error) console.error("Error updating product:", error);
          });
          
        logAction(user?.uid || 'admin', user?.displayName || 'Utilisateur', 'Modification Produit', 'Inventaire', `Produit: ${data.name}, SKU: ${data.sku}`);
      } else {
        const newProductId = Math.random().toString(36).substring(2, 11);
        const createdProduct = {
          ...data,
          id: newProductId,
          createdAt: new Date().toISOString()
        } as Product;
        
        // Optimistic local state update first
        window.dispatchEvent(new CustomEvent('product-cache-update', { detail: createdProduct }));
        
        // Non-blocking Supabase insert
        supabase.from('products').insert(createdProduct)
          .then(({ error }) => {
            if (error) console.error("Error creating product:", error);
          });

        logAction(user?.uid || 'admin', user?.displayName || 'Utilisateur', 'Création Produit', 'Inventaire', `Produit: ${data.name}, SKU: ${data.sku}`);
      }
      onClose();
    } catch (error: any) {
      console.error("Error submitting product:", error);
      alert("Erreur: " + error.message);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 640;
        const MAX_HEIGHT = 640;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convert to WebP with 0.5 quality for ultimate storage efficiency, fallback to JPEG if not supported
        let result = canvas.toDataURL('image/webp', 0.5);
        if (!result.startsWith('data:image/webp')) {
          result = canvas.toDataURL('image/jpeg', 0.5);
        } 

        if (index !== undefined) {
          const newUrls = [...formData.imageUrls];
          newUrls[index] = result;
          setFormData({ ...formData, imageUrls: newUrls, imageUrl: newUrls[0] || '' });
        } else if (formData.imageUrls.length < 5) {
          const newUrls = [...formData.imageUrls, result];
          setFormData({ ...formData, imageUrls: newUrls, imageUrl: newUrls[0] || '' });
        } else {
          setFormData({...formData, imageUrl: result});
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (index: number) => {
    const newUrls = formData.imageUrls.filter((_, i) => i !== index);
    setFormData({ ...formData, imageUrls: newUrls, imageUrl: newUrls[0] || '' });
  };

  const generateAiDescription = async () => {
    if (!formData.name) {
      alert("Veuillez d'abord saisir le nom du produit.");
      return;
    }
    setIsGeneratingDescription(true);
    try {
      const brandName = brands.find(b => b.id === formData.brandId)?.name || '';
      const userPrompt = `Génère une description courte et attractive (environ 100-150 caractères) pour un produit nommé "${formData.name}"${brandName ? ` de la marque "${brandName}"` : ''}. Le ton doit être professionnel et accrocheur. Réponds uniquement avec la description.`;
      
      const responseText = await callGeminiAI({}, userPrompt);
      if (responseText) {
        setFormData({ ...formData, description: responseText.trim() });
      }
    } catch (error: any) {
      console.error("Error generating description:", error);
      const errorMessage = error.message || String(error);
      if (errorMessage.includes("Quota atteint") || errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("credits")) {
        alert("Impossible de générer la description : Votre quota d'utilisation de l'IA (ou vos crédits Google AI Studio) est épuisé.");
      } else {
        alert(`Erreur lors de la génération de la description : ${errorMessage}`);
      }
    } finally {
      setIsGeneratingDescription(false);
    }
  };
  
  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={editingProduct ? "Modifier l'article" : "Nouvel article"}
        maxWidth="max-w-[95vw] lg:max-w-[1200px]"
        maxHeight="max-h-[90vh]"
      >
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-8 max-h-[82vh] overflow-y-auto pr-2 custom-scrollbar bg-industrial-950 p-6 rounded-[2.5rem]">
          {/* Section: Informations de base */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Nom du produit *</label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input 
                    required 
                    className="industrial-input w-full" 
                    placeholder="Nom de l'article..."
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button 
                      type="button"
                      onClick={startVoiceEntry}
                      disabled={isVoiceScanning}
                      className={cn(
                        "p-2 rounded-xl transition-all",
                        isVoiceScanning ? "text-rose-500 animate-pulse bg-rose-500/10" : "text-white/20 hover:text-indigo-400 hover:bg-indigo-400/10"
                      )}
                      title="Saisie vocale intelligente"
                    >
                      <Mic size={18} />
                    </button>

                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">SKU / Code-barre</label>
              <div className="relative">
                <input 
                  className={cn(
                    "industrial-input w-full pr-24",
                    skuError ? 'border-rose-500 ring-4 ring-rose-500/10' : ''
                  )}
                  placeholder="Scanner ou saisir..."
                  value={formData.sku} 
                  onChange={e => setFormData({...formData, sku: e.target.value})} 
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {isGlobalLoading && <Loader2 size={16} className="text-indigo-400 animate-spin" />}
                  <button 
                    type="button" 
                    onClick={() => setFormData({...formData, sku: `SKU-${generateUniqueId()}`})}
                    className="p-1.5 text-white/20 hover:text-indigo-400 transition-colors"
                    title="Générer SKU"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsScannerOpen(true)}
                    className="p-3 bg-white/5 text-white/40 hover:text-indigo-400 hover:bg-white/10 rounded-xl transition-all"
                    title="Scanner code-barres"
                  >
                    <Camera size={20} />
                  </button>
                </div>
              </div>
              {skuError && <p className="text-[10px] font-black text-rose-400 animate-pulse tracking-wide mt-1 pl-2">{skuError}</p>}
              {!skuError && isGlobalLoading && <p className="text-[9px] text-indigo-400 font-black animate-pulse uppercase tracking-widest pl-2">Recherche globale...</p>}
            </div>
          </div>

          {/* Section: Prix et Taxes */}
          <div className="bg-industrial-900 p-6 rounded-[2rem] border border-industrial-800 grid grid-cols-2 md:grid-cols-4 gap-6 shadow-xl">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Prix Vente ({settings?.currency}) *</label>
              <input required type="number" step="0.01" className="industrial-input w-full" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Prix Ligne ({settings?.currency})</label>
              <input type="number" step="0.01" className="industrial-input w-full" value={formData.onlinePrice} onChange={e => setFormData({...formData, onlinePrice: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Prix Achat ({settings?.currency})</label>
              <input type="number" step="0.01" className="industrial-input w-full" value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">TVA (%)</label>
              <input type="number" className="industrial-input w-full" value={formData.taxRate} onChange={e => setFormData({...formData, taxRate: e.target.value})} />
            </div>
          </div>

          {/* Section: Stock */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Stock Actuel *</label>
              <input required type="number" className="industrial-input w-full" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Seuil d'alerte</label>
              <input type="number" className="industrial-input w-full" value={formData.minStock} onChange={e => setFormData({...formData, minStock: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Unité</label>
              <input className="industrial-input w-full" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Expiration (JJ MM AA)</label>
              <input 
                type="text" 
                inputMode="numeric"
                className="industrial-input w-full text-center font-mono text-lg tracking-widest" 
                placeholder="10 10 26"
                value={displayExpDate} 
                onChange={handleDisplayDateChange} 
              />
            </div>
            <div className="space-y-2 col-span-2 lg:col-span-1">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">N° Lot / Batch</label>
              <input 
                className="industrial-input w-full text-center font-mono uppercase" 
                placeholder="LOT-X8" 
                value={formData.batchNumber} 
                onChange={e => setFormData({...formData, batchNumber: e.target.value})} 
              />
            </div>
          </div>

          {/* Section: Classification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex justify-between items-center group">
                Marque
                {setActiveTab && <button type="button" onClick={() => { onClose(); setActiveTab('inventory_settings'); }} className="text-indigo-400 hover:text-indigo-300 transition-colors font-black">+ Gérer</button>}
              </label>
              <SearchableBrandSelect 
                value={formData.brandId} 
                onChange={(val) => setFormData({...formData, brandId: val})} 
                brands={brands}
                onManage={setActiveTab ? () => { onClose(); setActiveTab('inventory_settings'); } : undefined}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex justify-between items-center">
                Catégorie (Principale)
                {setActiveTab && <button type="button" onClick={() => { onClose(); setActiveTab('inventory_settings'); }} className="text-indigo-400 hover:text-indigo-300 transition-colors font-black">+ Gérer</button>}
              </label>
              <select className="industrial-input w-full cursor-pointer" value={parentCatId} onChange={e => { setParentCatId(e.target.value); setSubCatId(''); }}>
                <option value="" className="bg-industrial-900 text-white/30">Sélectionner une catégorie</option>
                {categories.filter(c => !c.parentId).map((c: any) => (
                  <option key={c.id} value={c.id} className="bg-industrial-900 text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white bg-indigo-600/20 px-2 py-0.5 rounded-md inline-block uppercase tracking-[0.2em]">SOUS-CATÉGORIE *</label>
              <select 
                className={cn(
                  "industrial-input w-full cursor-pointer disabled:opacity-30 border-2",
                  parentCatId ? "border-indigo-500/50" : "border-white/5"
                )}
                value={subCatId} 
                disabled={!parentCatId}
                onChange={e => setSubCatId(e.target.value)}
              >
                <option value="" className="bg-industrial-900 text-white/30">Sélectionner une sous-catégorie</option>
                {categories.filter(c => c.parentId === parentCatId).map((c: any) => (
                  <option key={c.id} value={c.id} className="bg-industrial-900 text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Statut</label>
              <select className="industrial-input w-full cursor-pointer" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                <option value="active" className="bg-industrial-900 text-white">Actif</option>
                <option value="inactive" className="bg-industrial-900 text-white">Inactif</option>
                <option value="discontinued" className="bg-industrial-900 text-white">Arrêté</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Emplacement (Rayon/Étagère)</label>
              <input className="industrial-input w-full" placeholder="Ex: A-12, B-05..." value={formData.location} onChange={e => setFormData({...formData, location: e.target.value.toUpperCase()})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Référence (Modèle / Code Interne)</label>
              <input className="industrial-input w-full" placeholder="Ex: REF-2024-X1" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
            </div>
          </div>

          {(setIsPurchaseHistoryModalOpen || setIsSalesHistoryModalOpen) && (
          <div className="flex gap-4 p-2">
            {setIsPurchaseHistoryModalOpen && <Button type="button" variant="secondary" className="flex-1 py-4 uppercase tracking-[0.2em] text-[10px]" onClick={() => setIsPurchaseHistoryModalOpen(true)}>Historique Achats</Button>}
            {setIsSalesHistoryModalOpen && <Button type="button" variant="secondary" className="flex-1 py-4 uppercase tracking-[0.2em] text-[10px]" onClick={() => setIsSalesHistoryModalOpen(true)}>Historique Ventes</Button>}
          </div>
          )}

          <div className="space-y-4">
            <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Images du produit (Max 5)</label>
            <div className="flex flex-wrap gap-4">
              {formData.imageUrls.map((url, idx) => (
                <div key={`product-img-${idx}`} className="relative group w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-industrial-800 border border-industrial-700 overflow-hidden shadow-2xl transition-all hover:border-indigo-500/50">
                  <SafeImage 
                    src={url} 
                    className="w-full h-full object-cover" 
                    fallback={<Package size={24} className="text-white/10" />}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                    <button type="button" onClick={() => removeImage(idx)} className="p-3 bg-rose-500 text-white rounded-2xl hover:bg-rose-600 shadow-lg active:scale-95">
                      <Trash2 size={20} />
                    </button>
                  </div>
                  {idx === 0 && <span className="absolute top-2 left-2 bg-indigo-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-lg ring-1 ring-white/20">Principale</span>}
                </div>
              ))}
              
              {formData.imageUrls.length < 5 && (
                <label className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-white/20 hover:text-indigo-400 group">
                  <Plus size={24} className="group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black mt-2 uppercase tracking-widest">Ajouter</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e)} />
                </label>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="flex-1 cursor-pointer min-w-[140px]">
                <div className="flex items-center justify-center w-full gap-2 px-4 py-3 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl text-[10px] font-black text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all uppercase tracking-widest shadow-lg">
                  <Camera size={18} /> <span className="hidden sm:inline">Prendre une photo</span><span className="sm:hidden">Photo</span>
                </div>
                <input type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => handleImageUpload(e)} />
              </label>
              
              <button 
                type="button"
                onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(formData.name)}&tbm=shop`, '_blank')}
                className="flex flex-1 min-w-[140px] items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white/60 hover:bg-white/10 hover:text-white transition-all uppercase tracking-widest shadow-lg"
              >
                <ShoppingCart size={18} className="text-rose-500" /> <span className="hidden sm:inline">Google Shopping</span><span className="sm:hidden">GShop</span>
              </button>
            </div>
            
            <div className="space-y-2">
              <label className="text-[9px] font-black text-white uppercase tracking-widest pl-2">Ou URL directe</label>
              <div className="flex gap-2">
                <input 
                  placeholder="Coller l'URL de l'image ici..." 
                  className="flex-1 p-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 font-bold placeholder:text-white/10 transition-all" 
                  value={formData.imageUrl} 
                  onChange={e => setFormData({...formData, imageUrl: e.target.value})} 
                />
                <button 
                  type="button" 
                  onClick={() => {
                    if (formData.imageUrl && !formData.imageUrls.includes(formData.imageUrl) && formData.imageUrls.length < 5) {
                      setFormData({...formData, imageUrls: [...formData.imageUrls, formData.imageUrl], imageUrl: ''});
                    }
                  }}
                  className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg active:scale-95"
                  disabled={!formData.imageUrl || formData.imageUrls.length >= 5}
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center justify-between">
              Description détaillée
              <button 
                type="button"
                onClick={generateAiDescription}
                disabled={isGeneratingDescription}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[9px] font-black text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all uppercase tracking-[0.1em] disabled:opacity-50 group"
              >
                {isGeneratingDescription ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} className="group-hover:scale-110 transition-transform" />}
                Générer par IA
              </button>
            </label>
            <textarea rows={4} className="industrial-input w-full rounded-3xl" placeholder="Décrivez votre produit ici..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Tags / Mots-clés (séparés par des virgules)</label>
            <input className="industrial-input w-full" placeholder="Ex: bio, promotion, été..." value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} />
          </div>

          <div className="flex items-center gap-4 p-6 bg-industrial-900 rounded-3xl border border-industrial-800 shadow-inner group transition-all hover:bg-industrial-800/50">
            <input type="checkbox" id="showInPos" checked={formData.showInPos} onChange={e => setFormData({...formData, showInPos: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded-lg focus:ring-indigo-500 bg-industrial-800 border-industrial-700" />
            <label htmlFor="showInPos" className="text-xs font-black text-white uppercase tracking-widest cursor-pointer select-none">Afficher cet article dans la grille de la caisse</label>
          </div>

          {/* Advanced Options */}
          <div className="border-t border-white/5 pt-8 space-y-6">
            <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em]">Options Avancées & Frais</h4>
            
            <div className="space-y-4">
              <p className="text-[9px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                <span className="w-4 h-px bg-white/10"></span>
                Frais Opérationnels Spécifiques (Marge Net)
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest pl-2">Emballage</label>
                  <input 
                    type="number" step="0.01" 
                    placeholder={settings?.operationalCosts?.basePackaging?.toString() || '0.00'}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 font-bold placeholder:text-white/10"
                    value={formData.operationalCosts.packaging}
                    onChange={e => setFormData({...formData, operationalCosts: {...formData.operationalCosts, packaging: e.target.value}})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest pl-2">Transport</label>
                  <input 
                    type="number" step="0.01" 
                    placeholder={settings?.operationalCosts?.baseShipping?.toString() || '0.00'}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 font-bold placeholder:text-white/10"
                    value={formData.operationalCosts.shipping}
                    onChange={e => setFormData({...formData, operationalCosts: {...formData.operationalCosts, shipping: e.target.value}})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest pl-2">Autre</label>
                  <input 
                    type="number" step="0.01" 
                    placeholder="0.00"
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 font-bold placeholder:text-white/10"
                    value={formData.operationalCosts.other}
                    onChange={e => setFormData({...formData, operationalCosts: {...formData.operationalCosts, other: e.target.value}})}
                  />
                </div>
              </div>
              <p className="text-[9px] text-white/30 italic pl-2 tracking-wide font-medium">Si vide, les frais généraux définis dans les paramètres seront utilisés.</p>
            </div>

            <div className="flex items-center gap-4 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={formData.isBundle} onChange={e => setFormData({...formData, isBundle: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded-lg bg-industrial-800 border-industrial-700 focus:ring-indigo-500" />
                <span className="text-xs font-black text-white uppercase tracking-widest">C'est un Lot / Composition</span>
              </label>
            </div>

            {formData.isBundle && (
              <div className="bg-indigo-600/5 p-6 rounded-3xl border border-indigo-500/20 space-y-4 shadow-inner">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-indigo-400" />
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Composants du lot</p>
                </div>
                {formData.bundleItems.map((item, idx) => (
                  <div key={`bundle-item-${idx}`} className="flex gap-3 items-center">
                    <BundleItemSearchSelect
                      value={item.productId}
                      products={products}
                      filterFn={p => !p.isBundle}
                      onChange={val => {
                        const newItems = [...formData.bundleItems];
                        newItems[idx].productId = val;
                        setFormData({...formData, bundleItems: newItems});
                      }}
                    />
                    <div className="w-24">
                      <input type="number" placeholder="Qté" className="w-full p-3.5 bg-industrial-800 border border-indigo-500/30 rounded-2xl text-sm text-white focus:ring-2 focus:ring-indigo-500/50 font-black" value={item.quantity} onChange={e => { const newItems = [...formData.bundleItems]; newItems[idx].quantity = parseFloat(e.target.value) || 0; setFormData({...formData, bundleItems: newItems}); }} />
                    </div>
                    <button type="button" onClick={() => { const newItems = formData.bundleItems.filter((_, i) => i !== idx); setFormData({...formData, bundleItems: newItems}); }} className="p-3.5 text-rose-400 hover:bg-rose-500 hover:text-white transition-all rounded-2xl border border-rose-500/20 active:scale-90"><Trash2 size={18} /></button>
                  </div>
                ))}
                <button type="button" className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest pl-2" onClick={() => setFormData({...formData, bundleItems: [...formData.bundleItems, { productId: '', quantity: 1 }]})}>+ Ajouter un composant</button>
              </div>
            )}

            <div className="space-y-6 pt-6 border-t border-white/5">
              <div className="flex items-center gap-3">
                <RefreshCw size={16} className="text-indigo-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Lien Mère-Fils (Désemballage Automatique)</h3>
              </div>
              <p className="text-[10px] text-white/40 leading-relaxed font-medium">Configurez ce produit comme une "unité" d'un "carton" parent. Pratique pour les ventes à l'unité de produits reçus en gros.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest pl-2">Produit Parent (ex: Carton)</label>
                  <BundleItemSearchSelect
                    value={formData.parentId}
                    products={products}
                    filterFn={p => !p.parentId && p.id !== editingProduct?.id}
                    onChange={val => setFormData({...formData, parentId: val})}
                  />
                </div>
                {formData.parentId && (
                  <div className="space-y-2 animate-in slide-in-from-right duration-300">
                    <label className="text-[10px] font-black text-white uppercase tracking-widest pl-2">Unités par Parent</label>
                    <input 
                      type="number" 
                      min="1"
                      className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-black" 
                      value={formData.unitsPerParent} 
                      onChange={e => setFormData({...formData, unitsPerParent: e.target.value})}
                      placeholder="Ex: 24"
                    />
                  </div>
                )}
              </div>
              
              {formData.parentId && (
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-white/5 rounded-2xl border border-white/5 transition-all hover:bg-white/10 group">
                  <input type="checkbox" checked={formData.autoUnpack} onChange={e => setFormData({...formData, autoUnpack: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded-lg bg-industrial-800 border-industrial-700 focus:ring-indigo-500" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest leading-normal">Désemballage automatique lors d'une vente si le stock est épuisé</span>
                </label>
              )}
            </div>

            <div className="space-y-6 pt-6 border-t border-white/5">
              <p className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Tarification Spéciale</p>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white uppercase tracking-widest pl-2">Prix de gros ({settings?.currency})</label>
                <input type="number" step="0.01" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 font-black shadow-inner" value={formData.wholesalePrice} onChange={e => setFormData({...formData, wholesalePrice: e.target.value})} />
              </div>
              
              <div className="space-y-4">
                <p className="text-[10px] font-black text-white uppercase tracking-widest pl-2">Remises par quantité</p>
                {formData.quantityDiscounts.map((discount, idx) => (
                  <div key={`discount-${idx}`} className="flex gap-3 items-center group">
                    <div className="flex-1">
                      <input type="number" placeholder="Qté min" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-white focus:ring-2 focus:ring-indigo-500/50 font-bold" value={discount.minQuantity} onChange={e => { const newDiscounts = [...formData.quantityDiscounts]; newDiscounts[idx].minQuantity = parseFloat(e.target.value) || 0; setFormData({...formData, quantityDiscounts: newDiscounts}); }} />
                    </div>
                    <div className="flex-1">
                      <input type="number" step="0.01" placeholder="Prix remisé" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-white focus:ring-2 focus:ring-indigo-500/50 font-black text-indigo-400" value={discount.discountPrice} onChange={e => { const newDiscounts = [...formData.quantityDiscounts]; newDiscounts[idx].discountPrice = parseFloat(e.target.value) || 0; setFormData({...formData, quantityDiscounts: newDiscounts}); }} />
                    </div>
                    <button type="button" onClick={() => { const newDiscounts = formData.quantityDiscounts.filter((_, i) => i !== idx); setFormData({...formData, quantityDiscounts: newDiscounts}); }} className="p-4 text-rose-400 hover:bg-rose-500 hover:text-white transition-all rounded-2xl border border-rose-500/20 active:scale-90"><Trash2 size={18} /></button>
                  </div>
                ))}
                <button type="button" className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest pl-2" onClick={() => setFormData({...formData, quantityDiscounts: [...formData.quantityDiscounts, { minQuantity: 0, discountPrice: 0 }]})}>+ Ajouter une remise par quantité</button>
              </div>
            </div>
          </div>

          <div className="pt-10 sticky bottom-[-1px] bg-workspace/80 backdrop-blur-md pb-4 border-t border-white/5">
            <Button type="submit" disabled={!!skuError} className="w-full py-6 text-sm font-black uppercase tracking-[0.3em] industrial-button-primary rounded-3xl shadow-2xl shadow-indigo-500/20">
              {editingProduct ? "Enregistrer les modifications" : "Ajouter à l'inventaire"}
            </Button>
          </div>
        </form>
      </Modal>
      
      {isScannerOpen && (
        <BarcodeScanner 
          onScan={(code) => {
            setFormData(prev => ({ ...prev, sku: code }));
            setIsScannerOpen(false);
          }}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </>
  );
}
