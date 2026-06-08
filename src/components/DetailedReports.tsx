import React, { useState, useMemo, memo, useCallback, useRef } from 'react';
import { 
  Package,
  TrendingUp, 
  LayoutGrid, 
  ShoppingBag, 
  Users, 
  Banknote, 
  Gift, 
  Tag, 
  Download, 
  Search, 
  X, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpDown,
  History,
  CreditCard,
  Brain,
  Zap,
  AlertTriangle,
  Trash2,
  Clock,
  RotateCcw
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell, 
  PieChart, 
  Pie, 
  Legend 
} from 'recharts';
import { motion } from 'motion/react';
import { format, isToday, isThisWeek, isThisMonth, isThisYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn, formatSafe, getHierarchicalCategories, getCategoryDescendants, calculateItemPrice } from '../lib/utils';
import { Button, Card, Modal, SafeImage } from './ui';
import { AIAssistant } from './AIAssistant';
import { MarketingPosters } from './MarketingPosters';
import { Transaction, Product, Employee, Expense, SupplierPayment, ProductReturn, CompanySettings, Category, Customer, StockAdjustment } from '../types';

interface DetailedReportsProps {
  transactions: Transaction[];
  products: Product[];
  employees: Employee[];
  expenses: Expense[];
  supplierPayments: SupplierPayment[];
  returns: ProductReturn[];
  settings: CompanySettings;
  categories: Category[];
  customers: Customer[];
  stockAdjustments: StockAdjustment[];
}

export const DetailedReports = memo(function DetailedReports({ 
  transactions, 
  products, 
  employees, 
  expenses, 
  supplierPayments, 
  returns, 
  settings, 
  categories, 
  customers,
  stockAdjustments
}: DetailedReportsProps) {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [reportsTab, setReportsTab] = useState<'charts' | 'profits' | 'marketing' | 'cashflow' | 'fidelity_stats' | 'stock_value' | 'ai_assistant' | 'losses'>('charts');
  
  // Profit Analysis States
  const [profitFilterDate, setProfitFilterDate] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('all');
  const [profitFilterCategory, setProfitFilterCategory] = useState<string>('all');
  const [profitFilterSubCategory, setProfitFilterSubCategory] = useState<string>('all');
  const [profitSortFormat, setProfitSortFormat] = useState<'revenue_desc' | 'revenue_asc' | 'profit_desc' | 'profit_asc' | 'margin_desc' | 'margin_asc' | 'qty_desc' | 'qty_asc'>('profit_desc');
  
  const [profitFilterCustomer, setProfitFilterCustomer] = useState<string>('all');
  const [profitFilterEmployee, setProfitFilterEmployee] = useState<string>('all');
  const [profitSearchProduct, setProfitSearchProduct] = useState<string>('');
  
  const [profitFilterSource, setProfitFilterSource] = useState<'all' | 'pos' | 'online'>('all');
  const [profitFilterTimeStart, setProfitFilterTimeStart] = useState<string>('');
  const [profitFilterTimeEnd, setProfitFilterTimeEnd] = useState<string>('');
  
  // Marketing Analysis States
  const [marketingFilterDate, setMarketingFilterDate] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('all');
  
  // Stock Value Filter States
  const [stockFilterCategory, setStockFilterCategory] = useState<string>('all');
  const [stockFilterStatus, setStockFilterStatus] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [stockFilterSearch, setStockFilterSearch] = useState<string>('');
  
  const filteredStockProducts = useMemo(() => {
    return products.filter(p => {
      // Category Filter
      if (stockFilterCategory !== 'all' && p.categoryId !== stockFilterCategory) return false;
      
      // Status Filter
      if (stockFilterStatus === 'in_stock' && (p.stock || 0) <= 0) return false;
      if (stockFilterStatus === 'low_stock' && ((p.stock || 0) <= 0 || (p.stock || 0) > (p.minStock || 5))) return false;
      if (stockFilterStatus === 'out_of_stock' && (p.stock || 0) > 0) return false;
      
      // Search Filter
      if (stockFilterSearch) {
        const query = stockFilterSearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(query) || 
          p.sku?.toLowerCase().includes(query) || 
          p.barcode?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [products, stockFilterCategory, stockFilterStatus, stockFilterSearch]);

  const marketingData = useMemo(() => {
    let filtered = transactions.filter(t => t.status !== 'returned');
    
    filtered = filtered.filter(t => {
      const tDate = new Date(t.timestamp);
      if (isNaN(tDate.getTime())) return false;
      if (marketingFilterDate === 'today' && !isToday(tDate)) return false;
      if (marketingFilterDate === 'week' && !isThisWeek(tDate, { weekStartsOn: 1 })) return false;
      if (marketingFilterDate === 'month' && !isThisMonth(tDate)) return false;
      if (marketingFilterDate === 'year' && !isThisYear(tDate)) return false;
      return true;
    });

    let totalDiscounts = 0;
    let totalVouchers = 0;
    let totalPointsDiscount = 0;
    let transactionsWithPromos: Transaction[] = [];

    filtered.forEach(t => {
      const d = t.discountAmount || 0;
      const v = t.voucherDiscount || 0;
      const p = t.pointsDiscount || 0;

      if (d > 0 || v > 0 || p > 0) {
        totalDiscounts += d;
        totalVouchers += v;
        totalPointsDiscount += p;
        transactionsWithPromos.push(t);
      }
    });

    transactionsWithPromos.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      totalDiscounts,
      totalVouchers,
      totalPointsDiscount,
      totalSavings: totalDiscounts + totalVouchers + totalPointsDiscount,
      transactions: transactionsWithPromos
    };
  }, [transactions, marketingFilterDate]);

  const [selectedTransactionForProfit, setSelectedTransactionForProfit] = useState<Transaction | null>(null);

  const exportAccountingCSV = () => {
    const headers = ['Date', 'Transaction ID', 'Total', 'Tax', 'Payment Method', 'Status'];
    const rows = transactions.map(t => [
      formatSafe(t.timestamp, 'yyyy-MM-dd HH:mm:ss'),
      t.id,
      t.total.toFixed(2),
      (t.total * (settings.taxRate / 100)).toFixed(2),
      t.paymentMethod || 'N/A',
      t.status || 'completed'
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `accounting_export_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const data = useMemo(() => {
    const categoryMap: Record<string, number> = {};
    const employeeMap: Record<string, number> = {};
    const periodMap: Record<string, number> = {};
    const productMap: Record<string, { name: string, quantity: number, revenue: number }> = {};

    transactions.forEach(t => {
      if (t.status === 'returned') return;
      
      t.items.forEach(item => {
        const cat = item.categoryId || 'Non classé';
        categoryMap[cat] = (categoryMap[cat] || 0) + (calculateItemPrice(item, t.isWholesale) * item.quantity);
        
        const prodId = item.id;
        if (!productMap[prodId]) {
          productMap[prodId] = { name: item.name, quantity: 0, revenue: 0 };
        }
        productMap[prodId].quantity += item.quantity;
        productMap[prodId].revenue += (calculateItemPrice(item, t.isWholesale) * item.quantity);
      });

      const emp = t.employeeName || 'Système';
      employeeMap[emp] = (employeeMap[emp] || 0) + t.total;

      const key = period === 'monthly' 
        ? formatSafe(t.timestamp, 'MMM yyyy', { locale: fr })
        : formatSafe(t.timestamp, 'yyyy', { locale: fr });
      periodMap[key] = (periodMap[key] || 0) + t.total;
    });

    const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
    const employeeData = Object.entries(employeeMap).map(([name, value]) => ({ name, value }));
    const periodData = Object.entries(periodMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        if (period === 'yearly') return parseInt(a.name) - parseInt(b.name);
        return 0; 
      });
    
    // Revenue by source
    const revenueBySource = transactions.reduce((acc, t) => {
        if (t.status === 'returned') return acc;
        const source = t.onlineOrderId ? 'Application' : 'Magasin';
        acc[source] = (acc[source] || 0) + t.total;
        return acc;
    }, { Magasin: 0, Application: 0 } as Record<string, number>);

    const productSalesData = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue);
    const topProducts = productSalesData.slice(0, 10);

    const totalRevenue = transactions.reduce((sum, t) => sum + (t.status === 'returned' ? 0 : t.total), 0);
    const totalCost = transactions.reduce((sum, t) => {
      if (t.status === 'returned') return sum;
      return sum + t.items.reduce((itemSum, item) => {
        const product = products.find(p => p.id === item.id);
        const costPrice = product?.costPrice || 0;
        
        // Add operational costs (packaging, shipping, other)
        const opCosts = product?.operationalCosts || {};
        const packaging = opCosts.packaging ?? (t.onlineOrderId ? (settings.operationalCosts?.basePackaging || 0) : 0);
        const shipping = opCosts.shipping ?? (t.onlineOrderId ? (settings.operationalCosts?.baseShipping || 0) : 0);
        const other = opCosts.other || 0;
        
        const totalUnitCost = costPrice + packaging + shipping + other;
        
        return itemSum + (totalUnitCost * item.quantity);
      }, 0);
    }, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalExpenses;

    return { 
      categoryData, 
      employeeData, 
      periodData, 
      revenueBySource,
      topProducts, 
      productSalesData, 
      totalRevenue, 
      totalCost, 
      totalExpenses, 
      grossProfit, 
      netProfit 
    };
  }, [transactions, products, expenses, period]);

  const lossData = useMemo(() => {
    const losses = stockAdjustments.filter(adj => adj.adjustment < 0 && adj.isLoss === true);
    
    let totalLossValue = 0;
    const lossByCategory: Record<string, number> = {};
    const lossByReason: Record<string, number> = {};
    
    const formattedLosses = losses.map(adj => {
      const product = products.find(p => p.id === adj.productId);
      const costPrice = product?.costPrice || 0;
      const lossValue = Math.abs(adj.adjustment) * costPrice;
      
      totalLossValue += lossValue;
      
      const category = categories.find(c => c.id === product?.categoryId)?.name || 'Non classé';
      lossByCategory[category] = (lossByCategory[category] || 0) + lossValue;
      
      const reason = adj.reason || 'Autre';
      lossByReason[reason] = (lossByReason[reason] || 0) + lossValue;
      
      return {
        ...adj,
        product,
        lossValue
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      totalLossValue,
      lossByCategory: Object.entries(lossByCategory).map(([name, value]) => ({ name, value })),
      lossByReason: Object.entries(lossByReason).map(([name, value]) => ({ name, value })),
      formattedLosses
    };
  }, [stockAdjustments, products, categories]);

  const productProfitData = useMemo(() => {
    let filteredTransactions = transactions.filter(t => t.status !== 'returned');

    filteredTransactions = filteredTransactions.filter(t => {
      const tDate = new Date(t.timestamp);
      if (isNaN(tDate.getTime())) return false;
      if (profitFilterDate === 'today' && !isToday(tDate)) return false;
      if (profitFilterDate === 'week' && !isThisWeek(tDate, { weekStartsOn: 1 })) return false;
      if (profitFilterDate === 'month' && !isThisMonth(tDate)) return false;
      if (profitFilterDate === 'year' && !isThisYear(tDate)) return false;
      
      if (profitFilterTimeStart) {
        const [hours, minutes] = profitFilterTimeStart.split(':').map(Number);
        if (tDate.getHours() < hours || (tDate.getHours() === hours && tDate.getMinutes() < minutes)) return false;
      }
      
      if (profitFilterTimeEnd) {
        const [hours, minutes] = profitFilterTimeEnd.split(':').map(Number);
        if (tDate.getHours() > hours || (tDate.getHours() === hours && tDate.getMinutes() > minutes)) return false;
      }
      
      if (profitFilterSource !== 'all') {
        const isOnline = !!t.onlineOrderId;
        if (profitFilterSource === 'online' && !isOnline) return false;
        if (profitFilterSource === 'pos' && isOnline) return false;
      }
      
      if (profitFilterCustomer !== 'all' && t.customerId !== profitFilterCustomer) return false;
      if (profitFilterEmployee !== 'all') {
         const empName = employees?.find(e => e.id === profitFilterEmployee)?.name;
         if (empName && t.employeeName !== empName) return false;
      }
      
      return true;
    });

    const productStats: Record<string, { qty: number, revenue: number, cost: number }> = {};
    
    // O(1) Speed optimization: Create a product map once instead of searching inside nested loop
    const productsById = new Map<string, Product>();
    products.forEach(p => productsById.set(p.id, p));

    filteredTransactions.forEach(t => {
      const subtotal = t.items.reduce((s, item) => s + (calculateItemPrice(item, t.isWholesale) * item.quantity), 0);
      const totalDiscounts = (t.discountAmount || 0) + (t.pointsDiscount || 0) + (t.voucherDiscount || 0);

      t.items.forEach(item => {
        if (!productStats[item.id]) {
          productStats[item.id] = { qty: 0, revenue: 0, cost: 0 };
        }
        productStats[item.id].qty += item.quantity;
        
        const itemSubtotal = calculateItemPrice(item, t.isWholesale) * item.quantity;
        const itemDiscount = subtotal > 0 ? (itemSubtotal / subtotal) * totalDiscounts : 0;
        const itemRevenue = itemSubtotal - itemDiscount;
        
        productStats[item.id].revenue += itemRevenue;
        
        const p = productsById.get(item.id);
        const baseCost = p?.costPrice || 0;
        
        // Dynamic operational costs
        const opCosts = p?.operationalCosts || {};
        const packaging = opCosts.packaging ?? (t.onlineOrderId ? (settings.operationalCosts?.basePackaging || 0) : 0);
        const shipping = opCosts.shipping ?? (t.onlineOrderId ? (settings.operationalCosts?.baseShipping || 0) : 0);
        const other = opCosts.other || 0;
        
        const totalUnitCost = baseCost + packaging + shipping + other;
        productStats[item.id].cost += totalUnitCost * item.quantity;
      });
    });

    // Subtract returns from stats
    returns.forEach(ret => {
        const tDate = new Date(ret.timestamp);
        if (isNaN(tDate.getTime())) return;
        if (profitFilterDate === 'today' && !isToday(tDate)) return;
        if (profitFilterDate === 'week' && !isThisWeek(tDate, { weekStartsOn: 1 })) return;
        if (profitFilterDate === 'month' && !isThisMonth(tDate)) return;
        if (profitFilterDate === 'year' && !isThisYear(tDate)) return;

        if (profitFilterTimeStart) {
          const [hours, minutes] = profitFilterTimeStart.split(':').map(Number);
          if (tDate.getHours() < hours || (tDate.getHours() === hours && tDate.getMinutes() < minutes)) return;
        }

        if (profitFilterTimeEnd) {
          const [hours, minutes] = profitFilterTimeEnd.split(':').map(Number);
          if (tDate.getHours() > hours || (tDate.getHours() === hours && tDate.getMinutes() > minutes)) return;
        }

        const originalTx = transactions.find(t => t.id === ret.transactionId);
        if (profitFilterSource !== 'all' || profitFilterCustomer !== 'all' || profitFilterEmployee !== 'all') {
          // In returns, we look up the original transaction to check if it matches filters
          
          if (profitFilterSource !== 'all') {
            const isOnline = !!originalTx?.onlineOrderId;
            if (profitFilterSource === 'online' && !isOnline) return;
            if (profitFilterSource === 'pos' && isOnline) return;
          }
          
          if (profitFilterCustomer !== 'all' && originalTx?.customerId !== profitFilterCustomer) return;
          
          if (profitFilterEmployee !== 'all') {
            const empName = employees?.find(e => e.id === profitFilterEmployee)?.name;
            if (empName && originalTx?.employeeName !== empName) return;
          }
        }

        const retSubtotal = ret.items.reduce((s, it) => s + (calculateItemPrice(it, originalTx?.isWholesale) * it.quantity), 0);
        
        ret.items.forEach(item => {
            if (productStats[item.productId]) {
                productStats[item.productId].qty -= item.quantity;
                
                const itemSubtotal = calculateItemPrice(item, originalTx?.isWholesale) * item.quantity;
                const refundedRevenue = retSubtotal > 0 ? (itemSubtotal / retSubtotal) * (ret.totalRefund || itemSubtotal) : 0;
                
                productStats[item.productId].revenue -= refundedRevenue;
                
                const p = productsById.get(item.productId);
                const baseCost = p?.costPrice || 0;
                
                // Operational costs are usually lost on returns, but for simplicity we recalculate cost reduction
                // Note: In real scenarios, shipping might not be refundable.
                productStats[item.productId].cost -= (baseCost * item.quantity);
            }
        });
    });

    let result = products.map(p => {
      const stats = productStats[p.id] || { qty: 0, revenue: 0, cost: 0 };
      const profit = stats.revenue - stats.cost;
      const margin = stats.revenue > 0 ? (profit / stats.revenue) * 100 : 0;
      return {
        ...p,
        stats,
        profit,
        margin
      };
    });

    // Only show products that have activity (sold or returned)
    result = result.filter(r => r.stats.qty !== 0 || Math.abs(r.stats.revenue) > 0.01);

    // Filter by Category
    if (profitFilterCategory !== 'all') {
      const descendants = getCategoryDescendants(categories, profitFilterCategory);
      result = result.filter(r => r.categoryId === profitFilterCategory || descendants.includes(r.categoryId));
    }

    // Filter by Product Search
    if (profitSearchProduct.trim() !== '') {
      const query = profitSearchProduct.toLowerCase();
      result = result.filter(r => 
        r.name.toLowerCase().includes(query) || 
        r.sku?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
       if (profitSortFormat === 'revenue_desc') return b.stats.revenue - a.stats.revenue;
       if (profitSortFormat === 'revenue_asc') return a.stats.revenue - b.stats.revenue;
       if (profitSortFormat === 'profit_desc') return b.profit - a.profit;
       if (profitSortFormat === 'profit_asc') return a.profit - b.profit;
       if (profitSortFormat === 'margin_desc') return b.margin - a.margin;
       if (profitSortFormat === 'margin_asc') return a.margin - b.margin;
       if (profitSortFormat === 'qty_desc') return b.stats.qty - a.stats.qty;
       if (profitSortFormat === 'qty_asc') return a.stats.qty - b.stats.qty;
       return 0;
    });

    return result;
  }, [transactions, products, categories, profitFilterDate, profitFilterCategory, profitFilterSubCategory, profitSortFormat, profitFilterCustomer, profitFilterEmployee, profitSearchProduct, employees, settings.operationalCosts, profitFilterTimeStart, profitFilterTimeEnd, profitFilterSource, returns]);

  const handleProfitSort = (key: 'revenue' | 'profit' | 'margin' | 'qty') => {
    setProfitSortFormat(prev => {
      if (prev.startsWith(key)) {
        return prev.endsWith('_desc') ? `${key}_asc` as any : `${key}_desc` as any;
      }
      return `${key}_desc` as any;
    });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (!profitSortFormat.startsWith(column)) return <ArrowUpDown size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return profitSortFormat.endsWith('_desc') 
      ? <ChevronUp size={14} className="text-indigo-500 rotate-180" />
      : <ChevronUp size={14} className="text-indigo-500" />;
  };

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white uppercase tracking-wider">Rapports de Ventes Détaillés</h3>
          <p className="text-sm text-white/40">Analysez vos performances sous tous les angles.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button 
              onClick={() => setReportsTab('charts')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                reportsTab === 'charts' ? "bg-white text-indigo-600 shadow-xl" : "text-white/40 hover:text-white"
              )}
            >
              Graphiques
            </button>
            <button 
              onClick={() => setReportsTab('profits')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                reportsTab === 'profits' ? "bg-white text-indigo-600 shadow-xl" : "text-white/40 hover:text-white"
              )}
            >
              Analyse des Bénéfices
            </button>
            <button 
              onClick={() => setReportsTab('fidelity_stats')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                reportsTab === 'fidelity_stats' ? "bg-white text-indigo-600 shadow-xl" : "text-white/40 hover:text-white"
              )}
            >
              Fidélité & Remises
            </button>
            <button 
              onClick={() => setReportsTab('cashflow')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                reportsTab === 'cashflow' ? "bg-white text-indigo-600 shadow-xl" : "text-white/40 hover:text-white"
              )}
            >
              Trésorerie
            </button>
            <button 
              onClick={() => setReportsTab('stock_value')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                reportsTab === 'stock_value' ? "bg-white text-indigo-600 shadow-xl" : "text-white/40 hover:text-white"
              )}
            >
              Valorisation Stock
            </button>
            <button 
              onClick={() => setReportsTab('losses')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                reportsTab === 'losses' ? "bg-rose-600 text-white shadow-xl" : "text-rose-400 hover:bg-white/5"
              )}
            >
              <Trash2 size={14} />
              Pertes
            </button>
            <button 
              onClick={() => setReportsTab('ai_assistant')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                reportsTab === 'ai_assistant' ? "bg-indigo-600 text-white shadow-xl" : "text-indigo-400 hover:bg-white/5"
              )}
            >
              <Brain size={14} />
              Intelligence IA
            </button>
            <button 
              onClick={() => setReportsTab('marketing')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                reportsTab === 'marketing' ? "bg-indigo-600 text-white shadow-xl" : "text-indigo-400 hover:bg-white/5"
              )}
            >
              <Zap size={14} />
              Marketing
            </button>
          </div>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button 
              onClick={() => setPeriod('monthly')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                period === 'monthly' ? "bg-white text-indigo-600 shadow-sm" : "text-white/40 hover:text-white"
              )}
            >
              Mensuel
            </button>
            <button 
              onClick={() => setPeriod('yearly')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                period === 'yearly' ? "bg-white text-indigo-600 shadow-sm" : "text-white/40 hover:text-white"
              )}
            >
              Annuel
            </button>
          </div>
          <Button onClick={exportAccountingCSV} variant="secondary" className="flex items-center gap-2">
            <Download size={18} /> Export Comptable
          </Button>
        </div>
      </div>

      {reportsTab === 'charts' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="p-6 border-l-4 border-l-indigo-500 bg-white/5">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-2">Chiffre d'Affaires</p>
              <h4 className="text-2xl font-black text-white">{data.totalRevenue.toFixed(2)} {settings.currency}</h4>
            </Card>
            <Card className="p-6 border-l-4 border-l-rose-500 bg-white/5">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-2">Coût des Ventes</p>
              <h4 className="text-2xl font-black text-white">{data.totalCost.toFixed(2)} {settings.currency}</h4>
            </Card>
            <Card className="p-6 border-l-4 border-l-amber-500 bg-white/5">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-2">Dépenses Opérationnelles</p>
              <h4 className="text-2xl font-black text-white">{data.totalExpenses.toFixed(2)} {settings.currency}</h4>
            </Card>
            <Card className="p-6 border-l-4 border-l-emerald-500 bg-white/5">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-2">Bénéfice Net</p>
              <h4 className="text-2xl font-black text-emerald-400">{data.netProfit.toFixed(2)} {settings.currency}</h4>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Sales by Period Chart */}
            <Card className="p-6 bg-white/5 border-white/10">
              <h4 className="flex items-center gap-2 text-sm font-black text-white/60 mb-8 uppercase tracking-widest">
                <TrendingUp size={18} className="text-indigo-400" />
                Évolution des Ventes
              </h4>
              <div className="h-[300px] w-full relative min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={300} debounce={50}>
                  <AreaChart data={data.periodData}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#ffffff44' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#ffffff44' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0a0a0f', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: number) => [`${value.toFixed(2)} ${settings.currency}`, 'Total']}
                    />
                    <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Sales by Source Chart */}
            <Card className="p-6 bg-white/5 border-white/10">
              <h4 className="flex items-center gap-2 text-sm font-black text-white/60 mb-8 uppercase tracking-widest">
                <LayoutGrid size={18} className="text-emerald-400" />
                Ventes par Source
              </h4>
              <div className="h-[300px] w-full relative min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={300} debounce={50}>
                  <PieChart>
                    <Pie
                      data={Object.entries(data.revenueBySource).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#4f46e5" stroke="rgba(255,255,255,0.05)" />
                      <Cell fill="#10b981" stroke="rgba(255,255,255,0.05)" />
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0a0a0f', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: number) => [`${value.toFixed(2)} ${settings.currency}`, 'Ventes']}
                    />
                    <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">{value}</span>}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Top Products Table */}
            <Card className="p-6 bg-white/5 border-white/10">
              <h4 className="font-black text-white/60 mb-8 flex items-center gap-2 text-sm uppercase tracking-widest">
                <ShoppingBag size={18} className="text-indigo-400" />
                Top 10 Produits
              </h4>
              <div className="space-y-3">
                {data.topProducts.map((p, idx) => (
                  <div key={`top-product-${idx}`} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-white/20 text-xs shadow-inner">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-black text-white uppercase tracking-tight">{p.name}</p>
                        <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">{p.quantity} unités</p>
                      </div>
                    </div>
                    <p className="text-sm font-black text-indigo-400 font-mono">{p.revenue.toFixed(2)} {settings.currency}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Sales by Employee Chart */}
            <Card className="p-6 lg:col-span-2 bg-white/5 border-white/10">
              <h4 className="flex items-center gap-2 text-sm font-black text-white/60 mb-8 uppercase tracking-widest">
                <Users size={18} className="text-amber-400" />
                Performance par Employé
              </h4>
              <div className="h-[300px] w-full relative min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={300} debounce={50}>
                  <BarChart data={data.employeeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ffffff05" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#ffffff44' }} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#ffffff44' }} width={120} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0a0a0f', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: number) => [`${value.toFixed(2)} ${settings.currency}`, 'Total Vendu']}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      {data.employeeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Sales by Product Chart */}
            <Card className="p-6 lg:col-span-2">
              <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <ShoppingBag size={18} className="text-indigo-600" />
                Ventes par Produit (Volume & Revenu)
              </h4>
              <div className="h-[400px] w-full relative min-h-[400px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={400} debounce={50}>
                  <BarChart data={data.productSalesData.slice(0, 10)} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#64748b' }} 
                      angle={-45} 
                      textAnchor="end" 
                      interval={0}
                    />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number, name: string) => {
                        if (name === 'revenue') return [`${value.toFixed(2)} ${settings.currency}`, 'Chiffre d\'Affaires'];
                        return [value, 'Unités Vendues'];
                      }}
                    />
                    <Legend verticalAlign="top" align="right" />
                    <Bar yAxisId="left" dataKey="revenue" name="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar yAxisId="right" dataKey="quantity" name="quantity" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      ) : reportsTab === 'profits' ? (
        <Card className="overflow-hidden border-white/10 bg-white/5">
          <div className="bg-white/5 p-4 border-b border-white/10">
            <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
              <h4 className="font-black text-white uppercase tracking-tighter flex items-center gap-2 text-sm">
                <Banknote size={18} className="text-emerald-400" />
                Bénéfices & Marges par Produit
              </h4>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full uppercase border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                  Total Bénéfices: {productProfitData.reduce((s, p) => s + p.profit, 0).toFixed(2)} {settings.currency}
                </span>
                <span className="text-[11px] font-black bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full uppercase border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
                  CA Total: {productProfitData.reduce((s, p) => s + p.stats.revenue, 0).toFixed(2)} {settings.currency}
                </span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4 w-full mt-4 bg-white/5 p-3 rounded-2xl border border-white/5">
              <div className="flex-1 min-w-[150px] max-w-[200px]">
                <label className="text-[10px] font-black uppercase text-white/20 tracking-widest mb-1 block">Période</label>
                <select 
                  value={profitFilterDate} 
                  onChange={e => setProfitFilterDate(e.target.value as any)}
                  className="w-full text-sm font-black border-white/10 rounded-xl p-2 bg-[#0a0a0f] text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Toutes périodes</option>
                  <option value="today">Aujourd'hui</option>
                  <option value="week">Cette semaine</option>
                  <option value="month">Ce mois-ci</option>
                  <option value="year">Cette année</option>
                </select>
              </div>

              <div className="flex-1 min-w-[150px] max-w-[200px] flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-black uppercase text-white/20 tracking-widest mb-1 block">Heure début</label>
                  <input 
                    type="time" 
                    value={profitFilterTimeStart} 
                    onChange={e => setProfitFilterTimeStart(e.target.value)}
                    className="w-full text-sm font-black border-white/10 rounded-xl p-2 bg-[#0a0a0f] text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-black uppercase text-white/20 tracking-widest mb-1 block">Heure fin</label>
                  <input 
                    type="time" 
                    value={profitFilterTimeEnd} 
                    onChange={e => setProfitFilterTimeEnd(e.target.value)}
                    className="w-full text-sm font-black border-white/10 rounded-xl p-2 bg-[#0a0a0f] text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {(profitFilterTimeStart || profitFilterTimeEnd) && (
                   <button onClick={() => { setProfitFilterTimeStart(''); setProfitFilterTimeEnd(''); }} className="p-2.5 mb-0.5 text-white/40 hover:text-rose-500 bg-white/5 border border-white/10 rounded-xl transition-colors" title="Réinitialiser">
                     <X size={14} />
                   </button>
                )}
              </div>

              <div className="flex-1 min-w-[150px] max-w-[200px]">
                <label className="text-[10px] font-black uppercase text-white/20 tracking-widest mb-1 block">Source</label>
                <select 
                  value={profitFilterSource} 
                  onChange={e => setProfitFilterSource(e.target.value as any)}
                  className="w-full text-sm font-black border-white/10 rounded-xl p-2 bg-[#0a0a0f] text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Toutes</option>
                  <option value="pos">Magasin (Caisse)</option>
                  <option value="online">En ligne (App)</option>
                </select>
              </div>

              <div className="flex-1 min-w-[150px] max-w-[200px]">
                <label className="text-[10px] font-black uppercase text-white/20 tracking-widest mb-1 block">Catégorie</label>
                <select 
                  value={profitFilterCategory} 
                  onChange={e => setProfitFilterCategory(e.target.value)}
                  className="w-full text-sm font-black border-white/10 rounded-xl p-2 bg-[#0a0a0f] text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Toutes</option>
                  {getHierarchicalCategories(categories).map(c => (
                    <option key={c.id} value={c.id}>
                      {'—'.repeat(c.level)} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[150px] max-w-[200px]">
                <label className="text-[10px] font-black uppercase text-white/20 tracking-widest mb-1 block">Client</label>
                <select 
                  value={profitFilterCustomer} 
                  onChange={e => setProfitFilterCustomer(e.target.value)}
                  className="w-full text-sm font-black border-white/10 rounded-xl p-2 bg-[#0a0a0f] text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Tous les clients</option>
                  {customers?.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[150px] md:max-w-xs relative">
                <label className="text-[10px] font-black uppercase text-white/20 tracking-widest mb-1 block">Rechercher</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                  <input
                    type="text"
                    placeholder="Nom, SKU..."
                    className="w-full pl-9 pr-4 py-2 text-sm font-bold border border-white/10 rounded-xl bg-[#0a0a0f] text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    value={profitSearchProduct}
                    onChange={(e) => setProfitSearchProduct(e.target.value)}
                  />
                  {profitSearchProduct && (
                    <button 
                      onClick={() => setProfitSearchProduct('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="p-4 font-black uppercase text-[10px] text-white/20 tracking-widest">Produit</th>
                  <th className="p-4 font-black uppercase text-[10px] text-white/20 tracking-widest">Catégorie</th>
                  <th 
                    className="p-4 font-black uppercase text-[10px] text-white/20 tracking-widest text-right cursor-pointer hover:bg-white/5 group transition-colors"
                    onClick={() => handleProfitSort('qty')}
                  >
                    <div className="flex items-center justify-end gap-1">Qté <SortIcon column="qty" /></div>
                  </th>
                  <th 
                    className="p-4 font-black uppercase text-[10px] text-white/20 tracking-widest text-right cursor-pointer hover:bg-white/5 group transition-colors"
                    onClick={() => handleProfitSort('revenue')}
                  >
                    <div className="flex items-center justify-end gap-1">Chiffre Aff. <SortIcon column="revenue" /></div>
                  </th>
                  <th 
                    className="p-4 font-black uppercase text-[10px] text-white/20 tracking-widest text-right cursor-pointer hover:bg-white/5 group transition-colors"
                    onClick={() => handleProfitSort('profit')}
                  >
                    <div className="flex items-center justify-end gap-1">Bénéfice <SortIcon column="profit" /></div>
                  </th>
                  <th 
                    className="p-4 font-black uppercase text-[10px] text-white/20 tracking-widest text-right cursor-pointer hover:bg-white/5 group transition-colors"
                    onClick={() => handleProfitSort('margin')}
                  >
                    <div className="flex items-center justify-end gap-1">Marge % <SortIcon column="margin" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {productProfitData.map(p => {
                  return (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                            {p.imageUrl ? (
                              <SafeImage 
                                src={p.imageUrl} 
                                alt={p.name} 
                                className="w-full h-full object-cover" 
                                fallback={<Package size={18} className="text-slate-500/20" />}
                              />
                            ) : (
                              <ShoppingBag className="w-4 h-4 text-white/20" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-white text-sm max-w-[200px] truncate uppercase tracking-tight">{p.name}</span>
                            <span className="text-[10px] text-white/40 font-black font-mono tracking-widest">#{p.sku || p.id.slice(0,6)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-white/5 text-white/60 rounded-md text-[10px] font-black uppercase tracking-widest border border-white/5">
                          {categories?.find(c => c.id === p.categoryId)?.name || 'N/A'}
                        </span>
                      </td>
                      <td className="p-4 text-right font-black text-white/80 bg-white/5 text-xs font-mono">
                        {p.stats.qty}
                      </td>
                      <td className="p-4 text-right font-black text-white text-xs font-mono">
                        {p.stats.revenue.toFixed(2)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className={cn("font-black text-xs font-mono", p.profit > 0 ? "text-emerald-400" : p.profit < 0 ? "text-rose-400" : "text-white/40")}>
                            {p.profit > 0 ? '+' : ''}{p.profit.toFixed(2)}
                          </span>
                          <span className="text-[8px] font-black text-white/20 uppercase tracking-tighter mt-0.5">
                            (Achat: {(p.costPrice ?? 0).toFixed(2)})
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className={cn("inline-flex items-center justify-center px-2 py-1 rounded-md text-[10px] font-black w-14 font-mono", 
                          p.margin > 30 ? "text-emerald-400 bg-emerald-400/10" : p.margin > 15 ? "text-amber-400 bg-amber-400/10" : p.margin > 0 ? "text-rose-400 bg-rose-400/10" : "text-white/20 bg-white/5")}>
                          {p.margin.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {productProfitData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-white/20">
                      <ShoppingBag className="w-12 h-12 text-white/5 mx-auto mb-4" />
                      <p className="font-black uppercase tracking-widest text-xs">Aucun résultat</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : reportsTab === 'stock_value' ? (
        <div className="space-y-6">
          {/* Stock Valuation Filters */}
          <Card className="p-4 border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                <input 
                  type="text" 
                  placeholder="Rechercher un produit..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={stockFilterSearch}
                  onChange={(e) => setStockFilterSearch(e.target.value)}
                />
              </div>

              <select 
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={stockFilterCategory}
                onChange={(e) => setStockFilterCategory(e.target.value)}
              >
                <option value="all">Toutes les catégories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              <select 
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={stockFilterStatus}
                onChange={(e) => setStockFilterStatus(e.target.value as any)}
              >
                <option value="all">Tous les statuts de stock</option>
                <option value="in_stock">En stock</option>
                <option value="low_stock">Stock faible</option>
                <option value="out_of_stock">Rupture de stock</option>
              </select>

              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
                <Tag size={16} />
                <span className="text-xs font-black uppercase tracking-widest">{filteredStockProducts.length} Produits</span>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Valeur de Vente Totale (Public)</p>
              <h4 className="text-3xl font-black text-indigo-600">
                {filteredStockProducts.reduce((sum, p) => sum + (Math.max(0, p.stock || 0) * (p.price || 0)), 0).toLocaleString()} {settings.currency}
              </h4>
              <p className="text-xs text-indigo-400 mt-2 font-medium">Potentiel de chiffre d\'affaires en stock</p>
            </Card>
            <Card className="p-6 bg-gradient-to-br from-slate-50 to-white border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valeur d\'Achat Totale (Gros/Coût)</p>
              <h4 className="text-3xl font-black text-slate-800">
                {filteredStockProducts.reduce((sum, p) => sum + (Math.max(0, p.stock || 0) * (p.costPrice || 0)), 0).toLocaleString()} {settings.currency}
              </h4>
              <p className="text-xs text-slate-400 mt-2 font-medium">Capital immobilisé dans le stock</p>
            </Card>
            <Card className="p-6 bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Marge Brute Potentielle</p>
              <h4 className="text-3xl font-black text-emerald-600">
                {filteredStockProducts.reduce((sum, p) => sum + (Math.max(0, p.stock || 0) * ((p.price || 0) - (p.costPrice || 0))), 0).toLocaleString()} {settings.currency}
              </h4>
              <p className="text-xs text-emerald-400 mt-2 font-medium">Bénéfice estimé après vente totale</p>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Valorisation par Catégorie</h4>
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Note: Les stocks négatifs sont traités à 0€</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-slate-200">
                  {filteredStockProducts.length} Articles Filtrés
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Catégorie</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Quantité Totale</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valeur Achat</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valeur Gros</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valeur Détail</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Bénéfice Potentiel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map(cat => {
                    const catProducts = filteredStockProducts.filter(p => p.categoryId === cat.id);
                    if (catProducts.length === 0) return null;
                    
                    const totalQty = catProducts.reduce((sum, p) => sum + Math.max(0, p.stock || 0), 0);
                    const totalCost = catProducts.reduce((sum, p) => sum + (Math.max(0, p.stock || 0) * (p.costPrice || 0)), 0);
                    const totalWholesale = catProducts.reduce((sum, p) => sum + (Math.max(0, p.stock || 0) * (p.wholesalePrice || p.price)), 0);
                    const totalRetail = catProducts.reduce((sum, p) => sum + (Math.max(0, p.stock || 0) * (p.price || 0)), 0);
                    const potentialProfit = totalRetail - totalCost;

                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-bold text-slate-700 text-sm">{cat.name}</td>
                        <td className="p-4 text-center text-sm font-medium text-slate-600">{totalQty}</td>
                        <td className="p-4 text-right text-sm font-mono text-slate-500">{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })} {settings.currency}</td>
                        <td className="p-4 text-right text-sm font-bold text-indigo-400">{totalWholesale.toLocaleString(undefined, { minimumFractionDigits: 2 })} {settings.currency}</td>
                        <td className="p-4 text-right text-sm font-black text-indigo-600">{totalRetail.toLocaleString(undefined, { minimumFractionDigits: 2 })} {settings.currency}</td>
                        <td className="p-4 text-right text-sm font-bold text-emerald-600">+{potentialProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {settings.currency}</td>
                      </tr>
                    );
                  })}
                  {/* Uncategorized */}
                  {(() => {
                    const catProducts = filteredStockProducts.filter(p => !p.categoryId || p.categoryId === 'none');
                    if (catProducts.length === 0) return null;
                    const totalQty = catProducts.reduce((sum, p) => sum + Math.max(0, p.stock || 0), 0);
                    const totalCost = catProducts.reduce((sum, p) => sum + (Math.max(0, p.stock || 0) * (p.costPrice || 0)), 0);
                    const totalWholesale = catProducts.reduce((sum, p) => sum + (Math.max(0, p.stock || 0) * (p.wholesalePrice || p.price)), 0);
                    const totalRetail = catProducts.reduce((sum, p) => sum + (Math.max(0, p.stock || 0) * (p.price || 0)), 0);
                    const potentialProfit = totalRetail - totalCost;
                    return (
                      <tr className="hover:bg-slate-50/50 transition-colors bg-slate-50/30">
                        <td className="p-4 font-bold text-slate-400 text-sm italic">Sans Catégorie</td>
                        <td className="p-4 text-center text-sm font-medium text-slate-600">{totalQty}</td>
                        <td className="p-4 text-right text-sm font-mono text-slate-500">{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })} {settings.currency}</td>
                        <td className="p-4 text-right text-sm font-bold text-indigo-400">{totalWholesale.toLocaleString(undefined, { minimumFractionDigits: 2 })} {settings.currency}</td>
                        <td className="p-4 text-right text-sm font-black text-indigo-600">{totalRetail.toLocaleString(undefined, { minimumFractionDigits: 2 })} {settings.currency}</td>
                        <td className="p-4 text-right text-sm font-bold text-emerald-600">+{potentialProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {settings.currency}</td>
                      </tr>
                    );
                  })()}
                  {filteredStockProducts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-500">
                        <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                        <p className="font-medium">Aucun produit ne correspond à vos filtres.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-900 text-white">
                  <tr>
                    <td className="p-4 font-black uppercase tracking-widest text-xs">Total Général</td>
                    <td className="p-4 text-center font-black text-sm">{filteredStockProducts.reduce((sum, p) => sum + Math.max(0, p.stock || 0), 0)}</td>
                    <td className="p-4 text-right font-black text-sm">{filteredStockProducts.reduce((sum, p) => sum + (Math.max(0, p.stock || 0) * (p.costPrice || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {settings.currency}</td>
                    <td className="p-4 text-right font-black text-sm text-indigo-300">{filteredStockProducts.reduce((sum, p) => sum + (Math.max(0, p.stock || 0) * (p.wholesalePrice || p.price)), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {settings.currency}</td>
                    <td className="p-4 text-right font-black text-sm text-indigo-400">{filteredStockProducts.reduce((sum, p) => sum + (Math.max(0, p.stock || 0) * (p.price || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {settings.currency}</td>
                    <td className="p-4 text-right font-black text-sm text-emerald-400">+{filteredStockProducts.reduce((sum, p) => sum + (Math.max(0, p.stock || 0) * ((p.price || 0) - (p.costPrice || 0))), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {settings.currency}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
      ) : reportsTab === 'losses' ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-8 border-l-4 border-rose-500 bg-rose-500/5 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Trash2 size={120} />
              </div>
              <p className="text-[10px] font-black text-rose-500/60 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                <AlertTriangle size={14} /> Valeur Totale des Pertes
              </p>
              <h4 className="text-4xl font-black text-rose-500 tracking-tighter">
                {lossData.totalLossValue.toLocaleString()} <span className="text-lg opacity-40">{settings.currency}</span>
              </h4>
              <p className="text-[10px] text-white/30 mt-4 uppercase font-black tracking-widest">Basé sur le prix d'achat initial</p>
            </Card>

            <Card className="p-8 border-l-4 border-amber-500 bg-white/5 relative overflow-hidden">
               <p className="text-[10px] font-black text-amber-500/60 uppercase tracking-[0.2em] mb-2">Impact sur la marge</p>
               <h4 className="text-3xl font-black text-white">-{((lossData.totalLossValue / (data.totalRevenue || 1)) * 100).toFixed(2)}%</h4>
               <p className="text-[10px] text-white/30 mt-4 uppercase font-black tracking-widest">du chiffre d'affaires total</p>
            </Card>

            <Card className="p-8 border-l-4 border-indigo-500 bg-white/5 relative overflow-hidden">
               <p className="text-[10px] font-black text-indigo-500/60 uppercase tracking-[0.2em] mb-2">Nombre d'ajustements</p>
               <h4 className="text-3xl font-black text-white">{lossData.formattedLosses.length}</h4>
               <p className="text-[10px] text-white/30 mt-4 uppercase font-black tracking-widest">Opérations de retrait de stock</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="p-8 bg-white/5 border-white/10">
              <h4 className="text-sm font-black text-white/60 mb-8 uppercase tracking-widest flex items-center gap-3">
                <LayoutGrid size={18} className="text-rose-500" /> Répartition par Raison
              </h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={lossData.lossByReason}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {lossData.lossByReason.map((entry, index) => (
                        <Cell key={`cell-loss-reason-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0a0a0f', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: number) => [`${value.toLocaleString()} ${settings.currency}`, 'Valeur']}
                    />
                    <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">{value}</span>}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-8 bg-white/5 border-white/10">
              <h4 className="text-sm font-black text-white/60 mb-8 uppercase tracking-widest flex items-center gap-3">
                <RotateCcw size={18} className="text-indigo-500" /> Répartition par Catégorie
              </h4>
              <div className="space-y-6 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                {lossData.lossByCategory.sort((a,b) => b.value - a.value).map((cat, idx) => {
                  const percent = (cat.value / lossData.totalLossValue) * 100;
                  return (
                    <div key={`cat-loss-rep-${idx}`}>
                      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest mb-2">
                        <span className="text-white/40">{cat.name}</span>
                        <span className="text-white">{cat.value.toLocaleString()} {settings.currency} ({percent.toFixed(1)}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          className="h-full bg-rose-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden border-white/10 bg-white/5">
            <div className="p-6 bg-white/5 border-b border-white/10 flex items-center justify-between">
              <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                <History size={16} className="text-rose-500" /> Historique des Pertes
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                    <th className="p-4">Date</th>
                    <th className="p-4">Produit</th>
                    <th className="p-4 text-center">Quantité</th>
                    <th className="p-4 text-right">Valeur Perte</th>
                    <th className="p-4">Raison</th>
                    <th className="p-4">Par</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {lossData.formattedLosses.map((adj, idx) => (
                    <tr key={`loss-item-${idx}`} className="hover:bg-white/5 transition-colors group">
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-white/60 text-xs">
                          <Clock size={12} />
                          {formatSafe(adj.timestamp, 'dd/MM/yyyy HH:mm')}
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-black text-white uppercase text-xs tracking-tight">{adj.productName}</p>
                        <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">#{adj.productId.slice(0,8)}</p>
                      </td>
                      <td className="p-4 text-center font-black text-rose-400">
                        {adj.adjustment} {adj.product?.unit}
                      </td>
                      <td className="p-4 text-right font-black text-white font-mono">
                        {adj.lossValue.toLocaleString()} {settings.currency}
                      </td>
                      <td className="p-4">
                        <span className="px-3 py-1 bg-rose-500/10 text-rose-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-500/20">
                          {adj.reason}
                        </span>
                      </td>
                      <td className="p-4 text-white/40 text-[10px] font-black uppercase tracking-widest italic text-right">
                        {adj.userName || 'Inconnu'}
                      </td>
                    </tr>
                  ))}
                  {lossData.formattedLosses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-20 text-center text-white/20">
                        <Trash2 size={48} className="mx-auto mb-4 opacity-10" />
                        <p className="font-black uppercase tracking-widest">Aucune perte enregistrée</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : reportsTab === 'ai_assistant' ? (
        <AIAssistant 
          products={products}
          transactions={transactions}
          expenses={expenses}
          settings={settings}
          stockAdjustments={stockAdjustments}
        />
      ) : reportsTab === 'marketing' ? (
        <MarketingPosters products={products} settings={settings} />
      ) : reportsTab === 'fidelity_stats' ? (
        <div className="space-y-6">
          <div className="flex justify-start">
             <div className="bg-workspace px-4 py-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
               <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Période:</label>
               <select 
                 value={marketingFilterDate} 
                 onChange={e => setMarketingFilterDate(e.target.value as any)}
                 className="text-sm font-bold border-none bg-transparent outline-none cursor-pointer"
               >
                 <option value="all">Toutes périodes</option>
                 <option value="today">Aujourd'hui</option>
                 <option value="week">Cette semaine</option>
                 <option value="month">Ce mois-ci</option>
                 <option value="year">Cette année</option>
               </select>
             </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="p-6 border-l-4 border-l-amber-500 bg-amber-50/30">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Gift size={14} /> Total Économisé
              </p>
              <h4 className="text-2xl font-black text-slate-800">{marketingData.totalSavings.toFixed(2)} {settings.currency}</h4>
            </Card>
            <Card className="p-6 border-l-4 border-l-rose-500">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Remises Directes</p>
              <h4 className="text-xl font-bold text-slate-800">{marketingData.totalDiscounts.toFixed(2)} {settings.currency}</h4>
            </Card>
            <Card className="p-6 border-l-4 border-l-emerald-500">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Bons d'Achat Utilisés</p>
              <h4 className="text-xl font-bold text-slate-800">{marketingData.totalVouchers.toFixed(2)} {settings.currency}</h4>
            </Card>
            <Card className="p-6 border-l-4 border-l-blue-500">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Points Fidélité Dépensés</p>
              <h4 className="text-xl font-bold text-slate-800">{marketingData.totalPointsDiscount.toFixed(2)} {settings.currency}</h4>
            </Card>
          </div>
          
          <Card className="overflow-hidden border-slate-200">
             <div className="bg-workspace p-4 border-b border-slate-200 flex items-center gap-3">
                <Tag size={18} className="text-indigo-500" />
                <h4 className="font-black text-slate-800 uppercase tracking-tighter text-sm">
                  Historique des Ventes avec avantages
                </h4>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm border-collapse">
                 <thead>
                   <tr className="bg-slate-50 border-b border-slate-100">
                     <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest">Date / ID</th>
                     <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest">Client</th>
                     <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest text-right">Remise</th>
                     <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest text-right">Bon d'Achat</th>
                     <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest text-right">Fidélité</th>
                     <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest text-right">Montant Final Payé</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {marketingData.transactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-slate-800">{formatSafe(t.timestamp, 'dd/MM/yyyy HH:mm')}</p>
                          <p className="text-[10px] text-slate-400 font-mono">#{t.id.slice(-8)}</p>
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-slate-700">{t.customerName || 'Client de passage'}</span>
                        </td>
                        <td className="p-4 text-right">
                          <span className={cn("font-bold text-sm", (t.discountAmount || 0) > 0 ? "text-rose-600" : "text-slate-300")}>
                            -{(t.discountAmount || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className={cn("font-bold text-sm", (t.voucherDiscount || 0) > 0 ? "text-emerald-600" : "text-slate-300")}>
                            -{(t.voucherDiscount || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className={cn("font-bold text-sm", (t.pointsDiscount || 0) > 0 ? "text-blue-600" : "text-slate-300")}>
                            -{(t.pointsDiscount || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className="font-black text-slate-800 text-lg">
                            {t.total.toFixed(2)} {settings.currency}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {marketingData.transactions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-10 text-center text-slate-500">
                          <Gift className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                          <p className="font-medium">Aucun avantage client utilisé sur cette période.</p>
                        </td>
                      </tr>
                    )}
                 </tbody>
               </table>
             </div>
          </Card>
        </div>
      ) : (
        <div className="flex items-center justify-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <div className="text-center">
            <Banknote className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h4 className="font-bold text-slate-800">Module de Trésorerie</h4>
            <p className="text-sm text-slate-500">Flux de trésorerie entrants et sortants détaillés.</p>
          </div>
        </div>
      )}

      {selectedTransactionForProfit && (
        <Modal 
          isOpen={true} 
          onClose={() => setSelectedTransactionForProfit(null)} 
          title={`Détails Profit - Vente #${selectedTransactionForProfit.id?.slice(-8)}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Client</span>
                <span className="font-bold text-slate-800">{selectedTransactionForProfit.customerName || 'Client de passage'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Caissier</span>
                <span className="font-bold text-slate-800">{selectedTransactionForProfit.employeeName || 'Système'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-[10px] uppercase font-black text-slate-400 tracking-widest px-1">Répartition des Marges par article</h5>
              <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs bg-white">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-3 font-bold text-slate-500">Article</th>
                      <th className="p-3 font-bold text-slate-500 text-right">Achat</th>
                      <th className="p-3 font-bold text-slate-500 text-right">Vente</th>
                      <th className="p-3 font-bold text-slate-500 text-right">Marge Uni.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(selectedTransactionForProfit.items || []).map((item, idx) => {
                      const p = products.find(prod => prod.id === item.id);
                      const cost = p?.costPrice || 0;
                      const margin = item.price - cost;
                      return (
                        <tr key={`profit-item-${idx}`}>
                          <td className="p-3 font-medium text-slate-800">{item.name} <span className="text-[10px] text-slate-400">×{item.quantity}</span></td>
                          <td className="p-3 text-right text-slate-500">{cost.toFixed(2)}</td>
                          <td className="p-3 text-right font-bold text-slate-800">{item.price.toFixed(2)}</td>
                          <td className="p-3 text-right font-black text-emerald-600">+{margin.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-100">
               <div className="flex justify-between items-end">
                 <div>
                   <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Total Profit Transaction</p>
                   <h4 className="text-4xl font-black mt-1">
                     {selectedTransactionForProfit.total.toFixed(2)} <span className="text-xl opacity-60">{settings.currency}</span>
                   </h4>
                 </div>
                 <div className="text-right">
                   <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Marge Cumulée</p>
                   <p className="text-2xl font-black">
                     +{(selectedTransactionForProfit.total - selectedTransactionForProfit.items.reduce((s, i) => s + ((products.find(p => p.id === i.id)?.costPrice || 0) * i.quantity), 0)).toFixed(2)}
                   </p>
                 </div>
               </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
});
