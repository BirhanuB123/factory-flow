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
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("scheduling.title")}</h1>
          <p className="text-muted-foreground">{t("scheduling.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setViewStartDate(subDays(viewStartDate, 7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setViewStartDate(startOfDay(new Date()))}>
            {t("scheduling.today")}
          </Button>
          <Button variant="outline" size="icon" onClick={() => setViewStartDate(addDays(viewStartDate, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-4 flex items-center bg-muted rounded-lg p-1">
            <Button 
                variant={daysCount === 7 ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setDaysCount(7)}
            >
                7d
            </Button>
            <Button 
                variant={daysCount === 14 ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setDaysCount(14)}
            >
                14d
            </Button>
            <Button 
                variant={daysCount === 30 ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setDaysCount(30)}
            >
                30d
            </Button>
          </div>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden border-none shadow-erp-lg bg-background/50 backdrop-blur-sm">
        <div className="relative flex flex-col h-full overflow-hidden" ref={containerRef}>
          {/* Header */}
          <div className="flex border-b bg-muted/30 sticky top-0 z-20">
            <div 
              style={{ width: SIDEBAR_WIDTH }} 
              className="shrink-0 border-r p-4 font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center"
            >
              {t("scheduling.workCenter")}
            </div>
            <div className="flex overflow-hidden">
              {days.map((day) => (
                <div 
                  key={day.toISOString()} 
                  style={{ width: DAY_WIDTH }}
                  className={`shrink-0 border-r p-2 text-center flex flex-col justify-center ${isToday(day) ? 'bg-primary/5' : ''}`}
                >
                  <span className={`text-[10px] font-black uppercase tracking-tighter ${isToday(day) ? 'text-primary' : 'text-muted-foreground'}`}>
                    {format(day, 'EEE')}
                  </span>
                  <span className={`text-lg font-black leading-none ${isToday(day) ? 'text-primary' : ''}`}>
                    {format(day, 'd')}
                  </span>
                  <span className="text-[9px] opacity-40 uppercase font-bold">{format(day, 'MMM')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grid Body */}
          <div className="flex-1 overflow-auto">
            <div className="relative flex min-h-full">
              {/* Sidebar Rows */}
              <div 
                style={{ width: SIDEBAR_WIDTH }} 
                className="shrink-0 border-r bg-muted/10 sticky left-0 z-10"
              >
                {allWorkCenters.map((wc: any) => (
                  <div 
                    key={wc.code} 
                    style={{ height: ROW_HEIGHT }}
                    className="border-b p-4 flex flex-col justify-center gap-1 group hover:bg-muted/20 transition-colors"
                  >
                    <div className="font-bold text-sm tracking-tight group-hover:text-primary transition-colors">{wc.name}</div>
                    <div className="text-[10px] font-mono opacity-50 uppercase tracking-widest">{wc.code}</div>
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
                      className={`h-full border-r ${isToday(day) ? 'bg-primary/[0.02]' : ''}`} 
                    />
                  ))}
                </div>

                {/* Horizontal Rows */}
                {allWorkCenters.map((wc: any) => (
                  <div 
                    key={wc.code} 
                    style={{ height: ROW_HEIGHT }}
                    className="border-b w-full relative"
                  >
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
                                  dragElastic={0.1}
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
                                      top: 12,
                                      left: style.left,
                                      width: style.width,
                                      height: ROW_HEIGHT - 24,
                                      zIndex: 30,
                                      cursor: 'grab'
                                  }}
                                  whileHover={{ scale: 1.02, zIndex: 40 }}
                                  whileDrag={{ scale: 1.05, opacity: 0.8, cursor: 'grabbing', zIndex: 50 }}
                                  className={`rounded-xl border shadow-xl p-3 flex flex-col justify-between overflow-hidden group
                                    ${job.status === 'In Progress' ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-blue-500/20 border-blue-500/30'}
                                    ${job.priority === 'Urgent' ? 'ring-2 ring-rose-500 ring-offset-2' : ''}
                                    ${isOverdue ? 'border-rose-500/50' : ''}
                                    backdrop-blur-md
                                  `}
                                >
                                  <div className="flex items-start justify-between gap-2 overflow-hidden">
                                    <div className="flex flex-col overflow-hidden">
                                      <span className="text-[10px] font-black uppercase tracking-tighter opacity-70 truncate">{job.jobId}</span>
                                      <span className="text-xs font-bold truncate leading-tight">{job.bom?.product?.name || 'Job'}</span>
                                    </div>
                                    <Badge variant="outline" className="text-[8px] h-4 px-1 font-black bg-background/50 border-none shrink-0">
                                      {job.quantity}
                                    </Badge>
                                  </div>
                                  
                                  <div className="flex items-center justify-between mt-auto">
                                      <div className="flex -space-x-1">
                                          <div className={`h-1.5 w-1.5 rounded-full ${job.status === 'In Progress' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
                                      </div>
                                      <span className="text-[8px] font-mono font-bold opacity-40 uppercase">
                                          {format(new Date(job.dueDate), 'MMM d')}
                                      </span>
                                  </div>

                                  {/* Resize handle (Visual only for now, logic could be added) */}
                                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary/20 opacity-0 group-hover:opacity-100 cursor-ew-resize" />
                                </motion.div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="p-3 max-w-xs bg-popover/90 backdrop-blur-md border-primary/20 shadow-erp-xl">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between font-bold text-sm">
                                    <span>{job.jobId}</span>
                                    <Badge variant={job.priority === 'Urgent' ? 'destructive' : 'secondary'} className="text-[10px] uppercase font-black">
                                      {job.priority}
                                    </Badge>
                                  </div>
                                  <div className="text-xs opacity-80">{job.bom?.product?.name}</div>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] border-t pt-2">
                                    <div className="flex flex-col">
                                      <span className="opacity-50 uppercase font-black tracking-widest">Start</span>
                                      <span className="font-bold">{format(new Date(job.plannedStartDate || job.createdAt), 'MMM d, yyyy')}</span>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="opacity-50 uppercase font-black tracking-widest">Due</span>
                                      <span className="font-bold">{format(new Date(job.dueDate), 'MMM d, yyyy')}</span>
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
            <div className="absolute bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs font-black uppercase tracking-widest animate-in slide-in-from-bottom-4">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("scheduling.saving")}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
