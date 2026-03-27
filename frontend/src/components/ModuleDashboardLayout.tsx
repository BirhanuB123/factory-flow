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
    <div className={`space-y-10 pb-10 animate-in fade-in slide-in-from-top-4 duration-700 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="h-10 w-1.5 shrink-0 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
            <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase italic leading-none">
              {title}
            </h1>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Icon className="h-6 w-6 stroke-[2.5]" aria-hidden />
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground/80 max-w-2xl leading-relaxed ml-5">
            {description}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-6 shrink-0">
          {healthStats && healthStats.length > 0 && (
            <div className="hidden lg:flex items-center gap-8 px-8 py-4 bg-card/40 backdrop-blur-xl rounded-[2rem] border border-border/10 shadow-2xl shadow-black/5">
              {healthStats.map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <div className="h-10 w-px bg-border/20" />}
                  <div className="text-right space-y-0.5">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/50">
                      {s.label}
                    </p>
                    <p
                      className={`text-base font-mono font-black tracking-tight ${s.accent ?? "text-foreground/90"}`}
                    >
                      {s.value}
                    </p>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            {actions}
          </div>
        </div>
      </div>
      <div className="relative">
        <div className="absolute -top-6 left-0 w-full h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
        {children}
      </div>
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
