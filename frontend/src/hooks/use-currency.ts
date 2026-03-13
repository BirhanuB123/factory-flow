import { useState, useEffect } from "react";

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
        return saved.currency || "USD";
      }
    } catch (e) {
      console.error("Failed to parse erp-settings", e);
    }
    return "USD";
  });

  const symbol = currencySymbols[currency] || "$";

  useEffect(() => {
    const handleSettingsUpdate = () => {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setCurrency(saved.currency || "USD");
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

  return { code: currency, symbol };
}
