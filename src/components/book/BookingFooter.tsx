import { Button } from "@/components/ui/button";
import { CalendarCheck, Loader2 } from "lucide-react";

type Props = {
  selected: Set<string>;
  maxSlots: number;
  submitting: boolean;
  onConfirm: () => void;
};

export function BookingFooter({ selected, maxSlots, submitting, onConfirm }: Props) {
  return (
    <div className="sticky bottom-4 z-10 mt-6 flex items-center justify-between rounded-xl border bg-card p-4 shadow-lg">
      <div className="flex items-center gap-3">
        <CalendarCheck className="h-5 w-5 text-primary" />
        <div className="text-sm">
          {selected.size === 0 ? (
            <span className="text-muted-foreground">
              {`Pick up to ${maxSlots} slot${maxSlots === 1 ? "" : "s"}`}
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
                {`${selected.size} × 60 min · ${selected.size} lesson${selected.size === 1 ? "" : "s"}`}
              </div>
            </>
          )}
        </div>
      </div>
      <Button onClick={onConfirm} disabled={selected.size === 0 || submitting} size="lg">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm${selected.size > 1 ? ` (${selected.size})` : ""}`}
      </Button>
    </div>
  );
}
