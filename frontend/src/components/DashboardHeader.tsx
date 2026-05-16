import { useState, useEffect, useRef } from "react";
import { Search, Bell, Settings as SettingsIcon, LogOut, User, Shield, AlertTriangle, CheckCircle2, Loader2, Info, Plus, ShoppingCart, Factory, Package } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DynamicBreadcrumbs } from "@/components/DynamicBreadcrumbs";
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

  const getBaseUrl = () => API_BASE_URL.replace(/\/api\/?$/, '');
  const avatarUrl = user?.profilePicture ? `${getBaseUrl()}${user.profilePicture}` : undefined;

  const getInitials = (name?: string | null) => {
    if (!name || typeof name !== 'string') return "??";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return "??";
    
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    
    const first = parts[0][0] || "";
    const last = parts[parts.length - 1][0] || "";
    return (first + last).toUpperCase();
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
    <header className="sticky top-0 z-50 flex min-h-[4.25rem] min-w-0 shrink-0 items-center gap-2 border-b border-slate-200/60 bg-slate-50/90 px-3 py-2 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-950/90 lg:gap-4 lg:px-6">
      <SidebarTrigger className="shrink-0 text-slate-500 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50 rounded-md" />
      <div className="hidden md:block">
        <DynamicBreadcrumbs />
      </div>
      <div className="relative flex min-w-0 flex-1 justify-center">
        <div className="relative w-full max-w-2xl flex items-center">
          <div className="flex w-full items-center rounded-full bg-slate-100 px-2 py-1.5 dark:bg-slate-900 transition-shadow focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white dark:focus-within:bg-slate-950 shadow-sm border border-transparent focus-within:border-blue-500/10">
            <Input
              ref={searchInputRef}
              placeholder={t("header.searchPlaceholder")}
              className="h-8 flex-1 border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim().length > 1 && setShowSearch(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim().length > 1) performSearch();
              }}
            />
            <div className="flex items-center gap-2 pr-1">
              <span
                className="hidden items-center gap-0.5 rounded border border-slate-200/60 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500 xl:inline-flex"
                aria-hidden
              >
                <kbd className="font-sans">Ctrl</kbd>
                <kbd className="font-sans">K</kbd>
              </span>
              <Button
                type="button"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                aria-label={t("header.searchAria")}
                onClick={() => {
                  if (searchQuery.trim().length > 1) performSearch();
                  else searchInputRef.current?.focus();
                }}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {showSearch && (
            <div className="absolute left-0 top-full z-50 mt-2 max-h-[400px] w-full overflow-y-auto rounded-2xl border border-slate-200/60 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider dark:text-slate-500">
                  {t("header.searchResults")}
                </span>
                {isSearching && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                <button 
                  onClick={() => setShowSearch(false)}
                  className="text-[10px] text-blue-600 hover:underline dark:text-blue-400"
                >
                  {t("common.close")}
                </button>
              </div>
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  {isSearching ? t("header.searching") : t("header.noResults")}
                </div>
              ) : (
                <div className="grid gap-1">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      className="flex flex-col items-start w-full px-3 py-2 text-left rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                      onClick={() => {
                        navigate(result.link);
                        setSearchQuery("");
                        setShowSearch(false);
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{result.title}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium uppercase ml-auto dark:bg-blue-900/20 dark:text-blue-400">
                          {result.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">{result.subtitle}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-2 lg:flex">
        <Button
          variant="ghost"
          className="rounded-full font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100"
          onClick={() => navigate("/production")}
        >
          {t("header.listOfAssets")}
        </Button>
        <Button
          variant="outline"
          className="rounded-full border-slate-200 px-5 font-medium text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => navigate("/production")}
        >
          {t("header.addAsset")}
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-2 ml-2">
        <ThemeToggle className="hover:bg-slate-200/50 dark:hover:bg-slate-800/50" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40">
              <Plus className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">Quick Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer py-2 rounded-md" onClick={() => navigate("/orders")}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              <span>New Order</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer py-2 rounded-md" onClick={() => navigate("/production")}>
              <Factory className="mr-2 h-4 w-4" />
              <span>Start Job</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer py-2 rounded-md" onClick={() => navigate("/inventory")}>
              <Package className="mr-2 h-4 w-4" />
              <span>Add Stock</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 text-slate-500 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50 rounded-full">
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute right-2.5 top-2 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75 dark:bg-red-400" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 dark:bg-red-400" />
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 rounded-xl" align="end">
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-sm">
                {t("header.notifications")}
                {unreadCount > 0 && ` (${unreadCount})`}
              </h3>
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-blue-600 hover:underline font-medium dark:text-blue-400"
                >
                  {t("header.markAllRead")}
                </button>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  {t("header.noNotifications")}
                </div>
              ) : (
                notifications.map((n) => {
                  const uiTheme = getNotificationIcon(n.type);
                  return (
                    <div 
                      key={n._id} 
                      onClick={() => handleMarkAsRead(n._id, n.isRead)}
                      className={`flex gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 text-sm ${!n.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${uiTheme.color}`}>
                        {uiTheme.icon}
                      </div>
                      <div className="space-y-1 w-full">
                        <div className="flex justify-between items-start">
                          <p className={`font-medium leading-none ${!n.isRead ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                            {n.title}
                          </p>
                          {!n.isRead && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 z-10 dark:bg-blue-400" />}
                        </div>
                        <p className="text-xs text-slate-500 leading-snug dark:text-slate-400">{n.description}</p>
                        <p className="text-[10px] text-slate-400 pt-1 dark:text-slate-500">
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
            <Button variant="ghost" className="flex h-10 items-center gap-3 rounded-full p-1 pl-3 hover:bg-slate-200/50 dark:hover:bg-slate-800/50">
              <div className="hidden text-right md:flex md:flex-col">
                <span className="text-sm font-semibold leading-none text-slate-800 dark:text-slate-200">{user?.name || settings.displayName}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {user?.platformRole === "super_admin" ? "Platform Super Admin" : (user?.role || settings.role)}
                </span>
              </div>
              <span className="relative inline-flex">
                <Avatar className="h-9 w-9 border border-slate-200 shadow-sm dark:border-slate-700">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={user?.name || "User"} className="object-cover" />}
                  <AvatarFallback className="bg-slate-200 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {getInitials(user?.name || settings.displayName || "User")}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-slate-950"
                  title={t("header.online")}
                  aria-hidden
                />
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 rounded-xl" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name || settings.displayName}</p>
                <p className="text-xs leading-none text-slate-500 dark:text-slate-400">{user?.email || settings.shopEmail}</p>
              </div>
            </DropdownMenuLabel>
            {user?.platformRole === "super_admin" ? (
              <>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500 pt-2 dark:text-slate-400">
                  {t("header.companyContextApi")}
                </DropdownMenuLabel>
                <div className="px-2 pb-2">
                  <TenantContextSelect variant="menu" />
                </div>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer rounded-md" onClick={() => navigate("/profile")}>
              <User className="mr-2 h-4 w-4" />
              <span>{t("header.profile")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer rounded-md" onClick={() => navigate("/settings")}>
              <SettingsIcon className="mr-2 h-4 w-4" />
              <span>{t("header.settings")}</span>
            </DropdownMenuItem>
            {user?.platformRole === "super_admin" ? (
              <DropdownMenuItem className="cursor-pointer rounded-md" onClick={() => navigate("/platform")}>
                <Shield className="mr-2 h-4 w-4" />
                <span>{t("header.platformAdmin")}</span>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-red-600 focus:bg-red-50 dark:text-red-400 dark:focus:bg-red-900/10 cursor-pointer rounded-md"
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
