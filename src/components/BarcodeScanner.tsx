import { motion, AnimatePresence } from 'motion/react';
import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, DecodeHintType } from '@zxing/library';
import { Button } from './ui';
import { X, Camera, CameraOff, Zap, ZapOff, CheckCircle2 } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let codeReader: any = null;
    let animationFrameId: number;
    let lastScanTime = 0;
    let currentStream: MediaStream | null = null;

    const handleSuccess = (data: string) => {
      const now = Date.now();
      // Cooldown to avoid duplicate scans
      if (now - lastScanTime < 1500) {
        return;
      }
      
      setLastScanned(data);
      setTimeout(() => {
        if (isMounted) setLastScanned(null);
      }, 1000);

      // Vibrate on successful scan if supported
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(100);
      }
      
      // Emit beep
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start();
          setTimeout(() => {
            osc.stop();
            ctx.close();
          }, 100);
        }
      } catch (e) {}
      
      lastScanTime = now;
      onScan(data);
    };

    const startScanner = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        
        if (!isMounted || !videoRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        currentStream = stream;
        
        // Check for torch capability
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities() as any;
        if (capabilities.torch) {
          setTorchAvailable(true);
        }
        
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();

        // 1. Priorité à Google BarcodeDetector
        if ('BarcodeDetector' in window) {
          try {
            // @ts-ignore
            const formats = await window.BarcodeDetector.getSupportedFormats();
            if (formats.length > 0) {
              // @ts-ignore
              const detector = new window.BarcodeDetector({ formats });
              const detect = async () => {
                if (!isMounted || !videoRef.current) return;
                try {
                  const barcodes = await detector.detect(videoRef.current);
                  if (barcodes.length > 0) {
                    handleSuccess(barcodes[0].rawValue);
                  }
                } catch (err) {}
                animationFrameId = requestAnimationFrame(detect);
              };
              detect();
              return;
            }
          } catch (err) {}
        }

        // 2. Fallback ZXing
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, null);
        codeReader = new BrowserMultiFormatReader(hints);
        
        if (typeof codeReader.decodeFromVideoElement === 'function') {
           try {
             codeReader.decodeFromVideoElement(videoRef.current, (result: any) => {
               if (result && isMounted) {
                 handleSuccess(result.getText());
               }
             });
           } catch(e) {
             const scanLoop = async () => {
               if (!isMounted || !videoRef.current) return;
               try {
                 const result = await codeReader.decodeOnceFromVideoElement(videoRef.current);
                 if (result && isMounted) {
                   handleSuccess(result.getText());
                 }
               } catch (err) {}
               setTimeout(scanLoop, 500);
             };
             scanLoop();
           }
        }
      } catch (e: any) {
        if (isMounted) {
          setErrorMsg(e?.name === 'NotAllowedError' ? "Accès caméra refusé." : "Impossible d'ouvrir la caméra.");
        }
      }
    };

    startScanner();
    return () => {
      isMounted = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
      }
      if (codeReader) {
        try {
          codeReader.reset();
        } catch (e) {}
      }
    };
  }, [onScan]);

  const toggleTorch = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchEnabled }] as any
      });
      setTorchEnabled(!torchEnabled);
    } catch (err) {
      console.warn("Failed to toggle torch:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[9999] flex items-center justify-center p-0 md:p-6 select-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full h-full md:max-w-3xl md:h-[80vh] bg-slate-950/95 backdrop-blur-2xl md:rounded-[2.5rem] shadow-neon-indigo border border-white/5 overflow-hidden flex flex-col ring-1 ring-white/10 relative"
      >
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5 select-none">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-slate-900 rounded-2xl text-indigo-400 shadow-inner">
              <Camera size={20} />
            </div>
            <div>
              <h3 className="font-black text-white text-xs uppercase tracking-[0.2em] mb-0.5">Scanner Principal</h3>
              <p className="text-[10px] text-indigo-400/60 font-black uppercase tracking-widest">Système de Vision Actif</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {torchAvailable && (
              <button 
                onClick={toggleTorch}
                className={`h-11 w-11 rounded-2xl border transition-all flex items-center justify-center ${torchEnabled ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-neon-indigo' : 'hover:bg-white/5 border-white/10 text-slate-500'}`}
              >
                {torchEnabled ? <Zap size={20} fill="currentColor" /> : <ZapOff size={20} />}
              </button>
            )}
            <button onClick={onClose} className="h-11 w-11 rounded-2xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-slate-500 transition-all border border-white/10" title="Fermer le scanner">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-0 bg-[#0a0a0a] flex-1 relative flex items-center justify-center overflow-hidden touch-none group">
          {errorMsg ? (
            <div className="flex flex-col items-center justify-center text-rose-500 p-8 text-center bg-rose-50/10">
              <CameraOff size={48} className="mb-4 opacity-50" />
              <p className="text-sm font-bold tracking-tight">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-4 border-rose-200 text-rose-600">Actualiser</Button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover pointer-events-none brightness-[1.1] contrast-[1.1]"
                muted
              />
              
              {/* Professional Overlay */}
              <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                 {/* Translucent bars */}
                 <div className="w-full h-full absolute inset-0 bg-black/30 backdrop-blur-[2px]" style={{
                   maskImage: 'radial-gradient(ellipse 65% 55% at 50% 50%, transparent 60%, black 100%)',
                   WebkitMaskImage: 'radial-gradient(ellipse 65% 55% at 50% 50%, transparent 60%, black 100%)'
                 }} />

                 {/* Central Active Zone */}
                 <div className="w-[75%] h-[65%] relative">
                    {/* Modern Scanning Corners */}
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-xl shadow-lg" />
                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-xl shadow-lg" />
                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-xl shadow-lg" />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-xl shadow-lg" />
                    
                    {/* Moving Laser Line */}
                    <motion.div 
                      animate={{ 
                        top: ["10%", "90%", "10%"],
                        opacity: [0.4, 1, 0.4]
                      }}
                      transition={{ 
                        duration: 2.5, 
                        repeat: Infinity, 
                        ease: "easeInOut" 
                      }}
                      className="absolute left-[5%] right-[5%] h-[3px] bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_15px_rgba(244,63,94,0.8)] z-20"
                    />
                 </div>

                 {/* Helpful tooltip during scan */}
                 <div className="absolute bottom-6 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[11px] text-white font-bold tracking-wider uppercase">Visez un code-barres</span>
                 </div>
              </div>

              {/* Scan Feedback Overlay */}
              <AnimatePresence>
                {lastScanned && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 z-30 flex items-center justify-center bg-indigo-600/40 backdrop-blur-md"
                  >
                    <div className="bg-slate-900/90 px-8 py-6 rounded-[2.5rem] shadow-neon-cyan border border-emerald-500/30 flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-emerald-500/10 rounded-[1.5rem] text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                        <CheckCircle2 size={36} />
                      </div>
                      <div className="text-center">
                        <span className="block text-2xl font-black text-white font-mono tracking-[0.2em] mb-1">{lastScanned}</span>
                        <span className="text-[10px] text-emerald-400/60 font-black uppercase tracking-[0.3em]">Code Validé</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}



