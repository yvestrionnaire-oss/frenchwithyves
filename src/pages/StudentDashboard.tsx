import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  Clock,
  CreditCard,
  ExternalLink,
  GraduationCap,
  Loader2,
  LogOut,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

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

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function StudentDashboard() {
  const { user, signOut } = useAuth();
  const [params, setParams] = useSearchParams();
  const [credits, setCredits] = useState(0);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void loadAll();
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
    const [bal, l, p, r] = await Promise.all([
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
    ]);
    if (typeof bal.data === "number") setCredits(bal.data);
    setLessons((l.data ?? []) as Lesson[]);
    setPackages((p.data ?? []) as Pkg[]);
    setRequests((r.data ?? []) as Request[]);
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

  const upcoming = useMemo(
    () =>
      lessons.filter(
        (l) => l.status !== "cancelled" && new Date(l.scheduled_at).getTime() > Date.now(),
      ),
    [lessons],
  );
  const past = useMemo(
    () =>
      lessons.filter(
        (l) => l.status !== "cancelled" && new Date(l.scheduled_at).getTime() <= Date.now(),
      ),
    [lessons],
  );
  const activeRequests = requests.filter((r) => r.status !== "cancelled");
  const trialApproved = requests.some((r) => r.status === "approved");
  const canBookTrial = trialApproved && !lessons.some((l) => l.lesson_type === "trial" && l.status !== "cancelled");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            French with Yves
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your dashboard</h1>
          <p className="mt-1 text-muted-foreground">Manage lessons, request packages, and book your slots.</p>
        </div>

        {/* Credits + Book CTA */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Available credits</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-4xl font-semibold">{credits}</span>
                  <span className="text-sm text-muted-foreground">
                    {credits === 1 ? "lesson" : "lessons"}
                  </span>
                </div>
                {trialApproved && canBookTrial && (
                  <p className="mt-2 text-xs text-primary">🎁 Your free trial is approved — go book it!</p>
                )}
              </div>
              <Button asChild size="lg" disabled={credits < 1}>
                <Link to="/book">
                  <CalendarDays className="h-4 w-4" />
                  {credits > 0 ? "Book a lesson" : "No credits — request a package"}
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

        {/* Pending requests */}
        {activeRequests.length > 0 && (
          <section>
            <h2 className="mb-3 text-xl font-semibold">Your requests</h2>
            <div className="space-y-2">
              {activeRequests.map((r) => {
                const pkg = packages.find((p) => p.id === r.package_id);
                return (
                  <Card key={r.id}>
                    <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-medium">{pkg?.name ?? "Package"}</div>
                        <div className="text-xs text-muted-foreground">
                          Requested {new Date(r.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <RequestBadge status={r.status} />
                        {(r.status === "pending" || r.status === "payment_link_sent") && (
                          <Button variant="ghost" size="sm" onClick={() => cancelRequest(r.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Upcoming lessons */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">Upcoming lessons</h2>
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </CardContent>
            </Card>
          ) : upcoming.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No upcoming lessons. {credits > 0 && "Book one from your calendar."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {upcoming.map((l) => (
                <Card key={l.id}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{fmtDateTime(l.scheduled_at)}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.lesson_type === "trial" ? "Trial · 30 min" : `Lesson · ${l.duration_minutes} min`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {l.meet_link && (
                        <Button asChild variant="outline" size="sm">
                          <a href={l.meet_link} target="_blank" rel="noreferrer">
                            <Video className="h-4 w-4" /> Join Meet <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => cancelLesson(l.id)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Past lessons */}
        {past.length > 0 && (
          <section>
            <h2 className="mb-3 text-xl font-semibold">Past lessons</h2>
            <div className="space-y-2">
              {past.slice(0, 5).map((l) => (
                <Card key={l.id}>
                  <CardContent className="flex items-center gap-3 p-3 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">{fmtDateTime(l.scheduled_at)}</div>
                    <Badge variant="secondary">
                      {l.lesson_type === "trial" ? "Trial" : "Regular"}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Packages */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">Request a package</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Pick a package — Yves will email you a payment link, and once payment is confirmed,
            credits appear here so you can book your slots.
          </p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
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

function RequestBadge({ status }: { status: Request["status"] }) {
  const map: Record<Request["status"], { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    pending: { label: "Awaiting Yves", variant: "secondary" },
    payment_link_sent: { label: "Payment link sent — check your email", variant: "outline" },
    approved: { label: "Trial approved ✓", variant: "default" },
    paid: { label: "Paid ✓", variant: "default" },
    cancelled: { label: "Cancelled", variant: "destructive" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}
