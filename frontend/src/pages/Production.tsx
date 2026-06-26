import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductionJobs from "./ProductionJobs";
import Boms from "./Boms";
import Orders from "./Orders";
import Clients from "./Clients";
import Inventory from "./Inventory";
import { useQuery } from "@tanstack/react-query";
import { bomApi, inventoryApi, ordersApi, productionApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Factory,
  FileStack,
  Layers,
  Package,
  ShoppingCart,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/LocaleContext";

const tabTriggerClass =
  "gap-2 rounded-[12px] px-4 py-2.5 text-sm font-bold text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm";

const Production = () => {
  const { t } = useLocale();

  const { data: jobs = [] } = useQuery({
    queryKey: ["productions"],
    queryFn: productionApi.getAll,
  });
  const { data: boms = [] } = useQuery({
    queryKey: ["boms"],
    queryFn: bomApi.getAll,
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: inventoryApi.getAll,
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: ordersApi.getAll,
  });

  const productionJobs = jobs as Array<{ status?: string; progress?: number; priority?: string }>;
  const activeJobs = productionJobs.filter((job) => ["Scheduled", "In Progress", "On Hold"].includes(job.status || "")).length;
  const inProgressJobs = productionJobs.filter((job) => job.status === "In Progress").length;
  const completedJobs = productionJobs.filter((job) => job.status === "Completed").length;
  const blockedJobs = productionJobs.filter((job) => job.status === "On Hold" || job.priority === "High").length;
  const avgProgress = productionJobs.length
    ? Math.round(productionJobs.reduce((sum, job) => sum + (Number(job.progress) || 0), 0) / productionJobs.length)
    : 0;
  const lowMaterials = (inventory as Array<{ stock?: number; reorderPoint?: number }>).filter(
    (item) => Number(item.stock || 0) <= Number(item.reorderPoint || 0)
  ).length;
  const openOrders = (orders as Array<{ status?: string }>).filter((order) => !["completed", "cancelled"].includes(String(order.status || "").toLowerCase())).length;

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-500">
      <div className="overflow-hidden rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(190_75%_34%))] text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)] dark:border-white/10">
        <div className="p-5 sm:p-7">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-white/55">
              <Factory className="h-4 w-4" />
              Production control center
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{t("production.title")}</h1>
            <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-white/60 sm:text-lg">
              {t("production.subtitle")}
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Active jobs", value: String(activeJobs), tone: "text-emerald-300" },
                { label: "In progress", value: String(inProgressJobs), tone: "text-amber-300" },
                { label: "BOMs ready", value: String((boms as unknown[]).length), tone: "text-sky-200" },
              ].map((item) => (
                <div key={item.label} className="rounded-[16px] border border-white/20 bg-white/[0.08] p-5 backdrop-blur">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-white/45">{item.label}</p>
                  <p className={`mt-2 text-3xl font-black tracking-tight ${item.tone}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Output complete",
            value: String(completedJobs),
            sub: "Jobs finished",
            icon: CheckCircle2,
            tone: "text-emerald-600",
          },
          {
            label: "Avg progress",
            value: `${avgProgress}%`,
            sub: "Across job queue",
            icon: BarChart3,
            tone: "text-muted-foreground",
          },
          {
            label: "Material alerts",
            value: String(lowMaterials),
            sub: "Need review",
            icon: AlertTriangle,
            tone: lowMaterials > 0 ? "text-destructive" : "text-muted-foreground",
          },
          {
            label: "Open demand",
            value: String(openOrders),
            sub: "Sales orders",
            icon: Layers,
            tone: "text-muted-foreground",
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            className="overflow-hidden rounded-[12px] border border-border/70 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <CardContent className="p-6">
              <div className="mb-3 flex items-center gap-2">
                <stat.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</h3>
              </div>
              <p className="text-4xl font-black tracking-tight text-foreground">{stat.value}</p>
              <p className={`mt-2 text-sm font-medium ${stat.tone}`}>{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {blockedJobs > 0 && (
        <Card className="overflow-hidden rounded-[16px] border border-amber-500/30 bg-card shadow-sm">
          <div className="h-1 bg-gradient-to-r from-amber-400/80 to-rose-500/70" />
          <CardContent className="flex flex-col gap-3 bg-amber-50/80 p-4 dark:bg-amber-500/10 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="font-black text-amber-900 dark:text-amber-200">{blockedJobs} jobs need attention</p>
                <p className="text-sm text-amber-800/75 dark:text-amber-100/70">High priority or on-hold work should be reviewed before scheduling more load.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="clients" className="space-y-6">
        <div className="sticky top-0 z-20 -mx-1 rounded-[18px] border border-border/60 bg-card/90 px-2 py-2 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.45)] backdrop-blur-md">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-[16px] bg-muted/35 p-1.5 md:inline-flex md:w-auto">
            <TabsTrigger value="clients" className={cn(tabTriggerClass)}>
              <Users className="h-4 w-4 shrink-0" />
              <span>{t("production.tabClients")}</span>
            </TabsTrigger>
            <TabsTrigger value="materials" className={cn(tabTriggerClass)}>
              <Package className="h-4 w-4 shrink-0" />
              <span>{t("production.tabMaterials")}</span>
            </TabsTrigger>
            <TabsTrigger value="boms" className={cn(tabTriggerClass)}>
              <FileStack className="h-4 w-4 shrink-0" />
              <span>{t("production.tabBoms")}</span>
            </TabsTrigger>
            <TabsTrigger value="jobs" className={cn(tabTriggerClass)}>
              <Wrench className="h-4 w-4 shrink-0" />
              <span>{t("production.tabJobs")}</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className={cn(tabTriggerClass)}>
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span>{t("production.tabOrders")}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="clients" className="space-y-4 border-none p-0 outline-none focus-visible:outline-none">
          <Clients embedded />
        </TabsContent>

        <TabsContent value="materials" className="space-y-4 border-none p-0 outline-none focus-visible:outline-none">
          <Inventory initialCategory="Raw Metal" embedded />
        </TabsContent>

        <TabsContent value="boms" className="space-y-4 border-none p-0 outline-none focus-visible:outline-none">
          <Boms embedded />
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4 border-none p-0 outline-none focus-visible:outline-none">
          <ProductionJobs embedded />
        </TabsContent>

        <TabsContent value="orders" className="space-y-4 border-none p-0 outline-none focus-visible:outline-none">
          <Orders embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Production;
