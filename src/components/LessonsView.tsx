// Verbling-style lesson list/calendar toggle. Used by both student & teacher dashboards.
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type LessonItem = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  lesson_type: string;
  status: string;
  meet_link: string | null;
  // Display
  counterpartName: string; // student name (for teacher) or teacher name (for student)
  initials: string;
  colorHue: number; // 0-360, for the avatar
};

type Props = {
  lessons: LessonItem[];
  onReschedule?: (id: string) => void;
  onCancel?: (id: string) => void;
  rescheduleLabel?: string; // e.g. "Reschedule" or "Request reschedule"
  emptyText?: string;
  headerExtra?: React.ReactNode; // rendered to the left of the List/Calendar toggle
  scrollableList?: boolean;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startOfMonth(d: Date) {
  const o = new Date(d.getFullYear(), d.getMonth(), 1);
  return o;
}

export function LessonsView({ lessons, onReschedule, onCancel, rescheduleLabel = "Reschedule", emptyText = "No lessons yet.", headerExtra }: Props) {
  const [view, setView] = useState<"list" | "calendar">("list");

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">{headerExtra}</div>
        <div className="inline-flex self-end rounded-lg border bg-muted/30 p-1 sm:self-auto">
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              view === "calendar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Calendar
          </button>
        </div>
      </div>

      {view === "list" ? (
        <ListView lessons={lessons} onReschedule={onReschedule} onCancel={onCancel} rescheduleLabel={rescheduleLabel} emptyText={emptyText} />
      ) : (
        <MonthCalendar lessons={lessons} />
      )}
    </div>
  );
}

function ListView({ lessons, onReschedule, onCancel, rescheduleLabel, emptyText }: Required<Pick<Props, "lessons" | "rescheduleLabel" | "emptyText">> & Pick<Props, "onReschedule" | "onCancel">) {
  if (lessons.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">{emptyText}</CardContent>
      </Card>
    );
  }
  // Group by date label
  const groups = useMemo(() => {
    const map = new Map<string, LessonItem[]>();
    for (const l of lessons) {
      const d = new Date(l.scheduled_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: new Date(items[0].scheduled_at).toLocaleDateString(undefined, {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      }),
      items: items.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    }));
  }, [lessons]);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="mb-2 text-sm font-semibold text-muted-foreground">{g.label}</div>
          <div className="space-y-2">
            {g.items.map((l) => (
              <LessonRow
                key={l.id}
                lesson={l}
                onReschedule={onReschedule}
                onCancel={onCancel}
                rescheduleLabel={rescheduleLabel}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LessonRow({ lesson, onReschedule, onCancel, rescheduleLabel }: { lesson: LessonItem; onReschedule?: (id: string) => void; onCancel?: (id: string) => void; rescheduleLabel: string }) {
  const d = new Date(lesson.scheduled_at);
  const isPast = d.getTime() < Date.now();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return (
    <Card className="overflow-hidden border-l-4 border-l-primary">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground"
          style={{ backgroundColor: `hsl(${lesson.colorHue}, 70%, 55%)` }}
        >
          {lesson.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={isPast ? "secondary" : "default"}>{isPast ? "Completed" : "Scheduled"}</Badge>
          </div>
          <div className="mt-1 text-lg font-semibold">{time}</div>
          <div className="text-xs text-muted-foreground">
            {lesson.counterpartName} · {lesson.duration_minutes}-Minute Lesson
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lesson.meet_link && !isPast && (
            <Button asChild variant="outline" size="sm">
              <a href={lesson.meet_link} target="_blank" rel="noreferrer">
                <Video className="h-4 w-4" /> Join
              </a>
            </Button>
          )}
          {!isPast && onReschedule && (
            <Button variant="outline" size="sm" onClick={() => onReschedule(lesson.id)}>
              {rescheduleLabel}
            </Button>
          )}
          {!isPast && onCancel && (
            <Button variant="ghost" size="sm" onClick={() => onCancel(lesson.id)}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MonthCalendar({ lessons }: { lessons: LessonItem[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const today = new Date();
  const monthStart = useMemo(() => {
    const d = startOfMonth(today);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);
  const monthLabel = `${MONTHS[monthStart.getMonth()]} ${monthStart.getFullYear()}`;

  const cells = useMemo(() => {
    // 6 weeks * 7 days
    const firstDow = monthStart.getDay(); // 0 sun
    const days: { date: Date; inMonth: boolean }[] = [];
    const start = new Date(monthStart);
    start.setDate(start.getDate() - firstDow);
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({ date: d, inMonth: d.getMonth() === monthStart.getMonth() });
    }
    return days;
  }, [monthStart]);

  const lessonsByDay = useMemo(() => {
    const map = new Map<string, LessonItem[]>();
    for (const l of lessons) {
      const d = new Date(l.scheduled_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return map;
  }, [lessons]);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b p-3">
        <Button variant="outline" size="icon" onClick={() => setMonthOffset((m) => m - 1)} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-base font-semibold">{monthLabel}</div>
        <Button variant="outline" size="icon" onClick={() => setMonthOffset((m) => m + 1)} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 border-b bg-muted/20">
        {DAYS.map((d) => (
          <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          const key = `${c.date.getFullYear()}-${c.date.getMonth()}-${c.date.getDate()}`;
          const dayLessons = lessonsByDay.get(key) ?? [];
          const isToday = c.date.toDateString() === new Date().toDateString();
          return (
            <div
              key={i}
              className={cn(
                "min-h-[90px] border-b border-r p-1.5 text-xs",
                !c.inMonth && "bg-muted/30 text-muted-foreground/50",
                isToday && "bg-primary/5",
              )}
            >
              <div className={cn("mb-1 font-medium", isToday && "text-primary font-bold")}>
                {c.date.getDate()}
              </div>
              <div className="flex flex-wrap gap-1">
                {dayLessons.slice(0, 6).map((l) => (
                  <div
                    key={l.id}
                    title={`${new Date(l.scheduled_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · ${l.counterpartName}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-primary-foreground"
                    style={{ backgroundColor: `hsl(${l.colorHue}, 70%, 55%)` }}
                  >
                    {l.initials}
                  </div>
                ))}
                {dayLessons.length > 6 && (
                  <div className="flex h-6 items-center justify-center px-1 text-[10px] text-muted-foreground">
                    +{dayLessons.length - 6}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Helpers exported for callers
export function initialsFromName(name: string | null | undefined): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
