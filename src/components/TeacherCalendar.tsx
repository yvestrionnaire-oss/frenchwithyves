// Read-only weekly calendar for the teacher: shows booked lessons + Google Calendar events.
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PET_START_MIN = 5 * 60 + 30;
const PET_END_MIN = 19 * 60;

type Lesson = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  lesson_type: string;
  status: string;
  meet_link: string | null;
  student_id: string;
};
type Profile = { id: string; full_name: string | null };
type Busy = { start: string; end: string };

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
function petMinutes(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

export function TeacherCalendar({ profiles }: { profiles: Profile[] }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [busy, setBusy] = useState<Busy[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`teacher-cal-${weekStart.toISOString()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lessons" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [weekStart.toISOString()]);

  async function load() {
    setLoading(true);
    const [l, b] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, scheduled_at, duration_minutes, lesson_type, status, meet_link, student_id")
        .neq("status", "cancelled")
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", weekEnd.toISOString())
        .order("scheduled_at"),
      supabase.functions.invoke("get-busy-times", {
        body: { from: weekStart.toISOString(), to: weekEnd.toISOString() },
      }),
    ]);
    setLessons((l.data ?? []) as Lesson[]);
    setBusy(((b.data as { busy?: Busy[] } | null)?.busy ?? []));
    setLoading(false);
  }

  const halfHourSlots = useMemo(() => {
    const out: { hour: number; minute: number }[] = [];
    for (let h = 0; h < 24; h++) for (const m of [0, 30]) out.push({ hour: h, minute: m });
    return out;
  }, []);

  function slotDate(dayIdx: number, hour: number, minute: number) {
    const d = addDays(weekStart, dayIdx);
    d.setHours(hour, minute, 0, 0);
    return d;
  }

  // Map slot start (ms) → lesson starting there
  const lessonByStart = useMemo(() => {
    const map = new Map<number, Lesson>();
    for (const l of lessons) map.set(new Date(l.scheduled_at).getTime(), l);
    return map;
  }, [lessons]);

  function lessonCoversSlot(slot: Date): Lesson | null {
    const t = slot.getTime();
    for (const l of lessons) {
      const s = new Date(l.scheduled_at).getTime();
      const e = s + l.duration_minutes * 60_000;
      if (s <= t && t < e) return l;
    }
    return null;
  }
  function busyCoversSlot(slot: Date): boolean {
    const t = slot.getTime();
    for (const b of busy) {
      const s = new Date(b.start).getTime();
      const e = new Date(b.end).getTime();
      if (s <= t && t < e) return true;
    }
    return false;
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b p-3">
        <Button
          variant="outline" size="sm"
          onClick={() => setWeekOffset((w) => w - 1)}
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <div className="text-sm font-medium">
          Week of {weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          {loading && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
        </div>
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[800px] grid-cols-[80px_repeat(7,1fr)] sticky top-0 z-10 border-b bg-card">
          <div className="p-2 text-xs font-medium text-muted-foreground">Local time</div>
          {Array.from({ length: 7 }).map((_, i) => {
            const d = addDays(weekStart, i);
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <div key={i} className={cn("p-2 text-center text-xs font-medium", isToday && "text-primary font-semibold")}>
                <div>{DAYS[d.getDay()]}</div>
                <div className="text-base font-semibold text-foreground">{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {halfHourSlots.map(({ hour, minute }) => {
            const sample = slotDate(0, hour, minute);
            const isHourMark = minute === 0;
            const labelText = sample.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
            return (
              <div
                key={`${hour}-${minute}`}
                className={cn(
                  "grid min-w-[800px] grid-cols-[80px_repeat(7,1fr)] border-b last:border-b-0",
                  isHourMark ? "border-border" : "border-border/40",
                )}
              >
                <div className={cn(
                  "border-r px-2 py-1 text-[11px]",
                  isHourMark ? "font-semibold text-foreground" : "text-muted-foreground/70",
                )}>
                  {labelText}
                </div>
                {Array.from({ length: 7 }).map((_, day) => {
                  const slot = slotDate(day, hour, minute);
                  const startsHere = lessonByStart.get(slot.getTime()) ?? null;
                  const covers = startsHere ?? lessonCoversSlot(slot);
                  const inHours = (() => {
                    const start = petMinutes(slot);
                    return start >= PET_START_MIN && start + 30 <= PET_END_MIN;
                  })();
                  const hasBusy = !covers && busyCoversSlot(slot);

                  if (startsHere) {
                    const profile = profileMap.get(startsHere.student_id);
                    return (
                      <div
                        key={day}
                        className="relative border-r last:border-r-0 bg-primary/15 px-1 py-0.5 text-[10px]"
                        style={{ minHeight: 28 }}
                      >
                        <div className="font-medium truncate">
                          {startsHere.lesson_type === "trial" ? "🎁 " : ""}
                          {profile?.full_name ?? "Student"}
                        </div>
                        <div className="text-muted-foreground truncate">{startsHere.duration_minutes}m</div>
                        {startsHere.meet_link && (
                          <a href={startsHere.meet_link} target="_blank" rel="noreferrer" className="absolute right-1 top-1 text-primary">
                            <Video className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={day}
                      className={cn(
                        "border-r last:border-r-0 h-7",
                        !inHours && "bg-amber-100/60 dark:bg-amber-950/30",
                        covers && "bg-primary/15",
                        hasBusy && "bg-destructive/10",
                      )}
                      title={hasBusy ? "Google Calendar event" : undefined}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t p-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary/20" /> Lesson booked</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-destructive/20" /> Google Calendar busy</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-amber-100 dark:bg-amber-950/30" /> Outside teaching hours</span>
      </div>
    </Card>
  );
}
