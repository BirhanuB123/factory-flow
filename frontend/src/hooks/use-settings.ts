import { useState, useEffect } from "react";

const SETTINGS_KEY = "erp-settings";

const currencySymbols: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  ETB: "Br",
};

export const defaultSettings = {
  shopName: "ShopFloor CNC",
  shopAddress: "1234 Industrial Blvd, Suite 100",
  shopCity: "Detroit, MI 48201",
  shopPhone: "(313) 555-0199",
  shopEmail: "ops@shopfloorcnc.com",
  timezone: "Africa/Addis_Ababa",
  currency: "ETB",
  displayName: "Paul Mitchell",
  role: "Production Mgr",
  emailNotifications: true,
  smsNotifications: false,
  lowStockAlerts: true,
  jobStatusAlerts: true,
  delayAlerts: true,
  autoBackup: true,
  darkMode: false,
  compactView: false,
  dateFormat: "YYYY-MM-DD",
  defaultJobView: "table",
};

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        return { ...defaultSettings, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.error("Failed to parse erp-settings", e);
    }
    return defaultSettings;
  });

  const symbol = currencySymbols[settings.currency] || "$";

  useEffect(() => {
    const handleSettingsUpdate = () => {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
          setSettings({ ...defaultSettings, ...JSON.parse(raw) });
        }
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener("storage", (e) => {
      if (e.key === SETTINGS_KEY) handleSettingsUpdate();
    });
    
    window.addEventListener("erp-settings-updated", handleSettingsUpdate);

    return () => {
      window.removeEventListener("storage", handleSettingsUpdate);
      window.removeEventListener("erp-settings-updated", handleSettingsUpdate);
    };
  }, []);

  // Effect to apply dark mode
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.darkMode]);

  return { settings, symbol };
}
