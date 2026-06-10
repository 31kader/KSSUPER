import React, { useState } from 'react';
import { Printer, Minus, Plus, Search } from 'lucide-react';
import { Product, CompanySettings } from '../types';
import { Button } from './ui';
import Barcode from 'react-barcode';
import { printLabels } from '../services/printService';

export interface LabelPrinterProps {
  products: Product[];
  settings: CompanySettings;
  initialSelectedProductIds?: string[];
}

export const SingleLabel = ({ product, currency }: { product: Product, currency?: string }) => {
  return (
    <div style={{ 
      width: '40mm', 
      height: '30mm', 
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: '#fff',
      padding: '0', 
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      color: '#000',
      fontFamily: 'Arial, sans-serif',
      
      // Gestion stricte des sauts de page pour l'imprimante thermique
      breakAfter: 'page',       /* Standard moderne */
      pageBreakAfter: 'always',  /* Ancien standard (toujours utile) */
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
      margin: 0
    }}>
      {/* Container de rotation pour l'impression */}
      <div style={{
        width: '30mm',
        height: '40mm',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(90deg)',
        WebkitTransform: 'translate(-50%, -50%) rotate(90deg)',
        padding: '2mm',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff'
      }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 'bold',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          width: '100%'
        }}>
          {product.name}
        </div>
        
        <div style={{
          fontSize: '16px',
          fontWeight: 'bold',
          textAlign: 'center',
          marginTop: '2mm',
          marginBottom: '2mm'
        }}>
          {product.price.toFixed(2)} {currency || '€'}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', overflow: 'hidden', width: '100%' }}>
          <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center' }}>
            <Barcode 
              value={product.sku || product.id.substring(0,6).toUpperCase()} 
              format="CODE128" 
              width={1.2} 
              height={30} 
              margin={0} 
              displayValue={true} 
              fontSize={12}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Retourne la chaîne de styles pour l'impression
export const getCommonStyles = () => `
  @media print {
    @page { 
      size: 40mm 30mm !important;
      margin: 0 !important; /* Supprime les en-têtes et pieds de page du navigateur */
    }
    html, body { 
      margin: 0 !important; 
      padding: 0 !important; 
      width: 40mm !important;
      height: 30mm !important;
      overflow: hidden !important;
      background: #fff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    /* Sécurité pour éviter qu'un conteneur global React ne casse le flux */
    #root, __next, #__next, .App {
      width: 40mm !important;
      height: 30mm !important;
      margin: 0 !important;
      padding: 0 !important;
      display: block !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
    }
    img, svg, .barcode {
      max-width: 100% !important;
      height: auto !important;
      display: block; /* Évite les espaces vides sous l'image */
    }
  }
`;

export function LabelPrinter({ products, settings, initialSelectedProductIds = [] }: LabelPrinterProps) {
  const [selectedProducts, setSelectedProducts] = useState<{ productId: string, quantity: number }[]>(
    initialSelectedProductIds.map(id => ({ productId: id, quantity: 1 }))
  );
  const [search, setSearch] = useState('');

  const handlePrint = () => {
    printLabels(itemsToPrint, settings);
  };


  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const addProduct = (p: Product) => {
    setSelectedProducts(prev => {
      const existing = prev.find(item => item.productId === p.id);
      if (existing) return prev.map(item => item.productId === p.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { productId: p.id, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setSelectedProducts(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (!existing) return prev;
      const newQuantity = Math.max(0, existing.quantity + delta);
      if (newQuantity === 0) return prev.filter(item => item.productId !== productId);
      return prev.map(item => item.productId === productId ? { ...item, quantity: newQuantity } : item);
    });
  };

  const getItemsToPrint = () => {
    const flatItems: Product[] = [];
    selectedProducts.forEach(sp => {
      const p = products.find(prod => prod.id === sp.productId);
      if (p) {
        for (let i = 0; i < sp.quantity; i++) {
          flatItems.push(p);
        }
      }
    });
    return flatItems;
  };

  const itemsToPrint = getItemsToPrint();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
        <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2">
          <Printer size={20} /> Impression Standard (40x30mm)
        </h3>
        <Button 
          onClick={handlePrint} 
          disabled={itemsToPrint.length === 0}
          className="bg-indigo-600 hover:bg-indigo-500 font-bold uppercase disabled:opacity-50"
        >
          <Printer size={16} className="mr-2" /> Imprimer {itemsToPrint.length} étiquettes
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher un produit..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-white outline-none"
            />
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredProducts.map(p => (
              <div key={'prod-'+p.id} className="flex justify-between items-center p-3 border border-slate-800 rounded-lg hover:border-slate-700">
                <div>
                  <div className="font-bold text-white">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.sku} | {p.price.toFixed(2)} {settings.currency}</div>
                </div>
                <Button onClick={() => addProduct(p)} className="bg-slate-800 hover:bg-slate-700 py-1.5 px-3 border-none">Ajouter</Button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h4 className="font-bold text-white mb-4 uppercase">File d'impression</h4>
          {selectedProducts.length === 0 ? (
            <div className="text-slate-500 text-center py-8">Aucun produit sélectionné.</div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {selectedProducts.map(sp => {
                const p = products.find(prod => prod.id === sp.productId);
                if (!p) return null;
                return (
                  <div key={'sel-'+sp.productId} className="flex justify-between items-center p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <div className="flex-1">
                      <div className="font-bold text-white truncate max-w-[200px]">{p.name}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateQuantity(p.id, -1)} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700"><Minus size={14}/></button>
                      <span className="font-mono text-white w-6 text-center">{sp.quantity}</span>
                      <button onClick={() => updateQuantity(p.id, 1)} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700"><Plus size={14}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
