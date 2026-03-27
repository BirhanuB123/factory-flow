import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ListTree, ShieldCheck, Download, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { format } from "date-fns";

interface AuditLogPanelProps {
  limit?: number;
  title?: string;
  subtitle?: string;
  showIcon?: boolean;
}

export function AuditLogPanel({ 
  limit = 20, 
  title = "System activity stream", 
  subtitle = "Historical data records of system mutations",
  showIcon = true
}: AuditLogPanelProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit-logs-ui", limit],
    queryFn: () => auditApi.list({ limit }),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-48 bg-secondary/5 rounded-[2.5rem] border border-dashed border-border/20">
        <Loader2 className="h-12 w-12 animate-spin text-primary/40 mb-4" />
        <p className="font-black text-[10px] uppercase tracking-[0.4em] text-muted-foreground/40">Synchronizing registry state...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center bg-destructive/5 rounded-3xl border border-destructive/10">
        <p className="text-sm font-bold text-destructive">Could not load audit log.</p>
      </div>
    );
  }

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          {showIcon && <div className="h-1.5 w-8 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.4)]" />}
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-foreground/70 italic">{title}</h2>
        </div>
        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-border/40 bg-background/50 backdrop-blur-sm px-3 py-1 text-foreground/60 shadow-sm">
          {data?.total ?? 0} total records
        </Badge>
      </div>

      <div className="rounded-[2rem] border border-border/10 overflow-hidden bg-background/20 shadow-inner">
        <Table>
          <TableHeader className="bg-secondary/40 border-b border-border/20">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5 px-6">Event Horizon</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Operation Vector</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Resource Identifier</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Governance Actor</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5 px-6">Mutation Narrative</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-24 bg-background/20">
                  <div className="flex flex-col items-center gap-3">
                    <ListTree className="h-12 w-12 text-muted-foreground/20" />
                    <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/30 italic">No historical data records found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row._id} className="group transition-all hover:bg-primary/5 border-b border-border/10 last:border-0 font-medium">
                  <TableCell className="py-6 px-6 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-foreground/80">
                        {row.at ? format(new Date(row.at), "MMM dd, HH:mm") : "—"}
                      </span>
                      <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">Temporal Log</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-6">
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-background/50 border-border/40 text-primary">
                      {row.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm tracking-tight text-foreground/80 lowercase italic">{row.entityType}</span>
                      {row.entityId ? <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">ID: {String(row.entityId).slice(-8)}</span> : ""}
                    </div>
                  </TableCell>
                  <TableCell className="py-6">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-secondary/50 flex items-center justify-center text-[10px] font-black border border-border/40 text-muted-foreground shadow-sm">
                        {row.actor?.name?.charAt(0) ?? "?"}
                      </div>
                      <span className="font-bold text-sm tracking-tight text-foreground/80">{row.actor?.name ?? "System Node"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-6 px-6 text-[11px] text-muted-foreground/80 leading-relaxed max-w-[320px]">
                    <p className="line-clamp-2 italic" title={row.summary}>
                      {row.summary}
                    </p>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
