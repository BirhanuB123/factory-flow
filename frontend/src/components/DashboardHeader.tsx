import { useState, useEffect } from "react";
import { Search, Bell, Settings as SettingsIcon, LogOut, User, Package, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
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
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://localhost:5000/api";

export function DashboardHeader() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

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

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 1) {
        performSearch();
      } else {
        setSearchResults([]);
        setShowSearch(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const performSearch = async () => {
    setIsSearching(true);
    setShowSearch(true);
    try {
      const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.data);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <header className="flex h-14 items-center justify-between border-b px-4 lg:px-6 bg-card sticky top-0 z-30">
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <SidebarTrigger className="text-muted-foreground" />
        <div className="relative hidden sm:block w-full">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search jobs, inventory, clients..."
            className="w-full pl-9 h-9 bg-secondary border-0 text-sm focus-visible:ring-1 focus-visible:ring-primary/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.trim().length > 1 && setShowSearch(true)}
          />
          
          {showSearch && (
            <div className="absolute top-full left-0 w-full mt-1 bg-card border rounded-md shadow-lg p-2 max-h-[400px] overflow-y-auto z-50">
              <div className="flex items-center justify-between px-2 py-1 mb-1 border-b">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Search Results</span>
                {isSearching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                <button 
                  onClick={() => setShowSearch(false)}
                  className="text-[10px] text-primary hover:underline"
                >
                  Close
                </button>
              </div>
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {isSearching ? "Searching..." : "No results found"}
                </div>
              ) : (
                <div className="grid gap-1">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      className="flex flex-col items-start w-full px-3 py-2 text-left rounded-sm hover:bg-muted transition-colors"
                      onClick={() => {
                        navigate(result.link);
                        setSearchQuery("");
                        setShowSearch(false);
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className="text-xs font-semibold">{result.title}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium uppercase ml-auto">
                          {result.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{result.subtitle}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
              <div className="hidden md:flex flex-col items-end mr-1 text-right">
                <span className="text-xs font-semibold leading-none">{user?.name || settings.displayName}</span>
                <span className="text-[10px] text-muted-foreground">{user?.role || settings.role}</span>
              </div>
              <Avatar className="h-7 w-7 border shadow-sm">
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                  {getInitials(user?.name || settings.displayName)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name || settings.displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email || settings.shopEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/profile")}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/settings")}>
              <SettingsIcon className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive focus:bg-destructive/10 cursor-pointer"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
