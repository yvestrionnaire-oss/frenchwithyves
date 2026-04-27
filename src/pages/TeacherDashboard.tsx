import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Copy,
  Loader2,
  LogOut,
  Mail,
  Send,
  Users,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { TeacherCalendar } from "@/components/TeacherCalendar";

type Pkg = { id: string; name: string; price_cents: number; is_free: boolean; credits: number };
type Profile = { id: string; full_name: string | null; email: string | null };
type Request = {
  id: string;
  student_id: string;
  package_id: string;
  status: "pending" | "payment_link_sent" | "approved" | "paid" | "cancelled";
  credits_granted: number;
  created_at: string;
  paid_at: string | null;
};
type Lesson = {
  id: string;
  student_id: string;
  scheduled_at: string;
  duration_minutes: number;
  lesson_type: string;
  status: string;
  meet_link: string | null;
};
type StudentRow = { id: string; full_name: string | null; email: string | null; credits: number; lessonsCount: number };
type Notification = {
  id: string;
  kind: "request_created" | "lesson_cancelled" | "lesson_rescheduled";
  student_id: string;
  lesson_id: string | null;
  request_id: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function TeacherDashboard() {
  const { user, signOut } = useAuth();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;
    void loadAll();

    const ch = supabase
      .channel("teacher-dash")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "purchase_requests" },
        () => void loadAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lessons" },
        () => void loadAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teacher_notifications" },
        () => void loadAll(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user]);

  async function loadAll() {
    setLoading(true);
    const [p, pr, l, prof] = await Promise.all([
      supabase.from("packages").select("id, name, price_cents, is_free, credits").order("sort_order"),
      supabase
        .from("purchase_requests")
        .select("id, student_id, package_id, status, credits_granted, created_at, paid_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("lessons")
        .select("id, student_id, scheduled_at, duration_minutes, lesson_type, status, meet_link")
        .order("scheduled_at"),
      supabase.from("profiles").select("id, full_name, email"),
    ]);
    setPackages((p.data ?? []) as Pkg[]);
    setRequests((pr.data ?? []) as Request[]);
    setLessons((l.data ?? []) as Lesson[]);
    setProfiles((prof.data ?? []) as Profile[]);
    setLoading(false);
  }

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const pkgMap = useMemo(() => new Map(packages.map((p) => [p.id, p])), [packages]);

  const pendingRequests = requests.filter((r) => r.status === "pending" || r.status === "payment_link_sent");
  const upcoming = lessons.filter(
    (l) => l.status !== "cancelled" && new Date(l.scheduled_at).getTime() > Date.now(),
  );

  const students: StudentRow[] = useMemo(() => {
    // All users that have a profile and are not the teacher
    const rows: StudentRow[] = profiles
      .filter((p) => p.id !== user?.id)
      .map((p) => {
        const credits =
          requests
            .filter((r) => r.student_id === p.id && (r.status === "paid" || r.status === "approved"))
            .reduce((sum, r) => sum + r.credits_granted, 0) -
          lessons.filter((l) => l.student_id === p.id && l.status !== "cancelled").length;
        const lessonsCount = lessons.filter(
          (l) => l.student_id === p.id && l.status === "completed",
        ).length;
        return { id: p.id, full_name: p.full_name, email: p.email, credits, lessonsCount };
      });
    return rows;
  }, [profiles, requests, lessons, user]);

  async function action(name: "mark_payment_link_sent" | "confirm_paid" | "approve_trial" | "cancel_request", id: string) {
    setBusy(id);
    const { error } = await supabase.rpc(name, { _request_id: id });
    setBusy(null);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    const labels: Record<typeof name, string> = {
      mark_payment_link_sent: "Marked as sent",
      confirm_paid: "Payment confirmed — credits granted",
      approve_trial: "Trial approved",
      cancel_request: "Request cancelled",
    };
    toast({ title: labels[name] });
    await loadAll();
  }

  function copyEmail(email: string | null) {
    if (!email) return;
    void navigator.clipboard.writeText(email);
    toast({ title: "Email copied", description: email });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            French with Yves · Teacher
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Teacher dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Approve requests, confirm payments, and view all upcoming lessons.
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Stat icon={<Users />} value={students.length} label="Students" />
          <Stat
            icon={<Mail />}
            value={pendingRequests.length}
            label="Pending requests"
            highlight={pendingRequests.length > 0}
          />
          <Stat icon={<CalendarDays />} value={upcoming.length} label="Upcoming lessons" />
        </div>

        {/* Pending requests — center of attention */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">
            Action needed
            {pendingRequests.length > 0 && (
              <Badge className="ml-2" variant="destructive">
                {pendingRequests.length}
              </Badge>
            )}
          </h2>
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </CardContent>
            </Card>
          ) : pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nothing waiting on you. ☕
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((r) => {
                const profile = profileMap.get(r.student_id);
                const pkg = pkgMap.get(r.package_id);
                const isTrial = pkg?.is_free;
                return (
                  <Card key={r.id}>
                    <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex-1">
                        <div className="font-medium">
                          {profile?.full_name ?? "Student"} —{" "}
                          <span className="text-muted-foreground">
                            {pkg?.name} {!isTrial && `· $${(pkg!.price_cents / 100).toFixed(0)}`}
                          </span>
                        </div>
                        <button
                          onClick={() => copyEmail(profile?.email ?? null)}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-3 w-3" /> {profile?.email}
                        </button>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Requested {new Date(r.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isTrial ? (
                          <Button size="sm" disabled={busy === r.id} onClick={() => action("approve_trial", r.id)}>
                            <CheckCircle2 className="h-4 w-4" /> Approve trial
                          </Button>
                        ) : (
                          <>
                            {r.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === r.id}
                                onClick={() => action("mark_payment_link_sent", r.id)}
                              >
                                <Send className="h-4 w-4" /> Mark link sent
                              </Button>
                            )}
                            {r.status === "payment_link_sent" && <Badge variant="outline">Link sent ✓</Badge>}
                            <Button size="sm" disabled={busy === r.id} onClick={() => action("confirm_paid", r.id)}>
                              <CheckCircle2 className="h-4 w-4" /> Confirm paid
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === r.id}
                          onClick={() => action("cancel_request", r.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Upcoming lessons */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">Upcoming lessons</h2>
          {upcoming.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">No upcoming lessons.</CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {upcoming.map((l) => {
                const profile = profileMap.get(l.student_id);
                return (
                  <Card key={l.id}>
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <CalendarDays className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{fmtDateTime(l.scheduled_at)}</div>
                          <div className="text-xs text-muted-foreground">
                            {profile?.full_name ?? "Student"} · {profile?.email} ·{" "}
                            {l.lesson_type === "trial" ? "Trial 30min" : `${l.duration_minutes}min`}
                          </div>
                        </div>
                      </div>
                      {l.meet_link && (
                        <Button asChild variant="outline" size="sm">
                          <a href={l.meet_link} target="_blank" rel="noreferrer">
                            <Video className="h-4 w-4" /> Open Meet
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Students */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">Students</h2>
          {students.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">No students yet.</CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {students.map((s) => (
                    <div key={s.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-medium">{s.full_name ?? "—"}</div>
                        <button
                          onClick={() => copyEmail(s.email)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-3 w-3" /> {s.email}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Badge variant="secondary">{s.credits} credits</Badge>
                        <span className="text-muted-foreground">{s.lessonsCount} done</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
  highlight,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary" : ""}>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <div className="text-3xl font-semibold">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
