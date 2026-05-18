import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      expand={true}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background/95 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-border/40 group-[.toaster]:shadow-[0_8px_30px_rgb(0,0,0,0.08)] group-[.toaster]:rounded-xl group-[.toaster]:pl-5 group-[.toaster]:pr-10 group-[.toaster]:py-4 group-[.toaster]:border group-[.toaster]:flex group-[.toaster]:items-center group-[.toaster]:gap-3 group-[.toaster]:transition-all",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm font-medium",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-full group-[.toast]:h-8 group-[.toast]:px-4 group-[.toast]:text-xs group-[.toast]:font-bold group-[.toast]:shadow-sm group-[.toast]:hover:opacity-90 transition-opacity",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-full group-[.toast]:h-8 group-[.toast]:px-4 group-[.toast]:text-xs group-[.toast]:font-bold group-[.toast]:hover:bg-muted/80 transition-colors",
          success: "group-[.toaster]:!bg-white group-[.toaster]:!text-[#0f172a] group-[.toaster]:!border-emerald-500/20 dark:group-[.toaster]:!bg-[#0f172a] dark:group-[.toaster]:!text-slate-100 dark:group-[.toaster]:!border-emerald-500/20 group-[.toaster]:!shadow-[0_8px_30px_rgba(16,185,129,0.1)]",
          error: "group-[.toaster]:!bg-white group-[.toaster]:!text-[#0f172a] group-[.toaster]:!border-red-500/20 dark:group-[.toaster]:!bg-[#0f172a] dark:group-[.toaster]:!text-slate-100 dark:group-[.toaster]:!border-red-500/20 group-[.toaster]:!shadow-[0_8px_30px_rgba(239,68,68,0.1)]",
          warning: "group-[.toaster]:!bg-white group-[.toaster]:!text-[#0f172a] group-[.toaster]:!border-amber-500/20 dark:group-[.toaster]:!bg-[#0f172a] dark:group-[.toaster]:!text-slate-100 dark:group-[.toaster]:!border-amber-500/20 group-[.toaster]:!shadow-[0_8px_30px_rgba(245,158,11,0.1)]",
          info: "group-[.toaster]:!bg-white group-[.toaster]:!text-[#0f172a] group-[.toaster]:!border-blue-500/20 dark:group-[.toaster]:!bg-[#0f172a] dark:group-[.toaster]:!text-slate-100 dark:group-[.toaster]:!border-blue-500/20 group-[.toaster]:!shadow-[0_8px_30px_rgba(59,130,246,0.1)]",
          closeButton: "group-[.toast]:!absolute group-[.toast]:!right-2 group-[.toast]:!top-1/2 group-[.toast]:!-translate-y-1/2 group-[.toast]:!left-auto group-[.toast]:!bg-transparent group-[.toast]:!text-muted-foreground hover:group-[.toast]:!bg-muted hover:group-[.toast]:!text-foreground group-[.toast]:!border-none group-[.toast]:!rounded-md group-[.toast]:!h-7 group-[.toast]:!w-7 group-[.toast]:!flex group-[.toast]:!items-center group-[.toast]:!justify-center group-[.toast]:!transition-colors",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
