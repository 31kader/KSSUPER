import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { rtdb, ref, get, push, update, child, runRtdbTransaction } from '../database';
import { Product } from '../types';
import { Trash2, Plus, Save, CheckCircle, Search, Package, Check, Edit, RefreshCw, AlertTriangle, CheckCircle2, Camera } from 'lucide-react';
import { cn, generateUniqueId } from '../lib/utils';
import { BarcodeScanner } from './BarcodeScanner';
import { toast } from 'sonner';
import { SafeImage } from './ui';

interface GRNItem {
  lineId: string;
  productId: string;
  quantity: number;
  oldCostPrice: number;
  newCostPrice: number;
  vatRate: number;
  discount: number;
  expirationDate?: string;
  batchNumber?: string;
}

interface GoodsReceiptNote {
  id: string;
  supplierId: string;
  date: string;
  items: GRNItem[];
  globalDiscount: number;
  globalVat: number;
  status: 'draft' | 'validated';
}

export function GRNManager({ 
  products, 
  suppliers,
  setIsProductModalOpen,
  setEditingProduct 
}: { 
  products: Product[];
  suppliers: any[];
  setIsProductModalOpen: (isOpen: boolean) => void;
  setEditingProduct: (product: Product | null) => void;
}) {
  const [grns, setGrns] = useState<GoodsReceiptNote[]>([]);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [search, setSearch] = useState('');
  const [grnSearch, setGrnSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  // Form state
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState<GRNItem[]>([]);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [globalVat, setGlobalVat] = useState(0);
  const [validateImmediately, setValidateImmediately] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const quantityInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  // Keyboard listeners for GRN shortcuts
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === 'F11') {
        e.preventDefault();
        if (items.length > 0) {
          const lastItem = items[items.length - 1];
          setTimeout(() => {
            const input = quantityInputRefs.current[lastItem.lineId];
            if (input) {
              input.focus();
              input.select();
            }
          }, 10);
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
        handleCreate();
      } else if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        e.stopPropagation();
        handleCreate().then(() => {
          setTimeout(() => {
            window.print();
          }, 500);
        });
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts, true);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts, true);
  }, [items, supplierId, globalDiscount, globalVat, validateImmediately]);

  const handleBarcodeScan = (barcode: string) => {
    const foundProduct = products.find((p: Product) => 
      (p.barcode && p.barcode.trim() === barcode.trim()) ||
      (p.sku && p.sku.trim() === barcode.trim())
    );

    if (foundProduct) {
      const existingItemIndex = items.findIndex(item => item.productId === foundProduct.id);
      if (existingItemIndex > -1) {
        const updatedItems = [...items];
        updatedItems[existingItemIndex].quantity += 1;
        setItems(updatedItems);
        toast.success(`Quantité augmentée pour ${foundProduct.name} (+1)`);
      } else {
        addItem(foundProduct);
        toast.success(`Produit ajouté : ${foundProduct.name}`);
      }
    } else {
      toast.error(`Aucun produit trouvé avec le code-barres : ${barcode}`);
    }
    setIsScannerOpen(false);
  };

  const filteredProducts = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return [];
    const searchTerms = s.split(' ').filter(Boolean);
    return products.filter((p: Product) => 
      searchTerms.every(term =>
        (p.name?.toLowerCase().includes(term)) || 
        (p.sku?.toLowerCase().includes(term)) ||
        (p.barcode?.toLowerCase().includes(term)) ||
        (p.reference?.toLowerCase().includes(term))
      )
    );
  }, [search, products]);

  const filteredGRNs = useMemo(() => {
    const s = grnSearch.toLowerCase().trim();
    if (!s) return grns;
    const searchTerms = s.split(' ').filter(Boolean);
    return grns.filter(g => {
      const supplier = suppliers.find(sup => sup.id === g.supplierId);
      const hasMatchingProduct = g.items.some(item => {
        const product = products.find(p => p.id === item.productId);
        return searchTerms.every(term =>
          product?.name?.toLowerCase().includes(term) || 
          product?.sku?.toLowerCase().includes(term) ||
          product?.barcode?.toLowerCase().includes(term) ||
          product?.reference?.toLowerCase().includes(term)
        );
      });
      return searchTerms.every(term =>
        g.id.toLowerCase().includes(term) || 
        supplier?.name?.toLowerCase().includes(term) ||
        hasMatchingProduct
      );
    });
  }, [grnSearch, grns, suppliers, products]);

  // For immediate response to barcode scans or rapid typing in Enter handle
  const getImmediateMatch = (searchTerm: string) => {
    const s = searchTerm.toLowerCase().trim();
    if (!s) return null;
    return products.find(p => 
      p.sku?.toLowerCase() === s || 
      p.barcode?.toLowerCase() === s ||
      p.reference?.toLowerCase() === s ||
      p.id.toLowerCase() === s ||
      p.name?.toLowerCase() === s
    );
  };

  useEffect(() => {
    const fetchGrns = async () => {
      try {
        const snapshot = await get(child(ref(rtdb), 'goodsReceiptNotes'));
        if (snapshot.exists()) {
          const grnsData = snapshot.val();
          setGrns(Object.keys(grnsData).map(id => ({ id, ...grnsData[id] } as GoodsReceiptNote)));
        }
      } catch (err) {
        console.warn("RTDB error in GRNManager:", err);
      }
    };
    fetchGrns();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault();
      const searchTerm = search.trim();
      const exactMatch = getImmediateMatch(searchTerm);
      
      if (exactMatch) {
        addItem(exactMatch);
      } else {
        const s = searchTerm.toLowerCase();
        const immediateFiltered = products.filter(p => 
          (p.name?.toLowerCase().includes(s)) || 
          (p.sku?.toLowerCase().includes(s))
        );
        if (immediateFiltered.length > 0) {
          addItem(immediateFiltered[0]);
        }
      }
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupplierName) return;
    await push(ref(rtdb, 'suppliers'), { name: newSupplierName });
    setNewSupplierName('');
    setIsAddingSupplier(false);
  };

  const addItem = (product: Product) => {
    setItems([...items, { 
      lineId: generateUniqueId(),
      productId: product.id, 
      quantity: 1, 
      oldCostPrice: product.costPrice || 0, 
      newCostPrice: product.costPrice || 0, 
      vatRate: product.taxRate || 0, 
      discount: 0,
      expirationDate: product.expirationDate || '',
      batchNumber: product.batchNumber || ''
    }]);
    setSearch('');
  };

  const updateItem = (index: number, field: keyof GRNItem, value: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleCreate = async () => {
    if (!supplierId || items.length === 0) {
      alert("Veuillez sélectionner un fournisseur et ajouter au moins un produit.");
      return;
    }
    
    setIsProcessing(true);
    try {
      if (validateImmediately) {
        // Mettre à jour les stocks et créer le bon
        for (const item of items) {
          if (!item.productId || item.productId === 'undefined') continue;
          
          await runRtdbTransaction(ref(rtdb, `products/${item.productId}`), (product) => {
            if (product) {
              const p = product;
              p.stock = (p.stock || 0) + item.quantity;
              p.costPrice = item.newCostPrice;
              p.updatedAt = new Date().toISOString();

              if (item.expirationDate) {
                if (!p.useMultiExpiry) {
                  const existingBatches = [];
                  if (p.stock - item.quantity > 0) {
                    existingBatches.push({
                      id: Math.random().toString(36).substring(2, 9),
                      batchNumber: p.batchNumber || 'LOT-INI',
                      expirationDate: p.expirationDate || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
                      stock: p.stock - item.quantity
                    });
                  }
                  p.batches = existingBatches;
                  p.useMultiExpiry = true;
                }
                
                const newBatch = {
                  id: Math.random().toString(36).substring(2, 9),
                  batchNumber: item.batchNumber || 'LOT-' + new Date().toISOString().split('T')[0].replace(/-/g, ''),
                  expirationDate: item.expirationDate,
                  stock: item.quantity
                };
                p.batches = p.batches ? [...p.batches, newBatch] : [newBatch];
                
                const sorted = [...p.batches].sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
                p.expirationDate = sorted[0].expirationDate;
                p.batchNumber = sorted[0].batchNumber;
              }

              return p;
            }
            return product;
          });
        }
        
        await push(ref(rtdb, 'goodsReceiptNotes'), {
          supplierId,
          date: new Date().toISOString(),
          items,
          globalDiscount,
          globalVat,
          status: 'validated'
        });
        alert("Bon de réception créé et stock mis à jour avec succès !");
      } else {
        await push(ref(rtdb, 'goodsReceiptNotes'), {
          supplierId,
          date: new Date().toISOString(),
          items,
          globalDiscount,
          globalVat,
          status: 'draft'
        });
        alert("Bon de réception créé en brouillon.");
      }
      
      setItems([]);
      setSupplierId('');
      setGlobalDiscount(0);
      setGlobalVat(0);
      setSearch('');
    } catch (error) {
      console.error("Error creating GRN:", error);
      toast.error("Erreur lors de la création du bon");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidate = async (grn: GoodsReceiptNote) => {
    if (grn.status === 'validated' || isProcessing) return;
    
    setIsProcessing(true);
    try {
      for (const item of grn.items) {
        if (!item.productId || item.productId === 'undefined') continue;
        
        await runRtdbTransaction(ref(rtdb, `products/${item.productId}`), (product) => {
          if (product) {
            const p = product;
            p.stock = (p.stock || 0) + item.quantity;
            p.costPrice = item.newCostPrice;
            p.updatedAt = new Date().toISOString();

            if (item.expirationDate) {
              if (!p.useMultiExpiry) {
                const existingBatches = [];
                if (p.stock - item.quantity > 0) {
                  existingBatches.push({
                    id: Math.random().toString(36).substring(2, 9),
                    batchNumber: p.batchNumber || 'LOT-INI',
                    expirationDate: p.expirationDate || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
                    stock: p.stock - item.quantity
                  });
                }
                p.batches = existingBatches;
                p.useMultiExpiry = true;
              }
              
              const newBatch = {
                id: Math.random().toString(36).substring(2, 9),
                batchNumber: item.batchNumber || 'LOT-' + new Date().toISOString().split('T')[0].replace(/-/g, ''),
                expirationDate: item.expirationDate,
                stock: item.quantity
              };
              p.batches = p.batches ? [...p.batches, newBatch] : [newBatch];
              
              const sorted = [...p.batches].sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
              p.expirationDate = sorted[0].expirationDate;
              p.batchNumber = sorted[0].batchNumber;
            }

            return p;
          }
          return product;
        });
      }
      
      await update(ref(rtdb, `goodsReceiptNotes/${grn.id}`), { status: 'validated' });

      setGrns(prev => prev.map(g => g.id === grn.id ? {...g, status: 'validated'} : g));
      alert("Le stock a été mis à jour avec succès !");
    } catch (error) {
      console.error("Error validating GRN:", error);
      toast.error("Erreur lors de la validation");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Gestion des Réceptions</h3>
          <p className="text-sm text-slate-500">Créez vos bons de réception manuellement</p>
        </div>
      </div>
      
      {/* Formulaire de création */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Fournisseur</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold">
              <option value="">Sélectionner un fournisseur</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button onClick={() => setIsAddingSupplier(true)} className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition-colors">
            <Plus size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Ajouter des Produits</label>
              <button 
                onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }} 
                className="text-indigo-600 hover:text-indigo-800 p-1 bg-white border border-indigo-100 rounded-lg shadow-sm"
                title="Nouvel article"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                ref={searchRef}
                type="text" 
                placeholder="Rechercher par nom ou SKU..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-12 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button 
                type="button" 
                onClick={() => setIsScannerOpen(true)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors"
                title="Scanner code-barres"
              >
                <Camera size={18} />
              </button>
            </div>

            {search.trim() && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="max-h-60 overflow-y-auto">
                  {filteredProducts.map((p) => {
                    const isInItems = items.some(it => it.productId === p.id);
                    return (
                      <button 
                        key={p.id} 
                        onClick={() => addItem(p)}
                        className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0"
                      >
                         <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                          {p.imageUrl ? (
                            <SafeImage 
                              src={p.imageUrl} 
                              alt={p.name} 
                              className="w-full h-full object-cover" 
                              fallback={<Package size={18} className="text-slate-300" />}
                            />
                          ) : <Package size={18} className="text-slate-300" />}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{p.name}</p>
                          <p className="text-[10px] text-slate-500 font-medium">Stock: {p.stock} • {p.sku}</p>
                        </div>
                        {isInItems ? <Check size={16} className="text-emerald-500" /> : <Plus size={16} className="text-slate-400" />}
                      </button>
                    );
                  })}
                  {filteredProducts.length === 0 && search.trim() !== "" && (
                    <div className="p-4 text-center text-sm text-slate-500">Aucun produit trouvé</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
              <div className="col-span-3 text-left">Article</div>
              <div className="col-span-1 text-center">Quantité</div>
              <div className="col-span-2 text-center text-slate-300">Ancien Prix</div>
              <div className="col-span-1 text-center font-bold text-indigo-600">Nouv. Prix</div>
              <div className="col-span-1 text-center">TVA %</div>
              <div className="col-span-1 text-center">Remise %</div>
              <div className="col-span-2 text-right">Sous-total</div>
              <div className="col-span-1"></div>
            </div>
          )}

          <div className="space-y-2">
            {items.map((item, index) => {
              const product = products.find(p => p.id === item.productId);
              const subtotal = item.quantity * item.newCostPrice;
              const discounted = subtotal * (1 - item.discount / 100);
              const totalWithVat = discounted * (1 + item.vatRate / 100);

              return (
                <div key={item.lineId} className="grid grid-cols-12 gap-2 items-center p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0">
                        {product?.imageUrl ? (
                          <SafeImage 
                            src={product.imageUrl} 
                            alt={product.name} 
                            className="w-full h-full object-cover" 
                            fallback={<Package size={14} className="text-slate-300" />}
                          />
                        ) : <Package size={14} className="text-slate-300" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{product?.name}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (product) {
                              setEditingProduct(product);
                              setIsProductModalOpen(true);
                            } else {
                              alert('Produit non trouvé. Il ne peut être modifié.');
                            }
                          }}
                          className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all p-1.5 rounded-lg"
                          title="Modifier la fiche produit"
                        >
                          <Edit size={14} />
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium truncate">SKU: {product?.sku || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="col-span-1">
                    <input 
                      type="number" 
                      ref={(el) => { if (el) quantityInputRefs.current[item.lineId] = el; }}
                      value={item.quantity} 
                      onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)} 
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border-0 rounded text-center text-sm font-bold" 
                    />
                  </div>
                  <div className="col-span-2 text-center">
                    <p className="text-[10px] text-slate-400 line-through">{(item.oldCostPrice || 0).toFixed(2)}</p>
                  </div>
                  <div className="col-span-1">
                    <input 
                      type="number" 
                      value={item.newCostPrice} 
                      onChange={(e) => updateItem(index, 'newCostPrice', parseFloat(e.target.value) || 0)} 
                      className="w-full px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 border-0 rounded text-center text-sm font-black text-indigo-600" 
                    />
                  </div>
                  <div className="col-span-1">
                    <input 
                      type="number" 
                      value={item.vatRate} 
                      onChange={(e) => updateItem(index, 'vatRate', parseFloat(e.target.value) || 0)} 
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border-0 rounded text-center text-xs" 
                    />
                  </div>
                  <div className="col-span-1">
                    <input 
                      type="number" 
                      value={item.discount} 
                      onChange={(e) => updateItem(index, 'discount', parseFloat(e.target.value) || 0)} 
                      className="w-full px-2 py-1 bg-amber-50 dark:bg-amber-900/30 border-0 rounded text-center text-xs font-bold text-amber-600" 
                    />
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-xs font-black text-slate-900 dark:text-white">{totalWithVat.toFixed(2)}</p>
                    <p className="text-[9px] text-slate-400 font-medium">Net HT: {discounted.toFixed(2)}</p>
                  </div>
                  <div className="col-span-1 text-right">
                    <button onClick={() => setItems(items.filter((_, i) => i !== index))} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Lot/Expiry tracking per reception item */}
                  <div className="col-span-12 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center gap-4 text-xs">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Suivi Expiration (DLC / Lot) :</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 font-bold">Date de Péremption (DLC)</span>
                      <input 
                        type="date"
                        value={item.expirationDate || ''}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index] = { ...newItems[index], expirationDate: e.target.value };
                          setItems(newItems);
                        }}
                        className="px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 font-bold">Numéro de Lot</span>
                      <input 
                        type="text"
                        placeholder="Ex: LOT-2026A"
                        value={item.batchNumber || ''}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index] = { ...newItems[index], batchNumber: e.target.value };
                          setItems(newItems);
                        }}
                        className="px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-mono font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-4 items-center pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex-1 flex gap-4">
             <div className="flex-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Remise Globale (%)</label>
              <input type="number" value={globalDiscount} onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">TVA Globale (%)</label>
              <input type="number" value={globalVat} onChange={(e) => setGlobalVat(parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={validateImmediately} 
                onChange={(e) => setValidateImmediately(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 transition-colors">Valider et mettre à jour le stock immédiatement</span>
            </label>
            <button 
              onClick={handleCreate} 
              disabled={isProcessing || items.length === 0}
              className={cn(
                "px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-md transition-all self-end h-[42px]",
                (isProcessing || items.length === 0) && "opacity-50 cursor-not-allowed bg-slate-400 shadow-none"
              )}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <Save size={18} /> Créer le Bon
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Liste des réceptions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Historique des Bons</h4>
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Rechercher par bon, fournisseur ou produit..."
              value={grnSearch}
              onChange={(e) => setGrnSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-bold"
            />
          </div>
        </div>
        
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-wider">
              <th className="p-4">Date de Réception</th>
              <th className="p-4">Fournisseur</th>
              <th className="p-4">Statut</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredGRNs.map(grn => {
                    const isDraft = grn.status === 'draft';
                    return (
                      <tr key={grn.id} className={cn(
                        "hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                        isDraft && "bg-amber-50/50 dark:bg-amber-900/10"
                      )}>
                        <td className="p-4">
                           <p className="font-bold text-slate-700 dark:text-slate-300">{new Date(grn.date).toLocaleDateString()}</p>
                           <p className="text-[10px] text-slate-400">{new Date(grn.date).toLocaleTimeString()}</p>
                        </td>
                        <td className="p-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                          {suppliers.find(s => s.id === grn.supplierId)?.name || 'Inconnu'}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold uppercase w-fit",
                              grn.status === 'validated' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {grn.status === 'draft' ? 'Brouillon' : 'Validé'}
                            </span>
                            {isDraft && <p className="text-[9px] text-amber-600 font-bold uppercase animate-pulse">Action Requise: Valider</p>}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          {grn.status === 'draft' && (
                            <button 
                              onClick={() => handleValidate(grn)} 
                              disabled={isProcessing}
                              className={cn(
                                "ml-auto px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20",
                                isProcessing && "opacity-50 cursor-not-allowed bg-slate-400 shadow-none"
                              )}
                            >
                              {isProcessing ? (
                                <RefreshCw size={14} className="animate-spin" />
                              ) : (
                                <Check size={14} />
                              )}
                              Valider & Mettre à jour Stock
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
            {filteredGRNs.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">Aucun bon de réception trouvé.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    
    {isScannerOpen && (
      <BarcodeScanner
        onScan={handleBarcodeScan}
        onClose={() => setIsScannerOpen(false)}
      />
    )}
  </div>
);
}
