import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ShieldCheck } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string, options: { rememberFor5m: boolean }) => Promise<void> | void;
  title?: string;
  description?: string;
};

export function PlatformStepUpDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Confirm sensitive platform action",
  description = "Re-enter your password to continue.",
}: Props) {
  const [password, setPassword] = useState("");
  const [rememberFor5m, setRememberFor5m] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setRememberFor5m(true);
      setSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!password.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(password, { rememberFor5m });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl bg-card/90 backdrop-blur-2xl px-8 pt-10 pb-8 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
        <DialogHeader className="space-y-4">
          <DialogTitle className="flex flex-col items-center gap-4 text-center sm:items-start sm:text-left">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <ShieldCheck className="h-8 w-8 stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-black tracking-tight uppercase italic block">{title}</span>
              <DialogDescription className="text-sm font-medium leading-relaxed">
                {description}
              </DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label htmlFor="platform-step-up-password" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 ml-1">Identity Verification</Label>
            <Input
              id="platform-step-up-password"
              type="password"
              placeholder="Enter administrative credentials..."
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              className="h-14 rounded-2xl bg-secondary/30 border-none px-6 font-mono text-lg focus:bg-background transition-all"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleConfirm();
                }
              }}
            />
          </div>
          <div className="flex items-center space-x-3 p-4 rounded-2xl bg-secondary/20 border border-border/10">
            <Checkbox
              id="platform-step-up-remember"
              checked={rememberFor5m}
              onCheckedChange={(v) => setRememberFor5m(Boolean(v))}
              disabled={submitting}
              className="rounded-md border-primary/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <label
              htmlFor="platform-step-up-remember"
              className="text-xs font-bold text-muted-foreground/80 leading-none cursor-pointer select-none"
            >
              Maintain authorization for 300 seconds (current session)
            </label>
          </div>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button 
            variant="ghost" 
            disabled={submitting} 
            onClick={() => onOpenChange(false)}
            className="h-12 rounded-xl font-bold uppercase text-xs tracking-widest flex-1 hover:bg-destructive/5 hover:text-destructive transition-colors"
          >
            Abort Action
          </Button>
          <Button 
            disabled={!password.trim() || submitting} 
            onClick={() => void handleConfirm()}
            className="h-12 rounded-xl bg-primary shadow-xl shadow-primary/20 font-black uppercase text-xs tracking-widest flex-1 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Authorize Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
