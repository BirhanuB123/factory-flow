import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Factory, User, Bell, Shield, Clock, Globe, Palette, Save, Sparkles, Sliders, ShieldCheck, Zap
} from "lucide-react";

const SETTINGS_KEY = "erp-settings";

const defaultSettings = {
  shopName: "Integra CNC",
  shopAddress: "1234 Industrial Blvd, Suite 100",
  shopCity: "Detroit, MI 48201",
  shopPhone: "(313) 555-0199",
  shopEmail: "ops@integracnc.com",
  timezone: "America/Detroit",
  currency: "USD",
  displayName: "Alex Torres",
  role: "Shop Manager",
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

export default function Settings() {
  const [shopName, setShopName] = useState(defaultSettings.shopName);
  const [shopAddress, setShopAddress] = useState(defaultSettings.shopAddress);
  const [shopCity, setShopCity] = useState(defaultSettings.shopCity);
  const [shopPhone, setShopPhone] = useState(defaultSettings.shopPhone);
  const [shopEmail, setShopEmail] = useState(defaultSettings.shopEmail);
  const [timezone, setTimezone] = useState(defaultSettings.timezone);
  const [currency, setCurrency] = useState(defaultSettings.currency);
  const [displayName, setDisplayName] = useState(defaultSettings.displayName);
  const [role] = useState(defaultSettings.role);
  const [emailNotifications, setEmailNotifications] = useState(defaultSettings.emailNotifications);
  const [smsNotifications, setSmsNotifications] = useState(defaultSettings.smsNotifications);
  const [lowStockAlerts, setLowStockAlerts] = useState(defaultSettings.lowStockAlerts);
  const [jobStatusAlerts, setJobStatusAlerts] = useState(defaultSettings.jobStatusAlerts);
  const [delayAlerts, setDelayAlerts] = useState(defaultSettings.delayAlerts);
  const [autoBackup, setAutoBackup] = useState(defaultSettings.autoBackup);
  const [darkMode, setDarkMode] = useState(defaultSettings.darkMode);
  const [compactView, setCompactView] = useState(defaultSettings.compactView);
  const [dateFormat, setDateFormat] = useState(defaultSettings.dateFormat);
  const [defaultJobView, setDefaultJobView] = useState(defaultSettings.defaultJobView);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, unknown>;
        if (saved.shopName != null) setShopName(String(saved.shopName));
        if (saved.shopAddress != null) setShopAddress(String(saved.shopAddress));
        if (saved.shopCity != null) setShopCity(String(saved.shopCity));
        if (saved.shopPhone != null) setShopPhone(String(saved.shopPhone));
        if (saved.shopEmail != null) setShopEmail(String(saved.shopEmail));
        if (saved.timezone != null) setTimezone(String(saved.timezone));
        if (saved.currency != null) setCurrency(String(saved.currency));
        if (saved.displayName != null) setDisplayName(String(saved.displayName));
        if (saved.emailNotifications != null) setEmailNotifications(Boolean(saved.emailNotifications));
        if (saved.smsNotifications != null) setSmsNotifications(Boolean(saved.smsNotifications));
        if (saved.lowStockAlerts != null) setLowStockAlerts(Boolean(saved.lowStockAlerts));
        if (saved.jobStatusAlerts != null) setJobStatusAlerts(Boolean(saved.jobStatusAlerts));
        if (saved.delayAlerts != null) setDelayAlerts(Boolean(saved.delayAlerts));
        if (saved.autoBackup != null) setAutoBackup(Boolean(saved.autoBackup));
        if (saved.darkMode != null) setDarkMode(Boolean(saved.darkMode));
        if (saved.compactView != null) setCompactView(Boolean(saved.compactView));
        if (saved.dateFormat != null) setDateFormat(String(saved.dateFormat));
        if (saved.defaultJobView != null) setDefaultJobView(String(saved.defaultJobView));
      }
    } catch {
      // ignore invalid stored data
    }
  }, []);

  const getSettingsSnapshot = () => ({
    shopName,
    shopAddress,
    shopCity,
    shopPhone,
    shopEmail,
    timezone,
    currency,
    displayName,
    role,
    emailNotifications,
    smsNotifications,
    lowStockAlerts,
    jobStatusAlerts,
    delayAlerts,
    autoBackup,
    darkMode,
    compactView,
    dateFormat,
    defaultJobView,
  });

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(getSettingsSnapshot()));
    window.dispatchEvent(new Event("erp-settings-updated"));
    toast.success("Settings saved successfully");
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(getSettingsSnapshot(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `erp-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Settings exported");
  };

  const handleReset = () => {
    localStorage.removeItem(SETTINGS_KEY);
    setShopName(defaultSettings.shopName);
    setShopAddress(defaultSettings.shopAddress);
    setShopCity(defaultSettings.shopCity);
    setShopPhone(defaultSettings.shopPhone);
    setShopEmail(defaultSettings.shopEmail);
    setTimezone(defaultSettings.timezone);
    setCurrency(defaultSettings.currency);
    setDisplayName(defaultSettings.displayName);
    setEmailNotifications(defaultSettings.emailNotifications);
    setSmsNotifications(defaultSettings.smsNotifications);
    setLowStockAlerts(defaultSettings.lowStockAlerts);
    setJobStatusAlerts(defaultSettings.jobStatusAlerts);
    setDelayAlerts(defaultSettings.delayAlerts);
    setAutoBackup(defaultSettings.autoBackup);
    setDarkMode(defaultSettings.darkMode);
    setCompactView(defaultSettings.compactView);
    setDateFormat(defaultSettings.dateFormat);
    setDefaultJobView(defaultSettings.defaultJobView);
    toast.success("Settings reset to defaults");
  };

  return (
    <div className="space-y-8 pb-12 max-w-5xl">
      {/* Header Section */}
      <div className="relative p-8 rounded-[2rem] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-blue-500/5 backdrop-blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-[1px] w-8 bg-primary" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-primary">System Core</span>
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">
              CONTROL CENTER
            </h1>
            <p className="text-sm font-medium text-muted-foreground">Global configuration & preference overrides</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleSave} 
              className="h-14 rounded-2xl px-10 font-black uppercase italic text-xs tracking-widest shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all bg-primary flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Commit Configuration
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="shop" className="space-y-8">
        <TabsList className="h-14 bg-white/5 backdrop-blur-2xl border border-white/10 p-1.5 rounded-2xl">
          <TabsTrigger value="shop" className="rounded-xl px-8 font-black uppercase italic text-[10px] tracking-[0.2em] data-[state=active]:bg-primary data-[state=active]:shadow-xl shadow-primary/20 flex items-center gap-2">
            <Factory className="h-4 w-4" /> Facility
          </TabsTrigger>
          <TabsTrigger value="user" className="rounded-xl px-8 font-black uppercase italic text-[10px] tracking-[0.2em] data-[state=active]:bg-primary data-[state=active]:shadow-xl shadow-primary/20 flex items-center gap-2">
            <User className="h-4 w-4" /> Identity
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-xl px-8 font-black uppercase italic text-[10px] tracking-[0.2em] data-[state=active]:bg-primary data-[state=active]:shadow-xl shadow-primary/20 flex items-center gap-2">
            <Bell className="h-4 w-4" /> Broadcasts
          </TabsTrigger>
          <TabsTrigger value="system" className="rounded-xl px-8 font-black uppercase italic text-[10px] tracking-[0.2em] data-[state=active]:bg-primary data-[state=active]:shadow-xl shadow-primary/20 flex items-center gap-2">
            <Shield className="h-4 w-4" /> Hard-Core
          </TabsTrigger>
        </TabsList>

        {/* Shop Configuration */}
        <TabsContent value="shop" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-white/10 bg-white/[0.02] backdrop-blur-2xl rounded-[2rem] overflow-hidden shadow-2xl transition-all hover:bg-white/[0.03]">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-white/10 text-primary">
                    <Factory className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-lg font-black uppercase tracking-tighter italic">Factory Identity</CardTitle>
                </div>
                <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/40 italic">Structural credentials for institutional sync</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-4">
                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest ml-1">Legal Shop Designation</Label>
                    <Input value={shopName} onChange={(e) => setShopName(e.target.value)} className="h-12 bg-white/5 border-white/10 rounded-xl font-bold text-base italic" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest ml-1">Technical Contact</Label>
                    <Input type="email" value={shopEmail} onChange={(e) => setShopEmail(e.target.value)} className="h-12 bg-white/5 border-white/10 rounded-xl font-bold font-mono" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest ml-1">Comms Terminal</Label>
                      <Input value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} className="h-12 bg-white/5 border-white/10 rounded-xl font-bold font-mono" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest ml-1">Regional Code</Label>
                      <Input value={shopCity} onChange={(e) => setShopCity(e.target.value)} className="h-12 bg-white/5 border-white/10 rounded-xl font-bold" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-white/10 bg-white/[0.02] backdrop-blur-2xl rounded-[2rem] overflow-hidden shadow-2xl">
                <CardHeader className="p-8 pb-4 font-black uppercase italic">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-white/10 text-blue-500">
                      <Globe className="h-4 w-4" />
                    </div>
                    <span>Regional Synchro</span>
                  </div>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest ml-1">Temporal Zone</Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold italic">
                          <Clock className="h-4 w-4 mr-2 text-primary" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card/95 backdrop-blur-2xl border-white/10">
                          <SelectItem value="America/New_York">Eastern (ET)</SelectItem>
                          <SelectItem value="America/Chicago">Central (CT)</SelectItem>
                          <SelectItem value="America/Denver">Mountain (MT)</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific (PT)</SelectItem>
                          <SelectItem value="America/Detroit">Detroit (ET)</SelectItem>
                          <SelectItem value="Africa/Addis_Ababa">East Africa (EAT)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest ml-1">Monetary Standard</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold italic font-mono text-primary">
                          <Globe className="h-4 w-4 mr-2" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card/95 backdrop-blur-2xl border-white/10">
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="CAD">CAD (C$)</SelectItem>
                          <SelectItem value="ETB">ETB (Br)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <div className="p-8 rounded-[2rem] bg-gradient-to-br from-primary/20 to-blue-500/10 border border-white/10 backdrop-blur-3xl flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-black italic uppercase tracking-tighter">Live Status</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 italic underline decoration-primary/30 underline-offset-4">Sector Ready for synchronization</p>
                </div>
                <div className="h-12 w-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* User Preferences */}
        <TabsContent value="user" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-white/10 bg-white/[0.02] backdrop-blur-2xl rounded-[2rem] overflow-hidden shadow-2xl transition-all hover:bg-white/[0.03]">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-white/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-lg font-black uppercase tracking-tighter italic">Identity Profile</CardTitle>
                </div>
                <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/40 italic">User-specific authorization data</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-4">
                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest ml-1">Display Alias</Label>
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-12 bg-white/5 border-white/10 rounded-xl font-bold text-base italic" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest ml-1">Rank & Privilege</Label>
                    <Input value={role} disabled className="h-12 bg-white/5 border-white/5 rounded-xl font-black uppercase italic text-xs tracking-widest opacity-50" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.02] backdrop-blur-2xl rounded-[2rem] overflow-hidden shadow-2xl transition-all hover:bg-white/[0.03]">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-white/10 text-blue-500">
                    <Palette className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-lg font-black uppercase tracking-tighter italic">Interface Specs</CardTitle>
                </div>
                <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/40 italic">Viewport & aesthetic overrides</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest ml-1">Chronicle Format</Label>
                    <Select value={dateFormat} onValueChange={setDateFormat}>
                      <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold italic"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card/95 backdrop-blur-2xl border-white/10">
                        <SelectItem value="YYYY-MM-DD">2026-03-12</SelectItem>
                        <SelectItem value="MM/DD/YYYY">03/12/2026</SelectItem>
                        <SelectItem value="DD/MM/YYYY">12/03/2026</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest ml-1">Default Viewforce</Label>
                    <Select value={defaultJobView} onValueChange={setDefaultJobView}>
                      <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold italic"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card/95 backdrop-blur-2xl border-white/10">
                        <SelectItem value="table">Ledger Table</SelectItem>
                        <SelectItem value="kanban">Kanban Grid</SelectItem>
                        <SelectItem value="calendar">Temporal Grid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator className="bg-white/5" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="space-y-0.5">
                      <p className="text-xs font-black uppercase italic tracking-wider">Density Mode</p>
                      <p className="text-[9px] font-bold text-muted-foreground/60 italic uppercase tracking-widest">Minimalist data spacing toggle</p>
                    </div>
                    <Switch checked={compactView} onCheckedChange={setCompactView} className="data-[state=checked]:bg-primary" />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="space-y-0.5">
                      <p className="text-xs font-black uppercase italic tracking-wider">Dark Protocol</p>
                      <p className="text-[9px] font-bold text-muted-foreground/60 italic uppercase tracking-widest">High-contrast nocturnal mode</p>
                    </div>
                    <Switch checked={darkMode} onCheckedChange={setDarkMode} className="data-[state=checked]:bg-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-white/10 bg-white/[0.02] backdrop-blur-2xl rounded-[2rem] overflow-hidden shadow-2xl transition-all hover:bg-white/[0.03]">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-white/10 text-amber-500">
                    <Zap className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-lg font-black uppercase tracking-tighter italic">Broadcast Channels</CardTitle>
                </div>
                <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/40 italic">Critical telemetry routing</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="space-y-0.5">
                      <p className="text-xs font-black uppercase italic tracking-wider">Email Protocol</p>
                      <p className="text-[9px] font-bold text-muted-foreground/60 italic uppercase tracking-widest">Dispatch system alerts to primary email</p>
                    </div>
                    <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} className="data-[state=checked]:bg-amber-500" />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="space-y-0.5">
                      <p className="text-xs font-black uppercase italic tracking-wider">SMS Frequency</p>
                      <p className="text-[9px] font-bold text-muted-foreground/60 italic uppercase tracking-widest">Mobile cellular alert sequence</p>
                    </div>
                    <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} className="data-[state=checked]:bg-amber-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.02] backdrop-blur-2xl rounded-[2rem] overflow-hidden shadow-2xl transition-all hover:bg-white/[0.03]">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-white/10 text-primary">
                    <Sliders className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-lg font-black uppercase tracking-tighter italic">Alert Overrides</CardTitle>
                </div>
                <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/40 italic">Operational threshold notifications</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-4">
                <div className="space-y-4">
                  {[
                    { label: "Inventory Criticality", sub: "Low stock/reorder point alerts", checked: lowStockAlerts, setter: setLowStockAlerts },
                    { label: "Job Lifecycle Update", sub: "Real-time production stage changes", checked: jobStatusAlerts, setter: setJobStatusAlerts },
                    { label: "Throughput Latency", sub: "Production delay & risk warnings", checked: delayAlerts, setter: setDelayAlerts },
                  ].map((alert, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                      <div className="space-y-0.5">
                        <p className="text-xs font-black uppercase italic tracking-wider">{alert.label}</p>
                        <p className="text-[9px] font-bold text-muted-foreground/60 italic uppercase tracking-widest">{alert.sub}</p>
                      </div>
                      <Switch checked={alert.checked} onCheckedChange={alert.setter} className="data-[state=checked]:bg-primary" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System */}
        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-white/10 bg-white/[0.02] backdrop-blur-2xl rounded-[2rem] overflow-hidden shadow-2xl">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-white/10 text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-lg font-black uppercase tracking-tighter italic">Data Integrity</CardTitle>
                </div>
                <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/40 italic">System-level backup & export protocols</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="space-y-0.5">
                      <p className="text-xs font-black uppercase italic tracking-wider">Automated Redundancy</p>
                      <p className="text-[9px] font-bold text-muted-foreground/60 italic uppercase tracking-widest">Daily system snapshot serialization</p>
                    </div>
                    <Switch checked={autoBackup} onCheckedChange={setAutoBackup} className="data-[state=checked]:bg-primary" />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="space-y-0.5">
                      <p className="text-xs font-black uppercase italic tracking-wider">Secure JSON Export</p>
                      <p className="text-[9px] font-bold text-muted-foreground/60 italic uppercase tracking-widest">Download current configuration state</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExport} className="h-9 rounded-xl font-black uppercase italic text-[10px] tracking-widest px-6 border-white/10 hover:bg-white/10">Extract</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-white/10 bg-white/[0.02] backdrop-blur-2xl rounded-[2rem] overflow-hidden shadow-2xl">
                <CardHeader className="p-8 pb-4 font-black uppercase italic">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-white/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span>Build Environment</span>
                  </div>
                </CardHeader>
                <CardContent className="p-8 pt-0">
                  <div className="grid grid-cols-2 gap-y-4 text-[10px] font-black uppercase tracking-widest italic">
                    <p className="text-muted-foreground/60 italic">Core Revision</p>
                    <p className="text-primary text-right italic">1.2.0-F_FLOW</p>
                    <p className="text-muted-foreground/60 italic">Instance Mode</p>
                    <p className="text-emerald-500 text-right italic">Optimized Prod</p>
                    <p className="text-muted-foreground/60 italic">Baseline Sync</p>
                    <p className="text-foreground text-right italic">MARCH 16, 2026</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-rose-500/30 bg-rose-500/[0.02] backdrop-blur-2xl rounded-[2rem] overflow-hidden shadow-2xl transition-all hover:bg-rose-500/[0.05]">
                <CardHeader className="p-8 pb-4">
                  <CardTitle className="text-lg font-black uppercase tracking-tighter italic text-rose-500">NULL PROTOCOL</CardTitle>
                  <CardDescription className="text-xs font-bold uppercase tracking-widest text-rose-500/40 italic">Irreversible factory reset sequence</CardDescription>
                </CardHeader>
                <CardContent className="p-8 pt-0 flex items-center justify-between bg-gradient-to-t from-rose-500/5 to-transparent">
                  <p className="text-[9px] font-bold text-rose-500/60 italic uppercase tracking-widest max-w-[200px]">WIPE ALL CONFIGURATION STATE AND RESTORE BASELINE DEFAULTS</p>
                  <Button variant="destructive" size="sm" onClick={handleReset} className="h-10 rounded-xl font-black uppercase italic text-xs tracking-widest px-8 shadow-xl shadow-rose-500/20">Wipe</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
