import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarCheck, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_STUDENT_EMAIL, DEMO_STUDENT_ID, DEMO_STUDENT_NAME } from "@/lib/demo";
import { cn } from "@/lib/utils";

type AvailabilityRule = { day_of_week: number; slot_time: string };
type LessonRow = { scheduled_at: string; status: string };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(d: Date) {
  const out = new Date(d);
  const day = out.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as week start
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
  // time = "HH:MM:SS"; combine into local datetime then return ISO
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
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [credits, setCredits] = useState<number>(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [rulesRes, lessonsRes, balanceRes] = await Promise.all([
      supabase.from("availability_rules").select("day_of_week, slot_time").order("slot_time"),
      supabase.from("lessons").select("scheduled_at, status").neq("status", "cancelled"),
      supabase.rpc("credit_balance_for", { _student_id: DEMO_STUDENT_ID }),
    ]);
    if (rulesRes.data) setRules(rulesRes.data as AvailabilityRule[]);
    if (lessonsRes.data) {
      setBooked(new Set((lessonsRes.data as LessonRow[]).map((l) => new Date(l.scheduled_at).toISOString())));
    }
    if (typeof balanceRes.data === "number") setCredits(balanceRes.data);
    setLoading(false);
  }

  const uniqueTimes = useMemo(() => {
    const set = new Set<string>();
    rules.forEach((r) => set.add(r.slot_time));
    return Array.from(set).sort();
  }, [rules]);

  const ruleSet = useMemo(() => new Set(rules.map((r) => `${r.day_of_week}-${r.slot_time}`)), [rules]);

  function toggle(slot: Date) {
    const key = slot.toISOString();
    if (slot.getTime() < Date.now()) return;
    if (booked.has(key)) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }

  async function confirm() {
    if (selected.size === 0) return;
    if (selected.size > credits) {
      toast({
        title: "Not enough credits",
        description: `You selected ${selected.size} but only have ${credits} credits.`,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const slots = Array.from(selected).sort();
    const { data, error } = await supabase.rpc("book_lessons", {
      _student_id: DEMO_STUDENT_ID,
      _slots: slots,
    });

    if (error) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    const lessonIds = data as string[];

    // Create Google Calendar events with Meet links (best effort)
    const { error: gcalError } = await supabase.functions.invoke("create-lesson-events", {
      body: {
        lessonIds,
        studentEmail: DEMO_STUDENT_EMAIL,
        studentName: DEMO_STUDENT_NAME,
      },
    });

    if (gcalError) {
      toast({
        title: `Booked ${lessonIds.length} lessons`,
        description: "Lessons saved, but Google Meet link generation failed. Check Google Calendar connection.",
      });
    } else {
      toast({
        title: `${lessonIds.length} lesson${lessonIds.length > 1 ? "s" : ""} booked! 🎉`,
        description: "Google Meet links have been generated and added to your calendar.",
      });
    }

    setSelected(new Set());
    setSubmitting(false);
    await load();
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Demo banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-sm text-amber-900 dark:text-amber-100">
        🧪 Demo mode — booking as <strong>{DEMO_STUDENT_NAME}</strong>. Real authentication coming in next phase.
      </div>

      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/lessons">
              <Button variant="ghost" size="sm">
                My lessons
              </Button>
            </Link>
            <Badge variant="secondary" className="text-sm">
              {credits} credit{credits === 1 ? "" : "s"} left
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Book your lessons</h1>
          <p className="mt-1 text-muted-foreground">
            Click as many slots as you want — book your whole package in one go.
          </p>
        </div>

        {/* Week navigator */}
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
            disabled={weekOffset === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous week
          </Button>
          <div className="text-sm font-medium">
            Week of{" "}
            {weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            <span className="ml-2 text-muted-foreground">
              ({weekOffset + 1} / 12)
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((w) => Math.min(11, w + 1))}
            disabled={weekOffset === 11}
          >
            Next week
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar grid */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading availability…
            </div>
          ) : (
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
                    if (!exists)
                      return <div key={i} className="border-r last:border-r-0 bg-muted/10" />;

                    const slot = isoSlot(d, time);
                    const key = slot.toISOString();
                    const isPast = slot.getTime() < Date.now();
                    const isBooked = booked.has(key);
                    const isSelected = selected.has(key);

                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggle(slot)}
                        disabled={isPast || isBooked}
                        className={cn(
                          "border-r last:border-r-0 p-2 text-xs transition-colors",
                          "hover:bg-primary/10",
                          isPast && "cursor-not-allowed bg-muted/30 text-muted-foreground hover:bg-muted/30",
                          isBooked && "cursor-not-allowed bg-destructive/10 text-destructive hover:bg-destructive/10",
                          isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                          !isPast && !isBooked && !isSelected && "bg-background",
                        )}
                      >
                        {isBooked ? "Booked" : isSelected ? "Selected" : isPast ? "—" : "Available"}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Sticky bottom action bar */}
        <div className="sticky bottom-4 z-10 mt-6 flex items-center justify-between rounded-xl border bg-card p-4 shadow-lg">
          <div className="flex items-center gap-4">
            <CalendarCheck className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-medium">
                {selected.size} slot{selected.size === 1 ? "" : "s"} selected
              </div>
              <div className="text-xs text-muted-foreground">
                {credits - selected.size} credit{credits - selected.size === 1 ? "" : "s"} will remain
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <Button variant="ghost" onClick={() => setSelected(new Set())} disabled={submitting}>
                Clear
              </Button>
            )}
            <Button
              onClick={confirm}
              disabled={selected.size === 0 || submitting || selected.size > credits}
              size="lg"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Book {selected.size > 0 ? `${selected.size} lesson${selected.size === 1 ? "" : "s"}` : "lessons"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
