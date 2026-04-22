/**
 * All UI strings for English, Amharic (አማርኛ), and Afaan Oromo (Latin).
 * Keys must exist for every language; use useLocale().t("key") in components.
 */
export type UiLang = "en" | "am" | "om";

type Entry = Record<UiLang, string>;

function pack(block: Record<string, Entry>): Record<string, Entry> {
  return block;
}

const STRINGS = pack({
  // —— Navigation (sidebar) ——
  "nav.dashboard": {
    en: "Dashboard",
    am: "ዳሽቦርድ",
    om: "Gabatee",
  },
  "nav.production": {
    en: "Production",
    am: "ምርት",
    om: "Oomisha",
  },
  "nav.jobs": {
    en: "Jobs",
    am: "ስራዎች",
    om: "Hojiiwwan",
  },
  "nav.boms": {
    en: "BOMs",
    am: "የክፍሎች ዝርዝር",
    om: "BOMs",
  },
  "nav.orders": {
    en: "Orders",
    am: "ትዕዛዞች",
    om: "Ajajaawwan",
  },
  "nav.clients": {
    en: "Clients",
    am: "ደንበኞች",
    om: "Maamiltoota",
  },
  "nav.inventory": {
    en: "Inventory",
    am: "መጋዘን",
    om: "Kuusaa warshaa",
  },
  "nav.purchasing": {
    en: "Procurement",
    am: "ግዢ",
    om: "Bitachuu",
  },
  "nav.shipments": {
    en: "Shipments",
    am: "ማስላኪያ",
    om: "Ergamtoota",
  },
  "nav.hr": {
    en: "HR",
    am: "ሰው ሀብት",
    om: "HR",
  },
  "nav.myHr": {
    en: "My HR",
    am: "የኔ ሰው ሀብት",
    om: "HR koo",
  },
  "nav.finance": {
    en: "Finance",
    am: "ፋይናንስ",
    om: "Maallaqa",
  },
  "nav.reports": {
    en: "Reports",
    am: "ሪፖርቶች",
    om: "Gabaasawwan",
  },
  "nav.smeBundle": {
    en: "SME package",
    am: "SME ፓኬጅ",
    om: "Paakeejii SME",
  },
  "nav.settings": {
    en: "Settings",
    am: "ቅንብሮች",
    om: "Qindaa'ina",
  },
  "nav.platform": {
    en: "Platform",
    am: "መድረክ",
    om: "Platfoormii",
  },
  "nav.navigation": {
    en: "Navigation",
    am: "አሻራ",
    om: "Daandii",
  },
  "nav.erpSubtitle": {
    en: "ERP System",
    am: "የኢንተግራ ስርዓት",
    om: "Sirna Integra",
  },

  // —— Common ——
  "common.loading": { en: "Loading…", am: "በመጫን ላይ…", om: "Fe'uuf jira…" },
  "common.close": { en: "Close", am: "ዝጋ", om: "Cufi" },
  "common.search": { en: "Search", am: "ፈልግ", om: "Barbaadi" },
  "common.save": { en: "Save", am: "አስቀምጥ", om: "Olkaa'i" },

  // —— App shell / header ——
  "header.searchPlaceholder": {
    en: "Search jobs, inventory, clients…",
    am: "ስራዎች፣ መጋዘን፣ ደንበኞችን ፈልግ…",
    om: "Hojiiwwan, kuusaa, maamiltoota barbaadi…",
  },
  "header.searchAria": { en: "Search", am: "ፈልግ", om: "Barbaadi" },
  "header.searchResults": { en: "Search results", am: "የፍለጋ ውጤቶች", om: "Bu'aa barbaachisaa" },
  "header.searching": { en: "Searching…", am: "በመፈለግ ላይ…", om: "Barbachuuf jira…" },
  "header.noResults": { en: "No results found", am: "ምንም ውጤት አልተገኘም", om: "Bu'aan hin argamne" },
  "header.listOfAssets": { en: "List of assets", am: "የንብረት ዝርዝር", om: "Tarree qabeenya" },
  "header.addAsset": { en: "Add an asset", am: "ንብረት ጨምር", om: "Qabeenya dabaluu" },
  "header.notifications": { en: "Notifications", am: "ማሳወቂያዎች", om: "Beeksisa" },
  "header.markAllRead": { en: "Mark all read", am: "ሁሉንም እንደተነበበ ምልክት አድርግ", om: "Hunda dubbifameettiin mallaqa'i" },
  "header.noNotifications": { en: "No notifications yet.", am: "እስካሁን ምንም ማሳወቂያ የለም።", om: "Ammaaf beeksisa hin jiru." },
  "header.profile": { en: "Profile", am: "መገለጫ", om: "Ibsa namaa" },
  "header.settings": { en: "Settings", am: "ቅንብሮች", om: "Qindaa'ina" },
  "header.platformAdmin": { en: "Platform admin", am: "የመድረክ አስተዳዳሪ", om: "Bulchiinsa platfoormii" },
  "header.logOut": { en: "Log out", am: "ውጣ", om: "Ba'i" },
  "header.online": { en: "Online", am: "መስመር ላይ", om: "Onlaayinii" },
  "header.companyContextApi": {
    en: "Company context (API)",
    am: "የኩባንያ አውድ (API)",
    om: "Haala daldalaa (API)",
  },
  "header.toastAllRead": {
    en: "All notifications marked as read",
    am: "ሁሉም ማሳወቂያዎች እንደተነበቡ ተመዝግበዋል",
    om: "Beeksisni hunda dubbifameettiin mallaqeffaman",
  },
  "header.toastNotifyFail": {
    en: "Failed to update notifications",
    am: "ማሳወቂያዎችን ማዘመን አልተሳካም",
    om: "Beeksisaa haaromsuu hin milkoofne",
  },
  "header.toastLoggedOut": {
    en: "Logged out successfully",
    am: "በተሳካ ሁኔታ ወጥተዋል",
    om: "Milkaa'inaan ba'e",
  },

  // —— Auth / login ——
  "auth.heroKicker": { en: "Manufacturing ERP", am: "የማኑፋክቸሪንግ ERP", om: "ERP oomishaa" },
  "auth.heroTitle": { en: "Integra - ERP", am: "ኢንተግራ - ERP", om: "Integra - ERP" },
  "auth.heroSubtitle": {
    en: "Streamline manufacturing from the shop floor to the top floor—clearer operations, better productivity, and one place for your team to work.",
    am: "ከመስሪያ ቤት እስከ አመራር ድረስ ማኑፋክቸሪንግን ያመቻቹ—ግልጽ ክንውኖች፣ የተሻለ ምርታማነት፣ እና ቡድንዎ በአንድ ቦታ እንዲሰራ።",
    om: "Oomishaa mana warshaa irraa gola ol'aanaatti fooyyessi—hojii ifa ta'e, oomisha fooyya'a, fi gareen keessan bakka tokko irratti hojjatu.",
  },
  "auth.brandKicker": { en: "Integra", am: "ኢንተግራ", om: "Integra" },
  "auth.signIn": { en: "Sign in", am: "ግባ", om: "Seeni" },
  "auth.signInHint": {
    en: "Use your company email or employee ID and password to continue.",
    am: "ለመቀጠል የኩባንያ ኢሜይል ወይም የሰራተኛ መለያ እና የይለፍ ቃል ይጠቀሙ።",
    om: "Itti fufuuf email daldalaa ykn lakkoofsa hojjettaa fi jecha icciitii fayyadami.",
  },
  "auth.emailOrId": { en: "Email or employee ID", am: "ኢሜይል ወይም የሰራተኛ መለያ", om: "Imeelii ykn lakkoofsa hojjettaa" },
  "auth.password": { en: "Password", am: "የይለፍ ቃል", om: "Jecha icciitii" },
  "auth.signingIn": { en: "Signing in…", am: "በመግባት ላይ…", om: "Seenaa jira…" },
  "auth.sessionNote": {
    en: "Your session is protected with industry-standard security.",
    am: "ክፍለ ጊዜዎ በኢንዱስትሪ ደረጃ ደህንነት የተጠበቀ ነው።",
    om: "Daawwannii keessan nageenya sadarkaa industrii tiin eegama.",
  },
  "auth.errorFillAll": { en: "Please fill in all fields", am: "እባክዎ ሁሉንም መስኮች ይሙሉ", om: "Maaloo bakkeewwan hunda guuti" },
  "auth.successLogin": { en: "Logged in successfully", am: "በተሳካ ሁኔታ ገብተዋል", om: "Milkaa'inaan seenan" },
  "auth.errorInvalid": { en: "Invalid credentials", am: "የማይሰራ የመግቢያ መረጃ", om: "Odeeffannoo dogoggora" },
  "auth.errorNetwork": { en: "Failed to connect to server", am: "ከሰርቨር ጋር መገናኘት አልተሳካም", om: "Sarvaritti walqunnamuun hin milkoofne" },

  // —— Dashboard (home) ——
  "dashboard.title": { en: "Dashboard", am: "ዳሽቦርድ", om: "Gabatee" },
  "dashboard.subtitle": { en: "Dashboard & statistics", am: "ዳሽቦርድ እና ስታትስቲክስ", om: "Gabatee fi lakkoofsa" },
  "dashboard.systemHealth": { en: "System health", am: "የስርዓት ጤና", om: "Fayyina sirnaa" },
  "dashboard.operational": { en: "Operational", am: "በስራ ላይ", om: "Hojii irra jira" },
  "dashboard.checkAssets": { en: "Check assets", am: "ንብረቶችን ይመልከቱ", om: "Qabeenya ilaali" },
  "dashboard.oeeProxy": { en: "OEE proxy (30d)", am: "OEE ፕሮክሲ (30 ቀን)", om: "OEE proksii (30n)" },
  "dashboard.subscriptionStatus": { en: "Subscription status", am: "የደንበኝነት ሁኔታ", om: "Haala subscribe" },
  "dashboard.currentTenant": { en: "Current tenant", am: "ወቅታዊ ኩባንያ", om: "Daldala ammaa" },
  "dashboard.plan": { en: "Plan", am: "እቅድ", om: "Karoora" },
  "dashboard.trialEnds": { en: "Trial ends", am: "ሙከራ ያበቃል", om: "Tryaalli xumurama" },
  "dashboard.trialExpired": { en: "Trial expired", am: "ሙከራ አልቋል", om: "Tryaalli darbee" },
  "dashboard.trialDaysLeft": {
    en: "{n} day(s) left in trial",
    am: "በሙከራ {n} ቀን(ናት) ቀርተዋል",
    om: "Tryaal irratti guyyaa {n} hafe",
  },
  "dashboard.subscriptionGood": {
    en: "Subscription is in good standing",
    am: "ደንበኝነት በጥሩ ሁኔታ ላይ ነው",
    om: "Subscribe gaarii ta'ee jira",
  },
  "dashboard.reviewSettings": {
    en: "Review subscription details in Settings",
    am: "ዝርዝሮችን በቅንብሮች ውስጥ ይመልከቱ",
    om: "Ibsa bal'ina qindaa'ina keessatti ilaali",
  },
  "dashboard.moduleAccess": { en: "Module access", am: "የሞዱል መዳረሻ", om: "Seensa mooduulii" },
  "dashboard.allEnabled": { en: "All enabled", am: "ሁሉም ነቅቷል", om: "Hundi dandeessifame" },
  "dashboard.disabledPolicy": {
    en: "disabled by tenant policy",
    am: "በኩባንያ ፖሊሲ ተሰናክሏል",
    om: "seera daldalaa irratti dhabamsiifame",
  },
  "dashboard.moduleMfg": {
    en: "Manufacturing & production",
    am: "ማኑፋክቸሪንግ እና ምርት",
    om: "Oomisha fi oomishaa",
  },
  "dashboard.moduleInv": { en: "Inventory & stock", am: "መጋዘን እና ክምችት", om: "Kuusaa fi qabeenya" },
  "dashboard.moduleSales": { en: "Sales & orders", am: "ሽያጭ እና ትዕዛዞች", om: "Gurgurtaa fi ajaja" },
  "dashboard.moduleProc": { en: "Procurement & POs", am: "ግዢ እና PO", om: "Bitachuu fi PO" },
  "dashboard.moduleFin": { en: "Finance & AP/AR", am: "ፋይናንስ እና AP/AR", om: "Maallaqa fi AP/AR" },
  "dashboard.moduleHr": { en: "HR & payroll", am: "HR እና ደሞዝ", om: "HR fi kaffaltiwwan" },
  "sub.active": { en: "Active", am: "ንቁ", om: "Aktive" },
  "sub.trial": { en: "Trial", am: "ሙከራ", om: "Tryaalii" },
  "sub.suspended": { en: "Suspended", am: "ተወግዷል", om: "Dhaabbate" },
  "sub.archived": { en: "Archived", am: "በማህደር ተቀምጧል", om: "Kuufame" },
  "sub.unknown": { en: "Unknown", am: "ያልታወቀ", om: "Hin beekamu" },

  // —— KPI cards (dashboard) ——
  "kpi.assetsCount": { en: "Number of assets", am: "የንብረቶች ብዛት", om: "Lakkoofsa qabeenya" },
  "kpi.valueOfAssets": { en: "Value of assets", am: "የንብረቶች ዋጋ", om: "Gatii qabeenya" },
  "kpi.netAssetsValue": { en: "Net assets value", am: "ጠቅላላ የንብረት ዋጋ", om: "Gatii qabeenya calisa" },
  "kpi.purchasesFY": { en: "Purchases in fiscal year", am: "በበጀት ዓመት ግዢዎች", om: "Bitachuu waggaa maallaqaa" },

  // —— Charts ——
  "charts.assetValue": { en: "Asset value", am: "የንብረት ዋጋ", om: "Gatii qabeenya" },
  "charts.stockByCategory": { en: "Stock by category", am: "ክምችት በምድብ", om: "Kuusaa ramaddii" },
  "charts.sortByPlaceholder": { en: "Sort by", am: "ደርድር በ", om: "Afeessuu" },
  "charts.sortMonth": { en: "Sort by: Month", am: "ደርድር፦ ወር", om: "Afeessuu: ji'a" },
  "charts.sortWeek": { en: "Sort by: Week", am: "ደርድር፦ ሳምንት", om: "Afeessuu: torban" },
  "charts.sortDay": { en: "Sort by: Day", am: "ደርድር፦ ቀን", om: "Afeessuu: guyya" },
  "charts.sortValue": { en: "Sort by: Value", am: "ደርድር፦ ዋጋ", om: "Afeessuu: gatii" },
  "charts.mfgDisabled": {
    en: "Manufacturing is disabled for this tenant. Enable the module to see this chart.",
    am: "ለዚህ ኩባንያ ማኑፋክቸሪንግ ተሰናክሏል። ገበታውን ለማየት ሞዱሉን ያንቁ።",
    om: "Oomisha daldala kanaaf dhabame. Graafii arguuf mooduula kana dandeessisi.",
  },
  "charts.noPermChart": {
    en: "You do not have permission to view this chart.",
    am: "ይህን ገበታ ለመመልከት ፍቃድ የለዎትም።",
    om: "Graafii kana ilaaluu hayyamni hin qabdan.",
  },
  "charts.invDisabled": {
    en: "Inventory is disabled for this tenant. Enable the module to see this chart.",
    am: "ለዚህ ኩባንያ መጋዘን ተሰናክሏል። ገበታውን ለማየት ሞዱሉን ያንቁ።",
    om: "Kuusaa daldala kanaaf dhabame. Graafii arguuf mooduula kana dandeessisi.",
  },
  "charts.noInventory": { en: "No inventory yet.", am: "እስካሁን ክምችት የለም።", om: "Ammaaf kuusaa hin jiru." },
  "charts.legendCompleted": { en: "Completed", am: "ተጠናቋል", om: "Xumurame" },
  "charts.legendScheduled": { en: "Scheduled", am: "በመርሐ ግብር", om: "Karoorfame" },
  "charts.range.1d": { en: "1d", am: "1ቀ", om: "1g" },
  "charts.range.1w": { en: "1w", am: "1ሳ", om: "1t" },
  "charts.range.1m": { en: "1m", am: "1ወ", om: "1j" },
  "charts.range.3m": { en: "3m", am: "3ወ", om: "3j" },
  "charts.range.1y": { en: "1y", am: "1ዓ", om: "1w" },
  "charts.range.all": { en: "All", am: "ሁሉም", om: "Hunda" },

  // —— Feeds & calendar ——
  "feeds.title": { en: "Feeds", am: "ፊዶች", om: "Guddiftoota" },
  "feeds.checkout": { en: "Asset check out", am: "ንብረት ውጣ", om: "Qabeenya baasuu" },
  "feeds.repair": { en: "Asset under repair", am: "ንብረት በጥገና ላይ", om: "Qabeenya fooyyessuu irratti" },
  "feeds.enableMfg": {
    en: "Enable manufacturing to see job and downtime feeds.",
    am: "ስራ እና የዕረፍት ፊዶችን ለማየት ማኑፋክቸሪንግን ያንቁ።",
    om: "Guddiftuu hojii fi yeroo dhabamsiisaa arguuf oomisha dandeessisi.",
  },
  "feeds.colTag": { en: "Asset tag ID", am: "የንብረት መለያ", om: "Lakkoofsa qabeenya" },
  "feeds.colDesc": { en: "Description", am: "መግለጫ", om: "Ibsa" },
  "feeds.colDue": { en: "Due date", am: "የመጨረሻ ቀን", om: "Guyyaa xumuraa" },
  "feeds.noRows": { en: "No rows to show.", am: "ለማሳየት ረድፍ የለም።", om: "Agarsiisuuf safuu hin jiru." },
  "feeds.assetFallback": { en: "Asset", am: "ንብረት", om: "Qabeenya" },
  "feeds.productionJob": { en: "Production job", am: "የምርት ስራ", om: "Hojii oomishaa" },
  "feeds.noDueDate": { en: "No due date", am: "የመጨረሻ ቀን የለም", om: "Guyyaa xumuraa hin jiru" },
  "feeds.alerts": { en: "Alerts", am: "ማስጠንቀቂያዎች", om: "Akeekkachiisa" },
  "feeds.enableMfgCal": {
    en: "Calendar highlights appear when manufacturing is enabled.",
    am: "ማኑፋክቸሪንግ ሲነቃ የቀን መቁጠሪያ ማጉላቶች ይታያሉ።",
    om: "Oomisha yeroo dandeessifame agarsiisa kalandarii mul'ata.",
  },
  "feeds.calSortMonth": { en: "Sort by: Month", am: "ደርድር፦ ወር", om: "Afeessuu: ji'a" },
  "feeds.calSortWeek": { en: "Sort by: Week", am: "ደርድር፦ ሳምንት", om: "Afeessuu: torban" },
  "feeds.legendJobDue": { en: "Job due", am: "ስራ ጊዜው አልፏል", om: "Hojii yeroo" },
  "feeds.legendDowntime": { en: "Open downtime", am: "ክፍት የዕረፍት ጊዜ", om: "Yeroo dhabamsiisaa bani" },
  "feeds.legendCompleted": { en: "Completed", am: "ተጠናቋል", om: "Xumurame" },
  "feeds.legendActivity": { en: "Activity", am: "እንቅስቃሴ", om: "Hojii" },
  "feeds.weekday.sun": { en: "Sun", am: "እሁድ", om: "Dil" },
  "feeds.weekday.mon": { en: "Mon", am: "ሰኞ", om: "Wiixata" },
  "feeds.weekday.tue": { en: "Tue", am: "ማክሰ", om: "Kibxata" },
  "feeds.weekday.wed": { en: "Wed", am: "ረቡዕ", om: "Roobii" },
  "feeds.weekday.thu": { en: "Thu", am: "ሐሙስ", om: "Kamisa" },
  "feeds.weekday.fri": { en: "Fri", am: "ዓርብ", om: "Jimaata" },
  "feeds.weekday.sat": { en: "Sat", am: "ቅዳሜ", om: "Sanbata" },

  // —— Offline banner ——
  "offline.title": { en: "Offline", am: "ከመስመር ውጭ", om: "Ala" },
  "offline.detail": {
    en: "PO receive and stock receipt/issue/adjustment can be queued and will post when you reconnect.",
    am: "የPO መቀበል እና የክምችት መቀበል/መስጠት/ማስተካከል በወረፋ ሊቀመጡ እንደገና ሲገናኙ ይለጠፋሉ።",
    om: "PO fudhachuu fi galmeessuu/kaffaltuu/gulaaluu kuusaa eegalee deebi'anitti galmaa'a.",
  },
  "offline.queued": { en: "queued", am: "በወረፋ", om: "eegale" },
  "offline.queuedDetail": {
    en: "Warehouse actions waiting to sync to the server.",
    am: "የመጋዘን ተግባራት ከሰርቨር ጋር ለመስማማት በመጠበቅ ላይ።",
    om: "Hojiiwwan mana kuusaa sarvaritti walsimu eegaa jiru.",
  },
  "offline.syncNow": { en: "Sync now", am: "አሁን አመሳስል", om: "Amma walsimsiisi" },
  "offline.toastSynced": {
    en: "Synced {n} queued action(s)",
    am: "{n} የወረፋ ተግባር(ዎች) ተመሳስለዋል",
    om: "Hojiiwwan {n} walsimsaan",
  },
  "offline.toastPaused": {
    en: "Sync paused: {msg}",
    am: "ማመሳሰል ቆሟል፦ {msg}",
    om: "Walsiinsi dhaabbate: {msg}",
  },
  "offline.offlineMsg": {
    en: "You're offline — connect to sync the queue.",
    am: "ከመስመር ውጭ ነዎት — ወረፋውን ለማመሳሰል ይገናኙ።",
    om: "Ala jirta — waldaa walsiisuuf walqunnamaa.",
  },
  "offline.queueEmpty": { en: "Queue is empty.", am: "ወረፋ ባዶ ነው።", om: "Waldaan duwwaa dha." },

  // —— Announcement banner ——
  "announce.warning": { en: "Warning", am: "ማስጠንቀቂያ", om: "Akeekkachiisa" },
  "announce.maintenance": { en: "Maintenance", am: "ጥገና", om: "Fooyyessaa" },
  "announce.info": { en: "Info", am: "መረጃ", om: "Odeeffannoo" },
  "announce.forTenant": { en: "for your company", am: "ለኩባንያዎ", om: "daldala keessanif" },
  "announce.forAll": { en: "for all companies", am: "ለሁሉም ኩባንያዎች", om: "daldalawwan hundaaf" },
  "announce.dismiss": { en: "Dismiss", am: "አሰናብት", om: "Hidhi" },

  // —— Not found ——
  "notFound.title": { en: "404", am: "404", om: "404" },
  "notFound.message": { en: "Oops! Page not found", am: "ውይ! ገጽ አልተገኘም", om: "Ayyo! Fuula hin argamne" },
  "notFound.home": { en: "Return to Home", am: "ወደ መነሻ ተመለስ", om: "Mana deebi'i" },

  // —— Production hub ——
  "production.title": { en: "Production", am: "ምርት", om: "Oomisha" },
  "production.subtitle": {
    en: "Shop floor jobs, BOMs, materials, orders & clients — unified workspace",
    am: "የመስሪያ ቤት ስራዎች፣ BOM፣ ቁሳቁሶች፣ ትዕዛዞች እና ደንበኞች — አንድ የስራ ቦታ",
    om: "Hojiiwwan mana warshaa, BOM, madda, ajaja fi maamiltoota — bakka hojii tokko",
  },
  "production.tabJobs": { en: "Processes (Jobs)", am: "ሂደቶች (ስራዎች)", om: "Adeemsa (hojiiwwan)" },
  "production.tabBoms": { en: "Products (BOMs)", am: "ምርቶች (BOM)", om: "Oomishaa (BOM)" },
  "production.tabMaterials": { en: "Raw materials", am: "ጥሬ ዕቃዎች", om: "Madda bu'uuraa" },
  "production.tabOrders": { en: "Orders", am: "ትዕዛዞች", om: "Ajajaawwan" },
  "production.tabClients": { en: "Clients", am: "ደንበኞች", om: "Maamiltoota" },

  // —— Page heroes (titles & subtitles) ——
  "pages.orders.title": { en: "Orders", am: "ትዕዛዞች", om: "Ajajaawwan" },
  "pages.orders.subtitle": {
    en: "Demand, fulfillment & statistics — same layout as dashboard, jobs, and BOMs",
    am: "ይጠየቃል፣ ማሟላት እና ስታትስቲክስ — እንደ ዳሽቦርድ፣ ስራዎች እና BOM",
    om: "Gaafii, guutuu fi lakkoofsa — akkuma gabatee, hojiiwwan fi BOM",
  },
  "pages.clients.title": { en: "Client accounts", am: "የደንበኛ መለያዎች", om: "Herrega maamila" },
  "pages.clients.subtitle": {
    en: "Organizations, contacts, and tax profiles for order-to-cash.",
    am: "ድርጅቶች፣ ግንኙነቶች እና የግብር መገለጫዎች ከትዕዛዝ እስከ ገንዘብ።",
    om: "Dhaabbilee, quunnamtii fi ibsa gurgurtaa hanga kaffaltiitti.",
  },
  "pages.boms.title": { en: "Bill of materials", am: "የቁሳቁስ ዝርዝር", om: "Tarree maddaa" },
  "pages.boms.subtitle": {
    en: "Structures, routing & statistics — same layout as dashboard and jobs",
    am: "ዋና ዋና ክፍሎች፣ መንገድ እና ስታትስቲክስ — እንደ ዳሽቦርድ እና ስራዎች",
    om: "Qaabeenya, karaa fi lakkoofsa — akkuma gabatee fi hojiiwwan",
  },
  "pages.jobs.title": { en: "Production jobs", am: "የምርት ስራዎች", om: "Hojiiwwan oomishaa" },
  "pages.jobs.subtitle": {
    en: "Work orders, schedules & statistics — same layout as your dashboard",
    am: "የስራ ትዕዛዞች፣ መርሐ ግብሮች እና ስታትስቲክስ — እንደ ዳሽቦርድዎ",
    om: "Ajaja hojii, karoora fi lakkoofsa — akkuma gabatee keessan",
  },
  "pages.inventory.title": { en: "Inventory", am: "መጋዘን", om: "Kuusaa warshaa" },
  "pages.inventory.subtitle": {
    en: "Full-facility stock visibility, reorder signals, valuation, and movements — same layout as dashboard and orders",
    am: "የክምችት እይታ፣ የእንደገና ትዕዛዝ ምልክቶች፣ ግምት እና እንቅስቃሴዎች — እንደ ዳሽቦርድ እና ትዕዛዞች",
    om: "Mul'ata kuusaa, beeksisa deebis ajajaa, gatii fi socho'uu — akkuma gabatee fi ajaja",
  },
  "pages.finance.title": { en: "Finance", am: "ፋይናንስ", om: "Maallaqa" },
  "pages.finance.subtitle": {
    en: "Fiscal intelligence, liquidity, and journal activity — same layout as dashboard and orders.",
    am: "የበጀት ብልህነት፣ ፈሳሽነት እና መዝገብ እንቅስቃሴ — እንደ ዳሽቦርድ እና ትዕዛዞች።",
    om: "Ogummaa maallaqaa, likiidiidii fi hojii galmeessaa — akkuma gabatee fi ajaja.",
  },
  "pages.hr.title": { en: "HR & payroll", am: "ሰው ሀብት እና ደሞዝ", om: "HR fi kaffaltiwwan" },
  "pages.hr.subtitle": {
    en: "Ethiopia-aligned payroll: pension 7%/11%, PAYE, overtime, payslips & government CSV exports — same layout as dashboard and orders.",
    am: "ከኢትዮጵያ ጋር የተስማማ ደሞዝ፦ ጡረታ 7%/11%፣ PAYE፣ ተጨማሪ ሰዓት፣ ደሞዝ ደብተር እና የመንግስት CSV — እንደ ዳሽቦርድ።",
    om: "Kaffaltiwwan Itoophiyaa waliin walqunnaman: penshinii 7%/11%, PAYE, yeroo daballee, payslip fi CSV mootummaa — akkuma gabatee.",
  },
  "pages.myHr.title": { en: "My HR", am: "የኔ ሰው ሀብት", om: "HR koo" },
  "pages.myHr.subtitle": {
    en: "Self-service attendance, leave, and correction requests — same layout as dashboard and HR admin.",
    am: "ራስ ሰር መገኘት፣ ፈቃድ እና ማስተካከያ ጥያቄዎች — እንደ ዳሽቦርድ እና HR አስተዳዳሪ።",
    om: "Argama ofumaan, daftee fi gaaffii gulaalaa — akkuma gabatee fi bulchiinsa HR.",
  },
  "pages.myHr.checkIn": { en: "Check in", am: "ግባ", om: "Seeni" },
  "pages.myHr.checkOut": { en: "Check out", am: "ውጣ", om: "Ba'i" },
  "pages.shipments.title": { en: "Shipments", am: "ማስላኪያ", om: "Ergamtoota" },
  "pages.shipments.subtitle": {
    en: "Pick, pack, ship — partial shipments and tracking. Same layout as dashboard, inventory, and orders.",
    am: "ምረጥ፣ ጥቅል፣ ላክ — ከፊል ማስላኪያ እና መከታተል። እንደ ዳሽቦርድ፣ መጋዘን እና ትዕዛዞች።",
    om: "Fuudhu, cuusi, ergi — ergama kutaa fi hordoffii. Akkuma gabatee, kuusaa fi ajaja.",
  },
  "pages.settings.title": { en: "Settings", am: "ቅንብሮች", om: "Qindaa'ina" },
  "pages.settings.subtitle": {
    en: "Company profile, regional preferences, security, and integrations — same layout as dashboard and finance.",
    am: "የኩባንያ መገለጫ፣ ክልላዊ ምርጫዎች፣ ደህንነት እና ውህደቶች — እንደ ዳሽቦርድ እና ፋይናንስ።",
    om: "Ibsa daldalaa, filannoo naannoo, nageenya fi walitti hidhamiinsa — akkuma gabatee fi maallaqaa.",
  },
  "pages.sme.title": { en: "SME package", am: "SME ፓኬጅ", om: "Paakeejii SME" },
  "pages.sme.subtitle": {
    en: "A focused ERP starter kit: stock, purchasing, light production, and Ethiopia-ready invoicing — same layout as dashboard and finance, designed to go live fast.",
    am: "የተሟላ ERP ጅምር፦ ክምችት፣ ግዢ፣ ቀላል ምርት እና ለኢትዮጵያ ዝግጁ ደረሰኝ — በፍጥነት ለመጀመር የተዘጋጀ።",
    om: "ERP jalqaba: kuusaa, bitachuu, oomisha salpha fi bilbilaa Itoophiyaa qophaa'e — akka gabatee fi maallaqaa, dafee hojii irratti ba'uu.",
  },
  "pages.sme.ctaOrder": { en: "Start with an order", am: "በትዕዛዝ ይጀምሩ", om: "Ajajaa jalqabi" },
  "pages.sme.ctaConfigure": { en: "Configure", am: "አዋቅር", om: "Qindeessi" },
  "pages.platform.title": { en: "Platform", am: "መድረክ", om: "Platfoormii" },
  "pages.platform.subtitle": {
    en: "Manage company accounts, global announcements, and audit logs — same layout as dashboard and finance.",
    am: "የኩባንያ መለያዎች፣ ዓለም አቀፍ ማስታወቂያዎች እና ኦዲት ምዝግብ ማስታወሻዎች — እንደ ዳሽቦርድ።",
    om: "Herrega daldalaa, beeksisa addunyaa fi galmeewwan qorannoo — akkuma gabatee fi maallaqaa.",
  },
  "pages.purchasing.title": { en: "Procurement", am: "ግዢ", om: "Bitachuu" },
  "pages.purchasing.subtitle": {
    en: "POs with import landed cost (freight, duty, clearing), FX, and LC tracking.",
    am: "PO ከገቢ ወጪ (ጭነት፣ ቀረጥ፣ ክሊሪንግ)፣ FX እና LC መከታተል ጋር።",
    om: "PO gatii galaa (geejjibaa, impaayera, qulqulluu), FX fi hordoffii LC waliin.",
  },
  "pages.purchasing.newPo": { en: "New PO", am: "አዲስ PO", om: "PO haaraa" },
  "pages.purchasing.openPos": { en: "Open POs", am: "ክፍት PO", om: "PO bani" },
  "pages.purchasing.draftPos": { en: "Draft", am: "ረቂቅ", om: "Qorannoo" },
  "pages.purchasing.toReceive": { en: "To receive", am: "ለመቀበል", om: "Fudhachuuf" },
  "pages.reports.title": { en: "Reports", am: "ሪፖርቶች", om: "Gabaasawwan" },
  "pages.reports.subtitle": {
    en: "Live aggregates from orders, clients, finance, production, purchasing, shipments, and inventory — bucketed by your company timezone.",
    am: "ከትዕዛዞች፣ ደንበኞች፣ ፋይናንስ፣ ምርት፣ ግዢ፣ ማስላኪያ እና መጋዘን በቀጥታ ድምር — በኩባንያዎ የጊዜ ሰቅ።",
    om: "Walitti qabama ajaja, maamiltoota, maallaqaa, oomisha, bitachuu, ergama fi kuusaa — sa'aatii daldala keessanitin.",
  },
  "pages.reports.exportCsv": { en: "Export CSV", am: "CSV ላክ", om: "CSV baasi" },
  "pages.platformTenant.back": { en: "Back to platform", am: "ወደ መድረክ ተመለስ", om: "Gara platfoormii deebi'i" },

  "sidebar.version": { en: "v1.0.0 · Integra ERP", am: "v1.0.0 · ኢንተግራ ERP", om: "v1.0.0 · Integra ERP" },
});

const cache: Partial<Record<UiLang, Record<string, string>>> = {};

function flattenForLang(lang: UiLang): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [key, row] of Object.entries(STRINGS)) {
    o[key] = row[lang];
  }
  return o;
}

/** Replace {name} placeholders in translated strings. */
export function tKey(lang: UiLang, key: string, vars?: Record<string, string | number>): string {
  if (!cache.en) cache.en = flattenForLang("en");
  if (!cache[lang]) cache[lang] = flattenForLang(lang);
  let s = cache[lang]![key];
  if (s == null) {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] missing key: ${key}`);
    }
    s = cache.en![key] ?? key;
  }
  if (vars) {
    for (const [vk, vv] of Object.entries(vars)) {
      s = s.replaceAll(`{${vk}}`, String(vv));
    }
  }
  return s;
}

export function i18nKeyCount(): number {
  return Object.keys(STRINGS).length;
}
