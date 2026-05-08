import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { crmApi, inventoryApi, clientsApi, ordersApi } from "@/lib/api";
import { useLocale } from "@/contexts/LocaleContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Users, FileText, ArrowRight, CheckCircle, XCircle, Trash2, Edit, MoreHorizontal, UserPlus, ShoppingCart } from "lucide-react";
import { format } from "date-fns";

const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];

export default function Crm() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("leads");

  // --- Leads State ---
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [leadForm, setLeadForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    status: "New",
    expectedValue: 0,
    notes: ""
  });

  // --- Quotes State ---
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState<any>({
    lead: "",
    client: "",
    items: [],
    validUntil: "",
    status: "Draft"
  });

  // --- Queries ---
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: crmApi.leads.getAll,
  });

  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn: crmApi.quotes.getAll,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryApi.getAll,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: clientsApi.getAll,
  });

  // --- Mutations ---
  const leadMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        ...data,
        email: data.email || null,
        phone: data.phone || null,
        notes: data.notes || null
      };
      return selectedLead ? crmApi.leads.update(selectedLead._id, payload) : crmApi.leads.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setLeadModalOpen(false);
      toast.success(selectedLead ? "Lead updated" : "Lead created");
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || error.message || "Failed to process lead";
      toast.error(msg);
    }
  });

  const deleteLeadMutation = useMutation({
    mutationFn: (id: string) => crmApi.leads.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success("Lead deleted");
    }
  });

  const convertLeadMutation = useMutation({
    mutationFn: (id: string) => crmApi.leads.convert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success("Lead converted to Client successfully");
    }
  });

  const quoteMutation = useMutation({
    mutationFn: (data: any) => crmApi.quotes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setQuoteModalOpen(false);
      toast.success("Quote created");
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || error.message || "Failed to create quote";
      toast.error(msg);
    }
  });

  const convertQuoteMutation = useMutation({
    mutationFn: (id: string) => crmApi.quotes.convert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success("Quote converted to Sales Order successfully");
    }
  });

  // --- Handlers ---
  const handleEditLead = (lead: any) => {
    setSelectedLead(lead);
    setLeadForm({
      name: lead.name,
      company: lead.company,
      email: lead.email || "",
      phone: lead.phone || "",
      status: lead.status,
      expectedValue: lead.expectedValue || 0,
      notes: lead.notes || ""
    });
    setLeadModalOpen(true);
  };

  const handleNewLead = () => {
    setSelectedLead(null);
    setLeadForm({
      name: "",
      company: "",
      email: "",
      phone: "",
      status: "New",
      expectedValue: 0,
      notes: ""
    });
    setLeadModalOpen(true);
  };

  const addQuoteItem = () => {
    setQuoteForm({
      ...quoteForm,
      items: [...quoteForm.items, { product: "", quantity: 1, price: 0 }]
    });
  };

  const updateQuoteItem = (index: number, field: string, value: any) => {
    const newItems = [...quoteForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'product') {
        const prod = products.find((p: any) => p._id === value);
        if (prod) newItems[index].price = prod.price || 0;
    }
    
    setQuoteForm({ ...quoteForm, items: newItems });
  };

  const calculateTotal = () => {
      return quoteForm.items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);
  };

  const handleCreateQuote = () => {
      if (quoteForm.items.length === 0) return toast.error("Add at least one item");
      if (!quoteForm.lead && !quoteForm.client) return toast.error("Select a lead or client");
      
      const payload = {
          ...quoteForm,
          totalAmount: calculateTotal(),
          lead: quoteForm.lead || null,
          client: quoteForm.client || null,
          items: quoteForm.items.map((it: any) => ({
              ...it,
              product: it.product || null
          })).filter((it: any) => it.product)
      };
      
      quoteMutation.mutate(payload);
  };

  const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
    'New': { color: 'text-blue-600', bg: 'bg-blue-50', icon: Users },
    'Contacted': { color: 'text-purple-600', bg: 'bg-purple-50', icon: MoreHorizontal },
    'Qualified': { color: 'text-amber-600', bg: 'bg-amber-50', icon: CheckCircle },
    'Proposal': { color: 'text-indigo-600', bg: 'bg-indigo-50', icon: FileText },
    'Won': { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: ShoppingCart },
    'Lost': { color: 'text-rose-600', bg: 'bg-rose-50', icon: XCircle },
  };

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-700">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white p-8 shadow-erp-sm border border-white/40">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-24 w-24 rounded-full bg-emerald-500/5 blur-2xl" />
        
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-[#1a2744] uppercase italic">
                {t("crm.title")}
              </h1>
            </div>
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground opacity-70">
              {t("crm.subtitle")}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {activeTab === "leads" ? (
              <Button 
                onClick={handleNewLead}
                className="h-11 rounded-full bg-primary px-6 font-bold shadow-erp-sm hover:shadow-erp transition-all active:scale-95 gap-2"
              >
                <Plus className="h-4 w-4" /> {t("crm.newLead")}
              </Button>
            ) : (
              <Button 
                onClick={() => setQuoteModalOpen(true)}
                className="h-11 rounded-full bg-[#1a2744] px-6 font-bold text-white shadow-erp-sm hover:shadow-erp transition-all active:scale-95 gap-2"
              >
                <FileText className="h-4 w-4" /> {t("crm.newQuote")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-12 w-fit rounded-full bg-white/50 p-1 shadow-sm border border-white/60 backdrop-blur-sm">
          <TabsTrigger 
            value="leads" 
            className="rounded-full px-8 text-xs font-black uppercase tracking-tighter data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary"
          >
            {t("crm.tabLeads")}
          </TabsTrigger>
          <TabsTrigger 
            value="quotes" 
            className="rounded-full px-8 text-xs font-black uppercase tracking-tighter data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary"
          >
            {t("crm.tabQuotes")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 min-h-[600px]">
            {LEAD_STATUSES.map(status => {
              const config = STATUS_CONFIG[status];
              const StatusIcon = config.icon;
              const columnLeads = leads.filter((l: any) => l.status === status);
              
              return (
                <div key={status} className="flex flex-col gap-4 group/col">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${config.color.replace('text', 'bg')}`} />
                      <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {status}
                      </h3>
                    </div>
                    <Badge variant="outline" className="bg-white/50 border-white/80 font-mono text-[10px] rounded-md px-1.5 py-0">
                      {columnLeads.length}
                    </Badge>
                  </div>
                  
                  <div className="flex-1 rounded-[2rem] bg-white/30 border border-white/40 p-3 shadow-inner space-y-4 backdrop-blur-sm group-hover/col:bg-white/40 transition-colors">
                    {columnLeads.map((lead: any) => (
                      <div 
                        key={lead._id} 
                        className="group relative cursor-pointer rounded-2xl bg-white p-4 shadow-sm border border-transparent hover:border-primary/20 hover:shadow-erp-md transition-all active:scale-[0.98]"
                        onClick={() => handleEditLead(lead)}
                      >
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit className="h-3 w-3 text-muted-foreground" />
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-bold text-[#1a2744] leading-tight line-clamp-1">{lead.name}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground opacity-60 mt-0.5">{lead.company}</p>
                          </div>
                          
                          {lead.expectedValue > 0 && (
                            <div className="flex items-center gap-1.5 py-1 px-2 rounded-lg bg-emerald-50 w-fit">
                              <span className="text-[10px] font-black text-emerald-600">ETB</span>
                              <span className="text-xs font-black text-emerald-700">{lead.expectedValue.toLocaleString()}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between pt-2 border-t border-dashed">
                            <div className="flex items-center gap-1.5 text-muted-foreground opacity-50">
                              <ArrowRight className="h-3 w-3" />
                              <span className="text-[9px] font-bold uppercase tracking-tighter">
                                {format(new Date(lead.createdAt), 'MMM d')}
                              </span>
                            </div>
                            
                            {lead.status === 'Qualified' && (
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 rounded-full bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm" 
                                onClick={(e) => { e.stopPropagation(); convertLeadMutation.mutate(lead._id); }}
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {columnLeads.length === 0 && (
                      <div className="h-24 rounded-2xl border-2 border-dashed border-muted-foreground/10 flex flex-col items-center justify-center opacity-20 italic font-medium text-xs">
                        <StatusIcon className="h-5 w-5 mb-1" />
                        Empty
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="quotes" className="mt-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="rounded-[2.5rem] bg-white shadow-erp-sm border border-white/60 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="px-8 h-14 text-[10px] font-black uppercase tracking-[0.2em]">{t("crm.quoteNumber")}</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase tracking-[0.2em]">Customer Entity</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase tracking-[0.2em]">Financial Value</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase tracking-[0.2em]">Pipeline Status</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase tracking-[0.2em]">Expiration</TableHead>
                    <TableHead className="px-8 h-14 text-right text-[10px] font-black uppercase tracking-[0.2em]">Action Control</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotesLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 font-bold italic opacity-40">Synchronizing quote data...</TableCell></TableRow>
                  ) : quotes.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 font-bold italic opacity-40 text-lg tracking-tighter">No commercial quotes on record</TableCell></TableRow>
                  ) : (
                    quotes.map((quote: any) => (
                      <TableRow key={quote._id} className="group hover:bg-muted/10 transition-colors border-b-muted/20 last:border-none">
                        <TableCell className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-[#1a2744]/5 flex items-center justify-center">
                              <FileText className="h-4 w-4 text-[#1a2744]" />
                            </div>
                            <span className="font-mono font-black text-sm tracking-tighter text-[#1a2744]">{quote.quoteNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-bold text-sm text-[#1a2744]">{quote.client?.name || quote.lead?.name || "Unidentified Entity"}</p>
                            <Badge variant="outline" className="text-[9px] h-4 font-black uppercase tracking-widest border-muted-foreground/20 opacity-60">
                              {quote.client ? "Client Profile" : "Pipeline Lead"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-primary opacity-60">ETB</span>
                            <span className="font-black text-sm text-[#1a2744]">{quote.totalAmount?.toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="none" 
                            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                              quote.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 
                              quote.status === 'Rejected' ? 'bg-rose-100 text-rose-700 shadow-sm' : 
                              'bg-blue-100 text-blue-700 shadow-sm'
                            }`}
                          >
                            {quote.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-[10px] font-bold text-muted-foreground">
                            {quote.validUntil ? format(new Date(quote.validUntil), 'MMM d, yyyy') : 'No Expiry'}
                          </div>
                        </TableCell>
                        <TableCell className="px-8 text-right">
                          <div className="flex justify-end gap-2">
                            {quote.status !== 'Accepted' && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => convertQuoteMutation.mutate(quote._id)}
                                className="h-8 rounded-full border-primary/20 text-primary font-black uppercase text-[9px] tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm"
                              >
                                <ShoppingCart className="mr-1.5 h-3 w-3" /> Initialize Order
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Lead Modal */}
      <Dialog open={leadModalOpen} onOpenChange={setLeadModalOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-erp-lg bg-card">
          <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-blue-500 via-primary to-emerald-500" />
          <DialogHeader className="p-8 pb-4">
            <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-[#1a2744]">
              {selectedLead ? "Modify Personnel Data" : "Initialize New Lead"}
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60">
              Pipeline intelligence & commercial profiling
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 pt-4 space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Contact Name</Label>
                  <Input value={leadForm.name} onChange={e => setLeadForm({...leadForm, name: e.target.value})} className="h-11 rounded-xl bg-muted/30 border-none font-bold" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Entity / Company</Label>
                  <Input value={leadForm.company} onChange={e => setLeadForm({...leadForm, company: e.target.value})} className="h-11 rounded-xl bg-muted/30 border-none font-bold" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Electronic Mail</Label>
                  <Input type="email" value={leadForm.email} onChange={e => setLeadForm({...leadForm, email: e.target.value})} className="h-11 rounded-xl bg-muted/30 border-none font-bold" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mobile Access</Label>
                  <Input value={leadForm.phone} onChange={e => setLeadForm({...leadForm, phone: e.target.value})} className="h-11 rounded-xl bg-muted/30 border-none font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Lifecycle Status</Label>
                  <Select value={leadForm.status} onValueChange={v => setLeadForm({...leadForm, status: v})}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-erp">
                      {LEAD_STATUSES.map(s => <SelectItem key={s} value={s} className="font-bold text-xs">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Projected Value (ETB)</Label>
                  <Input type="number" value={leadForm.expectedValue} onChange={e => setLeadForm({...leadForm, expectedValue: parseFloat(e.target.value) || 0})} className="h-11 rounded-xl bg-muted/30 border-none font-bold text-emerald-600" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Commercial Notes</Label>
                <Textarea value={leadForm.notes} onChange={e => setLeadForm({...leadForm, notes: e.target.value})} className="min-h-[100px] rounded-2xl bg-muted/30 border-none font-medium text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter className="p-8 bg-muted/20 gap-3">
            {selectedLead && (
              <Button 
                variant="ghost" 
                onClick={() => deleteLeadMutation.mutate(selectedLead._id)} 
                className="mr-auto h-11 w-11 rounded-full text-rose-500 hover:bg-rose-50 hover:text-rose-600 shadow-sm transition-all"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => setLeadModalOpen(false)}
              className="h-11 rounded-full px-6 font-black uppercase text-[10px] tracking-widest"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => leadMutation.mutate(leadForm)} 
              disabled={leadMutation.isPending}
              className="h-11 rounded-full px-8 font-black uppercase text-[10px] tracking-widest bg-[#1a2744] hover:bg-[#2c3e60] text-white shadow-erp-sm transition-all active:scale-95"
            >
              {selectedLead ? "Commit Updates" : "Authorize Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quote Modal */}
      <Dialog open={quoteModalOpen} onOpenChange={setQuoteModalOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-erp-lg bg-card">
          <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-blue-500 via-[#1a2744] to-indigo-500" />
          <DialogHeader className="p-8 pb-4">
            <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-[#1a2744]">
              {t("crm.newQuote")}
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60">
              Financial document generation & commercial terms
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-8 pt-4 space-y-8">
            <div className="grid grid-cols-2 gap-6 p-6 rounded-3xl bg-muted/30 border border-muted/20">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Pipeline Lead Link</Label>
                <Select value={quoteForm.lead || "none"} onValueChange={v => setQuoteForm({...quoteForm, lead: v === "none" ? "" : v, client: ""})}>
                  <SelectTrigger className="h-11 rounded-xl bg-white border-none font-bold shadow-sm">
                    <SelectValue placeholder="Target a lead..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-erp">
                    <SelectItem value="none" className="font-bold text-xs italic opacity-50">Null / No Link</SelectItem>
                    {leads.map((l: any) => <SelectItem key={l._id} value={l._id} className="font-bold text-xs">{l.name} ({l.company})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Client Entity Link</Label>
                <Select value={quoteForm.client || "none"} onValueChange={v => setQuoteForm({...quoteForm, client: v === "none" ? "" : v, lead: ""})}>
                  <SelectTrigger className="h-11 rounded-xl bg-white border-none font-bold shadow-sm">
                    <SelectValue placeholder="Target a client..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-erp">
                    <SelectItem value="none" className="font-bold text-xs italic opacity-50">Null / No Link</SelectItem>
                    {clients.map((c: any) => <SelectItem key={c._id} value={c._id} className="font-bold text-xs">{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-[#1a2744]/10 flex items-center justify-center">
                    <ShoppingCart className="h-4 w-4 text-[#1a2744]" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#1a2744]">Line Items</h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={addQuoteItem}
                  className="h-9 rounded-full px-4 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 border border-primary/10 transition-all"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Append Row
                </Button>
              </div>
              
              <div className="rounded-3xl border border-muted/20 overflow-hidden shadow-inner bg-muted/5">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-none">
                      <TableHead className="px-6 text-[9px] font-black uppercase tracking-widest">Product / Sku</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest w-[100px]">Qty</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest w-[160px]">Unit Price</TableHead>
                      <TableHead className="px-6 text-right text-[9px] font-black uppercase tracking-widest w-[160px]">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quoteForm.items.map((item: any, idx: number) => (
                      <TableRow key={idx} className="border-b-muted/10 last:border-none">
                        <TableCell className="px-6">
                          <Select value={item.product} onValueChange={v => updateQuoteItem(idx, 'product', v)}>
                            <SelectTrigger className="h-10 border-none bg-transparent hover:bg-white/50 transition-colors font-bold text-sm">
                              <SelectValue placeholder="Search product..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-erp">
                              {products.map((p: any) => <SelectItem key={p._id} value={p._id} className="font-bold text-xs">{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={1} value={item.quantity} onChange={e => updateQuoteItem(idx, 'quantity', parseInt(e.target.value) || 1)} className="h-10 border-none bg-transparent text-center font-black" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-muted-foreground">ETB</span>
                            <Input type="number" value={item.price} onChange={e => updateQuoteItem(idx, 'price', parseFloat(e.target.value) || 0)} className="h-10 border-none bg-transparent font-black" />
                          </div>
                        </TableCell>
                        <TableCell className="px-6 text-right font-black text-sm text-[#1a2744]">
                          {(item.quantity * item.price).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {quoteForm.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 italic text-xs font-bold opacity-30 tracking-tighter uppercase">No items initialized</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-8 rounded-3xl bg-[#1a2744] text-white shadow-erp">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">Document Validity</Label>
                <div className="relative">
                  <Input type="date" value={quoteForm.validUntil} onChange={e => setQuoteForm({...quoteForm, validUntil: e.target.value})} className="h-11 w-48 rounded-xl bg-white/10 border-none text-white font-bold" />
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Cumulative Total</p>
                <p className="text-4xl font-black italic tracking-tighter">
                  <span className="text-sm not-italic font-bold opacity-40 mr-2 uppercase tracking-normal">ETB</span>
                  {calculateTotal().toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter className="p-8 bg-muted/20 gap-3">
            <Button 
              variant="outline" 
              onClick={() => setQuoteModalOpen(false)}
              className="h-11 rounded-full px-6 font-black uppercase text-[10px] tracking-widest"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateQuote} 
              disabled={quoteMutation.isPending}
              className="h-11 rounded-full px-8 font-black uppercase text-[10px] tracking-widest bg-primary hover:bg-primary/90 text-white shadow-erp-sm transition-all active:scale-95"
            >
              Generate Commercial Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
