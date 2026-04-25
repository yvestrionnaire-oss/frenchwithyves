import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarClock, ExternalLink, Loader2, RefreshCw, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_STUDENT_ID, DEMO_STUDENT_NAME } from "@/lib/demo";
import { cn } from "@/lib/utils";

type Lesson = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  meet_link: string | null;
};

type AvailabilityRule = { day_of_week: number; slot_time: string };

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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

export default function Lessons() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [newSlot, setNewSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("lessons")
      .select("id, scheduled_at, duration_minutes, status, meet_link")
      .eq("student_id", DEMO_STUDENT_ID)
      .order("scheduled_at");
    setLessons((data as Lesson[]) ?? []);
    setLoading(false);
  }

  async function openReschedule(lesson: Lesson) {
    setActiveLesson(lesson);
    setNewSlot(null);
    setRescheduleOpen(true);
    const [rulesRes, lessonsRes] = await Promise.all([
      supabase.from("availability_rules").select("day_of_week, slot_time").order("slot_time"),
      supabase.from("lessons").select("scheduled_at, status").neq("status", "cancelled"),
    ]);
    if (rulesRes.data) setRules(rulesRes.data as AvailabilityRule[]);
    if (lessonsRes.data) {
      setBooked(
        new Set(
          (lessonsRes.data as { scheduled_at: string }[])
            .map((l) => new Date(l.scheduled_at).toISOString())
            .filter((iso) => iso !== new Date(lesson.scheduled_at).toISOString()),
        ),
      );
    }
  }

  async function confirmReschedule() {
    if (!activeLesson || !newSlot) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("reschedule_lesson", {
      _lesson_id: activeLesson.id,
      _new_slot: newSlot,
    });
    if (error) {
      toast({ title: "Reschedule failed", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }
    // Update calendar event
    await supabase.functions.invoke("reschedule-lesson-event", { body: { lessonId: activeLesson.id } });
    toast({ title: "Lesson rescheduled", description: "Your Google Calendar event has been updated." });
    setRescheduleOpen(false);
    setSubmitting(false);
    await load();
  }

  const upcoming = useMemo(
    () => lessons.filter((l) => l.status === "scheduled" && new Date(l.scheduled_at).getTime() >= Date.now()),
    [lessons],
  );
  const past = useMemo(
    () =>
      lessons.filter(
        (l) => l.status !== "scheduled" || new Date(l.scheduled_at).getTime() < Date.now(),
      ),
    [lessons],
  );

  // Reschedule slot picker — show next 4 weeks
  const slotOptions = useMemo(() => {
    if (!rules.length || !activeLesson) return [] as { iso: string; label: string }[];
    const ruleSet = new Set(rules.map((r) => `${r.day_of_week}-${r.slot_time}`));
    const out: { iso: string; label: string }[] = [];
    const start = startOfWeek(new Date());
    for (let day = 0; day < 28; day++) {
      const d = addDays(start, day);
      for (const r of rules) {
        if (r.day_of_week !== d.getDay()) continue;
        if (!ruleSet.has(`${d.getDay()}-${r.slot_time}`)) continue;
        const [h, m] = r.slot_time.split(":").map(Number);
        const slot = new Date(d);
        slot.setHours(h, m ?? 0, 0, 0);
        const iso = slot.toISOString();
        if (slot.getTime() < Date.now() + 5 * 60_000) continue;
        if (booked.has(iso)) continue;
        out.push({
          iso,
          label: slot.toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
        });
      }
    }
    return out;
  }, [rules, booked, activeLesson]);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-sm text-amber-900 dark:text-amber-100">
        🧪 Demo mode — viewing lessons of <strong>{DEMO_STUDENT_NAME}</strong>.
      </div>

      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <Link to="/book">
            <Button size="sm">Book more</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">My lessons</h1>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <section className="mb-10">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Upcoming ({upcoming.length})
              </h2>
              {upcoming.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  No upcoming lessons. <Link to="/book" className="text-primary underline">Book some</Link>.
                </Card>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((l) => {
                    const minsUntil = (new Date(l.scheduled_at).getTime() - Date.now()) / 60_000;
                    const canReschedule = minsUntil > 5;
                    return (
                      <Card key={l.id} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <CalendarClock className="h-5 w-5 text-primary" />
                          <div>
                            <div className="font-medium">{fmtDate(l.scheduled_at)}</div>
                            <div className="text-xs text-muted-foreground">
                              {l.duration_minutes} min
                              {l.meet_link && (
                                <>
                                  {" · "}
                                  <a
                                    href={l.meet_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                  >
                                    <Video className="h-3 w-3" /> Join Meet <ExternalLink className="h-3 w-3" />
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openReschedule(l)}
                          disabled={!canReschedule}
                          title={!canReschedule ? "Too late — must be 5+ min before start" : ""}
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Reschedule
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            {past.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Past ({past.length})
                </h2>
                <div className="space-y-2">
                  {past.map((l) => (
                    <Card key={l.id} className="flex items-center justify-between p-3 opacity-60">
                      <div className="text-sm">{fmtDate(l.scheduled_at)}</div>
                      <Badge variant="outline" className="text-xs">
                        {l.status}
                      </Badge>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reschedule lesson</DialogTitle>
            <DialogDescription>
              Currently scheduled for {activeLesson && fmtDate(activeLesson.scheduled_at)}. Pick a new slot.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto rounded-md border">
            {slotOptions.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No available slots in the next 4 weeks.</div>
            ) : (
              <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2">
                {slotOptions.map((o) => (
                  <button
                    key={o.iso}
                    type="button"
                    onClick={() => setNewSlot(o.iso)}
                    className={cn(
                      "rounded-md border p-2 text-left text-sm transition-colors hover:bg-accent",
                      newSlot === o.iso && "border-primary bg-primary text-primary-foreground hover:bg-primary",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRescheduleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmReschedule} disabled={!newSlot || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
