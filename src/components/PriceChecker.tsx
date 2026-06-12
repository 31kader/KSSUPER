import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { 
  Package, History, RotateCcw, CameraOff, Camera, RotateCw,
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

// Live continuous glowing animation to keep screen active and look cyber-premium
const LiveCanvasBackground = memo(function LiveCanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (canvas) {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize, { passive: true });

    const points: { x: number; y: number; vx: number; vy: number; radius: number }[] = [];
    const numPoints = 20;
    for (let i = 0; i < numPoints; i++) {
      points.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.5 + 0.5,
      });
    }

    let pulse = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Slow dynamic atmospheric dark gradient containing cyan/indigo pulses
      pulse += 0.008;
      const grad = ctx.createRadialGradient(
        width / 2, height / 2, 50,
        width / 2, height / 2, Math.max(width, height) * 0.7
      );
      const intensity = Math.sin(pulse) * 0.04 + 0.08;
      grad.addColorStop(0, `rgba(99, 102, 241, ${intensity})`);
      grad.addColorStop(0.5, 'rgba(15, 23, 42, 0)');
      grad.addColorStop(1, 'rgba(2, 6, 23, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw faint cybernetic data net nodes
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        p1.x += p1.vx;
        p1.y += p1.vy;

        if (p1.x < 0 || p1.x > width) p1.vx *= -1;
        if (p1.y < 0 || p1.y > height) p1.vy *= -1;

        for (let j = i + 1; j < points.length; j++) {
          const p2 = points[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist < 200) {
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
          }
        }
      }
      ctx.stroke();

      // Slow elegant radar sweep line
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.03)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const lineY = (Math.sin(pulse * 0.4) * 0.5 + 0.5) * height;
      ctx.moveTo(0, lineY);
      ctx.lineTo(width, lineY);
      ctx.stroke();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
});

export const PriceChecker = memo(function PriceChecker({ products, settings, categories }: PriceCheckerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [rotation, setRotation] = useState<'auto' | '90' | '-90'>('auto');
  const wakeLockRef = useRef<any>(null);

  // Implement automatic persistent wake lock
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('PriceChecker Wake Lock acquired.');
        }
      } catch (err) {
        console.warn('Wake Lock failed for PriceChecker:', err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {
          wakeLockRef.current = null;
          console.log('PriceChecker Wake Lock released.');
        });
      }
    };
  }, []);

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
          
          // Auto-select front camera by default (user-facing)
          const frontCamera = videoDevices.find(d => {
            const label = (d.label || '').toLowerCase();
            return label.includes('front') || label.includes('avant') || label.includes('user') || label.includes('face') || label.includes('webcam');
          });
          
          if (frontCamera) {
            setSelectedCameraId(frontCamera.deviceId);
          } else {
            // Default to first camera (usually front on iOS/Chrome)
            setSelectedCameraId(videoDevices[0].deviceId);
          }
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
      className="min-h-[100dvh] w-full bg-[#020617] relative overflow-hidden text-white font-sans"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Immersive Animated Canvas Background - Redraw loop keeps screen active & visual vibrant */}
      <LiveCanvasBackground />

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-[1]" 
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
          className="absolute w-[2px] h-[2px] bg-white rounded-full pointer-events-none z-[1]"
        />
      ))}

      {/* Floating Controls Bar */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-[100] pointer-events-none">
        <div>{/* Spacer to prevent overlapping general return-to-POS button on top left */}</div>
        
        <div className="flex items-center gap-2 md:gap-3 bg-slate-900/90 backdrop-blur-2xl border border-white/10 px-4 py-2 md:px-5 md:py-2.5 rounded-full pointer-events-auto shadow-2xl">
          {/* Cameras selection */}
          {cameras.length > 1 && (
            <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
              <Camera size={14} className="text-indigo-400" />
              <select 
                value={selectedCameraId || ''} 
                onChange={(e) => setSelectedCameraId(e.target.value)}
                className="bg-transparent border-none text-[9px] font-black uppercase tracking-wider text-indigo-300 outline-none cursor-pointer hover:text-white transition-colors"
                title="Choisir la caméra"
              >
                {cameras.map(c => {
                  const label = c.label.toLowerCase();
                  let displayLabel = 'Caméra Externe';
                  if (label.includes('front') || label.includes('avant') || label.includes('user') || label.includes('face')) {
                    displayLabel = '📸 Caméra Avant';
                  } else if (label.includes('back') || label.includes('arrière') || label.includes('environment')) {
                    displayLabel = '📷 Caméra Arrière';
                  } else {
                    displayLabel = '📷 ' + c.label.slice(0, 15);
                  }
                  return (
                    <option key={c.id} value={c.id} className="bg-[#0f172a] text-white">
                      {displayLabel}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Screen Rotation Selector */}
          <button 
            onClick={() => {
              setRotation(prev => prev === 'auto' ? '90' : prev === '90' ? '-90' : 'auto');
            }}
            className="flex items-center gap-1.5 hover:text-indigo-400 text-white/70 transition-colors"
            title="Pivoter l'orientation du portail"
          >
            <RotateCw size={12} className={cn("text-indigo-400 transition-transform duration-500", rotation !== 'auto' ? "rotate-90" : "")} />
            <span className="text-[9px] font-black uppercase tracking-wider">
              {rotation === 'auto' ? 'PAYSAGE AUTO' : rotation === '90' ? 'ROTATION: 90°' : 'ROTATION: -90°'}
            </span>
          </button>

          {/* Wake Lock Active Dot */}
          <div className="flex items-center gap-1.5 border-l border-white/10 pl-2 ml-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-400/80 hidden sm:inline">
              Écran Actif
            </span>
          </div>
        </div>
      </div>

      {/* Main Inner Rotatable Container */}
      <div 
        style={
          rotation === '90' 
            ? {
                transform: 'translate(-50%, -50%) rotate(90deg)',
                transformOrigin: 'center center',
                width: '100vh',
                height: '100vw',
                position: 'fixed' as const,
                top: '50%',
                left: '50%',
                zIndex: 40,
                overflow: 'hidden' as const
              }
            : rotation === '-90'
            ? {
                transform: 'translate(-50%, -50%) rotate(-90deg)',
                transformOrigin: 'center center',
                width: '100vh',
                height: '100vw',
                position: 'fixed' as const,
                top: '50%',
                left: '50%',
                zIndex: 40,
                overflow: 'hidden' as const
              }
            : {
                width: '100%',
                height: '100%',
                minHeight: '100dvh',
              }
        }
        className="flex flex-col items-center justify-center p-4 md:p-8 landscape:p-4 transition-all duration-300 w-full min-h-[100dvh]"
      >
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
            /* PREMIUM PRODUCT KIOSK UI - HORIZONTALE ADAPTED */
            <motion.div
              key={selectedProduct.id}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -15 }}
              className="w-full max-w-6xl bg-[#0f172a]/85 backdrop-blur-3xl rounded-[40px] md:rounded-[60px] shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden border border-white/10 relative z-50 flex flex-col md:flex-row landscape:flex-row"
            >
              {/* Product Image Section */}
              <div className="md:w-[40%] bg-[#1e293b]/40 flex items-center justify-center relative overflow-hidden p-6 md:p-12 landscape:p-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.15),transparent)] opacity-60" />
                <div className="absolute -inset-10 bg-[conic-gradient(from_0deg,transparent,rgba(99,102,241,0.1),transparent)] animate-spin-slow opacity-30" />
                
                {selectedProduct.imageUrl ? (
                  <motion.img 
                    initial={{ rotate: -3, scale: 0.95 }}
                    animate={{ rotate: 0, scale: 1 }}
                    src={selectedProduct.imageUrl} 
                    alt={selectedProduct.name}
                    className="w-full h-full max-h-[220px] md:max-h-[360px] object-contain relative z-10 drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="w-24 h-24 md:w-40 md:h-40 bg-slate-800/80 rounded-full flex items-center justify-center border border-white/5 shadow-inner">
                      <Package size={64} className="text-slate-600" />
                    </div>
                    <span className="text-slate-500 font-bold tracking-widest uppercase text-[10px]">Image non disponible</span>
                  </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-6 right-6">
                   <div className="bg-indigo-600/20 backdrop-blur-md border border-indigo-500/30 px-4 py-1.5 rounded-full text-indigo-300 font-bold text-[9px] tracking-widest uppercase">
                      Scan Réussi
                   </div>
                </div>
              </div>

              {/* Product Info Section */}
              <div className="flex-1 p-6 md:p-12 landscape:p-8 flex flex-col justify-between relative bg-gradient-to-br from-transparent to-indigo-950/20">
                {/* Progress bar timer */}
                <motion.div 
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: 4, ease: "linear" }}
                  className="absolute top-0 left-0 h-2 bg-indigo-500 w-full origin-left opacity-80"
                />
                
                <div className="space-y-6 md:space-y-8">
                  <div className="space-y-2 md:space-y-3">
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2"
                    >
                      <span className="w-8 h-[2px] bg-indigo-500" />
                      <span className="text-indigo-400 font-black uppercase tracking-[0.3em] text-[10px]">Informations Article</span>
                    </motion.div>
                    <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight drop-shadow-sm">
                      {selectedProduct.name}
                    </h2>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Prix de vente</p>
                    <div className="flex items-baseline gap-4">
                      <span className="text-6xl md:text-8xl lg:text-9xl font-black text-white tracking-tighter leading-none">
                        {selectedProduct.price.toFixed(2)}
                      </span>
                      <span className="text-4xl md:text-5xl font-black text-indigo-500/40 italic select-none">{settings.currency}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className={cn(
                      "px-6 py-3 rounded-full text-sm font-black uppercase tracking-widest flex items-center gap-3 border shadow-2xl transition-all duration-500",
                      selectedProduct.stock > 0 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    )}>
                      <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", selectedProduct.stock > 0 ? "bg-emerald-400" : "bg-rose-400")} />
                      {selectedProduct.stock > 0 ? "En Stock" : "Épuisé"}
                    </div>
                    
                    {selectedProduct.barcode && (
                      <div className="px-6 py-3 rounded-full bg-white/5 text-slate-400 border border-white/5 text-sm font-bold tracking-tight">
                         #{selectedProduct.barcode}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                      <History size={18} className="text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Action</span>
                      <span className="text-white text-xs font-black">Scannez le suivant</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setSelectedProduct(null)}
                    className="bg-white/5 hover:bg-white/10 p-4 rounded-[20px] transition-all border border-white/5 group"
                  >
                    <RotateCcw size={20} className="text-slate-400 group-hover:rotate-180 transition-transform duration-700" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* IMMERSIVE IDLE INTERFACE - BEAUTIFUL DUAL COLUMN LANDSCAPE */
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-6xl flex flex-col md:flex-row landscape:flex-row items-center justify-center gap-6 md:gap-12 lg:gap-16 px-4"
            >
              {/* Left Column: Interactive Greeting and Info */}
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="bg-white/5 backdrop-blur-2xl px-8 py-8 md:px-12 md:py-10 rounded-[40px] md:rounded-[50px] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.5)] text-center md:text-left relative overflow-hidden w-full md:w-[45%] landscape:w-[45%] flex flex-col items-center md:items-start"
              >
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
                
                <motion.div 
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="mb-6"
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-[0_15px_35px_rgba(79,70,229,0.4)] border-2 border-indigo-400/20">
                    <BarcodeIcon size={32} className="text-white" />
                  </div>
                </motion.div>
                
                <h3 className="text-3xl md:text-5xl lg:text-6xl font-black text-white leading-none tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400 uppercase">
                  Service Borne
                </h3>
                
                <p className="text-slate-300 text-sm mb-6 leading-relaxed hidden sm:block">
                  Présentez le code-barres de l'article devant la caméra avant de l'appareil pour afficher instantanément son prix et sa disponibilité en rayon.
                </p>

                <div className="flex items-center gap-3 text-indigo-400">
                   <span className="relative flex h-3 w-3">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                   </span>
                   <span className="font-black uppercase tracking-[0.4em] text-xs md:text-sm">Prêt pour le Scan</span>
                </div>
              </motion.div>

              {/* Right Column: Camera Scanner Viewbox */}
              <div className="relative w-full md:w-[50%] landscape:w-[50%] max-w-md md:max-w-xl group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-[50px] blur opacity-15 group-hover:opacity-25 transition duration-1000" />
                
                <div className="relative w-full bg-[#020617] rounded-[42px] md:rounded-[48px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] overflow-hidden border-4 md:border-8 border-[#1e293b] z-10 aspect-video md:aspect-video flex items-center justify-center">
                  <video id="camera-reader-main" className={cn(
                    "absolute inset-0 bg-black transition-opacity duration-1000 w-full h-full object-cover",
                    isScanning ? "opacity-100" : "opacity-0"
                  )}></video>
                  
                  {/* Scan Animation Overlay */}
                  <div className="absolute inset-0 pointer-events-none z-20 flex flex-col items-center justify-center">
                     <div className="absolute top-6 left-6 w-10 h-10 border-t-4 border-l-4 border-indigo-500 rounded-tl-2xl opacity-60" />
                     <div className="absolute top-6 right-6 w-10 h-10 border-t-4 border-r-4 border-indigo-500 rounded-tr-2xl opacity-60" />
                     <div className="absolute bottom-6 left-6 w-10 h-10 border-b-4 border-l-4 border-indigo-500 rounded-bl-2xl opacity-60" />
                     <div className="absolute bottom-6 right-6 w-10 h-10 border-b-4 border-r-4 border-indigo-500 rounded-br-2xl opacity-60" />

                     {isScanning && (
                       <motion.div 
                        initial={{ top: "15%" }}
                        animate={{ top: "85%" }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatType: "reverse" }}
                        className="absolute left-[15%] right-[15%] h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_20px_rgba(99,102,241,0.8)] z-30"
                       />
                     )}

                     {!isScanning && (
                        <div className="flex flex-col items-center gap-4">
                           <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center animate-pulse">
                             <CameraOff size={24} className="text-slate-500" />
                           </div>
                           <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Veuillez cliquer pour activer la caméra</p>
                        </div>
                     )}
                  </div>
                </div>
              </div>

              {/* Error Notification */}
              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ scale: 0.9, y: 30, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.9, y: 15, opacity: 0 }}
                    className="fixed bottom-[10%] left-1/2 -translate-x-1/2 px-8 py-5 bg-rose-600/95 backdrop-blur-xl rounded-[24px] shadow-[0_40px_80px_rgba(225,29,72,0.4)] z-[110] border border-rose-400 flex flex-col items-center gap-1 min-w-[320px]"
                  >
                    <div className="text-[9px] font-black text-rose-200 uppercase tracking-[0.4em]">Identifiant Inconnu</div>
                    <div className="text-lg md:text-xl font-black text-white uppercase tracking-tight">{error}</div>
                    <div className="text-[9px] text-rose-100/60 font-bold italic">Vérifiez l'étiquette et réessayez</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Brand Accent - More subtle to look premium on horizontal layout */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 opacity-30 select-none pointer-events-none text-[10px] uppercase font-black tracking-[0.3em] whitespace-nowrap">
           <span>NEXUS BORNE PRO</span>
           <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
           <span className="text-indigo-400">SYS v3.0</span>
        </div>
      </div>
    </div>
  );
});
