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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="platform-step-up-password">Password</Label>
          <Input
            id="platform-step-up-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleConfirm();
              }
            }}
          />
        </div>
        <label
          htmlFor="platform-step-up-remember"
          className="flex items-start gap-2 text-sm text-muted-foreground select-none"
        >
          <Checkbox
            id="platform-step-up-remember"
            checked={rememberFor5m}
            onCheckedChange={(v) => setRememberFor5m(Boolean(v))}
            disabled={submitting}
          />
          <span>Remember this step-up for 5 minutes (current browser session).</span>
        </label>
        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!password.trim() || submitting} onClick={() => void handleConfirm()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
