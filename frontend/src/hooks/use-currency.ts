import { useState, useEffect, useCallback } from "react";
import { formatMoneyAmount, formatMoneyWithSymbol } from "@/lib/formatMoney";

const SETTINGS_KEY = "erp-settings";

const currencySymbols: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  ETB: "Br",
};

export function useCurrency() {
  const [currency, setCurrency] = useState(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        return saved.currency || "ETB";
      }
    } catch (e) {
      console.error("Failed to parse erp-settings", e);
    }
    return "ETB";
  });

  const symbol = currencySymbols[currency] || (currency === "ETB" ? "Br" : "$");

  useEffect(() => {
    const handleSettingsUpdate = () => {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setCurrency(saved.currency || "ETB");
        }
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener("storage", (e) => {
      if (e.key === SETTINGS_KEY) handleSettingsUpdate();
    });
    
    // Custom event for same-window updates
    window.addEventListener("erp-settings-updated", handleSettingsUpdate);

    return () => {
      window.removeEventListener("storage", handleSettingsUpdate);
      window.removeEventListener("erp-settings-updated", handleSettingsUpdate);
    };
  }, []);

  const format = useCallback(
    (amount: number) => formatMoneyWithSymbol(amount, currency, symbol),
    [currency, symbol]
  );
  const formatAmount = useCallback(
    (amount: number) => formatMoneyAmount(amount, currency),
    [currency]
  );

  return { code: currency, symbol, format, formatAmount };
}
