import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { toast } from 'sonner';

export const NotificationManager = () => {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('low-stock', (data: { productName: string; quantity: number }) => {
      toast.warning(`Stock faible: ${data.productName}`, {
        description: `Il ne reste que ${data.quantity} en stock.`,
      });
    });

    socket.on('new-order', (data: { orderId: string; customerName: string }) => {
      toast.success(`Nouvelle commande: #${data.orderId}`, {
        description: `Client: ${data.customerName}`,
      });
    });

    return () => {
      socket.off('low-stock');
      socket.off('new-order');
    };
  }, [socket]);

  return null;
};
