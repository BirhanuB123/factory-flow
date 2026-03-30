import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPendingCount, processOfflineQueue } from "@/lib/offlineQueue";
import { toast } from "sonner";

export function OfflineQueueBanner() {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pending, setPending] = useState(getPendingCount);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => setPending(getPendingCount()), []);

  useEffect(() => {
    refresh();
    const onQueue = () => refresh();
    window.addEventListener("factory-flow-offline-queue", onQueue);
    const onOnline = () => {
      setOnline(true);
      void (async () => {
        if (getPendingCount() === 0) return;
        setSyncing(true);
        try {
          const r = await processOfflineQueue();
          if (r.processed > 0) {
            queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
            queryClient.invalidateQueries({ queryKey: ["inventory"] });
            queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
            queryClient.invalidateQueries({ queryKey: ["inventory-alerts"] });
            toast.success(`Synced ${r.processed} queued action(s)`);
          }
          if (r.lastError && r.remaining > 0) {
            toast.error(`Sync paused: ${r.lastError}`);
          }
        } finally {
          setSyncing(false);
          refresh();
        }
      })();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("factory-flow-offline-queue", onQueue);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [queryClient, refresh]);

  const manualSync = async () => {
    if (!navigator.onLine) {
      toast.message("You're offline — connect to sync the queue.");
      return;
    }
    setSyncing(true);
    try {
      const r = await processOfflineQueue();
      if (r.processed > 0) {
        queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
        queryClient.invalidateQueries({ queryKey: ["inventory-alerts"] });
        toast.success(`Synced ${r.processed} action(s)`);
      } else if (r.remaining === 0) {
        toast.message("Queue is empty.");
      }
      if (r.lastError && r.remaining > 0) {
        toast.error(r.lastError);
      }
    } finally {
      setSyncing(false);
      refresh();
    }
  };

  if (online && pending === 0) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm"
    >
      <div className="flex items-center gap-2 text-amber-950 dark:text-amber-100">
        {!online ? (
          <>
            <WifiOff className="h-4 w-4 shrink-0" />
            <span className="font-semibold">Offline</span>
            <span className="text-amber-900/80 dark:text-amber-200/90">
              PO receive and stock receipt/issue/adjustment can be queued and will post when you reconnect.
            </span>
          </>
        ) : (
          <>
            <CloudUpload className="h-4 w-4 shrink-0" />
            <span className="font-semibold">{pending} queued</span>
            <span className="text-amber-900/80 dark:text-amber-200/90">
              Warehouse actions waiting to sync to the server.
            </span>
          </>
        )}
      </div>
      {online && pending > 0 && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 gap-1.5 font-bold uppercase text-xs"
          disabled={syncing}
          onClick={() => manualSync()}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          Sync now
        </Button>
      )}
    </div>
  );
}
