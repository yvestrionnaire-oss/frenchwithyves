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
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { TeacherCalendar } from "@/components/TeacherCalendar";
import { LessonsView, type LessonItem, hueFromString, initialsFromName } from "@/components/LessonsView";
import { TeacherRescheduleDialog } from "@/components/TeacherRescheduleDialog";

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
  const [rescheduleLessonId, setRescheduleLessonId] = useState<string | null>(null);
  type LessonsFilter = "upcoming" | "completed";
  const [lessonsFilter, setLessonsFilter] = useState<LessonsFilter>(() => {
    if (typeof window === "undefined") return "upcoming";
    const v = window.localStorage.getItem("fwy.teacherLessonsFilter");
    return v === "upcoming" || v === "completed" ? v : "upcoming";
  });
  useEffect(() => {
    window.localStorage.setItem("fwy.teacherLessonsFilter", lessonsFilter);
  }, [lessonsFilter]);

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
    const [p, pr, l, prof, n] = await Promise.all([
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
      supabase
        .from("teacher_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setPackages((p.data ?? []) as Pkg[]);
    setRequests((pr.data ?? []) as Request[]);
    setLessons((l.data ?? []) as Lesson[]);
    setProfiles((prof.data ?? []) as Profile[]);
    setNotifications((n.data ?? []) as Notification[]);
    setLoading(false);
  }

  async function markAllRead() {
    const unread = notifications.filter((x) => !x.read_at).map((x) => x.id);
    if (unread.length === 0) return;
    await supabase
      .from("teacher_notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread);
    await loadAll();
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
    <div className="min-h-dvh bg-background">
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
        <div className="grid gap-4 md:grid-cols-4">
          <Stat icon={<Users />} value={students.length} label="Students" />
          <Stat icon={<Mail />} value={pendingRequests.length} label="Pending requests" highlight={pendingRequests.length > 0} />
          <Stat icon={<CalendarDays />} value={upcoming.length} label="Upcoming lessons" />
          <Stat icon={<Bell />} value={notifications.filter((n) => !n.read_at).length} label="New notifications" highlight={notifications.some((n) => !n.read_at)} />
        </div>

        {/* Upcoming lessons (left) + Recent activity (right) */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-3 text-xl font-semibold">Lessons</h2>
            {(() => {
              const now = Date.now();
              const matches = lessons.filter((l) => {
                if (l.status === "cancelled") return false;
                const t = new Date(l.scheduled_at).getTime();
                if (lessonsFilter === "upcoming") return l.status === "scheduled" && t >= now;
                return l.status === "completed" || (l.status === "scheduled" && t < now);
              });
              matches.sort((a, b) => {
                const at = new Date(a.scheduled_at).getTime();
                const bt = new Date(b.scheduled_at).getTime();
                return lessonsFilter === "completed" ? bt - at : at - bt;
              });
              return (
                <LessonsView
                  lessons={matches.map((l) => {
                    const p = profileMap.get(l.student_id);
                    const name = p?.full_name ?? p?.email ?? "Student";
                    return {
                      ...l,
                      counterpartName: name,
                      initials: initialsFromName(name),
                      colorHue: hueFromString(p?.id ?? l.student_id),
                    } as LessonItem;
                  })}
                  onReschedule={(id) => setRescheduleLessonId(id)}
                  onCancel={async (id) => {
                    const { error } = await supabase.rpc("cancel_lesson", { _lesson_id: id });
                    if (error) {
                      toast({ title: "Failed", description: error.message, variant: "destructive" });
                      return;
                    }
                    toast({ title: "Lesson cancelled" });
                    await loadAll();
                  }}
                  rescheduleLabel="Request reschedule"
                  emptyText={
                    lessonsFilter === "upcoming"
                      ? "No upcoming lessons booked yet."
                      : "No completed lessons yet."
                  }
                  headerExtra={
                    <Select value={lessonsFilter} onValueChange={(v) => setLessonsFilter(v as typeof lessonsFilter)}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  }
                />
              );
            })()}
          </div>

          <aside className="lg:col-span-1">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent activity</h2>
              {notifications.some((n) => !n.read_at) && (
                <Button variant="ghost" size="sm" onClick={markAllRead}>Mark read</Button>
              )}
            </div>
            {notifications.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  No activity yet.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="divide-y p-0">
                  {notifications.slice(0, 12).map((n) => {
                    const profile = profileMap.get(n.student_id);
                    const isUnread = !n.read_at;
                    let label = "";
                    if (n.kind === "request_created") label = `${profile?.full_name ?? "Student"} requested a package`;
                    else if (n.kind === "lesson_cancelled") label = `${profile?.full_name ?? "Student"} cancelled a lesson`;
                    else if (n.kind === "lesson_rescheduled") label = `${profile?.full_name ?? "Student"} rescheduled a lesson`;
                    return (
                      <div key={n.id} className={`flex items-start gap-2 p-3 text-xs ${isUnread ? "bg-primary/5" : ""}`}>
                        {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                        <div className="flex-1 min-w-0">
                          <div className={isUnread ? "font-medium" : ""}>{label}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {new Date(n.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </aside>
        </section>

        {/* Weekly schedule (left) + Action needed (right) */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-3 text-xl font-semibold">Weekly schedule</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              30-min slots in your local time. Booked lessons + Google Calendar busy times. Updates live.
            </p>
            <TeacherCalendar profiles={profiles} />
          </div>

          <aside className="lg:col-span-1">
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
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
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
                    <Card key={r.id} className="border-l-4 border-l-primary/60">
                      <CardContent className="space-y-3 p-3">
                        <div>
                          <div className="text-sm font-medium">
                            {profile?.full_name ?? "Student"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {pkg?.name} {!isTrial && pkg && `· $${(pkg.price_cents / 100).toFixed(0)}`}
                          </div>
                          <button
                            onClick={() => copyEmail(profile?.email ?? null)}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" /> {profile?.email}
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isTrial ? (
                            <Button size="sm" disabled={busy === r.id} onClick={() => action("approve_trial", r.id)}>
                              <CheckCircle2 className="h-4 w-4" /> Approve
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
                                  <Send className="h-4 w-4" /> Link sent
                                </Button>
                              )}
                              {r.status === "payment_link_sent" && <Badge variant="outline" className="text-[10px]">Link sent ✓</Badge>}
                              <Button size="sm" disabled={busy === r.id} onClick={() => action("confirm_paid", r.id)}>
                                <CheckCircle2 className="h-4 w-4" /> Paid
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
          </aside>
        </section>

        <TeacherRescheduleDialog
          open={!!rescheduleLessonId}
          onOpenChange={(o) => { if (!o) setRescheduleLessonId(null); }}
          lessonId={rescheduleLessonId}
          currentSlotIso={rescheduleLessonId ? lessons.find((l) => l.id === rescheduleLessonId)?.scheduled_at ?? null : null}
          studentName={(() => {
            if (!rescheduleLessonId) return null;
            const l = lessons.find((x) => x.id === rescheduleLessonId);
            const p = l ? profileMap.get(l.student_id) : null;
            return p?.full_name ?? p?.email ?? null;
          })()}
          onSent={loadAll}
        />


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

        {/* Earnings (bottom) */}
        <EarningsSection lessons={lessons} requests={requests} packages={packages} />
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

/* ---------------- Earnings ---------------- */

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const fmtRange = (a: Date, b: Date) => {
  const o: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
  return `${a.toLocaleDateString(undefined, o)} – ${b.toLocaleDateString(undefined, o)}`;
};

function EarningsSection({
  lessons,
  requests,
  packages,
}: {
  lessons: Lesson[];
  requests: Request[];
  packages: Pkg[];
}) {
  // Effective price per credit, by package (handles discount packages).
  const pricePerCredit = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of packages) {
      if (p.is_free || !p.credits) map.set(p.id, 0);
      else map.set(p.id, p.price_cents / 100 / p.credits);
    }
    return map;
  }, [packages]);

  // Per-lesson value: if we know the student's most recent paid package, use that price/credit; else fallback to $20.
  function lessonValue(l: Lesson): number {
    if (l.lesson_type === "trial") return 0;
    const paid = requests
      .filter((r) => r.student_id === l.student_id && r.status === "paid")
      .sort((a, b) => (a.paid_at ?? "").localeCompare(b.paid_at ?? ""));
    const pkgId = paid[paid.length - 1]?.package_id;
    const v = pkgId ? pricePerCredit.get(pkgId) : undefined;
    return typeof v === "number" ? v : 20;
  }

  const now = new Date();
  // Projected ranges (forward-looking)
  const startOfWeek = (() => {
    const d = new Date(now);
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear(), 11, 31);

  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
  const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);

  function sum(predicate: (l: Lesson) => boolean): number {
    return lessons.filter(predicate).reduce((s, l) => s + lessonValue(l), 0);
  }
  const inRange = (iso: string, from: Date, to: Date) => {
    const t = new Date(iso).getTime();
    return t >= from.getTime() && t <= to.getTime() + 86_400_000 - 1;
  };

  // Projected: scheduled (not cancelled) lessons within the range
  const projectedWeek = sum((l) => l.status !== "cancelled" && inRange(l.scheduled_at, startOfWeek, endOfWeek));
  const projectedMonth = sum((l) => l.status !== "cancelled" && inRange(l.scheduled_at, now, endOfMonth));
  const projectedYear = sum((l) => l.status !== "cancelled" && inRange(l.scheduled_at, now, endOfYear));

  // Earned: completed lessons (or any non-cancelled lesson already in the past)
  const isEarned = (l: Lesson) => l.status !== "cancelled" && new Date(l.scheduled_at).getTime() < now.getTime();
  const earnedThisMonth = sum((l) => isEarned(l) && inRange(l.scheduled_at, startOfMonth, now));
  const earnedLastMonth = sum((l) => isEarned(l) && inRange(l.scheduled_at, startOfLastMonth, endOfLastMonth));
  const earnedThisYear = sum((l) => isEarned(l) && inRange(l.scheduled_at, startOfYear, now));
  const earnedLastYear = sum((l) => isEarned(l) && inRange(l.scheduled_at, startOfLastYear, endOfLastYear));
  const earnedAllTime = sum(isEarned);

  return (
    <section className="space-y-6">
      <div>
        <div className="mb-3">
          <h2 className="text-2xl font-bold">Projected Earnings</h2>
          <p className="text-sm text-muted-foreground">Based on your booked lessons</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <EarningCard title="This Week" subtitle="Your Projected Earnings" amount={projectedWeek} range={fmtRange(startOfWeek, endOfWeek)} />
          <EarningCard title="This Month" subtitle="Your Projected Earnings" amount={projectedMonth} range={fmtRange(now, endOfMonth)} />
          <EarningCard title="This Year" subtitle="Your Projected Earnings" amount={projectedYear} range={fmtRange(now, endOfYear)} />
        </div>
      </div>

      <div>
        <div className="mb-3">
          <h2 className="text-2xl font-bold">Earnings</h2>
          <p className="text-sm text-muted-foreground">Based on completed lessons</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <EarningCard title="This Month" subtitle="Your Earnings" amount={earnedThisMonth} range={fmtRange(startOfMonth, now)} />
          <EarningCard title="Last Month" subtitle="Your Earnings" amount={earnedLastMonth} range={fmtRange(startOfLastMonth, endOfLastMonth)} />
          <EarningCard title="This Year" subtitle="Your Earnings" amount={earnedThisYear} range={fmtRange(startOfYear, now)} />
          <EarningCard title="Last Year" subtitle="Your Earnings" amount={earnedLastYear} range={fmtRange(startOfLastYear, endOfLastYear)} />
          <EarningCard title="All Time" subtitle="Your Earnings" amount={earnedAllTime} range="Since you started" />
        </div>
      </div>
    </section>
  );
}

function EarningCard({
  title,
  subtitle,
  amount,
  range,
}: {
  title: string;
  subtitle: string;
  amount: number;
  range: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div>
          <div className="text-lg font-bold leading-tight">{title}</div>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </div>
        <div className="text-3xl font-bold text-primary">{fmtUSD(amount)}</div>
        <div className="text-xs text-muted-foreground">{range}</div>
      </CardContent>
    </Card>
  );
}
