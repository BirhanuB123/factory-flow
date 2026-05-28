import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { locationsApi } from "@/lib/api";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MapPin, Plus, Trash2, Edit2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";

export function LocationsTab() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState("");
  const [type, setType] = useState("Warehouse");

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: locationsApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: locationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-locations'] });
      toast.success("Location added");
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to create location");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => locationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-locations'] });
      toast.success("Location updated");
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to update location");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: locationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-locations'] });
      toast.success("Location deleted");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to delete location");
    }
  });

  const resetForm = () => {
    setName("");
    setType("Warehouse");
    setEditingId(null);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: { name, type } });
    } else {
      createMutation.mutate({ name, type });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm">
        <div className="h-1 bg-gradient-to-r from-primary/75 to-cyan-400/70" />
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/20 pb-4 pt-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Storage map</p>
            <CardTitle className="mt-1 flex items-center gap-2 text-lg font-black tracking-tight text-foreground">
              <MapPin className="h-5 w-5 text-primary" />
              Storage Locations
            </CardTitle>
            <p className="mt-1 text-sm font-medium text-muted-foreground">Manage your warehouses, zones, and bins</p>
          </div>
          {can("inventory:post") && (
            <Button
              className="rounded-[12px] gap-2 bg-primary text-primary-foreground font-bold hover:bg-primary/90 text-xs h-10 px-5 shadow-sm"
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New Location
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/25">
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="pl-6 text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">Name</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">Type</TableHead>
                <TableHead className="text-right pr-6 text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : locations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No locations defined</TableCell>
                </TableRow>
              ) : (
                locations.map((loc: any) => (
                  <TableRow key={loc._id} className="group border-border/40 transition-colors hover:bg-muted/30">
                    <TableCell className="pl-6 font-bold text-foreground">{loc.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md border border-slate-500/20 bg-slate-500/10 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 shadow-sm uppercase tracking-wider">
                        {loc.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {can("inventory:post") && (
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => {
                              setEditingId(loc._id);
                              setName(loc.name);
                              setType(loc.type);
                              setIsModalOpen(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete ${loc.name}?`)) {
                                deleteMutation.mutate(loc._id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && setIsModalOpen(false)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Location" : "Create Location"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Location Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Warehouse" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Location Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Warehouse">Warehouse</SelectItem>
                  <SelectItem value="Zone">Zone</SelectItem>
                  <SelectItem value="Bin">Bin</SelectItem>
                  <SelectItem value="Production">Production Area</SelectItem>
                  <SelectItem value="Receiving">Receiving Dock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
