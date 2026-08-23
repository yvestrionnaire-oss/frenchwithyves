// Teacher weekly schedule (Verbling-style).
//
// Availability is RECURRING by weekday, stored in `weekly_availability`
// (weekday + start_min/end_min, Peru local minutes). Clicking a cell in
// "add"/"remove" mode toggles that half-hour for that weekday — and it
// applies to every week. Booked lessons are shown per-week (blue) with week
// navigation. All times displayed in Peru time (America/Lima), the teacher's
// schedule reference.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Column order left→right is Mon..Sun; map to JS getDay() (0=Sun..6=Sat).
const COL_TO_WEEKDAY = [1, 2, 3, 4, 5, 6, 0];

// Grid rows: 6:00am → 9:00pm Peru time, 30-min slots.
const GRID_START_MIN = 6 * 60; // 360
const GRID_END_MIN = 21 * 60; // 1260

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
type WeeklyBlock = { id: string; weekday: number; start_min: number; end_min: number };
export type CalendarMode = "idle" | "add" | "remove";

function startOfWeekMonday(d: Date) {
  const out = new Date(d);
  const day = out.getDay(); // 0=Sun
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
// Peru local minutes-since-midnight + weekday for a UTC instant.
function petParts(d: Date): { min: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const wdName = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { min: h * 60 + m, weekday: wdMap[wdName] ?? 0 };
}
function fmtRowLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function TeacherCalendar({
  profiles,
  mode = "idle",
}: {
  profiles: Profile[];
  mode?: CalendarMode;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [blocks, setBlocks] = useState<WeeklyBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const weekStart = useMemo(
    () => addDays(startOfWeekMonday(new Date()), weekOffset * 7),
    [weekOffset],
  );
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const load = useCallback(async () => {
    setLoading(true);
    const [l, wa] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, scheduled_at, duration_minutes, lesson_type, status, meet_link, student_id")
        .neq("status", "cancelled")
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", weekEnd.toISOString())
        .order("scheduled_at"),
      supabase.from("weekly_availability").select("id, weekday, start_min, end_min"),
    ]);
    setLessons((l.data ?? []) as Lesson[]);
    setBlocks((wa.data ?? []) as WeeklyBlock[]);
    setLoading(false);
  }, [weekStart, weekEnd]);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`teacher-cal-${weekStart.toISOString()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lessons" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_availability" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load, weekStart]);

  // Rows to render (6am–9pm, 30-min steps).
  const rows = useMemo(() => {
    const out: number[] = [];
    for (let m = GRID_START_MIN; m < GRID_END_MIN; m += 30) out.push(m);
    return out;
  }, []);

  // Is (weekday, min) inside a recurring availability block?
  const isAvailable = useCallback(
    (weekday: number, min: number) =>
      blocks.some((b) => b.weekday === weekday && b.start_min <= min && b.end_min >= min + 30),
    [blocks],
  );

  // The UTC Date for a given column/row in the currently-viewed week.
  function cellDate(col: number, min: number): Date {
    const d = addDays(weekStart, col);
    d.setHours(0, 0, 0, 0);
    return new Date(d.getTime() + min * 60_000);
  }

  // Booked lesson covering this specific cell (this week), if any.
  const lessonCoveringCell = useCallback(
    (col: number, min: number): Lesson | null => {
      const t = cellDate(col, min).getTime();
      for (const l of lessons) {
        const s = new Date(l.scheduled_at).getTime();
        const e = s + l.duration_minutes * 60_000;
        if (s <= t && t < e) return l;
      }
      return null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lessons, weekStart],
  );

  async function toggleCell(col: number, min: number) {
    if (mode === "idle") return;
    const weekday = COL_TO_WEEKDAY[col];
    const key = `${col}-${min}`;
    setSavingKey(key);
    try {
      const existing = blocks.find(
        (b) => b.weekday === weekday && b.start_min <= min && b.end_min >= min + 30,
      );
      if (mode === "remove") {
        if (!existing) return;
        // Split/trim the covering block so only this 30-min cell is removed.
        await supabase.from("weekly_availability").delete().eq("id", existing.id);
        const pieces: { weekday: number; start_min: number; end_min: number }[] = [];
        if (existing.start_min < min) pieces.push({ weekday, start_min: existing.start_min, end_min: min });
        if (existing.end_min > min + 30) pieces.push({ weekday, start_min: min + 30, end_min: existing.end_min });
        if (pieces.length) await supabase.from("weekly_availability").insert(pieces);
      } else {
        // add
        if (existing) return; // already available
        await supabase.from("weekly_availability").insert({ weekday, start_min: min, end_min: min + 30 });
      }
      await load();
    } finally {
      setSavingKey(null);
    }
  }

  const interactive = mode !== "idle";
  const tz = "America/Lima";

  // Total recurring hours/week (for the header stat).
  const weeklyHours = useMemo(() => {
    let mins = 0;
    for (const b of blocks) mins += b.end_min - b.start_min;
    return mins / 60;
  }, [blocks]);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b p-3">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <div className="text-sm font-medium">
          Week of {weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
          {loading && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
          <span className="ml-3 text-xs text-muted-foreground">
            Recurring: <strong className="text-primary">{weeklyHours.toFixed(1)}h</strong>/week
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-b bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Times shown in <strong className="text-foreground">Peru time</strong> ({tz}). Availability repeats every week.
        {interactive && (
          <span className="ml-2 italic text-primary">
            · {mode === "add" ? "Click a cell to make yourself available" : "Click a cell to remove availability"}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-16 border-b bg-muted/10 p-1" />
              {DAYS.map((d, col) => {
                const date = addDays(weekStart, col);
                return (
                  <th key={d} className="border-b border-l bg-muted/10 p-1 font-medium">
                    <div>{d}</div>
                    <div className="text-[10px] font-normal text-muted-foreground">
                      {date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((min) => (
              <tr key={min}>
                <td className="w-16 whitespace-nowrap border-b pr-2 text-right text-[10px] text-muted-foreground">
                  {fmtRowLabel(min)}
                </td>
                {DAYS.map((_, col) => {
                  const weekday = COL_TO_WEEKDAY[col];
                  const available = isAvailable(weekday, min);
                  const lesson = lessonCoveringCell(col, min);
                  const key = `${col}-${min}`;
                  const saving = savingKey === key;
                  const isLessonStart =
                    lesson && new Date(lesson.scheduled_at).getTime() === cellDate(col, min).getTime();
                  const student = lesson ? profileMap.get(lesson.student_id) : null;
                  return (
                    <td
                      key={col}
                      onClick={() => interactive && !lesson && toggleCell(col, min)}
                      className={cn(
                        "h-8 border-b border-l text-center align-top",
                        interactive && !lesson && "cursor-pointer",
                        lesson
                          ? "bg-[#0C447C] text-white"
                          : available
                            ? "bg-[#00B383]/90 hover:bg-[#00B383]"
                            : "bg-background hover:bg-muted/40",
                        saving && "opacity-50",
                      )}
                    >
                      {isLessonStart && (
                        <div className="flex items-center justify-center gap-1 px-1 py-0.5 text-[10px] leading-tight">
                          <Video className="h-3 w-3 shrink-0" />
                          <span className="truncate">{student?.full_name ?? "Lesson"}</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-5 border-t p-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3.5 w-3.5 rounded bg-[#00B383]" />
          <span className="text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3.5 w-3.5 rounded bg-[#0C447C]" />
          <span className="text-muted-foreground">Lesson booked</span>
        </div>
      </div>
    </Card>
  );
}
