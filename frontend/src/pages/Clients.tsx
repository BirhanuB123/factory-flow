import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsApi } from "@/lib/api";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Search, Plus, Users, Eye, Edit, Trash2, FileStack, Layers, Hash } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocale } from "@/contexts/LocaleContext";

interface Client {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  industry?: string;
  tin?: string;
  vatRegistered?: boolean;
}

const defaultForm: Record<string, unknown> = {
  name: "",
  email: "",
  phone: "",
  address: "",
  industry: "",
  tin: "",
  vatRegistered: true,
};

function apiErrorMessage(err: unknown): string {
  const ax = err as {
    response?: { data?: { message?: string; error?: string | string[] } };
    message?: string;
  };
  const d = ax?.response?.data;
  if (d?.message) return d.message;
  if (d?.error != null) {
    return Array.isArray(d.error) ? d.error.join(", ") : String(d.error);
  }
  return ax?.message || "Request failed";
}

export default function Clients({ embedded = false }: { embedded?: boolean }) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({ ...defaultForm });
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: clientsApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => clientsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client added");
      setFormOpen(false);
      setFormValues({ ...defaultForm });
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err) || "Failed to add client");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      clientsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client updated");
      setFormOpen(false);
      setEditingClient(null);
      setSelectedClient(null);
      setFormValues({ ...defaultForm });
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err) || "Failed to update client");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client deleted");
      setDeleteTarget(null);
      setSelectedClient(null);
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err) || "Failed to delete client");
    },
  });

  useEffect(() => {
    if (editingClient) {
      setFormValues({
        name: editingClient.name,
        email: editingClient.email ?? "",
        phone: editingClient.phone ?? "",
        address: editingClient.address ?? "",
        industry: editingClient.industry ?? "",
        tin: editingClient.tin ?? "",
        vatRegistered: editingClient.vatRegistered !== false,
      });
    } else {
      setFormValues({ ...defaultForm });
    }
  }, [editingClient]);

  const filtered = (clients as Client[]).filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c._id.toLowerCase().includes(search.toLowerCase())
  );
  const withEmailCount = clients.filter((c: Client) => Boolean(c.email)).length;
  const vatRegisteredCount = clients.filter((c: Client) => c.vatRegistered !== false).length;
  const manufacturingAccounts = clients.filter((c: Client) =>
    (c.industry ?? "").toLowerCase().includes("manufact")
  ).length;

  return (
    <div className={`${embedded ? "space-y-6" : "space-y-8"} pb-8 animate-in fade-in duration-500`}>
      {!embedded && (
        <>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#1a2744]">{t("pages.clients.title")}</h1>
              <p className="mt-1 max-w-xl text-sm font-medium text-muted-foreground">{t("pages.clients.subtitle")}</p>
            </div>

            <div className="hidden items-center gap-6 rounded-2xl border border-border/60 bg-card px-6 py-3 shadow-erp-sm lg:flex">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">VAT registered</p>
                <p className="text-sm font-semibold text-foreground">{vatRegisteredCount}</p>
              </div>
              <div className="h-8 w-px bg-border/70" />
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">With email</p>
                <p className="text-sm font-semibold text-[hsl(152,69%,36%)]">{withEmailCount}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Partner network", value: clients.length, icon: Users, color: "text-primary", bg: "bg-primary/10" },
              { label: "Manufacturing", value: manufacturingAccounts, icon: FileStack, color: "text-success", bg: "bg-success/10" },
              { label: "VAT registered", value: vatRegisteredCount, icon: Layers, color: "text-info", bg: "bg-info/10" },
              { label: "With email", value: withEmailCount, icon: Hash, color: "text-warning", bg: "bg-warning/10" },
            ].map((stat, idx) => (
              <Card
                key={idx}
                className="group relative overflow-hidden rounded-2xl border-0 bg-card shadow-erp transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-3xl opacity-20 ${stat.bg}`} />
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg} transition-transform duration-300 group-hover:scale-110`}
                  >
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Main Container */}
      <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-6">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#1a2744]">CRM / accounts</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Relationships, sectors, and contact data</p>
            </div>
            <Button
              className="h-11 gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              onClick={() => {
                setSelectedClient(null);
                setEditingClient(null);
                setFormValues({ ...defaultForm });
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Onboard partner
            </Button>
          </div>

          <div className="flex flex-col gap-4 pt-6 md:flex-row">
            <div className="group relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder="Search by corporate name, email, or system identifier..."
                className="h-11 rounded-full border-0 bg-[#EEF2F7] pl-10 shadow-none focus-visible:ring-2 focus-visible:ring-primary/25"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground pl-6 h-12">Corporate Entity</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground h-12 hidden md:table-cell">Communication Channel</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground h-12 hidden lg:table-cell">Direct Link</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground h-12 hidden lg:table-cell">Industrial Vertical</TableHead>
                  <TableHead className="w-[80px] pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-medium italic">
                      Polling CRM database...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-medium">
                      No corporate records match current query.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((client) => (
                    <TableRow
                      key={client._id}
                      className="cursor-pointer transition-colors hover:bg-muted/30 border-border/50 group/row"
                      onClick={() => setSelectedClient(client)}
                    >
                      <TableCell className="pl-6">
                        <span className="font-black text-[13px] tracking-tight text-foreground">{client.name}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground font-bold text-[11px] italic">
                        {client.email ?? "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground font-mono text-[11px] font-bold">
                        {client.phone ?? "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className="text-[10px] font-black uppercase rounded-md border-primary/30 px-2">
                          {client.industry ?? "General"}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg opacity-0 group-hover/row:opacity-100 transition-all hover:bg-primary hover:text-primary-foreground" 
                          onClick={(e) => { e.stopPropagation(); setSelectedClient(client); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedClient?.name}
            </DialogTitle>
            <DialogDescription>Client details</DialogDescription>
          </DialogHeader>
          {selectedClient && (
            <div className="grid gap-3 text-sm py-2">
              <div><span className="text-muted-foreground">Email</span><br />{selectedClient.email ?? "—"}</div>
              <div><span className="text-muted-foreground">Phone</span><br />{selectedClient.phone ?? "—"}</div>
              <div><span className="text-muted-foreground">Address</span><br />{selectedClient.address ?? "—"}</div>
              <div><span className="text-muted-foreground">Industry</span><br />{selectedClient.industry ?? "—"}</div>
              <div><span className="text-muted-foreground">TIN</span><br />{selectedClient.tin ?? "—"}</div>
              <div><span className="text-muted-foreground">VAT registered</span><br />{selectedClient.vatRegistered !== false ? "Yes" : "No"}</div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const c = selectedClient;
                setSelectedClient(null);
                setEditingClient(c);
                setFormOpen(true);
              }}
            >
              <Edit className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setDeleteTarget(selectedClient)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingClient(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Edit Client" : "Add Client"}</DialogTitle>
            <DialogDescription>{editingClient ? "Update client details." : "Add a new client."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={(formValues.name as string) ?? ""} onChange={(e) => setFormValues((p) => ({ ...p, name: e.target.value }))} placeholder="Company or contact name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={(formValues.email as string) ?? ""} onChange={(e) => setFormValues((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={(formValues.phone as string) ?? ""} onChange={(e) => setFormValues((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={(formValues.address as string) ?? ""} onChange={(e) => setFormValues((p) => ({ ...p, address: e.target.value }))} placeholder="Address" />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input value={(formValues.industry as string) ?? ""} onChange={(e) => setFormValues((p) => ({ ...p, industry: e.target.value }))} placeholder="Industry" />
            </div>
            <div className="space-y-2">
              <Label>TIN (tax ID)</Label>
              <Input
                value={(formValues.tin as string) ?? ""}
                onChange={(e) => setFormValues((p) => ({ ...p, tin: e.target.value }))}
                placeholder="Buyer TIN for tax invoices"
                className="font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="vatReg"
                checked={formValues.vatRegistered !== false}
                onCheckedChange={(c) => setFormValues((p) => ({ ...p, vatRegistered: c === true }))}
              />
              <Label htmlFor="vatReg" className="text-sm font-normal cursor-pointer">
                VAT-registered customer (output VAT on sales)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const name = String(formValues.name ?? "").trim();
                const payload = {
                  name,
                  email: (formValues.email as string)?.trim() || undefined,
                  phone: (formValues.phone as string)?.trim() || undefined,
                  address: (formValues.address as string)?.trim() || undefined,
                  industry: (formValues.industry as string)?.trim() || undefined,
                  tin: (formValues.tin as string)?.trim() || undefined,
                  vatRegistered: formValues.vatRegistered !== false,
                };
                if (editingClient) {
                  updateMutation.mutate({ id: editingClient._id, data: payload });
                } else {
                  if (!name) {
                    toast.error("Name is required");
                    return;
                  }
                  createMutation.mutate(payload);
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingClient ? "Save" : "Add Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete {deleteTarget?.name}. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
