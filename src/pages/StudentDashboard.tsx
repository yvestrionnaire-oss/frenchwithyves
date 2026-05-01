import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  LogOut,
  Mail,
  MailQuestion,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LessonsView, type LessonItem, hueFromString } from "@/components/LessonsView";

type Lesson = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  lesson_type: string;
  status: string;
  meet_link: string | null;
};
type Pkg = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  is_free: boolean;
  is_recommended: boolean;
  credits: number;
  sort_order: number;
};
type Request = {
  id: string;
  status: "pending" | "payment_link_sent" | "approved" | "paid" | "cancelled";
  credits_granted: number;
  created_at: string;
  package_id: string;
};
type Proposal = {
  id: string;
  lesson_id: string;
  message: string | null;
  proposed_slot: string | null;
  status: string;
  created_at: string;
};

export default function StudentDashboard() {
  const { user, signOut } = useAuth();
  const [params, setParams] = useSearchParams();
  const [credits, setCredits] = useState(0);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void loadAll();
    const ch = supabase
      .channel("student-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "reschedule_proposals" }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "lessons" }, () => void loadAll())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user]);

  // Auto-request trial if ?trial=1 (signup flow from landing)
  useEffect(() => {
    if (!user || loading) return;
    if (params.get("trial") !== "1") return;
    const trialPkg = packages.find((p) => p.is_free);
    const alreadyRequested = requests.some((r) => {
      const pkg = packages.find((p) => p.id === r.package_id);
      return pkg?.is_free && r.status !== "cancelled";
    });
    if (trialPkg && !alreadyRequested) {
      void requestPackage(trialPkg, true);
    }
    params.delete("trial");
    setParams(params, { replace: true });
  }, [user, loading, packages, requests]);

  async function loadAll() {
    setLoading(true);
    const [bal, l, p, r, prop] = await Promise.all([
      supabase.rpc("credit_balance"),
      supabase
        .from("lessons")
        .select("id, scheduled_at, duration_minutes, lesson_type, status, meet_link")
        .order("scheduled_at"),
      supabase.from("packages").select("*").eq("is_active", true).order("sort_order"),
      supabase
        .from("purchase_requests")
        .select("id, status, credits_granted, created_at, package_id")
        .order("created_at", { ascending: false }),
      supabase
        .from("reschedule_proposals")
        .select("id, lesson_id, message, proposed_slot, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);
    if (typeof bal.data === "number") setCredits(bal.data);
    setLessons((l.data ?? []) as Lesson[]);
    setPackages((p.data ?? []) as Pkg[]);
    setRequests((r.data ?? []) as Request[]);
    setProposals((prop.data ?? []) as Proposal[]);
    setLoading(false);
  }

  async function requestPackage(pkg: Pkg, silent = false) {
    setRequesting(pkg.id);
    const { error } = await supabase.rpc("request_package", { _package_id: pkg.id, _notes: null });
    setRequesting(null);
    if (error) {
      const msg = error.message?.includes("Trial already requested")
        ? "You've already requested a trial — check the status above."
        : error.message;
      if (!silent) toast({ title: "Request failed", description: msg, variant: "destructive" });
      return;
    }
    toast({
      title: pkg.is_free ? "Trial requested" : "Package requested",
      description: pkg.is_free
        ? "Yves will email you to confirm. You'll be able to book once approved."
        : "Yves will email you a payment link shortly.",
    });
    await loadAll();
  }

  async function cancelRequest(id: string) {
    const { error } = await supabase.rpc("cancel_request", { _request_id: id });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    await loadAll();
  }

  async function cancelLesson(id: string) {
    const { error } = await supabase.rpc("cancel_lesson", { _lesson_id: id });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Lesson cancelled" });
    await loadAll();
  }

  async function acceptProposal(id: string) {
    const { error } = await supabase.rpc("student_accept_proposal", { _proposal_id: id });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reschedule accepted" });
    await loadAll();
  }
  async function declineProposal(id: string) {
    const { error } = await supabase.rpc("student_decline_proposal", { _proposal_id: id });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Declined — pick a new time yourself" });
    await loadAll();
  }

  const past = useMemo(
    () =>
      lessons.filter(
        (l) => l.status !== "cancelled" && new Date(l.scheduled_at).getTime() <= Date.now(),
      ),
    [lessons],
  );
  const activeRequests = requests.filter((r) => r.status !== "cancelled");
  const trialApproved = requests.some((r) => r.status === "approved");
  const trialBooked = lessons.some((l) => l.lesson_type === "trial" && l.status !== "cancelled");
  const canBookTrial = trialApproved && !trialBooked;
  const trialEverRequested = requests.some((r) => {
    const pkg = packages.find((p) => p.id === r.package_id);
    return pkg?.is_free;
  });
  // Hide the free trial package once it's been requested/booked — it can only be taken once.
  const visiblePackages = packages.filter((p) => !p.is_free || !(trialEverRequested || trialBooked));

  // Build LessonItem[] for the unified view
  const lessonItems: LessonItem[] = useMemo(() => {
    return lessons
      .filter((l) => l.status !== "cancelled")
      .map((l) => ({
        ...l,
        counterpartName: "Yves",
        initials: "Y",
        colorHue: hueFromString("Yves"),
      }));
  }, [lessons]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            French with Yves
          </Link>
          <div className="flex items-center gap-2 text-sm sm:gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/about">About Yves</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="mailto:yvestrionnaire@gmail.com?subject=Question%20from%20your%20student">
                <Mail className="h-4 w-4" /> Email Yves
              </a>
            </Button>
            <span className="text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your dashboard</h1>
          <p className="mt-1 text-muted-foreground">Manage lessons, request packages, and book your slots.</p>
        </div>

        {/* Credits + Book CTA */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2 border-primary/30">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Available credits</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-5xl font-semibold text-primary">{credits}</span>
                  <span className="text-sm font-medium text-muted-foreground">
                    = {credits} lesson{credits === 1 ? "" : "s"} you can book
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  💡 Each credit = one 60-minute lesson. Book them all at once, or one at a time.
                </p>
                {trialApproved && canBookTrial && (
                  <p className="mt-2 text-xs font-medium text-primary">🎁 Your free trial is approved — go book it!</p>
                )}
              </div>
              <Button asChild size="lg" disabled={credits < 1 && !canBookTrial}>
                <Link to={credits > 0 ? "/book?mode=regular" : canBookTrial ? "/book?mode=trial" : "/book"}>
                  <CalendarDays className="h-4 w-4" />
                  {credits > 0 || canBookTrial ? `Book ${credits > 0 ? `${credits} lesson${credits === 1 ? "" : "s"}` : "trial"}` : "No credits"}
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">Lessons completed</div>
              <div className="mt-1 text-4xl font-semibold">{past.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Reschedule proposals from teacher */}
        {proposals.length > 0 && (
          <section>
            <h2 className="mb-3 text-xl font-semibold">📩 Reschedule requests from Yves</h2>
            <div className="space-y-3">
              {proposals.map((p) => {
                const lesson = lessons.find((l) => l.id === p.lesson_id);
                return (
                  <Card key={p.id} className="border-primary/40 bg-primary/5">
                    <CardContent className="space-y-3 p-4">
                      {lesson && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Currently:</span>{" "}
                          <span className="font-medium">
                            {new Date(lesson.scheduled_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                      )}
                      {p.message && (
                        <div className="rounded-lg border bg-background p-3 text-sm italic">"{p.message}"</div>
                      )}
                      {p.proposed_slot ? (
                        <div className="rounded-lg border border-primary bg-background p-3">
                          <div className="text-xs text-muted-foreground">Suggested time</div>
                          <div className="text-base font-semibold">
                            {new Date(p.proposed_slot).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => acceptProposal(p.id)}>
                              <CheckCircle2 className="h-4 w-4" /> Accept
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => declineProposal(p.id)}>
                              Pick another time
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3">
                          <div className="text-sm text-muted-foreground">Yves asked you to pick a new time.</div>
                          <Button asChild size="sm">
                            <Link to={`/book?reschedule=${p.lesson_id}`}>Pick new time</Link>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Lessons (left) + Requests history (right) */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Upcoming lessons</h2>
            </div>
            {loading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                </CardContent>
              </Card>
            ) : (
              <LessonsView
                lessons={lessonItems}
                onReschedule={(id) => { window.location.href = `/book?reschedule=${id}`; }}
                onCancel={cancelLesson}
                rescheduleLabel="Reschedule"
                emptyText={credits > 0 ? "Book one from your calendar." : "No lessons yet."}
              />
            )}
          </div>

          <aside className="lg:col-span-1">
            <h2 className="mb-3 text-xl font-semibold">Your requests</h2>
            {activeRequests.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  No active requests.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {activeRequests.map((r) => {
                  const pkg = packages.find((p) => p.id === r.package_id);
                  return (
                    <Card key={r.id} className="overflow-hidden border-l-4 border-l-primary/60">
                      <CardContent className="space-y-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {pkg?.is_free ? (
                              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                            ) : (
                              <CreditCard className="h-4 w-4 shrink-0 text-primary" />
                            )}
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{pkg?.name ?? "Package"}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </div>
                            </div>
                          </div>
                          {(r.status === "pending" || r.status === "payment_link_sent") && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => cancelRequest(r.id)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <RequestStatusLine status={r.status} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </aside>
        </section>

        {/* Packages */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">Request a package</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Pick a package — Yves will email you a payment link, and once payment is confirmed,
            credits appear here so you can book your slots.
          </p>
          {trialBooked && (
            <div className="mb-4 rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
              <strong className="text-primary">🎉 Your free trial is booked!</strong>
              <p className="mt-1 text-muted-foreground">
                You've already used your one-time free trial lesson. Pick a package below to keep learning.
              </p>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visiblePackages.map((pkg) => (
              <Card key={pkg.id} className={pkg.is_recommended ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {pkg.is_free && <Sparkles className="inline h-4 w-4 text-primary" />} {pkg.name}
                    </CardTitle>
                    {pkg.is_recommended && <Badge>Popular</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-2xl font-semibold">
                    {pkg.is_free ? "Free" : `$${(pkg.price_cents / 100).toFixed(0)}`}
                  </div>
                  <p className="text-xs text-muted-foreground">{pkg.description}</p>
                  <Button
                    className="w-full"
                    variant={pkg.is_recommended ? "default" : "outline"}
                    disabled={requesting === pkg.id}
                    onClick={() => requestPackage(pkg)}
                  >
                    {requesting === pkg.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : pkg.is_free ? (
                      <><GraduationCap className="h-4 w-4" /> Request trial</>
                    ) : (
                      <><CreditCard className="h-4 w-4" /> Request package</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function RequestStatusLine({ status }: { status: Request["status"] }) {
  const map: Record<Request["status"], { icon: React.ReactNode; label: string; tone: string }> = {
    pending: { icon: <Clock className="h-4 w-4" />, label: "Awaiting Yves' approval", tone: "text-amber-700 dark:text-amber-400" },
    payment_link_sent: { icon: <MailQuestion className="h-4 w-4" />, label: "Payment link sent — check your email", tone: "text-blue-700 dark:text-blue-400" },
    approved: { icon: <CheckCircle2 className="h-4 w-4" />, label: "Trial approved — go book it!", tone: "text-emerald-700 dark:text-emerald-400" },
    paid: { icon: <CheckCircle2 className="h-4 w-4" />, label: "Paid — credits added", tone: "text-emerald-700 dark:text-emerald-400" },
    cancelled: { icon: <X className="h-4 w-4" />, label: "Cancelled", tone: "text-muted-foreground" },
  };
  const s = map[status];
  return (
    <div className={`flex items-center gap-2 text-sm font-medium ${s.tone}`}>
      {s.icon} {s.label}
    </div>
  );
}
