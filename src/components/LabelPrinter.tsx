import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Printer, Sparkles, Sliders, Type, Settings as SettingsIcon, 
  Barcode as BarcodeIcon, Search, Minus, Plus, Trash2, 
  Layers, RefreshCw, Save, FolderOpen, AlertCircle, Info, ChevronRight, Check
} from 'lucide-react';
import { Product, CompanySettings } from '../types';
import { Card, Button } from './ui';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';

// Backwards compatibility helpers
export const getCommonStyles = () => `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&family=Cinzel:wght@700&family=Space+Grotesk:wght@500;700&display=swap');
  .label-studio-print-root {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
`;

export const getModelDimensions = (model: string) => {
  if (model === 'gp3150_60x40' || model === '60x40') return { width: 60, height: 40, qr: 50, bWidth: 1.2, bHeight: 35 };
  if (model === 'gp3150_40x30' || model === '40x30') return { width: 40, height: 30, qr: 38, bWidth: 0.9, bHeight: 28 };
  if (model === 'thermal_v') return { width: 50, height: 80, qr: 60, bWidth: 1.1, bHeight: 50 };
  if (model === 'label' || model === '50x30') return { width: 50, height: 30, qr: 38, bWidth: 1.0, bHeight: 28 };
  if (model === 'label_v' || model === '30x50') return { width: 30, height: 50, qr: 45, bWidth: 0.8, bHeight: 40 };
  if (model === 'shipping' || model === '100x150') return { width: 100, height: 150, qr: 120, bWidth: 2.2, bHeight: 90 };
  if (model === 'jewelry' || model === '40x20') return { width: 40, height: 20, qr: 25, bWidth: 0.8, bHeight: 18 };
  if (model === 'medium' || model === '60x30') return { width: 60, height: 30, qr: 40, bWidth: 1.2, bHeight: 28 };
  return { width: 80, height: 50, qr: 65, bWidth: 1.6, bHeight: 45 }; 
};

export interface CustomLabelStyle {
  width: number; // mm
  height: number; // mm
  padding: number; // mm
  fontSizeName: number; // px
  fontSizePrice: number; // px
  fontSizeSku: number; // px
  fontFamily: string; // 'Inter' | 'Playfair Display' | 'JetBrains Mono' | 'Cinzel' | 'Space Grotesk'
  fontWeightName: string; // 'normal' | 'bold' | 'black'
  textColor: string; // hex
  bgColor: string; // hex
  borderColor: string; // hex
  borderWidth: number; // px
  borderRadius: number; // px
  align: 'left' | 'center' | 'right';
  layout: 'vertical' | 'horizontal';
  showCompany: boolean;
  showDate: boolean;
  showImage: boolean;
  codeType: 'barcode' | 'qr' | 'none';
  codeSize: number; // scale / multiplier
  accentColor: string; // hex
  priceColor: string; // hex
  themePresetName: string;
}

const DEFAULT_STYLE: CustomLabelStyle = {
  width: 50,
  height: 30,
  padding: 3,
  fontSizeName: 12,
  fontSizePrice: 20,
  fontSizeSku: 8,
  fontFamily: 'Inter',
  fontWeightName: 'bold',
  textColor: '#0f172a',
  bgColor: '#ffffff',
  borderColor: '#e2e8f0',
  borderWidth: 1,
  borderRadius: 4,
  align: 'center',
  layout: 'vertical',
  showCompany: true,
  showDate: false,
  showImage: false,
  codeType: 'barcode',
  codeSize: 40,
  accentColor: '#6366f1',
  priceColor: '#0f172a',
  themePresetName: 'standard'
};

const THEME_PRESETS = [
  {
    id: 'standard',
    name: 'Minimal Standard',
    style: {
      bgColor: '#ffffff',
      textColor: '#0f172a',
      borderColor: '#cbd5e1',
      priceColor: '#0f172a',
      accentColor: '#3b82f6',
      fontFamily: 'Inter',
      fontWeightName: 'bold',
      borderWidth: 1,
      borderRadius: 4
    }
  },
  {
    id: 'elegant',
    name: 'Or / Élégant',
    style: {
      bgColor: '#fafaf9',
      textColor: '#1c1917',
      borderColor: '#d97706',
      priceColor: '#b45309',
      accentColor: '#d97706',
      fontFamily: 'Cinzel',
      fontWeightName: 'bold',
      borderWidth: 1,
      borderRadius: 0
    }
  },
  {
    id: 'flash',
    name: 'Flash Promo Jaune',
    style: {
      bgColor: '#fef08a',
      textColor: '#78350f',
      borderColor: '#eab308',
      priceColor: '#dc2626',
      accentColor: '#b45309',
      fontFamily: 'Space Grotesk',
      fontWeightName: 'black',
      borderWidth: 2,
      borderRadius: 8
    }
  },
  {
    id: 'toxic',
    name: 'Cyber Néon Orange',
    style: {
      bgColor: '#0f172a',
      textColor: '#f8fafc',
      borderColor: '#f97316',
      priceColor: '#f97316',
      accentColor: '#38bdf8',
      fontFamily: 'JetBrains Mono',
      fontWeightName: 'bold',
      borderWidth: 2,
      borderRadius: 6
    }
  },
  {
    id: 'eco',
    name: 'Éco Pastel Vert',
    style: {
      bgColor: '#f0fdf4',
      textColor: '#14532d',
      borderColor: '#86efac',
      priceColor: '#16a34a',
      accentColor: '#15803d',
      fontFamily: 'Inter',
      fontWeightName: 'bold',
      borderWidth: 1,
      borderRadius: 12
    }
  }
];

// Single Label Renderer Component supporting dynamic designs
export const SingleLabel = ({ 
  label, 
  customStyle,
  labelStyle, // legacy fallback standard|elegant|promo|compact etc
  labelModel, // legacy fallback
  includeImage = true 
}: any) => {
  // 1. Resolve Style Definition
  const style: CustomLabelStyle = useMemo(() => {
    if (customStyle) return customStyle;

    // Convert legacy options if no customStyle provided
    const base = { ...DEFAULT_STYLE };
    if (labelModel) {
      const dims = getModelDimensions(labelModel);
      base.width = dims.width;
      base.height = dims.height;
      base.codeType = label.type === 'qr' ? 'qr' : 'barcode';
    }

    if (labelStyle === 'elegant') {
      base.fontFamily = 'Cinzel';
      base.bgColor = '#fafaf9';
      base.textColor = '#1c1917';
      base.borderColor = '#d97706';
      base.priceColor = '#b45309';
      base.borderRadius = 0;
    } else if (labelStyle === 'promo' || labelStyle === 'promo-advanced') {
      base.fontFamily = 'Space Grotesk';
      base.bgColor = '#ffe4e6';
      base.textColor = '#9f1239';
      base.borderColor = '#f43f5e';
      base.priceColor = '#e11d48';
      base.fontWeightName = 'black';
      base.borderRadius = 8;
    } else if (labelStyle === 'compact' || labelStyle === 'minimalist') {
      base.fontSizeName = 10;
      base.fontSizePrice = 16;
      base.align = 'center';
    } else if (labelStyle === 'eco') {
      base.bgColor = '#f0fdf4';
      base.textColor = '#166534';
      base.priceColor = '#15803d';
      base.borderColor = '#bbf7d0';
      base.borderRadius = 10;
    }

    return base;
  }, [customStyle, labelStyle, labelModel, label.type]);

  // Dimensions of container in mm
  const paperWidth = `${style.width}mm`;
  const paperHeight = `${style.height}mm`;

  // Align helper
  const flexAlign = style.align === 'left' ? 'flex-start' : style.align === 'right' ? 'flex-end' : 'center';
  const textAlign = style.align;

  return (
    <div 
      className="label-container select-none"
      style={{
        width: paperWidth,
        height: paperHeight,
        backgroundColor: style.bgColor,
        color: style.textColor,
        border: style.borderWidth > 0 ? `${style.borderWidth}px solid ${style.borderColor}` : 'none',
        borderRadius: `${style.borderRadius}px`,
        padding: `${style.padding}mm`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: style.layout === 'horizontal' ? 'row' : 'column',
        justifyContent: 'space-between',
        alignItems: style.layout === 'horizontal' ? 'center' : 'stretch',
        position: 'relative',
        fontFamily: style.fontFamily === 'Cinzel' ? '"Cinzel", serif' : style.fontFamily === 'Space Grotesk' ? '"Space Grotesk", sans-serif' : style.fontFamily === 'JetBrains Mono' ? '"JetBrains Mono", monospace' : style.fontFamily === 'Playfair Display' ? '"Playfair Display", serif' : '"Inter", sans-serif',
        pageBreakInside: 'avoid',
        pageBreakAfter: 'always',
        overflow: 'hidden'
      }}
    >
      {/* Dynamic Design Structure based on Layout */}
      <div className="flex-1 flex flex-col justify-between" style={{ textAlign, width: '100%', height: '100%' }}>
        
        {/* Top bar (Company / Tag Info / Date) */}
        {(style.showCompany || style.showDate) && (
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: style.align === 'center' ? 'center' : 'space-between', 
              gap: '8px',
              fontSize: `${Math.max(6, style.fontSizeSku - 1)}px`, 
              fontWeight: 700,
              textTransform: 'uppercase', 
              letterSpacing: '1px',
              opacity: 0.75,
              color: style.accentColor,
              marginBottom: '2px'
            }}
          >
            {style.showCompany && <span className="truncate max-w-[80%]">{label.company || 'NEXUS POS'}</span>}
            {style.showDate && label.date && <span className="whitespace-nowrap">{label.date}</span>}
          </div>
        )}

        {/* Product Image & Desig block */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: flexAlign }}>
          {style.showImage && (label.imageUrl || label.image) && (
            <img 
              src={label.imageUrl || label.image} 
              alt="" 
              style={{
                width: `${style.height <= 30 ? 24 : 32}px`,
                height: `${style.height <= 30 ? 24 : 32}px`,
                borderRadius: '4px',
                objectFit: 'cover',
                border: `1px solid ${style.borderColor}`,
                flexShrink: 0
              }} 
              referrerPolicy="no-referrer"
            />
          )}
          <div 
            className="truncate font-black"
            style={{ 
              fontSize: `${style.fontSizeName}px`,
              fontWeight: style.fontWeightName === 'black' ? 900 : style.fontWeightName === 'bold' ? 700 : 500,
              flex: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: style.textColor
            }}
            title={label.name}
          >
            {label.name}
          </div>
        </div>

        {/* Central visual block (Price / Old Price in Promo) */}
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: flexAlign, 
            alignItems: 'baseline',
            gap: '8px',
            margin: '2px 0'
          }}
        >
          {label.oldPrice && parseFloat(label.oldPrice) > 0 && (
            <span 
              style={{ 
                fontSize: `${style.fontSizePrice * 0.6}px`, 
                textDecoration: 'line-through', 
                opacity: 0.5,
                fontWeight: 700 
              }}
            >
              {label.oldPrice} {label.currency}
            </span>
          )}
          <span 
            className="tracking-tight"
            style={{ 
              fontSize: `${style.fontSizePrice}px`, 
              fontWeight: 900,
              color: style.priceColor
            }}
          >
            {label.price} <span style={{ fontSize: `${style.fontSizePrice * 0.5}px`, opacity: 0.8 }}>{label.currency}</span>
          </span>
        </div>

        {/* Barcode / QR Code Block */}
        {style.codeType !== 'none' && (
          <div style={{ display: 'flex', justifyContent: flexAlign, alignItems: 'center', width: '100%', overflow: 'hidden', margin: '1px 0' }}>
            {style.codeType === 'qr' ? (
              <div style={{ padding: '2px', background: '#fff', borderRadius: '2px', display: 'inline-block' }}>
                <QRCodeSVG value={label.sku || '000000'} size={style.codeSize} />
              </div>
            ) : (
              <div style={{ transform: `scale(${style.width < 50 ? 0.8 : 1.0})`, transformOrigin: flexAlign, display: 'inline-block' }}>
                <Barcode 
                  value={label.sku || '000000'} 
                  format="CODE128" 
                  width={style.width < 40 ? 0.7 : style.width < 60 ? 1.0 : 1.4} 
                  height={style.codeSize} 
                  margin={0} 
                  displayValue={false} 
                />
              </div>
            )}
          </div>
        )}

        {/* Footprint Block (Sku / Ref) */}
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: style.align === 'center' ? 'center' : 'space-between', 
            fontSize: `${style.fontSizeSku}px`, 
            fontWeight: 700,
            opacity: 0.7,
            fontFamily: 'monospace',
            marginTop: '1px'
          }}
        >
          <span>Ref: {label.sku}</span>
          {style.align !== 'center' && label.wholesalePrice && (
            <span style={{ color: style.accentColor }}>Gros: {label.wholesalePrice} {label.currency}</span>
          )}
        </div>

      </div>
    </div>
  );
};

interface LabelPrinterProps {
  products: Product[];
  settings: CompanySettings;
  initialSelectedProductIds?: string[];
}

export function LabelPrinter({ products, settings, initialSelectedProductIds = [] }: LabelPrinterProps) {
  const [selectedProducts, setSelectedProducts] = useState<{ productId: string, quantity: number }[]>(
    initialSelectedProductIds.map(id => ({ productId: id, quantity: 1 }))
  );
  
  // Custom Studio Design States
  const [customStyle, setCustomStyle] = useState<CustomLabelStyle>(DEFAULT_STYLE);
  const [search, setSearch] = useState('');
  const [freeText, setFreeText] = useState('');
  const [freePrice, setFreePrice] = useState('9.99');
  
  // Saved customized styles list
  const [savedStyles, setSavedStyles] = useState<{ name: string, style: CustomLabelStyle }[]>([]);
  const [currentStyleName, setCurrentStyleName] = useState('Mon Modèle Standard');
  const [activeTab, setActiveTab] = useState<'dim' | 'style' | 'presets'>('presets');

  const printRef = useRef<HTMLDivElement>(null);

  // Load saved styles on component mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nexus_pos_custom_label_styles');
      if (saved) {
        setSavedStyles(JSON.parse(saved));
      } else {
        // Hydrate default presets into saved list for easy starting
        const initialPresets = THEME_PRESETS.map(preset => ({
          name: preset.name,
          style: { ...DEFAULT_STYLE, ...preset.style, themePresetName: preset.id }
        }));
        setSavedStyles(initialPresets);
      }
    } catch (e) {
      console.error("Failed loading styles", e);
    }
  }, []);

  const saveCurrentStyle = () => {
    if (!currentStyleName.trim()) return;
    const styleToSave = { ...customStyle };
    setSavedStyles(prev => {
      const updated = prev.filter(s => s.name !== currentStyleName);
      const newList = [...updated, { name: currentStyleName, style: styleToSave }];
      localStorage.setItem('nexus_pos_custom_label_styles', JSON.stringify(newList));
      return newList;
    });
  };

  const deleteSavedStyle = (nameToDelete: string) => {
    setSavedStyles(prev => {
      const newList = prev.filter(s => s.name !== nameToDelete);
      localStorage.setItem('nexus_pos_custom_label_styles', JSON.stringify(newList));
      return newList;
    });
  };

  const applySavedStyle = (saved: { name: string, style: CustomLabelStyle }) => {
    setCustomStyle(saved.style);
    setCurrentStyleName(saved.name);
  };

  // Preset Sizes
  const presetSizes = [
    { name: 'Rôle Standard (40x30 mm)', w: 40, h: 30, presetName: 'Compact' },
    { name: 'Rôle Intermédiaire (50x30 mm)', w: 50, h: 30, presetName: 'Medium Row' },
    { name: 'Rôle Grand (60x40 mm)', w: 60, h: 40, presetName: 'Large Retail' },
    { name: 'Rôle Rayonnage (80x50 mm)', w: 80, h: 50, presetName: 'Shelf Display' },
    { name: 'Planche Portrait (30x50 mm)', w: 30, h: 50, presetName: 'Slim Vertical' },
    { name: 'Étiquette Bijouterie (40x20 mm)', w: 40, h: 20, presetName: 'Micro Jewelry' }
  ];

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const addProduct = (p: Product) => {
    setSelectedProducts(prev => {
      const existing = prev.find(item => item.productId === p.id);
      if (existing) return prev.map(item => item.productId === p.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { productId: p.id, quantity: 1 }];
    });
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("⚠️ Veuillez autoriser les fenêtres contextuelles (pop-ups) pour imprimer.");
      return;
    }
    
    // Custom label size page rule
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impression d'Étiques - Nexus POS</title>
          <style>
            ${getCommonStyles()}
            @page { 
              size: ${customStyle.width}mm ${customStyle.height}mm; 
              margin: 0; 
            }
            body { 
              margin: 0; 
              padding: 0; 
              display: flex;
              flex-direction: column;
              align-items: center;
              background-color: transparent;
            }
            .print-page-break {
              page-break-after: always;
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            setTimeout(() => {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            }, 600);
          </script>
        </body>
      </html>
    `;
    
    try {
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (err) {
      console.error(err);
      alert("⚠️ L'impression est bloquée dans cet aperçu. Veuillez ouvrir l'application dans un nouvel onglet.");
      printWindow.close();
    }
  };

  const onPrintClick = () => {
    if (selectedProducts.length === 0 && !freeText) {
      alert("⚠️ Veuillez ajouter au moins un produit à imprimer ou saisir du texte libre.");
      return;
    }
    handlePrint();
  };

  // Unified visual item for preview box
  const previewItem = useMemo(() => {
    const product = selectedProducts.length > 0 ? products.find(p => p.id === selectedProducts[0].productId) : null;
    
    return {
      name: freeText ? freeText : (product?.name || 'Article Exemple'),
      price: freeText ? freePrice : (product?.price?.toFixed(2) || '14.99'),
      sku: freeText ? 'TXT-994' : (product?.sku || 'SKU-88219'),
      currency: settings.currency,
      date: customStyle.showDate ? new Date().toLocaleDateString('fr-FR') : null,
      company: customStyle.showCompany ? settings.name : null,
      imageUrl: freeText ? null : (product?.imageUrl || product?.image || null),
      wholesalePrice: !freeText && product ? product.wholesalePrice?.toFixed(2) : '11.50',
      oldPrice: !freeText && product && product.priceHistory && product.priceHistory.length > 1 ? product.priceHistory[0].price.toFixed(2) : null,
    };
  }, [freeText, freePrice, selectedProducts, products, settings, customStyle.showCompany, customStyle.showDate]);

  const getItemsToPrint = () => {
    let itemsToPrint: any[] = [];
    if (freeText) {
       itemsToPrint.push({
         name: freeText,
         price: freePrice,
         sku: 'TXT-994',
         currency: settings.currency,
         date: customStyle.showDate ? new Date().toLocaleDateString('fr-FR') : null,
         company: customStyle.showCompany ? settings.name : null,
         imageUrl: null,
         quantity: 1
       });
    }

    selectedProducts.forEach(sp => {
        const p = products.find(prod => prod.id === sp.productId);
        if (p) {
          itemsToPrint.push({
            name: p.name,
            price: p.price?.toFixed(2) || '0.00',
            sku: p.sku || p.id,
            currency: settings.currency,
            date: customStyle.showDate ? new Date().toLocaleDateString('fr-FR') : null,
            company: customStyle.showCompany ? settings.name : null,
            imageUrl: p.imageUrl || p.image || null,
            wholesalePrice: p.wholesalePrice?.toFixed(2),
            oldPrice: p.priceHistory && p.priceHistory.length > 1 ? p.priceHistory[0].price.toFixed(2) : null,
            quantity: sp.quantity
          });
        }
    });

    const flatItems: any[] = [];
    itemsToPrint.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
         flatItems.push({...item, key: item.sku + '-' + i});
      }
    });
    return flatItems;
  };

  const itemsToPrint = getItemsToPrint();

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: getCommonStyles() }} />
      
      {/* Upper bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 border border-slate-800/60 rounded-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <Sparkles size={22} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-widest uppercase">Studio Étiquettes</h3>
            <p className="text-xs text-slate-400 font-medium">Configurez, dimensionnez et stylisez vos étiquettes de prix en temps réel.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            onClick={onPrintClick} 
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 py-5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-extrabold text-xs uppercase tracking-widest shadow-neon-indigo"
          >
            <Printer size={16} /> Imprimer {itemsToPrint.length} étiquettes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Workspace - Configuration Panel (Left Side: xl=7) */}
        <div className="xl:col-span-7 space-y-5">
          <Card className="p-4 bg-slate-900/50 border-slate-800/80 rounded-2xl">
            
            {/* Tabs Selector */}
            <div className="flex p-0.5 bg-slate-950/60 border border-slate-800/60 rounded-xl mb-4">
              <button
                type="button"
                className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === 'presets' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setActiveTab('presets')}
              >
                <Layers size={12} className="inline mr-1.5" /> Thèmes & Presets
              </button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === 'dim' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setActiveTab('dim')}
              >
                <Sliders size={12} className="inline mr-1.5" /> Dimensions
              </button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === 'style' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setActiveTab('style')}
              >
                <Type size={12} className="inline mr-1.5" /> Styles & Textile
              </button>
            </div>

            {/* Tab: Presets */}
            {activeTab === 'presets' && (
              <div className="space-y-4">
                
                {/* Popular Dimension presets */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dimensions populaires</span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {presetSizes.map((size) => (
                      <button
                        type="button"
                        key={size.name}
                        onClick={() => setCustomStyle(prev => ({ ...prev, width: size.w, height: size.h }))}
                        className={`p-2.5 rounded-xl border text-left transition-all hover:bg-slate-800/50 ${
                          customStyle.width === size.w && customStyle.height === size.h
                            ? 'bg-indigo-500/10 border-indigo-500 text-white'
                            : 'bg-slate-950/30 border-slate-800 text-slate-400'
                        }`}
                      >
                        <p className="font-extrabold text-[10px] uppercase text-indigo-400 tracking-wider text-ellipsis overflow-hidden whitespace-nowrap">{size.presetName}</p>
                        <p className="text-[11px] font-bold text-slate-300">{size.w} × {size.h} mm</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aesthetic presets */}
                <div className="space-y-2 pt-2 border-t border-slate-800/40">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-emerald-400">Styles & Thèmes Prêts</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {THEME_PRESETS.map((preset) => (
                      <button
                        type="button"
                        key={preset.id}
                        onClick={() => setCustomStyle(prev => ({ ...prev, ...preset.style, themePresetName: preset.id }))}
                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                          customStyle.themePresetName === preset.id
                            ? 'bg-emerald-500/10 border-emerald-500 text-white'
                            : 'bg-slate-950/20 border-slate-800 text-slate-400 hover:bg-slate-800/30'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-xs text-white">{preset.name}</p>
                          <p className="text-[9px] uppercase tracking-wider text-slate-500 mt-0.5">{preset.style.fontFamily}</p>
                        </div>
                        {customStyle.themePresetName === preset.id && <Check size={14} className="text-emerald-400 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Save model workspace */}
                <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 mt-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sauvegarder mon design</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentStyleName}
                      onChange={(e) => setCurrentStyleName(e.target.value)}
                      placeholder="Nom de ma configuration..."
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={saveCurrentStyle}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-black text-xs uppercase tracking-widest flex items-center gap-1"
                    >
                      <Save size={12} /> Sauver
                    </button>
                  </div>

                  {/* Saved configuration lists */}
                  {savedStyles.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-900 space-y-1.5">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Vos Modèles</span>
                      <div className="max-h-[120px] overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                        {savedStyles.map((item) => (
                          <div key={item.name} className="flex items-center justify-between p-1.5 bg-slate-900/40 rounded-lg group text-xs">
                            <button
                              type="button"
                              onClick={() => applySavedStyle(item)}
                              className="flex-1 text-left font-bold text-slate-300 hover:text-white transition-colors truncate"
                            >
                              <FolderOpen size={10} className="inline mr-1.5 text-amber-500" />
                              {item.name} <span className="text-[9px] font-normal text-slate-500">({item.style.width}x{item.style.height}mm)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSavedStyle(item.name)}
                              className="text-rose-500 font-extrabold text-[9px] uppercase tracking-widest hover:underline px-2"
                            >
                              Suppr
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Tab: Dimensions */}
            {activeTab === 'dim' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Width slider */}
                  <div className="space-y-2 p-2.5 bg-slate-950/20 border border-slate-800/40 rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Largeur (mm)</span>
                      <span className="font-mono text-xs text-indigo-400 font-bold">{customStyle.width} mm</span>
                    </div>
                    <input 
                      type="range" 
                      min={20} 
                      max={120} 
                      value={customStyle.width} 
                      onChange={(e) => setCustomStyle(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                      className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                      <span>20</span>
                      <span>120</span>
                    </div>
                  </div>

                  {/* Height slider */}
                  <div className="space-y-2 p-2.5 bg-slate-950/20 border border-slate-800/40 rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hauteur (mm)</span>
                      <span className="font-mono text-xs text-indigo-400 font-bold">{customStyle.height} mm</span>
                    </div>
                    <input 
                      type="range" 
                      min={15} 
                      max={120} 
                      value={customStyle.height} 
                      onChange={(e) => setCustomStyle(prev => ({ ...prev, height: parseInt(e.target.value) }))}
                      className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                      <span>15</span>
                      <span>120</span>
                    </div>
                  </div>

                  {/* Padding slider */}
                  <div className="space-y-2 p-2.5 bg-slate-950/20 border border-slate-800/40 rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-emerald-400">Marges Margulaires (mm)</span>
                      <span className="font-mono text-xs text-emerald-400 font-bold">{customStyle.padding} mm</span>
                    </div>
                    <input 
                      type="range" 
                      min={1} 
                      max={12} 
                      value={customStyle.padding} 
                      onChange={(e) => setCustomStyle(prev => ({ ...prev, padding: parseInt(e.target.value) }))}
                      className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Border Radius slider */}
                  <div className="space-y-2 p-2.5 bg-slate-950/20 border border-slate-800/40 rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Arrondis (px)</span>
                      <span className="font-mono text-xs text-indigo-400 font-bold">{customStyle.borderRadius} px</span>
                    </div>
                    <input 
                      type="range" 
                      min={0} 
                      max={24} 
                      value={customStyle.borderRadius} 
                      onChange={(e) => setCustomStyle(prev => ({ ...prev, borderRadius: parseInt(e.target.value) }))}
                      className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                </div>

                {/* Elements Toggles */}
                <div className="bg-slate-950/30 p-3.5 border border-slate-800/60 rounded-xl space-y-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Éléments affichables</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                      <input 
                        type="checkbox"
                        checked={customStyle.showCompany}
                        onChange={(e) => setCustomStyle(prev => ({ ...prev, showCompany: e.target.checked }))}
                        className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                      />
                      <span>Société</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                      <input 
                        type="checkbox"
                        checked={customStyle.showDate}
                        onChange={(e) => setCustomStyle(prev => ({ ...prev, showDate: e.target.checked }))}
                        className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                      />
                      <span>Date</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                      <input 
                        type="checkbox"
                        checked={customStyle.showImage}
                        onChange={(e) => setCustomStyle(prev => ({ ...prev, showImage: e.target.checked }))}
                        className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                      />
                      <span>Image Produit</span>
                    </label>

                  </div>
                </div>

              </div>
            )}

            {/* Tab: Styles & Colors */}
            {activeTab === 'style' && (
              <div className="space-y-4">
                
                {/* Font typography chooser */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Type de Police</span>
                    <select
                      value={customStyle.fontFamily}
                      onChange={(e) => setCustomStyle(prev => ({ ...prev, fontFamily: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                    >
                      <option value="Inter">Standard (Inter Sans)</option>
                      <option value="Cinzel">Traditionnel (Cinzel Serif)</option>
                      <option value="Space Grotesk">Cyber / Moderne (Space Grotesk)</option>
                      <option value="JetBrains Mono">Technique Tech (Fira / Fira Mono)</option>
                      <option value="Playfair Display">Élégant / Luxe (Playfair Display)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Code Identificateur</span>
                    <select
                      value={customStyle.codeType}
                      onChange={(e) => setCustomStyle(prev => ({ ...prev, codeType: e.target.value as any }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                    >
                      <option value="barcode">Code-barre Standard</option>
                      <option value="qr">QR Code (Compact / Scan)</option>
                      <option value="none">Aucun code</option>
                    </select>
                  </div>
                </div>

                {/* Font Sizes Sliders */}
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-800/40 pb-1 mt-3">Tailles de textes</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Name size */}
                  <div className="space-y-1 bg-slate-950/20 p-2 border border-slate-800/40 rounded-xl">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>Article (px)</span>
                      <span>{customStyle.fontSizeName}px</span>
                    </div>
                    <input 
                      type="range" 
                      min={8} 
                      max={24} 
                      value={customStyle.fontSizeName} 
                      onChange={(e) => setCustomStyle(prev => ({ ...prev, fontSizeName: parseInt(e.target.value) }))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  {/* Price size */}
                  <div className="space-y-1 bg-slate-950/20 p-2 border border-slate-800/40 rounded-xl">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>Prix (px)</span>
                      <span>{customStyle.fontSizePrice}px</span>
                    </div>
                    <input 
                      type="range" 
                      min={12} 
                      max={48} 
                      value={customStyle.fontSizePrice} 
                      onChange={(e) => setCustomStyle(prev => ({ ...prev, fontSizePrice: parseInt(e.target.value) }))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  {/* Code Bar Size */}
                  <div className="space-y-1 bg-slate-950/20 p-2 border border-slate-800/40 rounded-xl">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>Code taille (px)</span>
                      <span>{customStyle.codeSize}px</span>
                    </div>
                    <input 
                      type="range" 
                      min={10} 
                      max={80} 
                      value={customStyle.codeSize} 
                      onChange={(e) => setCustomStyle(prev => ({ ...prev, codeSize: parseInt(e.target.value) }))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                </div>

                {/* Align Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Alignement</span>
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                      {['left', 'center', 'right'].map((align) => (
                        <button
                          type="button"
                          key={align}
                          onClick={() => setCustomStyle(prev => ({ ...prev, align: align as any }))}
                          className={`py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                            customStyle.align === align ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'
                          }`}
                        >
                          {align === 'left' ? 'Gauche' : align === 'center' ? 'Centré' : 'Droite'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Orientation */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Orientation Structurel</span>
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                      {['vertical', 'horizontal'].map((orient) => (
                        <button
                          type="button"
                          key={orient}
                          onClick={() => setCustomStyle(prev => ({ ...prev, layout: orient as any }))}
                          className={`py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                            customStyle.layout === orient ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'
                          }`}
                        >
                          {orient === 'vertical' ? 'Vertical' : 'Horizontal'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Handpicked visual colors palettes */}
                <div className="bg-slate-950/40 p-3.5 border border-slate-800/60 rounded-xl space-y-3.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Choix manuel des couleurs</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 block">Fond (Badge)</span>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="color" 
                          value={customStyle.bgColor} 
                          onChange={(e) => setCustomStyle(prev => ({ ...prev, bgColor: e.target.value }))}
                          className="w-8 h-8 rounded border-slate-800 bg-transparent cursor-pointer"
                        />
                        <span className="font-mono text-[10px] text-white font-bold">{customStyle.bgColor}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 block">Texte</span>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="color" 
                          value={customStyle.textColor} 
                          onChange={(e) => setCustomStyle(prev => ({ ...prev, textColor: e.target.value }))}
                          className="w-8 h-8 rounded border-slate-800 bg-transparent cursor-pointer"
                        />
                        <span className="font-mono text-[10px] text-white font-bold">{customStyle.textColor}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 block">Prix Accent</span>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="color" 
                          value={customStyle.priceColor} 
                          onChange={(e) => setCustomStyle(prev => ({ ...prev, priceColor: e.target.value }))}
                          className="w-8 h-8 rounded border-slate-800 bg-transparent cursor-pointer"
                        />
                        <span className="font-mono text-[10px] text-white font-bold">{customStyle.priceColor}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 block">Bordure</span>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="color" 
                          value={customStyle.borderColor} 
                          onChange={(e) => setCustomStyle(prev => ({ ...prev, borderColor: e.target.value }))}
                          className="w-8 h-8 rounded border-slate-800 bg-transparent cursor-pointer"
                        />
                        <span className="font-mono text-[10px] text-white font-bold">{customStyle.borderColor}</span>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            )}

          </Card>

          {/* Saisie Libre & Product fast selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Saisie Libre Form */}
            <Card className="p-4 bg-slate-900/40 border-slate-800/80 rounded-2xl space-y-3.5">
              <h4 className="font-extrabold text-white text-xs tracking-widest uppercase flex items-center gap-1.5">
                <BarcodeIcon size={14} className="text-indigo-400" /> Saisie Libre Directe
              </h4>
              <p className="text-[10px] text-slate-400">Pour imprimer rapidement une étiquette sans article enregistré.</p>
              <div className="space-y-2.5">
                <input 
                  type="text" 
                  placeholder="Nom de l'article..."
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="Prix"
                    value={freePrice}
                    onChange={(e) => setFreePrice(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  {freeText && (
                    <button
                      type="button"
                      onClick={() => { setFreeText(''); setFreePrice('9.99'); }}
                      className="px-3 bg-red-500/10 border border-red-500/20 hover:bg-rose-500 hover:text-white transition-colors text-rose-400 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>
            </Card>

            {/* Catalog search selection */}
            <Card className="p-4 bg-slate-900/40 border-slate-800/80 rounded-2xl space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <input 
                  type="text"
                  placeholder="Rechercher produit..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white font-medium focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-500"
                />
              </div>
              <div className="max-h-[140px] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                {filteredProducts.slice(0, 30).map((p) => (
                  <button 
                    type="button"
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="w-full flex items-center justify-between p-2 bg-slate-950/20 hover:bg-slate-900/80 border border-slate-800/40 rounded-xl transition-all text-left"
                  >
                    <div className="truncate flex-1 pr-2">
                      <p className="font-extrabold text-[11px] text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">Ref: {p.sku || p.id}</p>
                    </div>
                    <span className="text-xs font-black text-indigo-400 whitespace-nowrap">{p.price?.toFixed(2)} {settings.currency}</span>
                  </button>
                ))}
              </div>
            </Card>

          </div>

        </div>

        {/* Live Preview Box & Printing Queue (Right Side: xl=5) */}
        <div className="xl:col-span-12 xl:grid xl:grid-cols-2 gap-6 space-y-6 xl:space-y-0">
          
          {/* Live visual rendering preview box */}
          <Card className="p-4 bg-slate-900/50 border-slate-800/80 rounded-2xl flex flex-col items-center justify-center min-h-[380px]">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Aperçu Réel Millimétrique</span>
            
            {/* Screen representation centering the label exactly */}
            <div className="w-full bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center p-8 relative overflow-auto shadow-inner min-h-[250px] custom-scrollbar">
              <div className="shadow-2xl flex-shrink-0 label-studio-print-root">
                <SingleLabel 
                  label={previewItem} 
                  customStyle={customStyle} 
                  includeImage={true} 
                />
              </div>
            </div>

            <p className="text-[9px] text-slate-500 mt-3 text-center flex items-center gap-1">
              <Info size={10} className="text-indigo-400 inline" /> 
              Toutes les dimensions affichées ci-dessus simulent exactement l'output de votre imprimante thermique au millimètre près.
            </p>
          </Card>

          {/* Queue collection manager */}
          <Card className="p-4 bg-slate-900/50 border-slate-800/80 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2">
                <span className="text-xs font-black text-white uppercase tracking-widest">
                  File d'Impression ({selectedProducts.reduce((s, i) => s + i.quantity, 0)} pièces)
                </span>
                {selectedProducts.length > 0 && (
                  <button 
                    type="button" 
                    onClick={() => setSelectedProducts([])} 
                    className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-400"
                  >
                    Vider la file
                  </button>
                )}
              </div>

              {selectedProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs italic">
                  Aucun produit dans la file d'attente.<br />Cliquez sur des produits à droite pour les ajouter.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1 custom-scrollbar">
                  {selectedProducts.map(item => {
                    const product = products.find(p => p.id === item.productId);
                    return (
                      <div key={item.productId} className="flex items-center justify-between p-2 bg-slate-950/40 border border-slate-800/40 rounded-xl">
                        <span className="text-[11px] font-extrabold text-white truncate max-w-[55%]">{product?.name}</span>
                        <div className="flex items-center gap-1.5 bg-slate-950 px-1.5 py-1 rounded-lg border border-slate-800/40">
                          <button 
                            type="button"
                            onClick={() => setSelectedProducts(prev => prev.map(i => i.productId === item.productId ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))} 
                            className="p-1 text-slate-400 hover:text-rose-400"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-black text-white w-6 text-center font-mono">{item.quantity}</span>
                          <button 
                            type="button"
                            onClick={() => setSelectedProducts(prev => prev.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i))} 
                            className="p-1 text-slate-400 hover:text-indigo-400"
                          >
                            <Plus size={12} />
                          </button>
                          <span className="text-slate-700 font-normal">|</span>
                          <button 
                            type="button"
                            onClick={() => setSelectedProducts(prev => prev.filter(i => i.productId !== item.productId))} 
                            className="p-1 text-rose-400 hover:text-rose-500"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Button 
              onClick={onPrintClick} 
              className="w-full mt-4 h-12 gap-2 text-xs font-black uppercase tracking-widest shadow-neon-indigo bg-indigo-600 hover:bg-indigo-500 rounded-xl"
            >
              <Printer size={16} /> Lancer l'impression directe ({itemsToPrint.length})
            </Button>
          </Card>

        </div>

      </div>

      {/* Hidden container processed for printable media */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <div ref={printRef} className="label-studio-print-root">
          {itemsToPrint.map((item, idx) => (
            <div key={item.key || `print-item-${idx}`} className="print-page-break">
              <SingleLabel 
                label={item} 
                customStyle={customStyle} 
                includeImage={true} 
              />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
