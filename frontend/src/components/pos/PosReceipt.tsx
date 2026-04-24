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
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { position: absolute; left: 0; top: 0; width: 100%; }
            @page { margin: 0; size: 80mm auto; }
          }
        `}} />
        
        <div className="print-area space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-bold uppercase">{companyName}</h1>
            <p className="text-xs">Receipt: #{order._id.slice(-8).toUpperCase()}</p>
            <p className="text-xs">{format(new Date(order.createdAt || Date.now()), "yyyy-MM-dd HH:mm:ss")}</p>
          </div>

          <div className="border-t border-b border-dashed py-2 space-y-1">
            <div className="flex justify-between font-bold text-[10px]">
              <span className="w-1/2">ITEM</span>
              <span className="w-1/4 text-right">QTY</span>
              <span className="w-1/4 text-right">TOTAL</span>
            </div>
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span className="w-1/2 truncate">{item.name || getItemName(item.product)}</span>
                <span className="w-1/4 text-right">x{item.quantity}</span>
                <span className="w-1/4 text-right">{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-right">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>ETB {subtotal.toLocaleString()}</span>
            </div>
            {order.discountPercent > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Discount ({order.discountPercent}%):</span>
                <span>-ETB {discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-1">
              <span>TOTAL:</span>
              <span>ETB {order.totalAmount.toLocaleString()}</span>
            </div>
          </div>

          {order.paymentDetails && (
            <div className="pt-2 text-xs space-y-1 border-t border-dashed">
              <div className="flex justify-between">
                <span className="capitalize">Method: {order.paymentDetails.method}</span>
              </div>
              <div className="flex justify-between">
                <span>Tendered:</span>
                <span>ETB {order.paymentDetails.amountTendered.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Change:</span>
                <span>ETB {order.paymentDetails.change.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="text-center pt-4 space-y-2">
            <p className="text-[10px]">Thank you for your business!</p>
            <div className="text-[8px] text-muted-foreground">
              Powered by Factory Flow ERP
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PosReceipt.displayName = "PosReceipt";
