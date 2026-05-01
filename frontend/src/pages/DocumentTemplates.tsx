import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";
import { useLocale } from "@/contexts/LocaleContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Palette, 
  Image as ImageIcon, 
  Type, 
  Save, 
  CheckCircle2, 
  Loader2,
  FileText,
  Truck,
  ShoppingCart
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DocumentTemplates() {
  const { t } = useLocale();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: tenantApi.getSettings,
  });

  const [form, setForm] = useState({
    logoUrl: "",
    primaryColor: "#4f46e5",
    fontFamily: "Inter, sans-serif",
    footerText: "",
    invoiceHeader: "TAX INVOICE",
    poHeader: "PURCHASE ORDER",
    dnHeader: "DELIVERY NOTE",
  });

  useEffect(() => {
    if (settings?.documentSettings) {
      setForm(settings.documentSettings);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: tenantApi.updateDocumentSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      toast({
        title: "Templates Updated",
        description: "Your document branding has been saved successfully.",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
      </div>
    );
  }

  const handleSave = () => {
    mutation.mutate(form);
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">{t("templates.title")}</h1>
          <p className="text-muted-foreground">{t("templates.subtitle")}</p>
        </div>
        <Button onClick={handleSave} disabled={mutation.isPending} className="shadow-erp-lg bg-indigo-600 hover:bg-indigo-700">
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {t("templates.save")}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Editor Side */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          <Card className="shadow-erp-sm border-none bg-card/50 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-indigo-500" />
                {t("templates.logo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logoUrl" className="text-xs font-bold uppercase opacity-60">Logo URL</Label>
                <Input 
                  id="logoUrl" 
                  value={form.logoUrl} 
                  onChange={(e) => setForm({...form, logoUrl: e.target.value})}
                  placeholder="https://your-domain.com/logo.png"
                  className="bg-background/50"
                />
              </div>
              {form.logoUrl && (
                <div className="p-4 border rounded-xl bg-muted/20 flex items-center justify-center">
                   <img src={form.logoUrl} alt="Logo Preview" className="max-h-16 object-contain" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-erp-sm border-none bg-card/50 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Palette className="h-4 w-4 text-emerald-500" />
                Branding Colors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor" className="text-xs font-bold uppercase opacity-60">{t("templates.primaryColor")}</Label>
                <div className="flex gap-3">
                  <Input 
                    id="primaryColor" 
                    type="color"
                    value={form.primaryColor} 
                    onChange={(e) => setForm({...form, primaryColor: e.target.value})}
                    className="w-12 h-10 p-1 bg-transparent border-none"
                  />
                  <Input 
                    value={form.primaryColor} 
                    onChange={(e) => setForm({...form, primaryColor: e.target.value})}
                    className="flex-1 font-mono uppercase"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-erp-sm border-none bg-card/50 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Type className="h-4 w-4 text-amber-500" />
                Content & Headers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase opacity-60">Invoice Title</Label>
                  <Input value={form.invoiceHeader} onChange={(e) => setForm({...form, invoiceHeader: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase opacity-60">PO Title</Label>
                  <Input value={form.poHeader} onChange={(e) => setForm({...form, poHeader: e.target.value})} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-bold uppercase opacity-60">Delivery Note Title</Label>
                  <Input value={form.dnHeader} onChange={(e) => setForm({...form, dnHeader: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase opacity-60">{t("templates.footer")}</Label>
                <Textarea 
                  value={form.footerText} 
                  onChange={(e) => setForm({...form, footerText: e.target.value})}
                  placeholder="Terms & conditions, bank details, or thank you message..."
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Side */}
        <div className="xl:col-span-7">
          <Card className="shadow-erp-lg border-none overflow-hidden sticky top-6">
            <CardHeader className="bg-muted/30 border-b">
               <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-black uppercase tracking-widest">{t("templates.preview")}</CardTitle>
                    <CardDescription>Visual representation of your document</CardDescription>
                  </div>
                  <Tabs defaultValue="invoice" className="w-[300px]">
                    <TabsList className="grid w-full grid-cols-3 bg-background/50">
                      <TabsTrigger value="invoice"><FileText className="h-3 w-3 mr-1" /></TabsTrigger>
                      <TabsTrigger value="po"><ShoppingCart className="h-3 w-3 mr-1" /></TabsTrigger>
                      <TabsTrigger value="dn"><Truck className="h-3 w-3 mr-1" /></TabsTrigger>
                    </TabsList>
                  </Tabs>
               </div>
            </CardHeader>
            <CardContent className="p-0 bg-white">
               {/* Mock Document */}
               <div className="p-8 text-slate-900 min-h-[600px] flex flex-col" style={{ fontFamily: form.fontFamily }}>
                  <div className="flex justify-between items-start mb-8">
                    <div>
                       {form.logoUrl ? (
                         <img src={form.logoUrl} alt="Branding" className="max-h-12 mb-2" />
                       ) : (
                         <h2 className="text-xl font-bold tracking-tight">{settings?.legalName || 'COMPANY NAME'}</h2>
                       )}
                       <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Addis Ababa, Ethiopia</p>
                    </div>
                    <div className="text-right">
                       <h1 className="text-3xl font-black italic tracking-tighter uppercase" style={{ color: form.primaryColor }}>
                          {form.invoiceHeader}
                       </h1>
                       <p className="text-sm font-mono text-slate-400"># INV-2024-0042</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 mb-8 text-[11px]">
                     <div>
                        <p className="font-black uppercase text-slate-400 mb-1">Bill To</p>
                        <p className="font-bold text-sm">Abyssinia Trading PLC</p>
                        <p>Bole Road, Tower 2</p>
                        <p>TIN: 0012345678</p>
                     </div>
                     <div className="text-right">
                        <p className="font-black uppercase text-slate-400 mb-1">Details</p>
                        <p><b>Date:</b> May 15, 2024</p>
                        <p><b>Due:</b> June 15, 2024</p>
                        <p><b>Status:</b> <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500">DRAFT</span></p>
                     </div>
                  </div>

                  <table className="w-full text-xs mb-8 border-collapse">
                    <thead>
                       <tr className="border-y-2" style={{ borderColor: form.primaryColor, backgroundColor: '#f8fafc' }}>
                          <th className="py-2 text-left font-black uppercase pl-2">Description</th>
                          <th className="py-2 text-right font-black uppercase">Qty</th>
                          <th className="py-2 text-right font-black uppercase pr-2">Total</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       <tr>
                          <td className="py-3 pl-2">
                             <p className="font-bold">Industrial Pump Filter (Grade A)</p>
                             <p className="text-[10px] text-slate-400">SKU: PROD-99812</p>
                          </td>
                          <td className="py-3 text-right">5</td>
                          <td className="py-3 text-right font-mono pr-2">12,500.00</td>
                       </tr>
                       <tr>
                          <td className="py-3 pl-2">
                             <p className="font-bold">Installation & Service Fee</p>
                          </td>
                          <td className="py-3 text-right">1</td>
                          <td className="py-3 text-right font-mono pr-2">2,500.00</td>
                       </tr>
                    </tbody>
                  </table>

                  <div className="ml-auto w-48 space-y-2 text-xs">
                     <div className="flex justify-between">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="font-mono">15,000.00</span>
                     </div>
                     <div className="flex justify-between border-t-2 pt-2 text-lg font-black" style={{ color: form.primaryColor }}>
                        <span>TOTAL</span>
                        <span className="font-mono">15,000.00</span>
                     </div>
                  </div>

                  <div className="mt-auto pt-10 border-t border-dashed border-slate-200">
                     <p className="text-[10px] font-black uppercase text-slate-300 mb-2 tracking-widest">Footer Notes</p>
                     <p className="text-[11px] text-slate-500 italic leading-relaxed">
                        {form.footerText || 'Your custom footer text will appear here. Ideal for bank details or terms.'}
                     </p>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
