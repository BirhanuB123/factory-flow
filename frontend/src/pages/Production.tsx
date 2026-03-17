import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductionJobs from "./ProductionJobs";
import Boms from "./Boms";
import Orders from "./Orders";
import Clients from "./Clients";
import Inventory from "./Inventory";
import { Factory, Wrench, FileStack, Package, ShoppingCart, Users } from "lucide-react";

const Production = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-8 w-1 bg-primary rounded-full" />
          <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">Production Management</h1>
          <Factory className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm font-medium text-muted-foreground max-w-2xl">
          Complete control over shop floor operations, manufacturing processes, and product lifecycle management.
        </p>
      </div>

      <Tabs defaultValue="jobs" className="space-y-6">
        <div className="sticky top-[57px] z-20 bg-background/80 backdrop-blur-md pb-4 pt-1 border-b mb-6">
          <TabsList className="bg-secondary/50 border p-1 h-auto flex-wrap gap-1 rounded-xl">
            <TabsTrigger value="jobs" className="gap-2 px-6 py-2.5 rounded-lg transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg shadow-primary/20">
              <Wrench className="h-4 w-4" />
              <span className="font-bold tracking-tight">Processes (Jobs)</span>
            </TabsTrigger>
            <TabsTrigger value="boms" className="gap-2 px-6 py-2.5 rounded-lg transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg shadow-primary/20">
              <FileStack className="h-4 w-4" />
              <span className="font-bold tracking-tight">Products (BOMs)</span>
            </TabsTrigger>
            <TabsTrigger value="materials" className="gap-2 px-6 py-2.5 rounded-lg transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg shadow-primary/20">
              <Package className="h-4 w-4" />
              <span className="font-bold tracking-tight">Raw Materials</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2 px-6 py-2.5 rounded-lg transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg shadow-primary/20">
              <ShoppingCart className="h-4 w-4" />
              <span className="font-bold tracking-tight">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-2 px-6 py-2.5 rounded-lg transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg shadow-primary/20">
              <Users className="h-4 w-4" />
              <span className="font-bold tracking-tight">Clients</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="jobs" className="space-y-4 border-none p-0 outline-none">
          <ProductionJobs />
        </TabsContent>
        
        <TabsContent value="boms" className="space-y-4 border-none p-0 outline-none">
          <Boms />
        </TabsContent>

        <TabsContent value="materials" className="space-y-4 border-none p-0 outline-none">
          <Inventory initialCategory="Raw Metal" />
        </TabsContent>

        <TabsContent value="orders" className="space-y-4 border-none p-0 outline-none">
          <Orders />
        </TabsContent>

        <TabsContent value="clients" className="space-y-4 border-none p-0 outline-none">
          <Clients />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Production;
