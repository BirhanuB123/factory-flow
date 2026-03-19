import * as React from "react";
import { tKey, type UiLang } from "@/i18n/translations";

const SETTINGS_KEY = "erp-settings";

function readUiLang(): UiLang {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const v = JSON.parse(raw).uiLanguage;
      if (v === "am" || v === "om" || v === "en") return v;
    }
  } catch {
    /* ignore */
  }
  return "en";
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<UiLang>(readUiLang);

  React.useEffect(() => {
    const sync = () => setLangState(readUiLang());
    window.addEventListener("erp-settings-updated", sync);
    window.addEventListener("storage", (e) => {
      if (e.key === SETTINGS_KEY) sync();
    });
    return () => window.removeEventListener("erp-settings-updated", sync);
  }, []);

  const t = React.useCallback((key: string) => tKey(lang, key), [lang]);

  const value = React.useMemo(() => ({ lang, t }), [lang, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

type LocaleCtx = { lang: UiLang; t: (key: string) => string };

const LocaleContext = React.createContext<LocaleCtx>({
  lang: "en",
  t: (k) => tKey("en", k),
});

export function useLocale() {
  return React.useContext(LocaleContext);
}
