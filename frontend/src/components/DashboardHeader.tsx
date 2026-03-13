import { Search, Bell, Settings, LogOut, User, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate, Link } from "react-router-dom";

export function DashboardHeader() {
  const navigate = useNavigate();

  const notifications = [
    {
      id: 1,
      title: "Low Stock Alert",
      description: "Aluminum Sheet 2024 is below reorder point.",
      time: "10m ago",
      icon: <AlertTriangle className="h-4 w-4 text-warning" />,
      color: "bg-warning/10"
    },
    {
      id: 2,
      title: "New Production Job",
      description: "JOB-1052 created for Client A.",
      time: "1h ago",
      icon: <Package className="h-4 w-4 text-primary" />,
      color: "bg-primary/10"
    },
    {
      id: 3,
      title: "Job Completed",
      description: "JOB-1048 has been successfully finished.",
      time: "3h ago",
      icon: <CheckCircle2 className="h-4 w-4 text-success" />,
      color: "bg-success/10"
    }
  ];

  return (
    <header className="flex h-14 items-center justify-between border-b px-4 lg:px-6 bg-card">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground" />
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search jobs, parts, clients..."
            className="w-64 pl-9 h-9 bg-secondary border-0 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute right-2 top-2 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm">Notifications</h3>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.map((n) => (
                <div key={n.id} className="flex gap-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer border-b last:border-0 text-sm">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${n.color}`}>
                    {n.icon}
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium leading-none">{n.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{n.description}</p>
                    <p className="text-[10px] text-muted-foreground pt-1">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-2 border-t">
              <Button variant="ghost" className="w-full text-xs h-8 text-primary" onClick={() => navigate("/notifications")}>
                View all notifications
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-9 p-1 pl-2 hover:bg-secondary">
              <div className="hidden md:flex flex-col items-end mr-1">
                <span className="text-xs font-medium leading-none">Paul Mitchell</span>
                <span className="text-[10px] text-muted-foreground">Production Mgr</span>
              </div>
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                  PM
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/profile")}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
