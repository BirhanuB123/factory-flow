export type UiLang = "en" | "am" | "om";

const navEn = {
  dashboard: "Dashboard",
  production: "Production",
  jobs: "Jobs",
  boms: "BOMs",
  orders: "Orders",
  clients: "Clients",
  inventory: "Inventory",
  purchasing: "Purchasing",
  shipments: "Shipments",
  hr: "HR",
  finance: "Finance",
  smeBundle: "SME package",
  settings: "Settings",
  platform: "Platform",
  navigation: "Navigation",
  erpSubtitle: "ERP System",
};

const navAm: Record<keyof typeof navEn, string> = {
  dashboard: "ዳሽቦርድ",
  production: "ምርት",
  jobs: "ስራዎች",
  boms: "የክፍሎች ዝርዝር",
  orders: "ትዕዛዞች",
  clients: "ደንበኞች",
  inventory: "መጋዘን",
  purchasing: "ግዢ",
  shipments: "ማስላኪያ",
  hr: "ሰው ሀብት",
  finance: "ፋይናንስ",
  smeBundle: "SME ፓኬጅ",
  settings: "ቅንብሮች",
  platform: "መድረክ",
  navigation: "አሻራ",
  erpSubtitle: "የኢንተግራ ስርዓት",
};

const navOm: Record<keyof typeof navEn, string> = {
  dashboard: "Gabatee",
  production: "Oomisha",
  jobs: "Hojiiwwan",
  boms: "BOMs",
  orders: "Ajajaawwan",
  clients: "Maamiltoota",
  inventory: "Kuusaa warshaa",
  purchasing: "Bitachuu",
  shipments: "Ergamtoota",
  hr: "HR",
  finance: "Maallaqa",
  smeBundle: "Paakeejii SME",
  settings: "Qindaa'ina",
  platform: "Platfoormii",
  navigation: "Daandii",
  erpSubtitle: "Sirna Integra",
};

const byLang = { en: navEn, am: navAm, om: navOm };

function flattenNav(lang: keyof typeof byLang): Record<string, string> {
  const n = byLang[lang];
  const o: Record<string, string> = {};
  for (const k of Object.keys(navEn) as (keyof typeof navEn)[]) {
    o[`nav.${k}`] = n[k];
  }
  return o;
}

const cache: Partial<Record<keyof typeof byLang, Record<string, string>>> = {};

export function tKey(lang: keyof typeof byLang, key: string): string {
  if (!cache.en) cache.en = flattenNav("en");
  if (!cache[lang]) cache[lang] = flattenNav(lang);
  return cache[lang]![key] ?? cache.en![key] ?? key;
}
