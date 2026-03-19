import { purchaseOrdersApi, inventoryMovementsApi } from "@/lib/api";
import {
  enqueuePoReceive,
  enqueueInventoryMovement,
  isLikelyOfflineError,
  type PoReceiptLine,
} from "@/lib/offlineQueue";

export type ReceiveResult =
  | { queued: true }
  | { queued: false; data: unknown };

export async function submitPoReceiveWhenOnline(
  poId: string,
  receipts: PoReceiptLine[]
): Promise<ReceiveResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueuePoReceive(poId, receipts);
    return { queued: true };
  }
  try {
    const data = await purchaseOrdersApi.receive(poId, receipts);
    return { queued: false, data };
  } catch (e) {
    if (isLikelyOfflineError(e)) {
      enqueuePoReceive(poId, receipts);
      return { queued: true };
    }
    throw e;
  }
}

export type MovementBody = {
  productId: string;
  kind: "receipt" | "issue" | "adjustment";
  quantity: number;
  note?: string;
};

export type MovementResult = ReceiveResult;

export async function submitInventoryMovementWhenOnline(
  body: MovementBody
): Promise<MovementResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueueInventoryMovement(body);
    return { queued: true };
  }
  try {
    const data = await inventoryMovementsApi.create(body);
    return { queued: false, data };
  } catch (e) {
    if (isLikelyOfflineError(e)) {
      enqueueInventoryMovement(body);
      return { queued: true };
    }
    throw e;
  }
}
