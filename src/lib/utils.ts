
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Category } from '../types';
import { supabase } from '../supabase';

/** Utility for Tailwind class merging */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const logAction = async (userId: string, userName: string, action: string, module: string, details: string, severity: 'info' | 'warning' | 'critical' = 'info') => {
  try {
    const id = Math.random().toString(36).substring(2, 11);
    const { error } = await supabase.from('audit_logs').insert({
      id,
      timestamp: new Date().toISOString(),
      userId,
      userName,
      action,
      module,
      details,
      severity
    });
    if (error) throw error;
  } catch (error) {
    console.error("Failed to log action:", error);
  }
};

export const generateUniqueId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9).toUpperCase();
};

export const formatProductStock = (p: any, allProducts: any[]) => {
  if (p.isBundle && p.bundleItems && p.bundleItems.length > 0) {
    const maxBundles = Math.min(...p.bundleItems.map((bi: any) => {
       const component = allProducts.find((prod: any) => prod.id === bi.productId);
       return component ? Math.floor(component.stock / bi.quantity) : 0;
    }));
    return `${maxBundles} (Pack)`;
  }
  
  const parentBundle = allProducts.find(prod => prod.isBundle && prod.bundleItems?.find((bi: any) => bi.productId === p.id && bi.quantity > 1));
  if (parentBundle) {
    const bundleDef = parentBundle.bundleItems!.find((bi: any) => bi.productId === p.id)!;
    const packs = Math.floor(p.stock / bundleDef.quantity);
    const units = p.stock % bundleDef.quantity;
    if (packs > 0) {
       return `${packs} Pac + ${units} Unit`;
    }
  }
  return `${p.stock}`;
};

export const calculateItemPrice = (item: any, isWholesale: boolean = false) => {
  let price = parseFloat(item.price?.toString()) || 0;
  if (isNaN(price)) price = 0;
  
  if (item.quantityDiscounts && item.quantityDiscounts.length > 0) {
    const applicableDiscount = [...item.quantityDiscounts]
      .sort((a, b) => b.minQuantity - a.minQuantity)
      .find((d: any) => item.quantity >= d.minQuantity);
    if (applicableDiscount) {
      const dPrice = parseFloat(applicableDiscount.discountPrice?.toString());
      if (!isNaN(dPrice)) price = dPrice;
    }
  }

  if (isWholesale && item.wholesalePrice !== undefined) {
    const wPrice = parseFloat(item.wholesalePrice?.toString());
    if (!isNaN(wPrice)) price = wPrice;
  }

  if (item.overriddenPrice !== undefined) {
    const oPrice = parseFloat(item.overriddenPrice?.toString());
    if (!isNaN(oPrice)) price = oPrice;
  }

  if (item.lineDiscount) {
    const dVal = parseFloat(item.lineDiscount.value?.toString());
    if (!isNaN(dVal)) {
      if (item.lineDiscount.type === 'percentage') {
        price = price * (1 - dVal / 100);
      } else {
        price = Math.max(0, price - dVal);
      }
    }
  }

  return isNaN(price) ? 0 : price;
};

export const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportToCSV = (data: any[], fileName: string) => {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${fileName}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const isLocked = (timestamp: string, lockingPeriodDays: number) => {
  if (!lockingPeriodDays || lockingPeriodDays <= 0) return false;
  const tDate = new Date(timestamp);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - tDate.getTime());
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays > lockingPeriodDays;
};

export const safeDate = (val: any) => {
  if (!val) return new Date(0);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date(0) : d;
};

export const formatSafe = (val: any, formatStr: string, options?: any) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return format(d, formatStr, options);
};

export const getHierarchicalCategories = (categories: Category[], parentId: string | null = null, level: number = 0): (Category & { level: number })[] => {
  let result: (Category & { level: number })[] = [];
  const children = categories.filter(c => (c.parentId || null) === parentId);
  for (const child of children) {
    result.push({ ...child, level });
    result = result.concat(getHierarchicalCategories(categories, child.id, level + 1));
  }
  return result;
};

export const getCategoryDescendants = (categories: Category[], categoryId: string): string[] => {
  const children = categories.filter(c => c.parentId === categoryId).map(c => c.id);
  let descendants = [...children];
  for (const childId of children) {
    descendants = descendants.concat(getCategoryDescendants(categories, childId));
  }
  return descendants;
};

export const getCategoryPath = (categoryId: string, categories: Category[]): string => {
  const category = categories.find(c => c.id === categoryId);
  if (!category) return '';
  if (!category.parentId) return category.name;
  return `${getCategoryPath(category.parentId, categories)} > ${category.name}`;
};

// --- Audio Utilities ---
export const playScanSound = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextCls = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (typeof AudioContextCls === 'function') {
      try {
        const canUseNew = AudioContextCls.prototype && typeof AudioContextCls.prototype === 'object';
        const audioCtx = canUseNew ? new AudioContextCls() : (typeof AudioContextCls === 'function' ? AudioContextCls() : null);
        if (!audioCtx) return;
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note (standard pos beep)
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      } catch (innerErr) {
        console.warn("AudioContext failed:", innerErr);
      }
    }
  } catch (e) {
    console.error("Audio error:", e);
  }
};

export const announcePrice = (name: string, price: number, currency: string) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  
  try {
    // Cancel previous speech
    window.speechSynthesis.cancel();
    
    // Hardened check for SpeechSynthesisUtterance
    const Utterance = (window as any).SpeechSynthesisUtterance;
    if (typeof Utterance !== 'function') return;

    // Safely check if it's a constructor
    const canUseNew = Utterance.prototype && typeof Utterance.prototype === 'object';
    const msg = canUseNew ? new Utterance() : (typeof Utterance === 'function' ? Utterance() : null);
    if (!msg) return;
    msg.text = `${name}. ${price.toFixed(2)} ${currency === '€' ? 'Euros' : currency}`;
    msg.lang = 'fr-FR';
    msg.rate = 1.1;
    msg.pitch = 1;
    
    window.speechSynthesis.speak(msg);
  } catch (e) {
    console.warn('Speech synthesis failed:', e);
  }
};
