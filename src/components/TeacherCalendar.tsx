// Weekly calendar for the teacher: shows booked lessons + Google Calendar events.
// Teacher can click empty slots to block their availability (inside default hours)
// or to open extra slots (outside default hours). Click again to remove the override.
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Video, Plus, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
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
type Override = {
  id: string;
  kind: "block" | "open";
  starts_at: string;
  ends_at: string;
};

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
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingSlot, setPendingSlot] = useState<number | null>(null);

  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`teacher-cal-${weekStart.toISOString()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lessons" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "availability_overrides" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [weekStart.toISOString()]);

  async function load() {
    setLoading(true);
    const [l, b, o] = await Promise.all([
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
      supabase
        .from("availability_overrides")
        .select("id, kind, starts_at, ends_at")
        .lt("starts_at", weekEnd.toISOString())
        .gt("ends_at", weekStart.toISOString()),
    ]);
    setLessons((l.data ?? []) as Lesson[]);
    setBusy(((b.data as { busy?: Busy[] } | null)?.busy ?? []));
    setOverrides((o.data ?? []) as Override[]);
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
  function overrideForSlot(slot: Date, kind: "block" | "open"): Override | null {
    const t = slot.getTime();
    const endT = t + 30 * 60_000;
    for (const o of overrides) {
      if (o.kind !== kind) continue;
      const s = new Date(o.starts_at).getTime();
      const e = new Date(o.ends_at).getTime();
      if (kind === "block") {
        if (s < endT && e > t) return o;
      } else {
        if (s <= t && e >= endT) return o;
      }
    }
    return null;
  }

  async function toggleSlot(slot: Date, kind: "block" | "open") {
    const existing = overrideForSlot(slot, kind);
    setPendingSlot(slot.getTime());
    if (existing) {
      const { error } = await supabase
        .from("availability_overrides")
        .delete()
        .eq("id", existing.id);
      setPendingSlot(null);
      if (error) {
        toast({ title: "Failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: kind === "block" ? "Slot unblocked" : "Extra slot removed" });
    } else {
      const start = new Date(slot);
      const end = new Date(slot.getTime() + 30 * 60_000);
      const { error } = await supabase
        .from("availability_overrides")
        .insert({ kind, starts_at: start.toISOString(), ends_at: end.toISOString() });
      setPendingSlot(null);
      if (error) {
        toast({ title: "Failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: kind === "block" ? "Slot blocked" : "Extra slot opened" });
    }
    await load();
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b p-3">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
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

      <div className="border-b bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        All times shown in your local timezone:{" "}
        <strong className="text-foreground">{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong>
        <span className="ml-2">· Click an open slot to block it · Click an amber slot to open it for booking</span>
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
                  const startsHere = lessonByStart.get(slot.getTime()) ?? null;
                  const covers = startsHere ?? lessonCoversSlot(slot);
                  const inHours = (() => {
                    const start = petMinutes(slot);
                    return start >= PET_START_MIN && start + 30 <= PET_END_MIN;
                  })();
                  const hasBusy = !covers && busyCoversSlot(slot);
                  const blockOverride = !covers ? overrideForSlot(slot, "block") : null;
                  const openOverride = !covers && !inHours ? overrideForSlot(slot, "open") : null;
                  const isPast = slot.getTime() < Date.now();
                  const isPending = pendingSlot === slot.getTime();

                  if (startsHere) {
                    const profile = profileMap.get(startsHere.student_id);
                    return (
                      <div
                        key={day}
                        className="relative border-r last:border-r-0 bg-primary/15 px-1 py-0.5 text-[10px]"
                        style={{ minHeight: 28 }}
                      >
                        <div className="font-medium truncate">
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

                  // Determine clickable kind:
                  // - if covers/hasBusy/past → not clickable
                  // - else if inHours → toggle 'block'
                  // - else → toggle 'open'
                  const clickable = !covers && !hasBusy && !isPast;
                  const kind: "block" | "open" = inHours ? "block" : "open";

                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={!clickable || isPending}
                      onClick={() => clickable && void toggleSlot(slot, kind)}
                      className={cn(
                        "group relative border-r last:border-r-0 h-7 w-full text-left transition-colors",
                        !inHours && !openOverride && "bg-amber-100/60 dark:bg-amber-950/30",
                        openOverride && "bg-emerald-200/70 dark:bg-emerald-900/40",
                        blockOverride && "bg-muted-foreground/30",
                        covers && "bg-primary/15",
                        hasBusy && "bg-destructive/10",
                        clickable && "hover:ring-1 hover:ring-primary/40 cursor-pointer",
                        !clickable && "cursor-default",
                      )}
                      title={
                        hasBusy ? "Google Calendar event"
                        : blockOverride ? "Blocked — click to unblock"
                        : openOverride ? "Extra slot — click to remove"
                        : !clickable ? undefined
                        : inHours ? "Click to block this slot"
                        : "Click to open this slot for booking"
                      }
                    >
                      {isPending && (
                        <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                      {clickable && !isPending && (
                        <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-muted-foreground/70 group-hover:flex">
                          {kind === "block"
                            ? (blockOverride ? <Plus className="h-3 w-3 rotate-45" /> : <Ban className="h-3 w-3" />)
                            : (openOverride ? <Ban className="h-3 w-3" /> : <Plus className="h-3 w-3" />)}
                        </span>
                      )}
                    </button>
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
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-muted-foreground/30" /> Blocked by you</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-emerald-200/70 dark:bg-emerald-900/40" /> Extra slot opened</span>
      </div>
    </Card>
  );
}
