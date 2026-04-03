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
    const onStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_KEY) sync();
    };
    window.addEventListener("erp-settings-updated", sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("erp-settings-updated", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  React.useEffect(() => {
    const code = lang === "en" ? "en" : lang === "am" ? "am" : "om";
    document.documentElement.lang = code;
    document.documentElement.setAttribute("data-ui-lang", code);
  }, [lang]);

  const t = React.useCallback(
    (key: string, vars?: Record<string, string | number>) => tKey(lang, key, vars),
    [lang]
  );

  const value = React.useMemo(() => ({ lang, t }), [lang, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

type LocaleCtx = {
  lang: UiLang;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = React.createContext<LocaleCtx>({
  lang: "en",
  t: (k, v) => tKey("en", k, v),
});

export function useLocale() {
  return React.useContext(LocaleContext);
}
