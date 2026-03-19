import type { LucideIcon } from "lucide-react";
import * as React from "react";

export type ModuleHealthStat = { label: string; value: string; accent?: string };

type ModuleDashboardLayoutProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Right-side primary actions (e.g. CTA buttons) */
  actions?: React.ReactNode;
  /** Optional status strip (matches home dashboard) */
  healthStats?: ModuleHealthStat[];
  children: React.ReactNode;
  className?: string;
};

/**
 * Shared hero + spacing for module pages (Production-style).
 */
export function ModuleDashboardLayout({
  title,
  description,
  icon: Icon,
  actions,
  healthStats,
  children,
  className = "",
}: ModuleDashboardLayoutProps) {
  return (
    <div className={`space-y-8 pb-8 animate-in fade-in duration-700 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="h-8 w-1 shrink-0 bg-primary rounded-full" />
            <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">
              {title}
            </h1>
            <Icon className="h-6 w-6 shrink-0 text-primary" aria-hidden />
          </div>
          <p className="text-sm font-medium text-muted-foreground max-w-2xl">
            {description}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
          {healthStats && healthStats.length > 0 && (
            <div className="hidden lg:flex items-center gap-6 px-6 py-3 bg-secondary/50 rounded-2xl backdrop-blur-sm border border-border/50">
              {healthStats.map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <div className="h-8 w-px bg-border" />}
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                      {s.label}
                    </p>
                    <p
                      className={`text-sm font-mono font-bold ${s.accent ?? "text-foreground"}`}
                    >
                      {s.value}
                    </p>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
          {actions}
        </div>
      </div>
      {children}
    </div>
  );
}

const tabsListClass =
  "bg-secondary/50 border p-1 h-auto flex-wrap gap-1 rounded-xl w-full justify-start md:w-auto";

const tabsTriggerClass =
  "gap-2 px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg shadow-primary/20 font-bold tracking-tight text-xs sm:text-sm";

type StickyModuleTabsProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Sticky tab bar matching Production Management.
 */
export function StickyModuleTabs({ children, className = "" }: StickyModuleTabsProps) {
  return (
    <div
      className={`sticky top-[57px] z-20 bg-background/80 backdrop-blur-md pb-4 pt-1 border-b border-border/60 mb-6 -mx-0.5 px-0.5 ${className}`}
    >
      {children}
    </div>
  );
}

export function moduleTabsListClassName() {
  return tabsListClass;
}

export function moduleTabsTriggerClassName() {
  return tabsTriggerClass;
}
