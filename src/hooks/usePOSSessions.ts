import { useState, useCallback } from 'react';
import { POSSession, Transaction, Customer } from '../types';
import { generateUniqueId } from '../lib/utils';

export function usePOSSessions(customers: Customer[], setActiveTab: (tab: string) => void, setIsWholesale: (w: boolean) => void, setDeliveryMethod: (m: 'in_store' | 'delivery' | 'pickup') => void) {
  // POS Multi-session State
  const [posSessions, setPosSessions] = useState<POSSession[]>(() => {
    const initialId = generateUniqueId();
    return [{ id: initialId, name: 'Ticket 1', cart: [], selectedCustomer: null }];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(() => posSessions[0].id);

  const activeSession = posSessions.find(s => s.id === activeSessionId) || posSessions[0];
  const cart = activeSession.cart;
  const selectedCustomer = activeSession.selectedCustomer;

  const setCart = useCallback((newCart: any) => {
    setPosSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const updatedCart = typeof newCart === 'function' ? newCart(s.cart) : newCart;
        return { ...s, cart: updatedCart };
      }
      return s;
    }));
  }, [activeSessionId]);

  const setSelectedCustomer = useCallback((newCustomer: any) => {
    setPosSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
         const updatedCust = typeof newCustomer === 'function' ? newCustomer(s.selectedCustomer) : newCustomer;
         return { ...s, selectedCustomer: updatedCust };
      }
      return s;
    }));
  }, [activeSessionId]);

  const loadTransactionToCart = useCallback((t: Transaction) => {
    // 1. Clear current cart
    setCart([]);
    
    // 2. Load items from transaction
    setCart(t.items);
    
    // 3. Restore customer if exists
    if (t.customerId) {
      const customer = customers.find((c: Customer) => c.id === t.customerId);
      if (customer) {
        setSelectedCustomer(customer);
      }
    } else {
      setSelectedCustomer(null);
    }
    
    // 4. Restore wholesale mode
    setIsWholesale(!!t.isWholesale);
    
    // 5. Restore delivery method if exists
    if (t.deliveryMethod) {
      setDeliveryMethod(t.deliveryMethod);
    }

    // 6. Navigate to POS
    setActiveTab('checkout');
    
    // 7. Focus search
    setTimeout(() => {
      const searchInput = document.querySelector('input[placeholder*="Rechercher"]') as HTMLInputElement;
      if (searchInput) searchInput.focus();
    }, 100);
  }, [customers, setActiveTab, setCart, setSelectedCustomer, setIsWholesale, setDeliveryMethod]);

  return {
    posSessions, setPosSessions,
    activeSessionId, setActiveSessionId,
    activeSession,
    cart, setCart,
    selectedCustomer, setSelectedCustomer,
    loadTransactionToCart
  };
}
