import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Factory } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingLogo } from "@/components/ui/LoadingLogo";

export function KioskLayout() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-[#1a2744] text-white shadow-md">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={() => navigate("/")}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="flex items-center gap-2">
            <Factory className="h-6 w-6 text-emerald-400" />
            <span className="font-bold tracking-widest uppercase italic hidden sm:inline">
              Factory Flow
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="opacity-70">Operator:</span>
          <span>{user?.name || "Unknown"}</span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 pb-24">
        <React.Suspense fallback={<div className="flex h-full items-center justify-center py-20"><LoadingLogo size={48} /></div>}>
          <Outlet />
        </React.Suspense>
      </main>
    </div>
  );
}
