import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Calendar, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function EmployeeDashboardSummary() {
  const { user } = useAuth();
  const { t } = useLocale();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold tracking-tight text-[#1a2744]">Welcome, {user?.name || "Employee"}!</h2>
        <p className="text-sm text-muted-foreground">Here is a quick summary of your profile and quick access tools.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-0 bg-card shadow-erp">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full">
            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
              <Clock className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold">Time & Attendance</h3>
            <p className="text-sm text-muted-foreground mt-2 mb-6">
              Review your recent clock-in histories and hours worked.
            </p>
            <Button asChild className="w-full rounded-full">
              <Link to="/hr/my-profile">View Attendance</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 bg-card shadow-erp">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full">
            <div className="h-16 w-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4 text-amber-600">
              <Calendar className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold">Leave Requests</h3>
            <p className="text-sm text-muted-foreground mt-2 mb-6">
              Check your leave balances and submit a new request.
            </p>
            <Button asChild variant="outline" className="w-full rounded-full border-border/60 shadow-none">
              <Link to="/hr/my-profile">Manage Leaves</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 bg-card shadow-erp">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full">
            <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold">Your Tasks</h3>
            <p className="text-sm text-muted-foreground mt-2 mb-6">
              You are all caught up! No critical actions required.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
