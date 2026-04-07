import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, Loader2, Shield } from 'lucide-react';

import { getApiBaseUrl } from '@/lib/apiBase';

export default function Login() {
  const [emailOrId, setEmailOrId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrId || !password) {
      toast.error(t('auth.errorFillAll'));
      return;
    }

    setIsLoading(true);

    const apiBase = getApiBaseUrl();
    if (import.meta.env.PROD && /localhost|127\.0\.0\.1/.test(apiBase)) {
      toast.error(t('auth.errorApiNotConfigured'));
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: emailOrId.includes('@') ? emailOrId : undefined,
          employeeId: !emailOrId.includes('@') ? emailOrId : undefined,
          password
        }),
      });

      const raw = await response.text();
      let data: Record<string, unknown> = {};
      if (raw) {
        try {
          data = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          toast.error(t('auth.errorBadApiResponse'));
          return;
        }
      }

      if (response.ok) {
        toast.success(t('auth.successLogin'));
        login(data, data.token as string);
        if ((data as { mustChangePassword?: boolean }).mustChangePassword) {
          navigate('/account/change-password', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      } else {
        toast.error((data.message as string) || t('auth.errorInvalid'));
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(t('auth.errorNetwork'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen overflow-hidden bg-background">
      {/* Left: hero (desktop) */}
      <div className="relative hidden lg:flex lg:w-[62.5%] flex-col justify-end overflow-hidden px-12 py-14 xl:px-16 xl:py-16 text-white">
        <div className="absolute inset-0 bg-primary/15 z-10" aria-hidden />
        <img
          //src="/login-bg.png"
          src="/erp-login2.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[12s] ease-out hover:scale-105"
        />
        {/* Layered scrims for readable type on any photo */}
        <div
          className="absolute inset-0 z-20 bg-gradient-to-t from-background via-background/75 to-transparent"
          aria-hidden
        />
        <div
          className="absolute inset-0 z-[21] bg-gradient-to-r from-black/55 via-black/25 to-transparent"
          aria-hidden
        />

        <div className="relative z-30 mb-6 max-w-xl animate-in fade-in slide-in-from-bottom-6 duration-1000 fill-mode-both delay-200">
          <div className="mb-6 inline-flex rounded-2xl border border-white/15 bg-white/10 p-3.5 shadow-lg backdrop-blur-md">
            <Building2 className="h-9 w-9 text-white" aria-hidden />
          </div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
            {t("auth.heroKicker")}
          </p>
          <h2 className="mb-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-white drop-shadow-md xl:text-[2.65rem]">
            {t("auth.heroTitle")}
          </h2>
          <p className="max-w-md text-base font-medium leading-relaxed text-white/88 xl:text-lg">
            {t("auth.heroSubtitle")}
          </p>
        </div>
      </div>

      {/* Right: sign-in */}
      <div className="relative z-30 flex w-full flex-col items-center justify-center bg-gradient-to-b from-card via-card to-muted/30 px-5 py-10 sm:px-8 sm:py-12 lg:w-[37.5%] lg:border-l lg:border-border/50 lg:px-10 lg:py-14">
        <div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent lg:hidden"
          aria-hidden
        />

        <div className="w-full max-w-[400px] animate-in fade-in zoom-in-95 duration-700 fill-mode-both">
          <div className="mb-16 flex justify-center">
            <img
              src="/integra-logo.png"
              alt="Integra logo"
              className="h-auto w-full max-w-[380px] object-contain"
            />
          </div>
          <div className="rounded-2xl border border-border/80 bg-card/95 p-8 shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.04] sm:p-9 dark:ring-white/[0.06]">
            <div className="mb-8 flex flex-col items-center space-y-3 text-center lg:items-start lg:text-left">
              <div className="mb-1 flex lg:hidden">
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3.5 shadow-sm">
                  <Building2 className="h-9 w-9 text-primary" aria-hidden />
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
                  {t("auth.brandKicker")}
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  {t("auth.signIn")}
                </h1>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                {t("auth.signInHint")}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-5">
                <div className="space-y-2 group">
                  <Label
                    htmlFor="emailOrId"
                    className="text-sm font-medium transition-colors group-focus-within:text-primary"
                  >
                    {t("auth.emailOrId")}
                  </Label>
                  <Input
                    id="emailOrId"
                    name="username"
                    autoComplete="username"
                    placeholder=""
                    value={emailOrId}
                    onChange={(e) => setEmailOrId(e.target.value)}
                    required
                    className="h-12 border-muted-foreground/20 bg-muted/25 text-base shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                </div>

                <div className="space-y-2 group">
                  <Label
                    htmlFor="password"
                    className="text-sm font-medium transition-colors group-focus-within:text-primary"
                  >
                    {t("auth.password")}
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder=""
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 border-muted-foreground/20 bg-muted/25 text-base shadow-sm transition-all placeholder:text-muted-foreground/50 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="h-12 w-full text-base font-semibold shadow-md transition-all hover:shadow-lg hover:shadow-primary/15"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    {t("auth.signingIn")}
                  </span>
                ) : (
                  t("auth.signIn")
                )}
              </Button>
            </form>
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            <span>{t("auth.sessionNote")}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
