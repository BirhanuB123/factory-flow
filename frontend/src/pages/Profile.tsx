import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, Mail, ShieldAlert, UserCog, Briefcase, User, Fingerprint, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ModuleDashboardLayout } from '@/components/ModuleDashboardLayout';

export default function Profile() {
  const { user } = useAuth();

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Identity preferences synchronized successfully");
  };

  if (!user) return null;

  return (
    <ModuleDashboardLayout
      className="max-w-[1200px] mx-auto"
      title="IDENTITY PROFILE"
      description="Manage personal credentials and system-wide authorization parameters"
      icon={User}
      healthStats={[
        { label: "Status", value: "Verified", accent: "text-emerald-500" },
        { label: "Tier", value: user.role.replace('_', ' ').toUpperCase(), accent: "text-primary" },
        { label: "ID", value: user.employeeId || "—", accent: "text-blue-500" },
      ]}
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* User Identity Card */}
        <div className="xl:col-span-1 space-y-8">
          <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-black/5 bg-card/40 backdrop-blur-xl overflow-hidden group">
            <div className="h-32 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.15),transparent)]" />
            </div>
            <CardContent className="-mt-16 pb-10 flex flex-col items-center text-center relative z-10 px-8">
              <Avatar className="h-32 w-32 border-8 border-background/20 backdrop-blur-xl shadow-2xl mb-6 transition-transform duration-500 group-hover:scale-105">
                <AvatarFallback className="bg-primary/5 text-primary text-3xl font-black italic">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight uppercase italic">{user.name}</h3>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 px-3 py-1 rounded-full bg-primary/5 border border-primary/10">
                    {user.role.replace('_', ' ')}
                  </span>
                </div>
              </div>
              
              <div className="w-full mt-10 space-y-4">
                <div className="flex items-center gap-4 p-5 rounded-2xl bg-secondary/10 border border-border/10 group/item transition-all hover:bg-secondary/20 hover:translate-y-[-2px] shadow-sm">
                  <div className="h-10 w-10 rounded-xl bg-background/50 flex items-center justify-center text-muted-foreground/60 border border-border/10 group-hover/item:text-primary transition-colors">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col text-left overflow-hidden">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Correspondence</span>
                    <span className="text-sm font-bold truncate">{user.email || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-5 rounded-2xl bg-secondary/10 border border-border/10 group/item transition-all hover:bg-secondary/20 hover:translate-y-[-2px] shadow-sm">
                  <div className="h-10 w-10 rounded-xl bg-background/50 flex items-center justify-center text-muted-foreground/60 border border-border/10 group-hover/item:text-primary transition-colors">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col text-left overflow-hidden">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Department</span>
                    <span className="text-sm font-bold truncate">{user.department}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-5 rounded-2xl bg-secondary/10 border border-border/10 group/item transition-all hover:bg-secondary/20 hover:translate-y-[-2px] shadow-sm">
                  <div className="h-10 w-10 rounded-xl bg-background/50 flex items-center justify-center text-muted-foreground/60 border border-border/10 group-hover/item:text-primary transition-colors">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col text-left overflow-hidden">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Registry ID</span>
                    <span className="text-sm font-bold truncate">{user.employeeId}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-black/5 bg-card/40 backdrop-blur-xl overflow-hidden p-8">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-[13px] font-black uppercase tracking-widest italic leading-none">Authorization Tier</p>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">System-wide Capability Level</p>
              </div>
            </div>
            <p className="mt-6 text-[11px] font-medium leading-relaxed text-muted-foreground/80">
              Access is currently synchronized with individual role: <strong className="text-foreground uppercase tracking-widest">{user.role}</strong>. 
              Permissions are immutable without administrative override.
            </p>
          </Card>
        </div>

        {/* Account Details Form */}
        <div className="xl:col-span-2">
          <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-black/5 bg-card/40 backdrop-blur-xl overflow-hidden h-full">
            <CardHeader className="p-8 pb-4 border-b border-border/10 bg-secondary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                    <Fingerprint className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-black tracking-tight uppercase italic">Credential Registry</CardTitle>
                    <CardDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60">Identity and authentication parameters</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="px-3 py-1 font-black uppercase text-[9px] tracking-[0.2em] rounded-md bg-emerald-500/10 text-emerald-500 border-none">
                  Authenticated
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-10">
              <form onSubmit={handleSave} className="space-y-10">
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Full Nomenclature</Label>
                    <Input value={user.name} disabled className="h-12 rounded-2xl bg-secondary/20 border-border/10 font-bold text-sm px-5 opacity-80" />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Official ID Code</Label>
                    <Input value={user.employeeId} disabled className="h-12 rounded-2xl bg-secondary/20 border-border/10 font-black text-sm px-5 opacity-80 tracking-widest" />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Verified Mail Endpoint</Label>
                    <Input value={user.email || ''} disabled className="h-12 rounded-2xl bg-secondary/20 border-border/10 font-bold text-sm px-5 opacity-80" />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Organizational Unit</Label>
                    <Input value={user.department} disabled className="h-12 rounded-2xl bg-secondary/20 border-border/10 font-bold text-sm px-5 opacity-80" />
                  </div>
                </div>

                <div className="p-8 rounded-[2rem] border border-border/10 bg-secondary/5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <ShieldCheck className="h-20 w-20 text-primary" />
                  </div>
                  <div className="relative space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] italic">Access Logic Restricted</h4>
                    </div>
                    <p className="text-[11px] font-medium text-muted-foreground/80 leading-relaxed max-w-xl">
                      CORE IDENTITY PARAMETERS ARE LOCKED. FOR MODIFICATION OF STATUTORY RECORDS OR AUTHORIZATION CAPABILITIES, 
                      PLEASE SUBMIT A FORMAL PROTOCOL REQUEST TO THE <strong className="text-foreground">SYSTEMS GOVERNANCE BOARD</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-6">
                  <Button 
                    type="submit"
                    className="h-12 px-10 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all bg-primary"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Commit Preferences
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </ModuleDashboardLayout>
  );
}
