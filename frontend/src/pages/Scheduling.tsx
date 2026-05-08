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
  Info,
  Maximize2,
  Minimize2,
  Loader2
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
    <div className="flex flex-col h-full space-y-6 pb-6 animate-in fade-in duration-1000">
      {/* High-Tech Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-white p-8 shadow-erp-sm border border-white/40">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-primary/5 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-48 w-48 rounded-full bg-blue-500/5 blur-2xl" />
        
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner">
              <Calendar className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[#1a2744] uppercase italic">
                {t("scheduling.title")}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">
                  Manufacturing Orchestration
                </p>
                <div className="h-1 w-1 rounded-full bg-primary/40" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  {format(viewStartDate, 'MMMM yyyy')}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-muted/30 p-1 rounded-full border border-muted-foreground/5 backdrop-blur-sm">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-full hover:bg-white transition-all active:scale-90"
                onClick={() => setViewStartDate(subDays(viewStartDate, 7))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                className="h-9 px-6 rounded-full font-black uppercase text-[10px] tracking-widest hover:bg-white transition-all active:scale-95"
                onClick={() => setViewStartDate(startOfDay(new Date()))}
              >
                {t("scheduling.today")}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-full hover:bg-white transition-all active:scale-90"
                onClick={() => setViewStartDate(addDays(viewStartDate, 7))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center bg-[#1a2744] p-1 rounded-full shadow-erp-sm border border-white/10">
              {[7, 14, 30].map(val => (
                <Button 
                  key={val}
                  variant="none" 
                  size="sm" 
                  onClick={() => setDaysCount(val)}
                  className={`h-8 px-5 rounded-full text-[10px] font-black transition-all ${daysCount === val ? 'bg-white text-[#1a2744] shadow-sm' : 'text-white/60 hover:text-white'}`}
                >
                  {val}D
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden border-none shadow-erp-lg bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-white/60">
        <div className="relative flex flex-col h-full overflow-hidden" ref={containerRef}>
          {/* Futuristic Timeline Header */}
          <div className="flex border-b border-white/60 bg-white/60 sticky top-0 z-30 backdrop-blur-md">
            <div 
              style={{ width: SIDEBAR_WIDTH }} 
              className="shrink-0 border-r border-white/60 p-6 flex items-center"
            >
              <span className="font-black text-[10px] uppercase tracking-[0.3em] text-[#1a2744] opacity-40">
                {t("scheduling.workCenter")}
              </span>
            </div>
            <div className="flex overflow-hidden">
              {days.map((day) => (
                <div 
                  key={day.toISOString()} 
                  style={{ width: DAY_WIDTH }}
                  className={`shrink-0 border-r border-white/20 p-4 text-center flex flex-col justify-center transition-colors ${isToday(day) ? 'bg-primary/5' : ''}`}
                >
                  <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isToday(day) ? 'text-primary' : 'text-muted-foreground opacity-60'}`}>
                    {format(day, 'EEE')}
                  </span>
                  <div className="relative inline-flex flex-col items-center">
                    <span className={`text-xl font-black leading-none tracking-tighter ${isToday(day) ? 'text-primary' : 'text-[#1a2744]'}`}>
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
                className="shrink-0 border-r border-white/60 bg-white/20 sticky left-0 z-20 backdrop-blur-md"
              >
                {allWorkCenters.map((wc: any) => (
                  <div 
                    key={wc.code} 
                    style={{ height: ROW_HEIGHT }}
                    className="border-b border-white/60 p-6 flex flex-col justify-center group hover:bg-white/40 transition-all cursor-default"
                  >
                    <div className="font-black text-xs tracking-tight text-[#1a2744] group-hover:text-primary transition-colors uppercase">
                      {wc.name}
                    </div>
                    <div className="text-[9px] font-black opacity-30 uppercase tracking-[0.2em] mt-1">
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
                      className={`h-full border-r border-white/10 ${isToday(day) ? 'bg-primary/[0.01]' : ''}`} 
                    />
                  ))}
                </div>

                {/* Horizontal Rows */}
                {allWorkCenters.map((wc: any) => (
                  <div 
                    key={wc.code} 
                    style={{ height: ROW_HEIGHT }}
                    className="border-b border-white/20 w-full relative group/row"
                  >
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/row:opacity-100 transition-opacity pointer-events-none" />
                    
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
                                  className={`rounded-2xl border p-3 flex flex-col justify-between overflow-hidden group/card
                                    ${job.status === 'In Progress' ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-blue-500/20 border-blue-500/40'}
                                    ${job.priority === 'Urgent' ? 'ring-2 ring-rose-500 ring-offset-2 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'shadow-erp-md'}
                                    ${isOverdue ? 'border-rose-500/60' : ''}
                                    backdrop-blur-md transition-shadow
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
                                      <span className="text-[11px] font-black truncate leading-tight text-[#1a2744] uppercase tracking-tighter">
                                        {job.bom?.product?.name || 'Untitled Process'}
                                      </span>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                      <span className="text-[10px] font-black text-[#1a2744] leading-none">{job.quantity}</span>
                                      <span className="text-[7px] font-black uppercase opacity-40">Units</span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-end justify-between mt-auto relative pt-2 border-t border-black/5">
                                      <div className="flex items-center gap-1">
                                        <div className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest ${
                                          job.priority === 'Urgent' ? 'bg-rose-500 text-white' : 
                                          job.priority === 'High' ? 'bg-amber-500 text-white' : 'bg-white/50 text-[#1a2744]'
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
                              <TooltipContent side="top" className="p-0 overflow-hidden border-none shadow-erp-xl rounded-2xl bg-white min-w-[240px]">
                                <div className={`h-1.5 w-full ${job.priority === 'Urgent' ? 'bg-rose-500' : 'bg-primary'}`} />
                                <div className="p-4 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{job.jobId}</span>
                                    <Badge variant={job.priority === 'Urgent' ? 'destructive' : 'secondary'} className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                                      {job.status}
                                    </Badge>
                                  </div>
                                  <h4 className="text-sm font-black text-[#1a2744] leading-tight">{job.bom?.product?.name}</h4>
                                  
                                  <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div className="p-2 rounded-xl bg-muted/30">
                                      <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Start Phase</p>
                                      <p className="text-[10px] font-bold">{format(new Date(job.plannedStartDate || job.createdAt), 'MMM d, yyyy')}</p>
                                    </div>
                                    <div className="p-2 rounded-xl bg-muted/30">
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
            <div className="absolute bottom-6 right-6 bg-[#1a2744] text-white px-6 py-3 rounded-full shadow-erp-xl flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] animate-in slide-in-from-bottom-10 fade-in duration-500 z-50">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Synchronizing Ledger...
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
