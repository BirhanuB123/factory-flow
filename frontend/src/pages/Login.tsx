import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, Loader2 } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';

export default function Login() {
  const [emailOrId, setEmailOrId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrId || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
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

      const data = await response.json();

      if (response.ok) {
        toast.success('Logged in successfully');
        login(data, data.token);
        navigate(from, { replace: true });
      } else {
        toast.error(data.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Decoration / Image (Hidden on smaller screens) */}
      <div className="relative hidden lg:flex w-1/2 flex-col justify-end overflow-hidden p-12 text-white">
        <div className="absolute inset-0 bg-primary/20 z-10" />
        <img
          src="/login-bg.png"
          alt="Factory Flow Manufacturing"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[10000ms] ease-linear hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent z-20" />

        <div className="relative z-30 flex flex-col items-start max-w-lg mb-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both delay-300">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md p-4 mb-6 border border-white/20 shadow-xl">
            <Building2 className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-5xl font-extrabold tracking-tight mb-6 drop-shadow-xl text-white">
            Integra - ERP
          </h2>
          <p className="text-xl text-white/90 drop-shadow-lg font-medium leading-relaxed">
            Streamline your manufacturing processes with our state-of-the-art ERP system.
            Enhance productivity, efficiency, and clarity from the shop floor to top floor.
          </p>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center p-8 sm:p-12 lg:p-16 bg-card relative shadow-2xl z-30">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent lg:hidden" />

        <div className="w-full max-w-md space-y-8 animate-in zoom-in-95 fade-in duration-700 fill-mode-both">
          <div className="flex flex-col items-center lg:items-start space-y-3 text-center lg:text-left">
            <div className="lg:hidden rounded-2xl bg-primary/10 p-4 mb-4 shadow-sm border border-primary/20">
              <Building2 className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Sign in</h1>
            <p className="text-base text-muted-foreground w-full">
              Enter your company credentials to access the ERP platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 mt-8">
            <div className="space-y-5">
              <div className="space-y-2 group">
                <Label htmlFor="emailOrId" className="text-sm font-semibold transition-colors group-focus-within:text-primary">
                  Company Email or ID
                </Label>
                <Input
                  id="emailOrId"
                  placeholder=""
                  value={emailOrId}
                  onChange={(e) => setEmailOrId(e.target.value)}
                  required
                  className="h-12 text-base bg-muted/30 transition-all border-muted-foreground/20 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/50 shadow-sm"
                />
              </div>

              <div className="space-y-2 group">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-semibold transition-colors group-focus-within:text-primary">
                    Password
                  </Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder=""
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 text-base bg-muted/30 transition-all border-muted-foreground/20 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/50 shadow-sm"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-bold shadow-lg hover:shadow-primary/25 transition-all hover:-translate-y-0.5"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Authenticating...
                </span>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
