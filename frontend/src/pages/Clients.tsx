import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsApi } from "@/lib/api";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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
import { Search, Plus, Users, Eye, Edit, Trash2 } from "lucide-react";

interface Client {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  industry?: string;
}

const defaultForm: Partial<Client> = {
  name: "",
  email: "",
  phone: "",
  address: "",
  industry: "",
};

export default function Clients() {
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
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to add client");
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
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to update client");
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
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to delete client");
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">Manage customer accounts</p>
        </div>
        <Button className="gap-2 shrink-0" onClick={() => { setEditingClient(null); setFormValues({ ...defaultForm }); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Client
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or ID..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Industry</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No clients found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((client) => (
                  <TableRow
                    key={client._id}
                    className="cursor-pointer"
                    onClick={() => setSelectedClient(client)}
                  >
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{client.email ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">{client.phone ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{client.industry ?? "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setSelectedClient(client); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setEditingClient(selectedClient); setFormOpen(true); }}>
              <Edit className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setDeleteTarget(selectedClient)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const payload = {
                  name: formValues.name,
                  email: formValues.email || undefined,
                  phone: formValues.phone || undefined,
                  address: formValues.address || undefined,
                  industry: formValues.industry || undefined,
                };
                if (editingClient) {
                  updateMutation.mutate({ id: editingClient._id, data: payload });
                } else {
                  if (!payload.name) { toast.error("Name is required"); return; }
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
