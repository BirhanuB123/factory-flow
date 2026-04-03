import { useState, useEffect, useRef } from "react";
import { Search, Bell, Settings as SettingsIcon, LogOut, User, Shield, AlertTriangle, CheckCircle2, Loader2, Info } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
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
import { useLocale } from "@/contexts/LocaleContext";
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
  const { t } = useLocale();
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
        toast.success(t("header.toastAllRead"));
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast.error(t("header.toastNotifyFail"));
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
    toast.success(t("header.toastLoggedOut"));
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
    <header className="sticky top-0 z-30 flex min-h-[4.25rem] items-center gap-2 border-b border-border/60 bg-background/95 px-3 py-2 backdrop-blur-md lg:gap-4 lg:px-5">
      <SidebarTrigger className="shrink-0 text-muted-foreground" />
      <div className="relative flex min-w-0 flex-1 justify-center">
        <div className="relative w-full max-w-2xl">
          <Input
            ref={searchInputRef}
            placeholder={t("header.searchPlaceholder")}
            className="h-11 w-full rounded-full border-0 bg-muted/80 pl-4 pr-14 text-sm shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary/25 dark:bg-muted/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.trim().length > 1 && setShowSearch(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery.trim().length > 1) performSearch();
            }}
          />
          <Button
            type="button"
            size="icon"
            className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            aria-label={t("header.searchAria")}
            onClick={() => {
              if (searchQuery.trim().length > 1) performSearch();
              else searchInputRef.current?.focus();
            }}
          >
            <Search className="h-4 w-4" />
          </Button>
          <span
            className="pointer-events-none absolute right-14 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-border/60 bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground xl:inline-flex"
            aria-hidden
          >
            <kbd className="font-sans">Ctrl</kbd>
            <kbd className="font-sans">K</kbd>
          </span>
          {showSearch && (
            <div className="absolute left-0 top-full z-50 mt-2 max-h-[400px] w-full overflow-y-auto rounded-2xl border border-border/60 bg-card p-2 shadow-erp">
              <div className="flex items-center justify-between px-2 py-1 mb-1 border-b">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("header.searchResults")}
                </span>
                {isSearching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                <button 
                  onClick={() => setShowSearch(false)}
                  className="text-[10px] text-primary hover:underline"
                >
                  {t("common.close")}
                </button>
              </div>
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {isSearching ? t("header.searching") : t("header.noResults")}
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

      <div className="hidden shrink-0 items-center gap-1 lg:flex">
        <Button
          variant="ghost"
          className="rounded-full font-medium text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/production")}
        >
          {t("header.listOfAssets")}
        </Button>
        <Button
          variant="outline"
          className="rounded-full border-primary/20 px-5 font-medium text-foreground shadow-erp-sm hover:bg-accent/60"
          onClick={() => navigate("/production")}
        >
          {t("header.addAsset")}
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
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
              <h3 className="font-semibold text-sm">
                {t("header.notifications")}
                {unreadCount > 0 && ` (${unreadCount})`}
              </h3>
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  {t("header.markAllRead")}
                </button>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {t("header.noNotifications")}
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
            <Button variant="ghost" className="flex h-10 items-center gap-2 rounded-full p-1 pl-2 hover:bg-secondary/80">
              <div className="hidden text-right md:mr-1 md:flex md:flex-col">
                <span className="text-xs font-semibold leading-none">{user?.name || settings.displayName}</span>
                <span className="text-[10px] text-muted-foreground">{user?.role || settings.role}</span>
              </div>
              <span className="relative inline-flex">
                <Avatar className="h-9 w-9 border border-border/60 shadow-erp-sm">
                  <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">
                    {getInitials(user?.name || settings.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[hsl(152,69%,45%)] ring-2 ring-background"
                  title={t("header.online")}
                  aria-hidden
                />
              </span>
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
                  {t("header.companyContextApi")}
                </DropdownMenuLabel>
                <div className="px-2 pb-2">
                  <TenantContextSelect variant="menu" />
                </div>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/profile")}>
              <User className="mr-2 h-4 w-4" />
              <span>{t("header.profile")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/settings")}>
              <SettingsIcon className="mr-2 h-4 w-4" />
              <span>{t("header.settings")}</span>
            </DropdownMenuItem>
            {user?.platformRole === "super_admin" ? (
              <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/platform")}>
                <Shield className="mr-2 h-4 w-4" />
                <span>{t("header.platformAdmin")}</span>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive focus:bg-destructive/10 cursor-pointer"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t("header.logOut")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
