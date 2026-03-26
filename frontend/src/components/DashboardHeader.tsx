import { useState, useEffect, useRef } from "react";
import { Search, Bell, Settings as SettingsIcon, LogOut, User, Shield, AlertTriangle, CheckCircle2, Loader2, Info } from "lucide-react";
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
import { useNavigate } from "react-router-dom";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/contexts/AuthContext";
import { SuperTenantSwitcher, TenantContextSelect } from "@/components/SuperTenantSwitcher";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { getApiBaseUrl } from "@/lib/apiBase";

const API_BASE_URL = getApiBaseUrl();

interface NotificationData {
  _id: string;
  title: string;
  description: string;
  type: 'info' | 'warning' | 'success' | 'error';
  isRead: boolean;
  createdAt: string;
}

export function DashboardHeader() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { user, token, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Notifications State
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (token) {
      fetchNotifications();
      // Poll every 60 seconds
      const intervalId = setInterval(fetchNotifications, 60000);
      return () => clearInterval(intervalId);
    }
  }, [token]);

  const fetchNotifications = async () => {
    const t = localStorage.getItem("erp_token") || token;
    if (!t) return;
    try {
      const response = await fetch(`${API_BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (response.status === 401) {
        localStorage.removeItem("erp_token");
        localStorage.removeItem("erp_user");
        if (!window.location.pathname.startsWith("/login")) {
          window.location.assign("/login");
        }
        return;
      }
      const data = await response.json();
      if (data.success) {
        setNotifications(data.data);
        setUnreadCount(data.data.filter((n: NotificationData) => !n.isRead).length);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  const handleMarkAsRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
        toast.success("All notifications marked as read");
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast.error("Failed to update notifications");
    }
  };

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

  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      const typingInField =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        t?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        if (searchQuery.trim().length > 1) setShowSearch(true);
        return;
      }

      if (e.key === "Escape" && showSearch) {
        if (!typingInField || t === searchInputRef.current) {
          e.preventDefault();
          setShowSearch(false);
        }
      }
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, [searchQuery, showSearch]);

  const performSearch = async () => {
    setIsSearching(true);
    setShowSearch(true);
    try {
      const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning': return { icon: <AlertTriangle className="h-4 w-4 text-warning" />, color: "bg-warning/10" };
      case 'error': return { icon: <AlertTriangle className="h-4 w-4 text-destructive" />, color: "bg-destructive/10" };
      case 'success': return { icon: <CheckCircle2 className="h-4 w-4 text-success" />, color: "bg-success/10" };
      case 'info':
      default: return { icon: <Info className="h-4 w-4 text-primary" />, color: "bg-primary/10" };
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b px-4 lg:px-6 bg-card sticky top-0 z-30">
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <SidebarTrigger className="text-muted-foreground" />
        <div className="relative hidden sm:block w-full">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search jobs, inventory, clients…"
            className="w-full pl-9 pr-16 h-9 bg-secondary border-0 text-sm focus-visible:ring-1 focus-visible:ring-primary/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.trim().length > 1 && setShowSearch(true)}
          />
          <span
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded border bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            aria-hidden
          >
            <kbd className="font-sans">Ctrl</kbd>
            <kbd className="font-sans">K</kbd>
          </span>
          
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
              {unreadCount > 0 && (
                <span className="absolute right-2 top-2 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b flex justify-between items-center">
              <h3 className="font-semibold text-sm">Notifications {unreadCount > 0 && `(${unreadCount})`}</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => {
                  const uiTheme = getNotificationIcon(n.type);
                  return (
                    <div 
                      key={n._id} 
                      onClick={() => handleMarkAsRead(n._id, n.isRead)}
                      className={`flex gap-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer border-b last:border-0 text-sm ${!n.isRead ? 'bg-primary/5' : ''}`}
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${uiTheme.color}`}>
                        {uiTheme.icon}
                      </div>
                      <div className="space-y-1 w-full">
                        <div className="flex justify-between items-start">
                          <p className={`font-medium leading-none ${!n.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {n.title}
                          </p>
                          {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0 z-10" />}
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug">{n.description}</p>
                        <p className="text-[10px] text-muted-foreground pt-1">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
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
            {user?.platformRole === "super_admin" ? (
              <>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground pt-2">
                  Company context (API)
                </DropdownMenuLabel>
                <div className="px-2 pb-2">
                  <TenantContextSelect variant="menu" />
                </div>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/profile")}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/settings")}>
              <SettingsIcon className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            {user?.platformRole === "super_admin" ? (
              <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/platform")}>
                <Shield className="mr-2 h-4 w-4" />
                <span>Platform admin</span>
              </DropdownMenuItem>
            ) : null}
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
