import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, Mail, ShieldAlert, UserCog, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

export default function Profile() {
  const { user } = useAuth();

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate save
    toast.success("Profile preferences saved successfully");
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Profile View</h2>
          <p className="text-muted-foreground">
            Manage your personal account settings and preferences.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* User Identity Card */}
        <Card className="md:col-span-1 border-primary/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 w-full h-24 bg-gradient-to-br from-primary/80 to-primary" />
          <CardContent className="pt-12 pb-6 flex flex-col items-center text-center relative z-10">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg mb-4">
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-xl font-bold">{user.name}</h3>
            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
              <UserCog className="h-4 w-4" />
              <span className="capitalize">{user.role.replace('_', ' ')}</span>
            </div>
            
            <div className="w-full mt-6 space-y-3">
              <div className="flex items-center gap-3 text-sm p-3 rounded-lg bg-secondary/50">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{user.email || 'No email provided'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm p-3 rounded-lg bg-secondary/50">
                <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{user.department}</span>
              </div>
              <div className="flex items-center gap-3 text-sm p-3 rounded-lg bg-secondary/50">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">Employee ID: {user.employeeId}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Read-Only Account Details Form */}
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>
              Your identity information is managed by HR. Contact an administrator to update these details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={user.name} disabled className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeId">Employee ID</Label>
                  <Input id="employeeId" value={user.employeeId} disabled className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" value={user.email || ''} disabled className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" value={user.department} disabled className="bg-muted/50" />
                </div>
              </div>
              
              <div className="rounded-lg border border-warning/50 bg-warning/10 p-4 mt-6">
                <div className="flex gap-3">
                  <ShieldAlert className="h-5 w-5 text-warning shrink-0" />
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm text-warning-foreground">Role Permissions</h4>
                    <p className="text-xs text-warning-foreground/80">
                      You are currently logged in as a <strong>{user.role}</strong>. This dictates your read/write
                      access across the system modules. If you need elevated permissions, please contact your systems administrator.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button type="submit">Save Preferences</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
