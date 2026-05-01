import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, Mail, ShieldAlert, Briefcase, Fingerprint, Save, Key, Loader2, Camera } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/apiBase';
import { toast } from 'sonner';

export default function Profile() {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const [name, setName] = React.useState(user?.name || '');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    
    setIsSaving(true);
    const result = await updateProfile({ name });
    setIsSaving(false);

    if (result.success) {
      toast.success("Identity preferences synchronized successfully");
    } else {
      toast.error(result.message || "Failed to synchronize preferences");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const result = await uploadAvatar(file);
    setIsUploading(false);

    if (result.success) {
      toast.success("Profile picture updated successfully");
    } else {
      toast.error(result.message || "Failed to update profile picture");
    }
  };

  if (!user) return null;

  const avatarUrl = user.profilePicture 
    ? `${getApiBaseUrl()}${user.profilePicture}` 
    : '/default-avatar.svg';

  const displayRole = user.platformRole === "super_admin" ? "Platform Super Admin" : user.role.replace('_', ' ');

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 pb-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1a2744]">Identity Profile</h1>
          <p className="mt-1 max-w-xl text-sm font-medium text-muted-foreground">
            Manage personal credentials and system-wide authorization parameters
          </p>
        </div>

        <div className="hidden items-center gap-5 rounded-2xl border border-border/60 bg-card px-6 py-3 shadow-erp-sm lg:flex">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</p>
            <p className="text-sm font-semibold text-[hsl(152,69%,36%)] flex items-center gap-1.5 justify-end mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(152,69%,36%)] animate-pulse" />
              Verified
            </p>
          </div>
          <div className="h-8 w-px bg-border/70" />
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tier</p>
            <p className="text-sm font-semibold text-primary mt-0.5 uppercase">{displayRole}</p>
          </div>
          <div className="h-8 w-px bg-border/70" />
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Registry ID</p>
            <p className="text-sm font-semibold text-muted-foreground mt-0.5">{user.employeeId || "—"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* User Identity Card */}
        <div className="xl:col-span-1 space-y-8">
          <Card className="group relative overflow-hidden rounded-2xl border-0 bg-card shadow-erp transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="h-28 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.15),transparent)]" />
            </div>
            <CardContent className="-mt-14 pb-8 flex flex-col items-center text-center relative z-10 px-6">
              <div className="relative group/avatar cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Avatar className="h-28 w-28 border-4 border-background shadow-lg mb-4 transition-transform duration-500 group-hover/avatar:scale-105">
                  <AvatarImage src={avatarUrl} alt={user.name} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="absolute inset-0 mb-4 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-300">
                  {isUploading ? (
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                  ) : (
                    <Camera className="h-8 w-8 text-white" />
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/png, image/jpeg, image/gif, image/webp"
                  onChange={handleFileChange}
                />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-xl font-bold tracking-tight text-[#1a2744]">{user.name}</h3>
                <div className="flex items-center justify-center gap-2 mt-1.5">
                  <Badge variant="secondary" className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border-none bg-primary/10 text-primary">
                    {displayRole}
                  </Badge>
                </div>
              </div>
              
              <div className="w-full mt-8 space-y-3">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/20 border border-border/10 transition-colors hover:bg-secondary/40">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-background flex items-center justify-center text-muted-foreground border border-border/20 shadow-sm">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col text-left overflow-hidden">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Correspondence</span>
                    <span className="text-sm font-semibold truncate text-foreground">{user.email || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/20 border border-border/10 transition-colors hover:bg-secondary/40">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-background flex items-center justify-center text-muted-foreground border border-border/20 shadow-sm">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col text-left overflow-hidden">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Department</span>
                    <span className="text-sm font-semibold truncate text-foreground">{user.department || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/20 border border-border/10 transition-colors hover:bg-secondary/40">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-background flex items-center justify-center text-muted-foreground border border-border/20 shadow-sm">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col text-left overflow-hidden">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Registry ID</span>
                    <span className="text-sm font-semibold truncate text-foreground">{user.employeeId || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-card shadow-erp p-6 transition-all hover:shadow-lg">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Authorization Tier</p>
                <p className="text-[11px] font-medium text-muted-foreground">System-wide Capability Level</p>
              </div>
            </div>
            <p className="mt-4 text-[13px] font-medium leading-relaxed text-muted-foreground">
              Access is currently synchronized with individual role: <strong className="text-foreground uppercase">{displayRole}</strong>. 
              Permissions are immutable without administrative override.
            </p>
          </Card>
        </div>

        {/* Account Details Form */}
        <div className="xl:col-span-2">
          <Card className="rounded-2xl border-0 bg-card shadow-erp h-full flex flex-col">
            <CardHeader className="p-6 border-b border-border/50 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                    <Fingerprint className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <CardTitle className="text-lg font-bold tracking-tight text-[#1a2744]">Credential Registry</CardTitle>
                    <CardDescription className="text-xs font-medium">Identity and authentication parameters</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="w-fit px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-[hsl(152,69%,36%)]/10 text-[hsl(152,69%,36%)] border-none">
                  Authenticated
                </Badge>
               </div>
            </CardHeader>
            <CardContent className="p-8 flex-1">
              <form onSubmit={handleSave} className="space-y-8 flex flex-col h-full">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground/60 ml-1">Full Nomenclature</Label>
                    <Input 
                      value={name} 
                      onChange={(e) => setName(e.target.value)}
                      className="h-10 rounded-xl bg-background border-border/10 font-medium text-sm px-4 focus:ring-primary transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground/60 ml-1">Official ID Code</Label>
                    <Input value={user.employeeId || ''} disabled className="h-10 rounded-xl bg-secondary/30 border-border/10 font-medium text-sm px-4 focus:bg-background transition-all tracking-wider opacity-80" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground/60 ml-1">Verified Mail Endpoint</Label>
                    <Input value={user.email || ''} disabled className="h-10 rounded-xl bg-secondary/30 border-border/10 font-medium text-sm px-4 focus:bg-background transition-all opacity-80" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground/60 ml-1">Organizational Unit</Label>
                    <Input value={user.department || ''} disabled className="h-10 rounded-xl bg-secondary/30 border-border/10 font-medium text-sm px-4 focus:bg-background transition-all opacity-80" />
                  </div>
                </div>

                <div className="mt-8 p-6 rounded-2xl border border-primary/20 bg-primary/5 relative overflow-hidden group">
                  <div className="absolute top-1/2 -translate-y-1/2 right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
                    <Key className="h-24 w-24 text-primary rotate-12" />
                  </div>
                  <div className="relative space-y-3 z-10">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-[#1a2744]">Access Logic Restricted</h4>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground leading-relaxed max-w-xl">
                      Statutory records like Employee ID and Department are locked. To modify these, please contact the HR administrator.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-8 mt-auto">
                  <Button 
                    type="submit"
                    disabled={isSaving || name === user.name}
                    className="h-10 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Commit Preferences
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
