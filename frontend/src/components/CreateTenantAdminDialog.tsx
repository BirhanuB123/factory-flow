import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api, { rememberPlatformStepUpPassword, setNextPlatformStepUpPassword } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Copy, Check, UserPlus, Link2, Key, Mail, ShieldCheck, Zap } from "lucide-react";
import { PlatformStepUpDialog } from "@/components/PlatformStepUpDialog";
import { Badge } from "@/components/ui/badge";

export type OnboardingMode = "manual" | "temp_password" | "invite_link";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantLabel: string;
  onSuccess?: () => void;
};

export function CreateTenantAdminDialog({
  open,
  onOpenChange,
  tenantId,
  tenantLabel,
  onSuccess,
}: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<OnboardingMode>("invite_link");
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resultTempPassword, setResultTempPassword] = useState<string | null>(null);
  const [resultInviteUrl, setResultInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<"temp" | "url" | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);

  const resetForm = () => {
    setEmployeeId("");
    setName("");
    setEmail("");
    setPassword("");
    setResultTempPassword(null);
    setResultInviteUrl(null);
    setCopied(null);
  };

  const adminMut = useMutation({
    mutationFn: () => {
      const body: {
        employeeId: string;
        name: string;
        email?: string;
        password?: string;
        role?: string;
        onboardingMode: OnboardingMode;
      } = {
        employeeId: employeeId.trim(),
        name: name.trim(),
        role: "Admin",
        onboardingMode: mode,
      };
      if (mode === "manual") {
        body.password = password;
      }
      if (mode === "invite_link" || email.trim()) {
        body.email = email.trim().toLowerCase();
      }
      return api.post(`/platform/tenants/${tenantId}/admin`, body).then((r) => r.data);
    },
    onSuccess: (res: {
      success?: boolean;
      temporaryPassword?: string;
      invite?: { url: string; emailed: boolean; emailError?: string };
      data?: { onboardingMode?: string };
    }) => {
      const emailed = res.invite?.emailed;
      if (res.temporaryPassword) {
        setResultTempPassword(res.temporaryPassword);
        setResultInviteUrl(null);
        toast.success("Admin created — copy the temporary password (shown once).");
      } else if (res.invite?.url) {
        setResultInviteUrl(res.invite.url);
        setResultTempPassword(null);
        if (emailed) {
          toast.success("Invite link sent by email (if SMTP is configured).");
        } else {
          toast.success("Admin created — copy the invite link for the user.");
        }
        if (res.invite.emailError) {
          toast.warning("Email not sent", { description: res.invite.emailError });
        }
      } else {
        toast.success("Tenant admin created");
        onOpenChange(false);
        resetForm();
      }
      qc.invalidateQueries({ queryKey: ["platform-tenant", tenantId] });
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
      qc.invalidateQueries({ queryKey: ["platform-metrics"] });
      onSuccess?.();
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not create admin";
      toast.error(msg);
    },
  });

  const handleClose = (v: boolean) => {
    if (!v) {
      resetForm();
      setMode("invite_link");
    }
    onOpenChange(v);
  };

  const canSubmit =
    employeeId.trim() &&
    name.trim() &&
    (mode !== "manual" || password.trim()) &&
    (mode !== "invite_link" || email.trim().includes("@"));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-0 rounded-[2.5rem] border-none bg-background/80 backdrop-blur-2xl shadow-2xl overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
        <DialogHeader className="pt-10 px-10">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight italic flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            Personnel Provisioning
          </DialogTitle>
          <DialogDescription className="text-sm font-medium pt-2">
            Initiating administrative node creation for <span className="font-black text-foreground italic">{tenantLabel}</span>. Select authorization protocol.
          </DialogDescription>
        </DialogHeader>

        {!resultTempPassword && !resultInviteUrl ? (
          <div className="px-10 py-6 space-y-10">
            <Tabs
              value={mode}
              onValueChange={(v) => {
                setMode(v as OnboardingMode);
                setPassword("");
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3 bg-secondary/30 p-1.5 rounded-2xl h-14 border border-border/10">
                <TabsTrigger value="invite_link" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-xl transition-all h-full">
                  Invite Link
                </TabsTrigger>
                <TabsTrigger value="temp_password" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-xl transition-all h-full">
                  One-Time Auth
                </TabsTrigger>
                <TabsTrigger value="manual" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-xl transition-all h-full">
                  Direct Set
                </TabsTrigger>
              </TabsList>
              <div className="mt-6 p-5 bg-primary/5 rounded-2xl border border-primary/10 animate-in fade-in slide-in-from-top-4 duration-500">
                <TabsContent value="invite_link" className="m-0 text-[11px] font-bold text-muted-foreground/80 leading-relaxed uppercase tracking-wide flex items-center gap-3">
                  <Link2 className="h-4 w-4 text-primary shrink-0" />
                  Generates an async authorization vector. User must configure their own credentials.
                </TabsContent>
                <TabsContent value="temp_password" className="m-0 text-[11px] font-bold text-muted-foreground/80 leading-relaxed uppercase tracking-wide flex items-center gap-3">
                  <Key className="h-4 w-4 text-primary shrink-0" />
                  Server assigns a transient cryptographic token. Immediate rotation required post-auth.
                </TabsContent>
                <TabsContent value="manual" className="m-0 text-[11px] font-bold text-muted-foreground/80 leading-relaxed uppercase tracking-wide flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                  Manual credential injection. Legacy administrative protocol.
                </TabsContent>
              </div>
            </Tabs>

            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/40 ml-1 italic">Biological Identifier</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Birhanu Bogale"
                  className="h-14 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-bold text-sm px-6 shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/40 ml-1 italic">System ID</Label>
                <Input
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="ADMIN-001"
                  className="h-14 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-mono text-sm px-6 shadow-sm uppercase italic"
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/40 ml-1 italic">Communication Node {mode === "invite_link" ? "(Required)" : "(Optional)"}</Label>
                <div className="relative">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="h-14 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-bold text-sm px-6 pl-14 shadow-sm"
                  />
                  <Mail className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 opacity-20 text-primary" />
                </div>
              </div>
              {mode === "manual" ? (
                <div className="sm:col-span-2 space-y-2 animate-in fade-in zoom-in-95 duration-300">
                  <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/40 ml-1 italic">Initial Secret Key</Label>
                  <div className="relative">
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="h-14 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-mono text-lg px-6 pl-14 shadow-sm"
                    />
                    <Zap className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 opacity-20 text-primary" />
                  </div>
                </div>
              ) : null}
            </div>

            <DialogFooter className="bg-secondary/20 -mx-10 px-10 py-10 flex gap-4 sm:justify-center border-t border-border/10">
              <Button variant="ghost" onClick={() => handleClose(false)} className="rounded-xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-background h-14 px-10 border border-border/10 shadow-sm transition-all h-14">
                Abort
              </Button>
              <Button
                disabled={!canSubmit || adminMut.isPending}
                onClick={() => setStepUpOpen(true)}
                className="rounded-xl font-black text-[10px] uppercase tracking-[0.3em] bg-primary text-primary-foreground shadow-2xl shadow-primary/20 h-14 px-10 hover:scale-[1.05] transition-all"
              >
                {adminMut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Authorize Provisioning"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="px-10 py-8 space-y-10 animate-in zoom-in-95 duration-500">
            <div className="flex flex-col items-center justify-center py-10 space-y-4 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2">
                <Check className="h-8 w-8 stroke-[3]" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight italic">Succession Confirmed</h3>
              <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">Administrative node injected into the cluster</p>
            </div>

            {resultTempPassword ? (
              <div className="space-y-4">
                <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/40 ml-1 italic">Transient Auth Token (Copy Now)</Label>
                <div className="flex gap-3">
                  <Input readOnly className="h-14 rounded-2xl bg-secondary/30 border-border/10 font-mono text-lg px-6 shadow-inner text-primary" value={resultTempPassword} />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 w-14 rounded-2xl border-border/10 bg-background hover:bg-secondary/50 transition-all shadow-sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(resultTempPassword);
                      setCopied("temp");
                      toast.success("Copied to clipboard");
                    }}
                  >
                    {copied === "temp" ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            ) : null}
            {resultInviteUrl ? (
              <div className="space-y-4">
                <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/40 ml-1 italic">Invitation Vector (Expires in 168h)</Label>
                <div className="flex gap-3">
                  <Input readOnly className="h-14 rounded-2xl bg-secondary/30 border-border/10 font-mono text-xs px-6 shadow-inner text-primary" value={resultInviteUrl} />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 w-14 rounded-2xl border-border/10 bg-background hover:bg-secondary/50 transition-all shadow-sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(resultInviteUrl);
                      setCopied("url");
                      toast.success("Copied to clipboard");
                    }}
                  >
                    {copied === "url" ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            ) : null}
            <DialogFooter className="bg-secondary/20 -mx-10 px-10 py-10 flex sm:justify-center border-t border-border/10">
              <Button
                className="w-full h-16 rounded-2xl bg-emerald-500 text-white shadow-2xl shadow-emerald-500/20 font-black text-[10px] uppercase tracking-[0.3em] hover:scale-[1.02] transition-all border-none"
                onClick={() => {
                  handleClose(false);
                }}
              >
                Close Registry Entry
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
      <PlatformStepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        title="Verify Administrative Intent"
        description="Re-authenticate to finalize the injection of a new organizational admin."
        onConfirm={async (password, options) => {
          setNextPlatformStepUpPassword(password);
          if (options.rememberFor5m) {
            rememberPlatformStepUpPassword(password);
          }
          await adminMut.mutateAsync();
        }}
      />
    </Dialog>
  );
}
