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
            "group toast group-[.toaster]:bg-background/90 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-border/60 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-[var(--radius)] group-[.toaster]:px-5 group-[.toaster]:py-3.5 group-[.toaster]:border group-[.toaster]:flex group-[.toaster]:items-center group-[.toaster]:gap-3",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs font-medium",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-full group-[.toast]:h-8 group-[.toast]:px-4 group-[.toast]:text-xs group-[.toast]:font-bold group-[.toast]:shadow-sm group-[.toast]:hover:opacity-90 transition-opacity",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-full group-[.toast]:h-8 group-[.toast]:px-4 group-[.toast]:text-xs group-[.toast]:font-bold group-[.toast]:hover:bg-muted/80 transition-colors",
          success: "group-[.toaster]:!bg-white group-[.toaster]:!text-[#0f172a] group-[.toaster]:!border-emerald-500/30 dark:group-[.toaster]:!bg-[#1a2744] dark:group-[.toaster]:!text-white dark:group-[.toaster]:!border-emerald-500/20",
          error: "group-[.toaster]:!bg-white group-[.toaster]:!text-[#0f172a] group-[.toaster]:!border-red-500/30 dark:group-[.toaster]:!bg-[#1a2744] dark:group-[.toaster]:!text-white dark:group-[.toaster]:!border-red-500/20",
          warning: "group-[.toaster]:!bg-white group-[.toaster]:!text-[#0f172a] group-[.toaster]:!border-amber-500/30 dark:group-[.toaster]:!bg-[#1a2744] dark:group-[.toaster]:!text-white dark:group-[.toaster]:!border-amber-500/20",
          info: "group-[.toaster]:!bg-white group-[.toaster]:!text-[#0f172a] group-[.toaster]:!border-blue-500/30 dark:group-[.toaster]:!bg-[#1a2744] dark:group-[.toaster]:!text-white dark:group-[.toaster]:!border-blue-500/20",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
