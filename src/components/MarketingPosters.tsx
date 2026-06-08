import React, { useState } from 'react';
import { Printer, X, Tag, Star, Zap, ShoppingCart, Percent, ArrowDown } from 'lucide-react';
import { Card, Button } from './ui';
import { Product, CompanySettings } from '../types';
import { cn } from '../lib/utils';

interface MarketingPostersProps {
  products: Product[];
  settings: CompanySettings;
}

type PosterType = 'promo' | 'new' | 'flash' | 'clearance';

export const MarketingPosters: React.FC<MarketingPostersProps> = ({ products, settings }) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [posterType, setPosterType] = useState<PosterType>('promo');
  const [customText, setCustomText] = useState('');
  const [search, setSearch] = useState('');

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 10);

  const handlePrint = () => {
    if (!selectedProduct) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = {
      promo: { bg: '#ef4444', text: '#ffffff', sub: '#fee2e2', accent: '#fef3c7' },
      new: { bg: '#4f46e5', text: '#ffffff', sub: '#e0e7ff', accent: '#c7d2fe' },
      flash: { bg: '#f59e0b', text: '#000000', sub: '#fffbeb', accent: '#fef3c7' },
      clearance: { bg: '#000000', text: '#ffffff', sub: '#f3f4f6', accent: '#ffffff' }
    };

    const s = styles[posterType];
    const originalPrice = (selectedProduct.price * 1.25).toFixed(2); // Mock original price for effect

    const html = `
      <html>
        <head>
          <title>Affiche - ${selectedProduct.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;900&display=swap');
            @page { size: A4; margin: 0; }
            body { 
              margin: 0; 
              font-family: 'Inter', sans-serif; 
              background: ${s.bg}; 
              color: ${s.text}; 
              height: 100vh;
              display: flex;
              flex-direction: column;
              padding: 60px;
              box-sizing: border-box;
            }
            .badge {
              background: ${s.accent};
              color: black;
              padding: 15px 40px;
              font-weight: 900;
              font-size: 40px;
              text-transform: uppercase;
              align-self: flex-start;
              border-radius: 10px;
              transform: rotate(-3deg);
              margin-bottom: 50px;
            }
            .product-name {
              font-size: 100px;
              font-weight: 900;
              line-height: 0.9;
              text-transform: uppercase;
              margin-bottom: 40px;
              word-break: break-word;
            }
            .description {
              font-size: 30px;
              opacity: 0.9;
              max-width: 80%;
              margin-bottom: auto;
            }
            .price-container {
              display: flex;
              align-items: baseline;
              gap: 30px;
              margin-top: 40px;
            }
            .old-price {
              font-size: 60px;
              text-decoration: line-through;
              opacity: 0.6;
              font-weight: 400;
            }
            .price {
              font-size: 220px;
              font-weight: 900;
              line-height: 1;
            }
            .currency {
              font-size: 80px;
              font-weight: 900;
              margin-left: 10px;
              opacity: 0.8;
            }
            .footer {
              margin-top: 60px;
              padding-top: 40px;
              border-top: 10px solid ${s.sub};
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .store-name {
              font-size: 40px;
              font-weight: 900;
            }
            .promo-text {
              font-size: 24px;
              font-weight: 700;
              opacity: 0.8;
            }
          </style>
        </head>
        <body>
          <div class="badge">
            ${posterType === 'promo' ? 'Offre Spéciale' : posterType === 'new' ? 'Nouveauté' : posterType === 'flash' ? 'Vente Flash' : 'Liquidation'}
          </div>
          <div class="product-name">${selectedProduct.name}</div>
          <div class="description">${customText || selectedProduct.description || 'Profitez de nos meilleurs tarifs en magasin.'}</div>
          
          <div class="price-container">
            ${posterType === 'promo' || posterType === 'clearance' ? `<div class="old-price">${originalPrice}</div>` : ''}
            <div class="price">
              ${selectedProduct.price.toFixed(2)}<span class="currency">${settings.currency}</span>
            </div>
          </div>

          <div class="footer">
            <div>
              <div class="store-name">${settings.name}</div>
              <div class="promo-text">${settings.address || ''}</div>
            </div>
            <div class="promo-text">Valable jusqu'à épuisement des stocks</div>
          </div>
          <script>
            window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-slate-800">Générateur d'Affiches Marketing</h3>
          <p className="text-sm text-slate-500">Créez des affiches A4 d'impact pour vos rayons et vitrines.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setSelectedProduct(null)}>
          <X size={16} /> Réinitialiser
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration */}
        <div className="space-y-6">
          <Card className="p-6 space-y-6">
            <div className="space-y-4">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest">1. Choisir le produit</label>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Rechercher un produit..."
                  className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Tag size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
              
              {search && (
                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50">
                  {filteredProducts.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => { setSelectedProduct(p); setSearch(''); }}
                      className="w-full p-3 text-left hover:bg-indigo-50 flex items-center justify-between transition-colors"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.sku}</p>
                      </div>
                      <p className="font-black text-indigo-600">{p.price.toFixed(2)} {settings.currency}</p>
                    </button>
                  ))}
                </div>
              )}

              {selectedProduct && (
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-indigo-200">
                      <Star size={24} className="text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-indigo-900">{selectedProduct.name}</p>
                      <p className="text-xs text-indigo-600 font-medium">Prix: {selectedProduct.price.toFixed(2)} {settings.currency}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="text-indigo-400 hover:text-indigo-600"><X size={20} /></button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest">2. Style de l'affiche</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'promo', label: 'Promotion', icon: Tag, color: 'bg-rose-500' },
                  { id: 'new', label: 'Nouveauté', icon: Star, color: 'bg-indigo-500' },
                  { id: 'flash', label: 'Vente Flash', icon: Zap, color: 'bg-amber-500' },
                  { id: 'clearance', label: 'Liquidation', icon: ArrowDown, color: 'bg-slate-900' }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setPosterType(type.id as PosterType)}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all",
                      posterType === type.id 
                        ? "border-indigo-600 bg-indigo-50" 
                        : "border-slate-100 hover:border-slate-300"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", type.color)}>
                      <type.icon size={20} />
                    </div>
                    <span className="text-sm font-bold text-slate-800">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest">3. Texte personnalisé (optionnel)</label>
              <textarea 
                placeholder="Ex: Qualité premium, stock limité..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 text-sm"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
              />
            </div>

            <Button 
              className="w-full py-4 text-lg bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-50"
              disabled={!selectedProduct}
              onClick={handlePrint}
            >
              <Printer size={20} className="mr-2" /> Générer l'affiche A4
            </Button>
          </Card>
        </div>

        {/* Preview */}
        <div className="flex flex-col items-center justify-center">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Aperçu du design</label>
          <div className={cn(
            "w-[350px] aspect-[0.707] rounded-xl shadow-2xl p-8 flex flex-col transition-all duration-500",
            posterType === 'promo' ? 'bg-rose-500 text-white' :
            posterType === 'new' ? 'bg-indigo-600 text-white' :
            posterType === 'flash' ? 'bg-amber-400 text-black' :
            'bg-slate-900 text-white'
          )}>
            <div className={cn(
              "self-start px-3 py-1 text-[10px] font-black uppercase rounded mb-6 rotate-[-2deg]",
              posterType === 'flash' ? 'bg-black text-white' : 'bg-white text-black'
            )}>
              {posterType === 'promo' ? 'Offre Spéciale' : posterType === 'new' ? 'Nouveauté' : posterType === 'flash' ? 'Vente Flash' : 'Liquidation'}
            </div>
            
            <h4 className="text-3xl font-black uppercase leading-tight mb-4 truncate text-wrap">
              {selectedProduct?.name || 'Nom du Produit'}
            </h4>
            
            <p className="text-xs opacity-80 leading-relaxed mb-auto italic">
              {customText || selectedProduct?.description || 'Profitez de nos meilleurs tarifs en magasin aujourd\'hui.'}
            </p>

            <div className="mt-6 flex items-baseline gap-4">
               {(posterType === 'promo' || posterType === 'clearance') && (
                 <span className="text-xl line-through opacity-50 font-bold">129.99</span>
               )}
               <div className="text-6xl font-black">
                 {selectedProduct?.price.toFixed(2) || '0.00'}<span className="text-2xl font-bold ml-1">{settings.currency}</span>
               </div>
            </div>

            <div className="mt-8 pt-4 border-t-4 border-white/20 flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest">{settings.name}</p>
                <p className="text-[8px] opacity-60">nexuspospro.com</p>
              </div>
              <ShoppingCart size={24} className="opacity-40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
