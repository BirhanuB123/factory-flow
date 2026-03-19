import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { savedViewsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bookmark, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function SavedViewsBar({
  module,
  filters,
  onApply,
}: {
  module: string;
  filters: Record<string, unknown>;
  onApply: (f: Record<string, unknown>) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data: views = [] } = useQuery({
    queryKey: ["saved-views", module],
    queryFn: () => savedViewsApi.list(module),
  });

  const createMut = useMutation({
    mutationFn: () => savedViewsApi.create({ name: name.trim(), module, filters }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-views", module] });
      toast.success("View saved");
      setName("");
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message || "Could not save (duplicate name?)"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => savedViewsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-views", module] });
      toast.success("View removed");
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-2 py-2 border-t border-white/5 mt-2">
      <Bookmark className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select
        onValueChange={(id) => {
          const v = views.find((x) => x._id === id);
          if (v?.filters && typeof v.filters === "object") onApply(v.filters as Record<string, unknown>);
        }}
      >
        <SelectTrigger className="w-[200px] h-9 rounded-xl text-xs">
          <SelectValue placeholder="Load saved view" />
        </SelectTrigger>
        <SelectContent>
          {views.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">No saved views</div>
          ) : (
            views.map((v) => (
              <SelectItem key={v._id} value={v._id} className="text-xs">
                {v.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      <Input
        className="h-9 max-w-[160px] rounded-xl text-xs"
        placeholder="Name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-9 text-[10px] font-black uppercase"
        disabled={!name.trim() || createMut.isPending}
        onClick={() => createMut.mutate()}
      >
        Save view
      </Button>
      {views.length > 0 && (
        <Select onValueChange={(id) => delMut.mutate(id)}>
          <SelectTrigger className="w-[36px] h-9 px-0 justify-center rounded-xl border-destructive/30 text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </SelectTrigger>
          <SelectContent>
            {views.map((v) => (
              <SelectItem key={v._id} value={v._id} className="text-xs text-destructive">
                Delete: {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
