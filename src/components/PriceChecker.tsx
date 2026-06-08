import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { 
  Package, History, RotateCcw, CameraOff,
  Barcode as BarcodeIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BrowserMultiFormatReader, DecodeHintType } from '@zxing/library';
import { cn, announcePrice, playScanSound } from '../lib/utils';
import { Product, CompanySettings, Category } from '../types';

interface PriceCheckerProps {
  products: Product[];
  settings: CompanySettings;
  categories: Category[];
}

export const PriceChecker = memo(function PriceChecker({ products, settings, categories }: PriceCheckerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(true);

  // Auto-focus input for scanning
  useEffect(() => {
    const focusInput = () => inputRef.current?.focus();
    focusInput();
    const interval = setInterval(focusInput, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchRef = useRef<(query: string, isFromCamera?: boolean) => void>(() => {});

  const handleSearch = useCallback((query: string, isFromCamera = false) => {
    setSearchQuery(query);
    setError(null);
    
    const found = products.find(p => p.sku === query || p.barcode === query);
    
    if (found) {
      setSelectedProduct(found);
      setSearchQuery(''); 
      setError(null);
      
      // Success Sound
      try {
        const AudioContextCls = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (typeof AudioContextCls === 'function') {
          const canUseNew = AudioContextCls.prototype && typeof AudioContextCls.prototype === 'object';
          const audioCtx = canUseNew ? new AudioContextCls() : (typeof AudioContextCls === 'function' ? AudioContextCls() : null);
          if (audioCtx) {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.15);
          }
        }
      } catch (e) {}

      announcePrice(found.name, found.price, settings.currency);
    } else if (isFromCamera && query.length >= 3) {
      setSelectedProduct(null); // Clear previous product to show error
      setError(`Code inconnu: ${query}`);
      
      // Error Sound (Low buzz)
      try {
        const AudioContextCls = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (typeof AudioContextCls === 'function') {
          const canUseNew = AudioContextCls.prototype && typeof AudioContextCls.prototype === 'object';
          const audioCtx = canUseNew ? new AudioContextCls() : (typeof AudioContextCls === 'function' ? AudioContextCls() : null);
          if (audioCtx) {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(110, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.4);
          }
        }
      } catch (e) {}
      
      setTimeout(() => setError(null), 5000);
    }
  }, [products, settings.currency]);

  useEffect(() => {
    handleSearchRef.current = handleSearch;
  }, [handleSearch]);

  // Camera scanner lifecycle
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        if (videoDevices && videoDevices.length > 0) {
          setCameras(videoDevices.map(d => ({ id: d.deviceId, label: d.label || 'Camera ' + d.deviceId })));
          // Auto-select the last one (usually the best back camera on Android)
          setSelectedCameraId(videoDevices[videoDevices.length - 1].deviceId);
        }
      } catch (err) {
        console.error("Error getting cameras", err);
      }
    };
    getCameras();
  }, []);

  useEffect(() => {
    if (selectedProduct || !selectedCameraId || !isScanning) return;

    let codeReader: BrowserMultiFormatReader | null = null;
    let lastScannedText = '';
    let lastScanTime = 0;
    let isMounted = true;

    const startCamera = async () => {
      try {
        const element = document.getElementById("camera-reader-main") as HTMLVideoElement;
        if (!element) return;

        // Try BarcodeDetector (Native/Google ML engine) first
        if ('BarcodeDetector' in window) {
          try {
            // @ts-ignore
            const formats = await window.BarcodeDetector.getSupportedFormats();
            // @ts-ignore
            const detector = new window.BarcodeDetector({ formats });
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined }
            });
            element.srcObject = stream;
            await element.play();

            const detect = async () => {
              if (!isMounted || !element) return;
              try {
                const barcodes = await detector.detect(element);
                if (barcodes.length > 0) {
                  const decodedText = barcodes[0].rawValue;
                  const now = Date.now();
                  if (decodedText !== lastScannedText || (now - lastScanTime) > 3000) {
                    lastScannedText = decodedText;
                    lastScanTime = now;
                    handleSearchRef.current(decodedText, true);
                  }
                }
              } catch (err) {
                console.error("Barcode detection error:", err);
              }
              if (isMounted) {
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
        } catch (e) {
          console.error("Failed to create BrowserMultiFormatReader:", e);
          if (isMounted) setError("Erreur initialisation scanner");
          return;
        }
        
        let hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, null);
        
        codeReader.decodeFromVideoDevice(
          selectedCameraId,
          element,
          (result, err) => {
            if (result && isMounted) {
               const decodedText = result.getText();
               const now = Date.now();
               if (decodedText !== lastScannedText || (now - lastScanTime) > 3000) {
                  lastScannedText = decodedText;
                  lastScanTime = now;
                  handleSearchRef.current(decodedText, true);
               }
            }
          }
        ).catch(err => {
            console.error("Camera error", err);
            if (isMounted) setError("Erreur caméra: Vérifiez les permissions");
        });

      } catch (err) {
        console.error("Critical camera error.", err);
        if (isMounted) {
          setError("Erreur caméra: Vérifiez les permissions");
        }
      }
    };

    const timer = setTimeout(() => {
      if (isMounted) startCamera();
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (codeReader) {
        try {
          codeReader.reset();
        } catch (e) {}
      }
    };
  }, [selectedProduct, selectedCameraId, isScanning]); 

  // Auto-hide product after 4 seconds
  useEffect(() => {
    if (selectedProduct) {
      const timer = setTimeout(() => {
        setSelectedProduct(null);
        setSearchQuery('');
        inputRef.current?.focus();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [selectedProduct]);

  const handleEnter = () => {
    if (!searchQuery) return;
    
    const found = products.find(p => 
      p.sku === searchQuery || 
      p.barcode === searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (found) {
      setSelectedProduct(found);
      setError(null);
      playScanSound();
      announcePrice(found.name, found.price, settings.currency);
    } else {
      setSelectedProduct(null);
      setError(`Article non trouvé: ${searchQuery}`);
      // Error Sound (Low buzz)
      try {
        const AudioContextCls = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (typeof AudioContextCls === 'function') {
          const audioCtx = new AudioContextCls();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(110, audioCtx.currentTime);
          gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.4);
        }
      } catch (e) {}
      setTimeout(() => setError(null), 4000);
    }
    setSearchQuery('');
  };

  return (
    <div 
      className="min-h-[100dvh] bg-[#020617] flex flex-col items-center justify-center p-4 md:p-10 font-sans relative overflow-hidden cursor-crosshair text-white"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Immersive Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]" />
        <motion.div 
          animate={{
            x: [0, 100, -50, 0],
            y: [0, -100, 50, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[140px]"
        />
        <motion.div 
          animate={{
            x: [0, -100, 50, 0],
            y: [0, 100, -50, 0],
            scale: [1, 0.8, 1.1, 1],
          }}
          transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-blue-600/15 rounded-full blur-[140px]"
        />
      </div>

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Floating Particles */}
      {[...Array(30)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            x: Math.random() * 100 + "%", 
            y: Math.random() * 100 + "%",
            opacity: Math.random() * 0.4
          }}
          animate={{ 
            y: "-10%",
            opacity: [0, 0.5, 0]
          }}
          transition={{ 
            duration: 15 + Math.random() * 15, 
            repeat: Infinity, 
            ease: "linear",
            delay: Math.random() * 10
          }}
          className="absolute w-[2px] h-[2px] bg-white rounded-full pointer-events-none"
        />
      ))}

      {/* Search Input (Hidden) */}
      <div className="absolute top-0 left-0 w-full opacity-0 pointer-events-none">
        <input
          ref={inputRef}
          type="text"
          className="w-full h-10 outline-none"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleEnter();
          }}
          onFocus={() => setIsScanning(true)}
          onBlur={() => setIsScanning(false)}
        />
      </div>

      <AnimatePresence mode="wait">
        {selectedProduct ? (
          /* PREMIUM PRODUCT KIOSK UI */
          <motion.div
            key={selectedProduct.id}
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -30 }}
            className="w-full max-w-6xl bg-[#0f172a]/80 backdrop-blur-3xl rounded-[60px] shadow-[0_80px_150px_-30px_rgba(0,0,0,0.8)] overflow-hidden border border-white/10 relative z-50 flex flex-col lg:flex-row"
          >
            {/* Product Image Section */}
            <div className="lg:w-[45%] bg-[#1e293b]/50 flex items-center justify-center relative overflow-hidden p-12 lg:p-20">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.15),transparent)] opacity-60" />
              <div className="absolute -inset-10 bg-[conic-gradient(from_0deg,transparent,rgba(99,102,241,0.1),transparent)] animate-spin-slow opacity-30" />
              
              {selectedProduct.imageUrl ? (
                <motion.img 
                  initial={{ rotate: -5, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  src={selectedProduct.imageUrl} 
                  alt={selectedProduct.name}
                  className="w-full h-full max-h-[500px] object-contain relative z-10 drop-shadow-[0_50px_100px_rgba(0,0,0,0.5)]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="relative z-10 flex flex-col items-center gap-6">
                  <div className="w-48 h-48 bg-slate-800/80 rounded-full flex items-center justify-center border border-white/5 shadow-inner">
                    <Package size={120} className="text-slate-600" />
                  </div>
                  <span className="text-slate-500 font-bold tracking-widest uppercase text-xs">Image non disponible</span>
                </div>
              )}

              {/* Status Badge */}
              <div className="absolute top-10 right-10">
                 <div className="bg-indigo-600/20 backdrop-blur-md border border-indigo-500/30 px-6 py-2 rounded-full text-indigo-300 font-bold text-xs tracking-widest uppercase">
                    Scan Réussi
                 </div>
              </div>
            </div>

            {/* Product Info Section */}
            <div className="flex-1 p-12 lg:p-20 flex flex-col justify-between relative bg-gradient-to-br from-transparent to-indigo-950/20">
              {/* Progress bar timer */}
              <motion.div 
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 4, ease: "linear" }}
                className="absolute top-0 left-0 h-3 bg-indigo-500 w-full origin-left opacity-80"
              />
              
              <div className="space-y-12">
                <div className="space-y-4">
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3"
                  >
                    <span className="w-12 h-[2px] bg-indigo-500" />
                    <span className="text-indigo-400 font-black uppercase tracking-[0.4em] text-xs">Informations Article</span>
                  </motion.div>
                  <h2 className="text-5xl lg:text-7xl font-black text-white leading-[1.1] tracking-tight drop-shadow-sm">
                    {selectedProduct.name}
                  </h2>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-black text-slate-500 uppercase tracking-[0.4em] ml-1">Prix de vente</p>
                  <div className="flex items-baseline gap-6">
                    <span className="text-9xl lg:text-[10rem] font-black text-white tracking-tighter leading-none">
                      {selectedProduct.price.toFixed(2)}
                    </span>
                    <span className="text-6xl font-black text-indigo-500/40 italic select-none">{settings.currency}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <div className={cn(
                    "px-10 py-5 rounded-[40px] text-2xl font-black uppercase tracking-widest flex items-center gap-4 border shadow-2xl transition-all duration-500",
                    selectedProduct.stock > 0 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                      : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  )}>
                    <div className={cn("w-3 h-3 rounded-full animate-pulse", selectedProduct.stock > 0 ? "bg-emerald-400" : "bg-rose-400")} />
                    {selectedProduct.stock > 0 ? "En Stock" : "Épuisé"}
                  </div>
                  
                  {selectedProduct.barcode && (
                    <div className="px-10 py-5 rounded-[40px] bg-white/5 text-slate-400 border border-white/5 text-2xl font-bold tracking-tight">
                       #{selectedProduct.barcode}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-12 flex items-center justify-between border-t border-white/5 pt-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center">
                    <History size={24} className="text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Action</span>
                    <span className="text-white font-black">Scannez le suivant</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="bg-white/5 hover:bg-white/10 p-6 rounded-[32px] transition-all border border-white/5 group"
                >
                  <RotateCcw size={32} className="text-slate-400 group-hover:rotate-180 transition-transform duration-700" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* IMMERSIVE IDLE INTERFACE */
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center p-6 z-10"
          >
            {/* Main Header Container */}
            <div className="relative w-full max-w-5xl flex flex-col items-center">
              <motion.div 
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                className="mb-12 bg-white/5 backdrop-blur-2xl px-12 py-10 rounded-[60px] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.5)] z-20 text-center relative overflow-hidden"
              >
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
                
                <motion.div 
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="flex justify-center mb-8"
                >
                  <div className="w-32 h-32 bg-indigo-600 rounded-[44px] flex items-center justify-center shadow-[0_20px_50px_rgba(79,70,229,0.4)] border-4 border-indigo-400/20">
                    <BarcodeIcon size={64} className="text-white" />
                  </div>
                </motion.div>
                
                <h3 className="text-6xl md:text-8xl font-black text-white leading-none tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400 uppercase">
                  Service Borne
                </h3>
                
                <div className="flex items-center justify-center gap-4 text-indigo-400">
                   <div className="w-3 h-3 bg-indigo-500 rounded-full animate-ping" />
                   <span className="font-black uppercase tracking-[0.6em] text-sm md:text-lg">Prêt pour le Scan</span>
                </div>
              </motion.div>

              {/* Error Notification */}
              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ scale: 0.8, y: 50, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.8, y: 20, opacity: 0 }}
                    className="fixed bottom-20 left-1/2 -translate-x-1/2 px-14 py-8 bg-rose-600/95 backdrop-blur-xl rounded-[40px] shadow-[0_40px_100px_rgba(225,29,72,0.6)] z-[60] border-2 border-rose-400 flex flex-col items-center gap-2 min-w-[400px]"
                  >
                    <div className="text-xs font-black text-rose-200 uppercase tracking-[0.5em]">Identifiant Inconnu</div>
                    <div className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight">{error}</div>
                    <div className="mt-4 text-xs text-rose-100/60 font-bold italic">Vérifiez l'étiquette et réessayez</div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Camera Scanner Viewbox */}
              <div className="relative w-full max-w-2xl group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-[70px] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
                
                <div className="relative w-full bg-[#020617] rounded-[64px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] overflow-hidden border-8 border-[#1e293b] z-10 aspect-square md:aspect-video flex items-center justify-center">
                  <video id="camera-reader-main" className={cn(
                    "absolute inset-0 bg-black transition-opacity duration-1000 w-full h-full object-cover",
                    isScanning ? "opacity-100" : "opacity-0"
                  )}></video>
                  
                  {/* Scan Animation Overlay */}
                  <div className="absolute inset-0 pointer-events-none z-20 flex flex-col items-center justify-center">
                     <div className="absolute top-12 left-12 w-16 h-16 border-t-[6px] border-l-[6px] border-indigo-500 rounded-tl-3xl opacity-60" />
                     <div className="absolute top-12 right-12 w-16 h-16 border-t-[6px] border-r-[6px] border-indigo-500 rounded-tr-3xl opacity-60" />
                     <div className="absolute bottom-12 left-12 w-16 h-16 border-b-[6px] border-l-[6px] border-indigo-500 rounded-bl-3xl opacity-60" />
                     <div className="absolute bottom-12 right-12 w-16 h-16 border-b-[6px] border-r-[6px] border-indigo-500 rounded-br-3xl opacity-60" />

                     {isScanning && (
                       <motion.div 
                        initial={{ top: "15%" }}
                        animate={{ top: "85%" }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatType: "reverse" }}
                        className="absolute left-[15%] right-[15%] h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_20px_rgba(99,102,241,0.8)] z-30"
                       />
                     )}

                     {!isScanning && (
                        <div className="flex flex-col items-center gap-6">
                           <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center animate-pulse">
                             <CameraOff size={32} className="text-slate-500" />
                           </div>
                           <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Veuillez cliquer pour activer la caméra</p>
                        </div>
                     )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Brand Accent */}
            <div className="fixed bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-6 opacity-30 select-none pointer-events-none">
               <div className="text-3xl font-black text-white italic tracking-tighter uppercase whitespace-nowrap">NEXUS BORNE PRO</div>
               <div className="w-1 h-1 bg-white rounded-full" />
               <div className="text-lg font-bold text-indigo-400 tracking-[1em]">SYSTEM v2.5</div>
               <div className="w-1 h-1 bg-white rounded-full" />
               <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tap to focus</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
