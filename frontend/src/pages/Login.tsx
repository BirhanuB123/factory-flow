import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Shield, Sparkles } from "lucide-react";
import { LoadingLogo } from "@/components/ui/LoadingLogo";
import { getApiBaseUrl } from "@/lib/apiBase";

export default function Login() {
  const [emailOrId, setEmailOrId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailOrId || !password) {
      toast.error(t("auth.errorFillAll"));
      return;
    }

    setIsLoading(true);

    const apiBase = getApiBaseUrl();
    if (import.meta.env.PROD && /localhost|127\.0\.0\.1/.test(apiBase)) {
      toast.error(t("auth.errorApiNotConfigured"));
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailOrId.includes("@") ? emailOrId : undefined,
          employeeId: !emailOrId.includes("@") ? emailOrId : undefined,
          password,
        }),
      });

      const raw = await response.text();
      let data: Record<string, unknown> = {};

      if (raw) {
        try {
          data = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          toast.error(t("auth.errorBadApiResponse"));
          return;
        }
      }

      if (response.ok) {
        toast.success(t("auth.successLogin"));
        login(data, data.token as string);
        if ((data as { mustChangePassword?: boolean }).mustChangePassword) {
          navigate("/account/change-password", { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      } else {
        toast.error((data.message as string) || t("auth.errorInvalid"));
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error(t("auth.errorNetwork"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(135deg,hsl(222_47%_9%),hsl(221_68%_18%)_46%,hsl(190_75%_30%))]">
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden p-8 text-white lg:flex lg:flex-col xl:p-12">
          <img src="/erp-login2.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-28" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(8,18,38,0.98),rgba(17,39,79,0.86)_48%,rgba(9,112,129,0.78))]" aria-hidden />

          <div className="relative z-10 mt-auto max-w-3xl lg:pb-12">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-white/70 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t("auth.heroKicker")}
            </div>
            <h2 className="max-w-2xl text-5xl font-black leading-[0.98] tracking-tight text-white xl:text-6xl">
              {t("auth.heroTitle")}
            </h2>
            <p className="mt-5 max-w-xl text-lg font-semibold leading-8 text-white/68">
              {t("auth.heroSubtitle")}
            </p>
          </div>

          
        </section>

        <section className="relative flex min-h-screen items-center justify-center bg-background/96 px-5 py-8 sm:px-8 lg:bg-card/95">
          <div className="absolute inset-x-0 top-0 " aria-hidden />
          <div className="w-full max-w-[460px]">
            <div className="mb-8 flex justify-center">
              <div className="overflow-hidden rounded-[28px] bg-background/90 p-4 shadow-sm shadow-slate-950/10">
                <img src="/integra-logo.png" alt="Integra logo" className="h-auto w-full max-w-[340px] object-contain" />
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background shadow-[0_24px_70px_-46px_rgba(15,23,42,0.65)]">
              <div className="" />
              <div className="p-6 sm:p-8">
                <div className="mb-7">
                  
                  <h1 className="text-4xl font-black tracking-tight text-foreground">Welcome Back!</h1>
                  
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="emailOrId" className="text-sm font-bold">
                      {t("auth.emailOrId")}
                    </Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        id="emailOrId"
                        name="username"
                        autoComplete="username"
                        placeholder={t("auth.emailOrIdPlaceholder")}
                        value={emailOrId}
                        onChange={(e) => setEmailOrId(e.target.value)}
                        required
                        className="h-12 rounded-[12px] border-border/70 bg-muted/30 pl-10 text-base shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-bold">
                      {t("auth.password")}
                    </Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder={t("auth.passwordPlaceholder")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-12 rounded-[12px] border-border/70 bg-muted/30 pl-10 pr-11 text-base shadow-sm transition-all placeholder:text-muted-foreground/50 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/30"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-[12px] text-base font-black shadow-md transition-all hover:shadow-lg hover:shadow-primary/15"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <LoadingLogo size={20} />
                        {t("auth.signingIn")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {t("auth.signIn")}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </span>
                    )}
                  </Button>
                </form>


                <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  <span>{t("auth.sessionNote")}</span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
