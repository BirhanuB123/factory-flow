/**
 * Queue critical warehouse actions when the browser is offline or the request fails with a network error.
 * Stored in localStorage (MVP). Replay FIFO when back online via processOfflineQueue().
 */

import { purchaseOrdersApi, inventoryMovementsApi } from "@/lib/api";

const STORAGE_KEY = "factory_flow_offline_queue_v1";

export type PoReceiptLine = {
  lineIndex: number;
  quantity: number;
  lotNumber?: string;
  batchNumber?: string;
};

export type QueuedAction =
  | {
      id: string;
      type: "po_receive";
      payload: { poId: string; receipts: PoReceiptLine[] };
      createdAt: string;
    }
  | {
      id: string;
      type: "inventory_movement";
      payload: {
        productId: string;
        kind: "receipt" | "issue" | "adjustment";
        quantity: number;
        note?: string;
      };
      createdAt: string;
    };

function loadQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(q: QueuedAction[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
}

export function getPendingCount(): number {
  return loadQueue().length;
}

export function notifyQueueChanged() {
  window.dispatchEvent(new CustomEvent("factory-flow-offline-queue"));
}

export function isLikelyOfflineError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const err = e as { code?: string; message?: string };
  if (err?.code === "ERR_NETWORK") return true;
  if (typeof err?.message === "string" && /network|failed to fetch|load failed/i.test(err.message))
    return true;
  return false;
}

export function enqueuePoReceive(poId: string, receipts: PoReceiptLine[]) {
  const q = loadQueue();
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  q.push({
    id,
    type: "po_receive",
    payload: { poId, receipts },
    createdAt: new Date().toISOString(),
  });
  saveQueue(q);
  notifyQueueChanged();
}

export function enqueueInventoryMovement(payload: {
  productId: string;
  kind: "receipt" | "issue" | "adjustment";
  quantity: number;
  note?: string;
}) {
  const q = loadQueue();
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  q.push({
    id,
    type: "inventory_movement",
    payload,
    createdAt: new Date().toISOString(),
  });
  saveQueue(q);
  notifyQueueChanged();
}

/**
 * Process queued actions in order. Stops on first failure (item stays at head).
 */
export async function processOfflineQueue(): Promise<{
  processed: number;
  remaining: number;
  lastError?: string;
}> {
  let processed = 0;
  let lastError: string | undefined;

  while (true) {
    const q = loadQueue();
    if (q.length === 0) break;
    const item = q[0];
    try {
      if (item.type === "po_receive") {
        await purchaseOrdersApi.receive(item.payload.poId, item.payload.receipts);
      } else {
        await inventoryMovementsApi.create(item.payload);
      }
      saveQueue(q.slice(1));
      processed += 1;
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        "Sync failed";
      lastError = msg;
      break;
    }
  }

  notifyQueueChanged();
  return { processed, remaining: getPendingCount(), lastError };
}
