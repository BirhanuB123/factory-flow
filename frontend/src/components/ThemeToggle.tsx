import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSettings, mergeErpSettings } from "@/hooks/use-settings";

type ThemeToggleProps = {
  className?: string;
  /** When true, only the icon button is shown (e.g. collapsed sidebar). */
  compact?: boolean;
};

export function ThemeToggle({ className, compact }: ThemeToggleProps) {
  const { settings } = useSettings();
  const isDark = settings.darkMode;

  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const hint = isDark ? "Light mode" : "Dark mode";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className={
            compact
              ? className
              : ["h-9 gap-2 rounded-full px-3 font-medium text-muted-foreground hover:text-foreground", className].filter(Boolean).join(" ")
          }
          aria-label={label}
          aria-pressed={isDark}
          onClick={() => mergeErpSettings({ darkMode: !isDark })}
        >
          {isDark ? (
            <Sun className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <Moon className="h-4 w-4 shrink-0" aria-hidden />
          )}
          {!compact && <span className="hidden sm:inline">{hint}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{hint}</TooltipContent>
    </Tooltip>
  );
}
