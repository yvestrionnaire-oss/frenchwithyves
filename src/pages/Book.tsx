import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarCheck, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type AvailabilityRule = { day_of_week: number; slot_time: string };
type LessonRow = { scheduled_at: string; status: string; lesson_type: string; student_id: string };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(d: Date) {
  const out = new Date(d);
  const day = out.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diff);
  out.setHours(0, 0, 0, 0);
  return out;
}
function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
function isoSlot(date: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  const out = new Date(date);
  out.setHours(h, m ?? 0, 0, 0);
  return out;
}
function fmtTime(time: string) {
  const [h] = time.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ampm}`;
}

export default function Book() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [credits, setCredits] = useState(0);
  const [trialAvailable, setTrialAvailable] = useState(false);
  const [trialUsed, setTrialUsed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"trial" | "regular">("regular");
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  async function load() {
    setLoading(true);
    const [rulesRes, lessonsRes, balRes, reqRes] = await Promise.all([
      supabase.from("availability_rules").select("day_of_week, slot_time").order("slot_time"),
      supabase
        .from("lessons")
        .select("scheduled_at, status, lesson_type, student_id")
        .neq("status", "cancelled"),
      supabase.rpc("credit_balance"),
      supabase
        .from("purchase_requests")
        .select("status, package_id, packages!inner(is_free)")
        .eq("status", "approved"),
    ]);

    if (rulesRes.data) setRules(rulesRes.data as AvailabilityRule[]);
    if (lessonsRes.data) {
      const rows = lessonsRes.data as LessonRow[];
      setBooked(new Set(rows.map((l) => new Date(l.scheduled_at).toISOString())));
      const used = rows.some((l) => l.student_id === user!.id && l.lesson_type === "trial");
      setTrialUsed(used);
    }
    if (typeof balRes.data === "number") setCredits(balRes.data);
    const hasTrial = (reqRes.data ?? []).some((r) => {
      const pkg = (r as unknown as { packages: { is_free: boolean } }).packages;
      return pkg?.is_free;
    });
    setTrialAvailable(hasTrial);

    // Default mode: trial if available & not used, else regular
    if (hasTrial && !lessonsRes.data?.some((l) => (l as LessonRow).student_id === user!.id && (l as LessonRow).lesson_type === "trial")) {
      setMode("trial");
    } else {
      setMode("regular");
    }
    setLoading(false);
  }

  const uniqueTimes = useMemo(() => {
    const set = new Set<string>();
    rules.forEach((r) => set.add(r.slot_time));
    return Array.from(set).sort();
  }, [rules]);

  const ruleSet = useMemo(() => new Set(rules.map((r) => `${r.day_of_week}-${r.slot_time}`)), [rules]);

  const canBook = mode === "trial" ? trialAvailable && !trialUsed : credits >= 1;

  function toggle(slot: Date) {
    if (!canBook) return;
    const key = slot.toISOString();
    if (slot.getTime() < Date.now()) return;
    if (booked.has(key)) return;
    setSelected((prev) => (prev === key ? null : key));
  }

  async function confirmBooking() {
    if (!selected) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("book_lesson", {
      _scheduled_at: selected,
      _lesson_type: mode,
    });

    if (error) {
      const friendly = error.message?.includes("already booked")
        ? "That slot was just taken — please pick another."
        : error.message?.includes("No credits")
          ? "You don't have any credits left."
          : error.message;
      toast({ title: "Booking failed", description: friendly, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // Create the Google Meet event
    await supabase.functions.invoke("create-lesson-events", {
      body: { lessonIds: [data as string] },
    });

    toast({ title: "Lesson booked!", description: "A Google Meet invite is on its way." });
    setSubmitting(false);
    navigate("/student");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading availability…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/student" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <Badge variant="secondary">
            {mode === "trial" ? "Free trial · 30 min" : `${credits} credit${credits === 1 ? "" : "s"} available`}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Pick a time</h1>
          <p className="mt-1 text-muted-foreground">
            {mode === "trial"
              ? "Choose one 30-min slot for your free trial lesson."
              : `Choose a 60-min slot. Each booking uses 1 credit.`}
          </p>
        </div>

        {/* Mode selector */}
        <Card className="mb-6 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!trialAvailable || trialUsed}
              onClick={() => {
                setMode("trial");
                setSelected(null);
              }}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                mode === "trial"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent",
                (!trialAvailable || trialUsed) && "cursor-not-allowed opacity-40",
              )}
            >
              🎁 Free trial {trialUsed ? "(used)" : !trialAvailable ? "(not approved)" : ""}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("regular");
                setSelected(null);
              }}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                mode === "regular"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              📚 Regular lesson
            </button>
          </div>
          {!canBook && (
            <p className="mt-3 text-sm text-destructive">
              {mode === "trial"
                ? trialUsed
                  ? "You've already used your trial."
                  : "Request a trial from your dashboard first."
                : "You don't have any credits. Request a package from your dashboard."}
            </p>
          )}
        </Card>

        {/* Week navigator */}
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
            disabled={weekOffset === 0}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <div className="text-sm font-medium">
            Week of {weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            <span className="ml-2 text-muted-foreground">({weekOffset + 1} / 12)</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((w) => Math.min(11, w + 1))}
            disabled={weekOffset === 11}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="grid min-w-[700px] grid-cols-[80px_repeat(7,1fr)] border-b bg-muted/30">
              <div className="p-3 text-xs font-medium text-muted-foreground">Time</div>
              {Array.from({ length: 7 }).map((_, i) => {
                const d = addDays(weekStart, i);
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={i}
                    className={cn("p-3 text-center text-xs font-medium", isToday && "text-primary font-semibold")}
                  >
                    <div>{DAYS[d.getDay()]}</div>
                    <div className="text-base font-semibold text-foreground">{d.getDate()}</div>
                  </div>
                );
              })}
            </div>

            {uniqueTimes.map((time) => (
              <div key={time} className="grid min-w-[700px] grid-cols-[80px_repeat(7,1fr)] border-b last:border-b-0">
                <div className="border-r p-3 text-xs font-medium text-muted-foreground">{fmtTime(time)}</div>
                {Array.from({ length: 7 }).map((_, i) => {
                  const d = addDays(weekStart, i);
                  const dow = d.getDay();
                  const exists = ruleSet.has(`${dow}-${time}`);
                  if (!exists) return <div key={i} className="border-r last:border-r-0 bg-muted/10" />;

                  const slot = isoSlot(d, time);
                  const key = slot.toISOString();
                  const isPast = slot.getTime() < Date.now();
                  const isBooked = booked.has(key);
                  const isSelected = selected === key;
                  const disabled = isPast || isBooked || !canBook;

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggle(slot)}
                      disabled={disabled}
                      className={cn(
                        "border-r last:border-r-0 p-2 text-xs transition-colors",
                        !disabled && "hover:bg-primary/10",
                        isPast && "cursor-not-allowed bg-muted/30 text-muted-foreground",
                        isBooked && "cursor-not-allowed bg-destructive/10 text-destructive",
                        !canBook && !isPast && !isBooked && "cursor-not-allowed bg-muted/20 text-muted-foreground",
                        isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                        canBook && !isPast && !isBooked && !isSelected && "bg-background",
                      )}
                    >
                      {isBooked ? "Booked" : isSelected ? "Selected" : isPast ? "—" : "Open"}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>

        <div className="sticky bottom-4 z-10 mt-6 flex items-center justify-between rounded-xl border bg-card p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <CalendarCheck className="h-5 w-5 text-primary" />
            <div className="text-sm">
              {selected ? (
                <>
                  <div className="font-medium">
                    {new Date(selected).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {mode === "trial" ? "Free trial · 30 min" : "Regular · 60 min · 1 credit"}
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground">Pick a time slot above</span>
              )}
            </div>
          </div>
          <Button onClick={confirmBooking} disabled={!selected || submitting} size="lg">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm booking"}
          </Button>
        </div>
      </main>
    </div>
  );
}
