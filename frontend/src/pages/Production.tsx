import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductionJobs from "./ProductionJobs";
import Boms from "./Boms";
import Orders from "./Orders";
import Clients from "./Clients";
import Inventory from "./Inventory";
import { Wrench, FileStack, Package, ShoppingCart, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/LocaleContext";

const tabTriggerClass =
  "gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm";

const Production = () => {
  const { t } =useLocale();
  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#1a2744]">{t("production.title")}</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{t("production.subtitle")}</p>
      </div>

      <Tabs defaultValue="jobs" className="space-y-6">
        <div className="sticky top-0 z-20 -mx-1 rounded-2xl border border-border/60 bg-white/90 px-2 py-2 shadow-erp-sm backdrop-blur-md">
          <TabsList className="flex h-auto w-full flex-wrap gap-1 rounded-full bg-muted/45 p-1 md:inline-flex md:w-auto">
            <TabsTrigger value="jobs" className={cn(tabTriggerClass)}>
              <Wrench className="h-4 w-4 shrink-0" />
              <span>{t("production.tabJobs")}</span>
            </TabsTrigger>
            <TabsTrigger value="boms" className={cn(tabTriggerClass)}>
              <FileStack className="h-4 w-4 shrink-0" />
              <span>{t("production.tabBoms")}</span>
            </TabsTrigger>
            <TabsTrigger value="materials" className={cn(tabTriggerClass)}>
              <Package className="h-4 w-4 shrink-0" />
              <span>{t("production.tabMaterials")}</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className={cn(tabTriggerClass)}>
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span>{t("production.tabOrders")}</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className={cn(tabTriggerClass)}>
              <Users className="h-4 w-4 shrink-0" />
              <span>{t("production.tabClients")}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="jobs" className="space-y-4 border-none p-0 outline-none focus-visible:outline-none">
          <ProductionJobs embedded />
        </TabsContent>

        <TabsContent value="boms" className="space-y-4 border-none p-0 outline-none focus-visible:outline-none">
          <Boms embedded />
        </TabsContent>

        <TabsContent value="materials" className="space-y-4 border-none p-0 outline-none focus-visible:outline-none">
          <Inventory initialCategory="Raw Metal" embedded />
        </TabsContent>

        <TabsContent value="orders" className="space-y-4 border-none p-0 outline-none focus-visible:outline-none">
          <Orders embedded />
        </TabsContent>

        <TabsContent value="clients" className="space-y-4 border-none p-0 outline-none focus-visible:outline-none">
          <Clients embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Production;
