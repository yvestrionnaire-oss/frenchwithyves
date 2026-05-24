import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

function FullscreenLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
    </div>
  );
}

export function RequireStudent({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  if (loading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/auth?mode=signin" replace />;
  if (role === "teacher") return <Navigate to="/teacher" replace />;
  return <>{children}</>;
}

export function RequireTeacher({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  if (loading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/auth?mode=signin" replace />;
  if (role !== "teacher") return <Navigate to="/student" replace />;
  return <>{children}</>;
}
