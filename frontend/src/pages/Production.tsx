import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductionJobs from "./ProductionJobs";
import Boms from "./Boms";
import Orders from "./Orders";
import Clients from "./Clients";
import Inventory from "./Inventory";
import { Factory, Wrench, FileStack, Package, ShoppingCart, Users } from "lucide-react";

const Production = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Production Management</h1>
        <p className="text-muted-foreground">
          Manage products, raw materials, processes, and related sales operations.
        </p>
      </div>

      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList className="bg-background border p-1 h-auto flex-wrap gap-1">
          <TabsTrigger value="jobs" className="gap-2 px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Wrench className="h-4 w-4" />
            <span>Processes (Jobs)</span>
          </TabsTrigger>
          <TabsTrigger value="boms" className="gap-2 px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileStack className="h-4 w-4" />
            <span>Products (BOMs)</span>
          </TabsTrigger>
          <TabsTrigger value="materials" className="gap-2 px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Package className="h-4 w-4" />
            <span>Raw Materials</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2 px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ShoppingCart className="h-4 w-4" />
            <span>Orders</span>
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-2 px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="h-4 w-4" />
            <span>Clients</span>
          </TabsTrigger>
        </TabsList>

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
