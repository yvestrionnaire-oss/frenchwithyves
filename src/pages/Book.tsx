import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarCheck, ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Teacher's hours in Peru time (5:30am – 7:00pm)
const PET_START_MIN = 5 * 60 + 30; // 330
const PET_END_MIN = 19 * 60;       // 1140

type LessonRow = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  lesson_type: string;
  student_id: string;
};
type BusyRange = { start: string; end: string };

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
function petMinutes(d: Date): number {
  // Returns minutes-since-midnight in America/Lima for the given UTC instant.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}
function isWithinTeachingHours(slot: Date, durationMin: number): boolean {
  const start = petMinutes(slot);
  const end = start + durationMin;
  // Slot must not cross midnight in PET — if end is small but start is large, it wrapped.
  if (end <= start) return false;
  return start >= PET_START_MIN && end <= PET_END_MIN;
}

export default function Book() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rescheduleId = params.get("reschedule");
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [busy, setBusy] = useState<BusyRange[]>([]);
  const [credits, setCredits] = useState(0);
  const [trialApproved, setTrialApproved] = useState(false);
  const [trialUsed, setTrialUsed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"trial" | "regular">("regular");
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, weekStart.toISOString()]);

  async function load() {
    setLoading(true);
    const [lessonsRes, balRes, reqRes, busyRes, bookedRes] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, scheduled_at, duration_minutes, status, lesson_type, student_id")
        .neq("status", "cancelled")
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", addDays(weekStart, 14).toISOString()),
      supabase.rpc("credit_balance"),
      supabase
        .from("purchase_requests")
        .select("status, package_id, packages!inner(is_free)")
        .eq("status", "approved"),
      supabase.functions.invoke("get-busy-times", {
        body: { from: weekStart.toISOString(), to: addDays(weekStart, 14).toISOString() },
      }),
      supabase.rpc("booked_ranges", {
        _from: weekStart.toISOString(),
        _to: addDays(weekStart, 14).toISOString(),
      }),
    ]);

    setLessons((lessonsRes.data ?? []) as LessonRow[]);

    const used = (lessonsRes.data ?? []).some(
      (l) => (l as LessonRow).student_id === user!.id && (l as LessonRow).lesson_type === "trial",
    );
    setTrialUsed(used);

    if (typeof balRes.data === "number") setCredits(balRes.data);

    const hasTrial = (reqRes.data ?? []).some((r) => {
      const pkg = (r as unknown as { packages: { is_free: boolean } }).packages;
      return pkg?.is_free;
    });
    setTrialApproved(hasTrial);

    const calendarBusy = (busyRes.data as { busy?: BusyRange[] } | null)?.busy ?? [];
    const otherBooked: BusyRange[] = ((bookedRes.data as Array<{ start_at: string; end_at: string }> | null) ?? [])
      .map((r) => ({ start: r.start_at, end: r.end_at }));
    setBusy([...calendarBusy, ...otherBooked]);

    // Default mode:
    //  - ?mode= query param wins (when valid for this user)
    //  - else: regular if user has credits
    //  - else: trial if approved & unused
    //  - else: regular (will show "no credits" guard)
    const credits = typeof balRes.data === "number" ? balRes.data : 0;
    const requested = params.get("mode");
    const trialAvailable = hasTrial && !used;
    let nextMode: "trial" | "regular" = "regular";
    if (requested === "trial" && trialAvailable) nextMode = "trial";
    else if (requested === "regular") nextMode = "regular";
    else if (credits > 0) nextMode = "regular";
    else if (trialAvailable) nextMode = "trial";
    setMode(nextMode);

    setLoading(false);
  }

  // Time labels for the grid: every 30 min from 00:00 PET-anchor — but we render in user's local TZ.
  // We use 24-hour day in user's local time and color cells based on PET hours.
  // Cells: every 30 minutes for 24 hours = 48 rows.
  const halfHourSlots = useMemo(() => {
    const out: { hour: number; minute: number }[] = [];
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30]) out.push({ hour: h, minute: m });
    }
    return out;
  }, []);

  function slotDate(dayIdx: number, hour: number, minute: number) {
    const d = addDays(weekStart, dayIdx);
    d.setHours(hour, minute, 0, 0);
    return d;
  }

  // Pre-compute booked & busy intervals as sorted ranges (ms).
  // When rescheduling, exclude the lesson being moved.
  const occupied = useMemo(() => {
    const ranges: [number, number][] = [];
    for (const l of lessons) {
      if (rescheduleId && l.id === rescheduleId) continue;
      const s = new Date(l.scheduled_at).getTime();
      ranges.push([s, s + l.duration_minutes * 60_000]);
    }
    for (const b of busy) {
      ranges.push([new Date(b.start).getTime(), new Date(b.end).getTime()]);
    }
    return ranges;
  }, [lessons, busy, rescheduleId]);

  function isBusy(slotStart: Date, durationMin: number): boolean {
    const s = slotStart.getTime();
    const e = s + durationMin * 60_000;
    if (occupied.some(([os, oe]) => os < e && oe > s)) return true;
    // Also exclude slots overlapping with currently-selected (other) slots
    const slotKey = slotStart.toISOString();
    for (const iso of selected) {
      if (iso === slotKey) continue;
      const os = new Date(iso).getTime();
      const oe = os + 60 * 60_000; // selected are always regular (60 min) when multi
      if (os < e && oe > s) return true;
    }
    return false;
  }

  // Reschedule mode → derive duration from existing lesson; only 1 selection allowed
  const rescheduleLesson = useMemo(
    () => (rescheduleId ? lessons.find((l) => l.id === rescheduleId) : null),
    [rescheduleId, lessons],
  );
  const isRescheduling = !!rescheduleLesson;
  const duration = isRescheduling
    ? rescheduleLesson!.duration_minutes
    : mode === "trial"
      ? 30
      : 60;
  const canBook = isRescheduling ? true : mode === "trial" ? trialApproved && !trialUsed : credits >= 1;
  const maxSlots = isRescheduling ? 1 : mode === "trial" ? 1 : credits;

  // For 60-min lessons, a cell is a "continuation" if a selection starts 30 min before it.
  function isContinuationOf(slot: Date): boolean {
    if (duration !== 60) return false;
    const prevIso = new Date(slot.getTime() - 30 * 60_000).toISOString();
    return selected.has(prevIso);
  }

  function toggle(slot: Date) {
    if (!canBook) return;
    if (slot.getTime() < Date.now()) return;
    if (!isWithinTeachingHours(slot, duration)) return;
    if (isBusy(slot, duration)) return;
    const key = slot.toISOString();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else {
        if (next.size >= maxSlots) {
          if (mode === "trial" || isRescheduling) {
            next.clear();
            next.add(key);
          } else {
            toast({ title: "Limit reached", description: `You can book up to ${maxSlots} lesson${maxSlots === 1 ? "" : "s"} (1 per credit).` });
            return prev;
          }
        } else next.add(key);
      }
      return next;
    });
  }

  async function confirmBooking() {
    if (selected.size === 0) return;
    const slots = Array.from(selected).sort();

    // Final guard: re-check each selected slot against busy/booked ranges
    // (covers Google Calendar busy times that the server-side RPC doesn't see).
    for (const iso of slots) {
      const slot = new Date(iso);
      if (isBusy(slot, duration)) {
        toast({
          title: "Slot no longer available",
          description: "Yves is busy at that time. Please pick another slot.",
          variant: "destructive",
        });
        setSelected((prev) => {
          const n = new Set(prev);
          n.delete(iso);
          return n;
        });
        return;
      }
    }

    setSubmitting(true);

    if (isRescheduling && rescheduleLesson) {
      const { error } = await supabase.rpc("reschedule_lesson", {
        _lesson_id: rescheduleLesson.id,
        _new_slot: slots[0],
      });
      if (error) {
        toast({ title: "Reschedule failed", description: error.message, variant: "destructive" });
        setSubmitting(false);
        return;
      }
      await supabase.functions.invoke("reschedule-lesson-event", { body: { lessonId: rescheduleLesson.id } });
      toast({ title: "Lesson rescheduled" });
      setSubmitting(false);
      navigate("/student");
      return;
    }

    const { data: booked, error } = await supabase.functions.invoke("book-with-availability", {
      body: { slots, lessonType: mode },
    });
    if (error || booked?.error) {
      toast({
        title: booked?.error ?? "Booking failed",
        description: booked?.description ?? error?.message ?? "Please pick another slot.",
        variant: "destructive",
      });
      setSubmitting(false);
      await load();
      return;
    }
    const lessonIds = (booked?.lessonIds as string[] | undefined) ?? [];

    if (lessonIds.length > 0) {
      await supabase.functions.invoke("create-lesson-events", { body: { lessonIds } });
    }
    toast({
      title: lessonIds.length > 1 ? `${lessonIds.length} lessons booked!` : "Lesson booked!",
      description: "A Google Meet invite is on its way.",
    });
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
          <div className="flex items-center gap-2">
            {isRescheduling ? (
              <Badge variant="secondary">Rescheduling · {duration} min</Badge>
            ) : (
              <>
                {mode === "regular" && (
                  <Badge variant="secondary">
                    {credits} credit{credits === 1 ? "" : "s"} · {credits} lesson{credits === 1 ? "" : "s"} to book
                  </Badge>
                )}
                {mode === "trial" && <Badge variant="secondary"><Sparkles className="h-3 w-3" /> Free trial · 30 min</Badge>}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">
            {isRescheduling ? "Pick a new time" : `Pick your time${mode === "regular" && credits > 1 ? "s" : ""}`}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isRescheduling
              ? `Currently ${new Date(rescheduleLesson!.scheduled_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. Pick a new slot below.`
              : mode === "trial"
                ? "Choose one 30-min slot for your free trial."
                : `Yves teaches between 5:30 AM and 7:00 PM Peru time. Pick up to ${credits} slot${credits === 1 ? "" : "s"} — 1 credit = 1 lesson.`}
          </p>
        </div>

        {/* Mode selector — only show toggle when both options exist */}
        {!isRescheduling && trialApproved && !trialUsed && credits >= 1 && (
          <Card className="mb-6 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">Booking:</span>
              <button
                type="button"
                onClick={() => { setMode("trial"); setSelected(new Set()); }}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  mode === "trial" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                🎁 Free trial (30 min)
              </button>
              <button
                type="button"
                onClick={() => { setMode("regular"); setSelected(new Set()); }}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  mode === "regular" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                📚 Regular lesson (60 min · 1 credit)
              </button>
            </div>
          </Card>
        )}

        {!canBook && (
          <Card className="mb-6 border-destructive/50 p-4">
            <p className="text-sm text-destructive">
              {mode === "trial"
                ? trialUsed
                  ? "You've already used your trial."
                  : "Request a trial from your dashboard first."
                : "You don't have any credits. Request a package from your dashboard."}
            </p>
          </Card>
        )}

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
          <div className="border-b bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            All times shown in your local timezone:{" "}
            <strong className="text-foreground">
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </strong>
          </div>
          <div className="overflow-x-auto">
            <div className="grid min-w-[800px] grid-cols-[80px_repeat(7,1fr)] sticky top-0 z-10 border-b bg-card">
              <div className="p-2 text-xs font-medium text-muted-foreground">Local time</div>
              {Array.from({ length: 7 }).map((_, i) => {
                const d = addDays(weekStart, i);
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={i}
                    className={cn("p-2 text-center text-xs font-medium", isToday && "text-primary font-semibold")}
                  >
                    <div>{DAYS[d.getDay()]}</div>
                    <div className="text-base font-semibold text-foreground">{d.getDate()}</div>
                  </div>
                );
              })}
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              {halfHourSlots.map(({ hour, minute }) => {
                // Use the first day of the week to format an example label
                const sample = slotDate(0, hour, minute);
                const isHourMark = minute === 0;
                const labelText = sample.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                return (
                  <div
                    key={`${hour}-${minute}`}
                    className={cn(
                      "grid min-w-[800px] grid-cols-[80px_repeat(7,1fr)]",
                      isHourMark ? "border-t-2 border-border" : "border-t border-dashed border-border/50",
                    )}
                  >
                    <div className={cn(
                      "border-r px-2 py-1 text-[11px] flex items-start",
                      isHourMark ? "font-bold text-foreground" : "text-muted-foreground/70",
                    )}>
                      {labelText}
                    </div>
                    {Array.from({ length: 7 }).map((_, day) => {
                      const slot = slotDate(day, hour, minute);
                      const isPast = slot.getTime() < Date.now();

                      // 60-min lessons can start at ANY 30-min boundary (e.g. 8:30 → 9:30).
                      // A cell is "continuation" only if a selection starts 30 min before it.
                      const isContinuation = isContinuationOf(slot);
                      const inHours = isWithinTeachingHours(slot, duration);
                      const isSelected = selected.has(slot.toISOString());
                      const occupiedNow = !isSelected && !isContinuation && isBusy(slot, duration);

                      const cellDisabled =
                        isContinuation /* second half of a selection is non-clickable */ ||
                        !inHours || isPast || occupiedNow || (!canBook && !isSelected);

                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => !isContinuation && toggle(slot)}
                          disabled={cellDisabled}
                          aria-label={`${slot.toLocaleString()}`}
                          className={cn(
                            "border-r last:border-r-0 h-7 text-[10px] transition-colors",
                            !inHours && "bg-amber-100/60 dark:bg-amber-950/30",
                            inHours && !cellDisabled && "hover:bg-primary/10",
                            inHours && occupiedNow && "bg-destructive/10",
                            inHours && isPast && !isSelected && !isContinuation && "bg-muted/40",
                            (isSelected || isContinuation) && "bg-primary text-primary-foreground hover:bg-primary",
                          )}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 border-t p-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border bg-background" /> Available</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary" /> Selected{duration === 60 && " (60 min = 2 cells)"}</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-destructive/20" /> Booked / busy</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-amber-100 dark:bg-amber-950/30" /> Outside teaching hours</span>
          </div>
        </Card>

        <div className="sticky bottom-4 z-10 mt-6 flex items-center justify-between rounded-xl border bg-card p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <CalendarCheck className="h-5 w-5 text-primary" />
            <div className="text-sm">
              {selected.size === 0 ? (
                <span className="text-muted-foreground">
                  {mode === "trial" ? "Pick one 30-min slot" : `Pick up to ${maxSlots} slot${maxSlots === 1 ? "" : "s"}`}
                </span>
              ) : (
                <>
                  <div className="font-medium">
                    {selected.size === 1
                      ? new Date(Array.from(selected)[0]).toLocaleString(undefined, {
                          weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                        })
                      : `${selected.size} lesson${selected.size === 1 ? "" : "s"} selected`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {mode === "trial"
                      ? "Free trial · 30 min"
                      : `${selected.size} × 60 min · ${selected.size} credit${selected.size === 1 ? "" : "s"}`}
                  </div>
                </>
              )}
            </div>
          </div>
          <Button onClick={confirmBooking} disabled={selected.size === 0 || submitting} size="lg">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm${selected.size > 1 ? ` (${selected.size})` : ""}`}
          </Button>
        </div>
      </main>
    </div>
  );
}
