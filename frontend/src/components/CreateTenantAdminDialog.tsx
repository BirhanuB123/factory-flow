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
import { Loader2, Copy, Check } from "lucide-react";
import { PlatformStepUpDialog } from "@/components/PlatformStepUpDialog";

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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create tenant admin</DialogTitle>
          <DialogDescription>
            <strong>{tenantLabel}</strong> — choose how the user gets their first password.
          </DialogDescription>
        </DialogHeader>

        {!resultTempPassword && !resultInviteUrl ? (
          <>
            <Tabs
              value={mode}
              onValueChange={(v) => {
                setMode(v as OnboardingMode);
                setPassword("");
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3 h-auto gap-1">
                <TabsTrigger value="invite_link" className="text-xs px-2 py-2">
                  Invite link
                </TabsTrigger>
                <TabsTrigger value="temp_password" className="text-xs px-2 py-2">
                  Temp password
                </TabsTrigger>
                <TabsTrigger value="manual" className="text-xs px-2 py-2">
                  Manual
                </TabsTrigger>
              </TabsList>
              <TabsContent value="invite_link" className="mt-3 space-y-1 text-xs text-muted-foreground">
                Creates an account with a random password the user never sees. They open the link to set
                their own password. <strong>Email required.</strong> If <code>SMTP_HOST</code> is set, an
                email is sent; otherwise copy the link below after creation.
              </TabsContent>
              <TabsContent value="temp_password" className="mt-3 space-y-1 text-xs text-muted-foreground">
                Server generates a one-time password. Share it securely; the user must change it after login.
              </TabsContent>
              <TabsContent value="manual" className="mt-3 space-y-1 text-xs text-muted-foreground">
                You choose the initial password (legacy flow).
              </TabsContent>
            </Tabs>

            <div className="grid gap-3 py-2">
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="ADMIN-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email {mode === "invite_link" ? "(required)" : "(optional)"}</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                />
              </div>
              {mode === "manual" ? (
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              ) : null}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                disabled={!canSubmit || adminMut.isPending}
                onClick={() => setStepUpOpen(true)}
              >
                {adminMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-4 py-2">
            {resultTempPassword ? (
              <div className="space-y-2">
                <Label>Temporary password (copy now — not shown again)</Label>
                <div className="flex gap-2">
                  <Input readOnly className="font-mono text-sm" value={resultTempPassword} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      await navigator.clipboard.writeText(resultTempPassword);
                      setCopied("temp");
                      toast.success("Copied");
                    }}
                  >
                    {copied === "temp" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ) : null}
            {resultInviteUrl ? (
              <div className="space-y-2">
                <Label>Invite link (expires in 7 days by default)</Label>
                <div className="flex gap-2">
                  <Input readOnly className="font-mono text-xs" value={resultInviteUrl} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      await navigator.clipboard.writeText(resultInviteUrl);
                      setCopied("url");
                      toast.success("Copied");
                    }}
                  >
                    {copied === "url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button
                onClick={() => {
                  handleClose(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
      <PlatformStepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        title="Confirm admin creation"
        description="Re-enter your password to create a tenant admin."
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
