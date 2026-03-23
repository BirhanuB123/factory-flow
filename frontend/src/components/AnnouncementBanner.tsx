import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, Wrench, X } from "lucide-react";
import { announcementApi } from "@/lib/api";
import { Button } from "@/components/ui/button";

function levelStyles(level: "info" | "warning" | "maintenance") {
  if (level === "warning") {
    return {
      wrap: "border-amber-300 bg-amber-50 text-amber-900",
      icon: <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />,
      label: "Warning",
    };
  }
  if (level === "maintenance") {
    return {
      wrap: "border-blue-300 bg-blue-50 text-blue-900",
      icon: <Wrench className="h-4 w-4 mt-0.5 shrink-0" />,
      label: "Maintenance",
    };
  }
  return {
    wrap: "border-primary/30 bg-primary/5 text-foreground",
    icon: <Info className="h-4 w-4 mt-0.5 shrink-0" />,
    label: "Info",
  };
}

export function AnnouncementBanner() {
  const q = useQuery({
    queryKey: ["announcement-current"],
    queryFn: () => announcementApi.getCurrent(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const row = q.data?.data;
  const dismissKey = useMemo(() => {
    if (!row) return "";
    return `ff:announcement:dismissed:${row.source}:${row.updatedAt || ""}:${row.message}`;
  }, [row]);

  if (!row?.enabled || !row.message) return null;
  if (dismissKey && sessionStorage.getItem(dismissKey) === "1") return null;

  const style = levelStyles(row.level);
  return (
    <div className={`mx-4 lg:mx-6 mt-3 rounded-md border px-3 py-2 ${style.wrap}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {style.icon}
          <div className="text-sm">
            <p className="font-semibold">
              {style.label} {row.source === "tenant" ? "for your company" : "for all companies"}
            </p>
            <p className="whitespace-pre-wrap break-words">{row.message}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            if (dismissKey) sessionStorage.setItem(dismissKey, "1");
            q.refetch();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
