import React from "react";
import { format } from "date-fns";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";

interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

interface PosReceiptProps {
  order: {
    _id: string;
    items: any[];
    totalAmount: number;
    discountPercent?: number;
    paymentDetails?: {
      method: string;
      amountTendered: number;
      change: number;
    };
    createdAt?: string;
  };
  products: any[]; // To get names if order only has IDs
}

export const PosReceipt = React.forwardRef<HTMLDivElement, PosReceiptProps>(
  ({ order, products }, ref) => {
    const { t } = useLocale();
    const { user } = useAuth();
    const companyName = user?.tenantSubscription?.displayName || "Factory Flow ERP";

    const getItemName = (id: string) => {
      return products.find((p) => p._id === id)?.name || "Product";
    };

    const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = (subtotal * (order.discountPercent || 0)) / 100;

    return (
      <div ref={ref} className="p-4 bg-white text-black font-mono text-sm w-[80mm] mx-auto print:m-0 print:w-full">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            /* Hide EVERYTHING directly under body */
            body > *:not(.print-container) {
              display: none !important;
            }
            
            /* Show ONLY the receipt container */
            .receipt-container, .receipt-container * {
              display: block !important;
              visibility: visible !important;
            }

            .receipt-container {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 80mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              z-index: 99999 !important;
            }

            @page {
              margin: 0;
              size: 80mm auto;
            }
          }
        `}} />
        
        <div className="receipt-container space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-bold uppercase">{companyName}</h1>
            <p className="text-[10px]">POS Terminal: {user?.name}</p>
            <p className="text-[10px]">Receipt: #{order._id.slice(-8).toUpperCase()}</p>
            <p className="text-[10px]">{format(new Date(order.createdAt || Date.now()), "yyyy-MM-dd HH:mm:ss")}</p>
          </div>

          <div className="border-t border-b border-dashed py-2 space-y-1">
            <div className="flex justify-between font-bold text-[10px] pb-1">
              <span className="w-1/2">ITEM</span>
              <span className="w-1/4 text-right">QTY</span>
              <span className="w-1/4 text-right">TOTAL</span>
            </div>
            {order.items.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-[10px] leading-tight">
                <span className="w-1/2">{item.name || getItemName(item.product)}</span>
                <span className="w-1/4 text-right">x{item.quantity}</span>
                <span className="w-1/4 text-right">{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-right text-[10px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>ETB {subtotal.toLocaleString()}</span>
            </div>
            {(order.discountPercent || 0) > 0 && (
              <div className="flex justify-between">
                <span>Discount ({order.discountPercent}%):</span>
                <span>-ETB {discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm border-t border-double pt-1 mt-1">
              <span>TOTAL:</span>
              <span>ETB {order.totalAmount.toLocaleString()}</span>
            </div>
          </div>

          {order.paymentDetails && (
            <div className="pt-2 text-[10px] space-y-1 border-t border-dashed mt-2">
              <div className="flex justify-between">
                <span className="capitalize">Method: {order.paymentDetails.method}</span>
              </div>
              <div className="flex justify-between">
                <span>Tendered:</span>
                <span>ETB {order.paymentDetails.amountTendered?.toLocaleString() || order.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Change:</span>
                <span>ETB {order.paymentDetails.change?.toLocaleString() || "0"}</span>
              </div>
            </div>
          )}

          <div className="text-center pt-6 space-y-2 border-t border-dashed mt-4">
            <p className="text-[10px]">Thank you for your business!</p>
            <div className="text-[8px] opacity-50">
              Powered by Factory Flow ERP
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PosReceipt.displayName = "PosReceipt";
