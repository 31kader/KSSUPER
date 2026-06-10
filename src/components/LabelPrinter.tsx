import React, { useState, useMemo } from 'react';
import { 
  Printer, Minus, Plus, Search, Settings, Type, Maximize2, QrCode, 
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, FileText, Grid, Trash2 
} from 'lucide-react';
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
      breakAfter: 'page',
      pageBreakAfter: 'always',
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
      margin: 0
    }}>
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

export const getCommonStyles = () => `
  @media print {
    @page { 
      size: 40mm 30mm;
      margin: 0;
    }
    html, body { 
      margin: 0 !important; 
      padding: 0 !important; 
      width: 40mm !important;
      height: auto !important;
      overflow: visible !important;
      background: #fff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #root, __next, #__next, .App {
      width: 40mm !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      display: block !important;
      position: relative !important;
    }
    img, svg, .barcode {
      max-width: 100% !important;
      height: auto !important;
      display: block;
    }
  }
`;

// standard label dimension presets
const PRESETS = [
  { id: 'preset-40-30', name: 'Standard (40 x 30 mm)', width: 40, height: 30 },
  { id: 'preset-70-40', name: 'Moyen Rayon (70 x 40 mm)', width: 70, height: 40 },
  { id: 'preset-80-50', name: 'Grand Box (80 x 50 mm)', width: 80, height: 50 },
  { id: 'preset-50-30', name: 'Bijoux / Optique (50 x 30 mm)', width: 50, height: 30 },
  { id: 'preset-custom', name: 'Dimensions Personnalisées...', width: 60, height: 40 }
];

export function LabelPrinter({ products, settings, initialSelectedProductIds = [] }: LabelPrinterProps) {
  const [selectedProducts, setSelectedProducts] = useState<{ productId: string, quantity: number }[]>(
    initialSelectedProductIds.map(id => ({ productId: id, quantity: 1 }))
  );
  
  const [search, setSearch] = useState('');
  const [activePreset, setActivePreset] = useState('preset-40-30');

  // Dimension Controls
  const [customWidth, setCustomWidth] = useState(40);
  const [customHeight, setCustomHeight] = useState(30);
  const [customPadding, setCustomPadding] = useState(2);
  const [paddingTop, setPaddingTop] = useState(2);
  const [paddingBottom, setPaddingBottom] = useState(2);
  const [paddingLeft, setPaddingLeft] = useState(2);
  const [paddingRight, setPaddingRight] = useState(2);
  const [showDetailedPadding, setShowDetailedPadding] = useState(false);

  // Layout structures ("Changer l'organisation de la mise en page")
  const [layoutStructure, setLayoutStructure] = useState<'classic' | 'split' | 'price-heavy' | 'barcode-centric'>('classic');
  const [contentAlignment, setContentAlignment] = useState<'center' | 'left' | 'right'>('center');

  const [customOrientation, setCustomOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [customRotation, setCustomRotation] = useState<'0' | '90' | '180' | '270'>('0');
  const [showBorder, setShowBorder] = useState(false);

  // Contents Configuration
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showQr, setShowQr] = useState(false);
  const [showImage, setShowImage] = useState(false);

  // Sizing controls
  const [nameFontSize, setNameFontSize] = useState(12);
  const [priceFontSize, setPriceFontSize] = useState(18);
  const [barcodeHeight, setBarcodeHeight] = useState(28);

  // Custom text options ("Le truc pour ajouter du texte libre")
  const [customText, setCustomText] = useState('');
  const [customTextSize, setCustomTextSize] = useState(10);
  const [customTextAlign, setCustomTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [customTextBold, setCustomTextBold] = useState(false);
  const [customTextItalic, setCustomTextItalic] = useState(false);

  // Apply quick preset changes
  const handlePresetChange = (presetId: string) => {
    setActivePreset(presetId);
    const selected = PRESETS.find(p => p.id === presetId);
    if (selected && presetId !== 'preset-custom') {
      setCustomWidth(selected.width);
      setCustomHeight(selected.height);
      setCustomPadding(2);
      setPaddingTop(2);
      setPaddingBottom(2);
      setPaddingLeft(2);
      setPaddingRight(2);
    }
  };

  const handlePaddingBaseChange = (val: number) => {
    setCustomPadding(val);
    if (!showDetailedPadding) {
      setPaddingTop(val);
      setPaddingBottom(val);
      setPaddingLeft(val);
      setPaddingRight(val);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
    );
  }, [products, search]);

  const addProduct = (p: Product) => {
    setSelectedProducts(prev => {
      const existing = prev.find(item => item.productId === p.id);
      if (existing) {
        return prev.map(item => item.productId === p.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId: p.id, quantity: 1 }];
    });
  };

  const deleteProductFromList = (id: string) => {
    setSelectedProducts(prev => prev.filter(item => item.productId !== id));
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

  const clearAllSelected = () => {
    setSelectedProducts([]);
  };

  const itemsToPrint = useMemo(() => {
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
  }, [selectedProducts, products]);

  // Demo Product for visual preview
  const previewProduct = useMemo(() => {
    if (selectedProducts.length > 0) {
      const p = products.find(prod => prod.id === selectedProducts[0].productId);
      if (p) return p;
    }
    return {
      id: 'demo-id',
      name: 'T-Shirt Sport Premium Noir',
      price: 29.99,
      sku: 'TSHIRT-BLK-M',
      image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=200&auto=format&fit=crop&q=60'
    } as Product;
  }, [selectedProducts, products]);

  const handlePrint = () => {
    const dynamicSettings = {
      ...settings,
      labelTemplate: 'custom',
      labelWidthCustom: customWidth,
      labelHeightCustom: customHeight,
      labelOrientation: customOrientation,
      labelRotation: customRotation,
      
      // Pass the customized parameters inside settings as custom overrides
      customShowName: showName,
      customShowPrice: showPrice,
      customShowBarcode: showBarcode,
      customShowQr: showQr,
      customShowImage: showImage,
      customText: customText,
      customBorder: showBorder,
      
      customNameSize: nameFontSize,
      customPriceSize: priceFontSize,
      customTextSize: customTextSize,
      customBarcodeHeight: barcodeHeight,
      customPadding: customPadding,
      customPaddingTop: paddingTop,
      customPaddingBottom: paddingBottom,
      customPaddingLeft: paddingLeft,
      customPaddingRight: paddingRight,
      customLayoutStructure: layoutStructure,
      customAlignment: contentAlignment,
      customTextAlign: customTextAlign,
      customTextBold: customTextBold,
      customTextItalic: customTextItalic,
    };
    printLabels(itemsToPrint, dynamicSettings as any);
  };

  // Convert logical mm size to responsive styled px dimensions for simulator preview
  const simulatorZoomFactor = 4;
  const simWidth = customWidth * simulatorZoomFactor;
  const simHeight = customHeight * simulatorZoomFactor;

  return (
    <div className="space-y-6">
      {/* Top action header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 p-5 rounded-2xl border border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white uppercase flex items-center gap-3">
            <Printer className="text-indigo-500 animate-pulse" size={24} /> Studio de Création d'Étiquettes
          </h2>
          <p className="text-xs text-slate-400 mt-1">Concevez et configurez des étiquettes de prix thermiques professionnelles à 100% sur-mesure.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {selectedProducts.length > 0 && (
            <Button 
              onClick={clearAllSelected}
              className="bg-slate-800 hover:bg-slate-700 font-bold uppercase transition-all px-3 py-2 text-xs border border-slate-700 text-slate-300 rounded-xl"
            >
              Vider la file
            </Button>
          )}
          <Button 
            onClick={handlePrint} 
            disabled={itemsToPrint.length === 0}
            className="flex-1 sm:flex-none bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 font-bold uppercase disabled:opacity-50 text-white rounded-xl shadow-xl hover:shadow-indigo-500/20 active:scale-95 transition-all text-sm py-2.5 px-5"
          >
            <Printer size={16} className="mr-2" /> Imprimer {itemsToPrint.length} étiquettes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* PANEL 1: ARTICLE SELECTION */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col h-[580px]">
            <div className="mb-4">
              <h3 className="font-bold text-white text-sm uppercase mb-1 flex items-center gap-2">
                <Grid size={15} className="text-indigo-400" /> 1. Sélectionner les produits
              </h3>
              <p className="text-xs text-slate-400">Recherchez et ajoutez des produits à imprimer.</p>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Rechercher par nom, SKU..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* List products */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredProducts.length === 0 ? (
                <div className="text-slate-500 text-xs text-center py-10">Aucun produit trouvé.</div>
              ) : (
                filteredProducts.map(p => (
                  <div key={'p-item-'+p.id} className="flex justify-between items-center p-3 border border-slate-800/60 hover:border-slate-700 bg-slate-950/40 rounded-xl transition-all group">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white text-xs truncate">{p.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 divide-x divide-slate-800">
                        <span>{p.sku || 'Sans SKU'}</span>
                        <span className="pl-2 text-indigo-400 font-mono font-bold">{p.price.toFixed(2)} {settings.currency}</span>
                      </div>
                    </div>
                    <Button 
                      onClick={() => addProduct(p)} 
                      className="ml-3 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white py-1 px-3 border-none text-xs rounded-lg font-bold"
                    >
                      Ajouter
                    </Button>
                  </div>
                ))
              )}
            </div>
            
            {/* selected items queue */}
            <div className="mt-4 border-t border-slate-800 pt-4 flex flex-col h-[200px]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-white uppercase">Sélectionnés ({selectedProducts.length})</span>
                {itemsToPrint.length > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-dark bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/10">Type total: {itemsToPrint.length}</span>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {selectedProducts.length === 0 ? (
                  <div className="text-slate-500 text-xs text-center py-6">Aucun produit dans la file d'impression.</div>
                ) : (
                  selectedProducts.map(sp => {
                    const p = products.find(prod => prod.id === sp.productId);
                    if (!p) return null;
                    return (
                      <div key={'sel-item-'+sp.productId} className="flex justify-between items-center p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <button 
                            onClick={() => deleteProductFromList(p.id)}
                            className="text-slate-500 hover:text-rose-400 transition-colors"
                            title="Retirer"
                          >
                            <Trash2 size={13} />
                          </button>
                          <div className="truncate font-semibold text-white text-xs max-w-[120px]">{p.name}</div>
                        </div>
                        <div className="flex items-center gap-2.5 ml-2">
                          <button onClick={() => updateQuantity(p.id, -1)} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300"><Minus size={11}/></button>
                          <span className="font-mono text-xs font-bold text-white w-4 text-center">{sp.quantity}</span>
                          <button onClick={() => updateQuantity(p.id, 1)} className="p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-300"><Plus size={11}/></button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 2: CONFIGURATION STUDIO */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl h-[580px] overflow-y-auto custom-scrollbar space-y-5">
            <div>
              <h3 className="font-bold text-white text-sm uppercase mb-1 flex items-center gap-2">
                <Settings size={15} className="text-indigo-400" /> 2. Configurer le Layout (100% Libre)
              </h3>
              <p className="text-xs text-slate-400">Réglez l'étiquette au millimètre près en temps réel.</p>
            </div>

            {/* Presets Grid Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Format Prédéfini</label>
              <select 
                value={activePreset} 
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
              >
                {PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Manual Dimensions sliders */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-3">
              <div className="flex justify-between">
                <span className="text-[11px] font-bold text-indigo-400 uppercase">Dimensions Étiquette</span>
                <span className="text-[10px] font-mono text-slate-400">{customWidth}mm × {customHeight}mm</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Largeur (20 - 150 mm)</span>
                  <span className="text-white font-mono font-semibold">{customWidth} mm</span>
                </div>
                <input 
                  type="range" 
                  min={20} 
                  max={150} 
                  value={customWidth} 
                  onChange={(e) => {
                    setCustomWidth(Number(e.target.value));
                    setActivePreset('preset-custom');
                  }}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Hauteur (15 - 100 mm)</span>
                  <span className="text-white font-mono font-semibold">{customHeight} mm</span>
                </div>
                <input 
                  type="range" 
                  min={15} 
                  max={100} 
                  value={customHeight} 
                  onChange={(e) => {
                    setCustomHeight(Number(e.target.value));
                    setActivePreset('preset-custom');
                  }}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Padding */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Marges internes (Général : {customPadding} mm)</span>
                  <button 
                    type="button"
                    onClick={() => setShowDetailedPadding(!showDetailedPadding)}
                    className="text-[10px] text-indigo-400 font-bold hover:underline"
                  >
                    {showDetailedPadding ? "Marge Simple" : "Régler Haut/Bas/Gauche/Droite ↓"}
                  </button>
                </div>
                {!showDetailedPadding ? (
                  <input 
                    type="range" 
                    min={0} 
                    max={15} 
                    value={customPadding} 
                    onChange={(e) => handlePaddingBaseChange(Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 mt-1">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 block">En Haut (Top)</span>
                      <div className="flex items-center gap-1">
                        <input 
                          type="range" 
                          min={0} 
                          max={15} 
                          value={paddingTop} 
                          onChange={(e) => setPaddingTop(Number(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <span className="text-[10px] text-white font-mono">{paddingTop}mm</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 block">En Bas (Bottom)</span>
                      <div className="flex items-center gap-1">
                        <input 
                          type="range" 
                          min={0} 
                          max={15} 
                          value={paddingBottom} 
                          onChange={(e) => setPaddingBottom(Number(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <span className="text-[10px] text-white font-mono">{paddingBottom}mm</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 block">À Gauche (Left)</span>
                      <div className="flex items-center gap-1">
                        <input 
                          type="range" 
                          min={0} 
                          max={15} 
                          value={paddingLeft} 
                          onChange={(e) => setPaddingLeft(Number(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <span className="text-[10px] text-white font-mono">{paddingLeft}mm</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 block">À Droite (Right)</span>
                      <div className="flex items-center gap-1">
                        <input 
                          type="range" 
                          min={0} 
                          max={15} 
                          value={paddingRight} 
                          onChange={(e) => setPaddingRight(Number(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <span className="text-[10px] text-white font-mono">{paddingRight}mm</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Layout structures Choice block */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 space-y-3">
              <label className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">Organisation de Mise en Page</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLayoutStructure('classic')}
                  className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between h-[64px] ${layoutStructure === 'classic' ? 'border-indigo-500 bg-indigo-600/10 text-white' : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'}`}
                >
                  <span className="text-[11px] font-bold block uppercase">Empilement</span>
                  <span className="text-[9px] opacity-75">Centré classique</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutStructure('split')}
                  className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between h-[64px] ${layoutStructure === 'split' ? 'border-indigo-500 bg-indigo-600/10 text-white' : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'}`}
                >
                  <span className="text-[11px] font-bold block uppercase">Scindé (Split)</span>
                  <span className="text-[9px] opacity-75">Infos à gauche, Code à droite</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutStructure('price-heavy')}
                  className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between h-[64px] ${layoutStructure === 'price-heavy' ? 'border-indigo-500 bg-indigo-600/10 text-white' : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'}`}
                >
                  <span className="text-[11px] font-bold block uppercase">Focus Prix</span>
                  <span className="text-[9px] opacity-75">Prix XXL</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutStructure('barcode-centric')}
                  className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between h-[64px] ${layoutStructure === 'barcode-centric' ? 'border-indigo-500 bg-indigo-600/10 text-white' : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'}`}
                >
                  <span className="text-[11px] font-bold block uppercase">Master Code</span>
                  <span className="text-[9px] opacity-75">Surlignage code-barres</span>
                </button>
              </div>

              {layoutStructure === 'classic' && (
                <div className="space-y-1.5 pt-1 border-t border-slate-900">
                  <span className="text-[10px] text-slate-400 block flex justify-between">
                    <span>Alignement horizontal de l'étiquette</span>
                    <span className="uppercase text-indigo-400 font-semibold">{contentAlignment === 'left' ? 'À Gauche' : contentAlignment === 'right' ? 'À Droite' : 'Centré'}</span>
                  </span>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setContentAlignment('left')}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${contentAlignment === 'left' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                    >
                      À Gauche
                    </button>
                    <button 
                      type="button"
                      onClick={() => setContentAlignment('center')}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${contentAlignment === 'center' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                    >
                      Centré
                    </button>
                    <button 
                      type="button"
                      onClick={() => setContentAlignment('right')}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${contentAlignment === 'right' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                    >
                      À Droite
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Element visibility triggers and sizes */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Éléments de l'Étiquette</label>
              
              {/* Product Name Customization */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white font-semibold">Afficher le Nom du produit</span>
                  <input 
                    type="checkbox" 
                    checked={showName} 
                    onChange={(e) => setShowName(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 focus:bg-indigo-600 focus:ring-offset-slate-900"
                  />
                </div>
                {showName && (
                  <div className="flex items-center gap-2 pl-2 border-l border-slate-800 pt-1">
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">Taille police :</span>
                    <input 
                      type="range" 
                      min={6} 
                      max={24} 
                      value={nameFontSize} 
                      onChange={(e) => setNameFontSize(Number(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-[10px] text-white font-mono w-6 text-right">{nameFontSize}px</span>
                  </div>
                )}
              </div>

              {/* Price Customization */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white font-semibold flex items-center gap-1.5">Afficher le Prix</span>
                  <input 
                    type="checkbox" 
                    checked={showPrice} 
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 focus:bg-indigo-600 focus:ring-offset-slate-900"
                  />
                </div>
                {showPrice && (
                  <div className="flex items-center gap-2 pl-2 border-l border-slate-800 pt-1">
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">Taille Prix :</span>
                    <input 
                      type="range" 
                      min={8} 
                      max={36} 
                      value={priceFontSize} 
                      onChange={(e) => setPriceFontSize(Number(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-[10px] text-white font-mono w-6 text-right">{priceFontSize}px</span>
                  </div>
                )}
              </div>

              {/* Barcode Customization */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white font-semibold">Afficher le Code-barres</span>
                  <input 
                    type="checkbox" 
                    disabled={showQr}
                    checked={showBarcode} 
                    onChange={(e) => {
                      setShowBarcode(e.target.checked);
                      if (e.target.checked) setShowQr(false);
                    }}
                    className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 focus:bg-indigo-600 focus:ring-offset-slate-900 disabled:opacity-30"
                  />
                </div>
                {showBarcode && (
                  <div className="flex items-center gap-2 pl-2 border-l border-slate-800 pt-1">
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">Hauteur :</span>
                    <input 
                      type="range" 
                      min={10} 
                      max={60} 
                      value={barcodeHeight} 
                      onChange={(e) => setBarcodeHeight(Number(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-[10px] text-white font-mono w-6 text-right">{barcodeHeight}px</span>
                  </div>
                )}
              </div>

              {/* QR Code toggle */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-white font-semibold flex items-center gap-1.5">
                  <QrCode size={13} className="text-slate-400" /> Afficher l'emplacement QR Code (SKU)
                </span>
                <input 
                  type="checkbox" 
                  disabled={showBarcode}
                  checked={showQr} 
                  onChange={(e) => {
                    setShowQr(e.target.checked);
                    if (e.target.checked) setShowBarcode(false);
                  }}
                  className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 focus:bg-indigo-600 focus:ring-offset-slate-900 disabled:opacity-30"
                />
              </div>

              {/* Product Photo toggle */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-white font-semibold">Afficher l'Image / Photo du produit</span>
                <input 
                  type="checkbox" 
                  checked={showImage} 
                  onChange={(e) => setShowImage(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 focus:bg-indigo-600 focus:ring-offset-slate-900"
                />
              </div>

              {/* Border toggle */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-white font-semibold">Tracer une bordure de délimitation</span>
                <input 
                  type="checkbox" 
                  checked={showBorder} 
                  onChange={(e) => setShowBorder(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 focus:bg-indigo-600 focus:ring-offset-slate-900"
                />
              </div>
            </div>

            {/* PANEL: DYNAMIC TEXT ELEMENT BLOCK - "Truc pour ajouter du texte" */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-indigo-500/10 space-y-3">
              <div className="flex items-center gap-2">
                <Type size={15} className="text-indigo-400" />
                <span className="text-xs font-bold text-white uppercase">Insérer un Texte Personnalisé</span>
              </div>
              <p className="text-[11px] text-slate-400">Saisissez un sous-titre libre ou label marketing à intégrer sur l'étiquette.</p>
              
              <input 
                type="text"
                placeholder="Ex : Exclusivité Rayon, Garantie 2 ans, Promo..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
              />

              {customText && (
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-900">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block">Taille Police</span>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="range" 
                        min={6} 
                        max={18} 
                        value={customTextSize} 
                        onChange={(e) => setCustomTextSize(Number(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <span className="text-[10px] font-mono text-white whitespace-nowrap">{customTextSize}px</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block">Alignement & Style</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => setCustomTextAlign('left')}
                        className={`p-1.5 rounded text-slate-300 ${customTextAlign === 'left' ? 'bg-indigo-600 text-white' : 'bg-slate-900 hover:bg-slate-800'}`}
                        title="Aligner à gauche"
                      >
                        <AlignLeft size={11} />
                      </button>
                      <button 
                        onClick={() => setCustomTextAlign('center')}
                        className={`p-1.5 rounded text-slate-300 ${customTextAlign === 'center' ? 'bg-indigo-600 text-white' : 'bg-slate-900 hover:bg-slate-800'}`}
                        title="Centrer"
                      >
                        <AlignCenter size={11} />
                      </button>
                      <button 
                        onClick={() => setCustomTextAlign('right')}
                        className={`p-1.5 rounded text-slate-300 ${customTextAlign === 'right' ? 'bg-indigo-600 text-white' : 'bg-slate-900 hover:bg-slate-800'}`}
                        title="Aligner à droite"
                      >
                        <AlignRight size={11} />
                      </button>
                      <button 
                        onClick={() => setCustomTextBold(!customTextBold)}
                        className={`p-1.5 rounded text-slate-300 ${customTextBold ? 'bg-indigo-600 text-white' : 'bg-slate-900 hover:bg-slate-800'}`}
                        title="Gras"
                      >
                        <Bold size={11} />
                      </button>
                      <button 
                        onClick={() => setCustomTextItalic(!customTextItalic)}
                        className={`p-1.5 rounded text-slate-300 ${customTextItalic ? 'bg-indigo-600 text-white' : 'bg-slate-900 hover:bg-slate-800'}`}
                        title="Italique"
                      >
                        <Italic size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Printer Feed Configuration */}
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Alignement de sortie d'imprimante</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500">Orientation papier :</span>
                  <select 
                    value={customOrientation}
                    onChange={(e: any) => setCustomOrientation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
                  >
                    <option value="landscape">Paysage (Défaut)</option>
                    <option value="portrait">Portrait</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500">Rotation imprimante :</span>
                  <select 
                    value={customRotation}
                    onChange={(e: any) => setCustomRotation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
                  >
                    <option value="0">Aucune (0°)</option>
                    <option value="90">90° horaire</option>
                    <option value="180">180°</option>
                    <option value="270">90° anti-horaire</option>
                  </select>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* PANEL 3: LIVE PREVIEW SIMULATOR */}
        <div className="space-y-5 flex flex-col h-[580px] bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
          <div>
            <h3 className="font-bold text-white text-sm uppercase mb-1 flex items-center gap-2">
              <Maximize2 size={15} className="text-indigo-400" /> 3. Aperçu Physique Temps Réel
            </h3>
            <p className="text-xs text-slate-400">Rendu exact de l'étiquette finale (Simulateur Thermique).</p>
          </div>

          <div className="flex-1 flex items-center justify-center bg-slate-950 rounded-2xl border border-slate-800 p-4 overflow-auto min-h-[300px]">
            {/* The Physical Simulated Label */}
            <div 
              id="simulated-label-tag"
              style={{
                width: `${simWidth}px`,
                height: `${simHeight}px`,
                paddingTop: `${paddingTop * simulatorZoomFactor}px`,
                paddingBottom: `${paddingBottom * simulatorZoomFactor}px`,
                paddingLeft: `${paddingLeft * simulatorZoomFactor}px`,
                paddingRight: `${paddingRight * simulatorZoomFactor}px`,
                border: showBorder ? '1.5px solid #000000' : '1px dashed rgb(100, 116, 139)',
                borderRadius: '4px',
                backgroundColor: 'white',
                color: 'black',
                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)',
                fontFamily: 'sans-serif',
                display: 'flex',
                flexDirection: (layoutStructure === 'split' || layoutStructure === 'price-heavy') ? 'row' : 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'default',
                userSelect: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease-in-out'
              }}
            >
              {layoutStructure === 'split' ? (
                <>
                  {/* Left Column Description */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left', height: '100%' }}>
                    {showName && (
                      <div style={{ fontSize: `${nameFontSize}px`, fontWeight: 'bold', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.2' }}>
                        {previewProduct.name}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', margin: '4px 0 2px 0', width: '100%' }}>
                      {showImage && (previewProduct.imageUrl || previewProduct.image) && (
                        <img 
                          src={previewProduct.imageUrl || previewProduct.image} 
                          style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd' }} 
                          referrerPolicy="no-referrer"
                          alt="preview"
                        />
                      )}
                      {showPrice && (
                        <div style={{ fontSize: `${priceFontSize}px`, fontWeight: '900', lineHeight: '1.1' }}>
                          {previewProduct.price.toFixed(2)} {settings.currency}
                        </div>
                      )}
                    </div>
                    {customText && (
                      <div style={{ fontSize: `${customTextSize}px`, fontWeight: customTextBold ? 'bold' : 'normal', fontStyle: customTextItalic ? 'italic' : 'normal', color: '#333333', lineBreak: 'anywhere' }}>
                        {customText}
                      </div>
                    )}
                  </div>
                  {/* Right Column Code */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', maxWidth: '48%' }}>
                    {showBarcode && (
                      <div style={{ transform: `scale(${Math.min(0.9, simWidth / 220)})`, transformOrigin: 'center center' }}>
                        <Barcode 
                          value={previewProduct.sku || previewProduct.id.substring(0,6).toUpperCase()} 
                          format="CODE128" 
                          width={1} 
                          height={Math.round(barcodeHeight * 0.9)} 
                          margin={0} 
                          displayValue={false} 
                        />
                      </div>
                    )}
                    {showQr && (
                      <QrCode size={Math.min(36, simHeight / 2.5)} className="text-black" />
                    )}
                    {!showBarcode && !showQr && (
                      <div style={{ fontSize: '8px', color: '#666', textAlign: 'center' }}>
                        {previewProduct.sku || previewProduct.id.substring(0,6).toUpperCase()}
                      </div>
                    )}
                  </div>
                </>
              ) : layoutStructure === 'price-heavy' ? (
                <>
                  {/* Left Big Border-Price Tag block */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9', border: '1.5px solid #000', borderRadius: '4px', padding: '4px', minWidth: '45%', height: '100%', boxSizing: 'border-box' }}>
                    {showPrice ? (
                      <>
                        <div style={{ fontSize: `${Math.round(priceFontSize * 1.25)}px`, fontWeight: '900', color: '#000', lineHeight: 1 }}>
                          {previewProduct.price.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '2px', color: '#475569', textTransform: 'uppercase' }}>
                          {settings.currency}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#000' }}>PROMO</div>
                    )}
                  </div>
                  {/* Right description + barcode block */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                    {showName && (
                      <div style={{ fontSize: `${nameFontSize}px`, fontWeight: 'bold', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {previewProduct.name}
                      </div>
                    )}
                    {customText && (
                      <div style={{ fontSize: `${customTextSize}px`, fontWeight: customTextBold ? 'bold' : 'normal', fontStyle: customTextItalic ? 'italic' : 'normal', color: '#333333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {customText}
                      </div>
                    )}
                    {showBarcode && (
                      <div style={{ transform: `scale(${Math.min(0.8, simWidth / 260)})`, transformOrigin: 'bottom left', width: '100%' }}>
                        <Barcode 
                          value={previewProduct.sku || previewProduct.id.substring(0,6).toUpperCase()} 
                          format="CODE128" 
                          width={0.9} 
                          height={Math.max(15, Math.round(barcodeHeight * 0.75))} 
                          margin={0} 
                          displayValue={false} 
                        />
                      </div>
                    )}
                    {showQr && !showBarcode && (
                      <QrCode size={Math.min(28, simHeight / 3.5)} className="text-black" />
                    )}
                    {!showBarcode && !showQr && (
                      <div style={{ fontSize: '8px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {previewProduct.sku || previewProduct.id.substring(0,8).toUpperCase()}
                      </div>
                    )}
                  </div>
                </>
              ) : layoutStructure === 'barcode-centric' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '6px' }}>
                    {showName && (
                      <div style={{ fontSize: `${nameFontSize}px`, fontWeight: 'bold', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>
                        {previewProduct.name}
                      </div>
                    )}
                    {showPrice && (
                      <div style={{ fontSize: `${priceFontSize}px`, fontWeight: '950', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {previewProduct.price.toFixed(2)} {settings.currency}
                      </div>
                    )}
                  </div>

                  {customText && (
                    <div style={{ fontSize: `${customTextSize}px`, fontWeight: customTextBold ? 'bold' : 'normal', fontStyle: customTextItalic ? 'italic' : 'normal', color: '#333333', textAlign: 'center', width: '100%', marginBottom: '2px' }}>
                      {customText}
                    </div>
                  )}

                  {showBarcode && (
                    <div style={{ display: 'flex', justifyContent: 'center', overflow: 'hidden', width: '100%', flex: 1, alignItems: 'center' }}>
                      <div style={{ transform: `scale(${Math.min(1.1, simWidth / 140)})`, transformOrigin: 'center center' }}>
                        <Barcode 
                          value={previewProduct.sku || previewProduct.id.substring(0,6).toUpperCase()} 
                          format="CODE128" 
                          width={1} 
                          height={Math.round(barcodeHeight * 1.2)} 
                          margin={0} 
                          displayValue={true} 
                          fontSize={8}
                        />
                      </div>
                    </div>
                  )}

                  {showQr && !showBarcode && (
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, alignItems: 'center' }}>
                      <QrCode size={Math.min(44, simHeight / 2)} className="text-black" />
                    </div>
                  )}

                  {!showBarcode && !showQr && (
                    <div style={{ fontSize: '8px', color: '#666', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      SKU: {previewProduct.sku || previewProduct.id.substring(0,8).toUpperCase()}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* classic layout: default stack aligned based on contentAlignment */}
                  <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', justifyContent: 'space-between', alignItems: contentAlignment === 'left' ? 'flex-start' : contentAlignment === 'right' ? 'flex-end' : 'center' }}>
                    {showName && (
                      <div 
                        style={{
                          fontSize: `${nameFontSize}px`,
                          fontWeight: 'bold',
                          width: '100%',
                          textAlign: contentAlignment === 'left' ? 'left' : contentAlignment === 'right' ? 'right' : 'center',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: '1.2'
                        }}
                      >
                        {previewProduct.name}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: contentAlignment === 'left' ? 'flex-start' : contentAlignment === 'right' ? 'flex-end' : 'center', gap: '8px', margin: 'auto 0', width: '100%' }}>
                      {showImage && (previewProduct.imageUrl || previewProduct.image) && (
                        <img 
                          src={previewProduct.imageUrl || previewProduct.image} 
                          style={{
                            width: '32px',
                            height: '32px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                          }} 
                          referrerPolicy="no-referrer"
                          alt="preview"
                          onError={(e) => {
                            (e.target as any).style.display = 'none';
                          }}
                        />
                      )}
                      
                      {showPrice && (
                        <div 
                          style={{
                            fontSize: `${priceFontSize}px`,
                            fontWeight: '900',
                            margin: '0',
                            whiteSpace: 'nowrap',
                            lineHeight: '1.1'
                          }}
                        >
                          {previewProduct.price.toFixed(2)} {settings.currency}
                        </div>
                      )}
                    </div>

                    {customText && (
                      <div 
                        style={{
                          fontSize: `${customTextSize}px`,
                          fontWeight: customTextBold ? 'bold' : 'normal',
                          fontStyle: customTextItalic ? 'italic' : 'normal',
                          textAlign: customTextAlign,
                          width: '100%',
                          wordBreak: 'break-word',
                          color: '#333333',
                          marginBottom: '2px',
                          lineHeight: '1.2'
                        }}
                      >
                        {customText}
                      </div>
                    )}

                    {showBarcode && (
                      <div style={{ display: 'flex', justifyContent: contentAlignment === 'left' ? 'flex-start' : contentAlignment === 'right' ? 'flex-end' : 'center', overflow: 'hidden', width: '100%', padding: '0 4px' }}>
                        <div style={{ 
                          transform: `scale(${Math.min(1, simWidth / 150)})`, 
                          transformOrigin: contentAlignment === 'left' ? 'bottom left' : contentAlignment === 'right' ? 'bottom right' : 'bottom center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: contentAlignment === 'left' ? 'flex-start' : contentAlignment === 'right' ? 'flex-end' : 'center'
                        }}>
                          <Barcode 
                            value={previewProduct.sku || previewProduct.id.substring(0,6).toUpperCase()} 
                            format="CODE128" 
                            width={1} 
                            height={barcodeHeight} 
                            margin={0} 
                            displayValue={true} 
                            fontSize={8}
                          />
                        </div>
                      </div>
                    )}

                    {showQr && (
                      <div style={{ display: 'flex', justifyContent: contentAlignment === 'left' ? 'flex-start' : contentAlignment === 'right' ? 'flex-end' : 'center', width: '100%' }}>
                        <div className="p-1 bg-slate-100 border border-slate-200 rounded-md">
                          <QrCode size={Math.min(32, simHeight / 3)} className="text-black" />
                        </div>
                      </div>
                    )}

                    {!showBarcode && !showQr && (
                      <div style={{ fontSize: '8px', color: '#666', textAlign: contentAlignment === 'left' ? 'left' : contentAlignment === 'right' ? 'right' : 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        SKU: {previewProduct.sku || previewProduct.id.substring(0,8).toUpperCase()}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick info notes for thermal layouts */}
          <div className="bg-slate-950/40 border border-slate-800 p-3.5 rounded-xl space-y-2">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={12} className="text-indigo-400" /> Recommandations Thermiques
            </h4>
            <ul className="text-[10px] text-slate-400 space-y-1 list-disc list-inside">
              <li>Pour les imprimantes de marque Zebra ou Xprinter, l'orientation paysage est conseillée.</li>
              <li>Le rotateur automatique de {customRotation}° garantit une adaptation immédiate aux chargements de rouleaux transversaux.</li>
              <li>Conservez au moins 1.5mm de marge interne pour éviter le rognage des bordures thermiques.</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
