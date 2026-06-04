import React from "react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface PosReceiptProps {
  order: {
    _id: string;
    invoiceId?: string;
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
  products: any[];
}

export const PosReceipt = React.forwardRef<HTMLDivElement, PosReceiptProps>(
  ({ order, products }, ref) => {
    const { user } = useAuth();
    const companyName = user?.tenantSubscription?.displayName || "Factory Flow ERP";

    const getItemName = (id: string) =>
      products.find((p) => p._id === id)?.name || "Product";

    const subtotal = order.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const discountAmount = (subtotal * (order.discountPercent || 0)) / 100;

    return (
      /*
       * Off-screen with position:fixed so it is never display:none.
       * That lets the @media print visibility trick work at any DOM depth.
       */
      <div
        ref={ref}
        style={{ position: "fixed", left: "-9999px", top: 0, width: "80mm" }}
      >
        <style>{`
          @media print {
            /* Hide everything */
            body * { visibility: hidden !important; }

            /* Show only the receipt content */
            .pos-receipt-content,
            .pos-receipt-content * { visibility: visible !important; }

            /* Pin the receipt at the top-left corner */
            .pos-receipt-content {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 80mm !important;
              background: white !important;
              color: black !important;
              padding: 10px !important;
              font-family: 'Courier New', monospace !important;
              font-size: 12px !important;
              line-height: 1.4 !important;
              box-sizing: border-box !important;
            }

            .pos-receipt-content * {
              background: white !important;
              color: black !important;
              border-color: black !important;
            }

            @page {
              size: 80mm auto;
              margin: 0;
            }
          }
        `}</style>

        <div className="pos-receipt-content">
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "10px" }}>
            <div style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "4px" }}>
              {companyName}
            </div>
            <div style={{ fontSize: "10px" }}>POS Terminal: {user?.name}</div>
            <div style={{ fontSize: "10px" }}>
              Invoice: {order.invoiceId || `#${order._id.slice(-8).toUpperCase()}`}
            </div>
            <div style={{ fontSize: "10px" }}>
              {format(new Date(order.createdAt || Date.now()), "yyyy-MM-dd HH:mm:ss")}
            </div>
          </div>

          {/* Items */}
          <div
            style={{
              borderTop: "1px dashed black",
              borderBottom: "1px dashed black",
              padding: "8px 0",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
                fontSize: "10px",
                marginBottom: "4px",
              }}
            >
              <span style={{ width: "50%" }}>ITEM</span>
              <span style={{ width: "25%", textAlign: "right" }}>QTY</span>
              <span style={{ width: "25%", textAlign: "right" }}>TOTAL</span>
            </div>
            {order.items.map((item: any, i: number) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "10px",
                  lineHeight: "1.2",
                  marginBottom: "2px",
                }}
              >
                <span style={{ width: "50%", wordBreak: "break-word" }}>
                  {item.name || getItemName(item.product)}
                </span>
                <span style={{ width: "25%", textAlign: "right" }}>x{item.quantity}</span>
                <span style={{ width: "25%", textAlign: "right" }}>
                  {(item.price * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ textAlign: "right", fontSize: "10px", marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>Subtotal:</span>
              <span>ETB {subtotal.toLocaleString()}</span>
            </div>
            {(order.discountPercent || 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span>Discount ({order.discountPercent}%):</span>
                <span>-ETB {discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
                fontSize: "12px",
                borderTop: "2px double black",
                paddingTop: "4px",
                marginTop: "4px",
              }}
            >
              <span>TOTAL:</span>
              <span>ETB {order.totalAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment */}
          {order.paymentDetails && (
            <div
              style={{
                fontSize: "10px",
                borderTop: "1px dashed black",
                paddingTop: "8px",
                marginTop: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span>Method:</span>
                <span style={{ textTransform: "capitalize" }}>{order.paymentDetails.method}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span>Tendered:</span>
                <span>
                  ETB{" "}
                  {(order.paymentDetails.amountTendered || order.totalAmount).toLocaleString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                <span>Change:</span>
                <span>ETB {(order.paymentDetails.change || 0).toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              textAlign: "center",
              borderTop: "1px dashed black",
              marginTop: "10px",
              paddingTop: "10px",
              fontSize: "10px",
            }}
          >
            <div style={{ marginBottom: "4px" }}>Thank you for your business!</div>
            <div style={{ fontSize: "8px", opacity: 0.5 }}>Powered by Integra ERP</div>
          </div>
        </div>
      </div>
    );
  },
);

PosReceipt.displayName = "PosReceipt";
