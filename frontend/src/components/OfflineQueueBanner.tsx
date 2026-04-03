import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPendingCount, processOfflineQueue } from "@/lib/offlineQueue";
import { toast } from "sonner";
import { useLocale } from "@/contexts/LocaleContext";

export function OfflineQueueBanner() {
  const { t } = useLocale();
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
            toast.success(t("offline.toastSynced", { n: r.processed }));
          }
          if (r.lastError && r.remaining > 0) {
            toast.error(t("offline.toastPaused", { msg: r.lastError }));
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
  }, [queryClient, refresh, t]);

  const manualSync = async () => {
    if (!navigator.onLine) {
      toast.message(t("offline.offlineMsg"));
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
        toast.success(t("offline.toastSynced", { n: r.processed }));
      } else if (r.remaining === 0) {
        toast.message(t("offline.queueEmpty"));
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
            <span className="font-semibold">{t("offline.title")}</span>
            <span className="text-amber-900/80 dark:text-amber-200/90">{t("offline.detail")}</span>
          </>
        ) : (
          <>
            <CloudUpload className="h-4 w-4 shrink-0" />
            <span className="font-semibold">
              {pending} {t("offline.queued")}
            </span>
            <span className="text-amber-900/80 dark:text-amber-200/90">{t("offline.queuedDetail")}</span>
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
          {t("offline.syncNow")}
        </Button>
      )}
    </div>
  );
}
