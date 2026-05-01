import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qualityApi } from "@/lib/api";
import { useLocale } from "@/contexts/LocaleContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ClipboardCheck, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  GripVertical,
  Type,
  Hash,
  ToggleLeft
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export default function QualitySettings() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<any>(null);

  const { data: checklists, isLoading } = useQuery({
    queryKey: ["quality-checklists"],
    queryFn: qualityApi.getChecklists,
  });

  const createMutation = useMutation({
    mutationFn: qualityApi.createChecklist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-checklists"] });
      setIsCreateOpen(false);
      toast.success("Checklist created");
    },
    onError: () => toast.error("Failed to create checklist"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => qualityApi.updateChecklist(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-checklists"] });
      setEditingChecklist(null);
      toast.success("Checklist updated");
    },
    onError: () => toast.error("Failed to update checklist"),
  });

  const handleSave = (data: any) => {
    if (editingChecklist) {
      updateMutation.mutate({ id: editingChecklist._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 pb-8 animate-in fade-in duration-500">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1a2744]">Quality Control Settings</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Manage your inspection checklists and compliance standards</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 gap-2 rounded-full font-semibold shadow-erp-sm px-6">
              <Plus className="h-4 w-4" />
              New Checklist
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Inspection Checklist</DialogTitle>
            </DialogHeader>
            <ChecklistForm 
              onSave={handleSave} 
              onCancel={() => setIsCreateOpen(false)} 
              isPending={createMutation.isPending || updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse h-48 border-0 bg-muted/20" />
          ))
        ) : checklists?.length === 0 ? (
          <div className="col-span-full py-20 text-center space-y-4 bg-muted/5 rounded-3xl border-2 border-dashed border-muted">
            <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">No checklists defined yet. Start by creating one!</p>
          </div>
        ) : (
          checklists?.map((cl: any) => (
            <Card key={cl._id} className="group overflow-hidden rounded-2xl border-0 bg-card shadow-erp hover:shadow-lg transition-all duration-300">
              <div className={`h-1.5 w-full ${cl.inspectionType === 'final' ? 'bg-emerald-500' : cl.inspectionType === 'incoming' ? 'bg-blue-500' : 'bg-amber-500'}`} />
              <CardHeader className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="capitalize text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-md">
                    {cl.inspectionType.replace('_', ' ')}
                  </Badge>
                  {!cl.active && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <CardTitle className="text-xl font-bold">{cl.name}</CardTitle>
                <CardDescription className="line-clamp-2 mt-2">{cl.description || "No description provided."}</CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <ClipboardCheck className="h-4 w-4" />
                  {cl.items?.length || 0} Inspection Points
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    className="w-full rounded-xl"
                    onClick={() => setEditingChecklist(cl)}
                  >
                    Edit Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!editingChecklist} onOpenChange={(open) => !open && setEditingChecklist(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Checklist: {editingChecklist?.name}</DialogTitle>
          </DialogHeader>
          <ChecklistForm 
            initialData={editingChecklist} 
            onSave={handleSave} 
            onCancel={() => setEditingChecklist(null)} 
            isPending={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChecklistForm({ initialData, onSave, onCancel, isPending }: { initialData?: any, onSave: (data: any) => void, onCancel: () => void, isPending: boolean }) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [inspectionType, setInspectionType] = useState(initialData?.inspectionType || "final");
  const [items, setItems] = useState<any[]>(initialData?.items || [
    { prompt: "", responseType: "boolean", required: true }
  ]);
  const [active, setActive] = useState(initialData?.active ?? true);

  const addItem = () => {
    setItems([...items, { prompt: "", responseType: "boolean", required: true }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return toast.error("Name is required");
    if (items.some(it => !it.prompt)) return toast.error("All items must have a prompt");
    onSave({ name, description, inspectionType, items, active });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Checklist Name</Label>
          <Input 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="e.g. Final Assembly QC" 
            className="rounded-xl h-11"
          />
        </div>
        <div className="space-y-2">
          <Label>Inspection Type</Label>
          <Select value={inspectionType} onValueChange={setInspectionType}>
            <SelectTrigger className="rounded-xl h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="incoming">Incoming Material</SelectItem>
              <SelectItem value="in_process">In-Process Check</SelectItem>
              <SelectItem value="final">Final Inspection</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea 
          value={description} 
          onChange={e => setDescription(e.target.value)} 
          placeholder="Detailed instructions for the inspector..." 
          className="rounded-xl"
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-lg font-bold">Inspection Points</Label>
        <Button type="button" variant="outline" size="sm" onClick={addItem} className="rounded-full gap-2">
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="flex gap-4 p-4 rounded-2xl bg-muted/20 border border-border/50 items-start group">
            <div className="mt-2 text-muted-foreground">
              <GripVertical className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Input 
                    value={item.prompt} 
                    onChange={e => updateItem(index, 'prompt', e.target.value)} 
                    placeholder="e.g. Dimensions verify within ±0.05mm" 
                    className="rounded-xl"
                  />
                </div>
                <div className="w-40">
                  <Select 
                    value={item.responseType} 
                    onValueChange={v => updateItem(index, 'responseType', v)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boolean">
                        <div className="flex items-center gap-2">
                          <ToggleLeft className="h-4 w-4" /> Pass/Fail
                        </div>
                      </SelectItem>
                      <SelectItem value="numeric">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4" /> Numeric
                        </div>
                      </SelectItem>
                      <SelectItem value="text">
                        <div className="flex items-center gap-2">
                          <Type className="h-4 w-4" /> Text
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={item.required} 
                    onCheckedChange={v => updateItem(index, 'required', v)} 
                  />
                  <Label className="text-xs">Required</Label>
                </div>
                {item.responseType === 'numeric' && (
                  <div className="flex gap-2">
                    <Input 
                      type="number" 
                      placeholder="Min" 
                      className="w-20 h-8 rounded-lg text-xs" 
                      value={item.minValue || ""} 
                      onChange={e => updateItem(index, 'minValue', e.target.value ? Number(e.target.value) : undefined)} 
                    />
                    <Input 
                      type="number" 
                      placeholder="Max" 
                      className="w-20 h-8 rounded-lg text-xs" 
                      value={item.maxValue || ""} 
                      onChange={e => updateItem(index, 'maxValue', e.target.value ? Number(e.target.value) : undefined)} 
                    />
                  </div>
                )}
              </div>
            </div>
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removeItem(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-4 border-t">
        <Switch checked={active} onCheckedChange={setActive} />
        <Label>Checklist is active</Label>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="rounded-xl px-8" disabled={isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save Checklist
        </Button>
      </DialogFooter>
    </form>
  );
}
