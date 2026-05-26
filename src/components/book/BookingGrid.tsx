import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DAYS, addDays, isWithinTeachingHours } from "@/lib/booking";

type Slot = { hour: number; minute: number };

type Props = {
  weekStart: Date;
  halfHourSlots: Slot[];
  duration: number;
  selected: Set<string>;
  canBook: boolean;
  isContinuationOf: (slot: Date) => boolean;
  canStartLessonAt: (slot: Date) => boolean;
  isThirtyMinuteCellOccupied: (slot: Date) => boolean;
  isOpenedByOverride?: (slot: Date) => boolean;
  toggle: (slot: Date) => void;
};

export function BookingGrid({
  weekStart,
  halfHourSlots,
  duration,
  selected,
  canBook,
  isContinuationOf,
  canStartLessonAt,
  isThirtyMinuteCellOccupied,
  isOpenedByOverride,
  toggle,
}: Props) {
  function slotDate(dayIdx: number, hour: number, minute: number) {
    const d = addDays(weekStart, dayIdx);
    d.setHours(hour, minute, 0, 0);
    return d;
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        All times shown in your local timezone:{" "}
        <strong className="text-foreground">
          {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </strong>
      </div>
      <div className="sm:hidden px-3 py-1.5 text-center text-[11px] text-muted-foreground bg-muted/10">
        ← swipe to see more days →
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
            const sample = slotDate(0, hour, minute);
            const isHourMark = minute === 0;
            const labelText = sample.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
            return (
              <div
                key={`${hour}-${minute}`}
                className={cn(
                  "grid min-w-[800px] grid-cols-[80px_repeat(7,1fr)] border-b",
                  isHourMark && "border-t-2 border-t-border/60",
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
                  const isContinuation = isContinuationOf(slot);
                  const openedExtra = !!isOpenedByOverride?.(slot);
                  const inHours = isWithinTeachingHours(slot, duration) || openedExtra;
                  const isSelected = selected.has(slot.toISOString());
                  const fullLessonBlocked = !isSelected && !isContinuation && !canStartLessonAt(slot);
                  const cellOccupied = isThirtyMinuteCellOccupied(slot);

                  const cellDisabled =
                    isContinuation ||
                    !inHours || isPast || fullLessonBlocked || (!canBook && !isSelected);

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => !isContinuation && toggle(slot)}
                      disabled={cellDisabled}
                      aria-label={slot.toLocaleString()}
                      title={
                        inHours && !cellOccupied && fullLessonBlocked && !isPast
                          ? "Free, but not enough room for a 60-minute lesson starting here"
                          : openedExtra
                            ? "Extra availability opened by Yves"
                            : undefined
                      }
                      className={cn(
                        "border-r last:border-r-0 h-7 text-[10px] transition-colors",
                        !inHours && "bg-amber-100/60 dark:bg-amber-950/30",
                        inHours && !cellDisabled && "hover:bg-primary/10",
                        inHours && cellOccupied && "bg-destructive/10",
                        inHours && !cellOccupied && fullLessonBlocked && "bg-muted/30",
                        inHours && isPast && !isSelected && !isContinuation && "bg-muted/40",
                        openedExtra && !cellOccupied && !isSelected && !isContinuation && "bg-emerald-100/70 dark:bg-emerald-900/30",
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

      <div className="flex flex-wrap items-center gap-4 border-t p-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border bg-background" /> Available</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary" /> Selected{duration === 60 && " (60 min = 2 cells)"}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-destructive/20" /> Booked / busy</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-amber-100 dark:bg-amber-950/30" /> Outside teaching hours</span>
      </div>
    </Card>
  );
}
