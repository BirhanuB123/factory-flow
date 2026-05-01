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
    mutationFn: (data: any) => selectedLead ? crmApi.leads.update(selectedLead._id, data) : crmApi.leads.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setLeadModalOpen(false);
      toast.success(selectedLead ? "Lead updated" : "Lead created");
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
      
      quoteMutation.mutate({
          ...quoteForm,
          totalAmount: calculateTotal()
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("crm.title")}</h1>
          <p className="text-muted-foreground">{t("crm.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "leads" ? (
            <Button onClick={handleNewLead}>
              <Plus className="mr-2 h-4 w-4" /> {t("crm.newLead")}
            </Button>
          ) : (
            <Button onClick={() => setQuoteModalOpen(true)}>
              <FileText className="mr-2 h-4 w-4" /> {t("crm.newQuote")}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="leads">{t("crm.tabLeads")}</TabsTrigger>
          <TabsTrigger value="quotes">{t("crm.tabQuotes")}</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
            {LEAD_STATUSES.map(status => (
              <div key={status} className="flex flex-col gap-4 min-w-[200px]">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{status}</h3>
                  <Badge variant="secondary">{leads.filter((l: any) => l.status === status).length}</Badge>
                </div>
                <div className="bg-muted/30 rounded-xl p-2 min-h-[500px] space-y-3">
                  {leads.filter((l: any) => l.status === status).map((lead: any) => (
                    <Card key={lead._id} className="cursor-pointer hover:border-primary transition-colors shadow-sm" onClick={() => handleEditLead(lead)}>
                      <CardHeader className="p-3 pb-0">
                        <CardTitle className="text-sm font-bold truncate">{lead.name}</CardTitle>
                        <CardDescription className="text-xs truncate">{lead.company}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-3 pt-2 space-y-2">
                        {lead.expectedValue > 0 && (
                          <div className="text-xs font-bold text-emerald-600">
                            ETB {lead.expectedValue.toLocaleString()}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-muted-foreground">{format(new Date(lead.createdAt), 'MMM d')}</span>
                            {lead.status === 'Qualified' && (
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={(e) => { e.stopPropagation(); convertLeadMutation.mutate(lead._id); }}>
                                    <UserPlus className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="quotes" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("crm.quoteNumber")}</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotesLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10">Loading quotes...</TableCell></TableRow>
                  ) : quotes.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10">No quotes found</TableCell></TableRow>
                  ) : (
                    quotes.map((quote: any) => (
                      <TableRow key={quote._id}>
                        <TableCell className="font-mono font-bold">{quote.quoteNumber}</TableCell>
                        <TableCell>
                          {quote.client?.name || quote.lead?.name || "Unknown"}
                          <div className="text-xs text-muted-foreground">
                            {quote.client ? "Client" : "Lead"}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold">ETB {quote.totalAmount?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={quote.status === 'Accepted' ? 'success' : quote.status === 'Rejected' ? 'destructive' : 'secondary'}>
                            {quote.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{quote.validUntil ? format(new Date(quote.validUntil), 'MMM d, yyyy') : '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {quote.status !== 'Accepted' && (
                                <Button variant="outline" size="sm" onClick={() => convertQuoteMutation.mutate(quote._id)}>
                                    <ShoppingCart className="mr-2 h-4 w-4" /> Convert
                                </Button>
                            )}
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lead Modal */}
      <Dialog open={leadModalOpen} onOpenChange={setLeadModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedLead ? "Edit Lead" : "New Lead"}</DialogTitle>
            <DialogDescription>
              Enter the details for the potential client.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" value={leadForm.name} onChange={e => setLeadForm({...leadForm, name: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="company" className="text-right">Company</Label>
              <Input id="company" value={leadForm.company} onChange={e => setLeadForm({...leadForm, company: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email</Label>
              <Input id="email" type="email" value={leadForm.email} onChange={e => setLeadForm({...leadForm, email: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">Phone</Label>
              <Input id="phone" value={leadForm.phone} onChange={e => setLeadForm({...leadForm, phone: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">Status</Label>
              <Select value={leadForm.status} onValueChange={v => setLeadForm({...leadForm, status: v})}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="value" className="text-right">Value</Label>
              <Input id="value" type="number" value={leadForm.expectedValue} onChange={e => setLeadForm({...leadForm, expectedValue: parseFloat(e.target.value) || 0})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">Notes</Label>
              <Textarea id="notes" value={leadForm.notes} onChange={e => setLeadForm({...leadForm, notes: e.target.value})} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            {selectedLead && (
                <Button variant="destructive" onClick={() => deleteLeadMutation.mutate(selectedLead._id)} className="mr-auto">
                    <Trash2 className="h-4 w-4" />
                </Button>
            )}
            <Button onClick={() => leadMutation.mutate(leadForm)} disabled={leadMutation.isPending}>
              {selectedLead ? "Save Changes" : "Create Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quote Modal */}
      <Dialog open={quoteModalOpen} onOpenChange={setQuoteModalOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>{t("crm.newQuote")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Link to Lead (Optional)</Label>
                <Select value={quoteForm.lead} onValueChange={v => setQuoteForm({...quoteForm, lead: v, client: ""})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a lead..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {leads.map((l: any) => <SelectItem key={l._id} value={l._id}>{l.name} ({l.company})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Link to Client (Optional)</Label>
                <Select value={quoteForm.client} onValueChange={v => setQuoteForm({...quoteForm, client: v, lead: ""})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {clients.map((c: any) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button variant="outline" size="sm" onClick={addQuoteItem}>
                  <Plus className="h-4 w-4 mr-1" /> Add Line
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="w-[100px]">Qty</TableHead>
                      <TableHead className="w-[150px]">Price</TableHead>
                      <TableHead className="w-[150px]">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quoteForm.items.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Select value={item.product} onValueChange={v => updateQuoteItem(idx, 'product', v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Product..." />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p: any) => <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={1} value={item.quantity} onChange={e => updateQuoteItem(idx, 'quantity', parseInt(e.target.value) || 1)} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.price} onChange={e => updateQuoteItem(idx, 'price', parseFloat(e.target.value) || 0)} />
                        </TableCell>
                        <TableCell className="font-bold">
                          ETB {(item.quantity * item.price).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {quoteForm.items.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
                        <TableCell className="text-xl font-black text-primary">ETB {calculateTotal().toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input type="date" value={quoteForm.validUntil} onChange={e => setQuoteForm({...quoteForm, validUntil: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateQuote} disabled={quoteMutation.isPending}>Create Quote</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
