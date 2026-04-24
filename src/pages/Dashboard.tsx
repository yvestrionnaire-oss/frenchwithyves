import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import portrait from "@/assets/yves-trionnaire-real.jpg";
import StudentDashboard from "@/components/StudentDashboard";
import TeacherDashboard from "@/components/TeacherDashboard";

export default function Dashboard() {
  const { user, role, fullName, signOut, loading } = useAuth();
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60_000); return () => clearInterval(t); }, []);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-secondaryText">Loading…</div>;

  const displayName = fullName?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "there";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="app-container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <img src={portrait} alt="Yves" className="h-10 w-10 rounded-full object-cover" />
            <div>
              <div className="text-sm font-bold leading-tight">French with Yves</div>
              <div className="text-xs text-secondaryText capitalize">{role ?? "guest"} space</div>
            </div>
          </div>
          <button onClick={() => void signOut()} className="btn-neutral px-3 py-2 text-xs">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>
      <main className="app-container py-8">
        {role === "teacher" ? (
          <TeacherDashboard displayName={displayName} key={tick} />
        ) : (
          <StudentDashboard displayName={displayName} key={tick} />
        )}
      </main>
    </div>
  );
}
