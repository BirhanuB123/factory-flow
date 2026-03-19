import { useState, useEffect, useCallback } from "react";
import { toEthiopian } from "ethiopian-calendar-new";

const SETTINGS_KEY = "erp-settings";

function readShowEthiopian(): boolean {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const v = JSON.parse(raw).showEthiopianDates;
      if (typeof v === "boolean") return v;
    }
  } catch {
    /* ignore */
  }
  return true;
}

function ethNumeric(d: Date): string {
  const e = toEthiopian(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${String(e.day).padStart(2, "0")}/${String(e.month).padStart(2, "0")}/${e.year}`;
}

/**
 * Formats dates for UI: Gregorian, optionally with Ethiopian (DD/MM/EC year).
 */
export function useEthiopianDateDisplay() {
  const [showEth, setShowEth] = useState(readShowEthiopian);

  useEffect(() => {
    const sync = () => setShowEth(readShowEthiopian());
    window.addEventListener("erp-settings-updated", sync);
    return () => window.removeEventListener("erp-settings-updated", sync);
  }, []);

  const formatDate = useCallback(
    (input: string | Date | undefined | null, opts?: { withTime?: boolean }) => {
      if (input == null) return "—";
      const d = new Date(input);
      if (Number.isNaN(d.getTime())) return "—";
      const g = d.toLocaleDateString("en-GB");
      const time = opts?.withTime ? ` ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "";
      const base = g + time;
      if (!showEth) return base;
      try {
        return `${base} · ${ethNumeric(d)} EC`;
      } catch {
        return base;
      }
    },
    [showEth]
  );

  return { formatDate, showEthiopianDates: showEth };
}
