import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productionApi, manufacturingApi } from "@/lib/api";
import { useLocale } from "@/contexts/LocaleContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  addDays, 
  startOfDay, 
  format, 
  eachDayOfInterval, 
  differenceInDays, 
  isSameDay,
  isToday,
  subDays
} from "date-fns";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { toast } from "sonner";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Factory,
  Info,
  Layers,
  Maximize2,
  Minimize2,
  Loader2,
  Timer,
  Wrench
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const DAY_WIDTH = 160;
const ROW_HEIGHT = 80;
const HEADER_HEIGHT = 60;
const SIDEBAR_WIDTH = 220;

export default function Scheduling() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [viewStartDate, setViewStartDate] = useState(() => startOfDay(subDays(new Date(), 2)));
  const [daysCount, setDaysCount] = useState(14);
  const containerRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: workCenters = [], isLoading: wcLoading } = useQuery({
    queryKey: ['workCenters'],
    queryFn: manufacturingApi.getWorkCenters,
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['productionJobs'],
    queryFn: productionApi.getAll,
  });

  // Reschedule Mutation
  const rescheduleMut = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => productionApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionJobs'] });
      toast.success("Job rescheduled");
    },
    onError: () => {
      toast.error("Failed to reschedule job");
    }
  });

  const days = useMemo(() => {
    return eachDayOfInterval({
      start: viewStartDate,
      end: addDays(viewStartDate, daysCount - 1)
    });
  }, [viewStartDate, daysCount]);

  const activeJobs = useMemo(() => {
    return jobs.filter((j: any) => j.status === 'Scheduled' || j.status === 'In Progress');
  }, [jobs]);

  const scheduleStats = useMemo(() => {
    const list = activeJobs as any[];
    const now = new Date();
    return {
      active: list.length,
      workCenters: workCenters.length,
      inProgress: list.filter((j) => j.status === "In Progress").length,
      overdue: list.filter((j) => new Date(j.dueDate) < now && j.status !== "Completed").length,
      highPriority: list.filter((j) => j.priority === "High" || j.priority === "Urgent").length,
    };
  }, [activeJobs, workCenters]);

  const getJobStyle = (job: any) => {
    const start = new Date(job.plannedStartDate || job.createdAt);
    const end = new Date(job.dueDate);
    
    const diffStart = differenceInDays(start, viewStartDate);
    const duration = Math.max(1, differenceInDays(end, start) + 1);
    
    return {
      left: diffStart * DAY_WIDTH,
      width: duration * DAY_WIDTH - 8, // Subtract small gap
    };
  };

  const handleReschedule = (job: any, newStart: Date, newEnd: Date, newWcCode?: string) => {
      rescheduleMut.mutate({
          id: job._id,
          data: {
              plannedStartDate: newStart.toISOString(),
              dueDate: newEnd.toISOString(),
              workCenterCode: newWcCode || job.workCenterCode
          }
      });
  };

  if (wcLoading || jobsLoading) {
    return (
      <div className="flex h-[600px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allWorkCenters = [...workCenters, { code: 'UNASSIGNED', name: t('scheduling.unassigned') }];

  return (
    <div className="flex h-full flex-col space-y-6 pb-6 animate-in fade-in duration-500">
      <div className="overflow-hidden rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(190_75%_34%))] text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)] dark:border-white/10">
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-white/55">
                <Factory className="h-4 w-4" />
                Manufacturing orchestration
              </div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                {t("scheduling.title")}
              </h1>
              <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-white/60 sm:text-lg">
                Plan work-center load, drag jobs across dates, and keep active production aligned to capacity.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Active jobs", value: scheduleStats.active, tone: "text-emerald-300" },
                  { label: "Work centers", value: scheduleStats.workCenters, tone: "text-sky-200" },
                  { label: "Overdue", value: scheduleStats.overdue, tone: scheduleStats.overdue > 0 ? "text-rose-300" : "text-white" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[16px] border border-white/20 bg-white/[0.08] p-4 backdrop-blur">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{item.label}</p>
                    <p className={`mt-2 text-3xl font-black tracking-tight ${item.tone}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-[14px] border border-white/15 bg-white/10 p-1 backdrop-blur">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-[12px] text-white hover:bg-white/15 hover:text-white transition-all active:scale-90"
                onClick={() => setViewStartDate(subDays(viewStartDate, 7))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                className="h-9 rounded-[12px] px-6 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-primary transition-all active:scale-95"
                onClick={() => setViewStartDate(startOfDay(new Date()))}
              >
                {t("scheduling.today")}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-[12px] text-white hover:bg-white/15 hover:text-white transition-all active:scale-90"
                onClick={() => setViewStartDate(addDays(viewStartDate, 7))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center rounded-[14px] border border-white/15 bg-white/10 p-1 shadow-sm">
              {[7, 14, 30].map(val => (
                <Button 
                  key={val}
                  variant="none" 
                  size="sm" 
                  onClick={() => setDaysCount(val)}
                  className={`h-8 rounded-[11px] px-5 text-[10px] font-black transition-all ${daysCount === val ? 'bg-white text-primary shadow-sm' : 'text-white/60 hover:text-white'}`}
                >
                  {val}D
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "In progress", value: scheduleStats.inProgress, sub: "Running now", icon: Wrench, tone: "text-emerald-600", accent: "from-emerald-500 to-teal-400" },
          { label: "High priority", value: scheduleStats.highPriority, sub: "Needs attention", icon: Timer, tone: "text-amber-600", accent: "from-amber-400 to-rose-500" },
          { label: "Timeline view", value: `${daysCount}d`, sub: format(viewStartDate, "MMM yyyy"), icon: Calendar, tone: "text-primary", accent: "from-primary to-cyan-400" },
          { label: "Capacity rows", value: allWorkCenters.length, sub: "Including unassigned", icon: Layers, tone: "text-violet-600", accent: "from-violet-500 to-blue-500" },
        ].map((stat) => (
          <Card key={stat.label} className="overflow-hidden rounded-[12px] border border-border/70 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <div className={`h-1 bg-gradient-to-r ${stat.accent}`} />
            <CardContent className="p-6">
              <div className="mb-3 flex items-center gap-2">
                <stat.icon className={`h-3.5 w-3.5 ${stat.tone}`} />
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</h3>
              </div>
              <p className="text-4xl font-black tracking-tight text-foreground">{stat.value}</p>
              <p className="mt-2 text-sm font-medium text-muted-foreground">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="flex-1 overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
        <div className="h-1 bg-gradient-to-r from-primary via-cyan-400 to-emerald-400" />
        <div className="relative flex h-full flex-col overflow-hidden" ref={containerRef}>
          <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-5 py-4">
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground">Capacity timeline</h2>
              <p className="text-sm font-medium text-muted-foreground">Drag job bars to reschedule dates or move work centers.</p>
            </div>
            <Badge variant="secondary" className="rounded-[10px] px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              {format(viewStartDate, "MMM d")} - {format(addDays(viewStartDate, daysCount - 1), "MMM d")}
            </Badge>
          </div>

          <div className="sticky top-0 z-30 flex border-b border-border/60 bg-card/95 backdrop-blur-md">
            <div 
              style={{ width: SIDEBAR_WIDTH }} 
              className="flex shrink-0 items-center border-r border-border/60 p-5"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                {t("scheduling.workCenter")}
              </span>
            </div>
            <div className="flex overflow-hidden">
              {days.map((day) => (
                <div 
                  key={day.toISOString()} 
                  style={{ width: DAY_WIDTH }}
                  className={`flex shrink-0 flex-col justify-center border-r border-border/40 p-4 text-center transition-colors ${isToday(day) ? 'bg-primary/5' : ''}`}
                >
                  <span className={`mb-1 text-[9px] font-black uppercase tracking-widest ${isToday(day) ? 'text-primary' : 'text-muted-foreground'}`}>
                    {format(day, 'EEE')}
                  </span>
                  <div className="relative inline-flex flex-col items-center">
                    <span className={`text-xl font-black leading-none ${isToday(day) ? 'text-primary' : 'text-foreground'}`}>
                      {format(day, 'd')}
                    </span>
                    {isToday(day) && (
                      <div className="absolute -bottom-2 h-1 w-4 rounded-full bg-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grid Body */}
          <div className="flex-1 overflow-auto scrollbar-thin">
            <div className="relative flex min-h-full">
              {/* Sidebar Rows */}
              <div 
                style={{ width: SIDEBAR_WIDTH }} 
                className="sticky left-0 z-20 shrink-0 border-r border-border/60 bg-card/95 backdrop-blur-md"
              >
                {allWorkCenters.map((wc: any) => (
                  <div 
                    key={wc.code} 
                    style={{ height: ROW_HEIGHT }}
                    className="group flex cursor-default flex-col justify-center border-b border-border/50 p-5 transition-all hover:bg-muted/40"
                  >
                    <div className="text-xs font-black uppercase tracking-tight text-foreground transition-colors group-hover:text-primary">
                      {wc.name}
                    </div>
                    <div className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                      {wc.code}
                    </div>
                  </div>
                ))}
              </div>

              {/* Timeline Rows & Grid */}
              <div className="relative flex-1">
                {/* Vertical Grid Lines */}
                <div className="absolute inset-0 pointer-events-none flex">
                  {days.map((day) => (
                    <div 
                      key={day.toISOString()} 
                      style={{ width: DAY_WIDTH }} 
                      className={`h-full border-r border-border/30 ${isToday(day) ? 'bg-primary/[0.03]' : ''}`} 
                    />
                  ))}
                </div>

                {/* Horizontal Rows */}
                {allWorkCenters.map((wc: any) => (
                  <div 
                    key={wc.code} 
                    style={{ height: ROW_HEIGHT }}
                    className="group/row relative w-full border-b border-border/40"
                  >
                    <div className="pointer-events-none absolute inset-0 bg-primary/[0.03] opacity-0 transition-opacity group-hover/row:opacity-100" />
                    
                    {/* Jobs in this work center */}
                    {activeJobs.filter((j: any) => (j.workCenterCode || 'UNASSIGNED') === wc.code).map((job: any) => {
                        const style = getJobStyle(job);
                        const isOverdue = new Date(job.dueDate) < new Date() && job.status !== 'Completed';
                        
                        return (
                          <TooltipProvider key={job._id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <motion.div
                                  drag
                                  dragMomentum={false}
                                  dragElastic={0.05}
                                  onDragEnd={(_, info) => {
                                      const deltaX = info.offset.x;
                                      const deltaY = info.offset.y;
                                      const daysMoved = Math.round(deltaX / DAY_WIDTH);
                                      const rowsMoved = Math.round(deltaY / ROW_HEIGHT);
                                      const newStart = addDays(new Date(job.plannedStartDate || job.createdAt), daysMoved);
                                      const newEnd = addDays(new Date(job.dueDate), daysMoved);
                                      
                                      let newWcCode = job.workCenterCode;
                                      if (rowsMoved !== 0) {
                                          const currentIndex = allWorkCenters.findIndex(w => w.code === (job.workCenterCode || 'UNASSIGNED'));
                                          const newIndex = Math.max(0, Math.min(allWorkCenters.length - 1, currentIndex + rowsMoved));
                                          newWcCode = allWorkCenters[newIndex].code;
                                          if (newWcCode === 'UNASSIGNED') newWcCode = '';
                                      }

                                      if (daysMoved !== 0 || rowsMoved !== 0) {
                                          handleReschedule(job, newStart, newEnd, newWcCode);
                                      }
                                  }}
                                  initial={false}
                                  style={{
                                      position: 'absolute',
                                      top: 10,
                                      left: style.left,
                                      width: style.width,
                                      height: ROW_HEIGHT - 20,
                                      zIndex: 40,
                                      cursor: 'grab'
                                  }}
                                  whileHover={{ scale: 1.01, zIndex: 50, rotateX: 2, rotateY: 2 }}
                                  whileDrag={{ scale: 1.05, opacity: 0.9, cursor: 'grabbing', zIndex: 100, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
                                  className={`group/card flex flex-col justify-between overflow-hidden rounded-[14px] border p-3
                                    ${job.status === 'In Progress' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-primary/35 bg-primary/10'}
                                    ${job.priority === 'Urgent' ? 'ring-2 ring-rose-500 ring-offset-2 shadow-[0_16px_35px_-24px_rgba(244,63,94,0.6)]' : 'shadow-sm'}
                                    ${isOverdue ? 'border-rose-500/60' : ''}
                                    backdrop-blur-md transition-shadow hover:shadow-lg
                                  `}
                                >
                                  {/* Progress Glow Background */}
                                  {job.status === 'In Progress' && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent -translate-x-full group-hover/card:animate-shimmer pointer-events-none" />
                                  )}

                                  <div className="flex items-start justify-between gap-2 overflow-hidden relative">
                                    <div className="flex flex-col overflow-hidden">
                                      <div className="flex items-center gap-1.5 mb-0.5">
                                        <div className={`h-1.5 w-1.5 rounded-full ${job.status === 'In Progress' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'}`} />
                                        <span className="text-[9px] font-black uppercase tracking-tighter opacity-60 truncate">{job.jobId}</span>
                                      </div>
                                      <span className="truncate text-[11px] font-black uppercase leading-tight text-foreground">
                                        {job.bom?.product?.name || 'Untitled Process'}
                                      </span>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                      <span className="text-[10px] font-black leading-none text-foreground">{job.quantity}</span>
                                      <span className="text-[7px] font-black uppercase text-muted-foreground">Units</span>
                                    </div>
                                  </div>
                                   
                                  <div className="relative mt-auto flex items-end justify-between border-t border-border/30 pt-2">
                                      <div className="flex items-center gap-1">
                                        <div className={`rounded-[7px] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${
                                          job.priority === 'Urgent' ? 'bg-rose-500 text-white' : 
                                          job.priority === 'High' ? 'bg-amber-500 text-white' : 'bg-card text-foreground'
                                        }`}>
                                          {job.priority}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <Info className="h-2.5 w-2.5 opacity-40" />
                                        <span className="text-[8px] font-black uppercase tracking-tighter opacity-60">
                                            {format(new Date(job.dueDate), 'MMM d')}
                                        </span>
                                      </div>
                                  </div>
                                </motion.div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="min-w-[260px] overflow-hidden rounded-[16px] border border-border/70 bg-card p-0 shadow-xl">
                                <div className={`h-1.5 w-full ${job.priority === 'Urgent' ? 'bg-rose-500' : 'bg-primary'}`} />
                                <div className="p-4 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{job.jobId}</span>
                                    <Badge variant={job.priority === 'Urgent' ? 'destructive' : 'secondary'} className="rounded-[9px] px-2 py-0.5 text-[9px] font-black uppercase">
                                      {job.status}
                                    </Badge>
                                  </div>
                                  <h4 className="text-sm font-black leading-tight text-foreground">{job.bom?.product?.name}</h4>
                                  
                                  <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div className="rounded-[12px] bg-muted/30 p-2">
                                      <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Start Phase</p>
                                      <p className="text-[10px] font-bold">{format(new Date(job.plannedStartDate || job.createdAt), 'MMM d, yyyy')}</p>
                                    </div>
                                    <div className="rounded-[12px] bg-muted/30 p-2">
                                      <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Deadline</p>
                                      <p className="text-[10px] font-bold text-rose-600">{format(new Date(job.dueDate), 'MMM d, yyyy')}</p>
                                    </div>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {rescheduleMut.isPending && (
            <div className="absolute bottom-6 right-6 z-50 flex animate-in items-center gap-3 rounded-[14px] bg-foreground px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-background shadow-xl fade-in slide-in-from-bottom-10 duration-500">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Updating schedule...
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
