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
import { Plus, Users, FileText, ArrowRight, CheckCircle, XCircle, Trash2, Edit, MoreHorizontal, UserPlus, ShoppingCart, Target, TrendingUp, BadgeDollarSign } from "lucide-react";
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

  const activeLeads = leads.filter((lead: any) => !["Won", "Lost"].includes(lead.status)).length;
  const wonLeads = leads.filter((lead: any) => lead.status === "Won").length;
  const pipelineValue = leads.reduce((sum: number, lead: any) => sum + (Number(lead.expectedValue) || 0), 0);
  const quoteValue = quotes.reduce((sum: number, quote: any) => sum + (Number(quote.totalAmount) || 0), 0);
  const acceptedQuotes = quotes.filter((quote: any) => quote.status === "Accepted").length;

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      <div className="overflow-hidden rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(190_75%_34%))] text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)] dark:border-white/10">
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-white/55">
                <Target className="h-4 w-4" />
                Commercial control center
              </div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{t("crm.title")}</h1>
              <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-white/60 sm:text-lg">
                {t("crm.subtitle")}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Active leads", value: activeLeads, tone: "text-sky-200" },
                  { label: "Accepted quotes", value: acceptedQuotes, tone: "text-emerald-300" },
                  { label: "Won leads", value: wonLeads, tone: "text-amber-300" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[16px] border border-white/20 bg-white/[0.08] p-4 backdrop-blur">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{item.label}</p>
                    <p className={`mt-2 text-3xl font-black tracking-tight ${item.tone}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[16px] border border-white/15 bg-white/10 p-4 text-right backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Pipeline value</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-white">ETB {pipelineValue.toLocaleString()}</p>
              <p className="mt-1 text-sm font-semibold text-white/55">Quotes ETB {quoteValue.toLocaleString()}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {activeTab === "leads" ? (
              <Button 
                onClick={handleNewLead}
                className="h-10 gap-2 rounded-[12px] bg-white px-5 font-black text-primary hover:bg-white/90"
              >
                <Plus className="h-4 w-4" /> {t("crm.newLead")}
              </Button>
            ) : (
              <Button 
                onClick={() => setQuoteModalOpen(true)}
                className="h-10 gap-2 rounded-[12px] bg-white px-5 font-black text-primary hover:bg-white/90"
              >
                <FileText className="h-4 w-4" /> {t("crm.newQuote")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Leads", value: leads.length, sub: "Total pipeline", icon: Users, tone: "text-primary", accent: "from-primary to-cyan-400" },
          { label: "Pipeline value", value: `ETB ${pipelineValue.toLocaleString()}`, sub: "Expected lead value", icon: TrendingUp, tone: "text-emerald-600", accent: "from-emerald-500 to-teal-400" },
          { label: "Quotes", value: quotes.length, sub: "Commercial documents", icon: FileText, tone: "text-amber-600", accent: "from-amber-400 to-rose-500" },
          { label: "Quote value", value: `ETB ${quoteValue.toLocaleString()}`, sub: "Open and accepted", icon: BadgeDollarSign, tone: "text-violet-600", accent: "from-violet-500 to-blue-500" },
        ].map((stat) => (
          <Card key={stat.label} className="overflow-hidden rounded-[12px] border border-border/70 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <div className={`h-1 bg-gradient-to-r ${stat.accent}`} />
            <CardContent className="p-6">
              <div className="mb-3 flex items-center gap-2">
                <stat.icon className={`h-3.5 w-3.5 ${stat.tone}`} />
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</h3>
              </div>
              <p className="break-words text-3xl font-black tracking-tight text-foreground">{stat.value}</p>
              <p className="mt-2 text-sm font-medium text-muted-foreground">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-auto w-fit rounded-[14px] border border-border/60 bg-card/90 p-1.5 shadow-sm backdrop-blur-sm">
          <TabsTrigger 
            value="leads" 
            className="rounded-[12px] px-8 py-2.5 text-xs font-black uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            {t("crm.tabLeads")}
          </TabsTrigger>
          <TabsTrigger 
            value="quotes" 
            className="rounded-[12px] px-8 py-2.5 text-xs font-black uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            {t("crm.tabQuotes")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-6">
          <div className="grid min-h-[600px] grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
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
                    <Badge variant="outline" className="rounded-[8px] border-border/70 bg-card font-mono text-[10px] px-1.5 py-0">
                      {columnLeads.length}
                    </Badge>
                  </div>
                  
                  <div className="flex-1 space-y-4 rounded-[16px] border border-border/70 bg-card/70 p-3 shadow-sm backdrop-blur-sm transition-colors group-hover/col:bg-card">
                    {columnLeads.map((lead: any) => (
                      <div 
                        key={lead._id} 
                        className="group relative cursor-pointer rounded-[14px] border border-border/60 bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-md active:scale-[0.98]"
                        onClick={() => handleEditLead(lead)}
                      >
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit className="h-3 w-3 text-muted-foreground" />
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <p className="line-clamp-1 text-sm font-black leading-tight text-foreground">{lead.name}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground opacity-60 mt-0.5">{lead.company}</p>
                          </div>
                          
                          {lead.expectedValue > 0 && (
                            <div className="flex w-fit items-center gap-1.5 rounded-[10px] bg-emerald-500/10 px-2 py-1">
                              <span className="text-[10px] font-black text-emerald-600">ETB</span>
                              <span className="text-xs font-black text-emerald-700">{lead.expectedValue.toLocaleString()}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between border-t border-dashed pt-2">
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
                                className="h-7 w-7 rounded-[9px] bg-primary/5 text-primary shadow-sm transition-all hover:bg-primary hover:text-white" 
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
                      <div className="flex h-24 flex-col items-center justify-center rounded-[14px] border border-dashed border-border/70 text-xs font-medium italic text-muted-foreground">
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

        <TabsContent value="quotes" className="mt-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="overflow-hidden rounded-[16px] border border-border/70 bg-card shadow-sm">
            <div className="h-1 bg-gradient-to-r from-primary via-cyan-400 to-emerald-400" />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="h-14 px-8 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t("crm.quoteNumber")}</TableHead>
                    <TableHead className="h-14 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Customer Entity</TableHead>
                    <TableHead className="h-14 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Financial Value</TableHead>
                    <TableHead className="h-14 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Pipeline Status</TableHead>
                    <TableHead className="h-14 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Expiration</TableHead>
                    <TableHead className="h-14 px-8 text-right text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Action Control</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotesLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 font-bold italic opacity-40">Synchronizing quote data...</TableCell></TableRow>
                  ) : quotes.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 font-bold italic opacity-40 text-lg tracking-tighter">No commercial quotes on record</TableCell></TableRow>
                  ) : (
                    quotes.map((quote: any) => (
                      <TableRow key={quote._id} className="group border-b-border/40 transition-colors hover:bg-primary/[0.03] last:border-none">
                        <TableCell className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary/10">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-mono text-sm font-black tracking-tight text-foreground">{quote.quoteNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm font-black text-foreground">{quote.client?.name || quote.lead?.name || "Unidentified Entity"}</p>
                            <Badge variant="outline" className="h-4 rounded-[7px] border-muted-foreground/20 text-[9px] font-black uppercase tracking-widest opacity-70">
                              {quote.client ? "Client Profile" : "Pipeline Lead"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-primary opacity-60">ETB</span>
                            <span className="text-sm font-black text-foreground">{quote.totalAmount?.toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="none" 
                            className={`rounded-[9px] px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
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
                                className="h-8 rounded-[10px] border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary shadow-sm transition-all hover:bg-primary hover:text-white"
                              >
                                <ShoppingCart className="mr-1.5 h-3 w-3" /> Initialize Order
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[10px]">
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
        <DialogContent className="overflow-hidden rounded-[22px] border border-border/60 bg-card p-0 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.75)] sm:max-w-[520px]">
          <div className="mx-5 mt-5 rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(190_75%_34%))] p-5 text-white">
          <DialogHeader>
            <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
              <Users className="h-3.5 w-3.5" />
              Lead pipeline
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight text-white">
              {selectedLead ? "Update Lead" : "New Lead"}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Pipeline intelligence & commercial profiling
            </DialogDescription>
          </DialogHeader>
          </div>
          <div className="space-y-6 p-5">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Contact Name</Label>
                  <Input value={leadForm.name} onChange={e => setLeadForm({...leadForm, name: e.target.value})} className="h-11 rounded-[12px] border-border/60 bg-muted/30 font-bold" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Entity / Company</Label>
                  <Input value={leadForm.company} onChange={e => setLeadForm({...leadForm, company: e.target.value})} className="h-11 rounded-[12px] border-border/60 bg-muted/30 font-bold" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Electronic Mail</Label>
                  <Input type="email" value={leadForm.email} onChange={e => setLeadForm({...leadForm, email: e.target.value})} className="h-11 rounded-[12px] border-border/60 bg-muted/30 font-bold" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mobile Access</Label>
                  <Input value={leadForm.phone} onChange={e => setLeadForm({...leadForm, phone: e.target.value})} className="h-11 rounded-[12px] border-border/60 bg-muted/30 font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Lifecycle Status</Label>
                  <Select value={leadForm.status} onValueChange={v => setLeadForm({...leadForm, status: v})}>
                    <SelectTrigger className="h-11 rounded-[12px] border-border/60 bg-muted/30 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-erp">
                      {LEAD_STATUSES.map(s => <SelectItem key={s} value={s} className="font-bold text-xs">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Projected Value (ETB)</Label>
                  <Input type="number" value={leadForm.expectedValue} onChange={e => setLeadForm({...leadForm, expectedValue: parseFloat(e.target.value) || 0})} className="h-11 rounded-[12px] border-border/60 bg-muted/30 font-bold text-emerald-600" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Commercial Notes</Label>
                <Textarea value={leadForm.notes} onChange={e => setLeadForm({...leadForm, notes: e.target.value})} className="min-h-[100px] rounded-[14px] border-border/60 bg-muted/30 text-sm font-medium" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3 border-t border-border/60 bg-muted/10 p-5">
            {selectedLead && (
              <Button 
                variant="ghost" 
                onClick={() => deleteLeadMutation.mutate(selectedLead._id)} 
                className="mr-auto h-11 w-11 rounded-[12px] text-rose-500 shadow-sm transition-all hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => setLeadModalOpen(false)}
              className="h-11 rounded-[12px] px-6 text-[10px] font-black uppercase tracking-widest"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => leadMutation.mutate(leadForm)} 
              disabled={leadMutation.isPending}
              className="h-11 rounded-[12px] bg-primary px-8 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95"
            >
              {selectedLead ? "Commit Updates" : "Authorize Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quote Modal */}
      <Dialog open={quoteModalOpen} onOpenChange={setQuoteModalOpen}>
        <DialogContent className="overflow-hidden rounded-[22px] border border-border/60 bg-card p-0 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.75)] sm:max-w-[860px]">
          <div className="mx-5 mt-5 rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(190_75%_34%))] p-5 text-white">
          <DialogHeader>
            <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
              <FileText className="h-3.5 w-3.5" />
              Quote document
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight text-white">
              {t("crm.newQuote")}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Financial document generation & commercial terms
            </DialogDescription>
          </DialogHeader>
          </div>
           
          <div className="space-y-6 p-5">
            <div className="grid grid-cols-1 gap-4 rounded-[16px] border border-border/60 bg-muted/20 p-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Pipeline Lead Link</Label>
                <Select value={quoteForm.lead || "none"} onValueChange={v => setQuoteForm({...quoteForm, lead: v === "none" ? "" : v, client: ""})}>
                  <SelectTrigger className="h-11 rounded-[12px] border-border/60 bg-card font-bold shadow-sm">
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
                  <SelectTrigger className="h-11 rounded-[12px] border-border/60 bg-card font-bold shadow-sm">
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary/10">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Line Items</h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={addQuoteItem}
                  className="h-9 rounded-[12px] border border-primary/20 px-4 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:bg-primary/5"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Append Row
                </Button>
              </div>
              
              <div className="overflow-hidden rounded-[16px] border border-border/60 bg-muted/5 shadow-inner">
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
                            <SelectTrigger className="h-10 rounded-[10px] border-none bg-transparent text-sm font-bold transition-colors hover:bg-card/70">
                              <SelectValue placeholder="Search product..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-erp">
                              {products.map((p: any) => <SelectItem key={p._id} value={p._id} className="font-bold text-xs">{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={1} value={item.quantity} onChange={e => updateQuoteItem(idx, 'quantity', parseInt(e.target.value) || 1)} className="h-10 rounded-[10px] border-none bg-transparent text-center font-black" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-muted-foreground">ETB</span>
                            <Input type="number" value={item.price} onChange={e => updateQuoteItem(idx, 'price', parseFloat(e.target.value) || 0)} className="h-10 rounded-[10px] border-none bg-transparent font-black" />
                          </div>
                        </TableCell>
                        <TableCell className="px-6 text-right text-sm font-black text-foreground">
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

            <div className="flex flex-col items-center justify-between gap-6 rounded-[16px] bg-foreground p-6 text-background shadow-sm sm:flex-row">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">Document Validity</Label>
                <div className="relative">
                   <Input type="date" value={quoteForm.validUntil} onChange={e => setQuoteForm({...quoteForm, validUntil: e.target.value})} className="h-11 w-48 rounded-[12px] border-white/10 bg-white/10 font-bold text-white" />
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
          
          <DialogFooter className="gap-3 border-t border-border/60 bg-muted/10 p-5">
            <Button 
              variant="outline" 
              onClick={() => setQuoteModalOpen(false)}
              className="h-11 rounded-[12px] px-6 text-[10px] font-black uppercase tracking-widest"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateQuote} 
              disabled={quoteMutation.isPending}
              className="h-11 rounded-[12px] bg-primary px-8 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95"
            >
              Generate Commercial Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
