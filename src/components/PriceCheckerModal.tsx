import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, RefreshCw, Camera, AlertCircle, Package, Award, Barcode as BarcodeIcon } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { Product, CompanySettings, Category, Brand } from '../types';
import { cn, playScanSound, announcePrice } from '../lib/utils';
import { Modal, Button } from './ui';
import { fr } from 'date-fns/locale';

interface PriceCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  settings: CompanySettings;
  categories: Category[];
  brands: Brand[];
}

export function PriceCheckerModal({ isOpen, onClose, products, settings, categories, brands }: PriceCheckerModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const wakeLockRef = useRef<any>(null);

  // Wake Lock implementation
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if (isOpen && 'wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('Wake Lock is active');
        }
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    };

    if (isOpen) {
      requestWakeLock();
    }

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {
          wakeLockRef.current = null;
          console.log('Wake Lock released');
        });
      }
    };
  }, [isOpen]);

  // Global scanner support (HID)
  useEffect(() => {
    if (!isOpen) return;

    let buffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input that is NOT the search input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && target !== document.querySelector('#price-checker-input')) {
        return;
      }

      const currentTime = Date.now();
      
      // If it's been more than 50ms since last key, it's likely a new scan or manual typing
      if (currentTime - lastKeyTime > 50) {
        // We could reset buffer here if we wanted to be strict about scan speed,
        // but scanners usually dump the whole code at once.
      }
      
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length > 2) {
          setSearchTerm(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
        // Auto-clear buffer if too long or stale
        if (buffer.length > 50) buffer = buffer.slice(-50);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  useEffect(() => {
    let codeReader: BrowserMultiFormatReader | null = null;
    let lastScannedText = '';
    let lastScanTime = 0;
    
    if (isScanning && isOpen) {
      setCameraError(null);
      
      const startScanner = async () => {
        const videoElement = document.getElementById("camera-reader-price") as HTMLVideoElement;
        if (!videoElement) return;

        // Try BarcodeDetector (Native/Google ML engine) first
        if ('BarcodeDetector' in window) {
          try {
            // @ts-ignore
            const formats = await window.BarcodeDetector.getSupportedFormats();
            // @ts-ignore
            const detector = new window.BarcodeDetector({ formats });
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: facingMode }
            });
            videoElement.srcObject = stream;
            await videoElement.play();

            const detect = async () => {
              if (!isOpen || !isScanning || !videoElement) return;
              try {
                const barcodes = await detector.detect(videoElement);
                if (barcodes.length > 0) {
                  const decodedText = barcodes[0].rawValue;
                  const now = Date.now();
                  if (decodedText !== lastScannedText || (now - lastScanTime) > 3000) {
                    setSearchTerm(decodedText);
                    lastScannedText = decodedText;
                    lastScanTime = now;
                    playScanSound();
                  }
                }
              } catch (err) {
                console.error("Barcode detection error:", err);
              }
              if (isOpen && isScanning) {
                requestAnimationFrame(detect);
              }
            };
            detect();
            return; // Successfully using native detector
          } catch (err) {
            console.warn("BarcodeDetector failed, falling back to ZXing:", err);
          }
        }

        // Fallback to ZXing
        try {
          codeReader = new BrowserMultiFormatReader();
          codeReader.decodeFromVideoDevice(
            null,
            videoElement,
            (result) => {
              if (result) {
                const decodedText = result.getText();
                const now = Date.now();
                if (decodedText !== lastScannedText || (now - lastScanTime) > 3000) {
                  setSearchTerm(decodedText);
                  lastScannedText = decodedText;
                  lastScanTime = now;
                  playScanSound();
                }
              }
            }
          ).catch(err => {
            console.error("Camera failed", err);
            setIsScanning(false);
            setCameraError("Erreur lors de l'accès à la caméra de l'appareil.");
          });
        } catch (err: any) {
          console.error("Price checker camera failed", err);
          setIsScanning(false);
          setCameraError("Erreur lors de l'accès à la caméra de l'appareil.");
        }
      };

      setTimeout(startScanner, 300);
    }
    
    return () => {
      if (codeReader) {
         try {
             codeReader.reset();
         } catch(e) {}
      }
    };
  }, [isScanning, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsScanning(true);
      setSearchTerm('');
      setFoundProduct(null);
      setCameraError(null);
    }
  }, [isOpen]);


  useEffect(() => {
    if (searchTerm) {
      const product = products.find(p => 
        (p.sku && p.sku.toLowerCase() === searchTerm.toLowerCase()) ||
        p.name.toLowerCase() === searchTerm.toLowerCase()
      );
      if (product) {
        setFoundProduct(product);
        setSearchTerm('');
        announcePrice(product.name, product.price, settings.currency);
      }
    }
  }, [searchTerm, products, settings.currency]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFoundProduct(product || null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Vérificateur de Prix Rapide" maxWidth="max-w-4xl">
      <div className="space-y-6 p-2">
        <form onSubmit={handleManualSearch} className="relative group flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input
              id="price-checker-input"
              type="text"
              placeholder="Scanner un code-barres ou rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all font-bold text-lg"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            {isScanning && (
              <button
                type="button"
                onClick={() => setFacingMode(prev => prev === "environment" ? "user" : "environment")}
                className="p-4 rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center"
                title="Changer de caméra"
              >
                <RefreshCw size={24} className={cn(facingMode === "user" ? "rotate-180" : "")} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsScanning(!isScanning)}
              className={`p-4 rounded-2xl border transition-colors flex items-center justify-center ${isScanning ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
              title={isScanning ? "Arrêter la caméra" : "Démarrer la caméra"}
            >
              <Camera size={24} />
            </button>
          </div>
        </form>

        {cameraError && (
          <div className="p-4 bg-rose-50 text-rose-700 rounded-xl text-sm font-medium border border-rose-100 mb-4 flex items-center justify-center">
            {cameraError}
          </div>
        )}

        {isScanning && !cameraError && (
          <div className="w-full max-w-sm mx-auto overflow-hidden rounded-2xl border-2 border-indigo-500 bg-black aspect-video flex items-center justify-center">
            <video id="camera-reader-price" className="w-full h-full object-cover"></video>
          </div>
        )}

        <AnimatePresence mode="wait">
          {foundProduct ? (
            <motion.div 
              key={foundProduct.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white rounded-3xl overflow-hidden border border-slate-100"
            >
              {/* Image Section */}
              <div className="aspect-square bg-slate-50 flex items-center justify-center p-8 relative">
                {foundProduct.imageUrl ? (
                  <img src={foundProduct.imageUrl} alt={foundProduct.name} className="w-full h-full object-contain drop-shadow-lg" referrerPolicy="no-referrer" />
                ) : (
                  <Package size={100} className="text-slate-200" />
                )}
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 bg-white/80 backdrop-blur-sm border border-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {categories.find(c => c.id === foundProduct.categoryId)?.name || 'Général'}
                  </span>
                </div>
              </div>

              {/* Info Section */}
              <div className="p-8 flex flex-col justify-center space-y-6">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 leading-tight mb-1">{foundProduct.name}</h3>
                  <div className="flex items-center gap-2">
                    {foundProduct.brandId && (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                        <Award size={10} />
                        {brands.find(b => b.id === foundProduct.brandId)?.name}
                      </span>
                    )}
                    <p className="text-slate-400 font-mono text-sm">SKU: {foundProduct.sku}</p>
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black text-indigo-600 tracking-tighter">
                    {foundProduct.price.toFixed(2)}
                  </span>
                  <span className="text-2xl font-bold text-indigo-400">{settings.currency}</span>
                </div>

                <div className="flex items-center gap-3">
                   <div className={cn(
                     "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2",
                     foundProduct.stock > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                   )}>
                     <div className={cn("w-2 h-2 rounded-full", foundProduct.stock > 0 ? "bg-emerald-500" : "bg-rose-500")} />
                     {foundProduct.stock > 0 ? `En Stock (${foundProduct.stock})` : "Indisponible"}
                   </div>
                </div>

                {/* Quantity Discounts */}
                {foundProduct.quantityDiscounts && foundProduct.quantityDiscounts.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarifs Quantité</p>
                    <div className="grid grid-cols-2 gap-3">
                      {foundProduct.quantityDiscounts.map((d, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-600">x{d.minQuantity}</span>
                          <span className="text-sm font-black text-indigo-600">{d.discountPrice.toFixed(2)}{settings.currency}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <Button onClick={() => setFoundProduct(null)} className="w-full bg-slate-900 hover:bg-slate-800 py-4 rounded-xl">
                  Rechercher un autre
                </Button>
              </div>
            </motion.div>
          ) : searchTerm.length > 0 ? (
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               className="text-center py-12 p-8 bg-rose-50 rounded-3xl border border-dashed border-rose-200"
            >
              <div className="w-16 h-16 bg-white text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <AlertCircle size={32} />
              </div>
              <p className="text-rose-600 font-black text-2xl uppercase mb-2">ARTICLE N'EXISTE PAS</p>
              <p className="text-slate-500 mb-6">La recherche pour <span className="font-bold">"{searchTerm}"</span> n'a donné aucun résultat.</p>
              <div className="flex flex-col items-center gap-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic animate-bounce">Veuillez rescanner l'article...</p>
                <Button variant="secondary" onClick={() => setSearchTerm('')} className="px-8">
                  Réessayer
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="py-12 text-center text-slate-300 space-y-4">
              <BarcodeIcon size={64} className="mx-auto opacity-20" />
              <p className="font-bold uppercase tracking-widest text-sm">En attente d'un scan...</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
